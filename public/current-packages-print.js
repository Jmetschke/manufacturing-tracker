const CurrentPackagesPrint = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(packages) {
    const popup=window.open('','_blank');
    if(!popup){alert('Allow pop-ups to open the package pull list.');return;}
    const groups=new Map();
    for(const p of packages.filter(p=>p.active && p.classification==='MASTER')){
      if(!groups.has(p.item_key))groups.set(p.item_key,[]);
      groups.get(p.item_key).push(p);
    }
    const rows=[];
    for(const [,items] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
      items.forEach((p,index)=>{
        const when=p.expiration_date || p.use_by_date || p.packaged_date;
        const basis=p.expiration_date?'Expiration':p.use_by_date?'Use-by':p.packaged_date?'Packaged (fallback)':'No date provided';
        const warnings=['administrative_hold','administrative_recall'].filter(field=>p[field]&&!/^(no|false|0)$/i.test(p[field])).map(field=>field==='administrative_hold'?'HOLD':'RECALL');
        rows.push(`<tr class="${index===0?'first':''}"><td><strong>${escape(p.item)}</strong><br><span>Batch: ${escape(p.production_batch_number)||'Not provided'}</span></td><td>${index===0?'<strong>USE FIRST</strong>':`Next ${index+1}`}</td><td class="tag">${escape(p.tag)}</td><td>${escape(Number(p.quantity).toLocaleString(undefined,{maximumFractionDigits:8}))} ${escape(p.unit_of_measure)}</td><td>${escape(when)||'Not provided'}<br><span>${basis}</span></td><td>${escape(p.location)}${p.sublocation?'<br>'+escape(p.sublocation):''}<br><span>${escape(p.lab_test_status)||'Lab status not provided'}</span>${warnings.length?'<br><strong>'+warnings.join(' · ')+'</strong>':''}</td></tr>`);
      });
    }
    popup.document.write(`<!doctype html><html><head><title>Current Packages — pull list</title><meta charset="utf-8"><style>
      @page{size:letter landscape;margin:0.4in}body{font:9pt Arial,sans-serif;color:#111;margin:16px}h1{font-size:16pt;margin:0 0 6px}p{margin:4px 0 10px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:6px;border:1px solid #888;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.first td{border-top:2px solid #222}.tag{font:9pt monospace;white-space:nowrap}span{font-size:8pt}.toolbar{margin-bottom:16px}.toolbar button{padding:10px}@media print{body{margin:0}.toolbar{display:none}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save PDF</button></div><h1>Current Packages — pull list</h1><p>${groups.size} Items · ${rows.length} active parent packages · Printed ${escape(new Date().toLocaleString())}</p><p>All current parents, in use order within each Item. Quantities reflect the latest saved report. Packaged dates are ordering fallbacks, not expiration dates.</p>${rows.length?`<table><colgroup><col style="width:25%"><col style="width:8%"><col style="width:22%"><col style="width:9%"><col style="width:15%"><col style="width:21%"></colgroup><thead><tr><th>Item / production batch</th><th>Use order</th><th>Metrc Tag</th><th>Quantity</th><th>Ordering date</th><th>Location / lab status</th></tr></thead><tbody>${rows.join('')}</tbody></table>`:'<p>No active parent packages to print.</p>'}</body></html>`);
    popup.document.close();popup.focus();
  }
  return {open};
})();
