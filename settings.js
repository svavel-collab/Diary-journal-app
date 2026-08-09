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

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            try {
                const imported = JSON.parse(uploadEvent.target.result);
                
                if (imported && (imported.posts || imported.plans)) {
                    if (confirm('Detta kommer att skriva över befintliga inlägg och planeringar med datan från filen. Vill du fortsätta?')) {
                        if (imported.posts) {
                            localStorage.setItem('digital_journal_posts', JSON.stringify(imported.posts));
                        }
                        if (imported.plans) {
                            localStorage.setItem('digital_journal_plans', JSON.stringify(imported.plans));
                        }
                        
                        alert('Importen slutfördes!');
                        window.location.reload();
                    }
                } else {
                    alert('Ogiltigt filformat.');
                }
            } catch (err) {
                alert('Kunde inte läsa filen. Kontrollera att det är en giltig JSON-fil.');
                console.error(err);
            } finally {
                importFile.value = '';
            }
        };
        reader.readAsText(file);
    });
});
