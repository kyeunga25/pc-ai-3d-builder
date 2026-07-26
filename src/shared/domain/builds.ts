import { z } from "zod";

import {
  catalogPartSchema,
  componentCategorySchema,
  type CatalogPart,
  type ComponentCategory,
} from "./schemas";

export const buildRecordIdPattern = /^[A-Za-z0-9_-]{1,128}$/u;

export const buildNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) =>
      !Array.from(value).some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      }),
    { message: "Control characters are not allowed." },
  );

export const buildStatusSchema = z.enum(["draft", "archived"]);
export const compatibilitySeveritySchema = z.enum([
  "pass",
  "warning",
  "error",
  "unknown",
]);
export const compatibilityRuleIdSchema = z.enum([
  "cpu_socket",
  "memory_type",
  "motherboard_form_factor",
  "gpu_clearance",
  "cooler_clearance",
  "gpu_psu_recommendation",
  "component_availability",
  "component_archived",
]);

export const compatibilityEvidenceSchema = z.object({
  labelZhHant: z.string().min(1).max(120),
  labelEn: z.string().min(1).max(120),
  actual: z.string().min(1).max(120),
  expected: z.string().min(1).max(120),
});

export const compatibilityFindingSchema = z.object({
  ruleId: compatibilityRuleIdSchema,
  severity: compatibilitySeveritySchema,
  categories: z.array(componentCategorySchema).min(1).max(2),
  messageZhHant: z.string().min(1).max(240),
  messageEn: z.string().min(1).max(240),
  evidence: z.array(compatibilityEvidenceSchema).max(4),
});

export const buildCompatibilitySummarySchema = z.object({
  passCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
});

export const buildRecordSchema = z
  .object({
    id: z.string().regex(buildRecordIdPattern),
    name: buildNameSchema,
    status: buildStatusSchema,
    selectedParts: z.array(catalogPartSchema).max(9),
    findings: z.array(compatibilityFindingSchema).max(24),
    summary: buildCompatibilitySummarySchema,
    totalPriceMinor: z.number().int().nonnegative().max(899_999_991),
    version: z.number().int().nonnegative(),
    updatedAt: z.string().min(1).max(64),
  })
  .superRefine((build, context) => {
    const categories = new Set<ComponentCategory>();
    for (const [index, part] of build.selectedParts.entries()) {
      if (categories.has(part.category)) {
        context.addIssue({
          code: "custom",
          path: ["selectedParts", index, "category"],
          message: "Only one selected part is allowed per category.",
        });
      }
      categories.add(part.category);
    }
  });

export const buildListItemSchema = z.object({
  id: z.string().regex(buildRecordIdPattern),
  name: buildNameSchema,
  selectedCount: z.number().int().nonnegative().max(9),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().min(1).max(64),
});

export const buildListResponseSchema = z.object({
  items: z.array(buildListItemSchema).max(50),
});

const selectedPartIdsSchema = z
  .array(z.string().regex(buildRecordIdPattern))
  .max(9)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Selected part identifiers must be unique.",
  });

export const buildCreateInputSchema = z.object({
  name: buildNameSchema,
  selectedPartIds: selectedPartIdsSchema,
});

