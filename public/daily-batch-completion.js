// Shared by the regular and administrator Daily Report views.
function appendDailyBatchCompletion(card, batch) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'All tasks completed';
  button.style.gridColumn = '1 / -1';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.gridColumn = '1 / -1';
  status.hidden = true;
  button.addEventListener('click', async event => {
    event.stopPropagation();
    if (button.disabled) return;
    if (!confirm(`Mark all tasks and checklist steps completed for ${batch.label}: ${batch.item}? This includes the final count entered in Metrc checklist step.`)) return;
    button.disabled = true;
    button.textContent = 'Completing…';
    status.hidden = false;
    status.textContent = 'Saving completion…';
    try {
      const response = await fetch('/schedule/batch-completion', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate: batch.scheduleDate, batchType: batch.batchType,
          batchIndex: batch.batchIndex, item: batch.item, base_revision: batch.revision,
          completedDate: toIsoDate(new Date()) })
      });
      if (!response.ok) throw new Error(await response.text());
      card.remove();
      await loadDailyReport();
    } catch (error) {
      status.textContent = `Could not complete this batch: ${error.message}`;
      button.disabled = false;
      button.textContent = 'All tasks completed';
    }
  });
  card.append(button, status);
}

function filterDailyIncompleteTasks(tasks, batches) {
  const completedBatches = new Set(batches.filter(batch => !isBatchInProgress(batch))
    .map(batch => `${batch.scheduleDate}\n${batch.batchType}:${batch.batchIndex}`));
  return tasks.filter(task => {
    if (task.completed || task.completedAny) return false;
    if (!task.sourceBatchKey) return true;
    const key = task.sourceBatchKey.split(':').slice(0, 2).join(':');
    return !completedBatches.has(`${task.sourceScheduleDate}\n${key}`);
  });
}
