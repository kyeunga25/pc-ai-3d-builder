import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { sessionResponseSchema } from "../../shared/domain/session";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  SessionContext,
  type SessionContextValue,
  type SessionError,
} from "./session-context";
import { fetchSession, selectWorkspaceSession } from "./session-api";
import {
  createSessionControllerState,
  sessionControllerReducer,
} from "./session-state";

const mockSession = sessionResponseSchema.parse({
  user: {
    id: "user_local_preview",
    email: "preview@example.com",
    displayName: "本地預覽",
  },
  currentWorkspace: {
    id: "ws_local_preview",
    slug: "local-preview",
    name: "示範工作空間",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "owner",
  },
  workspaces: [
    {
      id: "ws_local_preview",
      slug: "local-preview",
      name: "示範工作空間",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "owner",
    },
  ],
});

function isSessionError(value: unknown): value is SessionError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof value.status === "number" &&
    "code" in value &&
    typeof value.code === "string"
  );
}

type SessionRequest =
  | { kind: "load"; requestId: number }
  | {
      kind: "workspace-selection";
      requestId: number;
      targetWorkspaceId: string;
    };

export function SessionProvider({ children }: { children: ReactNode }) {
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const [controller, dispatch] = useReducer(
    sessionControllerReducer,
    createSessionControllerState(
      isLocalPreview
        ? { status: "authenticated", session: mockSession, error: null }
        : { status: "loading", session: null, error: null },
    ),
  );
  const [request, setRequest] = useState<SessionRequest>({
    kind: "load",
    requestId: 0,
  });
  const reload = useCallback(() => {
    if (isLocalPreview) {
      dispatch({ type: "session-load-succeeded", session: mockSession });
      return;
    }

    dispatch({ type: "session-load-started" });
    setRequest((current) => ({
      kind: "load",
      requestId: current.requestId + 1,
    }));
  }, [isLocalPreview]);
  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      if (
        isLocalPreview ||
        controller.sessionState.status !== "authenticated" ||
        controller.workspaceSelection.status === "switching" ||
        workspaceId === controller.sessionState.session.currentWorkspace.id
      ) {
        return;
      }

      dispatch({
        type: "workspace-selection-started",
        targetWorkspaceId: workspaceId,
      });
      setRequest((current) => ({
        kind: "workspace-selection",
        requestId: current.requestId + 1,
        targetWorkspaceId: workspaceId,
      }));
    },
    [controller, isLocalPreview],
  );
  const dismissWorkspaceSelectionError = useCallback(() => {
    dispatch({ type: "workspace-selection-dismissed" });
  }, []);

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }

    const abortController = new AbortController();

    const sessionRequest =
      request.kind === "workspace-selection"
        ? selectWorkspaceSession(
            abortController.signal,
            request.targetWorkspaceId,
          )
        : fetchSession(abortController.signal);

    void sessionRequest
      .then((session) => {
        if (abortController.signal.aborted) {
          return;
        }
        dispatch({
          type:
            request.kind === "workspace-selection"
              ? "workspace-selection-succeeded"
              : "session-load-succeeded",
          session,
        });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        const sessionError = isSessionError(error)
          ? error
          : { status: 0, code: "SESSION_UNAVAILABLE" };
        dispatch(
          request.kind === "workspace-selection"
            ? {
                type: "workspace-selection-failed",
                targetWorkspaceId: request.targetWorkspaceId,
                error: sessionError,
              }
            : { type: "session-load-failed", error: sessionError },
        );
      });

    return () => abortController.abort();
  }, [isLocalPreview, request]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...controller.sessionState,
      workspaceSelection: controller.workspaceSelection,
      dismissWorkspaceSelectionError,
      reload,
      selectWorkspace,
    }),
    [controller, dismissWorkspaceSelectionError, reload, selectWorkspace],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
