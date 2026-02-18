import { DEFAULT_SETTINGS } from "../src/shared/settings.js";

function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Popup missing #${id}`);
  return el;
}

function trimUrl(v) {
  return String(v || "").trim().replace(/\/+$/, "");
}

function isValidHttpUrl(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function setStatus(el, msg, ok = true) {
  el.textContent = msg || "";
  el.style.color = ok ? "rgba(255,255,255,.70)" : "rgba(255,110,110,.85)";
}

function setActiveStyles({ useRemote, remoteEl, localEl, badgeEl }) {
  const remoteActive = !!useRemote;

  remoteEl.classList.toggle("active", remoteActive);
  remoteEl.classList.toggle("inactive", !remoteActive);

  localEl.classList.toggle("active", !remoteActive);
  localEl.classList.toggle("inactive", remoteActive);

  badgeEl.textContent = remoteActive ? "REMOTE" : "LOCAL";
  badgeEl.classList.toggle("remote", remoteActive);
  badgeEl.classList.toggle("local", !remoteActive);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const apiKeyInput = must("apiKey");
    const remoteToggle = must("remoteToggle");
    const remoteUrlInput = must("remoteUrl");
    const localUrlInput = must("localUrl");
    const saveBtn = must("saveBtn");
    const status = must("status");
    const versionLine = must("versionLine");
    const modeBadge = must("modeBadge");

    // version from manifest (dynamic)
    const manifest = chrome?.runtime?.getManifest?.();
    const version = manifest?.version || "0.0.0";
    versionLine.textContent = `v${version}`;

    // load settings
    const data = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    const s = { ...DEFAULT_SETTINGS, ...data };

    apiKeyInput.value = s.apiKey || "";
    remoteToggle.checked = !!s.useRemote;
    remoteUrlInput.value = s.remoteBaseUrl || "";
    localUrlInput.value = s.localBaseUrl || "";

    // apply active styling
    setActiveStyles({
      useRemote: remoteToggle.checked,
      remoteEl: remoteUrlInput,
      localEl: localUrlInput,
      badgeEl: modeBadge,
    });

    // live styling when toggled
    remoteToggle.addEventListener("change", () => {
      setActiveStyles({
        useRemote: remoteToggle.checked,
        remoteEl: remoteUrlInput,
        localEl: localUrlInput,
        badgeEl: modeBadge,
      });
      setStatus(status, "");
    });

    // light validation as user types
    function validateUrls() {
      const r = trimUrl(remoteUrlInput.value);
      const l = trimUrl(localUrlInput.value);

      // only mark invalid if non-empty but malformed
      remoteUrlInput.classList.toggle("invalid", r && !isValidHttpUrl(r));
      localUrlInput.classList.toggle("invalid", l && !isValidHttpUrl(l));
    }
    remoteUrlInput.addEventListener("input", validateUrls);
    localUrlInput.addEventListener("input", validateUrls);
    validateUrls();

    // save
    saveBtn.addEventListener("click", async () => {
      const remoteBaseUrl = trimUrl(remoteUrlInput.value);
      const localBaseUrl = trimUrl(localUrlInput.value);

      // If user tries to save an invalid URL, block and show message
      if (remoteBaseUrl && !isValidHttpUrl(remoteBaseUrl)) {
        setStatus(status, "Remote URL is not a valid http(s) URL.", false);
        remoteUrlInput.focus();
        return;
      }
      if (localBaseUrl && !isValidHttpUrl(localBaseUrl)) {
        setStatus(status, "Local URL is not a valid http(s) URL.", false);
        localUrlInput.focus();
        return;
      }

      await chrome.storage.local.set({
        apiKey: String(apiKeyInput.value || "").trim(),
        useRemote: !!remoteToggle.checked,
        remoteBaseUrl,
        localBaseUrl,
      });

      setStatus(status, "Saved ✓", true);
      setTimeout(() => setStatus(status, ""), 2000);
    });

    console.log("[MAULazyTeams popup] ready");
  } catch (e) {
    console.error("[MAULazyTeams popup] init failed:", e);
  }
});
