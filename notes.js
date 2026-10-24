'use strict';

let notes = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        notes = await db.notes.toArray();
        sortNotes();
        renderNotes();
    } catch (e) { console.error('Kunde inte ladda anteckningar:', e); }
    setupNoteEvents();
});

function sortNotes() {
    notes.sort((a, b) => String(b.id).localeCompare(String(id => id)));
}

function setupNoteEvents() {
    const cancelBtn = document.getElementById('note-cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.getElementById('notes-form-section').classList.add('hidden');
            resetNoteForm();
        };
    }

    const form = document.getElementById('notes-form');
    if (form) form.onsubmit = handleSaveNote;
}

async function handleSaveNote(e) {
    e.preventDefault();
    const id = document.getElementById('note-id').value || 'note_' + Date.now();
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    if (!title || !content) return alert('Fyll i alla fält.');

    const now = new Date();
    const date = now.toLocaleDateString('sv-SE');
    const time = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

    // Spara i Dexie-databasen permanent
    await db.notes.put({ id, title, content, date, time });
    notes = await db.notes.toArray();
    notes.sort((a, b) => String(b.id).localeCompare(String(a.id)));

    document.getElementById('notes-form-section').classList.add('hidden');
    resetNoteForm();
    renderNotes();
}

function resetNoteForm() {
    const form = document.getElementById('notes-form');
    if (form) form.reset();
    const idField = document.getElementById('note-id');
    if (idField) idField.value = '';
}

function renderNotes() {
    const c = document.getElementById('notes-container');
    if (!c) return;
    c.innerHTML = '';
    notes.sort((a, b) => String(b.id).localeCompare(String(a.id)));

    if (!notes.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga anteckningar sparade.</p>';
        return;
    }

    notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'note-card';

        item.innerHTML = `
            <div class="note-card-content">
                <div class="note-card-title">${escapeHtml(n.title)}</div>
                <div class="note-card-preview">${escapeHtml(n.content)}</div>
            </div>
            <div class="note-card-right">
                <span class="note-time-badge">${n.time || '00:00'}</span>
                <button type="button" class="card-delete-btn" title="Radera" onclick="deleteNoteDirect(event, '${n.id}')">✕</button>
            </div>
        `;
        item.onclick = () => editNote(n.id);
        c.appendChild(item);
    });
}

window.deleteNoteDirect = async function(e, id) {
    e.stopPropagation();
    if (confirm('Radera anteckningen?')) {
        await db.notes.delete(id);
        notes = await db.notes.toArray();
        renderNotes();
    }
};

window.editNote = id => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    document.getElementById('notes-form-section').classList.remove('hidden');
    document.getElementById('note-id').value = n.id;
    document.getElementById('note-title').value = n.title;
    document.getElementById('note-content').value = n.content;
};
