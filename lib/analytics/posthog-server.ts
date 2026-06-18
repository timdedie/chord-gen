/**
 * Edge-safe server-side event capture.
 *
 * We POST directly to PostHog's capture API with fetch instead of using
 * `posthog-node`, because the generation routes run on the Edge runtime where
 * the SDK's batching/flush lifecycle is awkward (the function can freeze right
 * after the response, dropping un-flushed events). A single awaited fetch is
 * simple and reliable; against multi-second LLM calls the added latency is
 * negligible.
 *
 * Server events reuse the same string names as the client (see
 * `lib/analytics/events.ts`) so they share a funnel in PostHog. Pass the Clerk
 * userId as `distinctId` for signed-in users so server events attach to the
 * same person identified on the client; fall back to an anonymous id otherwise.
 */

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

type ServerEventProps = Record<
    string,
    string | number | boolean | null | undefined
>;

export async function captureServer(
    event: string,
    distinctId: string,
    properties?: ServerEventProps,
): Promise<void> {
    if (!KEY) return;

    try {
        await fetch(`${HOST}/capture/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: KEY,
                event,
                distinct_id: distinctId,
                properties: {
                    ...properties,
                    // Mark server origin so these can be filtered/segmented apart
                    // from client events of the same name when needed.
                    $source: "server",
                },
                timestamp: new Date().toISOString(),
            }),
        });
    } catch (err) {
        // Analytics must never break the request path.
        console.error("[posthog-server] capture failed:", err);
    }
}
