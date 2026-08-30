import type { CataloguePageCopy } from "./catalogue-page-copy";

function editorCopy(zhHant: string, english: string): CataloguePageCopy {
  return { english, zhHant };
}

export const catalogueEditorCopy = {
  addProduct: editorCopy("新增產品", "Add product"),
  assetDraftFileRequirements: editorCopy(
    "選擇 JPEG、PNG 或 WebP；上載前會核對檔名、MIME 及內容",
    "Choose JPEG, PNG or WebP; filename, MIME and content are checked before upload",
  ),
  archiveProduct: editorCopy("封存產品", "Archive product"),
  archiving: editorCopy("正在封存…", "Archiving…"),
  cancel: editorCopy("取消", "Cancel"),
  category: editorCopy("分類", "Category"),
  closeEditor: editorCopy("關閉產品編輯器", "Close product editor"),
  confirmArchive: editorCopy("確認封存", "Confirm archive"),
  createAssetDraft: editorCopy("建立素材草稿", "Create asset draft"),
  creatingAssetDraft: editorCopy("正在建立…", "Creating…"),
  editProduct: editorCopy("編輯產品", "Edit product"),
  humanVerifiedSpecification: editorCopy("已人手核實", "Human verified"),
  manufacturer: editorCopy("品牌／製造商", "Brand / manufacturer"),
  model: editorCopy("型號", "Model"),
  priceHkd: editorCopy("售價（HKD）", "Price (HKD)"),
  reviewAsset: editorCopy("前往素材審核", "Review asset"),
  saveProduct: editorCopy("儲存產品", "Save product"),
  saving: editorCopy("正在儲存…", "Saving…"),
  sku: editorCopy("SKU", "SKU"),
  specificationGuidance: editorCopy(
    "只記錄已知資料；尚未核實的欄位不要猜測。相容性不會從 3D 外觀推斷。",
    "Record only known data; do not guess unverified fields. Compatibility is never inferred from 3D appearance.",
  ),
  specificationVerification: editorCopy(
    "規格核實狀態",
    "Specification verification",
  ),
  stockCount: editorCopy("庫存數量", "Stock quantity"),
  stockStatus: editorCopy("庫存狀態", "Stock status"),
  structuredSpecifications: editorCopy(
    "結構化規格（JSON）",
    "Structured specifications (JSON)",
  ),
  unknownCountPlaceholder: editorCopy("可以留空", "Leave blank"),
  unverifiedSpecification: editorCopy("尚未核實", "Unverified"),
  viewProduct: editorCopy("查看產品", "View product"),
  workspaceCatalogue: editorCopy("工作空間目錄", "Workspace catalogue"),
} as const satisfies Record<string, CataloguePageCopy>;

export function catalogueEditorTitleCopy(
  hasPart: boolean,
  readOnly: boolean,
): CataloguePageCopy {
  if (readOnly) {
    return catalogueEditorCopy.viewProduct;
  }
  return hasPart
    ? catalogueEditorCopy.editProduct
    : catalogueEditorCopy.addProduct;
}

export function catalogueEditorVersionCopy(version: number): CataloguePageCopy {
  return editorCopy(`版本 ${version}`, `Version ${version}`);
}
