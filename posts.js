'use strict';

const postImages = p => Array.isArray(p.images) ? p.images : (Array.isArray(p.pics) ? p.pics : []);
const postTags = p => Array.isArray(p.tags) ? p.tags : [];

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
        sortPosts();
        renderPosts();
    } catch (e) { console.error(e); alert('Kunde inte radera inlägget: ' + e.message); }
}

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