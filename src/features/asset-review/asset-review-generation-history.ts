import type { GenerationJob } from "../../shared/domain/generation-jobs";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const generationHistoryLimit = 20;

export const generationHistoryCopy = {
  heading: bilingualCopy("最近生成工作", "Recent generation jobs"),
  description: bilingualCopy(
    "只顯示目前素材最多 20 項中立狀態；不顯示工作 ID、供應商或私人物件資料。",
    "Shows up to 20 neutral states for this asset. No job ID, provider or private object data is shown.",
  ),
  empty: bilingualCopy("尚未有生成工作記錄", "No generation job history yet"),
  latest: bilingualCopy("最新", "Latest"),
  updated: bilingualCopy("更新時間", "Updated"),
  invalidTime: bilingualCopy("時間資料無效", "Invalid timestamp"),
} as const satisfies Record<string, BilingualCopy>;

export function assetReviewGenerationHistoryForAsset(
  items: readonly GenerationJob[],
  assetId: string,
): GenerationJob[] {
  return items
    .filter((item) => item.assetId === assetId)
    .slice(0, generationHistoryLimit);
}

export function assetReviewGenerationHistoryCountCopy(
  count: number,
): BilingualCopy {
  const safeCount = Math.max(0, Math.trunc(count));
  return bilingualCopy(
    `顯示 ${safeCount} 項`,
    `Showing ${safeCount} ${safeCount === 1 ? "job" : "jobs"}`,
  );
}

export function assetReviewGenerationTime(value: string): {
  copy: BilingualCopy;
  dateTime: string | null;
} {
  const d1 = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u.exec(
      value,
    );
  const match = d1 ?? iso;
  if (!match) {
    return { copy: generationHistoryCopy.invalidTime, dateTime: null };
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number((iso?.[7] ?? "").padEnd(3, "0") || "0");
  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  if (year >= 0 && year < 100) {
    date.setUTCFullYear(year);
  }
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    return { copy: generationHistoryCopy.invalidTime, dateTime: null };
  }
  return {
    copy: bilingualCopy(
      new Intl.DateTimeFormat("zh-HK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Hong_Kong",
      }).format(date),
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Hong_Kong",
      }).format(date),
    ),
    dateTime: date.toISOString(),
  };
}
