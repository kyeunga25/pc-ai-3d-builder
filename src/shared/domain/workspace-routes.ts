export const defaultWorkspacePath = "/dashboard";

export const workspaceRouteRoots = [
  "/dashboard",
  "/catalogue",
  "/asset-review",
  "/builder",
] as const;

function matchingWorkspaceRouteRoot(pathname: string): string | undefined {
  const normalizedPathname = pathname.split(/[?#]/u, 1)[0]!.toLowerCase();

  return workspaceRouteRoots.find(
    (root) =>
      normalizedPathname === root || normalizedPathname.startsWith(`${root}/`),
  );
}

export function isProtectedWorkspacePath(pathname: string): boolean {
  return matchingWorkspaceRouteRoot(pathname) !== undefined;
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

  return matchingWorkspaceRouteRoot(pathname) ?? defaultWorkspacePath;
}

export function workspaceDestinationLabel(pathname: string): string {
  const routeRoot = matchingWorkspaceRouteRoot(pathname);

  if (routeRoot === "/catalogue") {
    return "產品目錄";
  }
  if (routeRoot === "/asset-review") {
    return "3D 素材審核";
  }
  if (routeRoot === "/builder") {
    return "電腦組裝工作台";
  }
  return "商戶儀表板";
}
