import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { sessionResponseSchema } from "../../shared/domain/session";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  SessionContext,
  type SessionContextValue,
  type SessionError,
  type SessionState,
} from "./session-context";
import { fetchSession, selectWorkspaceSession } from "./session-api";

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<SessionState>(() =>
    isLocalPreview
      ? { status: "authenticated", session: mockSession, error: null }
      : { status: "loading", session: null, error: null },
  );
  const reload = useCallback(() => {
    if (isLocalPreview) {
      setState({ status: "authenticated", session: mockSession, error: null });
      return;
    }

    setState({ status: "loading", session: null, error: null });
    setSelectedWorkspaceId(null);
    setReloadToken((token) => token + 1);
  }, [isLocalPreview]);
  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      if (isLocalPreview) {
        return;
      }

      setState({ status: "loading", session: null, error: null });
      setSelectedWorkspaceId(workspaceId);
    },
    [isLocalPreview],
  );

  useEffect(() => {
    if (isLocalPreview) {
      return;
    }

    const controller = new AbortController();

    const sessionRequest = selectedWorkspaceId
      ? selectWorkspaceSession(controller.signal, selectedWorkspaceId)
      : fetchSession(controller.signal);

    void sessionRequest
      .then((session) => {
        setState({ status: "authenticated", session, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        const sessionError = isSessionError(error)
          ? error
          : { status: 0, code: "SESSION_UNAVAILABLE" };
        setState({
          status:
            sessionError.status === 401 || sessionError.status === 403
              ? "denied"
              : "error",
          session: null,
          error: sessionError,
        });
      });

    return () => controller.abort();
  }, [isLocalPreview, reloadToken, selectedWorkspaceId]);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, reload, selectWorkspace }),
    [reload, selectWorkspace, state],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
