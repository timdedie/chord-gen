import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

/**
 * Model registry.
 *
 * Providers are created lazily: `lib/ai.ts` used to throw at module load when
 * DEEPSEEK_API_KEY was missing, which took down every route that imported it —
 * including ones that never call a model — and made the app impossible to boot
 * without a key. A missing key is now a failed request, not a dead process.
 */

export type Tier = "standard" | "premium";

export interface ModelSpec {
    provider: "deepseek";
    id: string;
    label: string;
}

/**
 * Every tier runs on flash, with no fallback model: while voicings are being
 * evaluated, a failure should surface as a failure rather than be papered over
 * by a different model. Premium still meters its daily slots; it just no
 * longer buys a different model.
 */
const MODEL_ID = "deepseek-flash";
export const STANDARD_MODEL_ID = MODEL_ID;
export const PREMIUM_MODEL_ID = MODEL_ID;

export const FREE_PREMIUM_GENERATIONS_PER_DAY = 30;
export const PRO_PREMIUM_GENERATIONS_PER_DAY = 100;

let deepseekClient: ReturnType<typeof createDeepSeek> | null = null;

function deepseek() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");
    deepseekClient ??= createDeepSeek({ apiKey });
    return deepseekClient;
}

export function resolveModel(spec: ModelSpec): LanguageModel {
    return deepseek()(spec.id);
}

/** Models to try, in order — one, whatever the tier. See `MODEL_ID`. */
export function modelChain(tier: Tier): ModelSpec[] {
    return [{ provider: "deepseek", id: MODEL_ID, label: tier }];
}

/**
 * DeepSeek has no light reasoning tier — low and medium both map to high — so
 * any thinking budget blows the latency budget for an interactive generation.
 */
export function providerOptions() {
    return { deepseek: { thinking: { type: "disabled" as const } } };
}
