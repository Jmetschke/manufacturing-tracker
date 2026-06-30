(function () {
  let alerts = [];

  function getElements() {
    return {
      container: document.querySelector("[data-alert-widget]"),
      toggle: document.getElementById("alertToggle"),
      count: document.getElementById("alertUnreadCount"),
      panel: document.getElementById("alertPanel"),
      list: document.getElementById("alertList"),
      markAll: document.getElementById("alertMarkAll")
    };
  }

  function formatAlertDate(value) {
    if (!value) return "";
    const date = new Date(`${value.replace(" ", "T")}Z`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function setPanelOpen(open) {
    const { toggle, panel } = getElements();
    if (!toggle || !panel) return;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderAlerts() {
    const { count, list, markAll } = getElements();
    if (!count || !list || !markAll) return;

    const unreadCount = alerts.filter(alert => !Number(alert.is_read)).length;
    count.textContent = String(unreadCount);
    count.hidden = unreadCount === 0;
    markAll.disabled = unreadCount === 0;

    list.innerHTML = "";
    if (!alerts.length) {
      const empty = document.createElement("div");
      empty.className = "alert-empty";
      empty.textContent = "No alerts.";
      list.appendChild(empty);
      return;
    }

    alerts.forEach(alert => {
      const item = document.createElement("div");
      item.className = `alert-item${Number(alert.is_read) ? "" : " unread"}`;

      const title = document.createElement("div");
      title.className = "alert-item-title";
      title.textContent = alert.title || "Alert";
      item.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "alert-item-meta";
      meta.textContent = [alert.type, formatAlertDate(alert.created_at)].filter(Boolean).join(" - ");
      item.appendChild(meta);

      const message = document.createElement("div");
      message.className = "alert-item-message";
      message.textContent = alert.message || "";
      item.appendChild(message);

      if (!Number(alert.is_read)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "alert-read-button";
        button.textContent = "Mark read";
        button.addEventListener("click", () => markAlertRead(alert.id));
        item.appendChild(button);
      }

      list.appendChild(item);
    });
  }

  async function loadAlerts() {
    const { container } = getElements();
    if (!container) return;

    try {
      const res = await fetch("/alerts");
      if (!res.ok) throw new Error(await res.text());
      alerts = await res.json();
      renderAlerts();
    } catch (err) {
      console.warn("Could not load alerts:", err);
    }
  }

  async function markAlertRead(id) {
    const res = await fetch(`/alerts/${id}/read`, { method: "PATCH" });
    if (!res.ok) {
      console.warn("Could not mark alert read:", await res.text());
      return;
    }

    alerts = alerts.map(alert => alert.id === id ? { ...alert, is_read: 1 } : alert);
    renderAlerts();
  }

  async function markAllAlertsRead() {
    const res = await fetch("/alerts/read-all", { method: "PATCH" });
    if (!res.ok) {
      console.warn("Could not mark alerts read:", await res.text());
      return;
    }

    alerts = alerts.map(alert => ({ ...alert, is_read: 1 }));
    renderAlerts();
  }

  function initAlerts() {
    const { container, toggle, panel, markAll } = getElements();
    if (!container || !toggle || !panel || !markAll) return;

    toggle.addEventListener("click", event => {
      event.stopPropagation();
      const nextOpen = panel.hidden;
      setPanelOpen(nextOpen);
      if (nextOpen) loadAlerts();
    });

    panel.addEventListener("click", event => event.stopPropagation());
    markAll.addEventListener("click", markAllAlertsRead);

    document.addEventListener("click", () => setPanelOpen(false));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setPanelOpen(false);
    });

    loadAlerts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAlerts);
  } else {
    initAlerts();
  }

  window.productionTrackerAlerts = {
    load: loadAlerts
  };
})();
