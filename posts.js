'use strict';

let posts = [];
let currentFilter = 'all';
let currentImages = [];
let currentModalPostId = null;
let lightboxImages = [];
let lightboxIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultPostDate();
    try {
        posts = await db.posts.toArray();
        sortPosts();
        renderPosts();
    } catch (e) { console.error(e); }
    setupPostEvents();
});

function setDefaultPostDate() {
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('post-date');
    if (el) el.value = today;
}

function sortPosts() {
    posts.sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(b.id)));
}

function setupPostEvents() {
    document.getElementById('home-btn').onclick = () => {
        document.getElementById('journal-view').classList.remove('hidden');
        document.getElementById('plan-view').classList.add('hidden');
        document.getElementById('new-post-trigger').classList.remove('hidden');
        document.getElementById('new-plan-trigger').classList.add('hidden');
        document.getElementById('view-title').innerHTML = 'Journal <span id="header-date"></span>';
        updateHeaderDate();
        document.getElementById('home-btn').classList.add('active');
        document.getElementById('calendar-btn').classList.remove('active');
    };

    document.getElementById('new-post-trigger').onclick = () => {
        resetJournalForm();
        document.getElementById('form-section').classList.toggle('hidden');
    };
    document.getElementById('cancel-btn').onclick = () => document.getElementById('form-section').classList.add('hidden');
    document.getElementById('journal-form').onsubmit = handleSavePost;
    document.getElementById('post-images').onchange = handleImageUpload;

    document.getElementById('close-modal').onclick = () => document.getElementById('post-modal').classList.add('hidden');
    document.getElementById('delete-modal-btn').onclick = () => {
        if (currentModalPostId && confirm('Radera inlägget?')) {
            deletePost(currentModalPostId);
            document.getElementById('post-modal').classList.add('hidden');
        }
    };

    document.getElementById('lightbox-close').onclick = () => document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox-prev').onclick = () => navigateLightbox(-1);
    document.getElementById('lightbox-next').onclick = () => navigateLightbox(1);

    document.getElementById('search-input').oninput = function() {
        document.getElementById('clear-search-btn').classList.toggle('hidden', !this.value);
        renderPosts();
    };
    document.getElementById('clear-search-btn').onclick = () => {
        document.getElementById('search-input').value = '';
        document.getElementById('clear-search-btn').classList.add('hidden');
        renderPosts();
    };
}

async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (currentImages.length + files.length > 5) {
        alert('Max 5 bilder tillåtna.');
        e.target.value = '';
        return;
    }
    for (const file of files) {
        const compressed = await compressImage(file);
        currentImages.push(compressed);
    }
    renderImagePreviews();
    e.target.value = '';
}

function renderImagePreviews() {
    const c = document.getElementById('image-preview-container');
    c.innerHTML = '';
    currentImages.forEach((src, i) => {
        const w = document.createElement('div');
        w.style.position = 'relative';
        w.innerHTML = `<img src="${src}" style="width:76px;height:76px;object-fit:cover;border-radius:10px;"><button type="button" onclick="removePreviewImage(${i})" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">✕</button>`;
        c.appendChild(w);
    });
}
window.removePreviewImage = i => { currentImages.splice(i, 1); renderImagePreviews(); };

async function handleSavePost(e) {
    e.preventDefault();
    const id = document.getElementById('post-id').value || 'post_' + Date.now();
    const title = document.getElementById('post-title').value.trim();
    const date = document.getElementById('post-date').value;
    const tags = (document.getElementById('post-tags').value || '').split(',').map(t => t.trim()).filter(Boolean);
    const content = document.getElementById('post-content').value.trim();

    if (!title || !date || !content) return alert('Fyll i alla obligatoriska fält.');

    await db.posts.put({ id, title, date, tags, content, images: [...currentImages] });
    posts = await db.posts.toArray();
    sortPosts();

    document.getElementById('form-section').classList.add('hidden');
    resetJournalForm();
    renderPosts();
}

