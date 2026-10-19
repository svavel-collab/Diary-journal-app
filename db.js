'use strict';

window.db = new Dexie("DigitalJournalDB");
const db = window.db;

db.version(1).stores({
    posts: 'id, date, title',
    plans: 'id, date, time'
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (el) {
        const d = new Date();
        el.textContent = `${d.getDate()} ${d.toLocaleString('sv-SE', { month: 'short' }).replace('.', '')}`;
    }
}

// Bildkomprimering (max 800px, liten filstorlek för JSON)
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 800;

                if (width > height && width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
