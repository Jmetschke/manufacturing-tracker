// Shared PWA install behavior for the internal Production Tracker.
// Browsers decide whether a site may trigger a native install prompt. Chrome
// and Android often allow it; iPhone/iPad Safari requires the user to use
// Share > Add to Home Screen, so this helper shows device-specific steps.
let productionTrackerInstallPrompt = null;
const productionTrackerBuildStorageKey = "productionTracker.activeBuild";
const productionTrackerReloadFlagKey = "productionTracker.reloadedBuild";
const productionTrackerNavGroupStorageKey = "productionTracker.navRegion";
const productionTrackerUpdateQueryParam = "_app_update";
let productionTrackerVersionCheckInFlight = false;

function isProductionTrackerStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function isProductionTrackerIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isProductionTrackerSafari() {
  const ua = window.navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

function setProductionTrackerNavRegion(region) {
  const selectedRegion = region === "ny" ? "ny" : "il";
  localStorage.setItem(productionTrackerNavGroupStorageKey, selectedRegion);

  document.querySelectorAll("[data-nav-region]").forEach(button => {
    const isActive = button.dataset.navRegion === selectedRegion;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-nav-group]").forEach(group => {
    group.hidden = group.dataset.navGroup !== selectedRegion;
  });
}

function initProductionTrackerNavGroups() {
  if (!document.querySelector("[data-nav-region]")) return;

  const storedRegion = localStorage.getItem(productionTrackerNavGroupStorageKey);
  setProductionTrackerNavRegion(storedRegion === "ny" ? "ny" : "il");

  document.querySelectorAll("[data-nav-region]").forEach(button => {
    button.addEventListener("click", () => {
      setProductionTrackerNavRegion(button.dataset.navRegion);
    });
  });
}

function ensureProductionTrackerInstallStyles() {
  if (document.getElementById("productionTrackerInstallStyles")) return;

  const style = document.createElement("style");
  style.id = "productionTrackerInstallStyles";
  style.textContent = `
    .pwa-install-modal {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(32, 33, 36, 0.55);
      padding: 16px;
    }

    .pwa-install-modal[hidden] {
      display: none;
    }

    .pwa-install-dialog {
      width: min(520px, 100%);
      max-height: calc(100vh - 32px);
      overflow: auto;
      border: 1px solid #c9c9c2;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
      color: #202124;
      padding: 18px;
    }

    .pwa-install-header {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }

    .pwa-install-header img {
      width: 58px;
      height: 58px;
      border-radius: 14px;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
    }

    .pwa-install-header h3 {
      margin: 0 0 4px;
    }

    .pwa-install-header p {
      margin: 0;
      color: #555;
      line-height: 1.35;
    }

    .pwa-install-steps {
      margin: 12px 0;
      padding-left: 22px;
      line-height: 1.45;
    }

    .pwa-install-steps li {
      margin-bottom: 8px;
    }

    .pwa-install-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
    }

    .pwa-install-actions button {
      margin: 0;
    }

    .pwa-install-primary {
      border: 1px solid #2364aa;
      background: #2364aa;
      color: #fff;
    }

    @media (max-width: 640px) {
      .pwa-install-modal {
        align-items: flex-end;
        padding: 10px;
      }

      .pwa-install-dialog {
        max-height: calc(100vh - 20px);
        padding: 16px;
      }

      .pwa-install-actions {
        display: grid;
      }

      .pwa-install-actions button {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function getProductionTrackerInstallSteps() {
  if (productionTrackerInstallPrompt) {
    return [
      "Tap Install App below.",
      "Confirm the browser install prompt.",
      "Open Tracker from the new home-screen or app-list icon."
    ];
  }

  if (isProductionTrackerIOS()) {
    return [
      "Open this page in Safari.",
      "Tap the Share button in Safari.",
      "Scroll if needed and tap Add to Home Screen.",
      "Tap Add. The Tracker icon will appear on your home screen."
    ];
  }

  if (isProductionTrackerSafari()) {
    return [
      "Open this page in Safari.",
      "Use File > Add to Dock if available, or use your browser's sharing/install option.",
      "Open Tracker from the new icon."
    ];
  }

  return [
    "Open the browser menu.",
    "Choose Install app, Add to Home screen, or Create shortcut.",
    "Open Tracker from the new icon."
  ];
}

function closeProductionTrackerInstallModal() {
  const modal = document.getElementById("productionTrackerInstallModal");
  if (modal) modal.hidden = true;
}

function createProductionTrackerInstallModal() {
  let modal = document.getElementById("productionTrackerInstallModal");
  if (modal) return modal;

  ensureProductionTrackerInstallStyles();

  modal = document.createElement("section");
  modal.id = "productionTrackerInstallModal";
  modal.className = "pwa-install-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="productionTrackerInstallTitle">
      <div class="pwa-install-header">
        <img src="/icons/icon-192.png" alt="">
        <div>
          <h3 id="productionTrackerInstallTitle">Install Production Tracker</h3>
          <p>Add an app icon that opens directly to this internal tracker.</p>
        </div>
      </div>
      <ol id="productionTrackerInstallSteps" class="pwa-install-steps"></ol>
      <div class="pwa-install-actions">
        <button id="productionTrackerNativeInstall" class="pwa-install-primary" type="button">Install App</button>
        <button id="productionTrackerInstallClose" type="button">Close</button>
      </div>
    </div>
  `;

  modal.addEventListener("click", event => {
    if (event.target === modal) closeProductionTrackerInstallModal();
  });

  modal.querySelector("#productionTrackerInstallClose").addEventListener("click", closeProductionTrackerInstallModal);
  modal.querySelector("#productionTrackerNativeInstall").addEventListener("click", promptProductionTrackerInstall);
  document.body.appendChild(modal);
  return modal;
}

