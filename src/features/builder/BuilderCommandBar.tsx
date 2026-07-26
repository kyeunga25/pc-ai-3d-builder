import {
  ChevronDown,
  CircleCheck,
  Eye,
  PanelRightOpen,
  Plus,
} from "lucide-react";
import { Link } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { BrandMark } from "../../shared/components/BrandMark";
import type { BuildListItem } from "../../shared/domain/builds";
import { accountInitials } from "../../shared/domain/session";

export function BuilderCommandBar({
  saveState,
  buildName,
  buildId,
  builds,
  canWrite,
  onBuildNameChange,
  onBuildSelect,
  onCreateBuild,
  onOpenInspector,
}: {
  saveState: string;
  buildName: string;
  buildId: string;
  builds: BuildListItem[];
  canWrite: boolean;
  onBuildNameChange: (name: string) => void;
  onBuildSelect: (buildId: string) => void;
  onCreateBuild: () => void;
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
        <label>
          <small>目前組裝</small>
          <select
            aria-label="切換組裝"
            value={buildId}
            onChange={(event) => onBuildSelect(event.target.value)}
          >
            {builds.map((build) => (
              <option key={build.id} value={build.id}>
                {build.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
        <input
          aria-label="組裝名稱"
          value={buildName}
          maxLength={120}
          disabled={!canWrite}
          onChange={(event) => onBuildNameChange(event.target.value)}
        />
        {canWrite ? (
          <button
            className="icon-button command-new-build"
            type="button"
            aria-label="建立新組裝"
            onClick={onCreateBuild}
          >
            <Plus aria-hidden="true" />
          </button>
        ) : null}
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
