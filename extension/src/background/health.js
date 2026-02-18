import { getSettings, getBaseUrl } from "../shared/settings.js";
import { fetchJson } from "../shared/http.js";

export async function healthCheck() {
  const settings = await getSettings();
  const baseUrl = String(getBaseUrl(settings) || "").replace(/\/+$/, "");
  if (!baseUrl) return { ok: false, baseUrl: "", message: "No baseUrl configured" };

  try {
    const { res, data } = await fetchJson(`${baseUrl}/health`, { timeoutMs: 2500 });

    if (!res.ok) return { ok: false, baseUrl, message: `HTTP ${res.status}` };
    if (!data?.ok) return { ok: false, baseUrl, message: data?.message || "Service not ready" };

    return { ok: true, baseUrl, message: "Service ready", data };
  } catch (e) {
    const m = e?.name === "AbortError" ? "Health check timeout" : "Health check failed";
    return { ok: false, baseUrl, message: m };
  }
}
