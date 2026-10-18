// ==========================================
// SUPABASE KONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://dlnetiryfhndmrbapgun.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_kZw8bigzxzrXLHDWaQR-Qg_ewteBygi';

let db = null;
if (window.supabase && window.supabase.createClient) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('Supabase biblioteket kunde inte laddas.');
}

let posts = [], plans = [], currentFilter = 'all', currentImages = [], currentModalPostId = null;
let lightboxImages = [], lightboxCurrentIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDates();
    updateHeaderDate();
    setupEventListeners();
    await loadInitialData();
    setInterval(updateCountdowns, 1000);
});

function sortPostsDescending(arr) {
    return arr.sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
}

async function loadInitialData() {
    if (!db) {
        alert('Det gick inte att ansluta till databasen (Supabase-skriptet saknas). Kontrollera internetanslutningen.');
        return;
    }
    try {
        const { data: postsData, error: postsError } = await db.from('posts').select('*');
        if (postsError) {
            console.error('Posts Error:', postsError);
            alert('Kunde inte läsa inlägg från molnet: ' + postsError.message);
            throw postsError;
        }
        posts = postsData || [];
        sortPostsDescending(posts);

        const { data: plansData, error: plansError } = await db.from('plans').select('*');
        if (plansError) {
            console.error('Plans Error:', plansError);
            throw plansError;
        }
        plans = plansData || [];
        plans.sort((a,b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        renderPosts(); 
        renderPlans();
    } catch (e) { 
        console.error('Kunde inte ladda data från Supabase:', e); 
    }
}

function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (el) { const d = new Date(); el.textContent = `${d.getDate()} ${d.toLocaleString('sv-SE',{month:'short'}).replace('.','')}`; }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const pDate = document.getElementById('post-date');
    const plDate = document.getElementById('plan-date');
    const plTime = document.getElementById('plan-time');
    if (pDate) pDate.value = today;
    if (plDate) plDate.value = today;
    if (plTime) plTime.value = '12:00';
}

function escapeHtml(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

// ========== VYER ==========
function setupEventListeners() {
    const homeBtn = document.getElementById('home-btn');
    const calBtn = document.getElementById('calendar-btn');
    
    if (homeBtn) {
        homeBtn.onclick = () => {
            document.getElementById('journal-view').classList.remove('hidden');
            document.getElementById('plan-view').classList.add('hidden');
            document.getElementById('new-post-trigger').classList.remove('hidden');
            document.getElementById('new-plan-trigger').classList.add('hidden');
            document.getElementById('view-title').innerHTML = 'Journal <span id="header-date"></span>';
            updateHeaderDate();
            homeBtn.classList.add('active');
            if (calBtn) calBtn.classList.remove('active');
        };
    }

    if (calBtn) {
        calBtn.onclick = () => {
            document.getElementById('plan-view').classList.remove('hidden');
            document.getElementById('journal-view').classList.add('hidden');
            document.getElementById('new-plan-trigger').classList.remove('hidden');
            document.getElementById('new-post-trigger').classList.add('hidden');
            document.getElementById('view-title').innerHTML = 'Planering <span id="header-date"></span>';
            updateHeaderDate();
            renderPlans();
            calBtn.classList.add('active');
            if (homeBtn) homeBtn.classList.remove('active');
        };
    }

    const newPostTrigger = document.getElementById('new-post-trigger');
    if (newPostTrigger) {
        newPostTrigger.onclick = () => { resetJournalForm(); document.getElementById('form-section').classList.toggle('hidden'); };
    }

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => document.getElementById('form-section').classList.add('hidden');
    }

    const newPlanTrigger = document.getElementById('new-plan-trigger');
    if (newPlanTrigger) {
        newPlanTrigger.onclick = () => { resetPlanForm(); document.getElementById('plan-form-section').classList.toggle('hidden'); };
    }

    const planCancelBtn = document.getElementById('plan-cancel-btn');
    if (planCancelBtn) {
        planCancelBtn.onclick = () => document.getElementById('plan-form-section').classList.add('hidden');
    }

    const journalForm = document.getElementById('journal-form');
    if (journalForm) journalForm.onsubmit = handleSavePost;

    const planForm = document.getElementById('plan-form');
    if (planForm) planForm.onsubmit = handleSavePlan;

    const postImages = document.getElementById('post-images');
    if (postImages) postImages.onchange = handleImageUpload;

    const closeModal = document.getElementById('close-modal');
    if (closeModal) closeModal.onclick = () => document.getElementById('post-modal').classList.add('hidden');

    const deleteModalBtn = document.getElementById('delete-modal-btn');
    if (deleteModalBtn) {
        deleteModalBtn.onclick = () => {
            if (currentModalPostId) { deletePost(currentModalPostId); document.getElementById('post-modal').classList.add('hidden'); }
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

    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            renderPosts();
        };
    }
}

// ========== BILDER ==========
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (currentImages.length + files.length > 6) { alert('Max 6 bilder'); e.target.value = ''; return; }
    files.forEach(f => {
        const r = new FileReader();
        r.onload = ev => { currentImages.push(ev.target.result); renderImagePreviews(); };
        r.readAsDataURL(f);
    });
    e.target.value = '';
}
function renderImagePreviews() {
    const c = document.getElementById('image-preview-container');
    if (!c) return;
    c.innerHTML = '';
    currentImages.forEach((src,i) => {
        const w = document.createElement('div');
        w.style.position = 'relative';
        w.innerHTML = `<img src="${src}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;"><button type="button" onclick="removePreviewImage(${i})" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">✕</button>`;
        c.appendChild(w);
    });
}
window.removePreviewImage = i => { currentImages.splice(i,1); renderImagePreviews(); };

