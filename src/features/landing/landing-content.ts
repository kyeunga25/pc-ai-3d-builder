import { landingText } from "./landing-entry-copy";

export const workspaceEntryPath = "/login?next=%2Fdashboard";
export const demoEntryPath = "/demo/dashboard";

export const landingCopy = {
  workflowTitle: "一個實際工作天，可以這樣走。",
  workflowSummary:
    "以下畫面均來自 RigStage 現有工作區，以合成示範資料呈現；不包含真實商戶記錄、私人素材或部署資料。",
} as const;

export const heroProofPoints = [
  landingText(
    "香港繁體中文工作流",
    "Traditional Chinese workflow for Hong Kong",
  ),
  landingText(
    "每筆資料按 Workspace 隔離",
    "Every record is isolated by workspace",
  ),
  landingText(
    "素材經人手核准後才可使用",
    "Assets require human approval before use",
  ),
] as const;

export const workflowCases = [
  {
    number: "01",
    label: "每日工作入口",
    title: "先掌握哪些資料已準備好，哪些項目需要處理。",
    description:
      "當團隊同時維護零件、審核素材及準備多個組裝草稿，儀表板會集中顯示目前工作空間的目錄準備度、待審項目與最近工作。",
    points: [
      "查看已核實目錄、待審素材及可安全匯出的組裝草稿。",
      "由最近工作直接進入需要處理的產品、素材或組裝。",
      "指標只由目前 Workspace 的有界資料計算，不混用其他商戶記錄。",
    ],
    image: "/landing/workspace-dashboard.jpg",
    imageAlt: "RigStage 商戶儀表板，顯示目錄、素材審核、匯出及組裝草稿狀態",
  },
  {
    number: "02",
    label: "新貨與目錄維護",
    title: "新零件到店時，先建立可核實、可追蹤的產品記錄。",
    description:
      "採購或產品團隊可在同一張目錄中整理 SKU、庫存、港幣售價、結構化規格與 3D 素材狀態，再交由後續組裝流程使用。",
    points: [
      "支援新增、編輯、邏輯封存及經完整驗證的 CSV 批次匯入。",
      "規格核實狀態、庫存與素材品質在同一工作畫面可見。",
      "更新使用版本條件，避免較舊操作覆寫已修改的產品資料。",
    ],
    image: "/landing/workspace-catalogue.jpg",
    imageAlt: "RigStage 產品目錄，顯示零件、庫存、規格及 3D 素材核准狀態",
  },
  {
    number: "03",
    label: "私人素材審核",
    title: "圖片與 3D 模型入庫前，先完成來源、尺寸與品質核准。",
    description:
      "素材人員可在受保護的審核室查看來源圖片與 GLB 預覽，記錄商業使用權、核實尺寸及固定清單；只有授權角色可以核准。",
    points: [
      "來源圖片與自包含 GLB 維持私人，只經授權 API 讀取。",
      "替換檔案會重設既有核准證據，避免沿用過期檢查結果。",
      "視覺模型只作人手預覽，不會被用來猜測硬件相容性。",
    ],
    image: "/landing/workspace-asset-review.jpg",
    imageAlt: "RigStage 3D 素材審核室，顯示來源、模型預覽、尺寸及核准清單",
  },
] as const;

export const useCases = [
  {
    title: "新產品上架",
    situation: "供應商送來新一批零件資料與產品圖片。",
    response:
      "先整理目錄與核實規格，再建立私人素材草稿；資料未完整前不會被包裝成已可交付內容。",
  },
  {
    title: "客製化配機",
    situation: "銷售或技術人員要為客戶準備一套九類組件方案。",
    response:
      "從工作空間目錄選件，逐條查看插槽、記憶體、尺寸與電源建議；未知或嚴重錯誤會阻止匯出。",
  },
  {
    title: "素材交付與覆核",
    situation: "團隊需要確認模型身份、尺寸、方向與使用權。",
    response:
      "在同一審核記錄保存清單、尺寸與版本；模型維持草稿，直至 owner 或 admin 明確核准。",
  },
] as const;

export const trustPoints = [
  {
    title: landingText("邀請制工作空間", "Invite-only workspaces"),
    description: landingText(
      "沒有公開註冊。登入後仍需有效邀請及 active membership，才可讀取對應 Workspace。",
      "There is no public registration. After sign-in, an active invitation and membership are still required before the matching workspace can be read.",
    ),
  },
  {
    title: landingText(
      "相容性有結構化證據",
      "Compatibility uses structured evidence",
    ),
    description: landingText(
      "相容性只讀取已核實規格；缺少資料會顯示 unknown，不以 3D 外觀作推斷。",
      "Compatibility reads only human-verified structured specifications; missing data remains unknown and is never inferred from 3D appearance.",
    ),
  },
  {
    title: landingText("私人素材不公開", "Private assets stay private"),
    description: landingText(
      "原始圖片、GLB、物件位置及 checksum 不會成為公開網址或出現在可攜匯出。",
      "Original images, GLB files, object locations and checksums never become public URLs or appear in portable exports.",
    ),
  },
  {
    title: landingText("匯出前先通過閘門", "Export only after passing gates"),
    description: landingText(
      "只有沒有 error 或 unknown 的組裝才可輸出安全 JSON，並排除身份、價格及私人素材欄位。",
      "A build can export safe JSON only when no error or unknown remains; identity, price and private asset fields are excluded.",
    ),
  },
] as const;
