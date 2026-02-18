export function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

export function onRuntimeMessage(handler) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    Promise.resolve(handler(msg, sender))
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  });
}
