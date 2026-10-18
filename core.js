'use strict';

const DB_NAME = 'DigitalJournalDB', POSTS_KEY = 'digital_journal_posts', PLANS_KEY = 'digital_journal_plans';
const $ = id => document.getElementById(id);
const on = (id, ev, fn) => $(id)?.addEventListener(ev, fn);

let db = null, posts = [], plans = [], currentFilter = 'all', currentImages = [],
    currentModalPostId = null, lightboxImages = [], lightboxCurrentIndex = 0;

// ===== DIAGNOSTIK (visar fel längst ner på skärmen) =====
let _diagEl = null;
function diag(msg, color) {
    if (!_diagEl) {
        _diagEl = document.createElement('div');
        _diagEl.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:8px;text-align:center;font-size:12px;z-index:99999;font-family:monospace;color:#fff;';
        document.documentElement.appendChild(_diagEl);
    }
    _diagEl.textContent = msg;
    _diagEl.style.background = color || '#8b5cf6';
}
diag('core.js laddat');
window.addEventListener('error', e => diag('JS-fel: ' + e.message, '#ef4444'));

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

async function startApp() {
    try {
        diag('startApp körs...');
        setupEventListeners();
        diag('Knappar kopplade');
        setDefaultDates();
        updateHeaderDate();
    } catch (e) {
        console.error('Setup-fel:', e);
        diag('Setup-fel: ' + e.message, '#ef4444');
        return;
    }

    if (typeof Dexie === 'undefined') {
        diag('Dexie saknas – kolla internet', '#ef4444');
        return showError('Dexie kunde inte laddas. Kontrollera internetanslutningen.');
    }

    try {
        db = new Dexie(DB_NAME);
        db.version(1).stores({ posts: 'id, date, title', plans: 'id, date, time' });
        window.db = db;
        await migrateOldData();
        await refreshData();
        diag('Redo ✓', '#22c55e');
        setTimeout(() => _diagEl?.remove(), 2500);
    } catch (e) {
        console.error('DB-fel:', e);
        diag('DB-fel: ' + e.message, '#ef4444');
        showError('Databasen kunde inte startas: ' + e.message);
    }
}

function showError(message) {
    let box = $('app-error-message');
    if (!box) {
        box = document.createElement('p');
        box.id = 'app-error-message';
        box.style.cssText = 'padding:14px;margin:12px 0;background:#451a1a;color:#fff;border-radius:10px;';
        document.querySelector('main')?.prepend(box);
    }
    box.textContent = message;
}

const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setDefaultDates() {
    if ($('post-date') && !$('post-date').value) $('post-date').value = localDate();
    if ($('plan-date') && !$('plan-date').value) $('plan-date').value = localDate();
    if ($('plan-time') && !$('plan-time').value) $('plan-time').value = '12:00';
}

function updateHeaderDate() {
    const el = $('header-date');
    if (!el) return;
    const d = new Date();
    el.textContent = `${d.getDate()} ${d.toLocaleString('sv-SE', { month: 'short' }).replace('.', '')}`;
}

function setViewTitle(title) {
    const el = $('view-title');
    if (!el) return;
    el.textContent = title;
    const date = document.createElement('span');
    date.id = 'header-date';
    el.appendChild(date);
    updateHeaderDate();
}

const sortPosts = () => posts.sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || '')));

const sortPlans = () => plans.sort((a, b) =>
    new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

async function migrateOldData() {
    for (const [key, table] of [[POSTS_KEY, 'posts'], [PLANS_KEY, 'plans']]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length) await db[table].bulkPut(data);
            localStorage.removeItem(key);
        } catch (e) { console.warn('Kunde inte migrera äldre data:', e); }
    }
}

async function refreshData() {
    posts = await db.posts.toArray();
    plans = await db.plans.toArray();
    sortPosts(); sortPlans(); renderPosts(); renderPlans();
}

