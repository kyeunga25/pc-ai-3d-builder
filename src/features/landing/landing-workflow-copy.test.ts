import { describe, expect, it } from "vitest";

import {
  landingCopy,
  landingUseCaseCopy,
  useCases,
  workflowCases,
} from "./landing-content";
import { bilingualLandingTitle } from "./landing-entry-copy";

const bilingualCopyPattern = {
  english: /[A-Za-z]/u,
  zhHant: /[\u3400-\u9fff]/u,
};

function expectBilingual(copy: { english: string; zhHant: string }) {
  expect(copy.zhHant).toMatch(bilingualCopyPattern.zhHant);
  expect(copy.english).toMatch(bilingualCopyPattern.english);
  expect(bilingualLandingTitle(copy)).toBe(`${copy.zhHant} / ${copy.english}`);
}

describe("Landing workflow copy", () => {
  it("keeps the workflow heading and every synthetic workflow bilingual", () => {
    expectBilingual(landingCopy.workflowTitle);
    expectBilingual(landingCopy.workflowSummary);
    expect(workflowCases).toHaveLength(3);

    for (const workflowCase of workflowCases) {
      expectBilingual(workflowCase.label);
      expectBilingual(workflowCase.title);
      expectBilingual(workflowCase.description);
      expectBilingual(workflowCase.imageAlt);
      expect(workflowCase.points).toHaveLength(3);
      for (const point of workflowCase.points) {
        expectBilingual(point);
      }
    }
  });

  it("keeps the use-case introduction and every scenario bilingual", () => {
    expectBilingual(landingUseCaseCopy.title);
    expectBilingual(landingUseCaseCopy.description);
    expect(useCases).toHaveLength(3);

    for (const useCase of useCases) {
      expectBilingual(useCase.title);
      expectBilingual(useCase.situation);
      expectBilingual(useCase.response);
    }
  });
});
