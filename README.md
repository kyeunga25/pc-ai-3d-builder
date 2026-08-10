# RigStage

RigStage 是以香港繁體中文為主的電腦商戶 3D 組裝工作台。v1.1 提供受保護的產品目錄、私人素材審核、持久化 PC Builder、可解釋相容性規則、已核准模型預覽、安全 JSON 匯出，以及預設關閉的零成本生成工作驗證管線。目前 source 另包含本機 AI 開發里程碑，用 synthetic adapter 驗證 credit、重試、GLB 安全閘及人工審批銜接；它不代表 production 已啟用 AI。

**部署平台：Cloudflare Workers。** Vite 產生的前端由 Workers Static Assets 發佈，`/api/*` 由同一個 Worker 處理；受保護功能再使用 Cloudflare Access、D1、私人 R2、Workflows 及 Rate Limiting bindings。這不是 Cloudflare Pages 專案。

公開版本庫只描述可核對的程式行為、邏輯元件及自部署介面，不包含任何實際 hostname、Cloudflare account／resource identifier、Access policy 值、token、production 資料、私人資產或營運拓撲。由於可取得原始碼的人仍可閱讀程式及 migration，若連邏輯架構本身也屬機密，應使用私人版本庫及獨立的私人營運文檔。

最新公開版本：`v1.1.0`。

## English summary

RigStage is an invite-only PC catalogue, private visual-asset review and 3D assembly workspace built with React and Cloudflare Workers. Version 1.1 adds a fail-closed, zero-cost generation-job validation pipeline. The current source also includes a local-development milestone with non-monetary credit accounting, attempt idempotency, strict GLB safety gates and an end-to-end synthetic review-to-Builder path without enabling a real AI provider.

## 現有功能

