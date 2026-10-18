'use strict';

const DB_NAME = 'DigitalJournalDB', POSTS_KEY = 'digital_journal_posts', PLANS_KEY = 'digital_journal_plans';
const $ = id => document.getElementById(id);
const on = (id, ev, fn) => $(id)?.addEventListener(ev, fn);

let db, posts = [], plans = [], currentFilter = 'all', currentImages = [],
    currentModalPostId = null, lightboxImages = [], lightboxCurrentIndex = 0;

document.addEventListener('DOMContentLoaded', startApp);

async function startApp() {
    setupEventListeners(); setDefaultDates(); updateHeaderDate();
    if (typeof Dexie === 'undefined') return showError('Dexie kunde inte laddas. Kontrollera internetanslutningen.');
    try {
        db = new Dexie(DB_NAME);
        db.version(1).stores({ posts: 'id, date, title', plans: 'id, date, time' });
        window.db = db;
        await migrateOldData();
        await refreshData();
    } catch (e) {
        console.error('Databasfel:', e);
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

    on('search-input', 'input', e => {
        $('clear-search-btn').classList.toggle('hidden', !e.target.value);
        renderPosts();
    });
    on('clear-search-btn', 'click', () => {
        $('search-input').value = '';
        $('clear-search-btn').classList.add('hidden');
        renderPosts();
    });

    on('export-btn', 'click', exportData);
    on('import-btn', 'click', () => $('import-file').click());
    on('import-file', 'change', importData);

    on('lightbox-close', 'click', () => $('lightbox').classList.add('hidden'));
    on('lightbox-prev', 'click', () => navigateLightbox(-1));
    on('lightbox-next', 'click', () => navigateLightbox(1));
}

// ===== BILDER =====
function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (currentImages.length + files.length > 6) {
        alert('Max 6 bilder per inlägg.');
        event.target.value = '';
        return;
    }
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            if (typeof e.target.result === 'string') { currentImages.push(e.target.result); renderImagePreviews(); }
        };
        reader.onerror = () => alert('Kunde inte läsa bilden.');
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function renderImagePreviews() {
    const container = $('image-preview-container');
    if (!container) return;
    container.innerHTML = '';
    currentImages.forEach((src, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Förhandsvisning ${index + 1}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '✕';
        button.style.cssText = 'position:absolute;top:-5px;right:-5px;padding:4px 7px;background:#ef4444;color:white;';
        button.addEventListener('click', () => { currentImages.splice(index, 1); renderImagePreviews(); });
        wrapper.append(img, button);
        container.appendChild(wrapper);
    });
}

