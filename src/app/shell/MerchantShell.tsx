import {
  Boxes,
  ChevronDown,
  Cuboid,
  Gauge,
  LogOut,
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
  { to: "/dashboard", label: "儀表板", icon: Gauge },
  { to: "/catalogue", label: "產品目錄", icon: Boxes },
  { to: "/asset-review", label: "3D 素材審核", icon: Cuboid },
  { to: "/builder", label: "電腦組裝", icon: Wrench },
];

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "擁有人",
  admin: "管理員",
  staff: "職員",
  viewer: "檢視者",
};

export function MerchantShell() {
  const { currentWorkspace, user, workspaces } = useAuthenticatedSession();
  const { selectWorkspace } = useSessionState();
  const demoMode = isPublicDemoPath();

  return (
    <div className="merchant-shell">
      <header className="merchant-header">
        <BrandMark />
        <label className="workspace-switcher">
          <span>
            <small>工作空間</small>
            <select
              value={currentWorkspace.id}
              aria-label="選擇工作空間"
              disabled={workspaces.length === 1}
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
        <div className="merchant-header__status">
          <span className="status-dot" aria-hidden="true" />
          {demoMode
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
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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
        <Outlet />
      </main>
    </div>
  );
}
