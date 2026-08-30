import { authenticateAccessRequest } from "./auth/access";
import {
  isProtectedWorkspacePath,
  privateWorkspaceAssetResponse,
} from "./auth/protected-routes";
import { resolveRequestContext } from "./auth/workspace";
import {
  ApiError,
  apiErrorResponse,
  bilingualApiMessage,
} from "./lib/api-error";
import {
  apiRoutePolicy,
  isApiMethodAllowed,
  methodNotAllowedResponse,
} from "./lib/api-routing";
import { enforcePilotRateLimit } from "./lib/rate-limit";
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
import {
  sessionResponse,
  workspaceSelectionResponse,
  workspacesResponse,
} from "./routes/session";
import {
  workspaceMemberInviteResponse,
  workspaceMemberListResponse,
  workspaceMemberUpdateResponse,
} from "./routes/workspace-members";
import { workspaceActivityResponse } from "./routes/workspace-activity";

function apiNotFound(requestId: string): Response {
  return apiErrorResponse(
    new ApiError(
      404,
      "NOT_FOUND",
      bilingualApiMessage(
        "所要求的 API 路徑不存在。",
        "The requested API path does not exist.",
      ),
    ),
    requestId,
  );
}

async function authenticateProtectedSubject(request: Request, env: Env) {
  const identity = await authenticateAccessRequest(request, env);
  await enforcePilotRateLimit(env.PILOT_RATE_LIMITER, identity.subject);
  return identity;
}

async function authenticateWorkspaceRequest(request: Request, env: Env) {
  const identity = await authenticateProtectedSubject(request, env);
  const context = await resolveRequestContext(
    env.DB,
    identity,
    request.headers.get("x-rigstage-workspace-id"),
  );
  return { accessSubject: identity.subject, context };
}

export async function routeRequest(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const policy = apiRoutePolicy(url.pathname);

  if (url.pathname === "/api/health") {
    if (!policy || policy.access !== "public") {
      return apiNotFound(requestId);
    }

    if (!isApiMethodAllowed(policy, request.method)) {
      return methodNotAllowedResponse(policy, requestId);
    }

    return healthResponse(requestId);
  }

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const identity = await authenticateProtectedSubject(request, env);

    if (!policy || policy.access !== "protected") {
      return apiNotFound(requestId);
    }

    if (!isApiMethodAllowed(policy, request.method)) {
      return methodNotAllowedResponse(policy, requestId);
    }

    const context = await resolveRequestContext(
      env.DB,
      identity,
      request.headers.get("x-rigstage-workspace-id"),
    );
    const accessSubject = identity.subject;

    if (url.pathname === "/api/session") {
      return sessionResponse(context);
    }

    if (url.pathname === "/api/session/workspace") {
      return workspaceSelectionResponse(env.DB, context, accessSubject);
    }

    if (url.pathname === "/api/workspaces") {
      return workspacesResponse(context);
    }

    if (url.pathname === "/api/dashboard") {
      return dashboardResponse(env.DB, context);
    }

    if (url.pathname === "/api/workspace/activity") {
      return workspaceActivityResponse(request, env.DB, context);
    }

    if (url.pathname === "/api/workspace/members") {
      if (request.method === "GET") {
        return workspaceMemberListResponse(env.DB, context);
      }
      return workspaceMemberInviteResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/workspace/member") {
      return workspaceMemberUpdateResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/catalogue") {
      if (request.method === "GET") {
        return catalogueResponse(env.DB, context, request);
      }
      return catalogueCreateResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/catalogue/import") {
      return catalogueImportResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/builds") {
      if (request.method === "GET") {
        return buildListResponse(env.DB, context);
      }
      return buildCreateResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/build/export") {
      return buildExportResponse(request, env.DB, context);
    }

    if (url.pathname === "/api/build") {
      if (request.method === "GET") {
        return buildDetailResponse(request, env.DB, context);
      }
      return buildMutationResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/catalogue/part") {
      return catalogueMutationResponse(request, env.DB, context, requestId);
    }

    if (url.pathname === "/api/catalogue/part/source") {
      return createAssetSourceResponse(
        request,
        env.DB,
        env.PRIVATE_ASSETS,
        context,
        requestId,
      );
    }

    if (url.pathname === "/api/assets/review-queue") {
      return assetReviewQueueResponse(env.DB, context);
    }

    if (url.pathname === "/api/assets/item/review") {
      return assetReviewMutationResponse(
        request,
        env.DB,
        env.PRIVATE_ASSETS,
        context,
        requestId,
      );
    }

    if (url.pathname === "/api/assets/item") {
      return assetDetailResponse(request, env.DB, context);
    }

    if (url.pathname === "/api/assets/item/file") {
      if (request.method === "GET") {
        return assetFileResponse(request, env.DB, env.PRIVATE_ASSETS, context);
      }
      return assetFileUploadResponse(
        request,
        env.DB,
        env.PRIVATE_ASSETS,
        context,
        requestId,
      );
    }

    if (url.pathname === "/api/assets/item/generation-jobs") {
      if (request.method === "GET") {
        return generationJobListResponse(request, env, context);
      }
      return generationJobStartResponse(request, env, context, requestId);
    }

    return apiNotFound(requestId);
  }

  if (isProtectedWorkspacePath(url.pathname)) {
    await authenticateWorkspaceRequest(request, env);
    return privateWorkspaceAssetResponse(await env.ASSETS.fetch(request));
  }

  return env.ASSETS.fetch(request);
}
