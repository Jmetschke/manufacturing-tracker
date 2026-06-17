// Shared PWA install button behavior for the internal Production Tracker.
// Chrome/Android can expose a native install prompt; iPhone Safari requires
// users to use Share > Add to Home Screen, so the button explains that path.
let productionTrackerInstallPrompt = null;

function isProductionTrackerStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function getProductionTrackerInstallMessage() {
  const isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (isiOS) {
    return "To install this app on iPhone or iPad: tap the Share button, then tap Add to Home Screen.";
  }

  return "To install this app: use your browser menu and choose Install app or Add to Home screen.";
}

function updateProductionTrackerInstallButtons() {
  document.querySelectorAll(".pwa-install-button").forEach(button => {
    if (isProductionTrackerStandalone()) {
      button.textContent = "App Installed";
      button.disabled = true;
      return;
    }

    button.disabled = false;
    button.textContent = productionTrackerInstallPrompt ? "Install App" : "How to Install";
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  productionTrackerInstallPrompt = event;
  updateProductionTrackerInstallButtons();
});

window.addEventListener("appinstalled", () => {
  productionTrackerInstallPrompt = null;
  updateProductionTrackerInstallButtons();
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".pwa-install-button").forEach(button => {
    button.addEventListener("click", async () => {
      if (isProductionTrackerStandalone()) return;

      if (!productionTrackerInstallPrompt) {
        window.alert(getProductionTrackerInstallMessage());
        return;
      }

      const promptEvent = productionTrackerInstallPrompt;
      productionTrackerInstallPrompt = null;
      promptEvent.prompt();
      await promptEvent.userChoice.catch(() => null);
      updateProductionTrackerInstallButtons();
    });
  });

  updateProductionTrackerInstallButtons();
});
