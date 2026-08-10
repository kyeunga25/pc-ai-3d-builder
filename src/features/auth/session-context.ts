import { createContext, useContext } from "react";

import type { SessionResponse } from "../../shared/domain/session";

export type SessionError = {
  status: number;
  code: string;
};

export type SessionState =
  | { status: "loading"; session: null; error: null }
  | { status: "authenticated"; session: SessionResponse; error: null }
  | { status: "denied"; session: null; error: SessionError }
  | { status: "error"; session: null; error: SessionError };

export type WorkspaceSelectionState =
  | { status: "idle"; targetWorkspaceId: null; error: null }
  | { status: "switching"; targetWorkspaceId: string; error: null }
  | { status: "error"; targetWorkspaceId: string; error: SessionError };

export type SessionContextValue = SessionState & {
  workspaceSelection: WorkspaceSelectionState;
  reload: () => void;
  selectWorkspace: (workspaceId: string) => void;
  dismissWorkspaceSelectionError: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionState(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("SessionProvider is missing.");
  }

  return context;
}

export function useAuthenticatedSession(): SessionResponse {
  const state = useSessionState();

  if (state.status !== "authenticated") {
    throw new Error("Authenticated session is not available.");
  }

  return state.session;
}
