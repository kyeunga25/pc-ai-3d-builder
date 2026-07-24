# RigStage

RigStage 是以香港繁體中文為主的電腦商戶 3D 組裝工作台。現有版本提供可測試的商戶介面、產品目錄與素材審核示範、PC Builder 場景，以及受 Cloudflare Access 與 D1 workspace membership 保護的 session API。

## 現有功能

- 香港繁體中文介面及港幣格式。
- Dashboard、產品目錄、素材審核及 PC Builder 路由。
- Cloudflare Access JWT 驗證、邀請制用戶及 server-side workspace scope。
- 公開 health endpoint，以及受保護的 session／workspace endpoint。
- Cloudflare Workers Static Assets、D1、私人 R2 binding、Workflow binding及按 Access subject 限流。
- 所有生成素材均視為草稿；只有經人手核准的資料才可進入後續流程。
- 相容性只依賴結構化規格，不會從視覺模型推斷。

介面內的產品、價格、庫存及 3D 場景目前均為合成示範資料，不應用作真實報價或工程判斷。私人上載、真實 3D 供應商呼叫及完整匯出流程尚未啟用。

## 技術

- React 19、React Router 8、Vite 8、TypeScript 6
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

本地 UI 使用合成 session，方便測試版面。Worker 的 Access 驗證沒有本地繞過；要測試真實登入，請使用受保護的非正式環境。

## 部署設定

版本庫內的 `wrangler.jsonc` 只是一份不含實際 Cloudflare 識別資料的範本。部署時應使用 Git 忽略的本地設定，並把 Access 值存入 Wrangler secrets。不要提交 account ID、database ID、實際資源名稱、token、私有物件 URL 或商戶身份資料。

身份及 D1 設定見 [試行存取設定](docs/PILOT_ACCESS_SETUP.md)。公開安全政策見 [SECURITY.md](SECURITY.md)。

## 安全邊界

- 除 health endpoint 外，API 必須先驗證 Access JWT。
- Workspace 選擇必須由 D1 membership 重新核對。
- 首次身份綁定採用條件更新，失敗後重新讀取持久化 subject。
- 讀取 session 不會寫入 audit table。
- 限流鍵使用已驗證 Access subject，不記錄 JWT 或電郵。
- 原始圖片、模型及渲染輸出必須維持私人存取。
