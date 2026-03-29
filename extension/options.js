const DEFAULT_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", async () => {
  const { apiBaseUrl } = await chrome.storage.sync.get({ apiBaseUrl: DEFAULT_BASE });
  document.getElementById("apiBaseUrl").value = apiBaseUrl;
});

document.getElementById("save").addEventListener("click", async () => {
  let v = document.getElementById("apiBaseUrl").value.trim().replace(/\/$/, "");
  if (!v) v = DEFAULT_BASE;
  await chrome.storage.sync.set({ apiBaseUrl: v });
  const status = document.getElementById("status");
  status.textContent = "Saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
});
