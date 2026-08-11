export type BuilderCommandBarCopy = {
  readonly english: string;
  readonly zhHant: string;
};

function commandBarCopy(
  zhHant: string,
  english: string,
): BuilderCommandBarCopy {
  return { english, zhHant };
}

export function bilingualCommandBarTitle(copy: BuilderCommandBarCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderCommandBarCopy = {
  archiveBuild: commandBarCopy("封存目前組裝", "Archive the current build"),
  barLabel: commandBarCopy("組裝命令列", "Builder command bar"),
  buildName: commandBarCopy("組裝名稱", "Build name"),
  confirmArchiveBuild: commandBarCopy(
    "確認封存目前組裝",
    "Confirm archiving the current build",
  ),
  createBuild: commandBarCopy("建立新組裝", "Create new build"),
  currentBuild: commandBarCopy("目前組裝", "Current build"),
  dashboardLink: commandBarCopy(
    "返回商戶 Dashboard",
    "Return to merchant dashboard",
  ),
  inspector: commandBarCopy("檢查器", "Inspector"),
  pressAgainToArchive: commandBarCopy(
    "再次按下以確認封存",
    "Press again to confirm archive",
  ),
  switchBuild: commandBarCopy("切換組裝", "Switch build"),
  workspace: commandBarCopy("工作空間", "Workspace"),
} as const satisfies Record<string, BuilderCommandBarCopy>;

export function builderArchiveActionCopy(
  archiveArmed: boolean,
): BuilderCommandBarCopy {
  return archiveArmed
    ? builderCommandBarCopy.confirmArchiveBuild
    : builderCommandBarCopy.archiveBuild;
}

export function builderArchiveTitleCopy(
  archiveArmed: boolean,
): BuilderCommandBarCopy {
  return archiveArmed
    ? builderCommandBarCopy.pressAgainToArchive
    : builderCommandBarCopy.archiveBuild;
}

export function builderAccountLabel(displayName: string): string {
  return `${displayName} 帳戶 / ${displayName} account`;
}
