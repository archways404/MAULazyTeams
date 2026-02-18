export const DEFAULT_SETTINGS = {
  useRemote: true,
  remoteBaseUrl: "https://mlt.k14net.org",
  localBaseUrl: "http://localhost:4007",
  apiKey: ""
};

export async function getSettings() {
  const s = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...s };
}

export function getBaseUrl(settings) {
  const base = settings.useRemote ? settings.remoteBaseUrl : settings.localBaseUrl;
  return String(base || "").replace(/\/+$/, ""); // trim trailing slashes
}