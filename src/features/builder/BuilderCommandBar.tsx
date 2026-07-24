import { ChevronDown, CircleCheck, Eye, PanelRightOpen } from "lucide-react";
import { Link } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { BrandMark } from "../../shared/components/BrandMark";
import { accountInitials } from "../../shared/domain/session";

export function BuilderCommandBar({
  saveState,
  onOpenInspector,
}: {
  saveState: string;
  onOpenInspector: () => void;
}) {
  const { currentWorkspace, user } = useAuthenticatedSession();

  return (
    <header className="builder-command-bar">
      <Link className="builder-command-bar__brand" to="/dashboard">
        <BrandMark compact />
      </Link>

      <button className="command-workspace" type="button">
        <span>
          <small>工作空間</small>
          {currentWorkspace.name}
        </span>
        <ChevronDown aria-hidden="true" />
      </button>

      <div className="command-build">
        <small>目前組裝</small>
        <strong>1440p 純黑主機</strong>
      </div>

      <span className="command-save-state" aria-live="polite">
        <CircleCheck aria-hidden="true" />
        {saveState}
      </span>

      <label className="command-view">
        <Eye aria-hidden="true" />
        <span>
          <small>檢視預設</small>
          <select defaultValue="組裝">
            <option>組裝</option>
            <option>展示</option>
            <option>淨空空間</option>
          </select>
        </span>
        <ChevronDown aria-hidden="true" />
      </label>

      <button
        className="button command-inspector-button"
        type="button"
        onClick={onOpenInspector}
      >
        <PanelRightOpen aria-hidden="true" />
        檢查器
      </button>

      <button
        className="account-button"
        type="button"
        aria-label="開啟帳戶選單"
      >
        {accountInitials(user.displayName, user.email)}
      </button>
    </header>
  );
}
