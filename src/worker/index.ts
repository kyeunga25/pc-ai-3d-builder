import { protectedWorkspaceLoginRedirect } from "./auth/protected-routes";
import {
  ApiError,
  apiErrorResponse,
  bilingualApiMessage,
} from "./lib/api-error";
import { logRequestRecord } from "./lib/log";
import { withPublicSecurityHeaders } from "./lib/security-headers";
import { routeRequest } from "./router";

export { AssetGenerationWorkflow } from "./workflows/asset-generation";

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
        apiErrorResponse(
          new ApiError(
            500,
            "INTERNAL_ERROR",
            bilingualApiMessage(
              "無法完成要求。",
              "The request could not be completed.",
            ),
          ),
          requestId,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
