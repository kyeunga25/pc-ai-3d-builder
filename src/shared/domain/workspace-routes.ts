export const defaultWorkspacePath = "/dashboard";

export const workspaceRouteRoots = [
  "/dashboard",
  "/catalogue",
  "/asset-review",
  "/builder",
] as const;

export type WorkspaceDestinationCopy = {
  readonly english: string;
  readonly zhHant: string;
};

type WorkspaceRouteRoot = (typeof workspaceRouteRoots)[number];

const workspaceDestinationCopyByRoot = {
  "/dashboard": {
    english: "Merchant dashboard",
    zhHant: "商戶儀表板",
  },
  "/catalogue": {
    english: "Product catalogue",
    zhHant: "產品目錄",
  },
  "/asset-review": {
    english: "3D asset review",
    zhHant: "3D 素材審核",
  },
  "/builder": {
    english: "PC builder",
    zhHant: "電腦組裝工作台",
  },
} as const satisfies Record<WorkspaceRouteRoot, WorkspaceDestinationCopy>;

function matchingWorkspaceRouteRoot(
  pathname: string,
): WorkspaceRouteRoot | undefined {
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
  return workspaceDestinationCopy(pathname).zhHant;
}

export function workspaceDestinationCopy(
  pathname: string,
): WorkspaceDestinationCopy {
  const routeRoot =
    matchingWorkspaceRouteRoot(pathname) ?? defaultWorkspacePath;
  return workspaceDestinationCopyByRoot[routeRoot];
}