- 公開的產品介紹主頁，以及導向受 Cloudflare Access 保護工作台的登入入口；主頁不讀取 session 或任何商戶資料。
- 香港繁體中文介面及港幣格式。
- 讀取真實 D1 聚合資料的 Dashboard，以及產品目錄、素材審核及 PC Builder 路由；Dashboard 頁首、CTA、四個指標、最近工作及資料準備度均以繁中優先、英文輔助顯示。最近工作另由共享 schema 強制提供有界雙語細節、狀態及相對時間，並維持固定安全導向。
- Cloudflare Access JWT 驗證、受限 assertion／身份欄位、邀請制用戶及 server-side workspace scope；畸形或超限身份會在 Rate Limiting 與 D1 前 fail closed。
- 已綁定身份的一般讀取只解析 active workspace membership，不更新使用者列；只有使用者明確切換時，前端才以固定 `PUT` 端點及受保護 workspace 標頭持久化偏好。切換成功前保留目前資料範圍，局部或暫時失敗提供雙語重試／留在目前操作，全域身份失效則仍 fail closed。
- Dashboard、產品目錄、素材審核及 Builder 的 parent／deep route 都以 Worker-first 驗證 Access JWT 與 active D1 membership，Static Assets 不可繞過私人 shell 授權。
- 公開 health endpoint，以及受保護的 session／workspace endpoint。
- 公開 API 錯誤保留穩定代碼及 request ID，並以「繁體中文 / English」回傳可操作但不洩漏內部解析細節的訊息；雙欄介面會拆分顯示兩種語言。
- Worker 以精確路徑及方法表執行 API preflight；受保護的未知路徑或錯誤方法會在 Access 驗證與 subject 限流後、workspace membership D1 查詢前，以通用雙語 `404` 或帶精確 `Allow` 的雙語 `405` 拒絕。
- 受 workspace 限制的分頁產品目錄 API；私人分頁游標只經受保護請求標頭傳送，不寫入瀏覽器 URL，production 介面亦具備載入、空白與錯誤狀態。目錄頁首、操作、搜尋、分類、核實篩選、欄名、九個組件分類、四種庫存狀態、四種素材狀態及四種品質均以完整型別映射顯示繁中／英文；庫存英文數量正確處理單複數，viewer 寫入控制保持停用，列內可見文案不顯示私人 part／asset ID。雙語操作與狀態在 390 px 可換行而不遮蔽主要功能。
- Staff、admin 及 owner 可新增、編輯和封存產品；私人 part ID 只經固定 API 的受保護標頭傳送，更新以版本條件避免覆寫較新資料。新增、編輯、封存、素材草稿及 CSV 匯入均使用繁中／英文的提示、成功、警告或錯誤狀態；單語技術例外會換成安全文案，無法確認的寫入結果會要求重新載入才重試。
- CSV 範本下載及每批最多 50 項的原子匯入，匯入前會驗證格式、SKU 和結構化規格。
- 素材審核佇列、固定詳情／審核 API、草稿保存、角色限制、樂觀鎖及原子 audit 記錄；私人 asset ID 只經受保護標頭傳送，不進詳情或審核 URL／body。頁首指引、草稿／待審／核准／拒絕狀態、來源種類、品質、版本及佇列數量均由完整型別映射以繁中優先、英文輔助顯示，英文項目數亦正確處理單複數；窄畫面狀態徽章可換行而不顯示內部素材 ID。保存、核准、拒絕、檔案上載及模擬生成狀態均以雙語及相符的提示、成功、警告或錯誤語意顯示；六項核准清單、三個人手核實尺寸、核對提示及完成計數亦使用由 domain 規則約束的雙語文案。網絡中斷後不會假定寫入或工作未發生，而會要求先重新載入。拒絕採用同一素材版本內的兩步確認，先說明可能釋放保留 credit、但不會刪除私人檔案，第二次按下才送出審核 mutation；切換素材或進行其他表單操作會解除確認。
- 從產品目錄固定端點建立私人素材草稿，part ID 不進 URL 或檔案 body；可上載最多 10 MiB 的 JPEG／PNG／WebP 來源圖片，上載前會核對 MIME、完整容器邊界、PNG chunk CRC／JPEG marker／WebP RIFF frame 結構，以及每邊最多 32,768 px、總像素最多 100 MP 的安全上限。來源圖片的要求、上載／取代／進行中狀態及 Access 私隱邊界均以繁中優先、英文輔助顯示；審核縮圖列的四個視角、授權 API 載入／缺少狀態、私人預覽替代文字、佔位說明及圖片使用權已確認／未確認狀態亦完整雙語化。
- 透過固定檔案 API 與受保護的 asset／file-kind 標頭，上載最多 25 MiB 的自包含 glTF 2.0 GLB；經授權讀取後在審核室及 Builder 以 Three.js 人手預覽，私人 asset ID 不進檔案 URL 或 body。GLB 要求及操作狀態同樣提供雙語文案；審核 viewport 的四個鏡頭預設、合適視野／線框工具、鏡頭讀數、模型有無／載入／解碼失敗狀態及「視覺素材不構成相容性證明」亦以繁中優先、英文輔助顯示。取代所選檔案會重設核准清單及已核實尺寸，另一個私人檔案不受取代影響並繼續保持私人。
- Builder viewport 的四個鏡頭、三個顯示模式、工具、場景讀數、類別、四種庫存狀態、已選組件摘要及 footer 亦完整雙語化。它明確區分經授權載入的私人 GLB、本機已核准 synthetic GLB、本地不讀取私人檔案的後備及沒有已核准模型的後備；載入失敗只顯示通用私隱安全文案，不顯示 workspace／asset ID 或解析細節。雙語 footer 以內容高度換行，並持續說明視覺素材不構成相容性證據。
- R2 物件維持私人；API 不回傳永久物件 URL、object key 或 checksum。瀏覽器的短期 Blob URL 綁定目前檔案要求的 abort signal，切換 workspace／素材或卸載畫面便冪等撤銷，遲到的已取消回應不會建立新 URL。回滾及取代只清理單一明確 key，首次暫時失敗會重試一次；持續失敗會保留不再由目前素材讀取路徑使用的私人 orphan，而不推翻已提交狀態。
- 素材審核導向固定使用 `/asset-review`；指定素材只以 workspace 綁定的頁面記憶體交接，載入後即清除，不寫入 URL、history state 或持久儲存，畫面亦不顯示內部素材 ID。
- 每個 workspace 可建立及保存組裝草稿，每個草稿最多九個類別；私人 build ID 只經固定 API 的受保護標頭傳送，不寫入 URL 或請求 body；更新使用樂觀版本及原子 D1 batch，封存採用兩步確認及邏輯狀態轉換。建立、切換、儲存、封存及私隱安全匯出的即時狀態均提供繁中／英文及相符的成功、提示、警告或錯誤語意；單語技術錯誤不會直接顯示。Builder 檢查器的三個分頁、空白狀態、已知規格欄位、規格核實狀態、相容性嚴重程度、證據標籤及 3D 素材狀態／品質／使用條件亦完整雙語化；未知自訂欄位會保留原鍵並標示為自訂，不猜測含義或顯示私人素材 ID。
- Builder 頂部命令列以繁中優先、英文輔助顯示 workspace、目前組裝、組裝名稱、返回 Dashboard、建立、兩步封存及檢查器入口。固定文案由完整型別映射供應；viewer 不會取得新增或封存控制，390 px 圖示入口仍保留雙語無障礙名稱，畫面標籤不會把私人 build ID 當作可見文案。窄畫面檢查器使用有雙語標題的 modal dialog，支援初始焦點、Tab 循環、Escape／背景／按鈕關閉、背景捲動鎖定及關閉後焦點還原。
- Builder 組件導覽列以完整型別映射顯示九個類別加總覽、一般步驟與總覽狀態、候選數、已選數、空候選、四種庫存狀態及目前選擇；英文數量正確處理單複數。錯誤、未選、待核實與警告的既有優先序保持不變，低庫存、未知及缺貨同時使用文字與相符顏色。介面說明只會使用目前 workspace 的目錄記錄，選擇必須明確按儲存才寫入 D1，且不顯示私人 part／asset ID。
- Builder 底部狀態列以繁中優先、英文輔助顯示相容性、已選組件、workspace 總價及儲存／匯出操作。嚴重錯誤、未知結果、警告及通過依既有 fail-closed 優先序使用文字、圖示與語意顏色；英文計數正確處理單複數。狀態列可換行，390 px 圖示操作仍保留完整雙語無障礙名稱，匯出提示亦明確說明阻擋條件及不包含的私人／營運資料。
- 六條相容性規則只讀取已核實的插槽、記憶體類型、尺寸淨空及電源建議；缺少資料會明確標記為未知。
- 安全 JSON 匯出使用 schema 2，記錄 build version 及每件 component 的 catalogue version；它不包含使用者、workspace 識別資料、價格、庫存、私人素材或 Cloudflare 部署資料，亦不假裝是 immutable snapshot。
- Cloudflare Workers Static Assets、D1、私人 R2 binding、Workflow binding及按 Access subject 限流。
- 固定 URL 的生成工作 API 以受保護 asset 標頭指定目標，並受 workspace、角色、素材版本、已儲存使用權、可用 generation credit 及 `Idempotency-Key` 限制；asset ID 與 key 均不進 URL 或 body，瀏覽器只在結果不明時以記憶體保留同一素材版本的 key 作安全重試，同一素材只可有一項進行中或等待人工決定的保留工作。審核面板以繁中優先、英文輔助顯示模式、工作狀態、非貨幣 credit、權益、模擬成本與 GLB 驗證，並明確區分空白狀態；公開 failure／validation code 在共享 schema 及 D1 新增／更新邊界均只接受 1–128 個大寫英數或底線，任意內部文字會 fail closed。
- 零成本 synthetic adapter 可在本地或明確控制的非正式環境驗證 Workflow、GLB 格式、安全檢查、私人 R2 draft ingestion 及人工審批銜接。
- Generation credit 會在要求時原子保留，在核准時結算，在拒絕、失敗、啟動失敗或草稿被取代時釋放；這是非貨幣 entitlement 記帳，不是付款、餘額或售價。
- Provider attempt 以穩定 attempt key 去重，供應商邊界只接收假名化工作參考、來源檔案描述及明確輸出限制。生成 GLB 在寫入 R2 前及讀回後均檢查自包含結構、尺寸、三角形、貼圖、byte bounds 及 checksum。
- Tracked production 設定的 generation kill switch 預設關閉；沒有外部 3D provider、Workers AI 模型或付款呼叫。
- 所有生成素材均視為草稿；只有經人手核准的資料才可進入後續流程。
- 相容性只依賴結構化規格，不會從視覺模型推斷。

