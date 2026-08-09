const POSTS_KEY = 'digital_journal_posts';
const PLANS_KEY = 'digital_journal_plans';

let posts = JSON.parse(localStorage.getItem(POSTS_KEY)) || [];
let plans = JSON.parse(localStorage.getItem(PLANS_KEY)) || [];
let currentFilter = 'all';
let currentImages = [];
let currentModalPostId = null;

let lightboxImages = [];
let lightboxCurrentIndex = 0;

const homeBtn = document.getElementById('home-btn');
const calendarBtn = document.getElementById('calendar-btn');
const viewTitle = document.getElementById('view-title');
const journalView = document.getElementById('journal-view');
const planView = document.getElementById('plan-view');

const newPostTrigger = document.getElementById('new-post-trigger');
const newPlanTrigger = document.getElementById('new-plan-trigger');

const formSection = document.getElementById('form-section');
const journalForm = document.getElementById('journal-form');
const cancelBtn = document.getElementById('cancel-btn');
const postsContainer = document.getElementById('posts-container');
const filterTagsContainer = document.getElementById('filter-tags-container');

const planFormSection = document.getElementById('plan-form-section');
const planForm = document.getElementById('plan-form');
const planCancelBtn = document.getElementById('plan-cancel-btn');
const plansContainer = document.getElementById('plans-container');

const postModal = document.getElementById('post-modal');
const closeModal = document.getElementById('close-modal');
const modalContentContainer = document.getElementById('modal-content-container');
const deleteModalBtn = document.getElementById('delete-modal-btn');

const postImagesInput = document.getElementById('post-images');
const imagePreviewContainer = document.getElementById('image-preview-container');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates();
    updateHeaderDate();
    renderPosts();
    renderPlans();
    setupEventListeners();

    // Starta live-uppdatering för nedräkningen varje sekund
    setInterval(() => {
        if (!planView.classList.contains('hidden')) {
            renderPlans();
        }
    }, 1000);
});

function updateHeaderDate() {
    const headerDateSpan = document.getElementById('header-date');
    if (headerDateSpan) {
        const d = new Date();
        const day = d.getDate();
        const month = d.toLocaleString('sv-SE', { month: 'short' }).replace('.', '');
        headerDateSpan.textContent = `${day} ${month}`;
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('post-date').value = today;
    document.getElementById('plan-date').value = today;
}

homeBtn.addEventListener('click', () => {
    journalView.classList.remove('hidden');
    planView.classList.add('hidden');
    newPostTrigger.classList.remove('hidden');
    newPlanTrigger.classList.add('hidden');
    viewTitle.innerHTML = `Journal <span id="header-date" style="font-size: 1rem; font-weight: 500; color: #a78bfa; margin-left: 8px;"></span>`;
    updateHeaderDate();
});

calendarBtn.addEventListener('click', () => {
    planView.classList.remove('hidden');
    journalView.classList.add('hidden');
    newPlanTrigger.classList.remove('hidden');
    newPostTrigger.classList.add('hidden');
    viewTitle.innerHTML = `Planering <span id="header-date" style="font-size: 1rem; font-weight: 500; color: #a78bfa; margin-left: 8px;"></span>`;
    updateHeaderDate();
});

function setupEventListeners() {
    newPostTrigger.addEventListener('click', () => {
        resetJournalForm();
        formSection.classList.toggle('hidden');
    });
    cancelBtn.addEventListener('click', () => formSection.classList.add('hidden'));

    newPlanTrigger.addEventListener('click', () => {
        resetPlanForm();
        planFormSection.classList.toggle('hidden');
    });
    planCancelBtn.addEventListener('click', () => planFormSection.classList.add('hidden'));

    journalForm.addEventListener('submit', handleSavePost);
    planForm.addEventListener('submit', handleSavePlan);

    postImagesInput.addEventListener('change', handleImageUpload);

    closeModal.addEventListener('click', () => postModal.classList.add('hidden'));
    postModal.addEventListener('click', (e) => {
        if (e.target === postModal) postModal.classList.add('hidden');
    });
    deleteModalBtn.addEventListener('click', () => {
        if (currentModalPostId) {
            deletePost(currentModalPostId);
            postModal.classList.add('hidden');
        }
    });

    lightboxClose.addEventListener('click', () => lightbox.classList.add('hidden'));
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) lightbox.classList.add('hidden');
    });
    lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    lightboxNext.addEventListener('click', () => navigateLightbox(1));
}

function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (currentImages.length + files.length > 6) {
        alert('Max 6 bilder tillåtna.');
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            currentImages.push(uploadEvent.target.result);
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    imagePreviewContainer.innerHTML = '';
    currentImages.forEach((imgSrc, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.innerHTML = `
            <img src="${imgSrc}" alt="Preview">
            <button type="button" onclick="removePreviewImage(${index})" style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
        `;
        imagePreviewContainer.appendChild(wrapper);
    });
}

