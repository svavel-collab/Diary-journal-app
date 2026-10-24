'use strict';

let posts = [];
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
    } catch (e) { console.error('Kunde inte ladda inlägg:', e); }
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
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => document.getElementById('form-section').classList.add('hidden');
    
    const form = document.getElementById('journal-form');
    if (form) form.onsubmit = handleSavePost;
    
    const imageInput = document.getElementById('post-images');
    if (imageInput) imageInput.onchange = handleImageUpload;

    const closeModal = document.getElementById('close-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('post-modal').classList.add('hidden');
    
    const deleteModalBtn = document.getElementById('delete-modal-btn');
    if (deleteModalBtn) {
        deleteModalBtn.onclick = () => {
            if (currentModalPostId && confirm('Radera inlägget?')) {
                deletePost(currentModalPostId);
                document.getElementById('post-modal').classList.add('hidden');
            }
        };
    }

    const lbClose = document.getElementById('lightbox-close');
    if (lbClose) lbClose.onclick = () => document.getElementById('lightbox').classList.add('hidden');
    
    const lbPrev = document.getElementById('lightbox-prev');
    if (lbPrev) lbPrev.onclick = () => navigateLightbox(-1);
    
    const lbNext = document.getElementById('lightbox-next');
    if (lbNext) lbNext.onclick = () => navigateLightbox(1);

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = function() {
            const clearBtn = document.getElementById('clear-search-btn');
            if (clearBtn) clearBtn.classList.toggle('hidden', !this.value);
            renderPosts();
        };
    }

    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            document.getElementById('search-input').value = '';
            clearBtn.classList.add('hidden');
            renderPosts();
        };
    }
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
    if (!c) return;
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
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    setDefaultPostDate();
}

function renderPosts() {
    const c = document.getElementById('posts-container');
    if (!c) return;
    c.innerHTML = '';
    sortPosts();

    const searchInput = document.getElementById('search-input');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const filtered = posts.filter(p => {
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

        // Återställd klassisk Journal-struktur med lila brödtext, datum uppe till höger och bilder under
        card.innerHTML = `
            <div class="post-header-row">
                <div class="post-title">${escapeHtml(p.title)}</div>
                <div class="post-date-badge">${p.date}</div>
            </div>
            <div class="post-preview-text">${escapeHtml(p.content)}</div>
            ${imgs.length ? `<div class="post-images">${imgs.map(img => `<img src="${img}">`).join('')}</div>` : ''}
            <div>${p.tags ? p.tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join('') : ''}</div>
        `;
        card.onclick = () => openPostModal(p);
        c.appendChild(card);
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
        <div style="margin-top:10px;">${post.tags ? post.tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join('') : ''}</div>
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
