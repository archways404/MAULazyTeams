import { esc, spinnerCss } from "./styles.js";

export function renderHeader({ locked }) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${
          locked
            ? `<div style="${spinnerCss(14)}"></div>`
            : `<div style="width:10px;height:10px;border-radius:999px;background:rgba(120,255,160,.85);box-shadow:0 0 18px rgba(120,255,160,.20);"></div>`
        }
        <div>
          <div style="font-weight:950;font-size:14px;line-height:1;">MAULazyTeams</div>
          <div style="font-size:11px;opacity:.72;margin-top:4px;">
            ${locked ? "Running" : "Ready"}
          </div>
        </div>
      </div>

      <button id="mh-close" title="Close"
        style="background:transparent;border:none;color:#fff;font-size:18px;cursor:${locked ? "not-allowed" : "pointer"};opacity:${locked ? ".28" : ".85"};padding:4px 8px;">
        ✕
      </button>
    </div>
  `;
}

export function renderFormView({ now, lastStatus }) {
  const cssInput = `
    width:100%;
    padding:10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06);
    color:#fff;
    outline:none;
    line-height: 1.2;
  `;
  const cssLabel = `font-size:12px;opacity:.82;margin-bottom:7px;`;
  const cssGrid2 = `display:grid;grid-template-columns: 1fr 1fr;gap: 12px;align-items: start;`;
  const cssBtnPrimary = `
    width:100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(90,120,255,.38);
    background: rgba(90,120,255,.20);
    color:#fff;
    cursor:pointer;
    font-weight: 950;
    letter-spacing: .2px;
    font-size: 13px;
  `;

  return `
    <div id="mh-form" style="margin-top:14px;">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <div style="${cssLabel}">MAU ID / Email</div>
          <input id="mh-user" placeholder="ab1234" autocomplete="username" inputmode="email"
            style="${cssInput}" />
          <div style="margin-top:6px;font-size:11px;opacity:.62;">
            We append <b>@mau.se</b> automatically.
          </div>
        </div>

        <div style="${cssGrid2}">
          <div>
            <div style="${cssLabel}">Year</div>
            <input id="mh-year" type="number" min="2000" max="2100" value="${now.year}"
              style="${cssInput}" />
          </div>

          <div>
            <div style="${cssLabel}">Month</div>
            <input id="mh-month" type="number" min="1" max="12" value="${now.month}"
              style="${cssInput}" />
          </div>
        </div>

        <button id="mh-start" style="${cssBtnPrimary}">Fetch + Start</button>

        <div id="mh-status" style="font-size:12px;opacity:.85;white-space:pre-wrap;min-height:18px;">
          ${esc(lastStatus || "")}
        </div>
      </div>
    </div>
  `;
}

export function renderStatusView({ lastStatus, logOpen, logLines }) {
  return `
    <div id="mh-status-only" style="margin-top:14px;">
      <div style="padding:12px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="${spinnerCss(16)};margin-top:2px;"></div>
          <div style="flex:1;">
            <div style="font-size:12px;opacity:.72;">Status</div>
            <div id="mh-status" style="margin-top:6px;font-size:14px;font-weight:950;white-space:pre-wrap;">
              ${esc(lastStatus || "Working")}
            </div>
          </div>
        </div>
      </div>

      <button id="mh-log-toggle"
        style="margin-top:10px;width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;cursor:pointer;font-weight:900;font-size:12px;opacity:.95;">
        ${logOpen ? "Hide details" : "Show details"}
      </button>

      ${
        logOpen
          ? `<div id="mh-log"
              style="margin-top:10px;font-size:11px;opacity:.72;white-space:pre-wrap;max-height:180px;overflow:auto;border-radius:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.18);">
${esc(logLines.length ? logLines.map((l) => `• ${l}`).join("\n") : "• Waiting for updates")}
            </div>`
          : ""
      }
    </div>
  `;
}

export function renderSuccessView() {
  return `
    <div id="mh-success" style="margin-top:14px;">
      <div style="padding:14px 14px;border-radius:16px;border:1px solid rgba(120,255,160,.22);background:rgba(120,255,160,.08);">
        <div style="font-size:12px;opacity:.8;">Success</div>
        <div style="margin-top:6px;font-size:16px;font-weight:1000;">Done</div>
        <div style="margin-top:6px;font-size:12px;opacity:.75;">Closing in 4 seconds</div>
      </div>
    </div>
  `;
}

export function renderErrorView({ lastStatus }) {
  return `
    <div id="mh-error" style="margin-top:14px;">
      <div style="padding:14px 14px;border-radius:16px;border:1px solid rgba(255,110,110,.20);background:rgba(255,110,110,.08);">
        <div style="font-size:12px;opacity:.85;">Error</div>
        <div id="mh-status" style="margin-top:8px;font-size:13px;font-weight:950;white-space:pre-wrap;">
          ${esc(lastStatus || "Something went wrong")}
        </div>
        <div style="margin-top:10px;font-size:11px;opacity:.70;">
          Check console for details. You can close and retry.
        </div>
      </div>
    </div>
  `;
}
