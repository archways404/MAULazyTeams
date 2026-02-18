import { checkHealth } from "./messaging.js";

let intervalId = null;
let inFlight = false;

export function stopHealthPolling() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

export async function startHealthPolling(ui) {
  stopHealthPolling();
  await updateHealthUiOnce(ui);
  intervalId = setInterval(() => updateHealthUiOnce(ui), 5000);
}

export async function updateHealthUiOnce(ui) {
  if (!ui?.isFormMode?.()) return;
  if (inFlight) return;

  inFlight = true;
  try {
    ui?.setStartEnabled?.(false, "Fetching credentials / checking service...");
    const h = await checkHealth();
    const msg = h?.message || h?.error || "Health check failed";
    ui?.setStartEnabled?.(!!h?.ok, `${msg} (${h?.baseUrl || "unknown"})`);
  } finally {
    inFlight = false;
  }
}

/** optional: call once in content init */
export function hookSettingsChanged(ui) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!ui?.isFormMode?.()) return;
    updateHealthUiOnce(ui).catch(() => {});
  });
}
