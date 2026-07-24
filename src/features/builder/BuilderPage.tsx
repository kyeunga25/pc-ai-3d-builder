import { X } from "lucide-react";
import { useState } from "react";

import type { ComponentCategory } from "../../shared/domain/schemas";
import { BuildInspector } from "./BuildInspector";
import { BuilderCommandBar } from "./BuilderCommandBar";
import { BuilderViewport } from "./BuilderViewport";
import { BuildStatusBar } from "./BuildStatusBar";
import { ComponentRail } from "./ComponentRail";
import "./builder.css";

type StepId = ComponentCategory | "summary";

export function BuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState<StepId>("gpu");
  const [camera, setCamera] = useState("等角");
  const [displayMode, setDisplayMode] = useState("著色");
  const [saveState, setSaveState] = useState("已儲存");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const selectCategory = (step: StepId) => {
    setSelectedCategory(step);
    setSaveState("有未儲存變更");
  };

  return (
    <div className="builder-page">
      <BuilderCommandBar
        saveState={saveState}
        onOpenInspector={() => setInspectorOpen(true)}
      />

      <main className="builder-main">
        <ComponentRail selected={selectedCategory} onSelect={selectCategory} />
        <BuilderViewport
          selectedCategory={selectedCategory}
          camera={camera}
          setCamera={setCamera}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
        />
        <aside className="desktop-inspector" aria-label="組裝檢查器">
          <BuildInspector />
        </aside>
      </main>

      <BuildStatusBar
        onSave={() => setSaveState("剛剛已儲存")}
        onExport={() => setSaveState("匯出已準備 · 模擬狀態")}
      />

      {inspectorOpen ? (
        <div className="inspector-drawer-layer">
          <button
            className="inspector-drawer-backdrop"
            type="button"
            aria-label="關閉檢查器"
            onClick={() => setInspectorOpen(false)}
          />
          <aside className="inspector-drawer" aria-label="組裝檢查器">
            <div className="inspector-drawer__top">
              <strong>組裝檢查器</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉檢查器"
                onClick={() => setInspectorOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <BuildInspector />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
