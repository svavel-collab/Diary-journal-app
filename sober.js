'use strict';

let soberEntries = [];
let currentModalSoberId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.db && typeof db.open === 'function') {
            await db.open();
        }
        soberEntries = await db.sober.toArray();
        sortSober();
        renderSober();
    } catch (e) { 
        console.error('Kunde inte ladda sober-inlägg:', e);
        renderSober(); 
    }
    setupSoberEvents();
});

function sortSober() {
    try {
        soberEntries.sort((a, b) => {
            const idA = String(a.id || '');
            const idB = String(b.id || '');
            return idB.localeCompare(idA);
        });
    } catch (e) {
        console.error('Kunde inte sortera sober-inlägg:', e);
    }
}

function setupSoberEvents() {
    const cancelBtn = document.getElementById('sober-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => document.getElementById('sober-form-section').classList.add('hidden');
    
    const form = document.getElementById('sober-form');
    if (form) form.onsubmit = handleSaveSober;

    const closeModal = document.getElementById('close-sober-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('sober-modal').classList.add('hidden');
    
    const deleteModalBtn = document.getElementById('delete-sober-modal-btn');
    if (deleteModalBtn) {
        deleteModalBtn.onclick = () => {
            if (currentModalSoberId && confirm('Radera inlägget?')) {
                deleteSober(currentModalSoberId);
                document.getElementById('sober-modal').classList.add('hidden');
            }
        };
    }
}

async function handleSaveSober(e) {
    e.preventDefault();
    const oldId = document.getElementById('sober-id').value;
    const title = document.getElementById('sober-title').value.trim();
    const content = document.getElementById('sober-content').value.trim();
    const date = document.getElementById('sober-date').value;

    if (!title || !date) return alert('Fyll i obligatoriska fält.');

    const newId = 'sober_' + Date.now();

    if (oldId) {
        await db.sober.delete(oldId);
    }

    await db.sober.put({ id: newId, title, content, date });
    soberEntries = await db.sober.toArray();
    sortSober();

    document.getElementById('sober-form-section').classList.add('hidden');
    resetSoberForm();
    renderSober();
}

function resetSoberForm() {
    const form = document.getElementById('sober-form');
    if (form) form.reset();
    const idField = document.getElementById('sober-id');
    if (idField) idField.value = '';
}

function renderSober() {
    const c = document.getElementById('sober-container');
    if (!c) return;
    c.innerHTML = '';
    
    try {
        sortSober();

        if (!soberEntries.length) {
            c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga sober-inlägg hittades.</p>';
            return;
        }

        soberEntries.forEach(s => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.style.padding = '10px 14px';

            card.innerHTML = `
                <div class="post-header-row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:2px;">
                    <div class="post-title" style="margin-bottom:0;">${escapeHtml(s.title)}</div>
                    ${s.date ? `<div class="post-date-badge" style="background:rgba(16, 185, 129, 0.15);color:#34d399;padding:3px 8px;border-radius:6px;font-size:0.7rem;white-space:nowrap;border:1px solid rgba(52, 211, 153, 0.2);">${s.date}</div>` : ''}
                </div>
                ${s.content ? `<div class="post-preview-text" style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;color:var(--text-secondary);font-size:0.85rem;margin-top:0;">${escapeHtml(s.content)}</div>` : ''}
            `;
            card.onclick = () => openSoberModal(s);
            c.appendChild(card);
        });
    } catch (e) {
        console.error('Kunde inte rendera sober-inlägg:', e);
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Kunde inte visa inlägg.</p>';
    }
}

function openSoberModal(sober) {
    currentModalSoberId = sober.id;

    document.getElementById('sober-modal-content-container').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="font-size:1.25rem;color:var(--text-main);">${escapeHtml(sober.title)}</h2>
            ${sober.date ? `<span style="font-size:0.85rem;color:#34d399;">${sober.date}</span>` : ''}
        </div>
        ${sober.content ? `<p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">${escapeHtml(sober.content)}</p>` : ''}
        <div style="text-align:right"><button type="button" onclick="editSober('${sober.id}')" class="btn-primary">Redigera</button></div>
    `;
    const modal = document.getElementById('sober-modal');
    if (modal) modal.classList.remove('hidden');
}

window.editSober = id => {
    const s = soberEntries.find(x => x.id === id);
    if (!s) return;
    const modal = document.getElementById('sober-modal');
    if (modal) modal.classList.add('hidden');
    const formSec = document.getElementById('sober-form-section');
    if (formSec) formSec.classList.remove('hidden');
    
    document.getElementById('sober-id').value = s.id;
    document.getElementById('sober-title').value = s.title;
    if (document.getElementById('sober-content')) document.getElementById('sober-content').value = s.content || '';
    if (document.getElementById('sober-date')) document.getElementById('sober-date').value = s.date || '';
};

async function deleteSober(id) {
    await db.sober.delete(id);
    soberEntries = await db.sober.toArray();
    sortSober();
    renderSober();
}

window.resetSoberForm = resetSoberForm;
