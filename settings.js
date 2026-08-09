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
                posts: JSON.parse(localStorage.getItem('digital_journal_posts')) || [],
                plans: JSON.parse(localStorage.getItem('digital_journal_plans')) || [],
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
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Stäng inställningsrutan direkt så den inte ligger kvar i vägen
        settingsModal.classList.add('hidden');

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            try {
                const imported = JSON.parse(uploadEvent.target.result);
                
                const postsData = imported.posts || imported.journalPosts;
                const plansData = imported.plans || imported.journalPlans;

                if (imported && (postsData || plansData)) {
                    if (confirm(`Vald fil: "${file.name}". Vill du skriva över befintlig data och importera detta?`)) {
                        
                        if (postsData) {
                            localStorage.setItem('digital_journal_posts', JSON.stringify(postsData));
                        }
                        if (plansData) {
                            localStorage.setItem('digital_journal_plans', JSON.stringify(plansData));
                        }
                        
                        importFile.value = '';

                        // Utför en snygg "reboot" av appen
                        setTimeout(() => {
                            window.location.href = window.location.pathname + '?reload=' + new Date().getTime();
                        }, 100);
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
        };
        reader.readAsText(file);
    });
});
