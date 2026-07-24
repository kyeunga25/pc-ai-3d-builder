import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  sessionResponseSchema,
  type SessionResponse,
} from "../../shared/domain/session";
import {
  SessionContext,
  type SessionContextValue,
  type SessionError,
  type SessionState,
} from "./session-context";

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

async function fetchSession(
  signal: AbortSignal,
  workspaceId: string | null,
): Promise<SessionResponse> {
  const headers = new Headers({ accept: "application/json" });

  if (workspaceId) {
    headers.set("x-rigstage-workspace-id", workspaceId);
  }

  const response = await fetch("/api/session", {
    credentials: "same-origin",
    headers,
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: unknown };
    } | null;
    const code =
      typeof body?.error?.code === "string"
        ? body.error.code
        : "SESSION_UNAVAILABLE";
    throw { status: response.status, code } satisfies SessionError;
  }

  return sessionResponseSchema.parse(await response.json());
}

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
  const isLocalPreview = import.meta.env.DEV;
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

    void fetchSession(controller.signal, selectedWorkspaceId)
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