// ========== INLÄGG ==========
async function handleSavePost(e) {
    e.preventDefault();
    if (!db) return alert('Ingen anslutning till molnet.');
    
    const id = document.getElementById('post-id').value || 'post_' + Date.now();
    const title = document.getElementById('post-title').value.trim();
    const date = document.getElementById('post-date').value;
    const tags = (document.getElementById('post-tags').value || '').split(',').map(t=>t.trim()).filter(Boolean);
    const content = document.getElementById('post-content').value.trim();
    if (!title || !date || !content) return alert('Fyll i alla fält');

    const postData = { id, title, date, tags, content, images: [...currentImages] };

    const { error } = await db.from('posts').upsert(postData);
    if (error) {
        console.error('Fel vid sparande till Supabase:', error);
        alert('Kunde inte spara inlägget till molnet: ' + error.message);
        return;
    }

    await loadInitialData();
    document.getElementById('form-section').classList.add('hidden');
    resetJournalForm();
}

function resetJournalForm() {
    const form = document.getElementById('journal-form');
    if (form) form.reset();
    document.getElementById('post-id').value = '';
    currentImages = [];
    const prev = document.getElementById('image-preview-container');
    if (prev) prev.innerHTML = '';
    setDefaultDates();
}

function renderPosts() {
    const c = document.getElementById('posts-container');
    if (!c) return;
    c.innerHTML = '';
    renderFilterChips();
    sortPostsDescending(posts);
    const searchEl = document.getElementById('search-input');
    const search = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const filtered = posts.filter(p => {
        if (currentFilter !== 'all' && (!p.tags || !p.tags.map(t=>t.toLowerCase()).includes(currentFilter.toLowerCase()))) return false;
        if (search && !p.title.toLowerCase().includes(search) && !p.content.toLowerCase().includes(search) && (!p.tags || !p.tags.some(t=>t.toLowerCase().includes(search)))) return false;
        return true;
    });
    if (!filtered.length) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga inlägg</p>'; return; }
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;"><h3>${escapeHtml(p.title)}</h3><span style="font-size:0.75rem;color:var(--text-muted)">${p.date}</span></div>
            <p style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.content)}</p>
            ${p.images && p.images.length ? `<div class="post-images">${p.images.map(img => `<img src="${img}">`).join('')}</div>` : ''}
            <div>${p.tags ? p.tags.map(t => `<span class="post-tag">#${t}</span>`).join('') : ''}</div>
        `;
        card.onclick = () => openPostModal(p);
        c.appendChild(card);
    });
}

function renderFilterChips() {
    const c = document.getElementById('filter-tags-container');
    if (!c) return;
    c.innerHTML = '';
    const all = document.createElement('button'); all.className = `filter-chip ${currentFilter==='all'?'active':''}`; all.textContent='Alla'; all.onclick=()=>{currentFilter='all';renderPosts();}; c.appendChild(all);
    const set = new Set(); posts.forEach(p => p.tags && p.tags.forEach(t => set.add(t.trim())));
    set.forEach(tag => {
        const btn = document.createElement('button'); btn.className = `filter-chip ${currentFilter.toLowerCase()===tag.toLowerCase()?'active':''}`; btn.textContent=tag; btn.onclick=()=>{currentFilter=tag;renderPosts();}; c.appendChild(btn);
    });
}

function openPostModal(post) {
    currentModalPostId = post.id;
    const imgsJson = JSON.stringify(post.images || []).replace(/"/g,'&quot;');
    document.getElementById('modal-content-container').innerHTML = `
        <div style="display:flex;justify-content:space-between;"><h2>${escapeHtml(post.title)}</h2><span style="font-size:0.8rem;color:var(--text-muted)">${post.date}</span></div>
        <p style="white-space:pre-wrap;">${escapeHtml(post.content)}</p>
        ${post.images && post.images.length ? `<div class="post-images">${post.images.map((img,i) => `<img src="${img}" onclick="event.stopPropagation();openLightbox(${imgsJson},${i})">`).join('')}</div>` : ''}
        <div style="margin-top:20px;text-align:right"><button type="button" onclick="editPost('${post.id}')" class="btn-primary">Redigera</button></div>
    `;
    document.getElementById('post-modal').classList.remove('hidden');
}

window.editPost = id => {
    const p = posts.find(x => x.id===id); if (!p) return;
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
    if (!db) return alert('Ingen anslutning till molnet.');
    if (confirm('Radera inlägg?')) {
        const { error } = await db.from('posts').delete().eq('id', id);
        if (error) {
            alert('Kunde inte radera inlägget: ' + error.message);
            return;
        }
        await loadInitialData();
        renderPosts();
    }
}

// ========== HÄNDELSER (PLANERING) ==========
async function handleSavePlan(e) {
    e.preventDefault();
    if (!db) return alert('Ingen anslutning till molnet.');
    
    const id = document.getElementById('plan-id').value || 'plan_' + Date.now();
    const date = document.getElementById('plan-date').value;
    const time = document.getElementById('plan-time').value;
    const title = document.getElementById('plan-title').value.trim();
    const extra = document.getElementById('plan-extra').value.trim();
    if (!date || !time || !title) return alert('Fyll i alla fält');

    const planData = { id, date, time, title, extra };

    const { error } = await db.from('plans').upsert(planData);
    if (error) {
        console.error('Fel vid sparande av händelse:', error);
        alert('Kunde inte spara händelsen till molnet: ' + error.message);
        return;
    }

    await loadInitialData();
    document.getElementById('plan-form-section').classList.add('hidden');
    resetPlanForm();
}

function resetPlanForm() {
    const form = document.getElementById('plan-form');
    if (form) form.reset();
    document.getElementById('plan-id').value = '';
    setDefaultDates();
}

function renderPlans() {
    const c = document.getElementById('plans-container');
    if (!c) return;
    c.innerHTML = '';
    if (!plans.length) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Inga händelser</p>'; return; }
    const now = new Date();
    plans.forEach(plan => {
        const d = new Date(plan.date+'T00:00:00');
        const day = d.getDate(), month = d.toLocaleString('sv-SE',{month:'short'});
        const target = new Date(`${plan.date}T${plan.time}`);
        const diff = target - now;
        const isPast = diff < 0;
        let cd = 'Passerat';
        if (diff > 0) {
            const days = Math.floor(diff/86400000), hrs = Math.floor((diff%86400000)/3600000), mins = Math.floor((diff%3600000)/60000), secs = Math.floor((diff%60000)/1000);
            const pad = n => String(n).padStart(2,'0');
            cd = days>0 ? `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.style.opacity = isPast ? '0.5' : '1';
        item.innerHTML = `
            <div class="plan-date-box"><div class="plan-date-day">${day}</div><div class="plan-date-month">${month}</div></div>
            <div class="plan-details">
                <div><span class="plan-time">${plan.time}</span> <span class="plan-countdown" data-time="${plan.date}T${plan.time}">${cd}</span></div>
                <h3>${escapeHtml(plan.title)}</h3>${plan.extra ? `<p>${escapeHtml(plan.extra)}</p>` : ''}
            </div>
            <button type="button" class="plan-delete-btn" onclick="event.stopPropagation();deletePlan('${plan.id}')">✕</button>
        `;
        item.onclick = () => editPlan(plan.id);
        c.appendChild(item);
    });
}