本地開發介面的產品、價格、庫存、素材及 3D 場景均為合成示範資料，不應用作真實報價或工程判斷。公開主頁只介紹產品及提供登入導向，不會載入 session、商戶記錄或私人素材。Production 工作台可在角色及 workspace 限制下讀寫 D1 目錄、審核、生成工作及組裝資料，以私人 R2 儲存經驗證的來源圖片及 GLB，並在已核准素材存在時於 Builder 讀取所選組件模型；版本庫不含任何真實商戶記錄。v1.1 是可用的邀請制人工審批 MVP；runtime synthetic GLB 只驗證安全管線，真實 3D 供應商生成、Workers AI 自動化及多模型裝配場景不在此版本承諾內。

主頁的工作區畫面均從本地合成示範介面擷取，用作準確展示 Dashboard、產品目錄、私人素材審核及 Builder；不包含真實商戶資料、私人素材或 production data，亦不構成報價、工程規格或相容性證據。

## 技術棧

| 層面 | 使用技術 |
| --- | --- |
| 前端 | React 19、React Router 8、Vite 8、TypeScript 6、Lucide React |
| 3D 與資料驗證 | Three.js 0.185、glTF 2.0／GLB、Zod 4 |
| Edge 與存取控制 | Cloudflare Workers、Static Assets、Access、Rate Limiting、`jose` |
| 持久化與非同步工作 | Cloudflare D1、私人 R2、Cloudflare Workflows |
| 測試與品質 | Vitest、Cloudflare Workers Vitest pool、ESLint、Prettier、Wrangler 4 |

