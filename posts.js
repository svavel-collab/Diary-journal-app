'use strict';

let posts = [];
let currentImages = [];
let lightboxImages = [];
let lightboxIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDate('post-date');
    try {
        if (window.db && typeof db.open === 'function') await db.open();
        const raw = await db.posts.toArray();
        raw.sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id || '').localeCompare(String(a.id || '')));
        posts = raw.map(p => ({ ...p, isOpen: false, isEditing: false, editImages: [...(p.images || [])] }));
        renderPosts();
    } catch (e) { 
        console.error('Kunde inte ladda inlägg:', e);
        renderPosts();
    }
    setupEvents();
});

const esc = s => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
const setDefaultDate = id => { const el = document.getElementById(id); if (el) el.value = new Date().toISOString().split('T')[0]; };

function setupEvents() {
    const cancel = document.getElementById('cancel-btn');
    if (cancel) cancel.onclick = () => { document.getElementById('form-section').classList.add('hidden'); resetForm(); };
    
    const form = document.getElementById('journal-form');
    if (form) form.onsubmit = handleSavePost;
    
    const imgInput = document.getElementById('post-images');
    if (imgInput) imgInput.onchange = e => handleImages(e, currentImages, 'image-preview-container');
    
    ['lightbox-close', 'lightbox-prev', 'lightbox-next'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) el.onclick = idx === 0 ? () => document.getElementById('lightbox').classList.add('hidden') : () => navLb(idx === 1 ? -1 : 1);
    });

    const search = document.getElementById('search-input');
    if (search) search.oninput = function() {
        document.getElementById('clear-search-btn')?.classList.toggle('hidden', !this.value);
        renderPosts();
    };
    
    const clear = document.getElementById('clear-search-btn');
    if (clear) clear.onclick = () => { document.getElementById('search-input').value = ''; clear.classList.add('hidden'); renderPosts(); };
}

async function handleImages(e, targetArr, containerId) {
    const files = Array.from(e.target.files);
    if (targetArr.length + files.length > 5) return alert('Max 5 bilder tillåtna.');
    for (const f of files) targetArr.push(await compressImage(f));
    renderPreviews(targetArr, containerId);
    e.target.value = '';
}

function renderPreviews(arr, containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = arr.map((src, i) => `
        <div style="position:relative;display:inline-block;">
            <img src="${src}" style="width:68px;height:68px;object-fit:cover;border-radius:10px;display:block;">
            <button type="button" onclick="removeImg('${containerId}', ${i})" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;width:24px;height:24px;padding:0;">
                <span style="position:absolute;top:0;right:2px;color:black;font-weight:bold;">✕</span>
                <span style="position:absolute;top:-1px;right:3px;color:white;font-weight:bold;">✕</span>
            </button>
        </div>`).join('');
}

window.removeImg = (containerId, i) => {
    if (containerId === 'image-preview-container') {
        currentImages.splice(i, 1);
        renderPreviews(currentImages, containerId);
    }
};

async function handleSavePost(e) {
    e.preventDefault();
    const title = document.getElementById('post-title').value.trim();
    const date = document.getElementById('post-date').value;
    const tags = (document.getElementById('post-tags').value || '').split(',').map(t => t.trim()).filter(Boolean);
    const content = document.getElementById('post-content').value.trim();

    if (!title || !date || !content) return alert('Fyll i alla obligatoriska fält.');

    const newPost = { id: 'post_' + Date.now(), title, date, tags, content, images: [...currentImages], isOpen: false, isEditing: false, editImages: [...currentImages] };
    await db.posts.put(newPost);
    posts.unshift(newPost);
    document.getElementById('form-section').classList.add('hidden');
    resetForm();
    renderPosts();
}

function resetForm() {
    document.getElementById('journal-form')?.reset();
    currentImages = [];
    const c = document.getElementById('image-preview-container');
    if (c) c.innerHTML = '';
    setDefaultDate('post-date');
}

