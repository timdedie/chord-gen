import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Model registry and fallback chain.
 *
 * Providers are created lazily: `lib/ai.ts` used to throw at module load when
 * DEEPSEEK_API_KEY was missing, which took down every route that imported it —
 * including ones that never call a model — and made the app impossible to boot
 * without a key. A missing key is now a failed request, not a dead process.
 */

export type Tier = "standard" | "premium";

export interface ModelSpec {
    provider: "deepseek" | "google";
    id: string;
    label: string;
}

export const STANDARD_MODEL_ID = "deepseek-v4-flash";
export const PREMIUM_MODEL_ID = "deepseek-v4-pro";
const GOOGLE_FALLBACK_ID = "gemini-2.5-flash";

export const FREE_PREMIUM_GENERATIONS_PER_DAY = 30;
export const PRO_PREMIUM_GENERATIONS_PER_DAY = 100;

let deepseekClient: ReturnType<typeof createDeepSeek> | null = null;
let googleClient: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function deepseek() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");
    deepseekClient ??= createDeepSeek({ apiKey });
    return deepseekClient;
}

function google() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
    googleClient ??= createGoogleGenerativeAI({ apiKey });
    return googleClient;
}

export function resolveModel(spec: ModelSpec): LanguageModel {
    return spec.provider === "google" ? google()(spec.id) : deepseek()(spec.id);
}

/**
 * Models to try, in order. Google is only offered when a key is configured —
 * without it the chain is DeepSeek alone and an outage is still an outage, but
 * with it a provider failure costs one retry instead of the whole product.
 */
export function modelChain(tier: Tier): ModelSpec[] {
    const primary: ModelSpec = {
        provider: "deepseek",
        id: tier === "premium" ? PREMIUM_MODEL_ID : STANDARD_MODEL_ID,
        label: tier === "premium" ? "premium" : "standard",
    };

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return [primary];

    return [
        primary,
        { provider: "google", id: GOOGLE_FALLBACK_ID, label: "google-fallback" },
    ];
}

/**
 * DeepSeek has no light reasoning tier — low and medium both map to high — so
 * any thinking budget blows the latency budget for an interactive generation.
 */
export function providerOptions(spec: ModelSpec) {
    if (spec.provider !== "deepseek") return undefined;
    return { deepseek: { thinking: { type: "disabled" as const } } };
}