function showProductionTrackerInstallModal() {
  const modal = createProductionTrackerInstallModal();
  const steps = modal.querySelector("#productionTrackerInstallSteps");
  const nativeButton = modal.querySelector("#productionTrackerNativeInstall");

  steps.innerHTML = "";
  getProductionTrackerInstallSteps().forEach(step => {
    const item = document.createElement("li");
    item.textContent = step;
    steps.appendChild(item);
  });

  nativeButton.hidden = !productionTrackerInstallPrompt;
  modal.hidden = false;
  modal.querySelector("#productionTrackerInstallClose").focus();
}

async function promptProductionTrackerInstall() {
  if (isProductionTrackerStandalone()) return;

  if (!productionTrackerInstallPrompt) {
    showProductionTrackerInstallModal();
    return;
  }

  const promptEvent = productionTrackerInstallPrompt;
  productionTrackerInstallPrompt = null;
  closeProductionTrackerInstallModal();
  promptEvent.prompt();
  await promptEvent.userChoice.catch(() => null);
  updateProductionTrackerInstallButtons();
}

function updateProductionTrackerInstallButtons() {
  document.querySelectorAll(".pwa-install-button").forEach(button => {
    if (isProductionTrackerStandalone()) {
      button.textContent = "App Installed";
      button.disabled = true;
      return;
    }

    button.disabled = false;
    button.textContent = productionTrackerInstallPrompt ? "Install App" : "Install / Home Screen";
  });
}

function registerProductionTrackerInstallServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // The installer button is present even on the access page. Registering here
  // lets install-capable browsers detect the PWA before the user signs in.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(registration => registration.update().catch(() => null))
      .catch(err => console.warn("PWA service worker registration failed:", err));
  });
}

async function clearProductionTrackerStaticCaches() {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith("production-tracker-"))
        .map(cacheName => caches.delete(cacheName))
    );
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.update().catch(() => null)));
  }
}

function clearProductionTrackerUpdateQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(productionTrackerUpdateQueryParam)) return;

  url.searchParams.delete(productionTrackerUpdateQueryParam);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function reloadProductionTrackerForBuild(buildId) {
  const url = new URL(window.location.href);
  const updateToken = String(buildId).slice(0, 12);
  if (url.searchParams.get(productionTrackerUpdateQueryParam) === updateToken) return;

  url.searchParams.set(productionTrackerUpdateQueryParam, updateToken);
  sessionStorage.setItem(productionTrackerReloadFlagKey, buildId);
  window.location.replace(url.toString());
}

async function checkProductionTrackerBuildVersion() {
  if (productionTrackerVersionCheckInFlight) return;
  productionTrackerVersionCheckInFlight = true;

  try {
    const res = await fetch(`/app-version?_=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!res.ok) return;

    const data = await res.json();
    const buildId = String(data.build || "").trim();
    if (!buildId) return;

    const storedBuildId = localStorage.getItem(productionTrackerBuildStorageKey);
    if (!storedBuildId) {
      localStorage.setItem(productionTrackerBuildStorageKey, buildId);
      return;
    }

    if (storedBuildId === buildId) return;

    const reloadedBuildId = sessionStorage.getItem(productionTrackerReloadFlagKey);
    localStorage.setItem(productionTrackerBuildStorageKey, buildId);
    await clearProductionTrackerStaticCaches();

    if (reloadedBuildId !== buildId) {
      reloadProductionTrackerForBuild(buildId);
    }
  } catch (err) {
    console.warn("App version check failed:", err);
  } finally {
    productionTrackerVersionCheckInFlight = false;
  }
}

function registerProductionTrackerBuildChecks() {
  window.addEventListener("load", () => {
    checkProductionTrackerBuildVersion();
    setTimeout(checkProductionTrackerBuildVersion, 2000);
  });

  window.addEventListener("pageshow", event => {
    if (event.persisted) checkProductionTrackerBuildVersion();
  });

  window.addEventListener("focus", checkProductionTrackerBuildVersion);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkProductionTrackerBuildVersion();
    }
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  productionTrackerInstallPrompt = event;
  updateProductionTrackerInstallButtons();
});

window.addEventListener("appinstalled", () => {
  productionTrackerInstallPrompt = null;
  closeProductionTrackerInstallModal();
  updateProductionTrackerInstallButtons();
});

document.addEventListener("DOMContentLoaded", () => {
  ensureProductionTrackerInstallStyles();
  clearProductionTrackerUpdateQueryParam();
  initProductionTrackerNavGroups();
  document.querySelectorAll(".pwa-install-button").forEach(button => {
    button.addEventListener("click", promptProductionTrackerInstall);
  });

  updateProductionTrackerInstallButtons();
});

registerProductionTrackerInstallServiceWorker();
registerProductionTrackerBuildChecks();
