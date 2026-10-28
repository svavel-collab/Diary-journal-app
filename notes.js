'use strict';

let notes = [];
let currentModalNoteId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.db && typeof db.open === 'function') {
            await db.open();
        }
        notes = await db.notes.toArray();
        sortNotes();
        renderNotes();
    } catch (e) { 
        console.error('Kunde inte ladda anteckningar:', e);
        renderNotes(); 
    }
    setupNoteEvents();
});

function sortNotes() {
    try {
        notes.sort((a, b) => {
            const idA = String(a.id || '');
            const idB = String(b.id || '');
            return idB.localeCompare(idA);
        });
    } catch (e) {
        console.error('Kunde inte sortera anteckningar:', e);
    }
}

function setupNoteEvents() {
    const cancelBtn = document.getElementById('note-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => document.getElementById('notes-form-section').classList.add('hidden');
    
    const form = document.getElementById('notes-form');
    if (form) form.onsubmit = handleSaveNote;

    const closeModal = document.getElementById('close-note-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('note-modal').classList.add('hidden');
    
    const deleteModalBtn = document.getElementById('delete-note-modal-btn');
    if (deleteModalBtn) {
        deleteModalBtn.onclick = () => {
            if (currentModalNoteId && confirm('Radera anteckningen?')) {
                deleteNote(currentModalNoteId);
                document.getElementById('note-modal').classList.add('hidden');
            }
        };
    }
}

async function handleSaveNote(e) {
    e.preventDefault();
    const oldId = document.getElementById('note-id').value;
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    if (!title || !content) return alert('Fyll i alla fält.');

    // Nytt ID med aktuell tid för att datum/tid uppdateras vid redigering
    const newId = 'note_' + Date.now();

    if (oldId) {
        await db.notes.delete(oldId);
    }

    await db.notes.put({ id: newId, title, content });
    notes = await db.notes.toArray();
    sortNotes();

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

function formatNoteDateTime(id) {
    if (!id || !String(id).startsWith('note_')) return '';
    const timestamp = parseInt(String(id).replace('note_', ''), 10);
    if (isNaN(timestamp)) return '';
    
    const date = new Date(timestamp);
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} kl ${hours}:${minutes}`;
}

function renderNotes() {
    const c = document.getElementById('notes-container');
    if (!c) return;
    c.innerHTML = '';
    
    try {
        sortNotes();

        if (!notes.length) {
            c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga anteckningar hittades.</p>';
            return;
        }

        notes.forEach(n => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.style.padding = '10px 14px';
            
            const dateTimeStr = formatNoteDateTime(n.id);

            card.innerHTML = `
                <div class="post-header-row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:2px;">
                    <div class="post-title" style="margin-bottom:0;">${escapeHtml(n.title)}</div>
                    ${dateTimeStr ? `<div class="post-date-badge" style="background:rgba(16, 185, 129, 0.15);color:#34d399;padding:3px 8px;border-radius:6px;font-size:0.7rem;white-space:nowrap;border:1px solid rgba(52, 211, 153, 0.2);">${dateTimeStr}</div>` : ''}
                </div>
                <div class="post-preview-text" style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;color:var(--text-secondary);font-size:0.85rem;margin-top:0;">${escapeHtml(n.content)}</div>
            `;
            card.onclick = () => openNoteModal(n);
            c.appendChild(card);
        });
    } catch (e) {
        console.error('Kunde inte rendera anteckningar:', e);
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Kunde inte visa anteckningar.</p>';
    }
}

function openNoteModal(note) {
    currentModalNoteId = note.id;
    const dateTimeStr = formatNoteDateTime(note.id);

    document.getElementById('note-modal-content-container').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="font-size:1.25rem;color:var(--text-main);">${escapeHtml(note.title)}</h2>
            ${dateTimeStr ? `<span style="font-size:0.85rem;color:#34d399;">${dateTimeStr}</span>` : ''}
        </div>
        <p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">${escapeHtml(note.content)}</p>
        <div style="text-align:right"><button type="button" onclick="editNote('${note.id}')" class="btn-primary">Redigera</button></div>
    `;
    // Rättat till 'note-modal' så den öppnar rätt ruta
    document.getElementById('note-modal').classList.remove('hidden');
}

window.editNote = id => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    document.getElementById('note-modal').classList.add('hidden');
    document.getElementById('notes-form-section').classList.remove('hidden');
    document.getElementById('note-id').value = n.id;
    document.getElementById('note-title').value = n.title;
    document.getElementById('note-content').value = n.content;
};

async function deleteNote(id) {
    await db.notes.delete(id);
    notes = await db.notes.toArray();
    sortNotes();
    renderNotes();
}

window.resetNoteForm = resetNoteForm;
