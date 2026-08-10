import { Archive, Cuboid, Save, Upload, X } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  cataloguePartInputSchema,
  componentCategorySchema,
  stockStatusSchema,
  type CataloguePartInput,
  type CatalogPart,
} from "../../shared/domain/schemas";
import { categoryLabels, stockStatusLabels } from "./catalogue-options";

type CatalogueEditorDialogProps = {
  part: CatalogPart | null;
  onArchive?: () => Promise<void>;
  onClose: () => void;
  onCreateAssetFromSource?: (file: File) => Promise<void>;
  onOpenAssetReview?: () => void;
  onSave: (input: CataloguePartInput) => Promise<void>;
  readOnly?: boolean;
};

type EditorDraft = {
  category: string;
  manufacturer: string;
  model: string;
  priceHkd: string;
  sku: string;
  specificationStatus: "unverified" | "verified";
  specificationsJson: string;
  stockCount: string;
  stockStatus: string;
};

function editorDraft(part: CatalogPart | null): EditorDraft {
  if (!part) {
    return {
      category: "case",
      manufacturer: "",
      model: "",
      priceHkd: "",
      sku: "",
      specificationStatus: "unverified",
      specificationsJson: "{}",
      stockCount: "",
      stockStatus: "unknown",
    };
  }

  return {
    category: part.category,
    manufacturer: part.manufacturer,
    model: part.model,
    priceHkd: (part.priceMinor / 100).toFixed(2),
    sku: part.sku,
    specificationStatus: part.specificationStatus,
    specificationsJson: JSON.stringify(part.specifications, null, 2),
    stockCount: part.stockCount === null ? "" : String(part.stockCount),
    stockStatus: part.stockStatus,
  };
}

function parseDraft(draft: EditorDraft): CataloguePartInput | null {
  if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(draft.priceHkd.trim())) {
    return null;
  }
  if (
    draft.stockCount.trim().length > 0 &&
    !/^\d{1,6}$/u.test(draft.stockCount.trim())
  ) {
    return null;
  }

  let specifications: unknown;
  try {
    specifications = JSON.parse(draft.specificationsJson) as unknown;
  } catch {
    return null;
  }

  const parsed = cataloguePartInputSchema.safeParse({
    sku: draft.sku,
    category: draft.category,
    manufacturer: draft.manufacturer,
    model: draft.model,
    priceMinor: Math.round(Number(draft.priceHkd) * 100),
    stockStatus: draft.stockStatus,
    stockCount:
      draft.stockCount.trim().length === 0 ? null : Number(draft.stockCount),
    specifications,
    specificationStatus: draft.specificationStatus,
  });

  return parsed.success ? parsed.data : null;
}