function resetJournalForm() {
    document.getElementById('journal-form').reset();
    document.getElementById('post-id').value = '';
    currentImages = [];
    document.getElementById('image-preview-container').innerHTML = '';
    setDefaultPostDate();
}

function renderPosts() {
    const c = document.getElementById('posts-container');
    c.innerHTML = '';
    renderFilterChips();
    sortPosts();

    const search = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = posts.filter(p => {
        if (currentFilter !== 'all' && (!p.tags || !p.tags.map(t => t.toLowerCase()).includes(currentFilter.toLowerCase()))) return false;
        if (search && !p.title.toLowerCase().includes(search) && !p.content.toLowerCase().includes(search) && (!p.tags || !p.tags.some(t => t.toLowerCase().includes(search)))) return false;
        return true;
    });

    if (!filtered.length) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga inlägg hittades.</p>';
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'post-card';
        const imgs = p.images || [];

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <h3 style="font-size:1.1rem;color:var(--text-main);">${escapeHtml(p.title)}</h3>
                <span style="font-size:0.8rem;color:var(--text-muted)">${p.date}</span>
            </div>
            <p style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-secondary);line-height:1.4;">${escapeHtml(p.content)}</p>
            ${imgs.length ? `<div class="post-images">${imgs.map(img => `<img src="${img}">`).join('')}</div>` : ''}
            <div>${p.tags ? p.tags.map(t => `<span class="post-tag">#${t}</span>`).join('') : ''}</div>
        `;
        card.onclick = () => openPostModal(p);
        c.appendChild(card);
    });
}

function renderFilterChips() {
    const c = document.getElementById('filter-tags-container');
    c.innerHTML = '';
    const all = document.createElement('button');
    all.type = 'button';
    all.className = `filter-chip ${currentFilter === 'all' ? 'active' : ''}`;
    all.textContent = 'Alla';
    all.onclick = () => { currentFilter = 'all'; renderPosts(); };
    c.appendChild(all);

    const tagsSet = new Set();
    posts.forEach(p => p.tags && p.tags.forEach(t => tagsSet.add(t.trim())));
    tagsSet.forEach(tag => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `filter-chip ${currentFilter.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`;
        btn.textContent = tag;
        btn.onclick = () => { currentFilter = tag; renderPosts(); };
        c.appendChild(btn);
    });
}

function openPostModal(post) {
    currentModalPostId = post.id;
    const imgs = post.images || [];
    const imgsJson = JSON.stringify(imgs).replace(/"/g, '&quot;');

    document.getElementById('modal-content-container').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="font-size:1.25rem;color:var(--text-main);">${escapeHtml(post.title)}</h2>
            <span style="font-size:0.85rem;color:var(--text-muted)">${post.date}</span>
        </div>
        <p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">${escapeHtml(post.content)}</p>
        ${imgs.length ? `<div class="post-images">${imgs.map((img, i) => `<img src="${img}" onclick="event.stopPropagation();openLightbox(${imgsJson},${i})">`).join('')}</div>` : ''}
        <div style="margin-top:20px;text-align:right"><button type="button" onclick="editPost('${post.id}')" class="btn-primary">Redigera</button></div>
    `;
    document.getElementById('post-modal').classList.remove('hidden');
}

window.editPost = id => {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('post-modal').classList.add('hidden');
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('post-id').value = p.id;
    document.getElementById('post-title').value = p.title;
    document.getElementById('post-date').value = p.date;
    document.getElementById('post-tags').value = p.tags ? p.tags.join(', ') : '';
    document.getElementById('post-content').value = p.content;
    currentImages = p.images ? [...p.images] : [];
    renderImagePreviews();
};

async function deletePost(id) {
    await db.posts.delete(id);
    posts = await db.posts.toArray();
    sortPosts();
    renderPosts();
}

window.openLightbox = (imgs, idx) => {
    lightboxImages = imgs;
    lightboxIndex = idx;
    updateLightboxImg();
    document.getElementById('lightbox').classList.remove('hidden');
};

function updateLightboxImg() {
    document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
}

function navigateLightbox(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    updateLightboxImg();
}