function renderPosts() {
    const c = document.getElementById('posts-container');
    if (!c) return;
    c.innerHTML = '';
    
    try {
        const search = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
        const filtered = posts.filter(p => !search || p.title.toLowerCase().includes(search) || p.content.toLowerCase().includes(search) || (p.tags && p.tags.some(t => t.toLowerCase().includes(search))));

        if (!filtered.length) {
            c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga inlägg hittades.</p>';
            return;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'post-card';
            const imgs = p.images || [];
            const imgsJson = JSON.stringify(imgs).replace(/"/g, '&quot;');

            if (p.isEditing) {
                const editImgs = p.editImages || [];
                card.innerHTML = `
                    <div style="margin-bottom:10px;">
                        <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:2px;">Rubrik</label>
                        <input type="text" id="edit-title-${p.id}" value="${esc(p.title)}" style="margin-bottom:8px;">
                        
                        <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:2px;">Datum</label>
                        <input type="date" id="edit-date-${p.id}" value="${p.date}" style="margin-bottom:8px;">
                        
                        <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:2px;">Taggar</label>
                        <input type="text" id="edit-tags-${p.id}" value="${p.tags ? p.tags.join(', ') : ''}" style="margin-bottom:8px;">
                        
                        <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:2px;">Innehåll</label>
                        <textarea id="edit-content-${p.id}" style="min-height:100px;margin-bottom:8px;">${esc(p.content)}</textarea>
                        
                        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                            ${editImgs.map((img, idx) => `
                                <div style="position:relative;display:inline-block;">
                                    <img src="${img}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">
                                    <button type="button" onclick="event.stopPropagation();rmEditImg('${p.id}', ${idx})" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;width:20px;height:20px;padding:0;">
                                        <span style="color:black;font-weight:bold;">✕</span>
                                    </button>
                                </div>`).join('')}
                        </div>
                        <input type="file" accept="image/*" multiple onchange="addEditImg(event, '${p.id}')" style="font-size:0.8rem;margin-bottom:12px;">
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;">
                        <button type="button" onclick="event.stopPropagation();cancelEdit('${p.id}')" class="btn-secondary" style="padding:6px 14px;font-size:0.8rem;">Avbryt</button>
                        <button type="button" onclick="event.stopPropagation();saveEdit('${p.id}')" class="btn-primary" style="padding:6px 14px;font-size:0.8rem;">Spara</button>
                    </div>`;
            } else if (p.isOpen) {
                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div class="post-title" style="font-size:1.15rem;">${esc(p.title)}</div>
                        <div class="post-date-badge">${p.date}</div>
                    </div>
                    <p style="white-space:pre-wrap;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">${esc(p.content)}</p>
                    ${imgs.length ? `<div class="post-images">${imgs.map((img, i) => `<img src="${img}" onclick="event.stopPropagation();openLightbox(${imgsJson},${i})">`).join('')}</div>` : ''}
                    <div style="margin-top:10px;">${p.tags ? p.tags.map(t => `<span class="post-tag">#${esc(t)}</span>`).join('') : ''}</div>
                    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
                        <button type="button" onclick="event.stopPropagation();delPost('${p.id}')" class="btn-danger" style="padding:6px 12px;font-size:0.8rem;">Radera</button>
                        <button type="button" onclick="event.stopPropagation();startEdit('${p.id}')" class="btn-primary" style="padding:6px 14px;font-size:0.8rem;">Redigera</button>
                    </div>`;
            } else {
                card.innerHTML = `
                    <div class="post-header-row">
                        <div class="post-title">${esc(p.title)}</div>
                        <div class="post-date-badge">${p.date}</div>
                    </div>
                    <div class="post-preview-text">${esc(p.content)}</div>
                    ${imgs.length ? `<div class="post-images">${imgs.map(img => `<img src="${img}">`).join('')}</div>` : ''}
                    <div>${p.tags ? p.tags.map(t => `<span class="post-tag">#${esc(t)}</span>`).join('') : ''}</div>`;
            }

            card.onclick = () => {
                if (!p.isEditing) {
                    const wasOpen = p.isOpen;
                    posts.forEach(x => { x.isOpen = false; x.isEditing = false; });
                    p.isOpen = !wasOpen;
                    renderPosts();
                }
            };
            c.appendChild(card);
        });
    } catch (e) {
        console.error('Kunde inte rendera inlägg:', e);
    }
}

window.startEdit = id => { const p = posts.find(x => x.id === id); if (p) { p.isEditing = true; p.editImages = [...(p.images || [])]; renderPosts(); } };
window.cancelEdit = id => { const p = posts.find(x => x.id === id); if (p) { p.isEditing = false; p.isOpen = false; renderPosts(); } };
window.rmEditImg = (id, idx) => { const p = posts.find(x => x.id === id); if (p) { p.editImages.splice(idx, 1); renderPosts(); } };
window.addEditImg = async (e, id) => {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    for (const f of Array.from(e.target.files)) {
        if (p.editImages.length < 5) p.editImages.push(await compressImage(f));
    }
    renderPosts();
};

window.saveEdit = async id => {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    const title = document.getElementById(`edit-title-${id}`).value.trim();
    const date = document.getElementById(`edit-date-${id}`).value;
    const tags = (document.getElementById(`edit-tags-${id}`).value || '').split(',').map(t => t.trim()).filter(Boolean);
    const content = document.getElementById(`edit-content-${id}`).value.trim();

    if (!title || !date || !content) return alert('Fyll i alla obligatoriska fält.');

    Object.assign(p, { title, date, tags, content, images: [...p.editImages], isEditing: false, isOpen: false });
    await db.posts.put({ id: p.id, title: p.title, date: p.date, tags: p.tags, content: p.content, images: p.images });
    renderPosts();
};

window.delPost = async id => {
    if (confirm('Radera inlägget?')) {
        await db.posts.delete(id);
        posts = posts.filter(p => p.id !== id);
        renderPosts();
    }
};

window.openLightbox = (imgs, idx) => {
    lightboxImages = imgs; lightboxIndex = idx;
    document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
    document.getElementById('lightbox').classList.remove('hidden');
};

function navLb(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
}
