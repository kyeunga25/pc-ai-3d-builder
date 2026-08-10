import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
} from "lucide-react";

import { BrandMark } from "../../shared/components/BrandMark";
import {
  demoEntryPath,
  heroProofPoints,
  landingCopy,
  trustPoints,
  useCases,
  workflowCases,
  workspaceEntryPath,
} from "./landing-content";
import {
  bilingualLandingTitle,
  landingEntryCopy,
  landingScreenshotCaptionCopy,
  type LandingBilingualCopy,
} from "./landing-entry-copy";
import "./landing.css";

function LandingText({ copy }: { copy: LandingBilingualCopy }) {
  return (
    <span className="landing-bilingual-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

function WorkspaceScreenshot({
  image,
  imageAlt,
  label,
  labelEnglish,
  priority = false,
}: {
  image: string;
  imageAlt: string;
  label: string;
  labelEnglish?: string;
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
        <LandingText copy={landingScreenshotCaptionCopy(label, labelEnglish)} />
        <a
          href={image}
          target="_blank"
          rel="noreferrer"
          aria-label={`${bilingualLandingTitle(
            landingEntryCopy.enlargeInterface,
          )}: ${label}`}
        >
          <LandingText copy={landingEntryCopy.enlargeInterface} />
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
          aria-label={bilingualLandingTitle(landingEntryCopy.brandHome)}
        >
          <BrandMark />
        </a>
        <nav
          className="landing-header__nav"
          aria-label={bilingualLandingTitle(landingEntryCopy.navLabel)}
        >
          <a href="#workflow">
            <LandingText copy={landingEntryCopy.navWorkflow} />
          </a>
          <a href="#use-cases">
            <LandingText copy={landingEntryCopy.navUseCases} />
          </a>
          <a href="#security">
            <LandingText copy={landingEntryCopy.navSecurity} />
          </a>
        </nav>
        <a
          className="landing-login-link"
          href={workspaceEntryPath}
          aria-label={bilingualLandingTitle(landingEntryCopy.headerLogin)}
        >
          <LandingText copy={landingEntryCopy.headerLogin} />
          <ArrowRight aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <h1 id="landing-title">
              <LandingText copy={landingEntryCopy.heroTitle} />
            </h1>
            <p className="landing-hero__summary">
              <LandingText copy={landingEntryCopy.heroSummary} />
            </p>
            <p className="landing-hero__tagline">
              <LandingText copy={landingEntryCopy.heroTagline} />
            </p>
            <div className="landing-hero__actions">
              <a
                className="landing-button landing-button--primary"
                href={demoEntryPath}
                aria-label={bilingualLandingTitle(landingEntryCopy.demoAction)}
              >
                <LandingText copy={landingEntryCopy.demoAction} />
                <ArrowRight aria-hidden="true" />
              </a>
              <a
                className="landing-text-link"
                href={workspaceEntryPath}
                aria-label={bilingualLandingTitle(
                  landingEntryCopy.inviteAction,
                )}
              >
                <LandingText copy={landingEntryCopy.inviteAction} />
                <ArrowDownRight aria-hidden="true" />
              </a>
            </div>
            <ul
              className="landing-hero__proof"
              aria-label={bilingualLandingTitle(landingEntryCopy.proofLabel)}
            >
              {heroProofPoints.map((point) => (
                <li key={point.zhHant}>
                  <Check aria-hidden="true" />
                  <LandingText copy={point} />
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-hero__product">
            <WorkspaceScreenshot
              image="/landing/workspace-builder.jpg"
              imageAlt={bilingualLandingTitle(landingEntryCopy.builderImageAlt)}
              label={landingEntryCopy.builderLabel.zhHant}
              labelEnglish={landingEntryCopy.builderLabel.english}
              priority
            />
            <p className="landing-hero__product-note">
              <LandingText copy={landingEntryCopy.builderNote} />
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
                <LandingText copy={landingEntryCopy.trustTitle} />
              </h2>
              <p>
                <LandingText copy={landingEntryCopy.trustDescription} />
              </p>
            </div>

            <ul className="landing-trust__list">
              {trustPoints.map(({ title, description }) => (
                <li key={title.zhHant}>
                  <Check aria-hidden="true" />
                  <div>
                    <h3>
                      <LandingText copy={title} />
                    </h3>
                    <p>
                      <LandingText copy={description} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-signin" aria-labelledby="signin-title">
          <div className="landing-section-shell landing-signin__layout">
            <div className="landing-signin__copy">
              <h2 id="signin-title">
                <LandingText copy={landingEntryCopy.signinTitle} />
              </h2>
              <p>
                <LandingText copy={landingEntryCopy.signinDescription} />
              </p>
            </div>
            <a
              className="landing-button landing-button--primary"
              href={workspaceEntryPath}
              aria-label={bilingualLandingTitle(landingEntryCopy.signinAction)}
            >
              <LandingText copy={landingEntryCopy.signinAction} />
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <LandingText copy={landingEntryCopy.footerInviteOnly} />
        <LandingText copy={landingEntryCopy.footerSynthetic} />
      </footer>
    </div>
  );
}
