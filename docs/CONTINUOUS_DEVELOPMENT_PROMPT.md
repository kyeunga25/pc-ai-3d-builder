# RigStage 持續開發 Prompt

> 這是一份可公開的執行契約，不是私人 roadmap。不得加入帳戶資料、部署識別碼、客戶／工作區資料、內部營運細節或對話紀錄。

你正在持續設計、開發及改善 RigStage。目標是讓受邀使用者更可靠地管理硬件資料、驗證相容性、審核 3D 資產與建立可追溯的工作成果，同時維持產品準確度、私隱與安全。

## 不可破壞的邊界

- 繁體中文為主要介面語言，關鍵操作、登入與錯誤狀態提供英文版本。
- 公開產品介紹與受邀工作區保持分離；所有 workspace 操作都需要伺服器端身份、成員資格與角色驗證。
- 原始圖片、3D 檔、生成結果、規格、審核紀錄與識別碼維持私人；公開 demo 只能使用明確標示的 synthetic data。
- 生成結果永遠先是 draft，經結構、安全、版本與人工審核後才可核准。相容性只能根據已驗證的結構化規格，不得從外觀猜測。
- 真實付費生成與付款保持 fail-closed；不得為展示完整度而啟用。
- 不與其他 app 共用 cookie、身份、資料庫、儲存空間、secret 或私人 telemetry。
- 保留所有既有未提交變更；不得 bulk stage、重置、覆蓋或批量刪除。

## 永續 development loop

1. **重新定位**：核對目錄、Git root、remote、branch、狀態及所有適用指令；把既有變更視為使用者所有。
2. **觀察證據**：閱讀相關 UI、domain contract、Worker boundary、migration 與 tests；不以舊文件或 CI 猜測 production。
3. **挑選切片**：最多提出三項候選，按使用者價值、安全／私隱、資料正確性、Cloudflare 免費方案成本及本機可驗證性選一項。
4. **定義完成**：寫明角色、workspace、資產版本、idempotency、輸入界限、失敗／重試、人工審核、無障礙與回復驗收。
5. **實作與測試**：先建立正向、跨 workspace 負向、重放／併發及 malformed input 測試，再做最小必要修改。測試只用 synthetic fixtures。
6. **安全檢查**：確認私人 object／ID 不進入 URL、log、public asset、fixture、截圖或 commit；檔案上載要在完整 materialize 前有總量界限並驗證內容而非只信副檔名。
7. **本機 gates**：執行 repo 現有 check、test、Workers runtime test、build、Cloudflare dry-run、local migration 及 dependency audit；沒有真實 provider call。
8. **提交 cycle**：只 stage 明確檔案，檢查 staged diff，以 `type: content` 建立一個聚焦 commit，記錄實際通過與未執行的驗證。
9. **繼續演進**：完成後立即重新觀察並選下一個最小高價值切片；不要用無效重構、版本 bump 或文件 churn 充數。

Cloudflare 登入或部署不可用時，保留 fail-closed 設定並繼續本機功能、測試、UX、效能或安全 cycle；不得聲稱線上狀態已驗證。

## 本產品的優先選擇規則

優先改善：規格來源與證據、跨 workspace isolation、資產版本及審核、嚴格 3D 驗證、可理解的失敗與重試、私隱／保留／匯出控制、窄螢幕可用性及不含動態識別碼的 observability。任何 provider 接入都必須另有成本上限、資料使用、法律、callback、kill switch 與小規模批准。

## Suite 整合契約

只可輸出經人工核准的最小 delivery bundle：版本、schema、digest、一般化 provenance／rights 結果及可公開預覽。AisleStage 或 Personal Space 不可直接讀取 RigStage 私人儲存；同帳戶 server-to-server 整合亦只能在明確部署授權後使用窄權限邊界。整合失敗時保留本產品完整功能。

## English runner contract

Complete one workspace-safe, evidence-backed vertical slice per cycle. Keep private assets and identifiers out of public output, require human approval for generated artifacts, verify tenant isolation and idempotency, commit only the exact completed scope, and immediately continue with the next safe local cycle.
