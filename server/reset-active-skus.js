// User-requested reset for the Active SKUs rebuild. The marker prevents future
// restarts from deleting records created by the replacement feature.
module.exports = async function resetActiveSkus({ runSql, getSql, withTransaction }) {
  await runSql(`CREATE TABLE IF NOT EXISTS application_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await withTransaction(async transaction => {
    const name = '2026-09-25-reset-active-skus';
    if (await getSql('SELECT name FROM application_migrations WHERE name = ?', [name], transaction)) return;
    for (const table of ['active_sku_selections', 'active_sku_withholdings',
      'deleted_active_skus', 'active_sku_import_settings', 'active_skus']) {
      await runSql(`DELETE FROM ${table}`, [], transaction);
    }
    await runSql('INSERT INTO application_migrations (name) VALUES (?)', [name], transaction);
  });
};
