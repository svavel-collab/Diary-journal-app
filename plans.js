'use strict';

let plans = [];
let currentModalPlanId = null;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultPlanDate();
    try {
        plans = await db.plans.toArray();
        sortPlans();
    } catch (e) { console.error(e); }
    setupPlanEvents();
    setInterval(updateLiveCountdowns, 1000);
});

function setDefaultPlanDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('plan-date');
    const timeEl = document.getElementById('plan-time');
    if (dateEl) dateEl.value = today;
    if (timeEl) timeEl.value = '12:00';
}

function sortPlans() {
    plans.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
}

function setupPlanEvents() {
    document.getElementById('calendar-btn').onclick = () => {
        document.getElementById('plan-view').classList.remove('hidden');
        document.getElementById('journal-view').classList.add('hidden');
        document.getElementById('new-plan-trigger').classList.remove('hidden');
        document.getElementById('new-post-trigger').classList.add('hidden');
        document.getElementById('view-title').innerHTML = 'Planering <span id="header-date"></span>';
        updateHeaderDate();
        renderPlans();
        document.getElementById('calendar-btn').classList.add('active');
        document.getElementById('home-btn').classList.remove('active');
    };

    document.getElementById('new-plan-trigger').onclick = () => {
        resetPlanForm();
        document.getElementById('plan-form-section').classList.toggle('hidden');
    };
    document.getElementById('plan-cancel-btn').onclick = () => document.getElementById('plan-form-section').classList.add('hidden');
    document.getElementById('plan-form').onsubmit = handleSavePlan;

    document.getElementById('close-plan-modal').onclick = () => document.getElementById('plan-modal').classList.add('hidden');
    document.getElementById('delete-plan-modal-btn').onclick = () => {
        if (currentModalPlanId && confirm('Radera händelsen?')) {
            deletePlan(currentModalPlanId);
            document.getElementById('plan-modal').classList.add('hidden');
        }
    };
}

async function handleSavePlan(e) {
    e.preventDefault();
    const id = document.getElementById('plan-id').value || 'plan_' + Date.now();
    const date = document.getElementById('plan-date').value;
    const time = document.getElementById('plan-time').value;
    const title = document.getElementById('plan-title').value.trim();
    const extra = document.getElementById('plan-extra').value.trim();

    if (!date || !time || !title) return alert('Fyll i alla obligatoriska fält.');

    await db.plans.put({ id, date, time, title, extra });
    plans = await db.plans.toArray();
    sortPlans();

    document.getElementById('plan-form-section').classList.add('hidden');
    resetPlanForm();
    renderPlans();
}

function resetPlanForm() {
    document.getElementById('plan-form').reset();
    document.getElementById('plan-id').value = '';
    setDefaultPlanDate();
}

function renderPlans() {
    const c = document.getElementById('plans-container');
    c.innerHTML = '';
    if (!plans.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga inbokade händelser.</p>';
        return;
    }

    const now = new Date();
    plans.forEach(plan => {
        const target = new Date(`${plan.date}T${plan.time}`);
        const diff = target - now;
        let cdText = 'Passerat';

        if (diff > 0) {
            const days = Math.floor(diff / 86400000);
            const hrs = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            const pad = n => String(n).padStart(2, '0');
            cdText = days > 0 ? `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }

        const item = document.createElement('div');
        item.className = 'plan-item';
        item.innerHTML = `
            <div class="plan-main-info">
                <span class="plan-title-text">${escapeHtml(plan.title)}</span>
                <span class="plan-date-text">${plan.date} kl ${plan.time}</span>
            </div>
            <div class="plan-countdown-display" data-time="${plan.date}T${plan.time}">${cdText}</div>
        `;
        item.onclick = () => openPlanModal(plan);
        c.appendChild(item);
    });
}

function openPlanModal(plan) {
    currentModalPlanId = plan.id;
    document.getElementById('plan-modal-content-container').innerHTML = `
        <div style="margin-bottom:12px;">
            <h2 style="font-size:1.25rem;color:var(--text-main);">${escapeHtml(plan.title)}</h2>
            <span style="font-size:0.85rem;color:var(--text-muted)">${plan.date} kl ${plan.time}</span>
        </div>
        ${plan.extra ? `<p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;"><strong>Extra info:</strong> ${escapeHtml(plan.extra)}</p>` : '<p style="color:var(--text-muted);">Ingen extra information tillagd.</p>'}
        <div style="margin-top:20px;text-align:right"><button type="button" onclick="editPlan('${plan.id}')" class="btn-primary">Redigera</button></div>
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
    document.getElementById('plan-form-section').scrollIntoView({ behavior: 'smooth' });
};

async function deletePlan(id) {
    await db.plans.delete(id);
    plans = await db.plans.toArray();
    sortPlans();
    renderPlans();
}

function updateLiveCountdowns() {
    if (document.getElementById('plan-view').classList.contains('hidden')) return;
    const now = new Date();
    document.querySelectorAll('.plan-countdown-display').forEach(el => {
        const t = el.getAttribute('data-time');
        if (!t) return;
        const diff = new Date(t) - now;
        if (diff <= 0) {
            el.textContent = 'Passerat';
        } else {
            const days = Math.floor(diff / 86400000);
            const hrs = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            const pad = n => String(n).padStart(2, '0');
            el.textContent = days > 0 ? `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
    });
}
