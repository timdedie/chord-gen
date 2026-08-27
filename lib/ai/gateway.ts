// DeepSeek doesn't support native JSON schema; SDK falls back to system message injection — expected.
(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getUserRole, type UserRole } from "@/lib/premium";
import { buildValidationErrorMessage } from "@/lib/prompts/retry";
import { modelChain, providerOptions, resolveModel, type ModelSpec, type Tier } from "./models";

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
    tier?: Tier;
    /**
     * A last chance to rescue a response the schema rejected — for example by
     * dropping the one malformed progression out of three and returning the
     * rest. Returning null means the attempt genuinely failed.
     */
    salvage?: (raw: unknown) => z.infer<TSchema> | null;
}

/** How many times to re-ask the model after a response fails validation. */
const MAX_RETRIES = 1;

/**
 * Run one structured generation, walking the model fallback chain.
 *
 * Chord symbols are repaired deterministically inside the schema before
 * validation runs (see `lib/ai/repair.ts`), so the common near-miss spellings
 * no longer reach this loop at all. What is left is rare enough that a single
 * retry is worth more than the three full regenerations this used to do — and
 * `salvage` usually returns something useful before that retry is needed.
 */
export async function generateStructured<TSchema extends z.ZodTypeAny>({
    task,
    userMessage,
    system,
    schema,
    temperature = 1.0,
    tier = "standard",
    salvage,
}: GenerateOptions<TSchema>): Promise<z.infer<TSchema>> {
    const chain = modelChain(tier);
    const failures: Array<{ model: string; attempt: number; error: string }> = [];

    for (const spec of chain) {
        const messages: ModelMessage[] = [{ role: "user", content: userMessage }];

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
            try {
                const { object } = await generateObject({
                    model: resolveModel(spec),
                    schema,
                    system,
                    messages,
                    temperature,
                    providerOptions: providerOptions(spec),
                });

                const parsed = schema.safeParse(object);
                if (parsed.success) return parsed.data;

                const rescued = salvage?.(object);
                if (rescued) {
                    console.warn(`[ai:${task}] salvaged a partial response from ${spec.label}`);
                    return rescued;
                }

                failures.push({
                    model: spec.label,
                    attempt: attempt + 1,
                    error: JSON.stringify(parsed.error.format()),
                });

                messages.push(
                    { role: "assistant", content: JSON.stringify(object) },
                    { role: "user", content: buildValidationErrorMessage(parsed.error.format()) },
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ model: spec.label, attempt: attempt + 1, error: message });
                // A provider-level failure will not improve on retry; move on
                // to the next model in the chain instead of asking again.
                break;
            }
        }
    }

    throw new AiRouteError(`Generation failed for ${task}.`, 502, { failures });
}

/** Chooses the model tier, without granting premium to anyone not entitled to it. */
export function tierFor(premiumGranted: boolean): Tier {
    return premiumGranted ? "premium" : "standard";
}

export function describeModelSpec(spec: ModelSpec): string {
    return `${spec.provider}:${spec.id}`;
}
