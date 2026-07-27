export const workspaceEntryPath = "/dashboard";

export const landingCopy = {
  heroTitle: "把零件資料、3D 素材與組裝決策，放在同一個工作台。",
  heroSummary:
    "RigStage 為獲邀電腦商戶整合產品目錄、私人素材審核、可解釋相容性與安全匯出。",
  heroEnglish: "Private PC catalogue, asset review and assembly workspace.",
} as const;

export const workflowSteps = [
  {
    number: "01",
    title: "產品目錄",
    description: "核准零件資料、庫存與版本受控。",
  },
  {
    number: "02",
    title: "素材審核",
    description: "上載私人素材，人手審核與標註。",
  },
  {
    number: "03",
    title: "組裝與相容性",
    description: "以核實規格檢查並解釋結果。",
  },
  {
    number: "04",
    title: "安全匯出",
    description: "通過必要檢查後輸出安全 JSON。",
  },
] as const;

export const trustPoints = [
  {
    title: "Workspace 隔離",
    description:
      "每個受保護記錄都按已驗證的 active membership 在 server-side 限定。",
  },
  {
    title: "人手審核",
    description: "素材先保存為草稿，完成固定檢查後才可由授權角色核准。",
  },
  {
    title: "核實規格",
    description: "相容性只讀取已核實的結構化規格，絕不從視覺模型推斷。",
  },
  {
    title: "私人素材",
    description: "原始圖片與模型不公開；工作台只顯示已授權的 GLB 預覽。",
  },
] as const;