export const buildMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    expectedVersion: z.number().int().nonnegative(),
    name: buildNameSchema,
    selectedPartIds: selectedPartIdsSchema,
  }),
  z.object({
    action: z.literal("archive"),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);

export type CompatibilityFinding = z.infer<typeof compatibilityFindingSchema>;
export type BuildCompatibilitySummary = z.infer<
  typeof buildCompatibilitySummarySchema
>;
export type BuildRecord = z.infer<typeof buildRecordSchema>;
export type BuildListItem = z.infer<typeof buildListItemSchema>;
export type BuildCreateInput = z.infer<typeof buildCreateInputSchema>;
export type BuildMutation = z.infer<typeof buildMutationSchema>;

const categoryOrder: ComponentCategory[] = [
  "case",
  "motherboard",
  "cpu",
  "gpu",
  "memory",
  "cooling",
  "storage",
  "psu",
  "fans",
];

function stringSpecification(part: CatalogPart, key: string): string | null {
  const value = part.specifications[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberSpecification(part: CatalogPart, key: string): number | null {
  const value = part.specifications[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function compatibilityFinding(
  finding: CompatibilityFinding,
): CompatibilityFinding {
  return compatibilityFindingSchema.parse(finding);
}

function unknownRule(
  ruleId: CompatibilityFinding["ruleId"],
  categories: ComponentCategory[],
  messageZhHant: string,
  messageEn: string,
): CompatibilityFinding {
  return compatibilityFinding({
    ruleId,
    severity: "unknown",
    categories,
    messageZhHant,
    messageEn,
    evidence: [],
  });
}

function preparePair(
  selected: Map<ComponentCategory, CatalogPart>,
  ruleId: CompatibilityFinding["ruleId"],
  categories: [ComponentCategory, ComponentCategory],
  requiredSpecifications: Array<[ComponentCategory, string]>,
):
  | { first: CatalogPart; second: CatalogPart }
  | { finding: CompatibilityFinding } {
  const first = selected.get(categories[0]);
  const second = selected.get(categories[1]);
  if (!first || !second) {
    return {
      finding: unknownRule(
        ruleId,
        categories,
        "尚未選齊執行此規則所需的組件。",
        "Select both required components before this rule can be evaluated.",
      ),
    };
  }
  if (
    first.specificationStatus !== "verified" ||
    second.specificationStatus !== "verified"
  ) {
    return {
      finding: unknownRule(
        ruleId,
        categories,
        "其中一項組件的結構化規格尚未核實。",
        "Structured specifications for one of the components are not verified.",
      ),
    };
  }
  const missingSpecification = requiredSpecifications.some(
    ([category, key]) => {
      const part = selected.get(category);
      const value = part?.specifications[key];
      return (
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0)
      );
    },
  );
  if (missingSpecification) {
    return {
      finding: unknownRule(
        ruleId,
        categories,
        "已核實記錄仍缺少此規則需要的欄位。",
        "A verified record is missing a field required by this rule.",
      ),
    };
  }
  return { first, second };
}

function evaluateCpuSocket(
  selected: Map<ComponentCategory, CatalogPart>,
): CompatibilityFinding {
  const prepared = preparePair(
    selected,
    "cpu_socket",
    ["cpu", "motherboard"],
    [
      ["cpu", "socket"],
      ["motherboard", "socket"],
    ],
  );
  if ("finding" in prepared) {
    return prepared.finding;
  }
  const cpuSocket = stringSpecification(prepared.first, "socket")!;
  const boardSocket = stringSpecification(prepared.second, "socket")!;
  const matches = normalized(cpuSocket) === normalized(boardSocket);
  return compatibilityFinding({
    ruleId: "cpu_socket",
    severity: matches ? "pass" : "error",
    categories: ["cpu", "motherboard"],
    messageZhHant: matches
      ? "處理器與主機板插槽一致。"
      : "處理器與主機板插槽不一致。",
    messageEn: matches
      ? "CPU and motherboard sockets match."
      : "CPU and motherboard sockets do not match.",
    evidence: [
      {
        labelZhHant: "插槽",
        labelEn: "Socket",
        actual: cpuSocket,
        expected: boardSocket,
      },
    ],
  });
}

function evaluateMemoryType(
  selected: Map<ComponentCategory, CatalogPart>,
): CompatibilityFinding {
  const prepared = preparePair(
    selected,
    "memory_type",
    ["memory", "motherboard"],
    [
      ["memory", "memoryType"],
      ["motherboard", "memoryType"],
    ],
  );
  if ("finding" in prepared) {
    return prepared.finding;
  }
  const memoryType = stringSpecification(prepared.first, "memoryType")!;
  const boardMemoryType = stringSpecification(prepared.second, "memoryType")!;
  const matches = normalized(memoryType) === normalized(boardMemoryType);
  return compatibilityFinding({
    ruleId: "memory_type",
    severity: matches ? "pass" : "error",
    categories: ["memory", "motherboard"],
    messageZhHant: matches
      ? "記憶體類型與主機板一致。"
      : "記憶體類型與主機板不一致。",
    messageEn: matches
      ? "Memory type matches the motherboard."
      : "Memory type does not match the motherboard.",
    evidence: [
      {
        labelZhHant: "記憶體類型",
        labelEn: "Memory type",
        actual: memoryType,
        expected: boardMemoryType,
      },
    ],
  });
}

function evaluateMotherboardFormFactor(
  selected: Map<ComponentCategory, CatalogPart>,
): CompatibilityFinding {
  const prepared = preparePair(
    selected,
    "motherboard_form_factor",
    ["motherboard", "case"],
    [
      ["motherboard", "formFactor"],
      ["case", "supportedMotherboardFormFactors"],
    ],
  );
  if ("finding" in prepared) {
    return prepared.finding;
  }
  const boardFormFactor = stringSpecification(prepared.first, "formFactor")!;
  const caseSupport = stringSpecification(
    prepared.second,
    "supportedMotherboardFormFactors",
  )!;
  const supported = caseSupport.split(/[,/|]/u).map(normalized).filter(Boolean);
  const matches = supported.includes(normalized(boardFormFactor));
  return compatibilityFinding({
    ruleId: "motherboard_form_factor",
    severity: matches ? "pass" : "error",
    categories: ["motherboard", "case"],
    messageZhHant: matches
      ? "機箱支援所選主機板尺寸。"
      : "機箱不支援所選主機板尺寸。",
    messageEn: matches
      ? "The case supports the selected motherboard form factor."
      : "The case does not support the selected motherboard form factor.",
    evidence: [
      {
        labelZhHant: "主機板尺寸",
        labelEn: "Motherboard form factor",
        actual: boardFormFactor,
        expected: caseSupport,
      },
    ],
  });
}

function evaluateNumericLimit(
  selected: Map<ComponentCategory, CatalogPart>,
  options: {
    ruleId: "gpu_clearance" | "cooler_clearance" | "gpu_psu_recommendation";
    categories: [ComponentCategory, ComponentCategory];
    actualKey: string;
    expectedKey: string;
    actualLabelZhHant: string;
    actualLabelEn: string;
    passZhHant: string;
    passEn: string;
    failZhHant: string;
    failEn: string;
    comparison: "lte" | "gte";
    failureSeverity: "error" | "warning";
  },
): CompatibilityFinding {
  const prepared = preparePair(selected, options.ruleId, options.categories, [
    [options.categories[0], options.actualKey],
    [options.categories[1], options.expectedKey],
  ]);
  if ("finding" in prepared) {
    return prepared.finding;
  }
  const actual = numberSpecification(prepared.first, options.actualKey);
  const expected = numberSpecification(prepared.second, options.expectedKey);
  if (actual === null || expected === null || actual <= 0 || expected <= 0) {
    return unknownRule(
      options.ruleId,
      options.categories,
      "此規則需要正數數值規格。",
      "This rule requires positive numeric specifications.",
    );
  }
  const matches =
    options.comparison === "lte" ? actual <= expected : actual >= expected;
  return compatibilityFinding({
    ruleId: options.ruleId,
    severity: matches ? "pass" : options.failureSeverity,
    categories: options.categories,
    messageZhHant: matches ? options.passZhHant : options.failZhHant,
    messageEn: matches ? options.passEn : options.failEn,
    evidence: [
      {
        labelZhHant: options.actualLabelZhHant,
        labelEn: options.actualLabelEn,
        actual: String(actual),
        expected: String(expected),
      },
    ],
  });
}

export function evaluateBuildCompatibility(
  parts: CatalogPart[],
): CompatibilityFinding[] {
  const selected = new Map(parts.map((part) => [part.category, part]));
  const findings: CompatibilityFinding[] = [
    evaluateCpuSocket(selected),
    evaluateMemoryType(selected),
    evaluateMotherboardFormFactor(selected),
    evaluateNumericLimit(selected, {
      ruleId: "gpu_clearance",
      categories: ["gpu", "case"],
      actualKey: "lengthMm",
      expectedKey: "maxGpuLengthMm",
      actualLabelZhHant: "顯示卡長度／機箱淨空（毫米）",
      actualLabelEn: "GPU length / case clearance (mm)",
      passZhHant: "顯示卡長度在機箱淨空範圍內。",
      passEn: "GPU length is within the case clearance.",
      failZhHant: "顯示卡長度超出機箱淨空。",
      failEn: "GPU length exceeds the case clearance.",
      comparison: "lte",
      failureSeverity: "error",
    }),
    evaluateNumericLimit(selected, {
      ruleId: "cooler_clearance",
      categories: ["cooling", "case"],
      actualKey: "coolerHeightMm",
      expectedKey: "maxCoolerHeightMm",
      actualLabelZhHant: "散熱器高度／機箱淨空（毫米）",
      actualLabelEn: "Cooler height / case clearance (mm)",
      passZhHant: "散熱器高度在機箱淨空範圍內。",
      passEn: "Cooler height is within the case clearance.",
      failZhHant: "散熱器高度超出機箱淨空。",
      failEn: "Cooler height exceeds the case clearance.",
      comparison: "lte",
      failureSeverity: "error",
    }),
    evaluateNumericLimit(selected, {
      ruleId: "gpu_psu_recommendation",
      categories: ["psu", "gpu"],
      actualKey: "capacityWatts",
      expectedKey: "recommendedPsuWatts",
      actualLabelZhHant: "電源容量／顯示卡建議（瓦）",
      actualLabelEn: "PSU capacity / GPU recommendation (W)",
      passZhHant: "電源容量符合顯示卡的已記錄建議。",
      passEn: "PSU capacity meets the recorded GPU recommendation.",
      failZhHant: "電源容量低於顯示卡的已記錄建議。",
      failEn: "PSU capacity is below the recorded GPU recommendation.",
      comparison: "gte",
      failureSeverity: "warning",
    }),
  ];

  for (const part of parts) {
    if (part.stockStatus === "out_of_stock") {
      findings.push(
        compatibilityFinding({
          ruleId: "component_availability",
          severity: "warning",
          categories: [part.category],
          messageZhHant: `${part.manufacturer} ${part.model} 目前記錄為缺貨。`,
          messageEn: `${part.manufacturer} ${part.model} is currently recorded as out of stock.`,
          evidence: [],
        }),
      );
    }
    if (part.catalogueStatus === "archived") {
      findings.push(
        compatibilityFinding({
          ruleId: "component_archived",
          severity: "warning",
          categories: [part.category],
          messageZhHant: `${part.manufacturer} ${part.model} 已從現行目錄封存。`,
          messageEn: `${part.manufacturer} ${part.model} is archived from the active catalogue.`,
          evidence: [],
        }),
      );
    }
  }

  return findings;
}

export function summarizeCompatibility(
  findings: CompatibilityFinding[],
): BuildCompatibilitySummary {
  return buildCompatibilitySummarySchema.parse({
    passCount: findings.filter((finding) => finding.severity === "pass").length,
    warningCount: findings.filter((finding) => finding.severity === "warning")
      .length,
    errorCount: findings.filter((finding) => finding.severity === "error")
      .length,
    unknownCount: findings.filter((finding) => finding.severity === "unknown")
      .length,
  });
}

export function composeBuildRecord(input: {
  id: string;
  name: string;
  status: "draft" | "archived";
  selectedParts: CatalogPart[];
  version: number;
  updatedAt: string;
}): BuildRecord {
  const selectedParts = [...input.selectedParts].sort(
    (left, right) =>
      categoryOrder.indexOf(left.category) -
      categoryOrder.indexOf(right.category),
  );
  const findings = evaluateBuildCompatibility(selectedParts);
  return buildRecordSchema.parse({
    ...input,
    selectedParts,
    findings,
    summary: summarizeCompatibility(findings),
    totalPriceMinor: selectedParts.reduce(
      (total, part) => total + part.priceMinor,
      0,
    ),
  });
}

export function isBuildExportReady(build: BuildRecord): boolean {
  return build.summary.errorCount === 0 && build.summary.unknownCount === 0;
}

export function portableBuildExport(build: BuildRecord) {
  return {
    schemaVersion: 1,
    product: "RigStage",
    build: {
      name: build.name,
      version: build.version,
      components: build.selectedParts.map((part) => ({
        category: part.category,
        sku: part.sku,
        manufacturer: part.manufacturer,
        model: part.model,
        specificationStatus: part.specificationStatus,
        specifications:
          part.specificationStatus === "verified" ? part.specifications : {},
      })),
      compatibility: {
        summary: build.summary,
        findings: build.findings.map((finding) => ({
          ruleId: finding.ruleId,
          severity: finding.severity,
          messageZhHant: finding.messageZhHant,
          messageEn: finding.messageEn,
          evidence: finding.evidence,
        })),
      },
    },
    dataBoundary: {
      zhHant:
        "此檔案不包含使用者、工作空間、價格、庫存、私人素材或部署資料；相容性只來自已核實的結構化規格。",
      en: "This file excludes user, workspace, pricing, stock, private asset, and deployment data. Compatibility uses verified structured specifications only.",
    },
  };
}
