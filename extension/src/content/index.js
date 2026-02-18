import { ensureModalSystem, setupInjectButton, uiApi } from "./ui/modal.js";
import { bootAutomationIfNeeded, runAutomationIfPlanned, savePlanAndReset } from "./primula/runner.js";
import { onMauStart } from "./messaging.js";

if (window.top === window) {
  ensureModalSystem();
  setupInjectButton();
  bootAutomationIfNeeded(uiApi);

  onMauStart((plan) => {
    savePlanAndReset(plan);
    uiApi.ensureModal();
    uiApi.setUiMode("status");
    uiApi.openModal();
    uiApi.status("running", "Plan received. Starting");
    runAutomationIfPlanned(uiApi);
  });

  const obs = new MutationObserver(() => setupInjectButton());
  obs.observe(document.documentElement, { childList: true, subtree: true });
}
