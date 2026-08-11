export type LandingBilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export function landingText(
  zhHant: string,
  english: string,
): LandingBilingualCopy {
  return { english, zhHant };
}

export function bilingualLandingTitle(copy: LandingBilingualCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const landingEntryCopy = {
  brandHome: landingText("RigStage 主頁", "RigStage home"),
  builderImageAlt: landingText(
    "RigStage 電腦組裝工作台，顯示九類組件、3D 預覽、相容性證據及安全匯出",
    "RigStage PC builder showing nine component categories, 3D preview, compatibility evidence and safe export",
  ),
  builderLabel: landingText(
    "電腦組裝與相容性",
    "PC building and compatibility",
  ),
  builderNote: landingText(
    "視覺素材不構成相容性證據；選擇九類組件、逐條查看結構化證據，通過閘門後才可安全匯出。",
    "Visual material is not compatibility evidence. Select components across nine categories, inspect each structured evidence item, and export only after all gates pass.",
  ),
  demoAction: landingText("立即試用合成 Demo", "Try the synthetic demo"),
  enlargeInterface: landingText("放大查看介面", "Enlarge interface"),
  footerInviteOnly: landingText(
    "RigStage · 只限獲邀工作空間",
    "RigStage · Invite-only workspace",
  ),
  footerSynthetic: landingText(
    "工作區畫面使用合成示範資料",
    "Workspace screens use synthetic demo data",
  ),
  headerLogin: landingText("登入工作台", "Sign in to workspace"),
  heroSummary: landingText(
    "RigStage 為獲邀的電腦商戶及中小企團隊，把產品目錄、私人 3D 素材審核、九類組件選擇、可解釋相容性與安全匯出放在同一個工作空間。",
    "RigStage gives invited PC merchants and SME teams one workspace for product catalogue management, private 3D asset review, nine-category component selection, explainable compatibility and safe export.",
  ),
  heroTagline: landingText(
    "私人、以審核為先的電腦目錄、素材與組裝決策工作空間。",
    "A private, review-led workspace for PC catalogue, assets and assembly decisions.",
  ),
  heroTitle: landingText(
    "從零件資料到可交付組裝，讓每一步都有證據。",
    "From component data to a deliverable build, keep evidence at every step.",
  ),
  inviteAction: landingText("登入獲邀工作空間", "Sign in to invited workspace"),
  navLabel: landingText("主頁導覽", "Homepage navigation"),
  navSecurity: landingText("資料邊界", "Data boundaries"),
  navUseCases: landingText("使用情境", "Use cases"),
  navWorkflow: landingText("實際流程", "Workflow"),
  proofLabel: landingText("產品重點", "Product highlights"),
  screenshotSyntheticSuffix: landingText(
    "合成示範工作區",
    "Synthetic demo workspace",
  ),
  signinAction: landingText(
    "登入 RigStage 工作台",
    "Sign in to RigStage workspace",
  ),
  signinDescription: landingText(
    "沒有公開註冊。Beta Access 用戶可使用獲授權身份登入；商業使用或獨立部署安排，請先聯絡工作空間管理員。",
    "There is no public registration. Invited Beta Access users can sign in with an authorized identity; contact the workspace administrator about commercial use or an independent deployment.",
  ),
  signinTitle: landingText(
    "已獲邀？從你的工作空間繼續。",
    "Invited already? Continue from your workspace.",
  ),
  trustDescription: landingText(
    "首頁不讀取 session 或商戶資料。進入工作台後，API 仍會驗證 Access 身份、邀請及 active membership，再以伺服器解析的工作空間範圍處理每個受保護記錄。",
    "The homepage reads no session or merchant data. After entering the workspace, APIs still verify the Access identity, invitation and active membership, then scope every protected record to the server-resolved workspace.",
  ),
  trustTitle: landingText(
    "公開介紹產品，私人工作仍然留在工作空間內。",
    "Keep public product information separate from private workspace work.",
  ),
} as const satisfies Record<string, LandingBilingualCopy>;

export function landingScreenshotCaptionCopy(
  labelZhHant: string,
  labelEnglish: string,
): LandingBilingualCopy {
  return landingText(
    `${labelZhHant} · ${landingEntryCopy.screenshotSyntheticSuffix.zhHant}`,
    `${labelEnglish} · ${landingEntryCopy.screenshotSyntheticSuffix.english}`,
  );
}
