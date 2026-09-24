const StorageLocations = (() => {
  let locations = [];
  async function request(url, body) {
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to save or load storage data');
    }
    return response.json();
  }
  function populate(select) {
    const value = select.value;
    select.replaceChildren(new Option('Select location', ''));
    locations.forEach(location => select.add(new Option(location.name, location.name)));
    select.add(new Option('+ Add location…', '__add_location__'));
    select.value = value === '__add_location__' ? '' : value;
  }
  function bind(select) {
    populate(select);
    select.addEventListener('change', async () => {
      if (select.value !== '__add_location__') return;
      select.value = '';
      const location = await addLocation();
      if (location) select.value = location.name;
    });
  }
  function createSelect() {
    const select = document.createElement('select');
    select.dataset.storageLocation = '';
    select.required = true;
    select.setAttribute('aria-label', 'Storage location');
    bind(select);
    refresh().catch(error => { alert(error.message); });
    return select;
  }
  async function refresh() {
    const results = await Promise.all([request('/storage-locations'), EquipmentInventory.refresh()]);
    locations = results[0];
    document.querySelectorAll('[data-storage-location]').forEach(populate);
  }
  async function addLocation() {
    const name = prompt('New location name:');
    if (!name || !name.trim()) return;
    try {
      const location = await request('/storage-locations', { name: name.trim() });
      await refresh();
      render();
      return location;
    } catch (error) { alert(error.message); }
  }
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }
  function destinationSelect(location, label) {
    const select = element('select');
    select.setAttribute('aria-label', label);
    select.add(new Option('Choose destination room', ''));
    locations.filter(other => other.id !== location.id).forEach(other => select.add(new Option(other.name, other.id)));
    return select;
  }
  async function changeStorage(button, url, body, message) {
    button.disabled = true;
    const status = document.getElementById('storageStatus');
    try {
      await request(url, body);
      await refresh();
      render();
      status.textContent = message;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }
  function render() {
    const container = document.getElementById('storageCards');
    if (!container) return;
    container.replaceChildren();
    locations.forEach(location => {
      const card = element('article');
      card.className = 'storage-card';
      card.append(element('h3', location.name), element('p', `${location.items.length} item records`));
      const roomActions = element('div');
      roomActions.className = 'storage-actions';
      const roomDestination = destinationSelect(location, `Move all items from ${location.name} to`);
      const deleteRoom = element('button', 'Delete room');
      deleteRoom.type = 'button';
      deleteRoom.addEventListener('click', () => {
        if (location.items.length && !roomDestination.value) {
          document.getElementById('storageStatus').textContent = 'Choose where to move this room’s items before deleting it.';
          roomDestination.focus();
          return;
        }
        const destination = roomDestination.selectedOptions[0].textContent;
        if (!confirm(`Delete room "${location.name}"?${location.items.length ? ` All its items will move to "${destination}".` : ''}`)) return;
        changeStorage(deleteRoom, `/storage-locations/${location.id}/delete`,
          { location_id: roomDestination.value ? Number(roomDestination.value) : null }, 'Room deleted.');
      });
      if (location.items.length) roomActions.append(element('p', 'Consolidate this room by choosing where to move all its items:'), roomDestination);
      roomActions.append(deleteRoom);
      card.append(roomActions);
      const list = element('ul');
      location.items.forEach(item => {
        const row = element('li');
        row.append(element('strong', item.standard_item_name || item.item_name), element('div', `${item.quantity ?? '—'} ${item.unit} · ${item.source === 'delivery' ? 'Received' : 'Manually placed'} ${item.placed_at || ''}`));
        if (item.original_description) row.append(element('p', `Original description: ${item.original_description}`));
        const packageQuantity = item.source === 'delivery' || /^(packages?|boxes|box|cases?|packs?)$/i.test(item.unit);
        row.append(element('p', item.units_per_package == null ? 'Items per package: not specified' : `Items per package: ${item.units_per_package}${packageQuantity ? ` · Total items: ${item.quantity * item.units_per_package}` : ''}`));
        if (item.notes) row.append(element('p', item.notes));
        const inventoryEdit = element('details');
        inventoryEdit.className = 'storage-inventory-editor';
        inventoryEdit.append(element('summary', 'Edit room inventory'));
        const inventoryForm = element('form');
        const quantityLabel = element('label', `Current quantity (${item.unit})`);
        const quantityInput = element('input'); quantityInput.type = 'number'; quantityInput.min = '0'; quantityInput.step = 'any'; quantityInput.required = true; quantityInput.value = item.quantity;
        quantityLabel.append(quantityInput);
        const unitsLabel = element('label', 'Items per package (optional)');
        const unitsInput = EquipmentInventory.unitsInput(item.units_per_package); unitsLabel.append(unitsInput);
        inventoryForm.append(quantityLabel, unitsLabel);
        const standardSelect = EquipmentInventory.picker(item.standard_item_id);
        if (item.source === 'manual') inventoryForm.append(standardSelect, EquipmentInventory.createButton(standardSelect));
        const inventorySave = element('button', 'Save inventory'); inventorySave.type = 'submit';
        const inventoryStatus = element('p'); inventoryStatus.setAttribute('role', 'status');
        inventoryForm.append(inventorySave, inventoryStatus);
        inventoryForm.addEventListener('submit', async event => {
          event.preventDefault(); inventorySave.disabled = true; inventoryStatus.textContent = 'Saving…';
          try {
            await request(`/storage-items/${item.source}/${item.id}/inventory`, { quantity: Number(quantityInput.value), units_per_package: unitsInput.value === '' ? null : Number(unitsInput.value), standard_item_id: standardSelect.value ? Number(standardSelect.value) : null });
            await refresh(); render();
          } catch (err) { inventoryStatus.textContent = err.message; inventorySave.disabled = false; }
        });
        inventoryEdit.append(inventoryForm); row.append(inventoryEdit);
        const actions = element('div');
        actions.className = 'storage-actions';
        const destination = destinationSelect(location, `Move ${item.item_name} to`);
        const move = element('button', 'Move item');
        move.type = 'button';
        move.disabled = true;
        destination.addEventListener('change', () => { move.disabled = !destination.value; });
        move.addEventListener('click', () => changeStorage(move,
          `/storage-items/${item.source}/${item.id}/move`, { location_id: Number(destination.value) }, 'Item moved.'));
        const remove = element('button', 'Delete item');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          if (!confirm(`Remove "${item.item_name}" from "${location.name}"?${item.source === 'delivery' ? ' Its delivery history will be kept.' : ''}`)) return;
          changeStorage(remove, `/storage-items/${item.source}/${item.id}/delete`, {}, 'Item removed.');
        });
        actions.append(destination, move, remove);
        row.append(actions);
        list.append(row);
      });
      card.append(location.items.length ? list : element('p', 'No items placed here yet.'));
      const details = element('details');
      details.append(element('summary', 'Add item to this location'));
      const form = element('form');
      const inputs = {};
      const standard = EquipmentInventory.picker();
      standard.addEventListener('change', () => { if (standard.value) inputs.item_name.value = standard.selectedOptions[0].textContent; });
      form.append(element('label', 'Equipment and Ingredient Inventory item'), standard,
        EquipmentInventory.createButton(standard, item => { inputs.item_name.value = item.name; }));
      [['item_name', 'Item name', 'text'], ['quantity', 'Quantity', 'number'], ['unit', 'Unit (e.g. boxes, units, lbs)', 'text'], ['notes', 'Notes (optional)', 'text']].forEach(([key, label, type]) => {
        const wrapper = element('label', label);
        const input = element('input');
        input.type = type;
        input.required = key !== 'notes';
        input.maxLength = key === 'notes' ? 4000 : key === 'unit' ? 60 : 200;
        if (type === 'number') { input.min = '0.000001'; input.step = 'any'; }
        inputs[key] = input;
        wrapper.append(input);
        form.append(wrapper);
      });
      const unitsLabel = element('label', 'Items per package (optional)');
      const unitsInput = EquipmentInventory.unitsInput(); unitsLabel.append(unitsInput); form.append(unitsLabel);
      const save = element('button', 'Add item');
      save.type = 'submit';
      const status = element('p');
      status.setAttribute('role', 'status');
      form.append(save, status);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        save.disabled = true;
        try {
          await request('/storage-items', { standard_item_id: standard.value ? Number(standard.value) : null, units_per_package: unitsInput.value === '' ? null : Number(unitsInput.value), location_id: location.id, item_name: inputs.item_name.value, quantity: Number(inputs.quantity.value), unit: inputs.unit.value, notes: inputs.notes.value });
          await load();
        } catch (error) { status.textContent = error.message; }
        finally { save.disabled = false; }
      });
      details.append(form);
      card.append(details);
      container.append(card);
    });
  }
  async function load() {
    const status = document.getElementById('storageStatus');
    status.textContent = 'Loading locations…';
    try { await refresh(); render(); status.textContent = ''; }
    catch (error) { status.textContent = error.message; }
  }
  document.querySelectorAll('[data-storage-location]').forEach(bind);
  refresh().catch(error => { document.getElementById('storageStatus').textContent = error.message; });
  return { load, addLocation, createSelect };
})();
