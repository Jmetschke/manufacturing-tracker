const EquipmentInventory = (() => {
  let items = [];
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  async function request(url, method = 'GET', body) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Inventory request failed. Please refresh and try again.');
    return data;
  }
  async function refresh() { items = await request('/inventory/standard-items'); }
  function picker(value = '') {
    const select = node('select');
    select.setAttribute('aria-label', 'Equipment and Ingredient Inventory item');
    select.add(new Option('Select standard item (optional)', ''));
    items.forEach(item => select.add(new Option(item.name, item.id)));
    select.value = value || '';
    return select;
  }
  async function create() {
    const name = prompt('New Equipment and Ingredient Inventory item name:');
    if (!name || !name.trim()) return null;
    const result = await request('/inventory/standard-items', 'POST', { name });
    await refresh();
    return result;
  }
  function createButton(select, onSelect = () => {}) {
    const button = node('button', 'Create standard item'); button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { const result = await create(); if (result) { select.replaceChildren(...picker(result.id).children); select.value = result.id; onSelect(result); } }
      catch (err) { alert(err.message); } finally { button.disabled = false; }
    });
    return button;
  }
  function unitsInput(value) {
    const input = node('input'); input.type = 'number'; input.min = '0'; input.step = '1';
    input.placeholder = 'Items per package (optional)'; input.setAttribute('aria-label', 'Items per package (optional)');
    input.value = value ?? ''; return input;
  }
  async function loadMappings() {
    const root = document.getElementById('inventoryMappingContent'); if (!root) return;
    root.textContent = 'Loading mappings…';
    try {
      const data = await request('/admin/inventory/mappings'); items = data.standard_items; root.replaceChildren();
      const status = node('p'); status.setAttribute('role', 'status'); root.append(status);
      const run = async (button, fn) => { button.disabled = true; try { await fn(); await loadMappings(); if (typeof loadOrderedItems === 'function') await loadOrderedItems(); } catch (err) { status.textContent = err.message; button.disabled = false; } };
      const unmapped = node('section'); unmapped.append(node('h3', `Unmapped Items (${data.unmapped.length})`), node('p', 'Leave any item unmapped for now by taking no action. Orders and receiving will continue to work.'));
      function mappingCard(mapping, existing) {
        const card = node('article'); card.className = 'inventory-mapping-card';
        card.append(node('strong', mapping.description), node('p', `Vendor: ${mapping.vendor || 'Not recorded'}`));
        if (!existing) card.append(node('p', `${mapping.occurrences} occurrence(s) · Latest order: ${mapping.most_recent_order || 'Unknown'}`));
        if (mapping.latest_reference) card.append(node('p', `Latest order reference: ${mapping.latest_reference}`));
        if (mapping.vendor_sku) card.append(node('p', `SKU: ${mapping.vendor_sku}`));
        const select = picker(mapping.standard_item_id); const save = node('button', existing ? 'Change mapping' : 'Map item'); save.type = 'button';
        save.addEventListener('click', () => run(save, async () => {
          if (!select.value) throw new Error('Choose a standard item first.');
          await request('/admin/inventory/mappings', 'POST', { vendor: mapping.vendor, description: mapping.description, standard_item_id: Number(select.value) });
        }));
        const createMap = node('button', 'Create standard item and map'); createMap.type = 'button';
        createMap.addEventListener('click', () => run(createMap, async () => {
          const item = await create(); if (!item) return;
          await request('/admin/inventory/mappings', 'POST', { vendor: mapping.vendor, description: mapping.description, standard_item_id: item.id });
        }));
        card.append(select, save, createMap);
        if (existing) {
          const remove = node('button', 'Remove mapping'); remove.type = 'button';
          remove.addEventListener('click', () => { if (confirm('Remove this mapping? Original order and receiving records will be kept.')) run(remove, () => request(`/admin/inventory/mappings/${mapping.id}`, 'DELETE')); });
          card.append(remove);
        }
        return card;
      }
      data.unmapped.forEach(mapping => unmapped.append(mappingCard(mapping, false))); root.append(unmapped);
      const standards = node('section'); standards.append(node('h3', 'Standard Items and Mappings'));
      const add = node('button', 'Create standard item'); add.type = 'button'; add.addEventListener('click', () => run(add, create)); standards.append(add);
      items.forEach(item => {
        const group = node('article'); group.className = 'inventory-standard-group'; group.append(node('h4', item.name));
        const rename = node('button', 'Rename'); rename.type = 'button'; rename.addEventListener('click', () => {
          const name = prompt('Standard item name:', item.name); if (name && name.trim()) run(rename, () => request(`/admin/inventory/standard-items/${item.id}`, 'PUT', { name }));
        }); group.append(rename);
        const mappings = data.mappings.filter(mapping => mapping.standard_item_id === item.id);
        mappings.forEach(mapping => group.append(mappingCard(mapping, true)));
        if (!mappings.length) group.append(node('p', 'No vendor descriptions mapped yet. Available for manual room inventory.'));
        standards.append(group);
      }); root.append(standards);
    } catch (err) { root.textContent = err.message; }
  }
  document.getElementById('inventoryMappingPanel')?.addEventListener('toggle', event => { if (event.target.open) loadMappings(); });
  return { refresh, picker, createButton, unitsInput, loadMappings };
})();
