document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const exportBtn = document.getElementById('exportBtn');
    const saveBtn = document.getElementById('saveBtn');
    const journalInput = document.getElementById('journalInput');
    const entriesList = document.getElementById('entriesList');

    // Ladda befintliga inlägg vid start (exempel med localStorage)
    loadEntries();

    // 1. Trigga filväljaren när man klickar på "Importera"
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    // 2. Hantera filinläsningen
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validera att datan är en array eller ett objekt (justera efter din struktur)
                if (!importedData) {
                    throw new Error("Tom eller ogiltig fil.");
                }

                // Spara till localStorage (eller anpassa till din IndexedDB-logik)
                localStorage.setItem('journal_entries', JSON.stringify(importedData));
                
                alert("Journalen har importerats utan problem!");
                
                // Uppdatera gränssnittet
                loadEntries();

            } catch (error) {
                console.error("Fel vid tolkning av JSON:", error);
                alert("Kunde inte importera filen. Kontrollera att det är en giltig JSON-fil.");
            } finally {
                // Nollställ filväljaren så samma fil kan väljas igen om det behövs
                importFile.value = '';
            }
        };

        reader.readAsText(file);
    });

    // 3. Exportera-knapp (bra för att generera en fil att testa importen med)
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

    // 4. Exempel på Spara-knapp
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
            card.innerHTML = `
                <p style="font-size: 0.85rem; color: #a78bfa; margin-bottom: 4px;">${new Date(entry.date || Date.now()).toLocaleString('sv-SE')}</p>
                <p>${escapeHtml(entry.text || entry)}</p>
            `;
            entriesList.appendChild(card);
        });
    }

    // Säkerhetsfunktion mot XSS om texten visas direkt
    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});
