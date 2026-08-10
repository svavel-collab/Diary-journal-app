// EXPORTERA ALLA INLÄGG OCH PLANER FRÅN INDEXEDDB
document.getElementById('export-btn').addEventListener('click', async () => {
    try {
        const db = window.db;
        if (!db) {
            alert('Databasen är inte redo ännu. Vänta ett ögonblick och försök igen.');
            return;
        }

        const allPosts = await db.posts.toArray();
        const allPlans = await db.plans.toArray();

        const backupData = {
            posts: allPosts,
            plans: allPlans,
            exportDate: new Date().toISOString()
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Skapar formatet jour_YYYYMMDD.json
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const fileName = `jour_${year}${month}${day}.json`;

        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = fileName;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Fel vid export:', err);
        alert('Kunde inte exportera data.');
    }
});

// IMPORTERA TILL INDEXEDDB
document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (event) => {
        try {
            const db = window.db;
            if (!db) {
                throw new Error("Databasen hittades inte.");
            }

            // Rensa eventuella osynliga BOM-tecken i början av filen
            let content = event.target.result;
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }

            const importedData = JSON.parse(content);

            if (!importedData.posts && !importedData.plans) {
                throw new Error("Filen saknar giltig journaldata (posts/plans).");
            }

            // Använd en transaktion för snabb och säker insättning av stor datamängd
            await db.transaction('rw', db.posts, db.plans, async () => {
                if (importedData.posts && Array.isArray(importedData.posts)) {
                    await db.posts.bulkPut(importedData.posts);
                }
                if (importedData.plans && Array.isArray(importedData.plans)) {
                    await db.plans.bulkPut(importedData.plans);
                }
            });

            alert('Importen lyckades!');
            location.reload();
        } catch (err) {
            console.error('Detaljerat importfel:', err);
            alert(`Kunde inte läsa filen: ${err.message}`);
        }
    };

    reader.onerror = (err) => {
        console.error('FileReader fel:', err);
        alert('Kunde inte läsa filen från din enhet.');
    };

    reader.readAsText(file, 'UTF-8');
});

// INSTÄLLNINGAR MODAL
const settingsModal = document.getElementById('settings-modal');
const settingsTrigger = document.getElementById('settings-trigger');
const closeSettings = document.getElementById('close-settings');

if (settingsTrigger && settingsModal && closeSettings) {
    settingsTrigger.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
}
