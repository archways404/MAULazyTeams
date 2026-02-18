export function ensureStyles() {
  if (document.getElementById("mauhelper-style")) return;
  const style = document.createElement("style");
  style.id = "mauhelper-style";
  style.textContent = `
    #mauhelper-modal, #mauhelper-modal * { box-sizing: border-box; }
    @keyframes mhspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

export function spinnerCss(size = 14) {
  return `
    width:${size}px;height:${size}px;
    border-radius:999px;
    border:2px solid rgba(255,255,255,.18);
    border-top-color: rgba(255,255,255,.85);
    animation: mhspin 0.8s linear infinite;
  `;
}

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
