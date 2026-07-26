import {
  Archive,
  ChevronDown,
  CircleCheck,
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
  archiveArmed,
  onBuildNameChange,
  onBuildSelect,
  onCreateBuild,
  onArchiveBuild,
  onOpenInspector,
}: {
  saveState: string;
  buildName: string;
  buildId: string;
  builds: BuildListItem[];
  canWrite: boolean;
  archiveArmed: boolean;
  onBuildNameChange: (name: string) => void;
  onBuildSelect: (buildId: string) => void;
  onCreateBuild: () => void;
  onArchiveBuild: () => void;
  onOpenInspector: () => void;
}) {
  const { currentWorkspace, user } = useAuthenticatedSession();

  return (
    <header className="builder-command-bar">
      <Link className="builder-command-bar__brand" to="/dashboard">
        <BrandMark compact />
      </Link>

      <div className="command-workspace">
        <span>
          <small>工作空間</small>
          {currentWorkspace.name}
        </span>
      </div>

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
          <>
            <button
              className="icon-button command-new-build"
              type="button"
              aria-label="建立新組裝"
              onClick={onCreateBuild}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              className={`icon-button command-archive-build${
                archiveArmed ? " is-armed" : ""
              }`}
              type="button"
              aria-label={archiveArmed ? "確認封存目前組裝" : "封存目前組裝"}
              title={archiveArmed ? "再次按下以確認封存" : "封存目前組裝"}
              onClick={onArchiveBuild}
            >
              <Archive aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <span className="command-save-state" aria-live="polite">
        <CircleCheck aria-hidden="true" />
        {saveState}
      </span>

      <button
        className="button command-inspector-button"
        type="button"
        onClick={onOpenInspector}
      >
        <PanelRightOpen aria-hidden="true" />
        檢查器
      </button>

      <span
        className="account-button"
        aria-label={`${user.displayName} 帳戶`}
        title={user.displayName}
      >
        {accountInitials(user.displayName, user.email)}
      </span>
    </header>
  );
}
