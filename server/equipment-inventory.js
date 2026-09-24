// Equipment and ingredients intentionally use a different catalog from production items.
module.exports = function inventoryService({ runSql, allSql, getSql, addMissingColumn, withTransaction }) {
  const key = value => String(value || '').trim().toLowerCase();
  const fail = (message, status = 400) => Object.assign(new Error(message), { status });
  function count(value, optional = false) {
    if (optional && (value === '' || value === null || value === undefined)) return null;
    if (value === null || value === undefined || value === '' || !['number', 'string'].includes(typeof value)) throw fail('Enter a valid quantity.');
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (optional && !Number.isInteger(number))) throw fail('Enter a nonnegative quantity; items per package must be a whole number or blank.');
    return number;
  }
  async function initialize() {
    await runSql(`CREATE TABLE IF NOT EXISTS standard_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')))`);
    await runSql(`CREATE TABLE IF NOT EXISTS item_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT, standard_item_id INTEGER NOT NULL,
      vendor TEXT NOT NULL, description TEXT NOT NULL, vendor_key TEXT NOT NULL,
      description_key TEXT NOT NULL, vendor_sku TEXT, manufacturer TEXT, model TEXT,
      UNIQUE(vendor_key, description_key))`);
    await addMissingColumn('ordered_items', 'original_description', 'TEXT');
    await addMissingColumn('ordered_items', 'original_supplier', 'TEXT');
    await addMissingColumn('storage_items', 'standard_item_id', 'INTEGER');
    await addMissingColumn('storage_items', 'units_per_package', 'INTEGER');
    await runSql(`CREATE TABLE IF NOT EXISTS storage_delivery_quantities (
      ordered_item_id INTEGER PRIMARY KEY, quantity REAL NOT NULL,
      units_per_package INTEGER, updated_at TEXT DEFAULT (datetime('now')))`);
    // Snapshot existing text once, then capture every insert path, including manual orders.
    await runSql(`UPDATE ordered_items SET original_description = coalesce(original_description, item_name),
      original_supplier = coalesce(original_supplier, item_supplier)
      WHERE original_description IS NULL OR original_supplier IS NULL`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS ordered_items_capture_source AFTER INSERT ON ordered_items BEGIN
      UPDATE ordered_items SET original_description = coalesce(NEW.original_description, NEW.item_name),
        original_supplier = coalesce(NEW.original_supplier, NEW.item_supplier) WHERE id = NEW.id;
      END`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS ordered_items_protect_source BEFORE UPDATE ON ordered_items
      WHEN (OLD.original_description IS NOT NULL AND NEW.original_description IS NOT OLD.original_description)
        OR (OLD.original_supplier IS NOT NULL AND NEW.original_supplier IS NOT OLD.original_supplier)
      BEGIN SELECT RAISE(ABORT, 'Original order descriptions and suppliers cannot be overwritten'); END`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS storage_reset_quantity_on_unreceive AFTER UPDATE OF received_date ON ordered_items
      WHEN OLD.received_date IS NOT NULL AND NEW.received_date IS NULL
      BEGIN DELETE FROM storage_delivery_quantities WHERE ordered_item_id = NEW.id; END`);
    await runSql(`CREATE TRIGGER IF NOT EXISTS storage_cleanup_deleted_order AFTER DELETE ON ordered_items
      BEGIN DELETE FROM storage_delivery_quantities WHERE ordered_item_id = OLD.id;
      DELETE FROM storage_delivery_placements WHERE ordered_item_id = OLD.id; END`);
    await runSql('CREATE INDEX IF NOT EXISTS ordered_items_source_lookup ON ordered_items(lower(trim(original_supplier)), lower(trim(original_description)))');
  }
  // Resolve associations through aliases, so reassignment/removal applies to past and future orders.
  function orderColumns(prefix = 'ordered_items') {
    const match = `a.vendor_key = lower(trim(${prefix}.original_supplier)) AND a.description_key = lower(trim(${prefix}.original_description))`;
    return `${prefix}.original_description, ${prefix}.original_supplier,
      (SELECT s.name FROM item_aliases a JOIN standard_items s ON s.id = a.standard_item_id WHERE ${match}) AS standard_item_name,
      (SELECT a.standard_item_id FROM item_aliases a WHERE ${match}) AS standard_item_id`;
  }
  async function catalog() { return allSql('SELECT id, name FROM standard_items ORDER BY name COLLATE NOCASE'); }
  function register(app) {
    const route = (method, path, fn) => app[method](path, async (req, res) => {
      try { res.json(await fn(req)); } catch (err) { res.status(err.status || 500).json({ message: err.status ? err.message : 'Inventory operation failed' }); }
    });
    route('get', '/inventory/standard-items', catalog);
    // Signed-in room users can create a definition while adding an item; mapping management is admin-only.
    route('post', '/inventory/standard-items', async req => {
      const name = String(req.body.name || '').trim();
      if (!name || name.length > 200) throw fail('Enter an item name of 1–200 characters.');
      await runSql('INSERT OR IGNORE INTO standard_items(name, name_key) VALUES (?, ?)', [name, key(name)]);
      return getSql('SELECT id, name FROM standard_items WHERE name_key = ?', [key(name)]);
    });
    route('put', '/admin/inventory/standard-items/:id', async req => {
      const name = String(req.body.name || '').trim();
      if (!name || name.length > 200) throw fail('Enter an item name of 1–200 characters.');
      const duplicate = await getSql('SELECT id FROM standard_items WHERE name_key = ? AND id <> ?', [key(name), req.params.id]);
      if (duplicate) throw fail('That standard item already exists.', 409);
      const result = await runSql('UPDATE standard_items SET name = ?, name_key = ? WHERE id = ?', [name, key(name), req.params.id]);
      if (!result.changes) throw fail('Item not found.', 404);
      return { message: 'Item renamed' };
    });
    route('get', '/admin/inventory/mappings', async () => ({
      standard_items: await catalog(),
      mappings: await allSql(`SELECT a.*, s.name AS standard_item_name FROM item_aliases a JOIN standard_items s ON s.id = a.standard_item_id ORDER BY s.name, a.vendor, a.description`),
      unmapped: await allSql(`SELECT o.original_description AS description, o.original_supplier AS vendor,
        count(*) AS occurrences, max(o.date_ordered) AS most_recent_order, o.item_company AS latest_reference
        FROM ordered_items o WHERE NOT EXISTS (SELECT 1 FROM item_aliases a
          WHERE a.vendor_key = lower(trim(o.original_supplier)) AND a.description_key = lower(trim(o.original_description)))
        GROUP BY lower(trim(o.original_supplier)), lower(trim(o.original_description)) ORDER BY most_recent_order DESC`)
    }));
    route('post', '/admin/inventory/mappings', async req => {
      const { vendor, description, standard_item_id } = req.body;
      if (typeof vendor !== 'string' || typeof description !== 'string' || !description.trim() || description.length > 20000) throw fail('Choose a vendor description.');
      if (!Number.isSafeInteger(standard_item_id) || !await getSql('SELECT id FROM standard_items WHERE id = ?', [standard_item_id])) throw fail('Choose a standard item.');
      await runSql(`INSERT INTO item_aliases (vendor, description, vendor_key, description_key, standard_item_id)
        VALUES (?, ?, lower(trim(?)), lower(trim(?)), ?) ON CONFLICT(vendor_key, description_key) DO UPDATE SET standard_item_id = excluded.standard_item_id`,
      [vendor, description, vendor, description, standard_item_id]);
      return { message: 'Mapping saved for existing and future occurrences' };
    });
    route('delete', '/admin/inventory/mappings/:id', async req => {
      await runSql('DELETE FROM item_aliases WHERE id = ?', [req.params.id]);
      return { message: 'Mapping removed; order history preserved' };
    });
    route('post', '/storage-items/:source/:id/inventory', async req => {
      const { source, id } = req.params;
      if (!['manual', 'delivery'].includes(source) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw fail('Invalid inventory item.');
      const quantity = count(req.body.quantity);
      const units = count(req.body.units_per_package, true);
      await withTransaction(async tx => {
        const row = await getSql(source === 'manual' ? 'SELECT id FROM storage_items WHERE id = ?' : 'SELECT id FROM ordered_items WHERE id = ? AND received_date IS NOT NULL', [id], tx);
        if (!row) throw fail('Item no longer exists.', 404);
        if (source === 'manual') {
          const standardId = req.body.standard_item_id || null;
          if (standardId !== null && !await getSql('SELECT id FROM standard_items WHERE id = ?', [standardId], tx)) throw fail('Choose a valid standard item.');
          await runSql('UPDATE storage_items SET quantity = ?, units_per_package = ?, standard_item_id = ? WHERE id = ?', [quantity, units, standardId, id], tx);
        } else {
          await runSql(`INSERT INTO storage_delivery_quantities (ordered_item_id, quantity, units_per_package) VALUES (?, ?, ?)
            ON CONFLICT(ordered_item_id) DO UPDATE SET quantity = excluded.quantity, units_per_package = excluded.units_per_package, updated_at = datetime('now')`, [id, quantity, units], tx);
        }
      });
      return { message: 'Room inventory updated; original order quantities preserved' };
    });
  }
  return { initialize, register, orderColumns, count };
};
