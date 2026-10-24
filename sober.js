'use strict';

let soberTrackers = [];
let currentModalSoberId = null;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultSoberDate();
    try {
        soberTrackers = await db.sober.toArray();
        renderSober();
    } catch (e) { console.error(e); }
    setupSoberEvents();
    setInterval(updateSoberTimers, 1000);
});

function setDefaultSoberDate() {
    const el = document.getElementById('sober-start');
    if (el) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        el.value = now.toISOString().slice(0, 16);
    }
}

function setupSoberEvents() {
    document.getElementById('sober-cancel-btn').onclick = () => document.getElementById('sober-form-section').classList.add('hidden');
    document.getElementById('sober-form').onsubmit = handleSaveSober;
    document.getElementById('close-sober-history').onclick = () => document.getElementById('sober-history-modal').classList.add('hidden');
}

async function handleSaveSober(e) {
    e.preventDefault();
    const id = document.getElementById('sober-id').value || 'sober_' + Date.now();
    const name = document.getElementById('sober-name').value.trim();
    const startDate = document.getElementById('sober-start').value;

    if (!name || !startDate) return alert('Fyll i alla fält.');

    // Hämta befintliga resets om vi redigerar
    const existing = soberTrackers.find(x => x.id === id);
    const resets = existing ? (existing.resets || []) : [];

    await db.sober.put({ id, name, startDate, resets });
    soberTrackers = await db.sober.toArray();

    document.getElementById('sober-form-section').classList.add('hidden');
    resetSoberForm();
    renderSober();
}

function resetSoberForm() {
    document.getElementById('sober-form').reset();
    document.getElementById('sober-id').value = '';
    setDefaultSoberDate();
}

function renderSober() {
    const c = document.getElementById('sober-container');
    if (!c) return;
    c.innerHTML = '';
    if (!soberTrackers.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga spårningar aktiva.</p>';
        return;
    }

    soberTrackers.forEach(t => {
        const startObj = new Date(t.startDate);
        const dayNum = startObj.getDate();
        const monthStr = startObj.toLocaleDateString('sv-SE', { month: 'short' }).toUpperCase().replace('.', '');

        const card = document.createElement('div');
        card.className = 'sober-card';
        card.innerHTML = `
            <div class="sober-card-inner">
                <div class="sober-date-badge">
                    <span class="sober-day">${dayNum}</span>
                    <span class="sober-mon">${monthStr}</span>
                </div>
                <div class="sober-info">
                    <h3 class="sober-title">${escapeHtml(t.name)}</h3>
                    <div class="sober-status-badge">🌱 Startad</div>
                </div>
                <div class="sober-right-group">
                    <div class="sober-timer" data-start="${t.startDate}">0å 0m 0d 00:00:00</div>
                    <button type="button" class="icon-btn sober-action-btn" title="Nollställ" onclick="resetSoberTimer(event, '${t.id}')">⏱️</button>
                    <button type="button" class="card-delete sober-action-btn" title="Radera" onclick="deleteSoberTracker(event, '${t.id}')">✕</button>
                </div>
            </div>
        `;
        card.onclick = () => openSoberHistory(t);
        c.appendChild(card);
    });
    updateSoberTimers();
}

function updateSoberTimers() {
    if (document.getElementById('sober-view').classList.contains('hidden')) return;
    const now = new Date().getTime();

    document.querySelectorAll('.sober-timer').forEach(timer => {
        const start = new Date(timer.getAttribute('data-start')).getTime();
        const diff = now - start;
        if (diff < 0) return;

        const secs = Math.floor((diff / 1000) % 60);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const daysTotal = Math.floor(diff / (1000 * 60 * 60 * 24));
        const years = Math.floor(daysTotal / 365);
        const months = Math.floor((daysTotal % 365) / 30);
        const days = daysTotal % 30;

        const pad = n => String(n).padStart(2, '0');
        timer.textContent = `${years}å ${months}m ${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;

        const badgeEl = timer.closest('.sober-card').querySelector('.sober-status-badge');
        if (badgeEl) {
            if (daysTotal >= 1 && daysTotal <= 6) {
                badgeEl.textContent = `✨ ${daysTotal} Dag${daysTotal > 1 ? 'ar' : ''}`;
            } else if (daysTotal > 6) {
                const weeks = Math.floor(daysTotal / 7);
                badgeEl.textContent = `🏆 ${weeks} Vecka${weeks > 1 ? 'or' : ''}`;
            } else {
                badgeEl.textContent = `🌱 Startad`;
            }
        }
    });
}

window.resetSoberTimer = async function(e, id) {
    e.stopPropagation();
    if (confirm('Vill du nollställa tidräknaren?')) {
        const t = soberTrackers.find(x => x.id === id);
        if (!t) return;
        t.resets = t.resets || [];
        t.resets.push({ date: new Date().toISOString(), previousStart: t.startDate });
        t.startDate = new Date().toISOString();
        await db.sober.put(t);
        soberTrackers = await db.sober.toArray();
        renderSober();
    }
};

window.deleteSoberTracker = async function(e, id) {
    e.stopPropagation();
    if (confirm('Radera spårning?')) {
        await db.sober.delete(id);
        soberTrackers = await db.sober.toArray();
        renderSober();
    }
};

function openSoberHistory(t) {
    document.getElementById('sober-history-title').textContent = `Spårning: ${t.name}`;
    const c = document.getElementById('sober-history-container');
    
    // Formatera datum för datetime-local input
    const localIso = new Date(new Date(t.startDate).getTime() - new Date(t.startDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    c.innerHTML = `
        <div class="card" style="margin-bottom:15px;">
            <label style="margin-top:0;">Ändra startdatum & tid</label>
            <input type="datetime-local" id="edit-sober-start" value="${localIso}" style="margin-top:6px; margin-bottom:12px;">
            <button type="button" class="btn-primary" onclick="saveSoberEdit('${t.id}')" style="width:100%;">Uppdatera starttid</button>
        </div>
        <div style="font-weight:600; margin-bottom:8px; font-size:0.9rem; color:var(--text-muted);">Tidigare nollställningar</div>
    `;

    if (t.resets && t.resets.length > 0) {
        t.resets.slice().reverse().forEach((r, idx) => {
            c.innerHTML += `<div class="card" style="margin-bottom:8px; padding:12px;"><div style="font-size:0.85rem; color:var(--text-secondary);">Nollställning #${t.resets.length - idx}: ${new Date(r.date).toLocaleString('sv-SE')}</div></div>`;
        });
    } else {
        c.innerHTML += `<p style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">Inga tidigare nollställningar.</p>`;
    }
    document.getElementById('sober-history-modal').classList.remove('hidden');
}

window.saveSoberEdit = async function(id) {
    const newStart = document.getElementById('edit-sober-start').value;
    if (!newStart) return alert청('Välj ett datum.');

    const t = soberTrackers.find(x => x.id === id);
    if (!t) return;

    t.startDate = new Date(newStart).toISOString();
    await db.sober.put(t);
    soberTrackers = await db.sober.toArray();
    
    document.getElementById('sober-history-modal').classList.add('hidden');
    renderSober();
    alert('Starttid uppdaterad!');
};
