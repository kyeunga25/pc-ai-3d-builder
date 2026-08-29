import { ApiError, apiErrorResponse, bilingualApiMessage } from "./api-error";

export type ApiRoutePolicy = {
  access: "public" | "protected";
  methods: readonly string[];
  allow: string;
};

const routePolicies = new Map<string, ApiRoutePolicy>([
  ["/api/health", { access: "public", methods: ["GET"], allow: "GET" }],
  ["/api/session", { access: "protected", methods: ["GET"], allow: "GET" }],
  [
    "/api/session/workspace",
    { access: "protected", methods: ["PUT"], allow: "PUT" },
  ],
  ["/api/workspaces", { access: "protected", methods: ["GET"], allow: "GET" }],
  ["/api/dashboard", { access: "protected", methods: ["GET"], allow: "GET" }],
  [
    "/api/workspace/members",
    { access: "protected", methods: ["GET", "POST"], allow: "GET, POST" },
  ],
  [
    "/api/workspace/member",
    { access: "protected", methods: ["PATCH"], allow: "PATCH" },
  ],
  [
    "/api/catalogue",
    { access: "protected", methods: ["GET", "POST"], allow: "GET, POST" },
  ],
  [
    "/api/catalogue/import",
    { access: "protected", methods: ["POST"], allow: "POST" },
  ],
  [
    "/api/builds",
    { access: "protected", methods: ["GET", "POST"], allow: "GET, POST" },
  ],
  [
    "/api/build/export",
    { access: "protected", methods: ["GET"], allow: "GET" },
  ],
  [
    "/api/build",
    { access: "protected", methods: ["GET", "PATCH"], allow: "GET, PATCH" },
  ],
  [
    "/api/catalogue/part",
    { access: "protected", methods: ["PATCH"], allow: "PATCH" },
  ],
  [
    "/api/catalogue/part/source",
    { access: "protected", methods: ["POST"], allow: "POST" },
  ],
  [
    "/api/assets/review-queue",
    { access: "protected", methods: ["GET"], allow: "GET" },
  ],
  [
    "/api/assets/item/review",
    { access: "protected", methods: ["PATCH"], allow: "PATCH" },
  ],
  ["/api/assets/item", { access: "protected", methods: ["GET"], allow: "GET" }],
  [
    "/api/assets/item/file",
    { access: "protected", methods: ["GET", "PUT"], allow: "GET, PUT" },
  ],
  [
    "/api/assets/item/generation-jobs",
    { access: "protected", methods: ["GET", "POST"], allow: "GET, POST" },
  ],
]);

export function apiRoutePolicy(pathname: string): ApiRoutePolicy | null {
  return routePolicies.get(pathname) ?? null;
}

export function isApiMethodAllowed(
  policy: ApiRoutePolicy | null,
  method: string,
): boolean {
  return (
    policy?.methods.some((allowedMethod) => allowedMethod === method) ?? false
  );
}

export function methodNotAllowedResponse(
  policy: ApiRoutePolicy,
  requestId: string,
): Response {
  const response = apiErrorResponse(
    new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      bilingualApiMessage(
        "此 API 路徑不接受所使用的要求方法。",
        "This API path does not allow the requested method.",
      ),
    ),
    requestId,
  );
  response.headers.set("allow", policy.allow);
  return response;
}
