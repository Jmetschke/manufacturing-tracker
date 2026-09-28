const crypto = require('crypto');
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const key = value => clean(value).toLowerCase();
const header = value => key(value).replace(/[^a-z0-9]/g, '');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const fields = ['tag','item','category','quantity','unit_of_measure','location','sublocation','production_batch_number','source_production_batch','source_packages','source_processing_jobs','original_source_package_label','source_harvests','item_strain','lab_test_status','finished_goods','administrative_hold','administrative_recall','packaged_date','received','expiration_date','use_by_date','lab_test_expiration'];
function date(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) { if (Number.isNaN(+value)) throw fail('Invalid workbook date.'); return value.toISOString().slice(0, 10); }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) throw fail('Invalid Excel date.');
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }
  const text = clean(value);
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) { const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/i); if (us) match = [us[0], us[3], us[1].padStart(2,'0'), us[2].padStart(2,'0')]; }
  if (!match) throw fail(`Invalid date: ${text}`);
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(+parsed) || parsed.toISOString().slice(0,10) !== result) throw fail(`Invalid date: ${text}`);
  return result;
}
function classify(p, packages = []) {
  if (p.production_batch_number && !p.source_production_batch) return ['MASTER', 'Production Batch Number is populated and Source Production Batch is blank.'];
  if (!p.production_batch_number && p.source_production_batch) {
    const linked = packages.some(other => other.tag !== p.tag && other.item_key === p.item_key && sourceTags(p).includes(other.tag));
    return ['SPLIT', `Source Production Batch is populated and Production Batch Number is blank.${linked ? ' Source tag references another package for the same Item.' : ''}`];
  }
  return ['REVIEW', 'Batch fields do not clearly identify a master or split package.'];
}
function sourceTags(p) { return clean(p.source_packages).split(/[\s,;|]+/).filter(Boolean); }
function parseRows(rows) {
  const required = ['tag','item','quantity','unitofmeasure','location','productionbatchnumber','sourceproductionbatch'];
  const at = rows.findIndex(row => required.every(name => row.map(header).includes(name)));
  if (at < 0) throw fail('Missing required columns: Tag, Item, Quantity, Unit Of Measure, Location, Production Batch Number, Source Production Batch. Upload the complete Active Packages report.');
  const names = rows[at].map(header);
  if (new Set(names.filter(Boolean)).size !== names.filter(Boolean).length) throw fail('Duplicate column headers in report.');
  const result = [], seen = new Set();
  for (const [index, row] of rows.slice(at + 1).entries()) {
    if (!row.some(value => clean(value))) continue;
    const p = {};
    for (const field of fields) {
      const name = field === 'source_packages' ? 'sourcepackages' : header(field);
      p[field] = row[names.indexOf(name)] ?? '';
    }
    for (const field of fields) {
      if (field.endsWith('_date') || field === 'lab_test_expiration' || field === 'received') p[field] = date(p[field]);
      else p[field] = clean(p[field]);
    }
    if (!p.tag || !p.item || !p.location || !p.quantity || !p.unit_of_measure) throw fail(`Incomplete package on row ${at + index + 2}. No data was changed.`);
    if (seen.has(p.tag)) throw fail(`Duplicate Tag ${p.tag}. No data was changed.`);
    seen.add(p.tag);
    p.quantity = Number(p.quantity.replace(/,/g, ''));
    if (!Number.isFinite(p.quantity) || p.quantity < 0) throw fail(`Invalid quantity for ${p.tag}.`);
    p.item_key = key(p.item);
    result.push(p);
  }
  if (!result.length) throw fail('The report contains no packages. Empty reports cannot retire packages.');
  for (const p of result) [p.automatic_classification, p.classification_reason] = classify(p, result);
  return result;
}
function orderingBasis(p) { return p.expiration_date ? 'expiration_date' : p.use_by_date ? 'use_by_date' : p.packaged_date ? 'packaged_date' : 'none'; }
function compare(a, b) {
  // Dated packages precede undated packages; packaged dates order the latter.
  const ad = a.expiration_date || a.use_by_date, bd = b.expiration_date || b.use_by_date;
  return (ad ? 0 : 1) - (bd ? 0 : 1) || (ad || a.packaged_date || '9999').localeCompare(bd || b.packaged_date || '9999') || (a.packaged_date || '9999').localeCompare(b.packaged_date || '9999') || a.tag.localeCompare(b.tag);
}
module.exports = function service({ runSql, allSql, getSql, withTransaction, readWorkbook }) {
  const pending = new Map();
  async function initialize() {
    await runSql(`CREATE TABLE IF NOT EXISTS package_imports(id INTEGER PRIMARY KEY AUTOINCREMENT, file_name TEXT NOT NULL, imported_at TEXT NOT NULL, summary TEXT NOT NULL)`);
    await runSql(`CREATE TABLE IF NOT EXISTS metrc_packages(tag TEXT PRIMARY KEY, item_key TEXT NOT NULL, data TEXT NOT NULL, classification TEXT NOT NULL, active INTEGER NOT NULL, present_in_latest_import INTEGER NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, retired_at TEXT, retirement_reason TEXT, last_import_id INTEGER)`);
    await runSql(`CREATE TABLE IF NOT EXISTS package_classification_overrides(tag TEXT PRIMARY KEY, classification TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await runSql(`CREATE TABLE IF NOT EXISTS package_history(id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL, import_id INTEGER, recorded_at TEXT NOT NULL, event TEXT NOT NULL, snapshot TEXT NOT NULL)`);
    await runSql('CREATE INDEX IF NOT EXISTS package_history_tag ON package_history(tag, id)');
    await runSql('CREATE INDEX IF NOT EXISTS metrc_packages_item ON metrc_packages(item_key, active)');
  }
  const unpack = row => ({ ...JSON.parse(row.data), ...Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'data')) });
  async function packages(tx) { return (await allSql('SELECT * FROM metrc_packages', [], tx)).map(unpack); }
  async function revision(tx) {
    const data = await allSql('SELECT * FROM metrc_packages ORDER BY tag', [], tx);
    const overrides = await allSql('SELECT * FROM package_classification_overrides ORDER BY tag', [], tx);
    return crypto.createHash('sha256').update(JSON.stringify([data, overrides])).digest('hex');
  }
  async function plan(rows, tx) {
    const existing = await packages(tx), old = new Map(existing.map(p => [p.tag,p]));
    const overrides = new Map((await allSql('SELECT * FROM package_classification_overrides', [], tx)).map(p => [p.tag,p.classification]));
    const incoming = rows.map(p => ({ ...p, classification: overrides.get(p.tag) || p.automatic_classification, manual_classification: overrides.get(p.tag) || null }));
    const tags = new Map(incoming.map(p => [p.tag,p]));
    const changes = { added: [], updated: [], retired: [], reactivated: [], review: [] };
    let quantityChanges = 0;
    for (const p of incoming) {
      const prev = old.get(p.tag);
      if (!prev) changes.added.push(p);
      else {
        changes.updated.push(p);
        if (prev.quantity !== p.quantity) quantityChanges++;
        if (!prev.active && p.classification === 'MASTER') changes.reactivated.push(p);
      }
      if (p.classification === 'REVIEW') changes.review.push(p);
    }
    for (const p of existing) if (p.active && (!tags.has(p.tag) || tags.get(p.tag).classification !== 'MASTER')) changes.retired.push({ ...p, retirement_reason: 'No longer present as an active master package in latest Metrc Active Packages report.' });
    const masters = incoming.filter(p => p.classification === 'MASTER');
    const ordering = { expiration_date: 0, use_by_date: 0, packaged_date: 0, none: 0 };
    masters.forEach(p => ordering[orderingBasis(p)]++);
    const counts = Object.fromEntries(['MASTER','SPLIT','REVIEW','IGNORED'].map(c => [c, incoming.filter(p => p.classification === c).length]));
    return { incoming, changes, summary: { total: incoming.length, item_count: new Set(masters.map(p=>p.item_key)).size, ordering, ...counts, new_masters: changes.added.filter(p=>p.classification==='MASTER').length, updated_masters: changes.updated.filter(p=>p.classification==='MASTER').length, quantity_changes: quantityChanges, retired: changes.retired.length, reactivated: changes.reactivated.length } };
  }
  async function preview(buffer, fileName) {
    let workbook;
    try { workbook = await readWorkbook(buffer); } catch (_) { throw fail('The file is not a readable Excel .xlsx workbook. No data was changed.'); }
    const rows = parseRows(workbook);
    for (const [token, value] of pending) if (value.expires < Date.now()) pending.delete(token);
    if (pending.size >= 20) throw fail('Too many open previews. Please wait for an earlier preview to expire.', 429);
    // Read comparison and revision together so a concurrent import cannot make a misleading preview.
    const result = await withTransaction(async tx => ({ ...(await plan(rows, tx)), revision: await revision(tx) }));
    const token = crypto.randomUUID();
    pending.set(token, { rows, fileName: clean(fileName).slice(0,255) || 'Active Packages.xlsx', revision: result.revision, expires: Date.now()+15*60*1000 });
    return { token, file_name: clean(fileName), summary: result.summary, changes: result.changes, all_masters_retiring: result.changes.retired.length > 0 && result.summary.MASTER === 0 };
  }
  async function save(p, tx) {
    const meta = ['tag','item_key','classification','active','present_in_latest_import','first_seen_at','last_seen_at','retired_at','retirement_reason','last_import_id'];
    await runSql(`INSERT INTO metrc_packages(${meta.join(',')},data) VALUES (${meta.map(()=>'?').join(',')},?) ON CONFLICT(tag) DO UPDATE SET ${meta.slice(1).map(k=>`${k}=excluded.${k}`).join(',')},data=excluded.data`, [...meta.map(k=>p[k] ?? null), JSON.stringify(p)], tx);
  }
  async function history(p, event, importId, tx) { await runSql('INSERT INTO package_history(tag,import_id,recorded_at,event,snapshot) VALUES(?,?,?,?,?)',[p.tag,importId,new Date().toISOString(),event,JSON.stringify(p)],tx); }
  async function apply(token, acknowledge) {
    const draft = pending.get(token);
    if (!draft || draft.expires < Date.now()) throw fail('Preview expired. Upload the report again.',410);
    return withTransaction(async tx => {
      if (await revision(tx) !== draft.revision) throw fail('Package data changed after this preview. Upload again to review the latest changes.',409);
      const result = await plan(draft.rows,tx);
      if (result.changes.retired.length && !result.summary.MASTER && acknowledge !== true) throw fail('This report would retire every master package. Explicitly acknowledge this in the preview before confirming.');
      const now = new Date().toISOString();
      const inserted = await runSql('INSERT INTO package_imports(file_name,imported_at,summary) VALUES(?,?,?)',[draft.fileName,now,JSON.stringify(result.summary)],tx);
      const id = Number(inserted.lastID);
      const existing = new Map((await packages(tx)).map(p=>[p.tag,p]));
      const incomingTags = new Set(result.incoming.map(p=>p.tag));
      for (const row of result.incoming) {
        const prev = existing.get(row.tag), active = row.classification === 'MASTER' ? 1 : 0;
        const retired = prev?.active && !active;
        const p = { ...row, active, present_in_latest_import: 1, first_seen_at: prev?.first_seen_at || now, last_seen_at: now, last_import_id: id, retired_at: active ? null : retired ? now : prev?.retired_at || null, retirement_reason: active ? null : retired ? 'No longer present as an active master package in latest Metrc Active Packages report.' : prev?.retirement_reason || null };
        await save(p,tx);
        await history(p,!prev ? 'added' : retired ? 'retired' : !prev.active && active ? 'reactivated' : 'updated',id,tx);
      }
      for (const prev of existing.values()) if (!incomingTags.has(prev.tag)) {
        const p = { ...prev, active: 0, present_in_latest_import: 0, last_import_id: id, retired_at: prev.retired_at || now, retirement_reason: prev.retirement_reason || 'No longer present in latest Metrc Active Packages report.' };
        await save(p,tx); await history(p,prev.active || prev.present_in_latest_import ? 'retired' : 'still_absent',id,tx);
      }
      pending.delete(token);
      return { import_id: id, summary: result.summary };
    });
  }
  async function list(employee = false) {
    const all = await packages();
    return employee ? all.filter(p=>p.active && p.classification==='MASTER').sort(compare) : all.sort((a,b)=>a.item_key.localeCompare(b.item_key)||compare(a,b));
  }
  async function change(tag, classification, reactivate) {
    if (!['MASTER','SPLIT','IGNORED','AUTO'].includes(classification)) throw fail('Choose MASTER, SPLIT, IGNORED, or automatic classification.');
    return withTransaction(async tx => {
      const prev = (await packages(tx)).find(p=>p.tag===tag);
      if (!prev) throw fail('Package not found.',404);
      const now = new Date().toISOString();
      if (classification==='AUTO') await runSql('DELETE FROM package_classification_overrides WHERE tag=?',[tag],tx);
      else await runSql('INSERT INTO package_classification_overrides(tag,classification,updated_at) VALUES(?,?,?) ON CONFLICT(tag) DO UPDATE SET classification=excluded.classification,updated_at=excluded.updated_at',[tag,classification,now],tx);
      const effective = classification==='AUTO' ? prev.automatic_classification : classification;
      const active = effective==='MASTER' && (prev.present_in_latest_import || reactivate===true) ? 1 : 0;
      const p = { ...prev, classification: effective, manual_classification: classification==='AUTO' ? null : classification, active, retired_at: active ? null : prev.retired_at || (prev.active ? now : null), retirement_reason: active ? null : prev.retirement_reason || (prev.active ? 'Administrator changed package classification.' : null) };
      await save(p,tx); await history(p,!prev.active && active ? 'manual_reactivation' : 'manual_classification',null,tx);
      return p;
    });
  }
  async function manualParent(input) {
    const tag = clean(input.tag), item = clean(input.item);
    if (!tag || tag.length > 100 || /\s/.test(tag) || !item || item.length > 500) throw fail('Enter the full Tag and Item name.');
    const quantity = Number(input.quantity);
    if (input.quantity === '' || input.quantity == null || !Number.isFinite(quantity) || quantity < 0) throw fail('Enter a nonnegative quantity.');
    if (!clean(input.unit_of_measure) || !clean(input.location)) throw fail('Enter the unit of measure and location.');
    const report = Object.fromEntries(fields.map(field=>[field, clean(input[field])]));
    for (const field of ['expiration_date','use_by_date','packaged_date','received','lab_test_expiration']) report[field] = date(input[field]);
    return withTransaction(async tx => {
      if (await getSql('SELECT tag FROM metrc_packages WHERE tag=?', [tag], tx)) throw fail('This Tag already exists. Find it in Package review and use Reactivate as master or Save classification.',409);
      const now = new Date().toISOString();
      const p = { ...report, tag, item, item_key: key(item), quantity,
        automatic_classification: 'REVIEW', classification_reason: 'Entered manually; no Metrc report classification yet.',
        classification: 'MASTER', manual_classification: 'MASTER', active: 1,
        present_in_latest_import: 0, first_seen_at: now, last_seen_at: now,
        retired_at: null, retirement_reason: null, last_import_id: null, entered_manually_at: now };
      await runSql('INSERT INTO package_classification_overrides(tag,classification,updated_at) VALUES(?,?,?) ON CONFLICT(tag) DO UPDATE SET classification=excluded.classification,updated_at=excluded.updated_at', [tag,'MASTER',now],tx);
      await save(p,tx);
      await history(p,'manual_parent_added',null,tx);
      return p;
    });
  }
  function register(app, raw, requireAdmin, hasAdmin = () => false) {
    const route = (method,path,admin,fn,...middleware) => app[method](path,...middleware,async(req,res)=>{
      if (admin && !requireAdmin(req,res)) return;
      try { res.json(await fn(req)); } catch(err) { console.error('Current packages:',err.message); res.status(err.status || 500).json({message:err.status ? err.message : 'Package operation failed. No changes were committed. Please retry.'}); }
    });
    route('get','/current-packages/access',false,req=>({can_import:hasAdmin(req)}));
    route('post','/current-packages/manual-parent',true,req=>manualParent(req.body));
    route('get','/current-packages',false,()=>list(true));
    route('get','/current-packages/admin',true,()=>list());
    route('get','/current-packages/imports',true,()=>allSql('SELECT * FROM package_imports ORDER BY id DESC'));
    route('get','/current-packages/imports/:id/packages',true,async req => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) throw fail('Invalid import.');
      return (await allSql('SELECT snapshot FROM package_history WHERE import_id=? ORDER BY id', [id])).map(row => JSON.parse(row.snapshot));
    });
    route('post','/current-packages/preview',true,req=>{
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw fail('Choose an Excel .xlsx report.');
      let fileName = req.headers['x-file-name'];
      try { fileName = decodeURIComponent(fileName || ''); } catch (_) { /* Keep a non-encoded file name. */ }
      return preview(req.body,fileName);
    },raw);
    route('post','/current-packages/confirm',true,req=>apply(req.body.token,req.body.acknowledge_all_retirements));
    route('post','/current-packages/:tag/classification',true,req=>change(req.params.tag,req.body.classification,req.body.reactivate));
    route('get','/current-packages/:tag/history',true,async req=>{
      const all = await packages(), p = all.find(p=>p.tag===req.params.tag);
      if (!p) throw fail('Package not found.',404);
      return { history: await allSql('SELECT * FROM package_history WHERE tag=? ORDER BY id DESC',[p.tag]), parents: all.filter(other=>sourceTags(p).includes(other.tag)), children: all.filter(other=>sourceTags(other).includes(p.tag)) };
    });
  }
  return { initialize, preview, apply, list, change, manualParent, register };
};
module.exports.parseRows = parseRows;
module.exports.classify = classify;
module.exports.compare = compare;
module.exports.sourceTags = sourceTags;