window.editPlan = id => {
    const p = plans.find(x => x.id===id); if (!p) return;
    document.getElementById('plan-form-section').classList.remove('hidden');
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-date').value = p.date;
    document.getElementById('plan-time').value = p.time;
    document.getElementById('plan-title').value = p.title;
    document.getElementById('plan-extra').value = p.extra || '';
    document.getElementById('plan-form-section').scrollIntoView({behavior:'smooth'});
};

window.deletePlan = async id => {
    if (!db) return alert('Ingen anslutning till molnet.');
    if (confirm('Radera händelse?')) {
        const { error } = await db.from('plans').delete().eq('id', id);
        if (error) {
            alert('Kunde inte radera händelsen: ' + error.message);
            return;
        }
        await loadInitialData();
        renderPlans();
    }
};

function updateCountdowns() {
    const planView = document.getElementById('plan-view');
    if (!planView || planView.classList.contains('hidden')) return;
    const now = new Date();
    document.querySelectorAll('.plan-countdown').forEach(el => {
        const t = el.getAttribute('data-time');
        if (!t) return;
        const target = new Date(t);
        const diff = target - now;
        if (diff <= 0) {
            el.textContent = 'Passerat';
            el.style.color = 'var(--text-muted)';
            const item = el.closest('.plan-item');
            if (item) item.style.opacity = '0.5';
        } else {
            const days = Math.floor(diff/86400000), hrs = Math.floor((diff%86400000)/3600000), mins = Math.floor((diff%3600000)/60000), secs = Math.floor((diff%60000)/1000);
            const pad = n => String(n).padStart(2,'0');
            el.textContent = days>0 ? `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
            el.style.color = '#8b5cf6';
        }
    });
}

// ========== LIGHTBOX ==========
window.openLightbox = (imgs, idx) => { lightboxImages = imgs; lightboxCurrentIndex = idx; updateLightbox(); document.getElementById('lightbox').classList.remove('hidden'); };
function updateLightbox() { document.getElementById('lightbox-img').src = lightboxImages[lightboxCurrentIndex]; }
function navigateLightbox(dir) { lightboxCurrentIndex = (lightboxCurrentIndex + dir + lightboxImages.length) % lightboxImages.length; updateLightbox(); }
