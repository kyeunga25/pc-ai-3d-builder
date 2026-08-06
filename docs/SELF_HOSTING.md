# Cloudflare Workers 自部署指南

本文件說明如何把一份獲授權的 RigStage source copy 部署到你自己的 Cloudflare 帳戶。它只列出部署所需的公開介面及 placeholders，不提供或複製任何既有 production hostname、account ID、resource ID、resource name、Access policy、用戶、workspace、資料列、私人物件或營運拓撲。

> English summary: deploy the Vite frontend and API as one Cloudflare Worker with Static Assets, D1, private R2, Workflows, Rate Limiting and Cloudflare Access. Keep every deployment coordinate and runtime secret outside Git. No external AI model is enabled by this guide.

## 0. 授權、成本與公開邊界

- 本版本庫目前沒有授權檔。以下內容是技術操作說明，不是複製、修改、再發佈或商用授權；部署前先取得權利人的明確許可。
- Cloudflare Workers、D1、R2、Workflows、Access 及相關流量或儲存可能受方案、地區、限額及收費影響。建立資源前查閱 Cloudflare 的最新官方文件及帳戶頁面，本文件不承諾免費額度。
- 自部署只會建立空白 application infrastructure。版本庫沒有 production seed、真實邀請、workspace membership、catalogue、私人圖片或 GLB；這些資料不得從其他環境複製到公開版本庫。
- 這是可閱讀原始碼的專案。文檔可以省略 production 實作細節，但不能阻止 source reader 檢視程式及 migrations；若邏輯架構也屬機密，請使用 private repository。
- 預設 `GENERATION_MODE=disabled`、`GENERATION_MAX_COST_MINOR=0`。本指南不會啟用 AI、付款或外部 provider。

## 1. 先決條件

準備：

- Node.js 22.22 或以上版本及 npm；
- Git；
- 可互動登入的 Wrangler 4.x；
- 你自己的 Cloudflare 帳戶；
- 可供 Worker 使用並能設定 Cloudflare Access 的 private hostname；
- 帳戶內可使用 Workers、D1、R2、Workflows、Workers Rate Limiting 及 Zero Trust Access。

不要使用共享的 production 帳戶作第一次測試。先在獨立的非正式環境驗證，而且不要加入真實資料。

## 2. 取得 source 並先做本地驗證

以你有權存取的 fork 或 source URL 取代 placeholder：

```bash
git clone <your-authorized-source-url>
cd pc-ai-3d-builder
npm ci
```

先確認 source copy 沒有不明改動，再完成全部品質閘：

