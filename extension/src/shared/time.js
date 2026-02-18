import { TZ } from "./constants.js";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function getStockholmYearMonthNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

export function normalizeUserToEmail(input, domain = "@mau.se") {
  const raw = String(input ?? "").trim();
  if (!raw) return { email: "", displayValue: "", storeValue: "" };

  if (raw.includes("@")) {
    const email = raw;
    return { email, displayValue: email, storeValue: email };
  }

  const email = `${raw}${domain}`;
  return { email, displayValue: email, storeValue: raw };
}
