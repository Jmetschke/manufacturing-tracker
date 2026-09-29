const StoragePrint = (() => {
  function open(locations) {
    const popup=window.open('','_blank');
    if(!popup){alert('Allow pop-ups to open the room inventory print view.');return;}
    const doc=popup.document;
    doc.write(`<!doctype html><html><head><title>Room inventory</title><style>
      @page { size:letter portrait; margin:0.5in; }
      * { box-sizing:border-box; }
      body { margin:0; font:10pt Arial,sans-serif; color:#111; background:white; }
      .toolbar { padding:16px; }
      .page { width:7.5in; height:9.95in; padding:0; margin:0 auto; break-after:page; page-break-after:always; }
      .page:last-child { break-after:auto; page-break-after:auto; }
      h1 { font-size:17pt; margin:0 0 4px; overflow-wrap:anywhere; }
      header { height:0.8in; overflow:hidden; }
      header p { margin:0; }
      .grid { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:0.15in; height:9in; }
      section { border:1px solid #777; padding:0.1in; min-width:0; min-height:0; }
      h2 { font-size:12pt; margin:0 0 8px; }
      .items p { margin:0 0 8px; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.25; }
      .measure { position:absolute; left:-10000px; width:3.675in; height:4.425in; padding:0.1in; border:1px solid; }
      @media print { .toolbar,.measure { display:none; } }
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save PDF</button><p>Each room starts on a new page. Select Letter portrait for the four-section layout.</p></div></body></html>`);
    doc.close();
    const el=(tag,text)=>{const node=doc.createElement(tag);if(text)node.textContent=text;return node;};
    const measure=el('section');measure.className='measure';const heading=el('h2','Category');const content=el('div');content.className='items';measure.append(heading,content);doc.body.append(measure);
    const fits=()=>content.getBoundingClientRect().bottom<=measure.getBoundingClientRect().bottom-12;
    function paginate(items) {
      const pages=[[]];content.replaceChildren();
      for(let text of items) {
        while(text){
          const p=el('p',text);content.append(p);
          if(fits()){pages.at(-1).push(text);break;}
          p.remove();
          if(pages.at(-1).length){pages.push([]);content.replaceChildren();continue;}
          // Split a single long entry rather than clipping notes or losing an item.
          content.append(p);let low=1,high=text.length;
          while(low<high){const mid=Math.ceil((low+high)/2);p.textContent=text.slice(0,mid);if(fits())low=mid;else high=mid-1;}
          let cut=low;const space=text.lastIndexOf(' ',cut);if(space>cut/2)cut=space;
          const part=text.slice(0,cut);p.textContent=part;pages.at(-1).push(part);
          text='(continued) '+text.slice(cut).trimStart();pages.push([]);content.replaceChildren();
        }
      }
      return pages;
    }
    const names=['Ingredients','Packaging','Equipment','Misc'];
    const stamp=new Date().toLocaleString();
    locations.forEach(room=>{
      const groups=names.map(name=>({name,items:room.items.filter(item=>item.category===name)}));
      const unclassified=room.items.filter(item=>!item.category);
      if(unclassified.length)groups.push({name:'Needs classification',items:unclassified});
      const chunks=groups.map(group=>({name:group.name,pages:paginate(group.items.map(item=>[
        item.standard_item_name || item.item_name,
        `${item.quantity ?? '—'} ${item.unit || ''}${item.units_per_package==null?'':` · ${item.units_per_package} items/package`}`,
        `${item.source==='delivery'?'Received':'Placed'}: ${item.placed_at || 'Not recorded'}`,
        item.notes || ''
      ].filter(Boolean).join('\n')))}));
      const pageCount=Math.max(...chunks.slice(0,4).map(group=>group.pages.length));
      const extra=chunks[4]?.pages.length || 0;
      for(let index=0;index<pageCount+extra;index++){
        const page=el('article');page.className='page';const header=el('header');
        header.append(el('h1',room.name),el('p',`Room inventory · Page ${index+1} of ${pageCount+extra} · Printed ${stamp}`));page.append(header);
        const grid=el('div');grid.className='grid';
        const visible=index<pageCount?chunks.slice(0,4):[chunks[4]];
        visible.forEach(group=>{const section=el('section');section.append(el('h2',group.name));const list=el('div');list.className='items';
          const entries=group.pages[index<pageCount?index:index-pageCount];
          (entries?.length?entries:[index===0?'No items in this category.':'No additional items.']).forEach(text=>list.append(el('p',text)));
          section.append(list);grid.append(section);
        });page.append(grid);doc.body.append(page);
      }
    });
    measure.remove();
    if(!locations.length)doc.body.append(el('p','No rooms to print.'));
    popup.focus();
  }
  return {open};
})();
