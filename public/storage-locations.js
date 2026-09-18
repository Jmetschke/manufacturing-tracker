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
    locations = await request('/storage-locations');
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
  function render() {
    const container = document.getElementById('storageCards');
    if (!container) return;
    container.replaceChildren();
    locations.forEach(location => {
      const card = element('article');
      card.className = 'storage-card';
      card.append(element('h3', location.name), element('p', `${location.items.length} item records`));
      const list = element('ul');
      location.items.forEach(item => {
        const row = element('li');
        row.append(element('strong', item.item_name), element('div', `${item.quantity ?? '—'} ${item.unit} · ${item.source === 'delivery' ? 'Received' : 'Manually placed'} ${item.placed_at || ''}`));
        if (item.notes) row.append(element('p', item.notes));
        list.append(row);
      });
      card.append(location.items.length ? list : element('p', 'No items placed here yet.'));
      const details = element('details');
      details.append(element('summary', 'Add item to this location'));
      const form = element('form');
      const inputs = {};
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
      const save = element('button', 'Add item');
      save.type = 'submit';
      const status = element('p');
      status.setAttribute('role', 'status');
      form.append(save, status);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        save.disabled = true;
        try {
          await request('/storage-items', { location_id: location.id, item_name: inputs.item_name.value, quantity: Number(inputs.quantity.value), unit: inputs.unit.value, notes: inputs.notes.value });
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
