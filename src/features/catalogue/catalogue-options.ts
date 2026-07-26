import type {
  ComponentCategory,
  StockStatus,
} from "../../shared/domain/schemas";

export const categoryLabels: Record<ComponentCategory, string> = {
  case: "機箱",
  motherboard: "主機板",
  cpu: "處理器（CPU）",
  gpu: "顯示卡（GPU）",
  memory: "記憶體",
  cooling: "散熱器",
  storage: "儲存裝置",
  psu: "電源供應器（PSU）",
  fans: "風扇",
};

export const stockStatusLabels: Record<StockStatus, string> = {
  in_stock: "有現貨",
  low_stock: "少量現貨",
  out_of_stock: "暫時缺貨",
  unknown: "未確認",
};
