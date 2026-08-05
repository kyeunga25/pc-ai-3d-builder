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

const protectedWorkspaceRoots = [
  "/dashboard",
  "/catalogue",
  "/asset-review",
  "/builder",
] as const;

export function isProtectedWorkspacePath(pathname: string): boolean {
  return protectedWorkspaceRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
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
