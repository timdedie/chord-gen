import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

/**
 * The one model every request runs on, with no fallback: a failure should
 * surface as a failure rather than be papered over by a different model.
 *
 * The provider is created lazily: `lib/ai.ts` used to throw at module load
 * when DEEPSEEK_API_KEY was missing, which took down every route that imported
 * it — including ones that never call a model. A missing key is now a failed
 * request, not a dead process.
 */
export const MODEL_ID = "deepseek-flash";

let deepseekClient: ReturnType<typeof createDeepSeek> | null = null;

export function model(): LanguageModel {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");
    deepseekClient ??= createDeepSeek({ apiKey });
    return deepseekClient(MODEL_ID);
}

/**
 * DeepSeek has no light reasoning tier — low and medium both map to high — so
 * any thinking budget blows the latency budget for an interactive generation.
 */
export function providerOptions() {
    return { deepseek: { thinking: { type: "disabled" as const } } };
}
