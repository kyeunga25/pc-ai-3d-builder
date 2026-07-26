import {
  Box,
  Camera,
  ChevronDown,
  Expand,
  Image,
  Move3D,
  Rotate3D,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { componentSteps } from "../../shared/domain/mockData";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { formatHkd } from "../../shared/i18n/locale";

type StepId = ComponentCategory | "summary";

const cameraPresets = ["等角", "正面", "左側", "頂部"];

export function BuilderViewport({
  selectedCategory,
  camera,
  setCamera,
  displayMode,
  setDisplayMode,
  selectedPart,
}: {
  selectedCategory: StepId;
  camera: string;
  setCamera: Dispatch<SetStateAction<string>>;
  displayMode: string;
  setDisplayMode: Dispatch<SetStateAction<string>>;
  selectedPart: CatalogPart | null;
}) {
  return (
    <section className="builder-viewport" aria-label="3D 視窗示意">
      <div className="builder-viewport__top">
        <div
          className="viewport-control-group"
          role="group"
          aria-label="鏡頭預設角度"
        >
          <span className="viewport-control-group__label">
            <Camera aria-hidden="true" />
            鏡頭
          </span>
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

        <label className="viewport-display-control">
          <span>顯示</span>
          <select
            value={displayMode}
            onChange={(event) => setDisplayMode(event.target.value)}
          >
            <option>著色</option>
            <option>線框</option>
            <option>靜態預覽</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>

        <button
          className="viewport-icon-button"
          type="button"
          aria-label="調整至合適視野"
        >
          <Expand aria-hidden="true" />
        </button>
      </div>

      <div className="builder-stage">
        <div className="builder-stage__grid" aria-hidden="true" />
        <div className="builder-stage__glow" aria-hidden="true" />

        <figure className="pc-case-placeholder">
          <div className="pc-case-placeholder__glass">
            <div className="pc-motherboard" />
            <div className="pc-cooler">
              <span />
            </div>
            <div className="pc-memory">
              <i />
              <i />
            </div>
            <div className="pc-gpu">
              <span>GPU</span>
              <i />
              <i />
              <i />
            </div>
            <div className="pc-psu">PSU</div>
            <div className="pc-fans">
              <i />
              <i />
              <i />
            </div>
          </div>
          <figcaption>靜態電腦幾何模型示意；目前不會載入私人 GLB。</figcaption>
        </figure>

        <div className="builder-axis" aria-hidden="true">
          <span>X</span>
          <span>Y</span>
          <span>Z</span>
        </div>

        <div className="builder-stage__readout">
          <Move3D aria-hidden="true" />
          <span>
            鏡頭 <strong>{camera}</strong>
          </span>
          <span>
            模式 <strong>{displayMode}</strong>
          </span>
          <span className="mono">網格 10 毫米</span>
        </div>

        <div className="tablet-selected-part">
          <div className="tablet-selected-part__icon">
            <Box aria-hidden="true" />
          </div>
          <div>
            <span>目前類別組件</span>
            <strong>
              {selectedPart
                ? `${selectedPart.manufacturer} ${selectedPart.model}`
                : "尚未選擇"}
            </strong>
          </div>
          <strong>
            {selectedPart ? formatHkd(selectedPart.priceMinor) : "—"}
          </strong>
          {selectedPart ? (
            <>
              <span className="stock-inline">
                <i aria-hidden="true" />
                {selectedPart.stockStatus === "out_of_stock"
                  ? "缺貨"
                  : "可選目錄記錄"}
              </span>
              <span className="mono">{selectedPart.sku}</span>
            </>
          ) : null}
        </div>

        <span className="selected-category-readout">
          <Rotate3D aria-hidden="true" />
          正在編輯{" "}
          <strong>
            {componentSteps.find((step) => step.id === selectedCategory)
              ?.label ?? "總覽"}
          </strong>
        </span>
      </div>

      <div className="builder-viewport__footer">
        <span>
          <Image aria-hidden="true" />
          提供靜態後備預覽
        </span>
        <span className="mono">場景 v1 · +Y 向上 · 單位：米</span>
      </div>
    </section>
  );
}
