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
            
            if (!textContent || textContent.trim() === '') {
                alert('Den valda filen är tom.');
                importFile.value = '';
                return;
            }

            let imported;
            try {
                imported = JSON.parse(textContent);
            } catch (parseErr) {
                // Om filen inte är ren JSON, prova att rensa bort eventuella skräptecken
                alert('Filen kunde inte tolkas som JSON. Kontrollera att det är en äkta exportfil.');
                console.error(parseErr);
                importFile.value = '';
                return;
            }
            
            const postsData = imported.digital_journal_posts || imported.posts || imported.journalPosts || (Array.isArray(imported) ? imported : []);
            const plansData = imported.digital_journal_plans || imported.plans || imported.journalPlans || [];

            if (confirm(`Vill du skriva över befintlig data och importera "${file.name}"?`)) {
                localStorage.setItem('digital_journal_posts', JSON.stringify(postsData));
                localStorage.setItem('digital_journal_plans', JSON.stringify(plansData));
                
                importFile.value = '';
                settingsModal.classList.add('hidden');

                if (typeof posts !== 'undefined') posts = postsData;
                if (typeof plans !== 'undefined') plans = plansData;

                if (typeof renderPosts === 'function') renderPosts();
                if (typeof renderPlans === 'function') renderPlans();

                alert('Importen slutförd!');
            } else {
                importFile.value = '';
            }
        } catch (err) {
            alert('Ett oväntat fel uppstod vid inläsning av filen.');
            console.error(err);
            importFile.value = '';
        }
    });
});
