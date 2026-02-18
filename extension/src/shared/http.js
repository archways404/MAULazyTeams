export async function fetchJson(url, {
  method = "GET",
  headers = {},
  body,
  timeoutMs = 8000,
  signal,
  ...rest
} = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: signal ?? ctrl.signal,
      cache: "no-store",
      ...rest,
    });

    const ct = res.headers.get("content-type") || "";
    let data = null;

    if (ct.includes("application/json")) data = await res.json().catch(() => null);
    else data = { message: (await res.text().catch(() => "")).slice(0, 200) };

    return { res, data };
  } finally {
    clearTimeout(t);
  }
}
