import {
  Boxes,
  ChevronDown,
  Cuboid,
  Gauge,
  LogOut,
  TriangleAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";

import {
  useAuthenticatedSession,
  useSessionState,
} from "../../features/auth/session-context";
import { accessLogoutPath } from "../../features/auth/access-navigation";
import { BrandMark } from "../../shared/components/BrandMark";
import {
  accountInitials,
  type WorkspaceRole,
} from "../../shared/domain/session";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import "./merchant-shell.css";

const navigation = [
  { to: "/dashboard", label: "儀表板", icon: Gauge, managerOnly: false },
  {
    to: "/dashboard/members",
    label: "成員管理",
    icon: UsersRound,
    managerOnly: true,
  },
  { to: "/catalogue", label: "產品目錄", icon: Boxes, managerOnly: false },
  {
    to: "/asset-review",
    label: "3D 素材審核",
    icon: Cuboid,
    managerOnly: false,
  },
  { to: "/builder", label: "電腦組裝", icon: Wrench, managerOnly: false },
];

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "擁有人",
  admin: "管理員",
  staff: "職員",
  viewer: "檢視者",
};

export function MerchantShell() {
  const { currentWorkspace, user, workspaces } = useAuthenticatedSession();
  const {
    dismissWorkspaceSelectionError,
    selectWorkspace,
    workspaceSelection,
  } = useSessionState();
  const demoMode = isPublicDemoPath();
  const switching = workspaceSelection.status === "switching";
  const targetWorkspace =
    workspaceSelection.status === "idle"
      ? null
      : (workspaces.find(
          (workspace) => workspace.id === workspaceSelection.targetWorkspaceId,
        ) ?? null);
  const targetNameZhHant = targetWorkspace?.name ?? "所選工作空間";
  const targetNameEnglish = targetWorkspace?.name ?? "the selected workspace";

  return (
    <div className="merchant-shell">
      <header className="merchant-header">
        <BrandMark />
        <label className="workspace-switcher" aria-busy={switching}>
          <span>
            <small>{switching ? "正在切換 / Switching" : "工作空間"}</small>
            <select
              value={currentWorkspace.id}
              aria-label="選擇工作空間"
              disabled={workspaces.length === 1 || switching}
              onChange={(event) => selectWorkspace(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </span>
          <ChevronDown aria-hidden="true" />
        </label>
        <div
          className="merchant-header__status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="status-dot" aria-hidden="true" />
          {switching
            ? `正在切換至 ${targetNameZhHant} / Switching to ${targetNameEnglish}`
            : demoMode
              ? "合成 Demo · 不連接正式資料"
              : `已驗證 · ${roleLabels[currentWorkspace.role]}`}
        </div>
        <span
          className="account-button"
          aria-label={`${user.displayName} 帳戶`}
          title={user.displayName}
        >
          {accountInitials(user.displayName, user.email)}
        </span>
        <a
          className="merchant-header__logout"
          href={demoMode ? "/" : accessLogoutPath}
          aria-label={demoMode ? "離開公開 Demo" : "登出 Cloudflare Access"}
        >
          <LogOut aria-hidden="true" />
          <span>{demoMode ? "離開 Demo" : "登出"}</span>
        </a>
      </header>

      <aside className="merchant-nav" aria-label="商戶導覽列">
        <div className="merchant-nav__title">商戶控制台</div>
        <nav>
          {navigation
            .filter(
              ({ managerOnly }) =>
                !managerOnly ||
                currentWorkspace.role === "owner" ||
                currentWorkspace.role === "admin",
            )
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/dashboard"}
                aria-label={
                  to === "/dashboard/members"
                    ? "成員管理 / Member management"
                    : undefined
                }
                className={({ isActive }) =>
                  `merchant-nav__link${isActive ? " is-active" : ""}`
                }
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="merchant-nav__footer">
          <span>目前工作空間</span>
          <strong>{currentWorkspace.name}</strong>
          <small>
            {demoMode
              ? "公開合成資料 · 重新載入即重設"
              : `${roleLabels[currentWorkspace.role]} · 私人資料範圍`}
          </small>
        </div>
      </aside>

      <main className="merchant-content">
        {workspaceSelection.status === "error" ? (
          <section
            className="workspace-switch-alert"
            role="alert"
            aria-atomic="true"
          >
            <TriangleAlert aria-hidden="true" />
            <div className="workspace-switch-alert__copy">
              <strong>未能切換至 {targetNameZhHant}</strong>
              <strong lang="en">Unable to switch to {targetNameEnglish}</strong>
              <p>
                目前仍顯示 {currentWorkspace.name}；未有混合目標工作空間的資料。
              </p>
              <p lang="en">
                The current workspace remains {currentWorkspace.name}. No data
                from the target workspace was mixed into this view.
              </p>
            </div>
            <div className="workspace-switch-alert__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() =>
                  selectWorkspace(workspaceSelection.targetWorkspaceId)
                }
              >
                重試 / Retry
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={dismissWorkspaceSelectionError}
              >
                留在目前工作空間 / Stay here
              </button>
            </div>
          </section>
        ) : null}
        <Outlet key={currentWorkspace.id} />
      </main>
    </div>
  );
}
