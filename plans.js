'use strict';

let plans = [];
let currentModalPlanId = null;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultPlanDateTime();
    try {
        plans = await db.plans.toArray();
        sortPlans();
        renderPlans();
    } catch (e) { console.error('Kunde inte ladda planer:', e); }
    setupPlanEvents();
    setInterval(renderPlans, 1000);
});

function setDefaultPlanDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('plan-date');
    const timeEl = document.getElementById('plan-time');
    
    if (dateEl) {
        dateEl.value = now.toISOString().split('T')[0];
    }
    if (timeEl) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeEl.value = `${hours}:${minutes}`;
    }
}

function sortPlans() {
    plans.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
}

function setupPlanEvents() {
    const cancelBtn = document.getElementById('plan-cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.getElementById('plan-form-section').classList.add('hidden');
            resetPlanForm();
        };
    }

    const form = document.getElementById('plan-form');
    if (form) form.onsubmit = handleSavePlan;

    const closeModal = document.getElementById('close-plan-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('plan-modal').classList.add('hidden');

    const deleteModalBtn = document.getElementById('delete-plan-modal-btn');
    if (deleteModalBtn) {
        deleteModalBtn.onclick = () => {
            if (currentModalPlanId && confirm('Radera händelsen?')) {
                deletePlan(currentModalPlanId);
                document.getElementById('plan-modal').classList.add('hidden');
            }
        };
    }
}

async function handleSavePlan(e) {
    e.preventDefault();
    const id = document.getElementById('plan-id').value || 'plan_' + Date.now();
    const date = document.getElementById('plan-date').value;
    const time = document.getElementById('plan-time').value;
    const title = document.getElementById('plan-title').value.trim();
    const extra = document.getElementById('plan-extra').value.trim();

    if (!date || !time || !title) return alert('Fyll i datum, tid och händelse.');

    await db.plans.put({ id, date, time, title, extra });
    plans = await db.plans.toArray();
    sortPlans();

    document.getElementById('plan-form-section').classList.add('hidden');
    resetPlanForm();
    renderPlans();
}

function resetPlanForm() {
    const form = document.getElementById('plan-form');
    if (form) form.reset();
    const idField = document.getElementById('plan-id');
    if (idField) idField.value = '';
    setDefaultPlanDateTime();
}

function renderPlans() {
    const c = document.getElementById('plans-container');
    if (!c) return;
    c.innerHTML = '';
    sortPlans();

    if (!plans.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga planerade händelser.</p>';
        return;
    }

    const now = new Date().getTime();

    plans.forEach(p => {
        const item = document.createElement('div');
        item.className = 'plan-item';

        const eventTime = new Date(`${p.date}T${p.time || '00:00'}`).getTime();
        const diff = eventTime - now;

        let countdownText = '';
        if (diff <= 0) {
            countdownText = 'Nu / Utförd';
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const secs = Math.floor((diff / 1000) % 60);

            if (days > 0) {
                countdownText = `${days}d ${hrs}h ${mins}m`;
            } else {
                const pad = n => String(n).padStart(2, '0');
                countdownText = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
            }
        }

        // Visar endast titel samt "datum kl tid" i listan (extra info / adress döljs här och syns först i modalen)
        item.innerHTML = `
            <div class="plan-main-info">
                <div class="plan-title-text">${escapeHtml(p.title)}</div>
                <div class="plan-date-text">${p.date} kl ${p.time}</div>
            </div>
            <div class="plan-countdown-display">${countdownText}</div>
        `;
        item.onclick = () => openPlanModal(p);
        c.appendChild(item);
    });
}

function openPlanModal(plan) {
    currentModalPlanId = plan.id;
    document.getElementById('plan-modal-content-container').innerHTML = `
        <h2 style="font-size:1.25rem;color:var(--text-main);margin-bottom:8px;">${escapeHtml(plan.title)}</h2>
        <p style="color:var(--text-secondary);font-size:0.95rem;margin-bottom:12px;"><b>Datum & tid:</b> ${plan.date} kl ${plan.time}</p>
        ${plan.extra ? `<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px;">📍 <b>Extra info / Adress:</b> ${escapeHtml(plan.extra)}</p>` : ''}
        <div style="margin-top:20px;text-align:right;"><button type="button" onclick="editPlan('${plan.id}')" class="btn-primary">Redigera</button></div>
    `;
    document.getElementById('plan-modal').classList.remove('hidden');
}

window.editPlan = id => {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    document.getElementById('plan-modal').classList.add('hidden');
    document.getElementById('plan-form-section').classList.remove('hidden');
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-date').value = p.date;
    document.getElementById('plan-time').value = p.time;
    document.getElementById('plan-title').value = p.title;
    document.getElementById('plan-extra').value = p.extra || '';
};

async function deletePlan(id) {
    await db.plans.delete(id);
    plans = await db.plans.toArray();
    sortPlans();
    renderPlans();
}
