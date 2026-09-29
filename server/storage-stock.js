// Receipt snapshots are immutable; storage_items holds only the adjustable stock balance.
module.exports = function ({runSql,getSql,allSql,withTransaction}) {
  const fail=(message,status=400)=>Object.assign(new Error(message),{status});
  async function initialize(){
    await runSql(`CREATE TABLE IF NOT EXISTS storage_stock_balances(item_id INTEGER PRIMARY KEY)`);
    await runSql(`CREATE TABLE IF NOT EXISTS storage_stock_receipts(
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_id INTEGER NOT NULL,
      standard_item_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, item_name TEXT NOT NULL,
      last_location TEXT NOT NULL, received_at TEXT, archived_at TEXT NOT NULL,
      original_quantity REAL NOT NULL, original_unit TEXT NOT NULL, original_units_per_package INTEGER,
      credited_quantity REAL NOT NULL, stock_unit TEXT NOT NULL, snapshot TEXT NOT NULL,
      UNIQUE(source,source_id))`);
    await runSql(`CREATE TABLE IF NOT EXISTS storage_manual_origins(
      item_id INTEGER PRIMARY KEY, item_name TEXT, quantity REAL, unit TEXT, units_per_package INTEGER, placed_at TEXT)`);
    await runSql(`INSERT OR IGNORE INTO storage_manual_origins SELECT id,item_name,quantity,unit,units_per_package,placed_at FROM storage_items`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS capture_manual_origin AFTER INSERT ON storage_items BEGIN
      INSERT OR IGNORE INTO storage_manual_origins VALUES(NEW.id,NEW.item_name,NEW.quantity,NEW.unit,NEW.units_per_package,NEW.placed_at); END`);
    await runSql(`CREATE TABLE IF NOT EXISTS storage_stock_adjustments(
      id INTEGER PRIMARY KEY AUTOINCREMENT, stock_id INTEGER NOT NULL, previous_quantity REAL NOT NULL,
      quantity REAL NOT NULL, changed_at TEXT NOT NULL)`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS lock_stock_mapping BEFORE UPDATE OF standard_item_id,unit,units_per_package ON storage_items
      WHEN EXISTS(SELECT 1 FROM storage_stock_balances WHERE item_id=OLD.id) AND
      (NEW.standard_item_id IS NOT OLD.standard_item_id OR NEW.unit IS NOT OLD.unit OR NEW.units_per_package IS NOT OLD.units_per_package)
      BEGIN SELECT RAISE(ABORT,'Standard stock units and mapping cannot be changed after receipts are credited'); END`);
  }
  async function reconcile(){
    await withTransaction(async tx=>{
      const deliveries=await allSql(`SELECT o.*, l.id AS location_id, l.name AS room_name,
        a.standard_item_id, s.name AS standard_name, coalesce(q.quantity,o.package_qty) AS current_quantity,
        CASE WHEN q.ordered_item_id IS NOT NULL THEN q.units_per_package ELSE o.units_per_package END AS current_units,
        c.category FROM ordered_items o JOIN item_aliases a ON a.vendor_key=lower(trim(o.original_supplier)) AND a.description_key=lower(trim(o.original_description))
        JOIN standard_items s ON s.id=a.standard_item_id LEFT JOIN storage_delivery_quantities q ON q.ordered_item_id=o.id
        LEFT JOIN storage_delivery_placements p ON p.ordered_item_id=o.id
        JOIN storage_locations l ON (CASE WHEN p.ordered_item_id IS NOT NULL THEN l.id=p.location_id ELSE l.name=trim(o.received_location) COLLATE NOCASE END)
        LEFT JOIN storage_item_categories c ON c.source='delivery' AND c.item_id=o.id
        WHERE o.received_date IS NOT NULL AND l.deleted=0`,[],tx);
      const manual=await allSql(`SELECT i.*, l.name AS room_name, s.name AS standard_name,c.category FROM storage_items i
        JOIN standard_items s ON s.id=i.standard_item_id JOIN storage_locations l ON l.id=i.location_id
        LEFT JOIN storage_item_categories c ON c.source='manual' AND c.item_id=i.id
        WHERE l.deleted=0 AND NOT EXISTS(SELECT 1 FROM storage_stock_balances b WHERE b.item_id=i.id)`,[],tx);
      for(const item of [...deliveries.map(i=>({...i,source:'delivery'})),...manual.map(i=>({...i,source:'manual'}))]){
        const delivery=item.source==='delivery';
        const already=await getSql('SELECT id FROM storage_stock_receipts WHERE source=? AND source_id=?',[item.source,item.id],tx);
        if(!already){
          const quantity=Number(delivery?item.current_quantity:item.quantity), units=delivery?item.current_units:item.units_per_package;
          const packageUnit=delivery || /^(packages?|boxes|box|cases?|packs?)$/i.test(item.unit);
          const converted=packageUnit && units!=null && Number(units)>0;
          const sourceUnit=String(item.unit || '').trim().toLowerCase();
          const stockUnit=converted || /^(ea|each|units?)$/.test(sourceUnit)?'units':delivery?'packages':sourceUnit;
          const credit=converted?quantity*Number(units):quantity;
          if(!Number.isFinite(credit) || credit<0) throw fail('Cannot convert an invalid inventory quantity.');
          let balance=await getSql(`SELECT i.* FROM storage_items i JOIN storage_stock_balances b ON b.item_id=i.id
            WHERE i.location_id=? AND i.standard_item_id=? AND i.unit=? ORDER BY i.id LIMIT 1`,[item.location_id,item.standard_item_id,stockUnit],tx);
          if(!balance){
            const result=await runSql(`INSERT INTO storage_items(location_id,item_name,quantity,unit,standard_item_id,units_per_package,notes)
              VALUES(?,?,?,?,?,NULL,'')`,[item.location_id,item.standard_name,0,stockUnit,item.standard_item_id],tx);
            balance={id:Number(result.lastID)};
            await runSql('INSERT INTO storage_stock_balances(item_id) VALUES(?)',[balance.id],tx);
            if(item.category) await runSql('INSERT INTO storage_item_categories(source,item_id,category) VALUES(?,?,?)',['manual',balance.id,item.category],tx);
          }
          const origin=delivery?item:await getSql('SELECT * FROM storage_manual_origins WHERE item_id=?',[item.id],tx)||item;
          await runSql(`INSERT INTO storage_stock_receipts(source,source_id,standard_item_id,stock_id,item_name,last_location,received_at,archived_at,
            original_quantity,original_unit,original_units_per_package,credited_quantity,stock_unit,snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [item.source,item.id,item.standard_item_id,balance.id,delivery?item.original_description||item.item_name:origin.item_name,item.room_name,
              delivery?item.received_date:origin.placed_at,new Date().toISOString(),delivery?item.package_qty:origin.quantity,delivery?'packages':origin.unit,
              delivery?item.units_per_package:origin.units_per_package,credit,stockUnit,JSON.stringify({original:origin,current_at_conversion:item})],tx);
          await runSql('UPDATE storage_items SET quantity=quantity+? WHERE id=?',[credit,balance.id],tx);
        }
        if(delivery) await runSql(`INSERT INTO storage_delivery_placements(ordered_item_id,location_id) VALUES(?,NULL)
          ON CONFLICT(ordered_item_id) DO UPDATE SET location_id=NULL`,[item.id],tx);
        else await runSql('DELETE FROM storage_items WHERE id=?',[item.id],tx);
      }
      // Room moves/consolidation can bring two balances together. Merge compatible units only.
      const balances=await allSql(`SELECT i.*,c.category FROM storage_items i JOIN storage_stock_balances b ON b.item_id=i.id
        LEFT JOIN storage_item_categories c ON c.source='manual' AND c.item_id=i.id ORDER BY i.id`,[],tx);
      const groups=new Map();
      for(const row of balances){
        const key=JSON.stringify([row.location_id,row.standard_item_id,row.unit]);
        if(!groups.has(key)){groups.set(key,row);continue;}
        const kept=groups.get(key);
        await runSql('UPDATE storage_items SET quantity=quantity+? WHERE id=?',[row.quantity,kept.id],tx);
        await runSql('UPDATE storage_stock_receipts SET stock_id=? WHERE stock_id=?',[kept.id,row.id],tx);
        await runSql('UPDATE storage_stock_adjustments SET stock_id=? WHERE stock_id=?',[kept.id,row.id],tx);
        if(kept.category!==row.category){await runSql("DELETE FROM storage_item_categories WHERE source='manual' AND item_id=?",[kept.id],tx);kept.category=null;}
        await runSql('DELETE FROM storage_items WHERE id=?',[row.id],tx);
      }
    });
  }
  async function enrich(items){
    const ids=new Set((await allSql('SELECT item_id FROM storage_stock_balances')).map(r=>r.item_id));
    return items.map(item=>({...item,is_stock:item.source==='manual' && ids.has(item.id)}));
  }
  async function adjust(id,body){
    if(!Number.isSafeInteger(id) || id<=0) throw fail('Invalid stock item.');
    if(typeof body.quantity!=='number'||!Number.isFinite(body.quantity)||body.quantity<0)throw fail('Enter a nonnegative current quantity.');
    return withTransaction(async tx=>{
      const item=await getSql('SELECT i.* FROM storage_items i JOIN storage_stock_balances b ON b.item_id=i.id WHERE i.id=?',[id],tx);
      if(!item)throw fail('Stock item not found.',404);
      if(item.quantity!==body.expected_quantity)throw fail('Stock changed since you opened this card. Refresh before saving.',409);
      await runSql('INSERT INTO storage_stock_adjustments(stock_id,previous_quantity,quantity,changed_at) VALUES(?,?,?,?)',[id,item.quantity,body.quantity,new Date().toISOString()],tx);
      await runSql('UPDATE storage_items SET quantity=? WHERE id=?',[body.quantity,id],tx);
      return {message:'Current stock updated. Original receipts unchanged.'};
    });
  }
  async function receipts(){const rows=await allSql(`SELECT r.id,r.source,r.source_id,r.stock_id,r.item_name,r.last_location,r.received_at,r.archived_at,
    r.original_quantity,r.original_unit,r.original_units_per_package,r.credited_quantity,r.stock_unit,r.snapshot,s.name AS standard_item_name
    FROM storage_stock_receipts r LEFT JOIN standard_items s ON s.id=r.standard_item_id ORDER BY r.id DESC`);
    return rows.map(({snapshot,...row})=>{const original=JSON.parse(snapshot).original;return {...row,supplier:original.original_supplier || original.item_supplier || '',received_by:original.received_by || '',notes:original.received_notes || original.notes || '',order_reference:original.item_company || ''};});
  }
  function register(app){
    const route=(method,path,fn)=>app[method](path,async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json({message:e.status?e.message:'Unable to save inventory. Please retry.'});}});
    route('get','/storage-stock/receipts',receipts);
    route('post','/storage-stock/reconcile',async()=>{await reconcile();return {message:'Stock synchronized'};});
    route('post','/storage-stock/:id/quantity',req=>adjust(Number(req.params.id),req.body));
  }
  const isCredited=async(source,id)=>Boolean(await getSql(source==='manual'?'SELECT item_id FROM storage_stock_balances WHERE item_id=?':'SELECT id FROM storage_stock_receipts WHERE source=\'delivery\' AND source_id=?',[id]));
  return {initialize,reconcile,enrich,adjust,receipts,register,isCredited};
};
