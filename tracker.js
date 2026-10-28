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

function getBadgeInfo(days) {
    if (days >= 30) return { text: '🌳 Träd (1 månad+)', color: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.35)', textColor: '#4ade80' };
    if (days >= 14) return { text: '🪴 Större planta (2 veckor)', color: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.35)', textColor: '#34d399' };
    if (days >= 7) return { text: '🪴 Planta (1 vecka)', color: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.35)', textColor: '#86efac' };
    
    if (days === 6) return { text: '🌿 Grodd (dag 6)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    if (days === 5) return { text: '🌿 Grodd (dag 5)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    if (days === 4) return { text: '🌿 Grodd (dag 4)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    if (days === 3) return { text: '🌿 Grodd (dag 3)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    if (days === 2) return { text: '🌱 Grodd (dag 2)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    if (days === 1) return { text: '🌱 Liten grodd (dag 1)', color: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)', textColor: '#c084fc' };
    
    return { text: '🌰 Frö (dag 0)', color: 'rgba(168, 162, 158, 0.15)', border: 'rgba(168, 162, 158, 0.3)', textColor: '#a8a29e' };
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

        let days = 0;
        let timeStr = '0d 0h 0m 0s';
        if (diff > 0) {
            days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const secs = Math.floor((diff / 1000) % 60);
            timeStr = `${days}d ${hrs}h ${mins}m ${secs}s`;
        }

        const badge = getBadgeInfo(days);

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
                <div class="sober-timer">${timeStr}</div>
                <div class="sober-title">${escapeHtml(item.name)}</div>
                <div class="sober-bottom-row">
                    <span class="sober-status-badge" style="background:${badge.color};border-color:${badge.border};color:${badge.textColor};">${badge.text}</span>
                </div>
            </div>
            <div class="sober-right-group">
                <button type="button" class="sober-action-btn" title="Ändra tid" onclick="event.stopPropagation(); editSober('${item.id}')">⏱</button>
                <button type="button" class="card-delete-btn" title="Radera" onclick="event.stopPropagation(); deleteSoberDirect('${item.id}')">✕</button>
            </div>
        `;
        card.onclick = () => openSoberModal(item);
        c.appendChild(card);
    });
}

window.editSober = id => {
    const item = soberItems.find(x => x.id === id);
    if (item) openSoberModal(item);
};

window.deleteSoberDirect = async function(id) {
    if (confirm('Radera denna spårning?')) {
        await db.sober.delete(id);
        soberItems = await db.sober.toArray();
        renderSober();
    }
};

function openSoberModal(item) {
    currentModalSoberId = item.id;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const localIso = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    document.getElementById('edit-sober-start').value = localIso;
    document.getElementById('sober-modal').classList.remove('hidden');
}

window.resetSoberForm = resetSoberForm;
