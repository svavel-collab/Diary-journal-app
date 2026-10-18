// ==========================================
// SUPABASE KONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://dlnetiryfhndmrbapgun.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_kZw8bigzxzrXLHDWaQR-Qg_ewteBygi';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let posts = [], plans = [], currentFilter = 'all', currentImages = [], currentModalPostId = null;
let lightboxImages = [], lightboxCurrentIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDates();
    updateHeaderDate();
    await loadInitialData();
    setupEventListeners();
    setInterval(updateCountdowns, 1000);
});

function sortPostsDescending(arr) {
    return arr.sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
}

async function loadInitialData() {
    try {
        // Hämta inlägg från Supabase
        const { data: postsData, error: postsError } = await db.from('posts').select('*');
        if (postsError) throw postsError;
        posts = postsData || [];
        sortPostsDescending(posts);

        // Hämta planerade händelser från Supabase
        const { data: plansData, error: plansError } = await db.from('plans').select('*');
        if (plansError) throw plansError;
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
    if (el) { const d = new Date(); el.textContent = `${d.getDate()}${d.toLocaleString('sv-SE',{month:'short'}).replace('.','')}`; }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('post-date').value = today;
    document.getElementById('plan-date').value = today;
    document.getElementById('plan-time').value = '12:00';
}

function escapeHtml(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

// ========== VYER ==========
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

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    document.getElementById('new-post-trigger').onclick = () => { resetJournalForm(); document.getElementById('form-section').classList.toggle('hidden'); };
    document.getElementById('cancel-btn').onclick = () => document.getElementById('form-section').classList.add('hidden');
    document.getElementById('new-plan-trigger').onclick = () => { resetPlanForm(); document.getElementById('plan-form-section').classList.toggle('hidden'); };
    document.getElementById('plan-cancel-btn').onclick = () => document.getElementById('plan-form-section').classList.add('hidden');
    document.getElementById('journal-form').onsubmit = handleSavePost;
    document.getElementById('plan-form').onsubmit = handleSavePlan;
    document.getElementById('post-images').onchange = handleImageUpload;
    document.getElementById('close-modal').onclick = () => document.getElementById('post-modal').classList.add('hidden');
    document.getElementById('delete-modal-btn').onclick = () => {
        if (currentModalPostId) { deletePost(currentModalPostId); document.getElementById('post-modal').classList.add('hidden'); }
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
        alert('Kunde inte spara inlägget till molnet.');
        return;
    }

    await loadInitialData();
    document.getElementById('form-section').classList.add('hidden');
    resetJournalForm();
}

function resetJournalForm() {
    document.getElementById('journal-form').reset();
    document.getElementById('post-id').value = '';
    currentImages = [];
    document.getElementById('image-preview-container').innerHTML = '';
    setDefaultDates();
}

function renderPosts() {
    const c = document.getElementById('posts-container');
    c.innerHTML = '';
    renderFilterChips();
    sortPostsDescending(posts);
    const search = document.getElementById('search-input').value.toLowerCase().trim();
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
            <p style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.content)}</p>${p.images && p.images.length ? `<div class="post-images">${p.images.map(img => `<img src="${img}">`).join('')}</div>` : ''}
            <div>${p.tags ? p.tags.map(t => `<span class="post-tag">#${t}</span>`).join('') : ''}</div>
        `;
        card.onclick = () => openPostModal(p);
        c.appendChild(card);
    });
}

function renderFilterChips() {
    const c = document.getElementById('filter-tags-container');
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
        <p style="white-space:pre-wrap;">${escapeHtml(post.content)}</p>${post.images && post.images.length ? `<div class="post-images">${post.images.map((img,i) => `<img src="${img}" onclick="event.stopPropagation();openLightbox(${imgsJson},${i})">`).join('')}</div>` : ''}
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
    if (confirm('Radera inlägg?')) {
        const { error } = await db.from('posts').delete().eq('id', id);
        if (error) {
            alert('Kunde inte radera inlägget.');
            return;
        }
        await loadInitialData();
        renderPosts();
    }
}

// ========== HÄNDELSER (PLANERING) ==========
async function handleSavePlan(e) {
    e.preventDefault();
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
        alert('Kunde inte spara händelsen till molnet.');
        return;
    }

    await loadInitialData();
    document.getElementById('plan-form-section').classList.add('hidden');
    resetPlanForm();
}

function resetPlanForm() { document.getElementById('plan-form').reset(); document.getElementById('plan-id').value = ''; setDefaultDates(); }

function renderPlans() {
    const c = document.getElementById('plans-container');
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
            cd = days>0 ? `${days}d${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.style.opacity = isPast ? '0.5' : '1';
        item.innerHTML = `
            <div class="plan-date-box"><div class="plan-date-day">${day}</div><div class="plan-date-month">${month}</div></div>
            <div class="plan-details">
                <div><span class="plan-time">${plan.time}</span> <span class="plan