export function CatalogueEditorDialog({
  part,
  onArchive,
  onClose,
  onCreateAssetFromSource,
  onOpenAssetReview,
  onSave,
  readOnly = false,
}: CatalogueEditorDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => editorDraft(part));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (skuInputRef.current?.disabled
      ? firstFocusable
      : skuInputRef.current
    )?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const update = <Key extends keyof EditorDraft>(
    key: Key,
    value: EditorDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setConfirmArchive(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      return;
    }
    const input = parseDraft(draft);
    if (!input) {
      setError(
        "請檢查必填欄位、港幣售價、庫存數量及規格 JSON。 / Check the required fields, HKD price, stock quantity and specification JSON.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(input);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "無法儲存產品，請重新載入後再試。 / Unable to save the product. Reload and retry.",
      );
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!onArchive) {
      return;
    }
    if (!confirmArchive) {
      setConfirmArchive(true);
      setError("再次按下「確認封存」即可從目前目錄隱藏此產品。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onArchive();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "無法封存產品，請重新載入後再試。 / Unable to archive the product. Reload and retry.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createAssetFromSource = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file || !onCreateAssetFromSource) {
      inputElement.value = "";
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCreateAssetFromSource(file);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "無法建立私人素材草稿。 / Unable to create the private asset draft.",
      );
    } finally {
      inputElement.value = "";
      setSaving(false);
    }
  };

  return (
    <div className="catalogue-dialog-layer">
      <button
        className="catalogue-dialog-backdrop"
        type="button"
        aria-label="關閉產品編輯器"
        disabled={saving}
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="catalogue-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <header className="catalogue-dialog__header">
          <div>
            <span className="eyebrow">
              {part ? `版本 ${part.version}` : "工作空間目錄"}
            </span>
            <h2 id={titleId}>
              {readOnly ? "查看產品" : part ? "編輯產品" : "新增產品"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="關閉產品編輯器"
            disabled={saving}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form className="catalogue-editor-form" onSubmit={handleSubmit}>
          <input
            ref={sourceInputRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving || readOnly}
            onChange={(event) => void createAssetFromSource(event)}
          />
          <fieldset
            className="catalogue-editor-fields"
            disabled={saving || readOnly}
          >
            <div className="catalogue-editor-grid">
              <label>
                <span>SKU</span>
                <input
                  ref={skuInputRef}
                  required
                  maxLength={64}
                  value={draft.sku}
                  onChange={(event) => update("sku", event.target.value)}
                />
              </label>
              <label>
                <span>分類</span>
                <select
                  value={draft.category}
                  onChange={(event) => update("category", event.target.value)}
                >
                  {componentCategorySchema.options.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>品牌／製造商</span>
                <input
                  required
                  maxLength={100}
                  value={draft.manufacturer}
                  onChange={(event) =>
                    update("manufacturer", event.target.value)
                  }
                />
              </label>
              <label>
                <span>型號</span>
                <input
                  required
                  maxLength={120}
                  value={draft.model}
                  onChange={(event) => update("model", event.target.value)}
                />
              </label>
              <label>
                <span>售價（HKD）</span>
                <input
                  required
                  inputMode="decimal"
                  placeholder="849.00"
                  value={draft.priceHkd}
                  onChange={(event) => update("priceHkd", event.target.value)}
                />
              </label>
              <label>
                <span>庫存狀態</span>
                <select
                  value={draft.stockStatus}
                  onChange={(event) => {
                    const stockStatus = event.target.value;
                    update("stockStatus", stockStatus);
                    if (stockStatus === "out_of_stock") {
                      update("stockCount", "0");
                    }
                  }}
                >
                  {stockStatusSchema.options.map((value) => (
                    <option key={value} value={value}>
                      {stockStatusLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>庫存數量</span>
                <input
                  inputMode="numeric"
                  placeholder={
                    draft.stockStatus === "unknown" ? "可以留空" : "1"
                  }
                  value={draft.stockCount}
                  onChange={(event) => update("stockCount", event.target.value)}
                />
              </label>
              <label>
                <span>規格核實狀態</span>
                <select
                  value={draft.specificationStatus}
                  onChange={(event) =>
                    update(
                      "specificationStatus",
                      event.target.value as "unverified" | "verified",
                    )
                  }
                >
                  <option value="unverified">尚未核實</option>
                  <option value="verified">已人手核實</option>
                </select>
              </label>
            </div>

            <label className="catalogue-editor-specifications">
              <span>結構化規格（JSON）</span>
              <textarea
                rows={7}
                spellCheck={false}
                value={draft.specificationsJson}
                onChange={(event) =>
                  update("specificationsJson", event.target.value)
                }
              />
              <small>
                只記錄已知資料；尚未核實的欄位不要猜測。相容性不會從 3D
                外觀推斷。
              </small>
            </label>
          </fieldset>

          <p
            id={messageId}
            className="catalogue-editor-message"
            role={error ? "alert" : "status"}
          >
            {error ??
              (readOnly
                ? "目前角色是唯讀；資料不會被修改。"
                : "儲存後只會更新目前已驗證的工作空間，並留下精簡操作紀錄。")}
          </p>

          <footer className="catalogue-dialog__actions">
            <div>
              {!readOnly && part && onArchive ? (
                <button
                  className="button button--danger"
                  type="button"
                  disabled={saving}
                  onClick={() => void archive()}
                >
                  <Archive aria-hidden="true" />
                  {confirmArchive ? "確認封存" : "封存產品"}
                </button>
              ) : null}
              {!readOnly && part && onCreateAssetFromSource ? (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => sourceInputRef.current?.click()}
                >
                  <Upload aria-hidden="true" />
                  建立素材草稿
                </button>
              ) : null}
              {part && onOpenAssetReview ? (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={saving}
                  onClick={onOpenAssetReview}
                >
                  <Cuboid aria-hidden="true" />
                  前往素材審核
                </button>
              ) : null}
            </div>
            <div>
              <button
                className="button button--secondary"
                type="button"
                disabled={saving}
                onClick={onClose}
              >
                取消
              </button>
              {!readOnly ? (
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={saving}
                >
                  <Save aria-hidden="true" />
                  {saving ? "正在儲存…" : "儲存產品"}
                </button>
              ) : null}
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
