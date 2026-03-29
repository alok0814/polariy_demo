const DEFAULT_BASE = "http://localhost:3000";

function relColor(pct) {
  if (pct >= 71) return "#22c55e";
  if (pct >= 41) return "#ea580c";
  return "#dc2626";
}

document.getElementById("opts").addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
});

document.getElementById("analyze").addEventListener("click", async () => {
  const btn = document.getElementById("analyze");
  const errEl = document.getElementById("error");
  const results = document.getElementById("results");
  const outletEl = document.getElementById("outlet");
  errEl.style.display = "none";
  results.style.display = "none";
  outletEl.style.display = "none";
  btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("Open a normal http(s) page first.");
    }

    const { apiBaseUrl } = await chrome.storage.sync.get({ apiBaseUrl: DEFAULT_BASE });
    const base = (apiBaseUrl || DEFAULT_BASE).replace(/\/$/, "");

    const res = await fetch(`${base}/api/extension-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || res.statusText || "Request failed");
    }

    const rel = typeof data.reliability === "number" ? data.reliability : 0;
    const bias = data.biasCategory ?? "—";
    const conf = typeof data.confidence === "number" ? data.confidence : null;

    document.getElementById("relValue").textContent = `${rel} / 100`;
    const relBar = document.getElementById("relBar");
    relBar.style.width = `${Math.min(100, Math.max(0, rel))}%`;
    relBar.style.background = relColor(rel);

    document.getElementById("biasValue").textContent = bias;
    document.getElementById("conf").textContent =
      conf != null ? `Confidence: ${conf}%` : "";

    if (data.outletBaseline?.name) {
      outletEl.textContent = `Chart match: ${data.outletBaseline.name}`;
      outletEl.style.display = "block";
    }

    results.style.display = "block";
  } catch (e) {
    errEl.textContent = e instanceof Error ? e.message : String(e);
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
  }
});
