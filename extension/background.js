console.log("Background service worker started");

// Example: listen for extension install
chrome.runtime.onInstalled.addListener(() => {
	console.log("Extension installed!");
});

// Example: store some data
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "SAVE_VALUE") {
		chrome.storage.local.set({ saved: message.payload });
		sendResponse({ ok: true });
	}

	if (message.type === "GET_VALUE") {
		chrome.storage.local.get("saved", (data) => {
			sendResponse({ value: data.saved });
		});

		return true; // async response
	}
});
