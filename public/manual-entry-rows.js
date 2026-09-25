const ManualEntryRows = (() => {
  function add(container, includeUnits = false) {
    const row = document.createElement('fieldset'); row.className = 'manual-entry-item-row';
    const legend = document.createElement('legend'); legend.textContent = 'Item'; row.append(legend);
    [['item_name','Item description','text'],['package_qty','Package quantity','number'],...(includeUnits ? [['units_per_package','Items per package (optional)','number']] : [])].forEach(([key,label,type]) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement('input'); input.type = type; input.dataset.itemField = key; input.required = key !== 'units_per_package';
      if(type === 'number'){input.min='0';input.step='1';}
      wrapper.append(input);row.append(wrapper);
    });
    const remove = document.createElement('button'); remove.type='button';remove.textContent='Remove item';remove.addEventListener('click',()=>row.remove());row.append(remove);
    container.append(row);row.querySelector('input').focus();return row;
  }
  function values(container) {
    return Array.from(container.querySelectorAll('.manual-entry-item-row')).map(row => Object.fromEntries(Array.from(row.querySelectorAll('[data-item-field]')).map(input=>[input.dataset.itemField,input.value])));
  }
  return { add, values };
})();

const ManualReceivedEntry = (() => {
  function prepare(prefix, modal) {
    for(const key of ['date_ordered','expected_delivery_date','date']) {
      const field=document.getElementById(`${prefix}_${key}`);if(!field.value)field.value=toIsoDate(new Date());
    }
    if(document.getElementById(`${prefix}_extra_items`))return;
    const section=document.createElement('section');section.style.gridColumn='1 / -1';
    const note=document.createElement('p');note.textContent='Add more items from this delivery. All items use the supplier, dates, location, received-by name, notes, and photos entered here.';
    const rows=document.createElement('div');rows.id=`${prefix}_extra_items`;
    const add=document.createElement('button');add.type='button';add.textContent='Add another item';add.addEventListener('click',()=>ManualEntryRows.add(rows,true));
    section.append(note,rows,add);document.getElementById(`${prefix}_units_per_package`).parentElement.after(section);
    const status=document.createElement('p');status.id=`${prefix}_save_status`;status.setAttribute('role','status');modal.querySelector('.ordered-modal-window').append(status);
  }
  function reset(prefix) {document.getElementById(`${prefix}_extra_items`)?.replaceChildren();const status=document.getElementById(`${prefix}_save_status`);if(status)status.textContent='';}
  async function save(admin) {
    const prefix=admin?'admin_manual_received':'manual_received';
    const modal=document.getElementById(admin?'adminManualReceivedWindow':'manualReceivedWindow');
    prepare(prefix,modal);if(modal.dataset.saving==='true')return;
    const status=document.getElementById(`${prefix}_save_status`);status.textContent='';
    const invalid=Array.from(modal.querySelectorAll('input,select,textarea')).find(field=>!field.checkValidity());
    if(invalid){status.textContent='Please complete the highlighted field.';invalid.reportValidity();return;}
    const value=key=>document.getElementById(`${prefix}_${key}`).value;
    const payload={date_ordered:value('date_ordered'),expected_delivery_date:value('expected_delivery_date'),item_supplier:value('item_supplier'),department:value('department'),received_date:value('date'),received_time:value('time').trim(),received_location:value('location'),received_by:value('by'),received_notes:value('notes'),
      items:[{item_name:value('item_name'),package_qty:value('package_qty'),units_per_package:value('units_per_package')},...ManualEntryRows.values(document.getElementById(`${prefix}_extra_items`))]};
    const controls=Array.from(modal.querySelectorAll('button,input,select,textarea')).map(control=>({control,disabled:control.disabled}));
    modal.dataset.saving='true';modal.setAttribute('aria-busy','true');controls.forEach(({control})=>control.disabled=true);status.textContent='Saving received items…';
    let saved=false;
    try{
      const images=admin?await getAdminOrderedReceiveImagesFromInputs(document.getElementById(`${prefix}_image_1`),document.getElementById(`${prefix}_image_2`)):await getOrderedReceiveImagesFromInputs(document.getElementById(`${prefix}_image_1`),document.getElementById(`${prefix}_image_2`));
      const res=await fetch('/ordered-items/received',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,...images})});
      if(!res.ok)throw new Error(await res.text());saved=true;
      if(admin)resetAdminManualReceivedForm(true);else resetManualReceivedForm(true);
      status.textContent=`Saved ${payload.items.length} received item(s).`;
      await loadOrderedItems();
      modal.hidden=true;document.body.style.overflow='';
      window.productionTrackerAlerts?.load();
    }catch(err){status.textContent=saved?'Items were saved, but the list could not refresh. Close this window and refresh Ordered Items.':`Could not save: ${err.message}. Your entries are still here.`;}
    finally{modal.dataset.saving='false';modal.removeAttribute('aria-busy');controls.forEach(({control,disabled})=>control.disabled=disabled);}
  }
  return {prepare,reset,save};
})();
