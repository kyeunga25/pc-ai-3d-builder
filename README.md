# RigStage

RigStage 是以香港繁體中文為主的電腦商戶 3D 組裝工作台。v1.0 提供受保護的產品目錄、私人素材審核、持久化 PC Builder、可解釋相容性規則、已核准模型預覽及安全 JSON 匯出。

最新公開版本：`v1.0.0`。

## 現有功能

- 香港繁體中文介面及港幣格式。
- 讀取真實 D1 聚合資料的 Dashboard，以及產品目錄、素材審核及 PC Builder 路由。
- Cloudflare Access JWT 驗證、邀請制用戶及 server-side workspace scope。
- 公開 health endpoint，以及受保護的 session／workspace endpoint。
- 受 workspace 限制的分頁產品目錄 API，以及 production 介面的載入、空白與錯誤狀態。
- Staff、admin 及 owner 可新增、編輯和封存產品；更新以版本條件避免覆寫較新資料。
- CSV 範本下載及每批最多 50 項的原子匯入，匯入前會驗證格式、SKU 和結構化規格。
- 素材審核佇列、草稿保存、角色限制、樂觀鎖及原子 audit 記錄。
- 從產品目錄建立私人素材草稿，並上載最多 10 MiB 的 JPEG／PNG／WebP 來源圖片。
- 上載最多 25 MiB 的自包含 glTF 2.0 GLB，經授權 API 讀取後在審核室及 Builder 以 Three.js 人手預覽。
- R2 物件維持私人；API 不回傳永久物件 URL、object key 或 checksum。
- 每個 workspace 可建立及保存組裝草稿，每個草稿最多九個類別；更新使用樂觀版本及原子 D1 batch，封存採用兩步確認及邏輯狀態轉換。
- 六條相容性規則只讀取已核實的插槽、記憶體類型、尺寸淨空及電源建議；缺少資料會明確標記為未知。
- 安全 JSON 匯出不包含使用者、workspace 識別資料、價格、庫存、私人素材或 Cloudflare 部署資料。
- Cloudflare Workers Static Assets、D1、私人 R2 binding、Workflow binding及按 Access subject 限流。
- 所有生成素材均視為草稿；只有經人手核准的資料才可進入後續流程。
- 相容性只依賴結構化規格，不會從視覺模型推斷。

本地開發介面的產品、價格、庫存、素材及 3D 場景均為合成示範資料，不應用作真實報價或工程判斷。Production 介面可在角色及 workspace 限制下讀寫 D1 目錄、審核及組裝資料，以私人 R2 儲存經驗證的來源圖片及 GLB，並在已核准素材存在時於 Builder 讀取所選組件模型；版本庫不含任何真實商戶記錄。v1.0 是可用的邀請制人工審批 MVP，真實 3D 供應商生成及多模型裝配場景不在此版本承諾內。

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

本地 UI 使用合成 session、目錄、素材審核及組裝記錄，方便測試版面、人手核准、相容性及匯出流程。Worker 的 Access 驗證沒有本地繞過；要測試真實登入及 D1 路徑，請使用受保護的非正式環境。

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

身份及 D1 設定見 [試行存取設定](docs/PILOT_ACCESS_SETUP.md)。相容性證據見 [規則文件](docs/COMPATIBILITY_RULES.md)，公開安全政策見 [SECURITY.md](SECURITY.md)。

## 安全邊界

- 除 health endpoint 外，API 必須先驗證 Access JWT。
- Workspace 選擇必須由 D1 membership 重新核對。
- 首次身份綁定採用條件更新，失敗後重新讀取持久化 subject。
- 讀取 session 不會寫入 audit table。
- Dashboard 只執行有界、workspace-scoped 讀取，不會建立記錄或寫入 audit table。
- 目錄及素材查詢必須同時限制 workspace；審核更新使用版本條件避免覆寫其他人變更。
- 組裝讀寫必須同時限制 workspace；讀取空清單不會建立資料，更新使用版本及一次性 mutation token。
- 匯出在有嚴重錯誤或未知相容性結果時會停止，並排除身份、營運及私人素材欄位。
- Viewer 只可讀取；staff 只可保存草稿；owner 或 admin 才可核准或拒絕素材。
- 限流鍵使用已驗證 Access subject，不記錄 JWT 或電郵。
- 原始圖片、模型及渲染輸出必須維持私人存取。
- Builder 只讀取已核准素材的私人 GLB，並在選擇切換或頁面卸載時撤銷瀏覽器 object URL。