// ===== INLÄGG =====
async function handleSavePost(event) {
    event.preventDefault();
    if (!db) return alert('Databasen är inte tillgänglig.');

    const id = $('post-id').value || `post_${Date.now()}`;
    const title = $('post-title').value.trim();
    const date = $('post-date').value;
    const tags = $('post-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    const content = $('post-content').value.trim();

    if (!title || !date || !content) return alert('Fyll i rubrik, datum och innehåll.');

    try {
        await db.posts.put({ id, title, date, tags, content, images: [...currentImages] });
        posts = await db.posts.toArray();
        sortPosts();
        $('form-section').classList.add('hidden');
        resetJournalForm();
        renderPosts();
    } catch (e) { console.error(e); alert('Kunde inte spara inlägget: ' + e.message); }
}

function resetJournalForm() {
    $('journal-form')?.reset();
    $('post-id').value = '';
    currentImages = [];
    $('image-preview-container').innerHTML = '';
    setDefaultDates();
}

const postImages = p => Array.isArray(p.images) ? p.images : (Array.isArray(p.pics) ? p.pics : []);
const postTags = p => Array.isArray(p.tags) ? p.tags : [];

function renderPosts() {
    const container = $('posts-container');
    if (!container) return;
    container.innerHTML = '';
    renderFilterChips();

    const search = ($('search-input')?.value || '').toLowerCase().trim();

    const filtered = posts.filter(post => {
        const tags = postTags(post);
        if (currentFilter !== 'all' && !tags.some(t => String(t).toLowerCase() === currentFilter.toLowerCase())) return false;
        if (!search) return true;
        return String(post.title || '').toLowerCase().includes(search) ||
            String(post.content || post.text || '').toLowerCase().includes(search) ||
            tags.some(t => String(t).toLowerCase().includes(search));
    });

    if (!filtered.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga inlägg</p>';
        return;
    }

    filtered.forEach(post => {
        const images = postImages(post), tags = postTags(post);
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;">
                <h3 style="font-size:1.1rem;">${escapeHtml(post.title)}</h3>
                <span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">${escapeHtml(post.date)}</span>
            </div>
            <p style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-secondary);line-height:1.4;">${escapeHtml(post.content || post.text || '')}</p>
            ${images.length ? `<div class="post-images">${images.map((src, i) => `<img src="${src}" alt="Bild ${i + 1}">`).join('')}</div>` : ''}
            <div>${tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join('')}</div>`;
        card.addEventListener('click', () => openPostModal(post));
        container.appendChild(card);
    });
}

function renderFilterChips() {
    const container = $('filter-tags-container');
    if (!container) return;
    container.innerHTML = '';

    const addChip = (label, value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip' + (currentFilter.toLowerCase() === value.toLowerCase() ? ' active' : '');
        button.textContent = label;
        button.addEventListener('click', () => { currentFilter = value; renderPosts(); });
        container.appendChild(button);
    };

    addChip('Alla', 'all');
    const tags = new Set();
    posts.forEach(p => postTags(p).forEach(t => tags.add(String(t).trim())));
    tags.forEach(tag => addChip(tag, tag));
}

function openPostModal(post) {
    currentModalPostId = post.id;
    const container = $('modal-content-container');
    const images = postImages(post), tags = postTags(post);

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:12px;">
            <h2>${escapeHtml(post.title)}</h2>
            <span style="color:var(--text-muted);white-space:nowrap;">${escapeHtml(post.date)}</span>
        </div>
        <p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">${escapeHtml(post.content || post.text || '')}</p>
        ${images.length ? `<div class="post-images">${images.map((src, i) => `<img src="${src}" data-image-index="${i}" alt="Bild ${i + 1}">`).join('')}</div>` : ''}
        <div>${tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join('')}</div>
        <div style="margin-top:20px;text-align:right;"><button type="button" id="edit-post-btn" class="btn-primary">Redigera</button></div>`;

    container.querySelectorAll('[data-image-index]').forEach(img =>
        img.addEventListener('click', e => { e.stopPropagation(); openLightbox(images, Number(img.dataset.imageIndex)); }));

    $('edit-post-btn').addEventListener('click', () => editPost(post.id));
    $('post-modal').classList.remove('hidden');
}

function editPost(id) {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    $('post-modal').classList.add('hidden');
    $('form-section').classList.remove('hidden');
    $('post-id').value = post.id;
    $('post-title').value = post.title || '';
    $('post-date').value = post.date || localDate();
    $('post-tags').value = postTags(post).join(', ');
    $('post-content').value = post.content || post.text || '';
    currentImages = [...postImages(post)];
    renderImagePreviews();
    $('form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deletePost(id) {
    if (!db || !confirm('Radera inlägg?')) return;
    try {
        await db.posts.delete(id);
        posts = await db.posts.toArray();
        sortPosts(); renderPosts();
    } catch (e) { console.error(e); alert('Kunde inte radera inlägget: ' + e.message); }
}

// ===== PLANERING =====
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
        sortPlans(); renderPlans();
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

// ===== LIGHTBOX =====
function openLightbox(images, index) {
    if (!Array.isArray(images) || !images.length) return;
    lightboxImages = images;
    lightboxCurrentIndex = index;
    updateLightbox();
    $('lightbox').classList.remove('hidden');
}

function updateLightbox() {
    const img = $('lightbox-img');
    if (img && lightboxImages.length) img.src = lightboxImages[lightboxCurrentIndex];
}

function navigateLightbox(direction) {
    if (!lightboxImages.length) return;
    lightboxCurrentIndex = (lightboxCurrentIndex + direction + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
}

Object.assign(window, { openLightbox, editPost, editPlan, deletePlan });

// ===== EXPORT / IMPORT =====
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
    if (!db) { alert('Databasen är inte ti