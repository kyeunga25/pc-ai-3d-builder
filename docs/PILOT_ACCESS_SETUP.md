# 試行身份驗證與工作空間設定

正式部署使用 Cloudflare Access 作外層登入閘門。Worker 仍會驗證 Access JWT，並以 D1 的邀請及 active membership 建立 request-scoped workspace context。

## 安全邊界

- Access 應保護整個 hostname，而不只是 API 路徑。
- `/api/health` 保持公開；其他 API 先驗證身份及限流。
- Worker 不信任未驗證的身份 header。
- 用戶要求的 workspace 必須由 D1 membership 重新核對。
- 首次登入只可把一個 Access subject 綁定至一個邀請。
- JWT、cookie、電郵、實際資源名稱及平台識別資料不得進入 log 或 Git。

## Access 值

把真實值存入 Wrangler secrets，不要寫入 tracked env 或 config：

```bash
npx wrangler secret put TEAM_DOMAIN --config <ignored-config>
npx wrangler secret put POLICY_AUD --config <ignored-config>
```

版本庫內的 `.env.example` 只有空值或文件用 placeholder。Workers Builds 使用 `npm run deploy:ci`，從 Cloudflare build secrets 產生 `.wrangler/deploy.jsonc`；該檔案不會被 Git 追蹤。

## 自動部署

Cloudflare Workers Builds 連接 GitHub `main` 分支：

- Build command：`npm run build`
- Deploy command：`npm run deploy:ci`
- Root directory：`/`
- Production branch：`main`

儲存 binding 的 ID 及名稱只存入 Cloudflare build secrets。更新部署設定後，先推送一個經檢查的 commit，再於 Cloudflare Builds 及 GitHub check run 核對結果。

## D1 migration

部署設定內的 D1 binding 完成後，使用該 binding 套用 migration：

```bash
npx wrangler d1 migrations apply DB --remote --config <ignored-config>
```

邀請、workspace 及 membership 應透過受控的私人 onboarding 程序建立。不要把真實 ID、資源名稱、電郵或 SQL seed 提交到 Git。

## 本地測試

- `npm run dev` 使用合成 session，只供介面測試。
- Worker 測試覆蓋 JWT、未獲邀、workspace tampering、身份綁定競態及限流。
- Migration 應先套用到空白臨時資料庫，再執行 `PRAGMA foreign_key_check`。
- 不要在 production code 加入本地 bypass header。

## 驗收

- 無有效 Access assertion 的 protected API 會被拒絕。
- 無邀請、無 active membership 或跨 workspace 要求會被拒絕。
- 相同邀請的衝突 subject 綁定會被拒絕。
- 超出每 subject 限額時回傳 429 及 `Retry-After`。
- Session 讀取不寫入 D1 audit table。
- 回應及 log 不含 Cloudflare identifier、電郵或原始 exception。

參考：

- [Cloudflare Access：驗證 JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Workers：Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare D1：Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
