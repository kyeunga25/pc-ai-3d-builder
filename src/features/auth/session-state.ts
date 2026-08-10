import type { SessionResponse } from "../../shared/domain/session";
import type {
  SessionError,
  SessionState,
  WorkspaceSelectionState,
} from "./session-context";

export type SessionControllerState = {
  sessionState: SessionState;
  workspaceSelection: WorkspaceSelectionState;
};

export type SessionControllerAction =
  | { type: "session-load-started" }
  | { type: "session-load-succeeded"; session: SessionResponse }
  | { type: "session-load-failed"; error: SessionError }
  | { type: "workspace-selection-started"; targetWorkspaceId: string }
  | { type: "workspace-selection-succeeded"; session: SessionResponse }
  | {
      type: "workspace-selection-failed";
      targetWorkspaceId: string;
      error: SessionError;
    }
  | { type: "workspace-selection-dismissed" };

const idleWorkspaceSelection: WorkspaceSelectionState = {
  status: "idle",
  targetWorkspaceId: null,
  error: null,
};

function failedSessionState(error: SessionError): SessionState {
  return {
    status: error.status === 401 || error.status === 403 ? "denied" : "error",
    session: null,
    error,
  };
}

function invalidatesCurrentSession(error: SessionError): boolean {
  return (
    error.status === 401 ||
    error.code === "INVITE_REQUIRED" ||
    error.code === "IDENTITY_BINDING_CONFLICT"
  );
}

export function createSessionControllerState(
  sessionState: SessionState,
): SessionControllerState {
  return { sessionState, workspaceSelection: idleWorkspaceSelection };
}

export function sessionControllerReducer(
  state: SessionControllerState,
  action: SessionControllerAction,
): SessionControllerState {
  switch (action.type) {
    case "session-load-started":
      return createSessionControllerState({
        status: "loading",
        session: null,
        error: null,
      });
    case "session-load-succeeded":
    case "workspace-selection-succeeded":
      return createSessionControllerState({
        status: "authenticated",
        session: action.session,
        error: null,
      });
    case "session-load-failed":
      return createSessionControllerState(failedSessionState(action.error));
    case "workspace-selection-started":
      if (state.sessionState.status !== "authenticated") {
        return state;
      }
      return {
        sessionState: state.sessionState,
        workspaceSelection: {
          status: "switching",
          targetWorkspaceId: action.targetWorkspaceId,
          error: null,
        },
      };
    case "workspace-selection-failed":
      if (
        state.sessionState.status !== "authenticated" ||
        invalidatesCurrentSession(action.error)
      ) {
        return createSessionControllerState(failedSessionState(action.error));
      }
      return {
        sessionState: state.sessionState,
        workspaceSelection: {
          status: "error",
          targetWorkspaceId: action.targetWorkspaceId,
          error: action.error,
        },
      };
    case "workspace-selection-dismissed":
      if (state.workspaceSelection.status !== "error") {
        return state;
      }
      return {
        sessionState: state.sessionState,
        workspaceSelection: idleWorkspaceSelection,
      };
  }
}
