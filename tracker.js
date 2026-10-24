'use strict';

let soberItems = [];
let currentModalSoberId = null;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultSoberDateTime();
    try {
        soberItems = await db.sober.toArray();
        renderSober();
    } catch (e) { console.error('Kunde inte ladda spårning:', e); }
    setupSoberEvents();
    setInterval(renderSober, 1000);
});

function setDefaultSoberDateTime() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const localIso = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const el = document.getElementById('sober-start');
    if (el) el.value = localIso;
}

function setupSoberEvents() {
    const cancelBtn = document.getElementById('sober-cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.getElementById('sober-form-section').classList.add('hidden');
            resetSoberForm();
        };
    }

    const form = document.getElementById('sober-form');
    if (form) form.onsubmit = handleSaveSober;

    const closeModal = document.getElementById('close-sober-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('sober-modal').classList.add('hidden');

    const updateBtn = document.getElementById('update-sober-start-btn');
    if (updateBtn) {
        updateBtn.onclick = async () => {
            const newStart = document.getElementById('edit-sober-start').value;
            if (!newStart || !currentModalSoberId) return;
            const item = soberItems.find(i => i.id === currentModalSoberId);
            if (item) {
                item.startDate = newStart;
                await db.sober.put(item);
                soberItems = await db.sober.toArray();
                document.getElementById('sober-modal').classList.add('hidden');
                renderSober();
            }
        };
    }

    const deleteBtn = document.getElementById('delete-sober-btn');
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (currentModalSoberId && confirm('Radera denna spårning?')) {
                await db.sober.delete(currentModalSoberId);
                soberItems = await db.sober.toArray();
                document.getElementById('sober-modal').classList.add('hidden');
                renderSober();
            }
        };
    }
}

async function handleSaveSober(e) {
    e.preventDefault();
    const id = document.getElementById('sober-id').value || 'sober_' + Date.now();
    const name = document.getElementById('sober-name').value.trim();
    const startDate = document.getElementById('sober-start').value;

    if (!name || !startDate) return alert('Fyll i alla fält.');

    await db.sober.put({ id, name, startDate });
    soberItems = await db.sober.toArray();

    document.getElementById('sober-form-section').classList.add('hidden');
    resetSoberForm();
    renderSober();
}

function resetSoberForm() {
    const form = document.getElementById('sober-form');
    if (form) form.reset();
    const idField = document.getElementById('sober-id');
    if (idField) idField.value = '';
    setDefaultSoberDateTime();
}

function renderSober() {
    const c = document.getElementById('sober-container');
    if (!c) return;
    c.innerHTML = '';

    if (!soberItems.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga aktiva spårningar.</p>';
        return;
    }

    const now = new Date().getTime();

    soberItems.forEach(item => {
        const start = new Date(item.startDate).getTime();
        const diff = now - start;

        let timeStr = 'Nyss startad';
        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const secs = Math.floor((diff / 1000) % 60);
            timeStr = `${days}d ${hrs}h ${mins}m ${secs}s`;
        }

        const dateObj = new Date(item.startDate);
        const dayNum = dateObj.getDate();
        const monStr = dateObj.toLocaleString('sv-SE', { month: 'short' }).replace('.', '');

        const card = document.createElement('div');
        card.className = 'sober-card';
        card.innerHTML = `
            <div class="sober-date-badge">
                <span class="sober-day">${dayNum}</span>
                <span class="sober-mon">${monStr}</span>
            </div>
            <div class="sober-info">
                <div class="sober-title">${escapeHtml(item.name)}</div>
                <div class="sober-timer">${timeStr}</div>
            </div>
        `;
        card.onclick = () => openSoberModal(item);
        c.appendChild(card);
    });
}

function openSoberModal(item) {
    currentModalSoberId = item.id;
    document.getElementById('edit-sober-start').value = item.startDate;
    document.getElementById('sober-modal').classList.remove('hidden');
}

window.resetSoberForm = resetSoberForm;
