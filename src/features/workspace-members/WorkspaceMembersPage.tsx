import {
  CheckCircle2,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuthenticatedSession } from "../auth/session-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/components/AsyncState";
import { StatusBadge } from "../../shared/components/StatusBadge";
import type { WorkspaceRole } from "../../shared/domain/session";
import {
  assignableWorkspaceMemberRoles,
  canAssignWorkspaceMemberRole,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  type WorkspaceMember,
  type WorkspaceMemberListResponse,
  type WorkspaceMemberStatus,
} from "../../shared/domain/workspace-members";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMember,
} from "./workspace-members-api";
import {
  workspaceMemberFailureNotice,
  workspaceMemberIdentityCopy,
  workspaceMemberInterfaceCopy,
  workspaceMemberLoadedCount,
  workspaceMemberNoticeCopy,
  workspaceMemberRoleCopy,
  workspaceMemberStatusCopy,
  type WorkspaceMemberBilingualCopy,
  type WorkspaceMemberNotice,
} from "./workspace-members-copy";
import "./workspace-members.css";

type DirectoryState =
  | { status: "loading"; workspaceId: string; data: null }
  | { status: "error"; workspaceId: string; data: null }
  | {
      status: "ready";
      workspaceId: string;
      data: WorkspaceMemberListResponse;
    };

function BilingualText({ copy }: { copy: WorkspaceMemberBilingualCopy }) {
  return (
    <span className="workspace-member-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function bilingualLabel(copy: WorkspaceMemberBilingualCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

function sortMembers(items: WorkspaceMember[]): WorkspaceMember[] {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1;
    }
    return left.email.localeCompare(right.email, "en", {
      sensitivity: "base",
    });
  });
}

const localMemberPageCursor = "user_synthetic_operator";

function localDirectory(
  user: {
    id: string;
    email: string;
    displayName: string;
  },
  cursor: string | null = null,
): WorkspaceMemberListResponse {
  const owner = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: "owner" as const,
    status: "active" as const,
    identityState: "bound" as const,
    isCurrentUser: true,
    version: 0,
    createdAt: "2026-08-30 00:00:00",
  };
  const operator = {
    id: localMemberPageCursor,
    email: "operator@example.invalid",
    displayName: "合成營運員",
    role: "staff" as const,
    status: "active" as const,
    identityState: "pending" as const,
    isCurrentUser: false,
    version: 0,
    createdAt: "2026-08-30 00:00:00",
  };
  const viewer = {
    id: "user_synthetic_viewer",
    email: "viewer@example.invalid",
    displayName: "Synthetic Viewer",
    role: "viewer" as const,
    status: "suspended" as const,
    identityState: "bound" as const,
    isCurrentUser: false,
    version: 1,
    createdAt: "2026-08-30 00:00:00",
  };

  return workspaceMemberListResponseSchema.parse({
    items: cursor === null ? [owner, operator] : [viewer],
    nextCursor: cursor === null ? localMemberPageCursor : null,
  });
}

function mergeMemberPages(
  current: WorkspaceMember[],
  next: WorkspaceMember[],
): WorkspaceMember[] {
  const members = new Map(current.map((member) => [member.id, member]));
  for (const member of next) {
    const existing = members.get(member.id);
    if (!existing || member.version >= existing.version) {
      members.set(member.id, member);
    }
  }
  return sortMembers([...members.values()]);
}

function noticeIcon(tone: WorkspaceMemberNotice["tone"]) {
  if (tone === "success") return <CheckCircle2 aria-hidden="true" />;
  if (tone === "warning" || tone === "error") {
    return <ShieldAlert aria-hidden="true" />;
  }
  return <Info aria-hidden="true" />;
}

function MemberNotice({ notice }: { notice: WorkspaceMemberNotice }) {
  return (
    <section
      className={`workspace-member-notice is-${notice.tone}`}
      role={
        notice.tone === "error" || notice.tone === "warning"
          ? "alert"
          : "status"
      }
      aria-atomic="true"
    >
      {noticeIcon(notice.tone)}
      <BilingualText copy={notice.copy} />
    </section>
  );
}

