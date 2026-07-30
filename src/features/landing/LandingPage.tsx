import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
} from "lucide-react";

import { BrandMark } from "../../shared/components/BrandMark";
import {
  heroProofPoints,
  landingCopy,
  trustPoints,
  useCases,
  workflowCases,
  workspaceEntryPath,
} from "./landing-content";
import "./landing.css";

function WorkspaceScreenshot({
  image,
  imageAlt,
  label,
  priority = false,
}: {
  image: string;
  imageAlt: string;
  label: string;
  priority?: boolean;
}) {
  return (
    <figure className="landing-workspace-shot">
      <div className="landing-workspace-shot__bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <strong>RigStage workspace</strong>
      </div>
      <a href={image} target="_blank" rel="noreferrer">
        <img
          src={image}
          alt={imageAlt}
          width="1440"
          height="900"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </a>
      <figcaption>
        <span>{label} · 合成示範工作區</span>
        <a href={image} target="_blank" rel="noreferrer">
          放大查看介面
          <ExternalLink aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a
          className="landing-header__brand"
          href="/"
          aria-label="RigStage 主頁"
        >
          <BrandMark />
        </a>
        <nav className="landing-header__nav" aria-label="主頁導覽">
          <a href="#workflow">實際流程</a>
          <a href="#use-cases">使用情境</a>
          <a href="#security">資料邊界</a>
        </nav>
        <a className="landing-login-link" href={workspaceEntryPath}>
          <span>登入工作台</span>
          <ArrowRight aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <h1 id="landing-title">{landingCopy.heroTitle}</h1>
            <p className="landing-hero__summary">{landingCopy.heroSummary}</p>
            <p className="landing-hero__english" lang="en">
              {landingCopy.heroEnglish}
            </p>
            <div className="landing-hero__actions">
              <a
                className="landing-button landing-button--primary"
                href={workspaceEntryPath}
              >
                <span>進入獲邀工作空間</span>
                <ArrowRight aria-hidden="true" />
              </a>
              <a className="landing-text-link" href="#workflow">
                <span>查看實際工作流程</span>
                <ArrowDownRight aria-hidden="true" />
              </a>
            </div>
            <ul className="landing-hero__proof" aria-label="產品重點">
              {heroProofPoints.map((point) => (
                <li key={point}>
                  <Check aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-hero__product">
            <WorkspaceScreenshot
              image="/landing/workspace-builder.jpg"
              imageAlt="RigStage 電腦組裝工作台，顯示九類組件、3D 預覽、相容性證據及安全匯出"
              label="電腦組裝與相容性"
              priority
            />
            <p className="landing-hero__product-note">
              選擇九類組件、逐條查看相容性證據，通過閘門後才可安全匯出。
            </p>
          </div>
        </section>

        <section
          className="landing-workflow"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-shell landing-section-heading">
            <span className="landing-section-heading__index">01—03</span>
            <div>
              <h2 id="workflow-title">{landingCopy.workflowTitle}</h2>
              <p>{landingCopy.workflowSummary}</p>
            </div>
          </div>

          <div className="landing-workflow__cases">
            {workflowCases.map((workflowCase) => (
              <article
                className="landing-workflow-case"
                key={workflowCase.number}
              >
                <div className="landing-workflow-case__copy">
                  <span className="landing-workflow-case__label">
                    {workflowCase.number} / {workflowCase.label}
                  </span>
                  <h3>{workflowCase.title}</h3>
                  <p>{workflowCase.description}</p>
                  <ul>
                    {workflowCase.points.map((point) => (
                      <li key={point}>
                        <Check aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <WorkspaceScreenshot
                  image={workflowCase.image}
                  imageAlt={workflowCase.imageAlt}
                  label={workflowCase.label}
                />
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-use-cases"
          id="use-cases"
          aria-labelledby="use-cases-title"
        >
          <div className="landing-section-shell landing-use-cases__layout">
            <div className="landing-use-cases__intro">
              <h2 id="use-cases-title">貼近商戶日常，而不是一張靜態 3D 圖。</h2>
              <p>
                RigStage
                把「資料是否可信、素材是否核准、組裝是否可交付」放在同一條可追蹤流程，適合需要多人協作及明確審核責任的團隊。
              </p>
            </div>
            <ol className="landing-use-cases__list">
              {useCases.map((useCase, index) => (
                <li key={useCase.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{useCase.title}</h3>
                    <p>{useCase.situation}</p>
                    <strong>{useCase.response}</strong>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="landing-trust"
          id="security"
          aria-labelledby="trust-title"
        >
          <div className="landing-section-shell landing-trust__layout">
            <div className="landing-trust__statement">
              <LockKeyhole aria-hidden="true" />
              <h2 id="trust-title">
                公開介紹產品，私人工作仍然留在工作空間內。
              </h2>
              <p>
                首頁不讀取 session 或商戶資料。進入工作台後，API 仍會驗證 Access
                身份、邀請及 active membership，再以 server-side Workspace
                範圍處理每個受保護記錄。
              </p>
            </div>

            <ul className="landing-trust__list">
              {trustPoints.map(({ title, description }) => (
                <li key={title}>
                  <Check aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-signin" aria-labelledby="signin-title">
          <div className="landing-section-shell landing-signin__layout">
            <div className="landing-signin__copy">
              <h2 id="signin-title">已獲邀？從你的工作空間繼續。</h2>
              <p>
                沒有公開註冊。Beta Access
                用戶可使用獲授權身份登入；商業使用或獨立部署安排，請先聯絡工作空間管理員。
              </p>
            </div>
            <a
              className="landing-button landing-button--primary"
              href={workspaceEntryPath}
            >
              <span>登入 RigStage 工作台</span>
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span lang="en">RigStage · Invite-only workspace</span>
        <span>工作區畫面使用合成示範資料</span>
      </footer>
    </div>
  );
}
