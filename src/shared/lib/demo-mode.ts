export const publicDemoRoot = "/demo";

export function isPublicDemoPath(
  pathname = typeof window === "undefined" ? "" : window.location.pathname,
): boolean {
  return (
    pathname === publicDemoRoot || pathname.startsWith(`${publicDemoRoot}/`)
  );
}
