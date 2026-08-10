import { authenticateAccessRequest } from "./auth/access";
import {
  isProtectedWorkspacePath,
  privateWorkspaceAssetResponse,
  protectedWorkspaceLoginRedirect,
} from "./auth/protected-routes";
import { resolveRequestContext } from "./auth/workspace";
import { ApiError, apiErrorResponse } from "./lib/api-error";
import { logRequestRecord } from "./lib/log";
import { enforcePilotRateLimit } from "./lib/rate-limit";
import { withPublicSecurityHeaders } from "./lib/security-headers";
import {
  assetDetailResponse,
  assetReviewMutationResponse,
  assetReviewQueueResponse,
} from "./routes/assets";
import {
  assetFileResponse,
  assetFileUploadResponse,
  createAssetSourceResponse,
} from "./routes/asset-files";
import { catalogueResponse } from "./routes/catalogue";
import {
  catalogueCreateResponse,
  catalogueImportResponse,
  catalogueMutationResponse,
} from "./routes/catalogue-write";
import {
  buildCreateResponse,
  buildDetailResponse,
  buildExportResponse,
  buildListResponse,
  buildMutationResponse,
} from "./routes/builds";
import { dashboardResponse } from "./routes/dashboard";
import {
  generationJobListResponse,
  generationJobStartResponse,
} from "./routes/generation-jobs";
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

async function authenticateWorkspaceRequest(request: Request, env: Env) {
  const identity = await authenticateAccessRequest(request, env);
  await enforcePilotRateLimit(env.PILOT_RATE_LIMITER, identity.subject);
  return resolveRequestContext(
    env.DB,
    identity,
    request.headers.get("x-rigstage-workspace-id"),
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

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const context = await authenticateWorkspaceRequest(request, env);

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

    if (url.pathname === "/api/dashboard") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }

      return dashboardResponse(env.DB, context);
    }

    if (url.pathname === "/api/catalogue") {
      if (request.method === "GET") {
        return catalogueResponse(env.DB, context, request);
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

    if (url.pathname === "/api/builds") {
      if (request.method === "GET") {
        return buildListResponse(env.DB, context);
      }
      if (request.method === "POST") {
        return buildCreateResponse(request, env.DB, context, requestId);
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, POST", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/api/build/export") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }
      return buildExportResponse(request, env.DB, context);
    }

    if (url.pathname === "/api/build") {
      if (request.method === "GET") {
        return buildDetailResponse(request, env.DB, context);
      }
      if (request.method === "PATCH") {
        return buildMutationResponse(request, env.DB, context, requestId);
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, PATCH", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/api/catalogue/part") {
      if (request.method !== "PATCH") {
        return new Response(null, {
          status: 405,
          headers: { allow: "PATCH", "cache-control": "no-store" },
        });
      }

      return catalogueMutationResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/catalogue/part/source") {
      if (request.method !== "POST") {
        return new Response(null, {
          status: 405,
          headers: { allow: "POST", "cache-control": "no-store" },
        });
      }

      return createAssetSourceResponse(
        request,
        env.DB,
        env.PRIVATE_ASSETS,
        context,
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

    if (url.pathname === "/api/assets/item/review") {
      if (request.method !== "PATCH") {
        return new Response(null, {
          status: 405,
          headers: { allow: "PATCH", "cache-control": "no-store" },
        });
      }

      return assetReviewMutationResponse(
        request,
        env.DB,
        env.PRIVATE_ASSETS,
        context,
        requestId,
      );
    }

    if (url.pathname === "/api/assets/item") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET", "cache-control": "no-store" },
        });
      }
      return assetDetailResponse(request, env.DB, context);
    }

    if (url.pathname === "/api/assets/item/file") {
      if (request.method === "GET") {
        return assetFileResponse(request, env.DB, env.PRIVATE_ASSETS, context);
      }
      if (request.method === "PUT") {
        return assetFileUploadResponse(
          request,
          env.DB,
          env.PRIVATE_ASSETS,
          context,
          requestId,
        );
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, PUT", "cache-control": "no-store" },
      });
    }

    const generationJobsMatch =
      /^\/api\/assets\/([^/]+)\/generation-jobs$/u.exec(url.pathname);
    if (generationJobsMatch) {
      if (request.method === "GET") {
        return generationJobListResponse(env, context, generationJobsMatch[1]!);
      }
      if (request.method === "POST") {
        return generationJobStartResponse(
          request,
          env,
          context,
          generationJobsMatch[1]!,
          requestId,
        );
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, POST", "cache-control": "no-store" },
      });
    }

    return apiNotFound(requestId);
  }

  if (isProtectedWorkspacePath(url.pathname)) {
    await authenticateWorkspaceRequest(request, env);
    return privateWorkspaceAssetResponse(await env.ASSETS.fetch(request));
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();

    try {
      const response = withPublicSecurityHeaders(
        await routeRequest(request, env, requestId),
      );
      logRequestRecord("info", request, {
        event: "request.complete",
        requestId,
        method: request.method,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        const loginRedirect = protectedWorkspaceLoginRedirect(
          request,
          error.status,
        );
        const response = withPublicSecurityHeaders(
          loginRedirect ?? apiErrorResponse(error, requestId),
        );
        logRequestRecord("info", request, {
          event: "request.denied",
          requestId,
          method: request.method,
          status: response.status,
          durationMs: Date.now() - startedAt,
          error: error.code,
        });
        return response;
      }

      logRequestRecord("error", request, {
        event: "request.failed",
        requestId,
        method: request.method,
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
