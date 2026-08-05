(function () {
  const stateByRoot = new WeakMap();

  function escapeText(value) {
    const node = document.createElement("div");
    node.textContent = String(value == null ? "" : value);
    return node.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "No expiration date";
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" })
      .format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function formatDateTime(value) {
    if (!value) return "Unknown date";
    const parsed = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }).format(parsed);
  }

  function setStatus(root, text, type) {
    const status = root.querySelector("[data-active-sku-status]");
    status.textContent = text || "";
    status.className = `active-sku-status${type ? ` ${type}` : ""}`;
  }

  function renderCards(root, data) {
    const grid = root.querySelector("[data-active-sku-grid]");
    const summary = root.querySelector("[data-active-sku-summary]");
    const importInfo = data.import;
    summary.innerHTML = importInfo
      ? `<span><b>${data.total_skus}</b> SKU${data.total_skus === 1 ? "" : "s"} from ${escapeText(importInfo.source_file_name || "the latest report")}</span><span>${escapeText((importInfo.selected_locations || []).join(", "))}${data.unmatched_skus ? ` · <b>${data.unmatched_skus}</b> unmapped` : ""}</span>`
      : "<span>No Metrc report has been imported yet.</span>";

    grid.innerHTML = "";
    (data.items || []).forEach(item => {
      const card = document.createElement("article");
      card.className = "active-sku-card";
      const visibleSkus = (item.skus || []).filter(sku => !Number(sku.is_withheld));
      const withheldSkus = (item.skus || []).filter(sku => Number(sku.is_withheld));
      const current = visibleSkus.find(sku => sku.sku_tag === item.current_sku_tag);
      const upcoming = visibleSkus.filter(sku => sku.sku_tag !== item.current_sku_tag);
      const ordered = current ? [current, ...upcoming] : upcoming;
      card.innerHTML = `
        <div class="active-sku-card-heading">
          <div><h3>${escapeText(item.name)}</h3><div class="active-sku-aliases">${item.metrc_names.length ? `Metrc: ${escapeText(item.metrc_names.join(" · "))}` : "No Metrc name mapped"}</div></div>
          <span class="active-sku-count">${visibleSkus.length} listed${withheldSkus.length ? ` · ${withheldSkus.length} withheld` : ""}</span>
        </div>
        <div class="active-sku-list"></div>`;
      const list = card.querySelector(".active-sku-list");
      if (!ordered.length) {
        const empty = document.createElement("div");
        empty.className = "active-sku-empty";
        empty.textContent = item.metrc_names.length ? "No matching SKUs in the selected rooms." : "Map a Metrc name in Item & Task Management.";
        list.appendChild(empty);
      }
      function addSkuRow(sku, isWithheld) {
        const isCurrent = sku.sku_tag === item.current_sku_tag;
        const isLowQuantity = Number.isFinite(Number(sku.quantity)) && Number(sku.quantity) < 200;
        const isStorageRoom = /cur+ing\s+room|vault/i.test(sku.location || "");
        const row = document.createElement("div");
        row.className = `active-sku-row${isCurrent ? " current" : ""}${isLowQuantity ? " low-quantity" : ""}${isStorageRoom ? " storage-room" : ""}`;
        const quantity = Number.isFinite(Number(sku.quantity))
          ? `${Number(sku.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${escapeText(sku.unit_of_measure || "units")}`
          : "Quantity unavailable";
        row.innerHTML = `
          <div><div class="active-sku-number">${escapeText(sku.sku_tag)}</div><div class="active-sku-meta">${quantity} · Expires ${escapeText(formatDate(sku.expiration_date))} · ${escapeText(sku.location)}</div></div>
          <div><span class="active-sku-badge ${isWithheld ? "active-sku-withheld-label" : (isCurrent ? "current" : "upcoming")}">${isWithheld ? "Withheld" : (isCurrent ? "Current SKU" : "Upcoming")}</span>${isLowQuantity ? '<span class="active-sku-badge low">Under 200</span>' : ""}</div>`;
        if (!isCurrent && !isWithheld) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "active-sku-select";
          button.textContent = "Make Current";
          button.addEventListener("click", () => selectCurrent(root, item.id, sku.sku_tag, button));
          row.lastElementChild.appendChild(document.createElement("br"));
          row.lastElementChild.appendChild(button);
        }
        const withholdButton = document.createElement("button");
        withholdButton.type = "button";
        withholdButton.className = "active-sku-withhold";
        withholdButton.textContent = isWithheld ? "Restore to List" : "Withhold SKU";
        withholdButton.addEventListener("click", () => setWithheld(root, sku.sku_tag, !isWithheld, withholdButton));
        row.lastElementChild.appendChild(document.createElement("br"));
        row.lastElementChild.appendChild(withholdButton);
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "active-sku-delete";
        deleteButton.textContent = "Delete SKU";
        deleteButton.addEventListener("click", () => deleteSku(root, sku.sku_tag, deleteButton));
        row.lastElementChild.appendChild(deleteButton);
        return row;
      }
      ordered.forEach(sku => list.appendChild(addSkuRow(sku, false)));
      if (withheldSkus.length) {
        const details = document.createElement("details");
        details.className = "active-sku-withheld-list";
        const summaryNode = document.createElement("summary");
        summaryNode.textContent = `${withheldSkus.length} withheld SKU${withheldSkus.length === 1 ? "" : "s"}`;
        details.appendChild(summaryNode);
        withheldSkus.forEach(sku => details.appendChild(addSkuRow(sku, true)));
        list.appendChild(details);
      }
      grid.appendChild(card);
    });
  }

  async function setWithheld(root, skuTag, isWithheld, button) {
    button.disabled = true;
    setStatus(root, isWithheld ? "Withholding SKU..." : "Restoring SKU...");
    try {
      const response = await fetch(`/active-skus/${encodeURIComponent(skuTag)}/withheld`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_withheld: isWithheld })
      });
      if (!response.ok) throw new Error(await response.text());
      await load(root);
      setStatus(root, isWithheld ? "SKU withheld from the current/upcoming list." : "SKU restored to the list.", "success");
    } catch (err) {
      button.disabled = false;
      setStatus(root, `SKU could not be updated: ${err.message}`, "error");
    }
  }

  async function deleteSku(root, skuTag, button) {
    if (!window.confirm(`Delete SKU ${skuTag}? It will move to Deleted SKUs and remain excluded from future imports.`)) return;
    button.disabled = true;
    setStatus(root, "Deleting SKU...");
    try {
      const response = await fetch(`/active-skus/${encodeURIComponent(skuTag)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      await load(root);
      setStatus(root, "SKU moved to Deleted SKUs.", "success");
    } catch (err) {
      button.disabled = false;
      setStatus(root, `SKU could not be deleted: ${err.message}`, "error");
    }
  }

  async function load(root) {
    setStatus(root, "Loading active SKUs...");
    try {
      const response = await fetch("/active-skus");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      stateByRoot.set(root, { ...(stateByRoot.get(root) || {}), data });
      renderCards(root, data);
      await loadDeleted(root);
      setStatus(root, "");
    } catch (err) {
      setStatus(root, `Active SKUs could not load: ${err.message}`, "error");
    }
  }

  async function loadDeleted(root) {
    const searchInput = root.querySelector("[data-deleted-sku-search]");
    const list = root.querySelector("[data-deleted-sku-list]");
    const count = root.querySelector("[data-deleted-sku-count]");
    const search = String(searchInput.value || "").trim();
    list.innerHTML = '<div class="deleted-sku-empty">Loading deleted SKUs...</div>';
    try {
      const response = await fetch(`/active-skus/deleted?search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      count.textContent = `${rows.length} result${rows.length === 1 ? "" : "s"}`;
      list.innerHTML = "";
      if (!rows.length) {
        list.innerHTML = `<div class="deleted-sku-empty">${search ? "No deleted SKUs match this search." : "No deleted SKUs yet."}</div>`;
        return;
      }
      rows.forEach(sku => {
        const quantity = Number.isFinite(Number(sku.quantity))
          ? `${Number(sku.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${escapeText(sku.unit_of_measure || "units")}`
          : "Quantity unavailable";
        const row = document.createElement("div");
        row.className = "deleted-sku-row";
        row.innerHTML = `
          <div><span class="deleted-sku-label">SKU #</span><span class="deleted-sku-primary">${escapeText(sku.sku_tag)}</span></div>
          <div><span class="deleted-sku-label">Item</span>${escapeText(sku.item_name || "Unmapped item")}</div>
          <div><span class="deleted-sku-label">Metrc name</span>${escapeText(sku.metrc_name)}</div>
          <div><span class="deleted-sku-label">Removed</span>${escapeText(formatDateTime(sku.removed_at))}<div class="deleted-sku-reason">${sku.removal_reason === "manual" ? "Manually deleted" : "Removed by import"}</div><div class="active-sku-meta">${quantity}</div></div>`;
        list.appendChild(row);
      });
    } catch (err) {
      count.textContent = "";
      list.innerHTML = `<div class="deleted-sku-empty">Deleted SKU history could not load: ${escapeText(err.message)}</div>`;
    }
  }

  async function selectCurrent(root, itemId, skuTag, button) {
    button.disabled = true;
    setStatus(root, "Saving current SKU...");
    try {
      const response = await fetch(`/active-skus/items/${itemId}/current`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_tag: skuTag })
      });
      if (!response.ok) throw new Error(await response.text());
      await load(root);
      setStatus(root, "Current SKU updated.", "success");
    } catch (err) {
      button.disabled = false;
      setStatus(root, `Current SKU could not be saved: ${err.message}`, "error");
    }
  }

  async function preview(root) {
    const file = root.querySelector("[data-active-sku-file]").files[0];
    if (!file) return setStatus(root, "Choose a Metrc .xlsx report first.", "error");
    setStatus(root, "Reading report and finding rooms...");
    const roomPicker = root.querySelector("[data-active-sku-rooms]");
    roomPicker.innerHTML = "";
    try {
      const response = await fetch("/active-skus/import-preview", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Active-SKU-File-Name": file.name },
        body: file
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      stateByRoot.set(root, { ...(stateByRoot.get(root) || {}), preview: result });
      const previous = new Set(result.selected_locations || []);
      result.locations.forEach(location => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = location.name;
        checkbox.checked = previous.size ? previous.has(location.name) : !/ivy hall/i.test(location.name);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${location.name} (${location.count})`));
        roomPicker.appendChild(label);
      });
      root.querySelector("[data-active-sku-apply]").hidden = false;
      setStatus(root, `${result.total_rows} package rows found. Confirm which rooms belong in Active SKUs, then import.`);
    } catch (err) {
      setStatus(root, `Report could not be read: ${err.message}`, "error");
    }
  }

  async function applyImport(root) {
    const previewState = stateByRoot.get(root) || {};
    if (!previewState.preview) return;
    const selectedLocations = Array.from(root.querySelectorAll("[data-active-sku-rooms] input:checked")).map(input => input.value);
    if (!selectedLocations.length) return setStatus(root, "Select at least one room.", "error");
    const button = root.querySelector("[data-active-sku-apply]");
    button.disabled = true;
    setStatus(root, "Importing selected rooms...");
    try {
      const response = await fetch("/active-skus/import-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: previewState.preview.token, selected_locations: selectedLocations })
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      root.querySelector("[data-active-sku-rooms]").innerHTML = "";
      button.hidden = true;
      button.disabled = false;
      await load(root);
      setStatus(root, `${result.imported} active SKU${result.imported === 1 ? "" : "s"} imported.`, "success");
    } catch (err) {
      button.disabled = false;
      setStatus(root, `Import failed: ${err.message}`, "error");
    }
  }

  function initialize(root) {
    if (root.dataset.activeSkuReady) return;
    root.dataset.activeSkuReady = "true";
    root.querySelector("[data-active-sku-preview]").addEventListener("click", () => preview(root));
    root.querySelector("[data-active-sku-apply]").addEventListener("click", () => applyImport(root));
    let searchTimer;
    root.querySelector("[data-deleted-sku-search]").addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadDeleted(root), 250);
    });
  }

  window.ActiveSkus = {
    load() {
      document.querySelectorAll("[data-active-skus-root]").forEach(root => {
        initialize(root);
        load(root);
      });
    }
  };
}());
