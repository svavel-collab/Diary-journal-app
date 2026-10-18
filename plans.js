'use strict';

async function handleSavePlan(event) {
    event.preventDefault();
    if (!db) return alert('Databasen är inte tillgänglig.');
    const id = $('plan-id').value || `plan_${Date.now()}`;
    const date = $('plan-date').value, time = $('plan-time').value;
    const title = $('plan-title').value.trim(), extra = $('plan-extra').value.trim();
    if (!date || !time || !title) return alert('Fyll i datum, tid och händelse.');
    try {
        await db.plans.put({ id, date, time, title, extra });
        plans = await db.plans.toArray();
        sortPlans();
        $('plan-form-section').classList.add('hidden');
        resetPlanForm();
        renderPlans();
    } catch (e) { console.error(e); alert('Kunde inte spara händelsen: ' + e.message); }
}

function resetPlanForm() {
    $('plan-form')?.reset();
    $('plan-id').value = '';
    $('plan-date').value = localDate();
    $('plan-time').value = '12:00';
}

function renderPlans() {
    const container = $('plans-container');
    if (!container) return;
    container.innerHTML = '';
    sortPlans();
    if (!plans.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga händelser</p>';
        return;
    }
    plans.forEach(plan => {
        const date = new Date(`${plan.date}T00:00:00`);
        const diff = new Date(`${plan.date}T${plan.time}`) - new Date();
        const past = diff <= 0;
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.style.opacity = past ? '0.5' : '1';
        const dateBox = document.createElement('div');
        dateBox.className = 'plan-date-box';
        dateBox.innerHTML = `<div class="plan-date-day">${date.getDate()}</div>
            <div class="plan-date-month">${date.toLocaleString('sv-SE', { month: 'short' }).replace('.', '')}</div>`;
        const details = document.createElement('div');
        details.className = 'plan-details';
        details.style.minWidth = '0';
        details.innerHTML = `
            <div>
                <span class="plan-time">${escapeHtml(plan.time)}</span>
                <span class="plan-countdown" data-time="${escapeHtml(plan.date)}T${escapeHtml(plan.time)}">${formatCountdown(diff)}</span>
            </div>
            <h3 style="color:var(--text-main);margin:4px 0;">${escapeHtml(plan.title)}</h3>
            ${plan.extra ? `<p style="color:var(--text-secondary);font-size:0.9rem;">${escapeHtml(plan.extra)}</p>` : ''}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'plan-delete-btn';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', 'Radera händelse');
        remove.addEventListener('click', async e => { e.stopPropagation(); await deletePlan(plan.id); });
        item.append(dateBox, details, remove);
        item.addEventListener('click', () => editPlan(plan.id));
        container.appendChild(item);
    });
}

function editPlan(id) {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    $('plan-form-section').classList.remove('hidden');
    $('plan-id').value = plan.id;
    $('plan-date').value = plan.date;
    $('plan-time').value = plan.time;
    $('plan-title').value = plan.title;
    $('plan-extra').value = plan.extra || '';
    $('plan-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deletePlan(id) {
    if (!db || !confirm('Radera händelse?')) return;
    try {
        await db.plans.delete(id);
        plans = await db.plans.toArray();
        sortPlans();
        renderPlans();
    } catch (e) { console.error(e); alert('Kunde inte radera händelsen: ' + e.message); }
}

function formatCountdown(diff) {
    if (diff <= 0) return 'Passerat';
    const days = Math.floor(diff / 86400000);
    const pad = n => String(n).padStart(2, '0');
    const time = `${pad(Math.floor((diff % 86400000) / 3600000))}:${pad(Math.floor((diff % 3600000) / 60000))}:${pad(Math.floor((diff % 60000) / 1000))}`;
    return days > 0 ? `${days}d ${time}` : time;
}

function updateCountdowns() {
    const view = $('plan-view');
    if (!view || view.classList.contains('hidden')) return;
    document.querySelectorAll('.plan-countdown').forEach(el => {
        const diff = new Date(el.dataset.time) - new Date();
        el.textContent = formatCountdown(diff);
        el.style.color = diff <= 0 ? 'var(--text-muted)' : '#8b5cf6';
        const item = el.closest('.plan-item');
        if (item) item.style.opacity = diff <= 0 ? '0.5' : '1';
    });
}