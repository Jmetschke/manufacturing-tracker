const ManualOrderEntry = (() => {
  function open() {
    const existing = document.querySelector('#orderedPanel .ordered-add-action');
    if (existing) {
      existing.dataset.draftActive = 'true';
      const date = existing.querySelector('#ordered_date_ordered'); if (!date.value) date.value = toIsoDate(new Date());
      if (!existing.querySelector('.ordered-item-row')) addOrderedItemRow();
      existing.classList.add('mobile-focused');
      existing.scrollIntoView({ block: 'center', behavior: 'smooth' });
      existing.querySelector('input')?.focus({ preventScroll: true });
      return;
    }
    let modal = document.getElementById('manualOrderedWindow');
    if (modal) { modal.hidden = false; modal.querySelector('input').focus(); return; }
    modal = document.createElement('div'); modal.id = 'manualOrderedWindow'; modal.className = 'ordered-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'manualOrderedTitle');
    const panel = document.createElement('div'); panel.className = 'ordered-modal-window';
    const heading = document.createElement('h3'); heading.id = 'manualOrderedTitle'; heading.textContent = 'Add ordered item';
    const form = document.createElement('form'); form.className = 'request-form';
    const inputs = {};
    [['date_ordered','Date ordered','date'],['expected_delivery_date','Expected delivery date','date'],['item_supplier','Retailer / supplier','text'],['department','Department','text']].forEach(([key,label,type]) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement('input'); input.type = type; input.required = true;
      if (type === 'number') { input.min = '0'; input.step = '1'; }
      if (key === 'date_ordered') input.value = toIsoDate(new Date());
      wrapper.append(input); form.append(wrapper); inputs[key] = input;
    });
    const rows = document.createElement('div'); rows.style.gridColumn = '1 / -1';
    const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add another item'; add.addEventListener('click', () => ManualEntryRows.add(rows));
    form.append(rows, add); ManualEntryRows.add(rows);
    const status = document.createElement('p'); status.setAttribute('role','status');
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Add ordered item';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cancel';
    close.addEventListener('click', () => { modal.hidden = true; });
    form.append(save, close, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (save.disabled) return;
      const controls = Array.from(form.querySelectorAll('input,button')).map(control => ({control,disabled:control.disabled}));
      controls.forEach(({control}) => { control.disabled = true; });
      save.disabled = true; close.disabled = true; save.textContent = 'Saving…'; status.textContent = '';
      let saved = false;
      try {
        const payload = Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key,input.value]));
        payload.items = ManualEntryRows.values(rows);
        if (!payload.items.length) throw new Error("Add at least one item.");
        const response = await fetch('/ordered-items', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        if (!response.ok) throw new Error(await response.text());
        saved = true;
        form.reset(); rows.replaceChildren(); ManualEntryRows.add(rows); inputs.date_ordered.value = toIsoDate(new Date()); modal.hidden = true;
        await loadOrderedItems();
        window.productionTrackerAlerts?.load();
      } catch (err) { modal.hidden = false; status.textContent = saved ? 'Order saved. Refresh Ordered Items to see it.' : `Could not save: ${err.message}`; }
      finally { controls.forEach(({control,disabled}) => { control.disabled = disabled; }); save.disabled = false; close.disabled = false; save.textContent = 'Add ordered item'; }
    });
    panel.append(heading, form); modal.append(panel); document.body.append(modal); rows.querySelector('input').focus();
  }
  return { open };
})();