精確套件版本以 [`package.json`](package.json) 及 lockfile 為準；Cloudflare binding 形狀以 [`wrangler.jsonc`](wrangler.jsonc) 的 identifier-free 範本為準。

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

完整 synthetic 圖片 → 3D → 審核 → Builder 流程：

```bash
npm run local:ai:start
```

在 `/asset-review` 按「合成圖片」，明確勾選圖片使用權並儲存草稿，再建立模擬 GLB。完成六項核准清單及三個人手核實尺寸後核准素材，最後按「在 Builder 檢查」。這條路徑只在 Vite development mode 使用記憶體及 browser object URL，不會上載圖片、呼叫供應商或連接 production。

要驗證本機 D1 migration、R2 與 Workflow runtime：

```bash
npm run db:migrate:local
npm run test:worker
npm run local:ai:debug
```

`local:ai:debug` 明確使用 Wrangler `--local`、synthetic runtime vars 及本機儲存。受保護 API 仍然要求 Access 身份；此命令不加入身份繞過。一次執行全部本機品質閘可用 `npm run local:ai:verify`。

## 自行部署（摘要）

自部署會建立一套完全獨立的 Cloudflare 資源，不會複製 RigStage 的正式資料、用戶、Access policy 或部署座標。開始前請先確認你有權使用此原始碼；本版本庫目前未附帶授權條款，公開可讀不等於獲授權複製、修改或商用。