function MemberCard({
  actorRole,
  armedForSuspension,
  busy,
  member,
  pending,
  onCancelSuspension,
  onRoleSave,
  onStatusToggle,
}: {
  actorRole: WorkspaceRole;
  armedForSuspension: boolean;
  busy: boolean;
  member: WorkspaceMember;
  pending: boolean;
  onCancelSuspension: () => void;
  onRoleSave: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onStatusToggle: (member: WorkspaceMember) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(member.role);
  const assignableRoles = assignableWorkspaceMemberRoles(actorRole);
  const roleOptions = assignableRoles.includes(member.role)
    ? assignableRoles
    : [member.role, ...assignableRoles];
  const canManageTarget =
    !member.isCurrentUser &&
    canAssignWorkspaceMemberRole(actorRole, member.role);
  const selectedRoleAllowed = canAssignWorkspaceMemberRole(
    actorRole,
    selectedRole,
  );
  const statusTone = member.status === "active" ? "success" : "danger";
  const identityTone =
    member.identityState === "bound"
      ? "info"
      : member.identityState === "pending"
        ? "warning"
        : "danger";

  return (
    <article className="workspace-member-card">
      <header>
        <div>
          <strong>{member.displayName}</strong>
          <span>{member.email}</span>
        </div>
        <div className="workspace-member-card__badges">
          {member.isCurrentUser ? (
            <StatusBadge tone="info">
              <BilingualText copy={workspaceMemberInterfaceCopy.currentUser} />
            </StatusBadge>
          ) : null}
          <StatusBadge tone={statusTone}>
            <BilingualText copy={workspaceMemberStatusCopy[member.status]} />
          </StatusBadge>
          <StatusBadge tone={identityTone}>
            <BilingualText
              copy={workspaceMemberIdentityCopy[member.identityState]}
            />
          </StatusBadge>
        </div>
      </header>

      <div className="workspace-member-card__controls">
        <label>
          <BilingualText copy={workspaceMemberInterfaceCopy.role} />
          <select
            value={selectedRole}
            disabled={!canManageTarget || busy}
            onChange={(event) => {
              onCancelSuspension();
              setSelectedRole(event.target.value as WorkspaceRole);
            }}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {bilingualLabel(workspaceMemberRoleCopy[role])}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button--secondary"
          type="button"
          disabled={
            !canManageTarget ||
            !selectedRoleAllowed ||
            selectedRole === member.role ||
            busy
          }
          onClick={() => onRoleSave(member, selectedRole)}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" />
          ) : (
            <UserCheck aria-hidden="true" />
          )}
          <BilingualText
            copy={
              pending
                ? workspaceMemberInterfaceCopy.saving
                : workspaceMemberInterfaceCopy.saveRole
            }
          />
        </button>
        <button
          className={`button ${member.status === "active" ? "button--danger" : "button--secondary"}`}
          type="button"
          disabled={!canManageTarget || busy}
          onClick={() => onStatusToggle(member)}
        >
          {member.status === "active" ? (
            <UserX aria-hidden="true" />
          ) : (
            <UserCheck aria-hidden="true" />
          )}
          <BilingualText
            copy={
              member.status === "suspended"
                ? workspaceMemberInterfaceCopy.reactivate
                : armedForSuspension
                  ? workspaceMemberInterfaceCopy.confirmSuspend
                  : workspaceMemberInterfaceCopy.suspend
            }
          />
        </button>
      </div>

      {!canManageTarget ? (
        <p className="workspace-member-card__boundary">
          <BilingualText
            copy={
              member.isCurrentUser
                ? workspaceMemberInterfaceCopy.selfManagedElsewhere
                : workspaceMemberInterfaceCopy.restrictedTarget
            }
          />
        </p>
      ) : null}
    </article>
  );
}

