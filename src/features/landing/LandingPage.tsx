import {
  ArrowDownRight,
  ArrowRight,
  Box,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "../../shared/components/BrandMark";
import {
  landingCopy,
  trustPoints,
  workflowSteps,
  workspaceEntryPath,
} from "./landing-content";
import "./landing.css";

const trustIcons: Record<(typeof trustPoints)[number]["title"], LucideIcon> = {
  "Workspace 隔離": ShieldCheck,
  人手審核: UserRoundCheck,
  核實規格: FileCheck2,
  私人素材: Box,
};

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
          <a href="#features">功能</a>
          <a href="#workflow">流程</a>
          <a href="#security">安全</a>
        </nav>
        <a className="landing-login-link" href={workspaceEntryPath}>
          <span>登入工作台</span>
          <ArrowRight aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="landing-hero" id="features">
          <div className="landing-hero__copy">
            <h1>{landingCopy.heroTitle}</h1>
            <p className="landing-hero__summary">{landingCopy.heroSummary}</p>
            <p className="landing-hero__english" lang="en">
              {landingCopy.heroEnglish}
            </p>
            <div className="landing-hero__actions">
              <a
                className="landing-button landing-button--primary"
                href={workspaceEntryPath}
              >
                <span>登入工作台</span>
                <ArrowRight aria-hidden="true" />
              </a>
              <a className="landing-text-link" href="#workflow">
                <span>了解運作方式</span>
                <ArrowDownRight aria-hidden="true" />
              </a>
            </div>
          </div>

          <figure className="landing-hero__visual">
            <img
              src="/landing/rigstage-hero-workstation.png"
              alt="在技術工作台上分拆排列的電腦零件示意圖"
              width="1705"
              height="922"
              fetchPriority="high"
            />
            <figcaption className="landing-visually-hidden">
              概念示意圖不代表真實產品、商戶資料或已核准工程規格。
            </figcaption>
          </figure>
        </section>

        <section
          className="landing-workflow"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-shell">
            <h2 id="workflow-title">由資料到可交付組裝</h2>
            <ol className="landing-workflow__rail">
              {workflowSteps.map((step) => (
                <li key={step.number}>
                  <span className="landing-workflow__dot" aria-hidden="true" />
                  <span className="landing-workflow__number">
                    {step.number}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
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
              <h2 id="trust-title">只讓核准資料進入工作流。</h2>
              <p>
                RigStage 的相容性從不依賴視覺網格推斷，只顯示已核准的 GLB
                預覽。每個步驟都有清晰的審核來源，讓決策可解釋、可追溯。
              </p>
              <CheckCircle2 aria-hidden="true" />
            </div>

            <ul className="landing-trust__list">
              {trustPoints.map(({ title, description }) => {
                const Icon = trustIcons[title];

                return (
                  <li key={title}>
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="landing-signin" aria-labelledby="signin-title">
          <div className="landing-section-shell landing-signin__layout">
            <LockKeyhole aria-hidden="true" />
            <div className="landing-signin__copy">
              <h2 id="signin-title">已獲邀？登入你的工作空間。</h2>
              <p>使用 Cloudflare Access 安全連線，進入你的專屬工作台。</p>
            </div>
            <a
              className="landing-button landing-button--primary"
              href={workspaceEntryPath}
            >
              <span>以 Cloudflare Access 登入</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <p className="landing-signin__guidance">
              未獲邀？
              <br />
              <span>請聯絡工作空間管理員。</span>
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span lang="en">RigStage · Invite-only workspace</span>
        <nav aria-label="頁尾導覽">
          <a href="#security">私隱</a>
          <a href="#security">安全</a>
        </nav>
      </footer>
    </div>
  );
}
