import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../shared/components/StatusBadge";

type InspectorTab = "details" | "compatibility" | "asset";

export function BuildInspector() {
  const [tab, setTab] = useState<InspectorTab>("details");

  return (
    <div className="build-inspector">
      <div className="build-inspector__header">
        <span className="inspector-product-icon" aria-hidden="true">
          <Box />
        </span>
        <div>
          <span>已選組件</span>
          <h2>ASUS ProArt RTX 4070 SUPER</h2>
          <p>
            <span className="stock-inline">
              <i aria-hidden="true" /> 有現貨 · 5+
            </span>
            <strong>HK$5,499</strong>
          </p>
        </div>
      </div>

      <div className="inspector-tabs" role="tablist" aria-label="檢查器分頁">
        {(
          [
            ["details", "詳情"],
            ["compatibility", "相容性"],
            ["asset", "3D 素材"],
          ] as const
        ).map(([id, label]) => (
          <button
            id={`inspector-${id}-tab`}
            className={tab === id ? "is-active" : ""}
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`inspector-${id}-panel`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div
          className="inspector-panel"
          id="inspector-details-panel"
          role="tabpanel"
          aria-labelledby="inspector-details-tab"
        >
          <section className="inspector-section">
            <h3>已核實規格</h3>
            <dl className="inspector-specs">
              <div>
                <dt>SKU</dt>
                <dd>PROART-RTX4070S-O12G</dd>
              </div>
              <div>
                <dt>尺寸</dt>
                <dd>300 × 120 × 50 mm</dd>
              </div>
              <div>
                <dt>插槽厚度</dt>
                <dd>2.5 個插槽</dd>
              </div>
              <div>
                <dt>介面</dt>
                <dd>PCIe 4.0 ×16</dd>
              </div>
              <div>
                <dt>供電</dt>
                <dd>1 × 16-pin · 220 W</dd>
              </div>
            </dl>
            <StatusBadge tone="success">尺寸已核實</StatusBadge>
          </section>

          <section className="inspector-section">
            <h3>相容性檢查結果</h3>
            <button className="finding-row finding-row--success" type="button">
              <CheckCircle2 aria-hidden="true" />
              <span>
                <strong>可裝入機箱</strong>
                <small>300 毫米 / 392 毫米淨空</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button className="finding-row finding-row--warning" type="button">
              <AlertTriangle aria-hidden="true" />
              <span>
                <strong>供電餘量偏低</strong>
                <small>估算 482 W · 750 W 電源供應器</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </section>

          <section className="inspector-section inspector-appearance">
            <h3>外觀</h3>
            <label>
              <span>燈光</span>
              <select defaultValue="靜態青色">
                <option>靜態青色</option>
                <option>關閉</option>
                <option>柔和紫色</option>
              </select>
            </label>
            <label>
              <span>安裝方向</span>
              <select defaultValue="橫向">
                <option>橫向</option>
                <option disabled>直向 · 不支援</option>
              </select>
            </label>
          </section>

          <section className="inspector-section asset-quality">
            <div>
              <CircleGauge aria-hidden="true" />
              <span>
                <strong>網頁版已核准</strong>
                <small>外觀已經人工審核</small>
              </span>
            </div>
            <StatusBadge tone="success">已核准</StatusBadge>
          </section>
        </div>
      ) : tab === "compatibility" ? (
        <div
          className="inspector-panel inspector-panel--focused"
          id="inspector-compatibility-panel"
          role="tabpanel"
          aria-labelledby="inspector-compatibility-tab"
        >
          <CircleGauge aria-hidden="true" />
          <h3>相容性證據</h3>
          <p>結構化商戶規格得出一項可解釋警告，沒有嚴重錯誤。</p>
          <dl className="inspector-specs">
            <div>
              <dt>顯示卡長度</dt>
              <dd>300 ≤ 392 mm</dd>
            </div>
            <div>
              <dt>擴充槽數</dt>
              <dd>2.5 ≤ 7</dd>
            </div>
            <div>
              <dt>建議電源功率</dt>
              <dd>750 W · 警告</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div
          className="inspector-panel inspector-panel--focused"
          id="inspector-asset-panel"
          role="tabpanel"
          aria-labelledby="inspector-asset-tab"
        >
          <SlidersHorizontal aria-hidden="true" />
          <h3>已核准素材版本</h3>
          <p>AR-018 版本使用已核實尺寸及標準橫向變換。</p>
          <dl className="inspector-specs">
            <div>
              <dt>品質</dt>
              <dd>網頁版已核准</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>AR-018</dd>
            </div>
            <div>
              <dt>幾何模型</dt>
              <dd>靜態示意</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
