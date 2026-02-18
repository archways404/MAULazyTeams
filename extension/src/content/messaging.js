import { MSG } from "../shared/constants.js";

export function checkHealth() {
  return chrome.runtime.sendMessage({ type: MSG.HEALTH_CHECK });
}

export function startFromPage(payload, cb) {
  chrome.runtime.sendMessage({ type: MSG.START_FROM_PAGE, payload }, cb);
}

export function notifyProgress(payload) {
  chrome.runtime.sendMessage({ type: MSG.RUN_PROGRESS, payload }).catch(() => {});
}

export function onMauStart(handler) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === MSG.MAU_START) handler(msg.payload);
  });
}
