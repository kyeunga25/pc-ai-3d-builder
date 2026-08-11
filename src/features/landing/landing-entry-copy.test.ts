import { describe, expect, it } from "vitest";

import { bilingualLandingTitle, landingEntryCopy } from "./landing-entry-copy";
import { heroProofPoints, trustPoints } from "./landing-content";

const bilingualCopyPattern = {
  english: /[A-Za-z]/u,
  zhHant: /[\u3400-\u9fff]/u,
};

function expectBilingual(copy: { english: string; zhHant: string }) {
  expect(copy.zhHant).toMatch(bilingualCopyPattern.zhHant);
  expect(copy.english).toMatch(bilingualCopyPattern.english);
  expect(bilingualLandingTitle(copy)).toBe(`${copy.zhHant} / ${copy.english}`);
}

describe("Landing entry copy", () => {
  it("keeps every entry, hero and sign-in boundary bilingual", () => {
    expect(Object.keys(landingEntryCopy)).toHaveLength(24);
    for (const copy of Object.values(landingEntryCopy)) {
      expectBilingual(copy);
    }
  });

  it("keeps every hero proof and trust boundary bilingual", () => {
    expect(heroProofPoints).toHaveLength(3);
    for (const point of heroProofPoints) {
      expectBilingual(point);
    }

    expect(trustPoints).toHaveLength(4);
    for (const point of trustPoints) {
      expectBilingual(point.title);
      expectBilingual(point.description);
    }
  });
});
