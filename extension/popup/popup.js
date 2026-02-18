import { DEFAULT_SETTINGS } from "../functions/settings.js";

const apiKeyInput = document.getElementById("apiKey");
const remoteToggle = document.getElementById("remoteToggle");
const remoteUrlInput = document.getElementById("remoteUrl");
const localUrlInput = document.getElementById("localUrl");
const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");

document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const s = { ...DEFAULT_SETTINGS, ...data };

  apiKeyInput.value = s.apiKey || "";
  remoteToggle.checked = !!s.useRemote;
  remoteUrlInput.value = s.remoteBaseUrl;
  localUrlInput.value = s.localBaseUrl;
});

saveBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    useRemote: remoteToggle.checked,
    remoteBaseUrl: remoteUrlInput.value.trim(),
    localBaseUrl: localUrlInput.value.trim(),
  });

  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 2000);
});