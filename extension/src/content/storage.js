export const SKEY = {
  PLAN: "__MAU_PLAN__",
  DONE: "__MAU_FORM_DONE__",
  READY_SENT: "__MAU_READY_SENT__",
  PHASE: "__MAU_PHASE__",
  CLICKS_DONE: "__MAU_CLICKS_DONE__",
  TARGET_CLICKS: "__MAU_TARGET_CLICKS__",
  LOCK: "__MAU_LOCK__",
  UI_MODE: "__MAU_UI_MODE__",
  STATUS_LINE: "__MAU_STATUS_LINE__",
  STATUS_LOG: "__MAU_STATUS_LOG__",
  LOG_OPEN: "__MAU_LOG_OPEN__",
};

export const LKEY = {
  LAST_USER: "mauhelper:lastUser",
};

export function ssGet(k, fallback = "") {
  return sessionStorage.getItem(k) ?? fallback;
}
export function ssSet(k, v) {
  sessionStorage.setItem(k, String(v));
}
export function ssDel(k) {
  sessionStorage.removeItem(k);
}

export function loadJson(k, fallback = null) {
  try {
    const raw = sessionStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(k, value) {
  sessionStorage.setItem(k, JSON.stringify(value));
}

export function appendLog(line, { max = 60 } = {}) {
  try {
    const raw = sessionStorage.getItem(SKEY.STATUS_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ t: Date.now(), line: String(line ?? "") });
    sessionStorage.setItem(SKEY.STATUS_LOG, JSON.stringify(arr.slice(-max)));
  } catch {}
}

export function getLogLines() {
  try {
    const raw = sessionStorage.getItem(SKEY.STATUS_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((x) => x.line);
  } catch {
    return [];
  }
}
