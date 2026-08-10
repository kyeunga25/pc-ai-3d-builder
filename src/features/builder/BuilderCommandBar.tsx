import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ChevronDown,
  CircleCheck,
  Info,
  PanelRightOpen,
  Plus,
} from "lucide-react";
import { Link } from "react-router";

import { useAuthenticatedSession } from "../auth/session-context";
import { BrandMark } from "../../shared/components/BrandMark";
import type { BuildListItem } from "../../shared/domain/builds";
import { accountInitials } from "../../shared/domain/session";
import {
  bilingualCommandBarTitle,
  builderAccountLabel,
  builderArchiveActionCopy,
  builderArchiveTitleCopy,
  builderCommandBarCopy,
  type BuilderCommandBarCopy,
} from "./builder-command-bar-copy";
import type { BuilderOperationStatus } from "./builder-status";

function CommandBarCopy({ copy }: { copy: BuilderCommandBarCopy }) {
  return (
    <span className="command-bar-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

export function BuilderOperationStatusView({
  status,
}: {
  status: BuilderOperationStatus;
}) {
  const StatusIcon =
    status.tone === "error"
      ? AlertCircle
      : status.tone === "warning"
        ? AlertTriangle
        : status.tone === "info"
          ? Info
          : CircleCheck;

  return (
    <span
      className={`command-save-state is-${status.tone}`}
      role={status.tone === "error" ? "alert" : "status"}
    >
      <StatusIcon aria-hidden="true" />
      <span title={status.message}>{status.message}</span>
    </span>
  );
}

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
  saveState: BuilderOperationStatus;
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
  const archiveAction = builderArchiveActionCopy(archiveArmed);
  const archiveTitle = builderArchiveTitleCopy(archiveArmed);

  return (
    <header
      aria-label={bilingualCommandBarTitle(builderCommandBarCopy.barLabel)}
      className="builder-command-bar"
    >
      <Link
        aria-label={bilingualCommandBarTitle(
          builderCommandBarCopy.dashboardLink,
        )}
        className="builder-command-bar__brand"
        to="/dashboard"
      >
        <BrandMark compact />
      </Link>

      <div className="command-workspace">
        <span>
          <small>
            <CommandBarCopy copy={builderCommandBarCopy.workspace} />
          </small>
          <strong title={currentWorkspace.name}>{currentWorkspace.name}</strong>
        </span>
      </div>

      <div className="command-build">
        <label>
          <small>
            <CommandBarCopy copy={builderCommandBarCopy.currentBuild} />
          </small>
          <select
            aria-label={bilingualCommandBarTitle(
              builderCommandBarCopy.switchBuild,
            )}
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
          aria-label={bilingualCommandBarTitle(builderCommandBarCopy.buildName)}
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
              aria-label={bilingualCommandBarTitle(
                builderCommandBarCopy.createBuild,
              )}
              onClick={onCreateBuild}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              className={`icon-button command-archive-build${
                archiveArmed ? " is-armed" : ""
              }`}
              type="button"
              aria-label={bilingualCommandBarTitle(archiveAction)}
              title={bilingualCommandBarTitle(archiveTitle)}
              onClick={onArchiveBuild}
            >
              <Archive aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <BuilderOperationStatusView status={saveState} />

      <button
        className="button command-inspector-button"
        type="button"
        aria-label={bilingualCommandBarTitle(builderCommandBarCopy.inspector)}
        onClick={onOpenInspector}
      >
        <PanelRightOpen aria-hidden="true" />
        <CommandBarCopy copy={builderCommandBarCopy.inspector} />
      </button>

      <span
        className="account-button"
        aria-label={builderAccountLabel(user.displayName)}
        title={user.displayName}
      >
        {accountInitials(user.displayName, user.email)}
      </span>
    </header>
  );
}
