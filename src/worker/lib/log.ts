type LogLevel = "info" | "error";

type LogRecord = {
  event: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  error?: string;
};

type RequestLogRecord = Omit<LogRecord, "path">;

const fixedRouteTemplates = new Map<string, string>([
  ["/", "/"],
  ["/login", "/login"],
  ["/demo", "/demo"],
  ["/api", "/api"],
  ["/api/health", "/api/health"],
  ["/api/session", "/api/session"],
  ["/api/workspaces", "/api/workspaces"],
  ["/api/dashboard", "/api/dashboard"],
  ["/api/catalogue", "/api/catalogue"],
  ["/api/catalogue/import", "/api/catalogue/import"],
  ["/api/build", "/api/build"],
  ["/api/build/export", "/api/build/export"],
  ["/api/builds", "/api/builds"],
  ["/api/assets/review-queue", "/api/assets/review-queue"],
]);

const dynamicRouteTemplates = [
  {
    pattern: /^\/api\/catalogue\/[^/]+\/assets\/source$/u,
    template: "/api/catalogue/:partId/assets/source",
  },
  {
    pattern: /^\/api\/catalogue\/[^/]+$/u,
    template: "/api/catalogue/:partId",
  },
  {
    pattern: /^\/api\/assets\/[^/]+\/files\/[^/]+$/u,
    template: "/api/assets/:assetId/files/:fileKind",
  },
  {
    pattern: /^\/api\/assets\/[^/]+\/review$/u,
    template: "/api/assets/:assetId/review",
  },
  {
    pattern: /^\/api\/assets\/[^/]+\/generation-jobs$/u,
    template: "/api/assets/:assetId/generation-jobs",
  },
  {
    pattern: /^\/api\/assets\/[^/]+$/u,
    template: "/api/assets/:assetId",
  },
] as const;

const workspaceRouteRoots = [
  "/dashboard",
  "/catalogue",
  "/asset-review",
  "/builder",
] as const;

export function requestRouteTemplate(pathname: string): string {
  const fixedTemplate = fixedRouteTemplates.get(pathname);
  if (fixedTemplate) return fixedTemplate;

  for (const route of dynamicRouteTemplates) {
    if (route.pattern.test(pathname)) return route.template;
  }

  const normalizedPathname = pathname.toLowerCase();
  for (const root of workspaceRouteRoots) {
    if (normalizedPathname === root) return root;
    if (normalizedPathname.startsWith(`${root}/`)) return `${root}/*`;
  }

  if (pathname.startsWith("/demo/")) return "/demo/*";
  if (pathname === "/api" || pathname.startsWith("/api/")) return "/api/*";
  return "/public/*";
}

function logRecord(level: LogLevel, record: LogRecord): void {
  const serialized = JSON.stringify(record);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export function logRequestRecord(
  level: LogLevel,
  request: Request,
  record: RequestLogRecord,
): void {
  logRecord(level, {
    ...record,
    path: requestRouteTemplate(new URL(request.url).pathname),
  });
}
