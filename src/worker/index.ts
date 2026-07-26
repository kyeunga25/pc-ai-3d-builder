import { authenticateAccessRequest } from "./auth/access";
import { resolveRequestContext } from "./auth/workspace";
import { ApiError, apiErrorResponse } from "./lib/api-error";
import { logRecord } from "./lib/log";
import { enforcePilotRateLimit } from "./lib/rate-limit";
import { withPublicSecurityHeaders } from "./lib/security-headers";
import {
  assetReviewMutationResponse,
  assetReviewQueueResponse,
} from "./routes/assets";
import { catalogueResponse } from "./routes/catalogue";
import {
  catalogueCreateResponse,
  catalogueImportResponse,
  catalogueMutationResponse,
} from "./routes/catalogue-write";
import { healthResponse } from "./routes/health";
import { sessionResponse, workspacesResponse } from "./routes/session";

export { AssetGenerationWorkflow } from "./workflows/asset-generation";

function apiNotFound(requestId: string): Response {
  return Response.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "所要求的 API 路徑不存在。",
        requestId,
      },
    },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

async function routeRequest(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET", "cache-control": "no-store" },
      });
    }

    return healthResponse(requestId);
  }

  if (url.pathname.startsWith("/api/")) {
    const identity = await authenticateAccessRequest(request, env);
    await enforcePilotRateLimit(env.PILOT_RATE_LIMITER, identity.subject);
    const context = await resolveRequestContext(
      env.DB,
      identity,
      request.headers.get("x-rigstage-workspace-id"),
    );

    if (url.pathname === "/api/session") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }

      return sessionResponse(context);
    }

    if (url.pathname === "/api/workspaces") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }

      return workspacesResponse(context);
    }

    if (url.pathname === "/api/catalogue") {
      if (request.method === "GET") {
        return catalogueResponse(env.DB, context, url);
      }

      if (request.method === "POST") {
        return catalogueCreateResponse(request, env.DB, context, requestId);
      }

      return new Response(null, {
        status: 405,
        headers: { allow: "GET, POST", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/api/catalogue/import") {
      if (request.method !== "POST") {
        return new Response(null, {
          status: 405,
          headers: { allow: "POST", "cache-control": "no-store" },
        });
      }

      return catalogueImportResponse(request, env.DB, context, requestId);
    }

    const cataloguePartMatch = /^\/api\/catalogue\/([^/]+)$/u.exec(
      url.pathname,
    );
    if (cataloguePartMatch) {
      if (request.method !== "PATCH") {
        return new Response(null, {
          status: 405,
          headers: { allow: "PATCH", "cache-control": "no-store" },
        });
      }

      return catalogueMutationResponse(
        request,
        env.DB,
        context,
        cataloguePartMatch[1]!,
        requestId,
      );
    }

    if (url.pathname === "/api/assets/review-queue") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }

      return assetReviewQueueResponse(env.DB, context);
    }

    const assetReviewMatch = /^\/api\/assets\/([^/]+)\/review$/u.exec(
      url.pathname,
    );
    if (assetReviewMatch) {
      if (request.method !== "PATCH") {
        return new Response(null, {
          status: 405,
          headers: { allow: "PATCH", "cache-control": "no-store" },
        });
      }

      return assetReviewMutationResponse(
        request,
        env.DB,
        context,
        assetReviewMatch[1]!,
        requestId,
      );
    }

    return apiNotFound(requestId);
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const url = new URL(request.url);

    try {
      const response = withPublicSecurityHeaders(
        await routeRequest(request, env, requestId),
      );
      logRecord("info", {
        event: "request.complete",
        requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        const response = withPublicSecurityHeaders(
          apiErrorResponse(error, requestId),
        );
        logRecord("info", {
          event: "request.denied",
          requestId,
          method: request.method,
          path: url.pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
          error: error.code,
        });
        return response;
      }

      logRecord("error", {
        event: "request.failed",
        requestId,
        method: request.method,
        path: url.pathname,
        status: 500,
        durationMs: Date.now() - startedAt,
        error: "UNEXPECTED_ERROR",
      });
      return withPublicSecurityHeaders(
        Response.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "無法完成要求。",
              requestId,
            },
          },
          { status: 500, headers: { "cache-control": "no-store" } },
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