1. 準備 Node.js 22.22 或以上版本、npm、Git、Cloudflare 帳戶，以及可設定 Cloudflare Access 的 hostname。
2. Fork 或取得獲授權的 source copy，在新的工作目錄執行 `npm ci`，再完成下列品質檢查。
3. 以 Wrangler 互動登入，在自己的 Cloudflare 帳戶建立一個空白 D1 database 及一個保持 private 的 R2 bucket。
4. 在 Git 忽略的本機檔案填入自己的 Worker／D1／R2／Workflow／Rate Limiting 座標，以及 Access runtime secrets；不要改寫 tracked `wrangler.jsonc` 的 placeholders。
5. 產生 `.wrangler/deploy.jsonc`，在 private config 明確關閉 `workers.dev` 及 preview URL，先 dry-run，再套用 migration 及部署 Worker。
6. 在加入任何真實資料前，完成 Access、邀請及 workspace membership 的私人設定，並驗證所有 protected route 均 fail closed。

```bash
npm ci
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high

npx wrangler login
npx wrangler d1 create <your-private-d1-name>
npx wrangler r2 bucket create <your-private-r2-name>
```

完整的私密設定檔格式、手動部署、Workers Builds、自部署驗收、回復及資料外洩檢查，見 [Cloudflare Workers 自部署指南](docs/SELF_HOSTING.md)。該指南只使用 placeholders；請勿把終端輸出、實際 identifier 或 Access 值貼到 issue、pull request、截圖或聊天記錄。

## Cloudflare Workers 部署設定

版本庫內的 `wrangler.jsonc` 只記錄 placeholder Worker label 及不含識別資料的 binding 範本。`main` 分支由 Cloudflare Workers Builds 執行 `npm run build` 及 `npm run deploy:ci`；部署指令會以平台提供的 CI override 與 Cloudflare build secrets 產生 Git 忽略的臨時設定，明確關閉 `workers.dev` 與 preview URLs，先套用尚未執行的 D1 migrations，再上傳 Worker。Account ID、D1 ID、實際資源名稱、token、私有物件 URL 及商戶身份資料不會進入 Git。

Cloudflare build 環境需要以下 secret 名稱，值只儲存在 Cloudflare：

- `RIGSTAGE_D1_DATABASE_ID`
- `RIGSTAGE_D1_DATABASE_NAME`
- `RIGSTAGE_R2_BUCKET_NAME`
- `RIGSTAGE_WORKFLOW_NAME`
- `RIGSTAGE_RATE_NAMESPACE_ID`

Cloudflare Workers Builds 會自動提供 Worker 名稱 override；其他 CI 環境須以私密 build value 提供 `RIGSTAGE_WORKER_NAME`，不可把實際名稱寫入版本庫。

Access 的 `TEAM_DOMAIN` 與 `POLICY_AUD` 是獨立的 runtime secrets，不屬於 build secrets；多個私人 Access applications 可在同一個 `POLICY_AUD` secret 使用有界、逗號分隔的 audience allowlist，實際值不應進入 Git 或 log。

私人 owner onboarding 只從 shell environment 讀取 `OWNER_LOGIN_IDENTITY`，並使用 Git 忽略、權限為 `0600` 且已關閉 `workers.dev`／preview URL 的 deployment config。工具不接受 command-line identity，也不輸出 identity、D1／Worker identifier 或 SQL；若日後已套用 generation credit migration，可由同一個私密流程建立不超過 1,000 單位的非貨幣 beta entitlement，現有記帳不會被重設。

```bash
npm run owner:onboard
```

真實值必須在執行前由私密 terminal session 放入環境；不要把 export 指令、終端記錄或結果貼入 issue、PR 或文件。

Tracked `GENERATION_MODE=disabled` 及 `GENERATION_MAX_COST_MINOR=0` 是 production fail-closed 預設值，不是供應商設定。任何外部生成啟用都需要另一次明確批准、私密設定、費用上限及非正式環境驗證。

