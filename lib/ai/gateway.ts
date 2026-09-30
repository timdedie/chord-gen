// DeepSeek doesn't support native JSON schema; SDK falls back to system message injection — expected.
(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

import { generateObject, NoObjectGeneratedError, TypeValidationError, type ModelMessage } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getUserRole, type UserRole } from "@/lib/roles";
import { buildValidationErrorMessage } from "@/lib/prompts/retry";
import { MODEL_ID, model, providerOptions } from "./models";

/**
 * The single entry point for every AI route.
 *
 * The five routes each re-implemented the same sequence — authenticate, read
 * the role, check the rate limit, parse the body, build a message, call the
 * model, shape the error — and `ApiError` was declared verbatim in four of
 * them. That duplication is why the sequence drifted: `edit-progression` had no
 * auth and no rate limiting at all, leaving an unmetered model endpoint open to
 * anyone. Routes now receive an already-authorised context, so a handler cannot
 * run before the checks have.
 */

export interface AiRouteContext<TBody> {
    request: Request;
    body: TBody;
    userId: string | null;
    role: UserRole;
}

export class AiRouteError extends Error {
    constructor(
        message: string,
        readonly status = 500,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = "AiRouteError";
    }
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * Wrap a route handler with authentication, rate limiting, body parsing and
 * error shaping. Admins bypass the rate limit; everyone else is metered.
 */
export function aiRoute<TBody = unknown>(
    task: string,
    handler: (context: AiRouteContext<TBody>) => Promise<unknown>,
): (request: Request) => Promise<Response> {
    return async function route(request: Request): Promise<Response> {
        try {
            const { userId } = await auth();
            const role = await getUserRole(userId);

            if (role !== "admin" && !(await checkRateLimit(request))) {
                return json({ error: "Too many requests. Please try again tomorrow." }, 429);
            }

            let body: TBody;
            try {
                body = (await request.json()) as TBody;
            } catch {
                return json({ error: "Request body must be valid JSON." }, 400);
            }

            const result = await handler({ request, body, userId, role });
            // Streaming routes build their own Response; everything else
            // returns plain data and is serialised here.
            return result instanceof Response ? result : json(result);
        } catch (error) {
            const status = error instanceof AiRouteError ? error.status : 500;
            const details = error instanceof AiRouteError ? error.details : undefined;
            const message = error instanceof Error ? error.message : "Internal server error";

            console.error(`[ai:${task}]`, message);
            return json(details ? { error: message, details } : { error: message }, status);
        }
    };
}

interface GenerateOptions<TSchema extends z.ZodTypeAny> {
    task: string;
    userMessage: string;
    system: string;
    schema: TSchema;
    temperature?: number;
}

/** How many times to re-ask the model after a response fails validation. */
const MAX_RETRIES = 1;

/**
 * The JSON a model produced when the SDK rejected it for failing the schema,
 * or undefined for any other failure.
 *
 * `generateObject` validates against the schema itself and throws rather than
 * returning an invalid object, so without this the retry-with-errors path
 * below never ran: every validation failure was treated like a provider outage.
 */
function rejectedOutput(error: unknown): unknown {
    if (!NoObjectGeneratedError.isInstance(error)) return undefined;
    if (!TypeValidationError.isInstance(error.cause) || !error.text) return undefined;
    try {
        return JSON.parse(error.text);
    } catch {
        return undefined;
    }
}

/**
 * Run one structured generation.
 *
 * Chord symbols are repaired deterministically inside the schema before
 * validation runs (see `lib/ai/repair.ts`), so the common near-miss spellings
 * never reach this loop. What does reach it — an unparseable note, a note out
 * of range, the wrong number of chords — is logged, then sent back to the
 * model with the reasons. Nothing is patched up or partially returned: a response that is
 * still invalid after the retry fails the request, with every reason attached.
 */
export async function generateStructured<TSchema extends z.ZodTypeAny>({
    task,
    userMessage,
    system,
    schema,
    temperature = 1.0,
}: GenerateOptions<TSchema>): Promise<z.infer<TSchema>> {
    const failures: Array<{ model: string; attempt: number; error: string }> = [];
    const messages: ModelMessage[] = [{ role: "user", content: userMessage }];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const { object } = await generateObject({
                model: model(),
                schema,
                system,
                messages,
                temperature,
                providerOptions: providerOptions(),
            });
            return object as z.infer<TSchema>;
        } catch (error) {
            const raw = rejectedOutput(error);
            if (raw === undefined) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ model: MODEL_ID, attempt: attempt + 1, error: message });
                // A provider-level failure will not improve on retry.
                break;
            }

            const parsed = schema.safeParse(raw);
            if (parsed.success) return parsed.data;

            const reasons = parsed.error.issues.map((i) => i.message);
            console.warn(
                `[ai:${task}] ${MODEL_ID} attempt ${attempt + 1} rejected:\n  ${reasons.join("\n  ")}`,
            );
            failures.push({ model: MODEL_ID, attempt: attempt + 1, error: reasons.join(" | ") });

            messages.push(
                { role: "assistant", content: JSON.stringify(raw) },
                { role: "user", content: buildValidationErrorMessage(parsed.error.issues) },
            );
        }
    }

    throw new AiRouteError(`Generation failed for ${task}.`, 502, { failures });
}
