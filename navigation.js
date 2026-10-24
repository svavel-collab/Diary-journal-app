'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const views = [
        { key: 'journal', btn: document.getElementById('nav-journal'), view: document.getElementById('journal-view'), title: 'Journal', form: document.getElementById('form-section') },
        { key: 'plans', btn: document.getElementById('nav-plans'), view: document.getElementById('plan-view'), title: 'Planering', form: document.getElementById('plan-form-section') },
        { key: 'notes', btn: document.getElementById('nav-notes'), view: document.getElementById('notes-view'), title: 'Notes', form: document.getElementById('notes-form-section') },
        { key: 'sober', btn: document.getElementById('nav-sober'), view: document.getElementById('sober-view'), title: 'Sober', form: document.getElementById('sober-form-section') }
    ];

    function switchView(activeKey) {
        views.forEach(item => {
            if (item.key === activeKey) {
                item.btn.classList.add('active');
                item.view.classList.remove('hidden');
                document.getElementById('view-title').innerHTML = `${item.title} <span id="header-date"></span>`;
                updateHeaderDate();
            } else {
                item.btn.classList.remove('active');
                item.view.classList.add('hidden');
                if (item.form) item.form.classList.add('hidden');
            }
        });
    }

    views.forEach(item => {
        item.btn.onclick = () => switchView(item.key);
    });

    // Global Plus-knapp (+)
    document.getElementById('global-fab').onclick = () => {
        const active = views.find(v => !v.view.classList.contains('hidden'));
        if (!active || !active.form) return;

        if (active.key === 'journal' && typeof resetJournalForm === 'function') resetJournalForm();
        if (active.key === 'plans' && typeof resetPlanForm === 'function') resetPlanForm();
        if (active.key === 'notes' && typeof resetNoteForm === 'function') resetNoteForm();
        if (active.key === 'sober') {
            if (typeof resetSoberForm === 'function') resetSoberForm();
            // Tvinga fram aktuell tid i fältet när formuläret öppnas
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const localIso = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const soberStartInput = document.getElementById('sober-start');
            if (soberStartInput) soberStartInput.value = localIso;
        }

        active.form.classList.toggle('hidden');
    };
});
