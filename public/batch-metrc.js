// Shared by both Daily Reports. Keep same-day card revisions current after a save.
let dailyMetrcBatches = [];
let dailyMetrcSavePending = false;
function appendBatchMetrc(card, batch) {
  dailyMetrcBatches.push(batch);
  const form = document.createElement('form');
  form.style.gridColumn = '1 / -1';
  form.style.display = 'grid';
  form.style.gap = '6px';
  const label = document.createElement('label');
  label.textContent = 'Metrc #';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 100;
  input.value = batch.metrc_number || '';
  input.placeholder = 'Enter batch Metrc #';
  label.appendChild(input);
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Save Metrc #';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  form.append(label, button, status);
  form.addEventListener('click', event => event.stopPropagation());
  form.addEventListener('keydown', event => event.stopPropagation());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (dailyMetrcSavePending || (typeof dailyBatchStatusPending !== 'undefined' && dailyBatchStatusPending)) return;
    dailyMetrcSavePending = true;
    const controls = Array.from(document.querySelectorAll('#dailyWorkingBatches input, #dailyWorkingBatches button, #dailyCompletedBatches input, #dailyCompletedBatches button, #dailyWorkingBatches select, #dailyCompletedBatches select'))
      .map(control => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    status.textContent = 'Saving…';
    try {
      const response = await fetch('/schedule/batch-metrc', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate: batch.scheduleDate, batchType: batch.batchType,
          batchIndex: batch.batchIndex, item: batch.item, base_revision: batch.revision,
          metrc_number: input.value })
      });
      if (!response.ok) throw new Error(await response.text());
      const saved = await response.json();
      applyDailyBatchMetadata(saved);
      input.value = batch.metrc_number;
      status.textContent = input.value ? 'Metrc # saved.' : 'Metrc # cleared.';
    } catch (error) {
      status.textContent = `Could not save Metrc #: ${error.message} Your entry is still here.`;
    } finally {
      dailyMetrcSavePending = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  });
  card.appendChild(form);
}

function applyDailyBatchMetadata(saved) {
      const payload = JSON.parse(saved.tasks);
      for (const entry of dailyMetrcBatches) {
        if (entry.scheduleDate !== saved.schedule_date) continue;
        entry.revision = saved.revision;
        const value = payload[entry.batchType === 'hijnx' ? 'batchHijnx' : 'batchSb'][entry.batchIndex];
        if (value) {
          entry.notes = Array.isArray(value.notes) ? value.notes : [];
          entry.metrc_number = value.metrc_number || '';
          entry.priority = [1, 2, 3].includes(value.priority) ? value.priority : 2;
        }
      }
      if (typeof dailyReportBatchRows !== 'undefined') {
        dailyReportBatchRows = dailyReportBatchRows.map(row => row.schedule_date === saved.schedule_date ? saved : row);
      }
}
