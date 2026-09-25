import { toast } from "sonner";

interface AiErrorBody {
    error?: string;
    details?: { failures?: { model: string; attempt: number; error: string }[] };
}

/**
 * Surface a failed generation instead of quietly showing nothing.
 *
 * The API returns every rejected attempt with its reasons — for voicings,
 * which note broke which rule. The last attempt's reasons go in the toast,
 * and the full list goes to the console.
 */
export function reportAiFailure(action: string, body: unknown): void {
    const { error, details } = (body ?? {}) as AiErrorBody;
    const failures = details?.failures ?? [];
    console.error(`${action} failed:`, error, failures);

    const last = failures.at(-1)?.error;
    toast.error(`${action} failed`, {
        description: last ? last.split(" | ").slice(0, 3).join("\n") : error ?? "Unknown error",
    });
}
