import { describe, expect, it } from "vitest";

import { bilingualLoginTitle, loginInterfaceCopy } from "./login-copy";

const bilingualCopyPattern = {
  english: /[A-Za-z]/u,
  zhHant: /[\u3400-\u9fff]/u,
};

describe("Login interface copy", () => {
  it("keeps every static login label and safety boundary bilingual", () => {
    expect(Object.keys(loginInterfaceCopy)).toHaveLength(15);
    for (const copy of Object.values(loginInterfaceCopy)) {
      expect(copy.zhHant).toMatch(bilingualCopyPattern.zhHant);
      expect(copy.english).toMatch(bilingualCopyPattern.english);
      expect(bilingualLoginTitle(copy)).toBe(
        `${copy.zhHant} / ${copy.english}`,
      );
    }
  });
});
