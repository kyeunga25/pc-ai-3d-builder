export const APP_LOCALE = "zh-Hant-HK";

export type BilingualMessage = {
  english: string;
  zhHant: string;
};

const bilingualMessageSeparator = " / ";
const traditionalChinesePattern = /[\u3400-\u9fff]/u;
const englishPattern = /[A-Za-z]/u;

const hkdFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "HKD",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
});

export function formatHkd(priceMinor: number): string {
  return hkdFormatter.format(priceMinor / 100);
}

export function splitBilingualMessage(
  message: string,
  fallbackEnglish: string,
  fallbackZhHant?: string,
): BilingualMessage {
  const normalizedMessage = message.trim();
  const fallback = {
    zhHant: fallbackZhHant ?? normalizedMessage,
    english: fallbackEnglish,
  };
  const separatorIndex = normalizedMessage.indexOf(bilingualMessageSeparator);
  if (separatorIndex < 0) {
    return fallback;
  }

  const zhHant = normalizedMessage.slice(0, separatorIndex).trim();
  const english = normalizedMessage
    .slice(separatorIndex + bilingualMessageSeparator.length)
    .trim();
  if (
    !traditionalChinesePattern.test(zhHant) ||
    !englishPattern.test(english)
  ) {
    return fallback;
  }

  return { zhHant, english };
}
