export const APP_LOCALE = "zh-Hant-HK";

const hkdFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "HKD",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
});

export function formatHkd(priceMinor: number): string {
  return hkdFormatter.format(priceMinor / 100);
}
