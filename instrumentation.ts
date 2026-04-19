import { getPostHogClient } from "~/server/posthog";

export function register() {
  // No-op: PostHog Node clients are created lazily per-request in onRequestError.
}

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource?:
      | "react-server-components"
      | "react-server-components-payload"
      | "server-rendering";
    revalidateReason?: "on-demand" | "stale" | undefined;
    renderType?: "dynamic" | "dynamic-resume";
  },
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const posthog = getPostHogClient();
  const distinctId =
    (typeof request.headers["x-posthog-distinct-id"] === "string"
      ? request.headers["x-posthog-distinct-id"]
      : undefined) ?? "server-error";

  posthog.captureException(error, distinctId, {
    path: request.path,
    method: request.method,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
    render_source: context.renderSource,
    render_type: context.renderType,
  });

  await posthog.shutdown(2000);
}
