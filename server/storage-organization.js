const categories = ['Ingredients', 'Packaging', 'Equipment', 'Misc'];
module.exports = function ({ runSql, getSql, allSql, withTransaction }) {
  const fail = (message, status=400) => Object.assign(new Error(message), {status});
  async function initialize() {
    await runSql(`CREATE TABLE IF NOT EXISTS storage_item_categories (
      source TEXT NOT NULL, item_id INTEGER NOT NULL, category TEXT NOT NULL,
      PRIMARY KEY(source,item_id))`);
    await runSql(`CREATE TABLE IF NOT EXISTS storage_item_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL, category TEXT, last_location TEXT NOT NULL,
      received_at TEXT, placed_at TEXT, archived_at TEXT NOT NULL, snapshot TEXT NOT NULL)`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS storage_manual_category_cleanup AFTER DELETE ON storage_items BEGIN
      DELETE FROM storage_item_categories WHERE source='manual' AND item_id=OLD.id; END`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS storage_delivery_category_cleanup AFTER DELETE ON ordered_items BEGIN
      DELETE FROM storage_item_categories WHERE source='delivery' AND item_id=OLD.id; END`);
  }
  async function enrich(items) {
    const rows = await allSql('SELECT * FROM storage_item_categories');
    const map = new Map(rows.map(r=>[`${r.source}:${r.item_id}`,r.category]));
    return items.map(item=>({...item,category:map.get(`${item.source}:${item.id}`)||null}));
  }
  async function current(source,id,tx) {
    if (!['manual','delivery'].includes(source) || !Number.isSafeInteger(id) || id<=0) throw fail('Invalid item.');
    const item = await getSql(source==='manual' ? `SELECT s.*, l.name AS last_location, s.placed_at, NULL AS received_at,
      standard.name AS standard_item_name FROM storage_items s JOIN storage_locations l ON l.id=s.location_id
      LEFT JOIN standard_items standard ON standard.id=s.standard_item_id WHERE s.id=? AND l.deleted=0` :
      `SELECT o.*, l.name AS last_location, o.received_date AS received_at, o.received_date AS placed_at,
      coalesce(q.quantity,o.package_qty) AS quantity, 'packages' AS unit,
      CASE WHEN q.ordered_item_id IS NOT NULL THEN q.units_per_package ELSE o.units_per_package END AS current_units_per_package
      FROM ordered_items o LEFT JOIN storage_delivery_placements p ON p.ordered_item_id=o.id
      LEFT JOIN storage_delivery_quantities q ON q.ordered_item_id=o.id
      JOIN storage_locations l ON (CASE WHEN p.ordered_item_id IS NOT NULL THEN l.id=p.location_id
      ELSE l.name=trim(o.received_location) COLLATE NOCASE END)
      WHERE o.id=? AND o.received_date IS NOT NULL AND l.deleted=0`,[id],tx);
    if (!item) throw fail('This item is no longer in a location. Refresh the page.',404);
    return item;
  }
  async function classify(source,id,category) {
    if (category!==null && !categories.includes(category)) throw fail('Choose Ingredients, Packaging, Equipment, or Misc.');
    return withTransaction(async tx=>{
      await current(source,id,tx);
      if (category===null) await runSql('DELETE FROM storage_item_categories WHERE source=? AND item_id=?',[source,id],tx);
      else await runSql(`INSERT INTO storage_item_categories(source,item_id,category) VALUES(?,?,?)
        ON CONFLICT(source,item_id) DO UPDATE SET category=excluded.category`,[source,id,category],tx);
      return {message:'Classification saved.'};
    });
  }
  async function archive(source,id) {
    return withTransaction(async tx=>{
      const item=await current(source,id,tx);
      const category=(await getSql('SELECT category FROM storage_item_categories WHERE source=? AND item_id=?',[source,id],tx))?.category || null;
      await runSql(`INSERT INTO storage_item_archives(source,item_id,item_name,category,last_location,received_at,placed_at,archived_at,snapshot)
        VALUES(?,?,?,?,?,?,?,?,?)`,[source,id,item.standard_item_name || item.item_name,category,item.last_location,item.received_at,item.placed_at,new Date().toISOString(),JSON.stringify(item)],tx);
      if(source==='manual') await runSql('DELETE FROM storage_items WHERE id=?',[id],tx);
      else await runSql(`INSERT INTO storage_delivery_placements(ordered_item_id,location_id) VALUES(?,NULL)
        ON CONFLICT(ordered_item_id) DO UPDATE SET location_id=NULL`,[id],tx);
      return {message:'Item archived.'};
    });
  }
  const archives=()=>allSql('SELECT id,source,item_id,item_name,category,last_location,received_at,placed_at,archived_at FROM storage_item_archives ORDER BY archived_at DESC,id DESC');
  function register(app) {
    const route=(method,path,fn)=>app[method](path,async(req,res)=>{try {res.json(await fn(req));}catch(e){res.status(e.status||500).json({message:e.status?e.message:'Unable to update storage. Please retry.'});}});
    route('get','/storage-archives',archives);
    route('post','/storage-items/:source/:id/classification',req=>classify(req.params.source,Number(req.params.id),req.body.category));
    route('post','/storage-items/:source/:id/archive',req=>archive(req.params.source,Number(req.params.id)));
  }
  return {initialize,enrich,classify,archive,archives,register};
};
