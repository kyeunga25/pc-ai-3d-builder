# 試行身份驗證與工作空間設定

正式部署使用 Cloudflare Access 保護工作台及 API。公開主頁只提供產品介紹及登入導向；Worker 仍會驗證 Access JWT，並以 D1 的邀請及 active membership 建立 request-scoped workspace context。

## 安全邊界

- Access 應分別保護 `/dashboard`、`/dashboard/*`、`/catalogue`、`/catalogue/*`、`/asset-review`、`/asset-review/*`、`/builder`、`/builder/*`、`/api` 及 `/api/*`。Wildcard deep route 不會自動涵蓋 parent；不要把公開 `/` 納入同一個保護範圍。
- `/api/health` 保持公開；其他 API 先驗證身份及限流。
- 主頁按鈕以 top-level navigation 前往 `/dashboard`，讓 Access 在載入工作台前完成登入流程。
- Worker 不信任未驗證的身份 header。
- 用戶要求的 workspace 必須由 D1 membership 重新核對。
- 首次登入只可把一個 Access subject 綁定至一個邀請。
- JWT、cookie、電郵、實際資源名稱及平台識別資料不得進入 log 或 Git。

Cloudflare Access 支援以 self-hosted application path 保護指定路徑。正式套用前，逐一確認以上工作台及 API 的 parent／deep route 均受邀請政策保護，`/` 與所需靜態資源只包含公開內容。Allow policy 只使用 owner 的精確 `Emails` selector；不得使用 `Everyone`、整個 email domain、廣泛 Bypass 或僅以 One-time PIN login method 作授權條件。

`/api/health` 是唯一公開 API 例外。若 `/api` 與 `/api/*` 的 Access application 會涵蓋它，只可建立一個更精確、文件化的 `/api/health` public exception；不得擴大至其他 API path。Worker 的 health handler只回傳固定 service/status/request ID，不讀取 D1、身份或部署資料。

Tracked `wrangler.jsonc` 亦把相同 workspace parent／deep route 加入 `assets.run_worker_first`。即使 edge application path 設錯，Worker 仍須在 Static Assets SPA shell 前驗證 Access JWT 及 active D1 membership。

## Access 值

把真實值存入 Wrangler secrets，不要寫入 tracked env 或 config：

```bash
npx wrangler secret put TEAM_DOMAIN --config <ignored-config>
npx wrangler secret put POLICY_AUD --config <ignored-config>
```

版本庫內的 `.env.example` 只有空值或文件用 placeholder。Workers Builds 使用 `npm run deploy:ci`，從平台提供的 Worker 名稱 override 及 Cloudflare build secrets 產生 `.wrangler/deploy.jsonc`；該檔案不會被 Git 追蹤。其他 CI 環境須以私密 build value 提供 `RIGSTAGE_WORKER_NAME`。

## 自動部署

Cloudflare Workers Builds 連接 GitHub `main` 分支：

- Build command：`npm run build`
- Deploy command：`npm run deploy:ci`
- Root directory：`/`
- Production branch：`main`

儲存 binding 的 ID 及名稱只存入 Cloudflare build secrets。`npm run deploy:ci` 會先套用尚未執行的 D1 migrations，成功後才部署 Worker。更新部署設定後，先推送一個經檢查的 commit，再於 Cloudflare Builds 及 GitHub check run 核對結果。

## D1 migration

自動部署會透過忽略追蹤的正式設定套用 migration。需要在受控環境獨立檢查時，可使用同一 binding：

```bash
npx wrangler d1 migrations apply DB --remote --config <ignored-config>
```

邀請、workspace 及 membership 應透過受控的私人 onboarding 程序建立。不要把真實 ID、資源名稱、電郵或 SQL seed 提交到 Git。

Repository 提供的通用工具只接受私密 environment input，不接受 identity command argument，也不輸出身份、SQL 或部署識別資料：

```bash
npm run owner:onboard
```

執行前在私密 terminal session 設定 `OWNER_LOGIN_IDENTITY`。`RIGSTAGE_PRIVATE_DEPLOY_CONFIG` 可指定 repository 內受 Git 忽略、mode `0600` 的 deployment config；預設為 `.wrangler/deploy.jsonc`。該 config 必須明確設定 `workers_dev: false` 及 `preview_urls: false`。可選的 `OWNER_BETA_CREDIT_UNITS` 只接受 `0..1000`；只有已存在 generation credit schema 才可使用非零值，且工具不會重設既有 ledger。Production generation kill switch 仍保持 disabled。

工具會啟用一個既有非 archived owner workspace，或建立一個 generic active owner workspace。它不從 Git author、OS username、公開 profile 或其他專案推測 identity。

## 本地測試

- `npm run dev` 使用合成 session，只供介面測試。
- Worker 測試覆蓋 JWT、未獲邀、workspace tampering、身份綁定競態及限流。
- Migration 應先套用到空白臨時資料庫，再執行 `PRAGMA foreign_key_check`。
- 不要在 production code 加入本地 bypass header。

## 驗收

- 無有效 Access assertion 的 protected API 會被拒絕。
- 無邀請、無 active membership 或跨 workspace 要求會被拒絕。
- 相同邀請的衝突 subject 綁定會被拒絕。
- `users.status`、membership 或 workspace 被停用時會被拒絕。
- 超出每 subject 限額時回傳 429 及 `Retry-After`。
- Session 讀取不寫入 D1 audit table。
- 回應及 log 不含 Cloudflare identifier、電郵或原始 exception。
- `/cdn-cgi/access/logout` 清除 Access session；expired AJAX request 回傳 `401`，重新登入使用 top-level navigation。

## 回復

- Source release 使用上一個 reviewed Worker version 回復，不刪除 D1、R2、Workflow 或 Access application。
- Access policy 回復至變更前的精確 identity selector 與 parent／deep route 清單；不要以 Bypass 作臨時修復。
- 要停用 beta owner，只在私人 D1 操作把 user 或 membership 設為 suspended，保留 audit 及資料；不要刪除記錄。
- 回復後重新驗證匿名、owner、未獲邀、disabled 及跨 workspace 五種情境。

參考：

- [Cloudflare Access：驗證 JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Workers：Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare D1：Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