window.removePreviewImage = function(index) {
    currentImages.splice(index, 1);
    renderImagePreviews();
};

function handleSavePost(e) {
    e.preventDefault();
    const id = document.getElementById('post-id').value || 'post_' + Date.now();
    const title = document.getElementById('post-title').value.trim();
    const date = document.getElementById('post-date').value;
    const category = document.getElementById('post-category').value.trim();
    const tagsInput = document.getElementById('post-tags').value;
    const content = document.getElementById('post-content').value.trim();

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    const postData = {
        id,
        title,
        date,
        category,
        tags,
        content,
        images: [...currentImages]
    };

    const existingIndex = posts.findIndex(p => p.id === id);
    if (existingIndex > -1) {
        posts[existingIndex] = postData;
    } else {
        posts.unshift(postData);
    }

    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    formSection.classList.add('hidden');
    resetJournalForm();
    renderPosts();
}

function resetJournalForm() {
    journalForm.reset();
    document.getElementById('post-id').value = '';
    currentImages = [];
    imagePreviewContainer.innerHTML = '';
    setDefaultDates();
}

function renderPosts() {
    postsContainer.innerHTML = '';
    renderFilterChips();

    const filteredPosts = posts.filter(post => {
        if (currentFilter === 'all') return true;
        if (post.category && post.category.toLowerCase() === currentFilter.toLowerCase()) return true;
        if (post.tags && post.tags.map(t => t.toLowerCase()).includes(currentFilter.toLowerCase())) return true;
        return false;
    });

    if (filteredPosts.length === 0) {
        postsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Inga inlägg hittades.</p>`;
        return;
    }

    filteredPosts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        let tagsHtml = '';
        if (post.tags && post.tags.length > 0) {
            tagsHtml = post.tags.map(t => `<span class="post-tag">#${t}</span>`).join('');
        }

        let imagesHtml = '';
        if (post.images && post.images.length > 0) {
            imagesHtml = `<div class="post-images">` + post.images.map(img => `<img src="${img}" alt="Miniatyr">`).join('') + `</div>`;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <h3 style="font-size: 1.05rem; font-weight: 600; color: var(--text-main);">${escapeHtml(post.title)}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${post.date}</span>
            </div>
            ${post.category ? `<span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">${escapeHtml(post.category)}</span>` : ''}
            <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(post.content)}</p>
            ${imagesHtml}
            <div>${tagsHtml}</div>
        `;

        card.addEventListener('click', () => openPostModal(post));
        postsContainer.appendChild(card);
    });
}

function renderFilterChips() {
    const tagsSet = new Set();
    posts.forEach(p => {
        if (p.category) tagsSet.add(p.category.trim());
        if (p.tags) p.tags.forEach(t => tagsSet.add(t.trim()));
    });

    filterTagsContainer.innerHTML = '';
    
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = `filter-chip ${currentFilter === 'all' ? 'active' : ''}`;
    allChip.textContent = 'Alla';
    allChip.addEventListener('click', () => {
        currentFilter = 'all';
        renderPosts();
    });
    filterTagsContainer.appendChild(allChip);

    tagsSet.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `filter-chip ${currentFilter.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`;
        chip.textContent = tag;
        chip.addEventListener('click', () => {
            currentFilter = tag;
            renderPosts();
        });
        filterTagsContainer.appendChild(chip);
    });
}

function openPostModal(post) {
    currentModalPostId = post.id;
    
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
        imagesHtml = `<div class="post-images" style="margin-top: 15px;">` + 
            post.images.map((img, idx) => `<img src="${img}" alt="Bild" style="width: 80px; height: 80px; cursor: pointer;" onclick="openLightbox(${JSON.stringify(post.images).replace(/"/g, '&quot;')}, ${idx})">`).join('') + 
            `</div>`;
    }

    let tagsHtml = '';
    if (post.tags && post.tags.length > 0) {
        tagsHtml = `<div style="margin-top: 15px;">` + post.tags.map(t => `<span class="post-tag">#${t}</span>`).join('') + `</div>`;
    }

    modalContentContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <h2 style="font-size: 1.25rem; font-weight: 600; color: var(--text-main);">${escapeHtml(post.title)}</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${post.date}</span>
        </div>
        ${post.category ? `<span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 10px;">${escapeHtml(post.category)}</span>` : ''}
        <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6; white-space: pre-wrap; margin-top: 10px;">${escapeHtml(post.content)}</p>
        ${imagesHtml}
        ${tagsHtml}
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <button type="button" onclick="editPost('${post.id}')" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">Redigera</button>
        </div>
    `;

    postModal.classList.remove('hidden');
}

window.editPost = function(id) {
    const post = posts.find(p => p.id === id);
    if (!post) return;

    postModal.classList.add('hidden');
    formSection.classList.remove('hidden');

    document.getElementById('post-id').value = post.id;
    document.getElementById('post-title').value = post.title;
    document.getElementById('post-date').value = post.date;
    document.getElementById('post-category').value = post.category || '';
    document.getElementById('post-tags').value = post.tags ? post.tags.join(', ') : '';
    document.getElementById('post-content').value = post.content;

    currentImages = post.images ? [...post.images] : [];
    renderImagePreviews();
};

function deletePost(id) {
    if (confirm('Är du säker på att du vill radera inlägget?')) {
        posts = posts.filter(p => p.id !== id);
        localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
        renderPosts();
    }
}

function handleSavePlan(e) {
    e.preventDefault();
    const id = document.getElementById('plan-id').value || 'plan_' + Date.now();
    const date = document.getElementById('plan-date').value;
    const time = document.getElementById('plan-time').value;
    const title = document.getElementById('plan-title').value.trim();
    const extra = document.getElementById('plan-extra').value.trim();

    const planData = { id, date, time, title, extra };

    const existingIndex = plans.findIndex(p => p.id === id);
    if (existingIndex > -1) {
        plans[existingIndex] = planData;
    } else {
        plans.push(planData);
    }

    plans.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    planFormSection.classList.add('hidden');
    resetPlanForm();
    renderPlans();
}

function resetPlanForm() {
    planForm.reset();
    document.getElementById('plan-id').value = '';
    setDefaultDates();
}

function renderPlans() {
    plansContainer.innerHTML = '';

    if (plans.length === 0) {
        plansContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Inga inbokade händelser.</p>`;
        return;
    }

    plans.forEach(plan => {
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.style.cursor = 'pointer';

        const dateObj = new Date(plan.date);
        const dayNum = isNaN(dateObj.getDate()) ? plan.date.split('-')[2] : dateObj.getDate();
        const monthStr = isNaN(dateObj.getMonth()) ? '' : dateObj.toLocaleString('sv-SE', { month: 'short' });

        // Beräkna levande nedräkning med sekunder
        let countdownText = '';
        const targetTime = new Date(`${plan.date}T${plan.time}`);
        const now = new Date();
        const diff = targetTime - now;

        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            const pad = (n) => String(n).padStart(2, '0');

            if (days > 0) {
                countdownText = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            } else {
                countdownText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            }
        } else {
            countdownText = 'Passerat';
        }

        item.innerHTML = `
            <div class="plan-date-box">
                <div class="plan-date-day">${dayNum}</div>
                <div class="plan-date-month">${monthStr}</div>
            </div>
            <div class="plan-details">
                <div>
                    <span class="plan-time">${plan.time}</span>
                    ${countdownText ? `<span style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.8; margin-left: 6px;">${countdownText}</span>` : ''}
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${escapeHtml(plan.title)}</h3>
                ${plan.extra ? `<p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(plan.extra)}</p>` : ''}
            </div>
            <button type="button" class="plan-delete-btn" onclick="event.stopPropagation(); deletePlan('${plan.id}')" title="Radera">✕</button>
        `;

        item.addEventListener('click', () => editPlan(plan.id));

        plansContainer.appendChild(item);
    });
}

window.editPlan = function(id) {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;

    planFormSection.classList.remove('hidden');

    document.getElementById('plan-id').value = plan.id;
    document.getElementById('plan-date').value = plan.date;
    document.getElementById('plan-time').value = plan.time;
    document.getElementById('plan-title').value = plan.title;
    document.getElementById('plan-extra').value = plan.extra || '';

    planFormSection.scrollIntoView({ behavior: 'smooth' });
};

window.deletePlan = function(id) {
    if (confirm('Vill du ta bort denna händelse?')) {
        plans = plans.filter(p => p.id !== id);
        localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
        renderPlans();
    }
};

window.openLightbox = function(imagesArray, index) {
    lightboxImages = imagesArray;
    lightboxCurrentIndex = index;
    updateLightboxImage();
    lightbox.classList.remove('hidden');
};

function updateLightboxImage() {
    lightboxImg.src = lightboxImages[lightboxCurrentIndex];
}

function navigateLightbox(direction) {
    lightboxCurrentIndex += direction;
    if (lightboxCurrentIndex < 0) {
        lightboxCurrentIndex = lightboxImages.length - 1;
    } else if (lightboxCurrentIndex >= lightboxImages.length) {
        lightboxCurrentIndex = 0;
    }
    updateLightboxImage();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
