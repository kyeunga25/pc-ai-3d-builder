import {
  isProtectedWorkspacePath,
  safeWorkspaceLoginReturnPath,
} from "../../shared/domain/workspace-routes";

export const protectedWorkspaceRoutePatterns = [
  "/dashboard",
  "/dashboard/*",
  "/catalogue",
  "/catalogue/*",
  "/asset-review",
  "/asset-review/*",
  "/builder",
  "/builder/*",
] as const;

export { isProtectedWorkspacePath };

export function protectedWorkspaceLoginRedirect(
  request: Request,
  status: number,
): Response | null {
  const url = new URL(request.url);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isAjax =
    request.headers.get("x-requested-with")?.toLowerCase() === "xmlhttprequest";

  if (
    request.method !== "GET" ||
    !acceptsHtml ||
    isAjax ||
    !isProtectedWorkspacePath(url.pathname) ||
    (status !== 401 && status !== 403)
  ) {
    return null;
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set(
    "reason",
    status === 401 ? "access-required" : "not-authorized",
  );
  loginUrl.searchParams.set(
    "next",
    safeWorkspaceLoginReturnPath(`${url.pathname}${url.search}`),
  );

  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: loginUrl.toString(),
    },
  });
}

export function privateWorkspaceAssetResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
