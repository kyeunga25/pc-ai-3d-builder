import {
  Axis3D,
  Box,
  Camera,
  Check,
  CircleDot,
  Cuboid,
  Image,
  RefreshCw,
  Rotate3D,
  Save,
  Scan,
  X,
} from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../shared/components/StatusBadge";
import "./asset-review.css";

const checklist = [
  "型號及 SKU 正確",
  "顏色及版本正確",
  "已設定標準方向",
  "已輸入核實尺寸",
  "樞軸適合作安裝",
  "已確認圖片使用權",
];

const cameraPresets = ["正面", "左側", "頂部", "等角"];
const sourceViews = ["正面", "背面", "左側", "三分之四角度"];

export function AssetReviewPage() {
  const [camera, setCamera] = useState("等角");
  const [checks, setChecks] = useState(() => new Set(checklist.slice(0, 4)));
  const [reviewStatus, setReviewStatus] = useState("草稿變更只儲存在本機");

  const toggleCheck = (item: string) => {
    setChecks((current) => {
      const next = new Set(current);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
    setReviewStatus("核准清單有未儲存變更");
  };

  const approvalReady = checks.size === checklist.length;

  return (
    <div className="asset-review-page">
      <header className="asset-review-header">
        <div>
          <span className="eyebrow">素材版本 · AR-024</span>
          <h1>DeepCool AK620 Digital</h1>
          <p>供應商草稿必須先經審核，才可加入商戶組裝方案。</p>
        </div>
        <div className="asset-review-header__meta">
          <StatusBadge tone="warning">需要審核</StatusBadge>
          <span aria-live="polite">{reviewStatus}</span>
        </div>
      </header>

      <div className="review-workspace">
        <aside className="source-filmstrip" aria-label="來源圖片">
          <div className="review-panel-heading">
            <Image aria-hidden="true" />
            <div>
              <strong>來源圖片</strong>
              <span>4 個已核實角度</span>
            </div>
          </div>
          {sourceViews.map((view, index) => (
            <button
              className={`source-frame${index === 0 ? " is-selected" : ""}`}
              key={view}
              type="button"
              aria-label={`查看${view}來源圖片`}
            >
              <span
                className={`source-frame__object source-frame__object--${index + 1}`}
              >
                <Box aria-hidden="true" />
              </span>
              <small>{view}</small>
            </button>
          ))}
          <div className="source-rights">
            <Check aria-hidden="true" />
            已確認商業使用權
          </div>
        </aside>

        <section className="review-viewport" aria-label="3D 素材審核視窗">
          <div className="review-viewport__toolbar">
            <div role="group" aria-label="鏡頭預設角度">
              {cameraPresets.map((preset) => (
                <button
                  className={camera === preset ? "is-active" : ""}
                  key={preset}
                  type="button"
                  aria-pressed={camera === preset}
                  onClick={() => setCamera(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div>
              <button type="button" aria-label="切換座標軸顯示">
                <Axis3D aria-hidden="true" />
              </button>
              <button type="button" aria-label="切換邊界框顯示">
                <Scan aria-hidden="true" />
              </button>
              <button type="button" aria-label="切換線框顯示">
                <Cuboid aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="review-stage">
            <div className="review-grid" aria-hidden="true" />
            <div className="cooler-model" aria-hidden="true">
              <span className="cooler-model__tower cooler-model__tower--left" />
              <span className="cooler-model__fan">
                <CircleDot />
              </span>
              <span className="cooler-model__tower cooler-model__tower--right" />
              <span className="cooler-model__base" />
            </div>
            <div className="review-axis" aria-hidden="true">
              <span className="axis-x">X</span>
              <span className="axis-y">Y</span>
              <span className="axis-z">Z</span>
            </div>
            <div className="viewport-readout">
              <Rotate3D aria-hidden="true" />
              <span>
                鏡頭 <strong>{camera}</strong>
              </span>
              <span className="mono">280 × 129 × 138 mm</span>
            </div>
          </div>
          <div className="review-viewport__footer">
            <span>靜態幾何模型示意 · 目前不會載入私人 GLB</span>
            <span className="mono">18,420 三角形 · 3 種材質</span>
          </div>
        </section>

        <aside className="review-inspector">
          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Camera aria-hidden="true" />
              <div>
                <strong>生成資料</strong>
                <span>第 01 次嘗試 · 模擬供應商</span>
              </div>
            </div>
            <dl className="technical-list">
              <div>
                <dt>供應商</dt>
                <dd>Tripo 示意</dd>
              </div>
              <div>
                <dt>品質</dt>
                <dd>未核准草稿</dd>
              </div>
              <div>
                <dt>工作 ID</dt>
                <dd className="mono">task_demo_83F2</dd>
              </div>
            </dl>
          </div>

          <div className="review-inspector__section">
            <div className="review-panel-heading">
              <Scan aria-hidden="true" />
              <div>
                <strong>核實尺寸</strong>
                <span>原廠資料來源</span>
              </div>
            </div>
            <div className="dimension-grid">
              {[
                ["闊度", "129"],
                ["高度", "162"],
                ["深度", "138"],
              ].map(([label, value]) => (
                <label key={label}>
                  <span>{label}</span>
                  <span>
                    <input defaultValue={value} inputMode="decimal" />
                    mm
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="review-inspector__section review-checklist">
            <div className="review-panel-heading">
              <Check aria-hidden="true" />
              <div>
                <strong>核准清單</strong>
                <span>
                  已完成 {checks.size} / {checklist.length} 項
                </span>
              </div>
            </div>
            {checklist.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={checks.has(item)}
                  onChange={() => toggleCheck(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>

      <footer className="review-actions">
        <div>
          <button className="button button--danger" type="button">
            <X aria-hidden="true" />
            拒絕
          </button>
          <button className="button" type="button">
            <RefreshCw aria-hidden="true" />
            重新嘗試供應商
          </button>
        </div>
        <div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setReviewStatus("草稿已於 10:24 儲存")}
          >
            <Save aria-hidden="true" />
            儲存草稿
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!approvalReady}
            onClick={() => setReviewStatus("已準備核准 · 模擬狀態")}
          >
            <Check aria-hidden="true" />
            核准素材
          </button>
        </div>
      </footer>
    </div>
  );
}
