function appendBatchNotes(card, batch) {
  const section = document.createElement('section');
  section.className = 'daily-batch-notes';
  const heading = document.createElement('h4');
  heading.textContent = 'Batch Notes';
  const list = document.createElement('div');
  const form = document.createElement('form');
  const label = document.createElement('label');
  label.textContent = 'New note';
  const input = document.createElement('textarea');
  input.rows = 3;
  input.maxLength = 2000;
  input.required = true;
  input.placeholder = 'Enter a note for this batch…';
  label.appendChild(input);
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save Note';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(label, save);
  section.append(heading, list, form, status);
  section.addEventListener('click', event => event.stopPropagation());
  section.addEventListener('keydown', event => event.stopPropagation());
  function renderNotes() {
    list.replaceChildren();
    const notes = Array.isArray(batch.notes) ? batch.notes : [];
    if (!notes.length) { list.textContent = 'No notes yet.'; return; }
    [...notes].reverse().forEach(note => {
      const article = document.createElement('article');
      article.className = 'daily-batch-note';
      const date = document.createElement('time');
      date.dateTime = note.posted_at;
      date.textContent = new Date(note.posted_at).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      const text = document.createElement('p');
      text.textContent = note.text;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete Note';
      remove.setAttribute('aria-label', `Delete note posted ${date.textContent}`);
      remove.addEventListener('click', () => saveNote('delete', note.id));
      article.append(date, text, remove);
      list.appendChild(article);
    });
  }
  async function saveNote(action, noteId) {
    if (dailyMetrcSavePending || (typeof dailyBatchStatusPending !== 'undefined' && dailyBatchStatusPending)) return;
    if (action === 'add' && !input.value.trim()) { status.textContent = 'Enter a note before saving.'; return; }
    dailyMetrcSavePending = true;
    const controls = Array.from(document.querySelectorAll('#dailyWorkingBatches input, #dailyWorkingBatches button, #dailyWorkingBatches select, #dailyWorkingBatches textarea, #dailyCompletedBatches input, #dailyCompletedBatches button, #dailyCompletedBatches select, #dailyCompletedBatches textarea'))
      .map(control => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    status.textContent = action === 'add' ? 'Saving note…' : 'Deleting note…';
    try {
      const response = await fetch('/schedule/batch-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate: batch.scheduleDate, batchType: batch.batchType,
          batchIndex: batch.batchIndex, item: batch.item, base_revision: batch.revision,
          action, text: action === 'add' ? input.value : undefined, noteId })
      });
      if (!response.ok) throw new Error(await response.text());
      applyDailyBatchMetadata(await response.json());
      if (action === 'add') input.value = '';
      renderNotes();
      status.textContent = action === 'add' ? 'Note saved.' : 'Note deleted.';
    } catch (error) {
      status.textContent = `Could not ${action === 'add' ? 'save' : 'delete'} note: ${error.message}`;
    } finally {
      dailyMetrcSavePending = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); event.stopPropagation(); return saveNote('add'); });
  renderNotes();
  card.appendChild(section);
}
