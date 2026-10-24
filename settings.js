'use strict';

function showStatus(text, showSpinner = true) {
    document.getElementById('status-text').textContent = text;
    document.getElementById('status-spinner').style.display = showSpinner ? 'block' : 'none';
    document.getElementById('status-modal').classList.remove('hidden');
}

function hideStatus() {
    document.getElementById('status-modal').classList.add('hidden');
}

// EXPORT JSON (Journal_ååmmdd.json)
document.getElementById('export-btn').addEventListener('click', async () => {
    try {
        const db = window.db;
        if (!db) { alert('Databasen är inte redo.'); return; }

        showStatus('Exporterar data...', true);

        const backupData = {
            posts: await db.posts.toArray(),
            plans: await db.plans.toArray(),
            notes: await db.notes.toArray(),
            sober: await db.sober.toArray(),
            exportDate: new Date().toISOString()
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const fileName = `Journal_${year}${month}${day}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setTimeout(() => {
            hideStatus();
            alert('Export klar!');
        }, 600);
    } catch (err) {
        hideStatus();
        console.error('Exportfel:', err);
        alert('Kunde inte exportera data.');
    }
});

// IMPORT JSON
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Detta ersätter eller fyller på din nuvarande databas. Vill du fortsätta?')) {
        e.target.value = '';
        return;
    }

    showStatus('Läser in och importerar fil...', true);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const db = window.db;
            if (!db) throw new Error("Databasen hittades inte.");

            let content = event.target.result;
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

            const data = JSON.parse(content);

            await db.transaction('rw', db.posts, db.plans, db.notes, db.sober, async () => {
                if (data.posts && Array.isArray(data.posts)) await db.posts.bulkPut(data.posts);
                if (data.plans && Array.isArray(data.plans)) await db.plans.bulkPut(data.plans);
                if (data.notes && Array.isArray(data.notes)) await db.notes.bulkPut(data.notes);
                if (data.sober && Array.isArray(data.sober)) await db.sober.bulkPut(data.sober);
            });

            setTimeout(() => {
                hideStatus();
                alert('Importen lyckades!');
                location.reload();
            }, 800);
        } catch (err) {
            hideStatus();
            console.error('Importfel:', err);
            alert(`Kunde inte läsa filen: ${err.message}`);
        }
    };

    reader.onerror = () => {
        hideStatus();
        alert('Kunde inte läsa filen från enheten.');
    };

    reader.readAsText(file, 'UTF-8');
});

// INSTÄLLNINGAR MODAL
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettings = document.getElementById('close-settings');

if (settingsModal && settingsBtn) {
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
}
