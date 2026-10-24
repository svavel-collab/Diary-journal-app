let currentJournalImages = [];
let activeTagFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    updateHeaderDate();
    loadJournalPosts();
    setupJournalListeners();
});

function setupJournalListeners() {
    const searchInput = document.getElementById('journal-search');
    const clearSearch = document.getElementById('clear-search');

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearSearch.style.display = val ? 'block' : 'none';
        loadJournalPosts(val, activeTagFilter);
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        loadJournalPosts('', activeTagFilter);
    });

    document.getElementById('journal-input-images').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (currentJournalImages.length >= 5) break;
            const compressed = await compressImage(file);
            currentJournalImages.push(compressed);
        }
        renderImagePreviews();
        e.target.value = '';
    });

    document.getElementById('journal-form').addEventListener('submit', async (e) => {
        e.preventDefault(); // Stoppar standardformulär-omladdning
        const id = document.getElementById('journal-id').value;
        const title = document.getElementById('journal-input-title').value;
        const date = document.getElementById('journal-input-date').value;
        const tagsRaw = document.getElementById('journal-input-tags').value;
        const content = document.getElementById('journal-input-content').value;

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

        const postData = {
            title,
            date,
            tags,
            content,
            images: currentJournalImages
        };

        if (id) {
            await db.posts.update(parseInt(id), postData);
        } else {
            await db.posts.add(postData);
        }

        closeAllModals();
        loadJournalPosts();
    });
}

function renderImagePreviews() {
    const container = document.getElementById('journal-image-preview');
    container.innerHTML = '';
    currentJournalImages.forEach((imgSrc, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-thumb-wrapper';
        wrapper.innerHTML = `
            <img src="${imgSrc}">
            <button type="button" class="preview-remove" onclick="removeJournalImage(${index})">✕</button>
        `;
        container.appendChild(wrapper);
    });
}

window.removeJournalImage = function(index) {
    currentJournalImages.splice(index, 1);
    renderImagePreviews();
};

async function loadJournalPosts(searchQuery = '', tagFilter = 'all') {
    let posts = await db.posts.orderBy('date').reverse().toArray();
    const container = document.getElementById('journal-posts-container');
    container.innerHTML = '';

    buildTagChips(posts);

    if (tagFilter !== 'all') {
        posts = posts.filter(p => p.tags && p.tags.includes(tagFilter));
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        posts = posts.filter(p => 
            (p.title && p.title.toLowerCase().includes(q)) || 
            (p.content && p.content.toLowerCase().includes(q)) ||
            (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(post.title)}</div>
                    <div class="card-date">${escapeHtml(post.date)}</div>
                </div>
                <button class="card-delete" onclick="deleteJournalPost(event, ${post.id})">✕</button>
            </div>
            <div class="card-content">${escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
            ${post.images && post.images.length > 0 ? `
                <div class="card-images">
                    ${post.images.map((img, idx) => `<img src="${img}" class="card-img-thumb" onclick="openLightbox(event, ${JSON.stringify(post.images).replace(/"/g, '&quot;')}, ${idx})">`).join('')}
                </div>
            ` : ''}
        `;
        card.addEventListener('click', () => openJournalModal(post));
        container.appendChild(card);
    });
}

function buildTagChips(posts) {
    const chipsContainer = document.getElementById('filter-chips');
    const allTags = new Set();
    posts.forEach(p => {
        if (p.tags) p.tags.forEach(t => allTags.add(t));
    });

    chipsContainer.innerHTML = `<button class="chip ${activeTagFilter === 'all' ? 'active' : ''}" onclick="filterByTag('all')">Alla</button>`;
    allTags.forEach(tag => {
        chipsContainer.innerHTML += `<button class="chip ${activeTagFilter === tag ? 'active' : ''}" onclick="filterByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`;
    });
}

window.filterByTag = function(tag) {
    activeTagFilter = tag;
    const searchVal = document.getElementById('journal-search').value;
    loadJournalPosts(searchVal, activeTagFilter);
};

window.deleteJournalPost = async function(e, id) {
    e.stopPropagation();
    if (confirm('Är du säker på att du vill radera inlägget?')) {
        await db.posts.delete(id);
        loadJournalPosts();
    }
};

function openJournalModal(post = null) {
    document.getElementById('journal-id').value = post ? post.id : '';
    document.getElementById('journal-modal-title').textContent = post ? 'Redigera inlägg' : 'Nytt inlägg';
    document.getElementById('journal-input-title').value = post ? post.title : '';
    document.getElementById('journal-input-date').value = post ? post.date : new Date().toISOString().split('T')[0];
    document.getElementById('journal-input-tags').value = post && post.tags ? post.tags.join(', ') : '';
    document.getElementById('journal-input-content').value = post ? post.content : '';
    currentJournalImages = post && post.images ? [...post.images] : [];
    renderImagePreviews();
    document.getElementById('journal-modal').classList.add('active');
}
