document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const exportBtn = document.getElementById('exportBtn');
    const saveBtn = document.getElementById('saveBtn');
    const journalInput = document.getElementById('journalInput');
    const entriesList = document.getElementById('entriesList');

    // Ladda befintliga inlägg vid start
    loadEntries();

    // 1. Trigga filväljaren när man klickar på "Importera"
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    // 2. Robust hantering av filinläsningen
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            
            // Kontrollera om filen faktiskt innehåller något
            if (!content || content.trim() === "") {
                alert("Den valda filen är tom.");
                importFile.value = '';
                return;
            }

            try {
                const importedData = JSON.parse(content);
                
                // Validera att datan är en array eller ett objekt
                let entriesToSave = [];
                if (Array.isArray(importedData)) {
                    entriesToSave = importedData;
                } else if (typeof importedData === 'object' && importedData !== null) {
                    entriesToSave = importedData.entries || [importedData];
                } else {
                    throw new Error("Okänd JSON-struktur");
                }

                localStorage.setItem('journal_entries', JSON.stringify(entriesToSave));
                alert("Journalen har importerats framgångsrikt!");
                loadEntries();

            } catch (error) {
                console.error("Fel vid JSON-parsning:", error);
                alert(`Kunde inte tolka filen som JSON.\nInnehållet börjar med: "${content.slice(0, 30)}..."`);
            } finally {
                // Nollställ filväljaren så samma fil kan väljas igen vid behov
                importFile.value = '';
            }
        };

        reader.readAsText(file);
    });

    // 3. Exportera-knapp
    exportBtn.addEventListener('click', () => {
        const data = localStorage.getItem('journal_entries') || '[]';
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    });

    // 4. Spara-knapp för nya inlägg
    saveBtn.addEventListener('click', () => {
        const text = journalInput.value.trim();
        if (!text) return;

        let entries = JSON.parse(localStorage.getItem('journal_entries')) || [];
        entries.unshift({ text, date: new Date().toISOString() });
        
        localStorage.setItem('journal_entries', JSON.stringify(entries));
        journalInput.value = '';
        
        loadEntries();
    });

    // Funktion för att rita ut inlägg i gränssnittet
    function loadEntries() {
        entriesList.innerHTML = '';
        let entries = JSON.parse(localStorage.getItem('journal_entries')) || [];

        if (entries.length === 0) {
            entriesList.innerHTML = '<p style="color: #71717a; font-size: 0.9rem;">Inga inlägg sparade ännu.</p>';
            return;
        }

        entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'entry-card';
            
            // Hantera om inlägget är ett objekt eller en ren textsträng
            const textContent = typeof entry === 'object' && entry !== null ? (entry.text || JSON.stringify(entry)) : entry;
            const dateContent = entry.date ? new Date(entry.date).toLocaleString('sv-SE') : '';

            card.innerHTML = `
                ${dateContent ? `<p style="font-size: 0.85rem; color: #a78bfa; margin-bottom: 4px;">${dateContent}</p>` : ''}
                <p>${escapeHtml(textContent)}</p>
            `;
            entriesList.appendChild(card);
        });
    }

    // Säkerhetsfunktion mot XSS
    function escapeHtml(str) {
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});
