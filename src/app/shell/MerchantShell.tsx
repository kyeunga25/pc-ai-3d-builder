import {
  Boxes,
  ChevronDown,
  Cuboid,
  Gauge,
  Settings,
  Wrench,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";

import {
  useAuthenticatedSession,
  useSessionState,
} from "../../features/auth/session-context";
import { BrandMark } from "../../shared/components/BrandMark";
import {
  accountInitials,
  type WorkspaceRole,
} from "../../shared/domain/session";
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
          已驗證 · {roleLabels[currentWorkspace.role]}
        </div>
        <button className="icon-button" type="button" aria-label="開啟設定">
          <Settings aria-hidden="true" />
        </button>
        <button
          className="account-button"
          type="button"
          aria-label="開啟帳戶選單"
        >
          {accountInitials(user.displayName, user.email)}
        </button>
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
          <span>目錄覆蓋率</span>
          <strong>18 / 24 項已核准</strong>
          <div
            className="progress-track"
            aria-label="產品目錄覆蓋率百分之七十五"
          >
            <span style={{ width: "75%" }} />
          </div>
        </div>
      </aside>

      <main className="merchant-content">
        <Outlet />
      </main>
    </div>
  );
}
