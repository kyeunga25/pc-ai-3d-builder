export const defaultWorkspacePath = "/dashboard";

export const workspaceRouteRoots = [
  "/dashboard",
  "/catalogue",
  "/asset-review",
  "/builder",
] as const;

export function isProtectedWorkspacePath(pathname: string): boolean {
  return workspaceRouteRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function safeWorkspaceReturnPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return defaultWorkspacePath;
  }

  try {
    const parsed = new URL(candidate, "https://rigstage.invalid");
    if (
      parsed.origin !== "https://rigstage.invalid" ||
      !isProtectedWorkspacePath(parsed.pathname)
    ) {
      return defaultWorkspacePath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultWorkspacePath;
  }
}

export function safeWorkspaceLoginReturnPath(candidate: string | null): string {
  const returnPath = safeWorkspaceReturnPath(candidate);
  const pathname = new URL(returnPath, "https://rigstage.invalid").pathname;

  return (
    workspaceRouteRoots.find(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    ) ?? defaultWorkspacePath
  );
}

export function workspaceDestinationLabel(pathname: string): string {
  if (pathname.startsWith("/catalogue")) {
    return "產品目錄";
  }
  if (pathname.startsWith("/asset-review")) {
    return "3D 素材審核";
  }
  if (pathname.startsWith("/builder")) {
    return "電腦組裝工作台";
  }
  return "商戶儀表板";
}
