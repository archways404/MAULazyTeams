document.getElementById("sendBtn").addEventListener("click", async () => {
	const text = document.getElementById("messageInput").value;

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

	chrome.tabs.sendMessage(tab.id, {
		type: "SHOW_ALERT",
		payload: text,
	});

	document.getElementById("status").innerText = "Sent to page!";
});
