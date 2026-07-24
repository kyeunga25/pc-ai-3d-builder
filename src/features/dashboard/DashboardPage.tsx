import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Cuboid,
  FileWarning,
  Plus,
  Wrench,
} from "lucide-react";
import { Link } from "react-router";

import { StatusBadge } from "../../shared/components/StatusBadge";
import { formatHkd } from "../../shared/i18n/locale";
import "./dashboard.css";

const queue = [
  {
    name: "DeepCool AK620 Digital",
    task: "3D 素材審核",
    status: "需要審核",
    tone: "warning" as const,
    time: "12 分鐘前",
  },
  {
    name: "1440p 純黑主機",
    task: "組裝方案",
    status: "可供審核",
    tone: "success" as const,
    time: "38 分鐘前",
  },
  {
    name: "ASUS AP201 Black",
    task: "3D 生成",
    status: "草稿已準備",
    tone: "info" as const,
    time: "1 小時前",
  },
];

export function DashboardPage() {
  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">示範工作空間</span>
          <h1>商戶儀表板</h1>
          <p>集中查看產品目錄準備度、待審工作及進行中的電腦組裝。</p>
        </div>
        <div className="page-header__actions">
          <Link className="button button--secondary" to="/catalogue">
            <Plus aria-hidden="true" />
            新增目錄產品
          </Link>
          <Link className="button button--primary" to="/builder">
            <Wrench aria-hidden="true" />
            開啟組裝工具
          </Link>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label="工作空間指標">
        <article>
          <Boxes aria-hidden="true" />
          <div>
            <span>目錄組件</span>
            <strong>24</strong>
            <small>18 項素材已核准</small>
          </div>
        </article>
        <article>
          <Cuboid aria-hidden="true" />
          <div>
            <span>等待審核</span>
            <strong>3</strong>
            <small>最早草稿 · 1 小時 24 分鐘</small>
          </div>
        </article>
        <article>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <span>可供審核的組裝</span>
            <strong>5</strong>
            <small>沒有嚴重相容性錯誤</small>
          </div>
        </article>
        <article>
          <Clock3 aria-hidden="true" />
          <div>
            <span>草稿時間中位數</span>
            <strong>18 分鐘</strong>
            <small>模擬供應商記錄</small>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="work-queue">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">待辦工作</h2>
              <p className="section-subtitle">需要商戶作決定的項目。</p>
            </div>
            <StatusBadge tone="warning">3 項待處理</StatusBadge>
          </div>
          <div className="queue-list">
            {queue.map((item) => (
              <article className="queue-row" key={item.name}>
                <span className="queue-row__icon">
                  {item.tone === "warning" ? (
                    <FileWarning aria-hidden="true" />
                  ) : item.tone === "success" ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <Cuboid aria-hidden="true" />
                  )}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.task} · {item.time}
                  </span>
                </div>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                <ArrowRight aria-hidden="true" />
              </article>
            ))}
          </div>
          <Link className="text-link" to="/asset-review">
            開啟 3D 素材審核工作室 <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <aside className="pilot-readiness">
          <div className="dashboard-section-heading">
            <div>
              <h2 className="section-title">試行準備度</h2>
              <p className="section-subtitle">測試工作空間進度。</p>
            </div>
            <span className="readiness-score">75%</span>
          </div>
          <div className="readiness-ring" aria-label="試行準備度百分之七十五">
            <span>18</span>
            <small>項已核准</small>
          </div>
          <dl className="readiness-list">
            <div>
              <dt>已核准目錄總值</dt>
              <dd>{formatHkd(8_740_000)}</dd>
            </div>
            <div>
              <dt>支援機箱</dt>
              <dd>2 / 3</dd>
            </div>
            <div>
              <dt>測試組裝</dt>
              <dd>5 / 5</dd>
            </div>
          </dl>
          <div className="readiness-note">
            <FileWarning aria-hidden="true" />
            <span>尚有一個機箱範本需要核實安裝槽位。</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
