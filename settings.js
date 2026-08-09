document.addEventListener('DOMContentLoaded', () => {
    const settingsTrigger = document.getElementById('settings-trigger');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const exportBtn = document.getElementById('export-btn');
    const importFile = document.getElementById('import-file');

    if (!settingsTrigger || !settingsModal) return;

    // Öppna inställningar
    settingsTrigger.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    // Stäng inställningar
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // EXPORT
    exportBtn.addEventListener('click', () => {
        try {
            const backupData = {
                digital_journal_posts: JSON.parse(localStorage.getItem('digital_journal_posts')) || [],
                digital_journal_plans: JSON.parse(localStorage.getItem('digital_journal_plans')) || [],
                version: 1,
                date: new Date().toISOString()
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            
            const dateString = new Date().toISOString().split('T')[0];
            downloadAnchor.setAttribute("download", `digital_journal_backup_${dateString}.json`);
            
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (err) {
            alert('Kunde inte exportera data.');
            console.error(err);
        }
    });

    // IMPORT
    importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const textContent = await file.text();
            const imported = JSON.parse(textContent);
            
            const postsData = imported.digital_journal_posts || imported.posts || imported.journalPosts;
            const plansData = imported.digital_journal_plans || imported.plans || imported.journalPlans;

            if (imported && (postsData || plansData)) {
                if (confirm(`Vill du skriva över befintlig data och importera "${file.name}"?`)) {
                    
                    // Spara till localStorage
                    if (postsData) {
                        localStorage.setItem('digital_journal_posts', JSON.stringify(postsData));
                    }
                    if (plansData) {
                        localStorage.setItem('digital_journal_plans', JSON.stringify(plansData));
                    }
                    
                    importFile.value = '';
                    settingsModal.classList.add('hidden');

                    // DIREKTUPPDATERING: Uppdatera globolerna i app.js direkt om de finns tillgängliga
                    if (typeof posts !== 'undefined' && postsData) {
                        posts = postsData;
                    }
                    if (typeof plans !== 'undefined' && plansData) {
                        plans = plansData;
                    }

                    // Anropa appens egna renderingsfunktioner direkt om de finns
                    if (typeof renderPosts === 'function') renderPosts();
                    if (typeof renderPlans === 'function') renderPlans();

                    alert('Importen slutförd!');
                } else {
                    importFile.value = '';
                }
            } else {
                alert('Ogiltigt filformat.');
                importFile.value = '';
            }
        } catch (err) {
            alert('Kunde inte läsa filen. Kontrollera att det är en giltig backup-fil.');
            console.error(err);
                importFile.value = '';
        }
    });
});
