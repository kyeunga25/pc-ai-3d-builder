# 技術、模型與資料來源

本文件列出 RigStage source tree 實際使用的主要技術、標準與官方參考。內容以 `package.json`、lockfile、`wrangler.jsonc` 及可讀 source 為依據；它不記錄 production coordinates、私人部署拓撲、Access policy 值、database contents、用戶、商戶或私人資產。

> English summary: this is a source-backed technology and reference inventory. RigStage currently uses no runtime AI model or external generation provider; its generation adapter is deterministic and synthetic.

## Cloudflare 平台

| 技術 | 在 RigStage 的用途 | 官方參考 |
| --- | --- | --- |
| Cloudflare Workers | 執行 API Worker，並與前端 build 一同部署 | [Workers documentation](https://developers.cloudflare.com/workers/) |
| Workers Static Assets | 從同一個 Worker deployment 發佈 Vite `dist` | [Static Assets](https://developers.cloudflare.com/workers/static-assets/) |
| Wrangler 4 | 產生 binding types、本地 Worker runtime、dry-run、migration 及部署 | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) |
| Cloudflare Access | 保護 invite-only workspace，Worker 另行驗證 Access JWT | [Add web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/) |
| D1 | 儲存 workspace-scoped relational metadata；repository 只帶 schema migrations，不帶 production rows | [D1](https://developers.cloudflare.com/d1/) |
| R2 | 儲存 private source image 及 GLB；不使用 public bucket URL | [R2](https://developers.cloudflare.com/r2/) |
| Workflows | 執行 bounded、idempotent generation validation steps | [Workflows](https://developers.cloudflare.com/workflows/) |
| Rate Limiting binding | 在 protected database work 前按已驗證 subject 的版本化 SHA-256 opaque key 限流 | [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) |
| Workers Builds | 可選的 Git-based build、migration 及 Worker deployment | [Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) |

Tracked `wrangler.jsonc` 是 identifier-free template。實際 Worker、D1、R2、Workflow、rate namespace、hostname、Access audience 及 account details 不屬於公開技術清單。

## Web、3D 與 runtime packages

精確版本以 lockfile 為準；以下是目前 `package.json` 的直接依賴：

| 技術 | Tracked version | 用途 | 官方參考 |
| --- | ---: | --- | --- |
| React／React DOM | 19.2.8 | 瀏覽器介面與 component rendering | [React](https://react.dev/) |
| React Router | 8.3.0 | public landing 與 protected workspace route composition | [React Router](https://reactrouter.com/) |
| Vite | 8.1.5 | local development 及 production frontend build | [Vite](https://vite.dev/) |
| TypeScript | 6.0.3 | browser、Worker、test 的 typed source | [TypeScript](https://www.typescriptlang.org/docs/) |
| Three.js | 0.185.1 | 經授權 GLB 的 browser preview | [Three.js](https://threejs.org/docs/) |
| Zod | 4.4.3 | bounded domain／API input and output validation | [Zod](https://zod.dev/) |
| jose | 6.2.4 | Cloudflare Access JWT verification | [jose](https://github.com/panva/jose) |
| Lucide React | 1.27.0 | UI icons | [Lucide](https://lucide.dev/) |

## 3D 格式與參考標準

- RigStage 只接受 self-contained glTF 2.0 binary container（GLB），格式依據 Khronos [glTF Registry](https://registry.khronos.org/glTF/) 及 [glTF 2.0 specification](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0)。
- Browser preview 使用 Three.js `GLTFLoader`；模型是視覺審核素材，不是相容性、尺寸或工程規格的權威來源。
- Repository 不捆綁外部 sample model、商業 3D asset、production GLB 或從客戶素材建立的衍生檔案。測試 GLB 由 deterministic source code 即時建立。

## AI 模型與 provider 聲明

| 項目 | 現況 |
| --- | --- |
| Runtime AI model | **沒有** |
| Cloudflare Workers AI binding | **沒有設定** |
| OpenAI 或其他 LLM API | **沒有呼叫** |
| 外部 image-to-3D provider | **沒有設定或啟用** |
| Model name／version／checkpoint | 不適用 |
| Training／fine-tuning dataset | 不適用；repository 沒有訓練資料 |
| 現有 generation adapter | Deterministic synthetic TypeScript adapter，只產生測試 GLB fixture |

`SyntheticGenerationProvider` 用來驗證 idempotency、private storage、GLB policy、retry 及 human-review handoff。它不分析 source image pixels、不執行 inference、不證明 3D generation quality，也不代表某個外部模型可供 production 使用。

將來若加入真實 provider，必須另行審閱並更新本文件，至少清楚列出：provider 及 model/version、資料傳送範圍、使用權、retention/deletion、地域、費用上限、callback 驗證、輸出 license、人工審批、kill switch 及退出方案。Provider key、private endpoint、商業條款及 routing identifier 仍不得進入公開 repository。

## 資料與內容來源聲明

- Local UI、tests、screenshots 及 runtime simulation 只可使用明確標示的 synthetic fixtures。
- Repository 不包含 production catalogue、真實價格／庫存、merchant/customer/user identity、workspace data、private image、render、GLB、prompt、provider response、log 或 database dump。
- Compatibility result 只來自人手核實的 structured specification 及 deterministic rules；不從 mesh、圖片、品牌名稱或 AI 推斷。
- Public landing 的 workspace 圖像只可來自 synthetic local UI，不得擷取真實 session 或 production data。
- 目前四張 public workspace 圖像均由本版本的 `/demo/*` 介面重新擷取；可見廠商名稱統一為 `RigStage Fixture`，不使用第三方品牌、商標、真實 SKU、實際報價或內部 record ID。
- 第三方官方文件只作 implementation reference，不會把第三方網站內容、sample dataset 或 media 複製到本 repository。

## 測試、格式及品質工具

| 技術 | 用途 | 官方參考 |
| --- | --- | --- |
| Vitest 4 | unit tests | [Vitest](https://vitest.dev/) |
| Cloudflare Vitest pool | 在 workerd／Miniflare 下測試 D1、R2 及 Workflow bindings | [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) |
| ESLint | static lint | [ESLint](https://eslint.org/) |
| Prettier | deterministic formatting | [Prettier](https://prettier.io/) |
| npm audit | dependency advisory gate | [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/) |

## 更新規則

以下變更發生時應同步更新本文件及 README 最後一節：

1. direct dependency major version 或 Cloudflare product/binding 改變；
2. 首次加入、替換或移除 AI／3D provider 或 model；
3. 引入 external dataset、sample asset、benchmark 或第三方 content；
4. deployment target 從 Workers 改變；
5. source rights、retention、privacy 或 human-review boundary 改變。

更新時先核對官方文件及 installed Wrangler schema。只記錄 public implementation facts；不要加入真實 deployment value、private architecture note、內部討論或尚未批准的 roadmap。
