export type DashboardBilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

function bilingualCopy(
  zhHant: string,
  english: string,
): DashboardBilingualCopy {
  return { english, zhHant };
}

function englishUnit(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"} ago`;
}

export function relativeDashboardUpdateCopy(
  value: string,
  now = Date.now(),
): DashboardBilingualCopy {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return bilingualCopy("最近更新", "Recently updated");
  }

  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) {
    return bilingualCopy("剛剛", "Just now");
  }
  if (minutes < 60) {
    return bilingualCopy(`${minutes} 分鐘前`, englishUnit(minutes, "minute"));
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return bilingualCopy(`${hours} 小時前`, englishUnit(hours, "hour"));
  }

  const days = Math.floor(hours / 24);
  return days <= 7
    ? bilingualCopy(`${days} 日前`, englishUnit(days, "day"))
    : bilingualCopy("較早更新", "Earlier update");
}