自部署入口見 [Cloudflare Workers 自部署指南](docs/SELF_HOSTING.md)，身份及 D1 設定見 [試行存取設定](docs/PILOT_ACCESS_SETUP.md)。生成與付款界線見 [Generation pipeline](docs/GENERATION_PIPELINE.md) 及 [Payment boundary](docs/PAYMENT_BOUNDARY.md)，相容性證據見 [規則文件](docs/COMPATIBILITY_RULES.md)，協作及回報渠道見 [Contribution workflow](docs/CONTRIBUTING.md) 與 [Support](SUPPORT.md)，公開安全政策見 [SECURITY.md](SECURITY.md)。

## 安全邊界

- 除 health endpoint 外，API 必須先驗證 Access JWT。
- 私人 SPA parent 及 deep route 在讀取 Static Assets 前同樣驗證 Access JWT、owner invite 及 active workspace membership。
- Workspace 選擇必須由 D1 membership 重新核對。
- 首次身份綁定採用條件更新，失敗後重新讀取持久化 subject。
- 已綁定身份的 session 與其他讀取不會更新 workspace 偏好或寫入 audit table；明確切換使用固定 PUT 端點，並在 D1 write boundary 重查 subject、active user、workspace 及 membership。
- Dashboard 只執行有界、workspace-scoped 讀取，不會建立記錄或寫入 audit table。
- 目錄及素材查詢必須同時限制 workspace；審核及檔案更新使用版本條件，並在 D1 commit 邊界重查產品仍為 active，避免覆寫其他人變更或寫入已封存產品。
- 組裝讀寫必須同時限制 workspace；讀取空清單不會建立資料，更新使用版本及一次性 mutation token。
- 匯出在有嚴重錯誤或未知相容性結果時會停止，並排除身份、營運及私人素材欄位。
- Viewer 只可讀取；staff 只可保存草稿；owner 或 admin 才可核准或拒絕素材。前端拒絕確認只減少誤按，伺服器仍獨立執行角色、workspace、素材版本及狀態檢查。
- 限流在任何 protected D1 工作前，把已驗證 Access subject 轉成版本化、domain-separated SHA-256 opaque key；raw subject、JWT 及電郵均不會傳入 Rate Limiting binding 或 request log。
- 原始圖片、模型及渲染輸出必須維持私人存取。
- Builder 只讀取已核准素材的私人 GLB，並在選擇切換或頁面卸載時撤銷瀏覽器 object URL。
- 生成工作先原子保留一個非貨幣 credit，提交 D1 job／entitlement／event／audit，再啟動 Workflow；輸入版本、使用權、成本上限、輸出格式及 checksum 任一失敗都不會建立可核准素材，保留 credit 只會釋放一次。
- 模擬輸出會重設所有人工審核證據；production kill switch 關閉時不會建立工作或呼叫外部服務。

## 技術、AI 模型與參考資料

- **Runtime AI 模型：沒有。** 現有 `SyntheticGenerationProvider` 是 deterministic TypeScript 測試 adapter，只建立合成 GLB fixture；它不執行 inference、不讀取來源圖片內容，也不呼叫 Workers AI、OpenAI 或第三方 3D provider。
- **雲端技術：** [Cloudflare Workers](https://developers.cloudflare.com/workers/)、[Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)、[D1](https://developers.cloudflare.com/d1/)、[R2](https://developers.cloudflare.com/r2/)、[Workflows](https://developers.cloudflare.com/workflows/) 及 [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
- **Web 與 3D：** [React](https://react.dev/)、[React Router](https://reactrouter.com/)、[Vite](https://vite.dev/)、[TypeScript](https://www.typescriptlang.org/docs/)、[Three.js](https://threejs.org/docs/) 及 Khronos [glTF 2.0 specification](https://registry.khronos.org/glTF/)。
- **資料來源：** repository 只包含 synthetic fixtures、程式測試資料及公開標準參考；不包含正式 catalogue、用戶、客戶、價格、庫存、圖片、模型、prompt、provider response 或資料庫 dump。
- 完整的用途對照、版本依據、官方參考連結、AI／dataset 聲明及更新規則見 [技術、模型與資料來源](docs/TECHNOLOGY_REFERENCES.md)。