```bash
git status -sb
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

`npm run cf:dry-run` 使用 tracked、identifier-free `wrangler.jsonc` 檢查 bundle 及 binding 形狀，不會部署。

## 3. 登入自己的 Cloudflare 帳戶

使用 Wrangler 的互動 OAuth 流程，不要把 API token 寫入 command、shell history、`.env` 或 repository：

```bash
npx wrangler login
npx wrangler whoami
```

如果使用 CI，將最小權限 credential 存在 CI／Cloudflare secret store；不要在本機產生 tracked credential file，也不要把 `whoami` 或 dashboard 截圖貼到公開 issue。

## 4. 建立獨立資源

### 4.1 D1

建立一個全新的空白 database。名稱只在你的私人環境決定：

```bash
npx wrangler d1 create <your-private-d1-name>
```

如果 Wrangler 詢問是否更新 tracked config，選擇 **No**；本專案稍後會產生 private config。把 Wrangler 回傳的 database name 及 ID 存入 password manager 或 ignored deployment file，不要修改 tracked `wrangler.jsonc`。不要把 command output 貼到 GitHub。

### 4.2 R2

建立一個全新的 private bucket：

```bash
npx wrangler r2 bucket create <your-private-r2-name>
```

如果 Wrangler 詢問是否更新 tracked config，選擇 **No**。不要啟用 public bucket URL；RigStage 只應透過經 Access 及 workspace 授權的 Worker route 讀取物件。

### 4.3 Workflow 與 Rate Limiting

- 為 `AssetGenerationWorkflow` 選一個只在私人部署設定出現的 Workflow name。Wrangler 會按 generated config 的 Workflow binding 註冊它，不需要在 repository 寫入真實名稱。
- 為 Rate Limiting binding 選一個在你的 Cloudflare account 內唯一的正整數 namespace。相同 namespace 會共享 counter；不要重用其他 application 的值。
- 不要新增 Workers AI binding。現有 runtime 沒有模型 ID，也不需要 provider key。

## 5. 建立 Git 忽略的私人設定

`.gitignore` 已排除 `.env.*`、`.dev.vars*` 及 `.wrangler/`。在 repository root 建立 `.env.deploy.local`，只在自己的裝置填入真實值：

```dotenv
RIGSTAGE_WORKER_NAME=<your-private-worker-name>
RIGSTAGE_D1_DATABASE_ID=<your-private-d1-id>
RIGSTAGE_D1_DATABASE_NAME=<your-private-d1-name>
RIGSTAGE_R2_BUCKET_NAME=<your-private-r2-name>
RIGSTAGE_WORKFLOW_NAME=<your-private-workflow-name>
RIGSTAGE_RATE_NAMESPACE_ID=<your-account-unique-positive-integer>
```

另建 `.env.runtime.local`，存放 Worker 必需的 Access runtime secrets：

```dotenv
TEAM_DOMAIN=https://<your-team-subdomain>.cloudflareaccess.com
POLICY_AUD=<your-access-application-audience>
# Multiple private applications only:
# POLICY_AUD=<audience-one>,<audience-two>
```

這些檔案即使被 Git ignore 仍是敏感本機資料：限制讀取權限、不要同步到公開雲端硬碟、不要放入 screenshot，也不要把它們作為 support attachment。

確認三個私人路徑都被忽略；以下命令只應輸出檔案路徑，不應輸出內容：

```bash
git check-ignore .env.deploy.local .env.runtime.local .wrangler/deploy.jsonc
```

## 6. 產生 private Wrangler config

使用 Node 的 env-file 支援把 deployment coordinates 注入既有 generator：

```bash
node --env-file=.env.deploy.local scripts/create-cloudflare-config.mjs
```

這會建立 mode `0600`、Git 忽略的 `.wrangler/deploy.jsonc`。Generator 會替換 Worker、D1、R2、Workflow 及 Rate Limiting coordinates，並固定寫入 `workers_dev: false` 與 `preview_urls: false`；tracked config 仍維持 placeholders。

不要把 generated file 打印到 CI log。只檢查它存在、仍被 ignore，並在本機確認 binding names 保持 `DB`、`PRIVATE_ASSETS`、`ASSET_GENERATION` 及 `PILOT_RATE_LIMITER`，以及以下 non-secret hardening 未被移除：

```json
{
  "workers_dev": false,
  "preview_urls": false
}
```

Generator 會自動寫入以上 top-level fields，不需要手動修改 generated config。之後在 Cloudflare dashboard 把 Worker 連接到自己的 Custom Domain；hostname 及 route 不要加入公開 repository。只在 dashboard 關閉 `workers.dev` 並不足夠，因為缺少 `workers_dev: false` 的下一次 Wrangler deploy 可能重新開啟它。

## 7. 先設定 Cloudflare Access

在加入任何真實資料前，為你的 private hostname 建立 Cloudflare Access self-hosted application 及明確的 Allow policy。按照 [試行身份驗證與工作空間設定](PILOT_ACCESS_SETUP.md) 核對 public landing、protected workspace routes、protected API 及 public health check 的界線。

特別注意：

- 分別測試 exact route 及其 descendant route；不要假設一個 wildcard 自動覆蓋 parent path。
- 不要以寬鬆 Bypass policy 公開 workspace 或 API。
- Edge Access 及 Worker JWT 驗證都要通過；只有其中一層成功並不足夠。
- Access custom hostname 的 policy 不會自動保護另一個 `workers.dev` 或 preview hostname；production 應關閉這些入口。
- `TEAM_DOMAIN` 與 `POLICY_AUD` 只存入 Worker secrets，不得出現在 Git。若 private paths 必須拆成多個 Access applications，`POLICY_AUD` 可使用逗號分隔、最多 16 個不重複 audience；不要加入 public health Bypass application 的 audience。
- onboarding、邀請及 active workspace membership 必須使用獨立的私人操作程序；本公開 repository 故意不提供含真實 identity 或 seed data 的 SQL。

## 8. Dry-run、migration 與第一次部署

再次 build，然後用 generated config 做不會上傳的 dry-run：

```bash
npm run build
npx wrangler deploy --dry-run --config .wrangler/deploy.jsonc --secrets-file .env.runtime.local
```

確認 dry-run 成功後，先列出並審閱待套用 migrations，再套用到你新建的 remote D1：

```bash
npx wrangler d1 migrations list DB --remote --config .wrangler/deploy.jsonc
npx wrangler d1 migrations apply DB --remote --config .wrangler/deploy.jsonc
```

最後把 Worker、Static Assets、bindings 及兩個 Access secrets 一次部署：

```bash
npx wrangler deploy --config .wrangler/deploy.jsonc --secrets-file .env.runtime.local
```

`--secrets-file` 只應指向 ignored local file。不要把 secret value 當作 command argument，也不要用 `echo` 把它 pipe 到 Wrangler。

部署成功不代表 application 已可使用。空白 D1 不會自動建立真實 user、workspace 或 membership；完成私人 onboarding 及下節驗收前，不要加入 production data。

## 9. 自部署驗收

使用不含 credential 的瀏覽器／HTTP 檢查，以及一個獲邀測試身份，至少確認：

- `/` 可顯示 public landing，而且首次載入不要求或讀取 workspace session；
- `/api/health` 只回傳 bounded health response，不洩露 resource 或 dependency identifier；
- 未登入訪問 workspace route 會被 Access 阻擋；
- 未登入呼叫 protected API 會在 edge 或 Worker fail closed；
- 獲邀身份只可存取其 active membership 對應的 workspace；
- R2 沒有 public bucket URL，private object 不能繞過 Worker 取得；
- `workers.dev` 及 preview URL 已關閉，沒有繞過 Access custom hostname 的第二入口；
- deep link 由 Workers Static Assets 正確回到 SPA，但 protected shell 不會因此繞過 Access；
- source maps、real fixture、secret、deployment coordinate 及 raw error 不會出現在 build 或 response；
- generation capability 保持 disabled，沒有 AI/provider/payment network call；
- `npm run check`、`npm run test`、`npm run build`、private-config dry-run 及 `npm audit --audit-level=high` 均通過。

不要把帶有 hostname、Access token、cookie、email、D1/R2 identifier 或真實 response body 的驗收輸出提交到 repository。

## 10. Cloudflare Workers Builds（可選）

手動完成第一個安全部署後，可把自己的 GitHub／GitLab repository 連接至 Workers Builds：

- Build command：`npm run build`
- Deploy command：`npm run deploy:ci`
- Root directory：`/`
- Production branch：你審批後的 production branch

在 Cloudflare **Build variables and secrets** 內以 secret 形式加入：

- `RIGSTAGE_D1_DATABASE_ID`
- `RIGSTAGE_D1_DATABASE_NAME`
- `RIGSTAGE_R2_BUCKET_NAME`
- `RIGSTAGE_WORKFLOW_NAME`
- `RIGSTAGE_RATE_NAMESPACE_ID`

Workers Builds 會提供 `WRANGLER_CI_OVERRIDE_NAME`；其他 CI 才需要另設 private `RIGSTAGE_WORKER_NAME`。`TEAM_DOMAIN` 與 `POLICY_AUD` 是 Worker runtime secrets，應在 **Variables & Secrets** 管理，不是一般 build variables。

`npm run deploy:ci` 會重新產生已固定關閉 `workers.dev` 與 preview URLs 的 private config，並在 Worker upload 前先套用 remote D1 migrations。若 fork 改寫 generator 或 private pre-deploy step，必須保留這兩個 top-level flags；不要依賴一次性的 dashboard toggle。不要讓 preview branch 共用 production build secrets；若需要 preview／staging，建立完全獨立的 Worker、D1、R2、Workflow、rate namespace、hostname、Access application 及 secrets。否則關閉 non-production deployment。

## 11. 回復與 migration 邊界

- 部署前記錄已審閱 commit SHA，並在 Cloudflare 查看對應 Worker version。
- Worker code 可使用 Cloudflare Versions／Rollback 回復，但 Worker rollback 不會自動回復已套用的 D1 schema。
- D1 schema 問題應以經審閱的 forward migration 或你自己的受控 backup/restore 程序處理；不要即場修改 migration history。
- 不要刪除 R2 bucket、D1 database、Worker、Workflow 或 Access application 作一般回復手段。

## 12. 公開前資料外洩檢查

提交前逐項確認 staged diff：

- 沒有 `.env*`、`.dev.vars*`、`.wrangler/`、database、GLB、screenshot、log 或 export；
- 沒有 account ID、resource ID、真實 resource name、hostname、Access audience、token、cookie、email 或 private URL；
- 沒有 production catalogue、價格、庫存、客戶、workspace、圖片、模型、prompt、provider response 或 database dump；
- 沒有私人 roadmap、營運拓撲、供應商商業條款或內部討論；
- 文檔只使用 `<placeholder>` 及 synthetic example；
- staged files 全部與本次變更直接相關。

```bash
git status -sb
git diff --check
git diff --cached --name-only
```

如發現任何真實值，停止 commit／push，從 staged scope 移除該單一檔案並輪替已外洩 credential；不要以新增另一個 commit 當作清除 Git history 的替代品。

## 官方參考

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers routes and Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Disable `workers.dev`](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [R2 Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/)
- [Cloudflare Workflows guide](https://developers.cloudflare.com/workflows/get-started/guide/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
