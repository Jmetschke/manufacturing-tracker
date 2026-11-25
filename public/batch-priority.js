function getBatchAge(date, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return { days: null, color: 'neutral' };
  // Calendar dates, rather than elapsed hours, avoid daylight-saving offsets.
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) / 86400000);
  return { days, color: days < 1 ? 'neutral' : days <= 5 ? 'green' : days <= 8 ? 'yellow' : days <= 12 ? 'orange' : 'red' };
}
function appendBatchPriority(card, batch) {
  const age = getBatchAge(batch.scheduleDate);
  card.classList.add('batch-age-' + age.color);
  const header = document.createElement('div');
  header.className = 'daily-batch-priority';
  const label = document.createElement('label');
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Priority for ${batch.label}: ${batch.item} (1 highest, 3 lowest)`);
  [1, 2, 3].forEach(value => select.add(new Option(String(value), String(value))));
  select.value = String([1, 2, 3].includes(batch.priority) ? batch.priority : 2);
  const caption = document.createElement('span');
  caption.textContent = 'Priority · 1 highest / 3 lowest';
  label.append(select, caption);
  const ageLabel = document.createElement('span');
  ageLabel.textContent = age.days === null ? 'Production date unavailable' : age.days < 0 ? 'Scheduled for a future date' : `${age.days} ${age.days === 1 ? 'day' : 'days'} since production date`;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  header.append(label, ageLabel, status);
  header.addEventListener('click', event => event.stopPropagation());
  header.addEventListener('keydown', event => event.stopPropagation());
  select.addEventListener('change', async () => {
    const previous = [1, 2, 3].includes(batch.priority) ? batch.priority : 2;
    if (dailyMetrcSavePending || (typeof dailyBatchStatusPending !== 'undefined' && dailyBatchStatusPending)) { select.value = String(previous); return; }
    dailyMetrcSavePending = true;
    const controls = Array.from(document.querySelectorAll('#dailyWorkingBatches input, #dailyWorkingBatches button, #dailyWorkingBatches select, #dailyCompletedBatches input, #dailyCompletedBatches button, #dailyCompletedBatches select'))
      .map(control => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    status.textContent = 'Saving priority…';
    try {
      const response = await fetch('/schedule/batch-priority', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate: batch.scheduleDate, batchType: batch.batchType, batchIndex: batch.batchIndex,
          item: batch.item, base_revision: batch.revision, priority: Number(select.value) })
      });
      if (!response.ok) throw new Error(await response.text());
      applyDailyBatchMetadata(await response.json());
      status.textContent = 'Priority saved.';
    } catch (error) {
      select.value = String(previous);
      status.textContent = `Could not save priority: ${error.message}`;
    } finally {
      dailyMetrcSavePending = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  });
  card.appendChild(header);
}