function switchView(view) {
    const journal = view === 'journal';
    $('journal-view').classList.toggle('hidden', !journal);
    $('plan-view').classList.toggle('hidden', journal);
    $('new-post-trigger').classList.toggle('hidden', !journal);
    $('new-plan-trigger').classList.toggle('hidden', journal);
    $('home-btn').classList.toggle('active', journal);
    $('calendar-btn').classList.toggle('active', !journal);
    setViewTitle(journal ? 'Journal' : 'Planering');
    journal ? renderPosts() : renderPlans();
}

function setupEventListeners() {
    // Kollar så att de andra filerna verkligen har laddats in
    if (typeof handleSavePost === 'undefined') {
        throw new Error("Filen posts.js saknas, är tom eller har fel. Spara om filen!");
    }
    if (typeof handleSavePlan === 'undefined') {
        throw new Error("Filen plans.js saknas, är tom eller har fel. Spara om filen!");
    }

    on('home-btn', 'click', () => switchView('journal'));
    on('calendar-btn', 'click', () => switchView('plan'));
    on('new-post-trigger', 'click', () => { resetJournalForm(); $('form-section').classList.toggle('hidden'); });
    on('cancel-btn', 'click', () => { $('form-section').classList.add('hidden'); resetJournalForm(); });
    on('journal-form', 'submit', handleSavePost);
    on('post-images', 'change', handleImageUpload);
    on('new-plan-trigger', 'click', () => { resetPlanForm(); $('plan-form-section').classList.toggle('hidden'); });
    on('plan-cancel-btn', 'click', () => { $('plan-form-section').classList.add('hidden'); resetPlanForm(); });
    on('plan-form', 'submit', handleSavePlan);
    on('close-modal', 'click', () => $('post-modal').classList.add('hidden'));
    on('delete-modal-btn', 'click', async () => {
        if (!currentModalPostId) return;
        await deletePost(currentModalPostId);
        $('post-modal').classList.add('hidden');
    });
    on('post-modal', 'click', e => { if (e.target.id === 'post-modal') $('post-modal').classList.add('hidden'); });
    on('settings-btn', 'click', () => $('settings-modal').classList.remove('hidden'));
    on('close-settings', 'click', () => $('settings-modal').classList.add('hidden'));
    on('settings-modal', 'click', e => { if (e.target.id === 'settings-modal') $('settings-modal').classList.add('hidden'); });
    on('search-input', 'input', e => { $('clear-search-btn').classList.toggle('hidden', !e.target.value); renderPosts(); });
    on('clear-search-btn', 'click', () => { $('search-input').value = ''; $('clear-search-btn').classList.add('hidden'); renderPosts(); });
    on('export-btn', 'click', exportData);
    on('import-btn', 'click', () => $('import-file').click());
    on('import-file', 'change', importData);
    on('lightbox-close', 'click', () => $('lightbox').classList.add('hidden'));
    on('lightbox-prev', 'click', () => navigateLightbox(-1));
    on('lightbox-next', 'click', () => navigateLightbox(1));
}

async function exportData() {
    if (!db) return alert('Databasen är inte tillgänglig.');
    try {
        const data = { posts: await db.posts.toArray(), plans: await db.plans.toArray(), exportedAt: new Date().toISOString() };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        const d = new Date();
        link.href = url;
        link.download = `jour_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { console.error(e); alert('Export misslyckades: ' + e.message); }
}

async function importData(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!db) { alert('Databasen är inte tillgänglig.'); input.value = ''; return; }
    if (!confirm('Detta ersätter ALL nuvarande data. Vill du fortsätta?')) { input.value = ''; return; }
    try {
        let content = await file.text();
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        const data = JSON.parse(content);
        if (!Array.isArray(data.posts) && !Array.isArray(data.plans))
            throw new Error('Filen saknar giltiga listor för inlägg och planering.');
        await db.transaction('rw', db.posts, db.plans, async () => {
            await db.posts.clear();
            await db.plans.clear();
            if (Array.isArray(data.posts)) await db.posts.bulkPut(data.posts);
            if (Array.isArray(data.plans)) await db.plans.bulkPut(data.plans);
        });
        await refreshData();
        $('settings-modal').classList.add('hidden');
        alert('Importen lyckades!');
    } catch (e) {
        console.error(e);
        alert('Import misslyckades: ' + e.message);
    } finally { input.value = ''; }
}