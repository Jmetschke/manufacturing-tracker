(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value ? esc(String(value).slice(0,10)) : 'Not provided';
  const qty = p => `${Number(p.quantity).toLocaleString(undefined,{maximumFractionDigits:8})} ${esc(p.unit_of_measure)}`;
  const state = { rows: [], imports: [], token: null, historicalRows: null, busy: false, root: null };
  const find = selector => state.root.querySelector(selector);
  async function api(path, options) {
    const res = await fetch(`/current-packages${path}`, options);
    const body = await res.json().catch(()=>({ message: 'The server could not process this request.' }));
    if (!res.ok) throw new Error(body.message || 'Request failed.');
    return body;
  }
  function status(message, error=false) { const box = find('[data-status]'); box.textContent=message; box.classList.toggle('cp-error',error); }
  async function busy(fn) {
    if (state.busy) return;
    state.busy=true; state.root.setAttribute('aria-busy','true');
    state.root.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
    try { await fn(); } catch(err) { status(err.message,true); }
    finally { state.busy=false; state.root.removeAttribute('aria-busy'); state.root.querySelectorAll('button,input,select').forEach(el=>el.disabled=false); }
  }
  function details(p) {
    return `<dl><dt>Quantity</dt><dd>${qty(p)}</dd><dt>Production batch</dt><dd>${esc(p.production_batch_number)||'Not provided'}</dd><dt>Expiration</dt><dd>${date(p.expiration_date)}</dd>${p.use_by_date?`<dt>Use-by</dt><dd>${date(p.use_by_date)}</dd>`:''}<dt>Packaged</dt><dd>${date(p.packaged_date)}</dd><dt>Lab status</dt><dd>${esc(p.lab_test_status)||'Not provided'}</dd><dt>Location</dt><dd>${esc(p.location)}${p.sublocation?' / '+esc(p.sublocation):''}</dd></dl>`;
  }
  function packageCard(p, first=false, position=1) {
    const sortDate = p.expiration_date || p.use_by_date || p.packaged_date;
    const sortLabel = p.expiration_date ? 'Expiration Date' : p.use_by_date ? 'Use-By Date' : p.packaged_date ? 'Packaged Date (fallback)' : 'No date provided';
    return `<article class="cp-package ${first?'cp-first':''}">${first?'<strong class="cp-use">USE FIRST</strong>':`<strong>Use order: ${position}</strong>`}<div class="cp-tag">${esc(p.tag)}</div><button type="button" data-copy="${esc(p.tag)}">Copy Tag</button><p class="cp-sort-date"><strong>Ordering date:</strong> ${date(sortDate)} · ${esc(sortLabel)}</p>${details(p)}${p.administrative_hold && !/^(no|false|0)$/i.test(p.administrative_hold)?'<p class="cp-error">Administrative hold reported</p>':''}${p.administrative_recall && !/^(no|false|0)$/i.test(p.administrative_recall)?'<p class="cp-error">Administrative recall reported</p>':''}</article>`;
  }
  function renderEmployees() {
    const term = find('[data-search]').value.trim().toLowerCase();
    const groups = new Map();
    for (const p of state.rows.filter(p=>p.active && p.classification==='MASTER' && p.item.toLowerCase().includes(term))) {
      if (!groups.has(p.item_key)) groups.set(p.item_key,[]);
      groups.get(p.item_key).push(p);
    }
    find('[data-cards]').innerHTML=Array.from(groups.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([,rows])=>`<section class="cp-item"><h3>${esc(rows[0].item)}</h3><p>${rows.length} active parent package${rows.length===1?'':'s'} · listed in use order</p>${rows.map((p,index)=>packageCard(p,index===0,index+1)).join('')}${state.admin?`<button type="button" data-item-history="${esc(rows[0].item)}">View this Item’s history / retired packages</button>`:''}</section>`).join('') || (state.rows.length ? '<p>No active parent packages match this search.</p>' : '<p>No report has been imported yet. Use Upload Metrc report above to get started.</p>');
  }
  function adminRow(p) {
    return `<article class="cp-admin-row"><h4>${esc(p.item)}</h4><div class="cp-tag">${esc(p.tag)}</div><p><strong>${esc(p.classification)}</strong> · ${p.active?'Active master':p.retired_at?'Retired':'Not in employee queue'} · ${p.present_in_latest_import?'Present in latest report':'Absent from latest report'}</p>${details(p)}<p>First seen: ${date(p.first_seen_at)} · Last seen: ${date(p.last_seen_at)} · Retired: ${date(p.retired_at)} · Last import: ${esc(p.last_import_id)}</p>${p.retirement_reason?`<p>${esc(p.retirement_reason)}</p>`:''}<p>Automatic ${esc(p.automatic_classification)}: ${esc(p.classification_reason)}</p><p>Manual classification: ${esc(p.manual_classification)||'None'}</p><p>Source Processing Job(s): ${esc(p.source_processing_jobs)||'None'}</p><p>Source Package(s): ${esc(p.source_packages)||'None'}<br>Source Production Batch: ${esc(p.source_production_batch)||'None'}</p><label>Classification <select data-classify="${esc(p.tag)}">${['AUTO','MASTER','SPLIT','IGNORED'].map(c=>`<option value="${c}" ${(p.manual_classification||'AUTO')===c?'selected':''}>${c==='AUTO'?'Automatic / restore':c}</option>`).join('')}</select></label><button type="button" data-save-class="${esc(p.tag)}">Save classification</button>${!p.active?`<button type="button" data-reactivate="${esc(p.tag)}">Reactivate as master</button>`:''}<button type="button" data-history="${esc(p.tag)}">History & lineage</button><div data-history-output="${esc(p.tag)}"></div></article>`;
  }
  function renderAdmin() {
    if (!state.admin) return;
    const term=find('[data-admin-search]').value.trim().toLowerCase(), classification=find('[data-filter-class]').value, active=find('[data-filter-status]').value, retired=find('[data-filter-retired]').value;
    const rows=(state.historicalRows || state.rows).filter(p=>`${p.item} ${p.tag} ${p.production_batch_number}`.toLowerCase().includes(term) && (!classification||p.classification===classification) && (!active||(active==='active'?p.active:active==='retired'?p.retired_at:!p.active)) && (!retired||p.retired_at?.startsWith(retired)));
    find('[data-admin-rows]').innerHTML=`<p>${rows.length} packages</p>`+rows.map(adminRow).join('');
  }
  async function refresh() {
    state.rows=await api(state.admin?'/admin':'');
    if (state.admin) {
      state.imports=await api('/imports');
      const select=find('[data-filter-import]'), value=select.value;
      select.innerHTML='<option value="">All import dates</option>'+state.imports.map(i=>`<option value="${i.id}">${esc(i.imported_at)} — ${esc(i.file_name)}</option>`).join(''); select.value=value;
      find('[data-import-history]').innerHTML=state.imports.map(i=>`<details><summary>${esc(i.imported_at)} — ${esc(i.file_name)}</summary><pre>${esc(JSON.stringify(JSON.parse(i.summary),null,2))}</pre></details>`).join('')||'<p>No imports yet.</p>';
    }
    if (state.admin && find('[data-filter-import]').value) state.historicalRows=await api(`/imports/${find('[data-filter-import]').value}/packages`);
    renderEmployees();renderAdmin();
  }
  function previewHtml(result) {
    return `<h3>Import preview</h3><p>${esc(result.file_name||'Metrc Active Packages')}</p><p>${result.summary.total} packages: ${result.summary.MASTER} MASTER · ${result.summary.SPLIT} SPLIT · ${result.summary.REVIEW} REVIEW · ${result.summary.IGNORED} IGNORED</p>${result.summary.ordering?`<p>${result.summary.item_count} Item cards. Parent ordering: ${result.summary.ordering.expiration_date} by expiration, ${result.summary.ordering.use_by_date} by use-by, ${result.summary.ordering.packaged_date} by packaged date, ${result.summary.ordering.none} without dates.</p>`:''}<p>${result.summary.new_masters} new masters · ${result.summary.updated_masters} existing masters updated · ${result.summary.quantity_changes} quantities changed · ${result.summary.retired} retiring · ${result.summary.reactivated} reactivating</p>${Object.entries(result.changes).map(([name,rows])=>`<details><summary>${esc(name)} (${rows.length})</summary>${rows.map(p=>`<p><strong>${esc(p.item)}</strong><br>${esc(p.tag)} · ${qty(p)} · ${esc(p.classification)}<br>Expiration: ${date(p.expiration_date)} · Use-by: ${date(p.use_by_date)} · Last seen: ${date(p.last_seen_at)}${p.retirement_reason?'<br>'+esc(p.retirement_reason):''}</p>`).join('')}</details>`).join('')}${result.all_masters_retiring?'<label class="cp-error"><input type="checkbox" data-ack> I understand this report will retire every current master package.</label>':''}<p>Confirm only if this is the complete current Active Packages report. Missing master packages will be retired.</p><button type="button" data-confirm>Confirm import</button><button type="button" data-cancel>Cancel preview</button>`;
  }
  function manualForm() {
    return `<details class="cp-panel"><summary>Add parent package manually</summary><p>Use the full Metrc Tag. For a Tag already in this report, change its classification in Package review instead.</p><form data-manual-parent onsubmit="return false"><div class="cp-tools">${[['tag','Full Metrc Tag','text'],['item','Metrc Item name','text'],['quantity','Current quantity','number'],['unit_of_measure','Unit of measure (ea, g, etc.)','text'],['location','Location','text'],['production_batch_number','Production Batch Number (optional)','text'],['packaged_date','Packaged Date (optional)','date'],['expiration_date','Expiration Date (optional)','date'],['use_by_date','Use-By Date (optional)','date']].map(([name,label,type],i)=>`<label>${label}<input name="${name}" type="${type}" ${i<5?'required':''} ${type==='number'?'min="0" step="any"':''}></label>`).join('')}</div><p>The next confirmed complete Metrc report will retire this package if its Tag is absent. Its parent classification is remembered when it appears in a report.</p><button type="button" data-manual-save>Add parent package</button></form></details>`;
  }
  function initialize(root, canImport) {
    state.root=root;state.admin=canImport;
    root.classList.add('current-packages');
    root.innerHTML=`<h2>Current Packages</h2><p>Parent packages only. Customer split packages are excluded from these cards and quantities.</p><p>Order uses Expiration Date, then Use-By Date when expiration is blank; packages without either date follow in oldest Packaged Date order. Tag numbers do not determine age.</p><div class="cp-tools"><label>Search Item <input type="search" data-search placeholder="Search by Item"></label><button type="button" data-refresh>Refresh</button><button type="button" data-print>Print current packages</button></div><p data-status role="status" aria-live="polite"></p>${state.admin?`<section class="cp-panel cp-upload"><h3>Upload Metrc report</h3><p>Upload the complete .xlsx report. Package data changes only after you confirm the preview.</p><input type="file" data-file accept=".xlsx" aria-label="Metrc Active Packages Excel report"><button type="button" data-preview>Preview import</button><div data-preview-output></div></section>${manualForm()}`:'<section class="cp-panel cp-upload"><h3>Upload Metrc report</h3><p>An administrator can upload and confirm the report.</p><a class="cp-upload-link" href="/admin.html?tab=current-packages">Upload Metrc report — administrator sign-in</a></section>'}<div data-cards class="cp-grid"></div>${state.admin?`<details class="cp-panel" data-admin-panel><summary>Package review, history & lineage</summary><div class="cp-tools"><label>Item, Tag or batch<input type="search" data-admin-search></label><label>Classification<select data-filter-class><option value="">All classifications</option>${['MASTER','SPLIT','REVIEW','IGNORED'].map(c=>`<option>${c}</option>`).join('')}</select></label><label>Status<select data-filter-status><option value="">All statuses</option><option value="active">Active master</option><option value="retired">Retired</option><option value="inactive">Not in employee queue</option></select></label><label>Snapshot from import<select data-filter-import></select></label><label>Retirement date<input type="date" data-filter-retired></label></div><div data-admin-rows></div></details><details class="cp-panel"><summary>Import history</summary><div data-import-history></div></details>`:''}`;
    root.addEventListener('input',e=>{if(e.target.matches('[data-search]'))renderEmployees();else if(e.target.closest('.cp-tools'))renderAdmin();});
    root.addEventListener('change',e=>{if(e.target.matches('[data-filter-import]')) {busy(async()=>{state.historicalRows=e.target.value?await api(`/imports/${e.target.value}/packages`):null;renderAdmin();status(e.target.value?'Showing historical package snapshots. Classification actions apply to current records.':'Showing current records.');});} if(e.target.matches('[data-file]')){state.token=null;find('[data-preview-output]').innerHTML='';}});
    root.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||state.busy)return;
      if(b.hasAttribute('data-print')) { CurrentPackagesPrint.open(state.rows); return; }
      if(b.dataset.copy) return busy(async()=>{await navigator.clipboard.writeText(b.dataset.copy);status('Tag copied.');});
      if(b.hasAttribute('data-item-history')){state.historicalRows=null;find('[data-admin-search]').value=b.dataset.itemHistory;find('[data-filter-class]').value='';find('[data-filter-status]').value='';find('[data-filter-import]').value='';find('[data-filter-retired]').value='';find('[data-admin-panel]').open=true;renderAdmin();find('[data-admin-panel]').scrollIntoView({block:'start'});return;}
      if(b.hasAttribute('data-cancel')){state.token=null;find('[data-preview-output]').innerHTML='';status('Preview canceled. No package data changed.');return;}
      const manualData=b.hasAttribute('data-manual-save') ? Object.fromEntries(new FormData(find('[data-manual-parent]'))) : null;
      if(manualData && !find('[data-manual-parent]').reportValidity()) return;
      busy(async()=>{
        if(b.hasAttribute('data-manual-save')) {
          const form=find('[data-manual-parent]');
          status('Saving parent package…');
          await api('/manual-parent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(manualData)});
          form.reset();
          try { await refresh();status('Parent package added.'); } catch (_) { status('Parent package was saved. Click Refresh to reload the cards.',true); }
        }
        if(b.hasAttribute('data-refresh')){await refresh();status('Packages refreshed.');}
        if(b.hasAttribute('data-preview')){
          const file=find('[data-file]').files[0];if(!file)throw new Error('Choose a Metrc .xlsx file.');
          state.token=null;find('[data-preview-output]').innerHTML='';status('Reading report and preparing preview…');
          const result=await api('/preview',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});
          state.token=result.token;find('[data-preview-output]').innerHTML=previewHtml(result);status('Preview ready. No package data has changed.');
        }
        if(b.hasAttribute('data-confirm')){
          status('Saving import…');
          await api('/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:state.token,acknowledge_all_retirements:find('[data-ack]')?.checked||false})});
          state.token=null;find('[data-preview-output]').innerHTML='';
          status('Import saved. Refreshing packages…');
          try {await refresh();status('Import saved successfully.');}catch(err){status('Import was saved, but the display could not refresh. Click Refresh.',true);}
        }
        if(b.dataset.saveClass||b.dataset.reactivate){
          const tag=b.dataset.saveClass||b.dataset.reactivate, reactivate=Boolean(b.dataset.reactivate);
          const classification=reactivate?'MASTER':Array.from(root.querySelectorAll('[data-classify]')).find(el=>el.dataset.classify===tag).value;
          await api(`/${encodeURIComponent(tag)}/classification`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({classification,reactivate})});
          await refresh();status('Package classification saved.');
        }
        if(b.dataset.history){
          const result=await api(`/${encodeURIComponent(b.dataset.history)}/history`);
          const output=Array.from(root.querySelectorAll('[data-history-output]')).find(el=>el.dataset.historyOutput===b.dataset.history);
          output.innerHTML=`<h4>Source packages</h4>${result.parents.map(p=>`<p>${esc(p.tag)} · ${esc(p.item)} · ${esc(p.classification)}</p>`).join('')||'<p>No matching source records.</p>'}<h4>Child packages</h4>${result.children.map(p=>`<p>${esc(p.tag)} · ${esc(p.item)} · ${qty(p)} · ${esc(p.classification)}</p>`).join('')||'<p>No matching child records.</p>'}<h4>Package history</h4>${result.history.map(h=>{const p=JSON.parse(h.snapshot);return `<details><summary>${esc(h.recorded_at)} · ${esc(h.event)} · ${qty(p)}</summary><p>${esc(p.item)} · ${esc(p.tag)} · ${esc(p.classification)} · Import ${h.import_id??'manual'}</p>${details(p)}<p>First seen: ${date(p.first_seen_at)} · Last seen: ${date(p.last_seen_at)} · Retired: ${date(p.retired_at)}<br>${esc(p.retirement_reason)}</p></details>`;}).join('')}`;
        }
      });
    });
  }
  window.CurrentPackages={async load(){
    const root=document.querySelector('[data-current-packages]'); if(!root)return;
    if(!state.root) {
      let canImport=root.dataset.admin==='true';
      if(!canImport) { try { canImport=(await api('/access')).can_import===true; } catch (_) { /* The administrator link remains available. */ } }
      if(!state.root) initialize(root,canImport);
    }
    await busy(async()=>{status('Loading packages…');await refresh();status('');});
  }};
  if(new URLSearchParams(location.search).get('tab')==='current-packages' && typeof showAdminTab==='function') showAdminTab('activeSkus');
})();