export function WorkspaceMembersPage() {
  const { currentWorkspace, user } = useAuthenticatedSession();
  const isLocalPreview = import.meta.env.DEV || isPublicDemoPath();
  const canManageDirectory =
    currentWorkspace.role === "owner" || currentWorkspace.role === "admin";
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<DirectoryState>(() =>
    isLocalPreview
      ? {
          status: "ready",
          workspaceId: currentWorkspace.id,
          data: localDirectory(user),
        }
      : {
          status: "loading",
          workspaceId: currentWorkspace.id,
          data: null,
        },
  );
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("staff");
  const [invitePending, setInvitePending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const pageRequestRef = useRef<AbortController | null>(null);
  const [suspensionTargetId, setSuspensionTargetId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<WorkspaceMemberNotice | null>(null);

  useEffect(() => {
    if (isLocalPreview || !canManageDirectory) {
      return;
    }
    const controller = new AbortController();
    void fetchWorkspaceMembers(controller.signal, currentWorkspace.id)
      .then((data) => {
        setState({
          status: "ready",
          workspaceId: currentWorkspace.id,
          data: { ...data, items: sortMembers(data.items) },
        });
        setNotice(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            workspaceId: currentWorkspace.id,
            data: null,
          });
          setNotice(workspaceMemberFailureNotice(error, "load"));
        }
      });
    return () => controller.abort();
  }, [canManageDirectory, currentWorkspace.id, isLocalPreview, reloadToken]);

  useEffect(
    () => () => {
      pageRequestRef.current?.abort();
      pageRequestRef.current = null;
    },
    [currentWorkspace.id],
  );

  if (!canManageDirectory) {
    return (
      <div className="page workspace-members-page workspace-members-page--state">
        <EmptyState
          title={workspaceMemberInterfaceCopy.forbiddenHeading.zhHant}
          titleEnglish={workspaceMemberInterfaceCopy.forbiddenHeading.english}
          message={workspaceMemberInterfaceCopy.forbiddenBody.zhHant}
          messageEnglish={workspaceMemberInterfaceCopy.forbiddenBody.english}
        />
      </div>
    );
  }

  const visibleStatus =
    state.workspaceId === currentWorkspace.id ? state.status : "loading";
  if (visibleStatus === "loading" || state.status !== "ready") {
    if (visibleStatus === "error") {
      return (
        <div className="page workspace-members-page workspace-members-page--state">
          <ErrorState
            title="無法載入成員管理"
            titleEnglish="Unable to load member management"
            onRetry={() => {
              setState({
                status: "loading",
                workspaceId: currentWorkspace.id,
                data: null,
              });
              setReloadToken((value) => value + 1);
            }}
          />
        </div>
      );
    }
    return (
      <div className="page workspace-members-page workspace-members-page--state">
        <LoadingState
          label="正在載入受保護的成員名單"
          labelEnglish="Loading the protected member directory"
        />
      </div>
    );
  }

  const assignableRoles = assignableWorkspaceMemberRoles(currentWorkspace.role);
  const data = state.data;

  const replaceMember = (member: WorkspaceMember) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            data: {
              ...current.data,
              items: sortMembers(
                current.data.items.map((item) =>
                  item.id === member.id ? member : item,
                ),
              ),
            },
          }
        : current,
    );
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invitePending) return;
    setSuspensionTargetId(null);
    setInvitePending(true);
    setNotice(workspaceMemberNoticeCopy.invitePending);
    try {
      const invited = isLocalPreview
        ? workspaceMemberSchema.parse({
            id: `user_${crypto.randomUUID()}`,
            email: email.trim().toLowerCase(),
            displayName: displayName.trim(),
            role: inviteRole,
            status: "active",
            identityState: "pending",
            isCurrentUser: false,
            version: 0,
            createdAt: new Date().toISOString(),
          })
        : await inviteWorkspaceMember(currentWorkspace.id, {
            email,
            displayName,
            role: inviteRole,
          });
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              data: {
                ...current.data,
                items: sortMembers([...current.data.items, invited]),
              },
            }
          : current,
      );
      setEmail("");
      setDisplayName("");
      setInviteRole("staff");
      setNotice(
        invited.identityState === "bound"
          ? workspaceMemberNoticeCopy.inviteSuccessBound
          : workspaceMemberNoticeCopy.inviteSuccessPending,
      );
    } catch (error) {
      setNotice(workspaceMemberFailureNotice(error, "invite"));
    } finally {
      setInvitePending(false);
    }
  };

  const persistMember = async (
    member: WorkspaceMember,
    role: WorkspaceRole,
    status: WorkspaceMemberStatus,
  ) => {
    if (pendingMemberId) return;
    setSuspensionTargetId(null);
    setPendingMemberId(member.id);
    setNotice(workspaceMemberNoticeCopy.updatePending);
    try {
      const updated = isLocalPreview
        ? workspaceMemberSchema.parse({
            ...member,
            role,
            status,
            version: member.version + 1,
          })
        : await updateWorkspaceMember(currentWorkspace.id, member.id, {
            expectedVersion: member.version,
            role,
            status,
          });
      replaceMember(updated);
      setNotice(workspaceMemberNoticeCopy.updateSuccess);
    } catch (error) {
      setNotice(workspaceMemberFailureNotice(error, "update"));
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleStatusToggle = (member: WorkspaceMember) => {
    if (member.status === "active" && suspensionTargetId !== member.id) {
      setSuspensionTargetId(member.id);
      setNotice(workspaceMemberNoticeCopy.confirmSuspend);
      return;
    }
    void persistMember(
      member,
      member.role,
      member.status === "active" ? "suspended" : "active",
    );
  };

  const loadMoreMembers = async () => {
    const cursor = data.nextCursor;
    if (
      cursor === null ||
      loadingMore ||
      invitePending ||
      pendingMemberId !== null
    ) {
      return;
    }
    const controller = new AbortController();
    pageRequestRef.current?.abort();
    pageRequestRef.current = controller;
    setLoadingMore(true);
    setNotice(workspaceMemberNoticeCopy.loadingMore);
    try {
      const page = isLocalPreview
        ? localDirectory(user, cursor)
        : await fetchWorkspaceMembers(
            controller.signal,
            currentWorkspace.id,
            cursor,
          );
      setState((current) =>
        current.status === "ready" &&
        current.workspaceId === currentWorkspace.id &&
        current.data.nextCursor === cursor
          ? {
              ...current,
              data: {
                items: mergeMemberPages(current.data.items, page.items),
                nextCursor: page.nextCursor,
              },
            }
          : current,
      );
      setNotice(null);
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(workspaceMemberFailureNotice(error, "paginate"));
      }
    } finally {
      if (pageRequestRef.current === controller) {
        pageRequestRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  const directoryBusy =
    loadingMore || invitePending || pendingMemberId !== null;

  return (
    <div className="page workspace-members-page">
      <header className="page-header workspace-members-header">
        <div>
          <span className="eyebrow">
            <BilingualText copy={workspaceMemberInterfaceCopy.eyebrow} />
          </span>
          <h1>
            <BilingualText copy={workspaceMemberInterfaceCopy.heading} />
          </h1>
          <p>
            <BilingualText copy={workspaceMemberInterfaceCopy.introduction} />
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={directoryBusy}
          onClick={() => {
            setNotice(null);
            setSuspensionTargetId(null);
            if (isLocalPreview) {
              setState({
                status: "ready",
                workspaceId: currentWorkspace.id,
                data: localDirectory(user),
              });
            } else {
              setState({
                status: "loading",
                workspaceId: currentWorkspace.id,
                data: null,
              });
              setReloadToken((value) => value + 1);
            }
          }}
        >
          <RefreshCw aria-hidden="true" />
          重新載入 / Reload
        </button>
      </header>

      {notice ? <MemberNotice notice={notice} /> : null}

      <section className="workspace-members-grid">
        <form className="workspace-member-invite" onSubmit={handleInvite}>
          <header>
            <UserPlus aria-hidden="true" />
            <div>
              <h2>
                <BilingualText
                  copy={workspaceMemberInterfaceCopy.inviteHeading}
                />
              </h2>
              <p>
                <BilingualText
                  copy={workspaceMemberInterfaceCopy.inviteGuidance}
                />
              </p>
            </div>
          </header>
          <label>
            <BilingualText copy={workspaceMemberInterfaceCopy.email} />
            <input
              type="email"
              value={email}
              maxLength={254}
              required
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <BilingualText copy={workspaceMemberInterfaceCopy.displayName} />
            <input
              type="text"
              value={displayName}
              maxLength={128}
              required
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label>
            <BilingualText copy={workspaceMemberInterfaceCopy.role} />
            <select
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value as WorkspaceRole)
              }
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {bilingualLabel(workspaceMemberRoleCopy[role])}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button--primary"
            type="submit"
            disabled={directoryBusy}
          >
            {invitePending ? (
              <LoaderCircle aria-hidden="true" />
            ) : (
              <UserPlus aria-hidden="true" />
            )}
            <BilingualText
              copy={
                invitePending
                  ? workspaceMemberInterfaceCopy.invitingAction
                  : workspaceMemberInterfaceCopy.inviteAction
              }
            />
          </button>
        </form>

        <section className="workspace-member-directory" aria-busy={loadingMore}>
          <header>
            <UsersRound aria-hidden="true" />
            <div>
              <h2>
                <BilingualText
                  copy={workspaceMemberInterfaceCopy.directoryHeading}
                />
              </h2>
              <p>
                <BilingualText
                  copy={workspaceMemberInterfaceCopy.directoryGuidance}
                />
              </p>
              <p className="workspace-member-directory__count">
                <BilingualText
                  copy={workspaceMemberLoadedCount(data.items.length)}
                />
              </p>
            </div>
          </header>
          <div className="workspace-member-list">
            {data.items.map((member) => (
              <MemberCard
                key={`${member.id}:${member.version}`}
                actorRole={currentWorkspace.role}
                member={member}
                pending={pendingMemberId === member.id}
                busy={directoryBusy}
                armedForSuspension={suspensionTargetId === member.id}
                onCancelSuspension={() => setSuspensionTargetId(null)}
                onRoleSave={(target, role) => {
                  setSuspensionTargetId(null);
                  void persistMember(target, role, target.status);
                }}
                onStatusToggle={handleStatusToggle}
              />
            ))}
          </div>
          {data.nextCursor ? (
            <footer className="workspace-member-directory__footer">
              <button
                className="button button--secondary"
                type="button"
                disabled={directoryBusy}
                onClick={() => void loadMoreMembers()}
              >
                {loadingMore ? (
                  <LoaderCircle aria-hidden="true" />
                ) : (
                  <UsersRound aria-hidden="true" />
                )}
                <BilingualText
                  copy={
                    loadingMore
                      ? workspaceMemberInterfaceCopy.loadingMore
                      : workspaceMemberInterfaceCopy.loadMore
                  }
                />
              </button>
            </footer>
          ) : null}
        </section>
      </section>
    </div>
  );
}
