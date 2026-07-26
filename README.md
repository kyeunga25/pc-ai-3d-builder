# RigStage

RigStage 是以香港繁體中文為主的電腦商戶 3D 組裝工作台。現有版本提供可測試的商戶介面、產品目錄與素材審核示範、PC Builder 場景，以及受 Cloudflare Access 與 D1 workspace membership 保護的 session API。

最新公開版本：`v0.4.0`。

## 現有功能

- 香港繁體中文介面及港幣格式。
- Dashboard、產品目錄、素材審核及 PC Builder 路由。
- Cloudflare Access JWT 驗證、邀請制用戶及 server-side workspace scope。
- 公開 health endpoint，以及受保護的 session／workspace endpoint。
- 受 workspace 限制的分頁產品目錄 API，以及 production 介面的載入、空白與錯誤狀態。
- Staff、admin 及 owner 可新增、編輯和封存產品；更新以版本條件避免覆寫較新資料。
- CSV 範本下載及每批最多 50 項的原子匯入，匯入前會驗證格式、SKU 和結構化規格。
- 素材審核佇列、草稿保存、角色限制、樂觀鎖及原子 audit 記錄。
- 從產品目錄建立私人素材草稿，並上載最多 10 MiB 的 JPEG／PNG／WebP 來源圖片。
- 上載最多 25 MiB 的自包含 glTF 2.0 GLB，經授權 API 讀取後在瀏覽器以 Three.js 人手預覽。
- R2 物件維持私人；API 不回傳永久物件 URL、object key 或 checksum。
- Cloudflare Workers Static Assets、D1、私人 R2 binding、Workflow binding及按 Access subject 限流。
- 所有生成素材均視為草稿；只有經人手核准的資料才可進入後續流程。
- 相容性只依賴結構化規格，不會從視覺模型推斷。

本地開發介面的產品、價格、庫存、素材及 3D 場景均為合成示範資料，不應用作真實報價或工程判斷。Production 介面可在角色及 workspace 限制下讀寫 D1 目錄和審核資料，並以私人 R2 儲存經驗證的來源圖片及 GLB；版本庫不含任何真實商戶記錄。真實 3D 供應商呼叫及完整匯出流程尚未啟用。

## 技術

- React 19、React Router 8、Vite 8、TypeScript 6、Three.js 0.185
- Cloudflare Workers、Static Assets、Access、D1、R2、Workflows
- Zod、Vitest、ESLint、Prettier

## 本地開發

需要 Node.js 22.22 或以上版本。

```bash
npm install
npm run dev
```

完整檢查：

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

本地 UI 使用合成 session、目錄及素材審核記錄，方便測試版面及人手核准流程。Worker 的 Access 驗證沒有本地繞過；要測試真實登入及 D1 路徑，請使用受保護的非正式環境。

## 部署設定

版本庫內的 `wrangler.jsonc` 只記錄 placeholder Worker label 及不含識別資料的 binding 範本。`main` 分支由 Cloudflare Workers Builds 執行 `npm run build` 及 `npm run deploy:ci`；部署指令會以平台提供的 CI override 與 Cloudflare build secrets 產生 Git 忽略的臨時設定，先套用尚未執行的 D1 migrations，再上傳 Worker。Account ID、D1 ID、實際資源名稱、token、私有物件 URL 及商戶身份資料不會進入 Git。

Cloudflare build 環境需要以下 secret 名稱，值只儲存在 Cloudflare：

- `RIGSTAGE_D1_DATABASE_ID`
- `RIGSTAGE_D1_DATABASE_NAME`
- `RIGSTAGE_R2_BUCKET_NAME`
- `RIGSTAGE_WORKFLOW_NAME`
- `RIGSTAGE_RATE_NAMESPACE_ID`

Cloudflare Workers Builds 會自動提供 Worker 名稱 override；其他 CI 環境須以私密 build value 提供 `RIGSTAGE_WORKER_NAME`，不可把實際名稱寫入版本庫。

Access 的 `TEAM_DOMAIN` 與 `POLICY_AUD` 是獨立的 runtime secrets，不屬於 build secrets。

身份及 D1 設定見 [試行存取設定](docs/PILOT_ACCESS_SETUP.md)。公開安全政策見 [SECURITY.md](SECURITY.md)。

## 安全邊界

- 除 health endpoint 外，API 必須先驗證 Access JWT。
- Workspace 選擇必須由 D1 membership 重新核對。
- 首次身份綁定採用條件更新，失敗後重新讀取持久化 subject。
- 讀取 session 不會寫入 audit table。
- 目錄及素材查詢必須同時限制 workspace；審核更新使用版本條件避免覆寫其他人變更。
- Viewer 只可讀取；staff 只可保存草稿；owner 或 admin 才可核准或拒絕素材。
- 限流鍵使用已驗證 Access subject，不記錄 JWT 或電郵。
- 原始圖片、模型及渲染輸出必須維持私人存取。
