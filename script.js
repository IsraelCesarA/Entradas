document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const linesInput = document.getElementById('lines-input');
    const tableInput = document.getElementById('table-input');
    const postoInput = document.getElementById('posto-input');
    const linesFilter = document.getElementById('lines-filter');
    const tableFilter = document.getElementById('table-filter');
    const postoFilter = document.getElementById('posto-filter');
    const selectAllLinesBtn = document.getElementById('select-all-lines');
    const selectAllTablesBtn = document.getElementById('select-all-tables');
    const selectAllPostosBtn = document.getElementById('select-all-postos');
    const selectedFiltersDisplay = document.getElementById('selected-filters-display');
    const dataTableBody = document.getElementById('data-table-body');
    const loadingMessage = document.getElementById('loading-message');
    const themeToggleButton = document.getElementById('theme-toggle');
    const clearDataButton = document.getElementById('clear-data-button');
    const filterSection = document.getElementById('filter-section');
    const startTimeFilter = document.getElementById('start-time-filter');
    const endTimeFilter = document.getElementById('end-time-filter');
    
    // Botões de Exportação
    const exportExcelBtn = document.getElementById('export-excel');
    const exportPdfBtn = document.getElementById('export-pdf');

    let allData = [];
    let updateInterval;

    function checkTime(itemId, scheduledTimeStr) {
        const realTimeInput = document.getElementById(`real-time-${itemId}`);
        const veiculoInput = document.getElementById(`veiculo-${itemId}`);
        const lostMessageSpan = document.getElementById(`lost-msg-${itemId}`);
        if (!lostMessageSpan || !realTimeInput.value) return;

        if (!veiculoInput.value || veiculoInput.value.length !== 5) {
            alert('Insira um veículo de 5 dígitos.');
            realTimeInput.value = '';
            return;
        }

        const [hPrev, mPrev] = scheduledTimeStr.split(':').map(Number);
        const [hReal, mReal] = realTimeInput.value.split(':').map(Number);
        const diff = (hReal * 60 + mReal) - (hPrev * 60 + mPrev);

        lostMessageSpan.style.display = 'inline';
        if (diff > 10) {
            lostMessageSpan.innerText = `(Atraso)`;
            lostMessageSpan.className = 'lost-entry lost-atraso';
        } else if (diff < -10) {
            lostMessageSpan.innerText = `(Adiantamento)`;
            lostMessageSpan.className = 'lost-entry lost-adiantamento';
        } else {
            lostMessageSpan.style.display = 'none';
        }
    }

    function initializeApp() {
        const currentTheme = localStorage.getItem('theme');
        document.body.classList.toggle('dark-mode', currentTheme === 'dark');
        const savedData = localStorage.getItem('gistFileData');
        if (savedData) {
            allData = JSON.parse(savedData);
            filterSection.style.display = 'flex';
            populateFilters(allData);
            loadFilterState();
            updateSelectedFiltersDisplay();
            renderTable(allData);
        }
    }

    function populateFilters(data) {
        const fill = (el, key) => {
            const items = [...new Set(data.map(item => item[key].trim()))].sort();
            el.innerHTML = '';
            items.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val; opt.textContent = val;
                el.appendChild(opt);
            });
        };
        fill(linesFilter, 'Linha');
        fill(tableFilter, 'Tabela');
        fill(postoFilter, 'PostoControle');
    }

    function setupQuickSearch(inputEl, filterEl) {
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = inputEl.value.trim();
                if (val) {
                    const found = Array.from(filterEl.options).find(opt => opt.value.toLowerCase() === val.toLowerCase());
                    if (found) {
                        found.selected = true;
                        filterEl.dispatchEvent(new Event('change'));
                    } else { alert(`"${val}" não encontrado.`); }
                    inputEl.value = '';
                }
            }
        });
    }

    setupQuickSearch(linesInput, linesFilter);
    setupQuickSearch(tableInput, tableFilter);
    setupQuickSearch(postoInput, postoFilter);

    function handleToggleAll(filterEl) {
        const options = Array.from(filterEl.options);
        const allSelected = options.every(opt => opt.selected);
        options.forEach(opt => opt.selected = !allSelected);
        filterEl.dispatchEvent(new Event('change'));
    }

    [linesFilter, tableFilter, postoFilter].forEach(el => {
        el.addEventListener('change', () => {
            updateSelectedFiltersDisplay();
            renderTable(allData);
            saveFilterState();
        });
    });

    selectAllLinesBtn.addEventListener('click', () => handleToggleAll(linesFilter));
    selectAllTablesBtn.addEventListener('click', () => handleToggleAll(tableFilter));
    selectAllPostosBtn.addEventListener('click', () => handleToggleAll(postoFilter));
    startTimeFilter.addEventListener('input', () => { renderTable(allData); saveFilterState(); });
    endTimeFilter.addEventListener('input', () => { renderTable(allData); saveFilterState(); });

    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    clearDataButton.addEventListener('click', () => {
        if (confirm('Limpar todos os dados?')) {
            localStorage.clear();
            window.location.reload();
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        loadingMessage.style.display = 'block';
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                allData = json.map((row, idx) => ({
                    id: idx,
                    Linha: String(row.GOP_PDH_LINHA || ''),
                    Tabela: String(row.GOP_PDH_TABELA || ''),
                    Empresa: String(row.GOP_PDH_EMPRESA || ''),
                    PostoControle: String(row.GOP_PDH_POSTO_CONTROLE_INICIAL || ''),
                    GOP_PDH_HORARIO_INICIO: String(row.GOP_PDH_HORARIO_INICIO || '').slice(-5),
                    TipoPassagem: String(row.GOP_PDH_COD_PASSAGEM_INICIAL || '')
                })).filter(i => /^\d{2}:\d{2}$/.test(i.GOP_PDH_HORARIO_INICIO));
                localStorage.setItem('gistFileData', JSON.stringify(allData));
                window.location.reload();
            } catch (err) { alert('Erro no arquivo'); loadingMessage.style.display = 'none'; }
        };
        reader.readAsArrayBuffer(file);
    });

    function updateSelectedFiltersDisplay() {
        selectedFiltersDisplay.innerHTML = '';
        const createTags = (filterEl, label) => {
            Array.from(filterEl.selectedOptions).forEach(opt => {
                const tag = document.createElement('span');
                tag.className = 'selected-line-tag';
                tag.innerHTML = `${label}: ${opt.value} <span class="remove-tag">&times;</span>`;
                tag.querySelector('.remove-tag').onclick = () => {
                    opt.selected = false;
                    filterEl.dispatchEvent(new Event('change'));
                };
                selectedFiltersDisplay.appendChild(tag);
            });
        };
        createTags(linesFilter, 'L');
        createTags(tableFilter, 'T');
        createTags(postoFilter, 'P');
    }

    function renderTable(data) {
        dataTableBody.innerHTML = '';
        const selLines = Array.from(linesFilter.selectedOptions).map(o => o.value);
        const selTables = Array.from(tableFilter.selectedOptions).map(o => o.value);
        const selPostos = Array.from(postoFilter.selectedOptions).map(o => o.value);

        const filtered = data.filter(item => {
            return (selLines.length === 0 || selLines.includes(item.Linha)) &&
                   (selTables.length === 0 || selTables.includes(item.Tabela)) &&
                   (selPostos.length === 0 || selPostos.includes(item.PostoControle)) &&
                   (!startTimeFilter.value || item.GOP_PDH_HORARIO_INICIO >= startTimeFilter.value) &&
                   (!endTimeFilter.value || item.GOP_PDH_HORARIO_INICIO <= endTimeFilter.value) &&
                   ['4', '7'].includes(item.TipoPassagem);
        }).sort((a, b) => a.GOP_PDH_HORARIO_INICIO.localeCompare(b.GOP_PDH_HORARIO_INICIO));

        const inputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
        filtered.forEach((item) => {
            const tr = document.createElement('tr');
            const val = inputs[item.id] || { veiculo: '', realTime: '' };
            tr.innerHTML = `
                <td>${item.Linha}</td><td>${item.Tabela}</td><td>${item.Empresa}</td>
                <td>${item.TipoPassagem}</td><td>${item.PostoControle}</td>
                <td>${item.GOP_PDH_HORARIO_INICIO} <span class="passed-time-dot" data-schedule-time="${item.GOP_PDH_HORARIO_INICIO}" data-item-id="${item.id}"></span><span id="lost-msg-${item.id}" class="lost-entry"></span></td>
                <td><div class="input-group">
                    <input type="text" maxlength="5" id="veiculo-${item.id}" value="${val.veiculo}" class="v-input">
                    <input type="time" id="real-time-${item.id}" value="${val.realTime}" class="t-input">
                </div></td>`;
            dataTableBody.appendChild(tr);
            
            const vIn = tr.querySelector(`#veiculo-${item.id}`);
            const rIn = tr.querySelector(`#real-time-${item.id}`);
            
            vIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rIn.focus(); } });
            rIn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextRow = tr.nextElementSibling;
                    if (nextRow) nextRow.querySelector('.v-input').focus();
                }
            });

            const updateRow = () => {
                inputs[item.id] = { veiculo: vIn.value, realTime: rIn.value };
                localStorage.setItem('gistUserInputs', JSON.stringify(inputs));
                checkTime(item.id, item.GOP_PDH_HORARIO_INICIO);
                updatePassedTimes();
            };

            vIn.oninput = rIn.onchange = updateRow;
            if (val.realTime) checkTime(item.id, item.GOP_PDH_HORARIO_INICIO);
        });
        updatePassedTimes();
    }

    function saveFilterState() {
        const state = {
            lines: Array.from(linesFilter.selectedOptions).map(o => o.value),
            tables: Array.from(tableFilter.selectedOptions).map(o => o.value),
            postos: Array.from(postoFilter.selectedOptions).map(o => o.value),
            start: startTimeFilter.value,
            end: endTimeFilter.value
        };
        localStorage.setItem('gistFilterState', JSON.stringify(state));
    }

    function loadFilterState() {
        const state = JSON.parse(localStorage.getItem('gistFilterState'));
        if (!state) return;
        const apply = (el, vals) => Array.from(el.options).forEach(o => o.selected = vals.includes(o.value));
        apply(linesFilter, state.lines || []);
        apply(tableFilter, state.tables || []);
        apply(postoFilter, state.postos || []);
        startTimeFilter.value = state.start || '';
        endTimeFilter.value = state.end || '';
    }

    function updatePassedTimes() {
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        document.querySelectorAll('.passed-time-dot').forEach(dot => {
            const itemId = dot.dataset.itemId;
            const rIn = document.getElementById(`real-time-${itemId}`);
            const [h, m] = dot.dataset.scheduleTime.split(':').map(Number);
            const hasVal = rIn && rIn.value !== "";
            dot.classList.toggle('visible', (h * 60 + m) < cur && !hasVal);
        });
    }

    // --- FUNÇÕES DE EXPORTAÇÃO ---
    
    function getTableDataForExport() {
        const rows = [];
        const trs = document.querySelectorAll('#data-table-body tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            const vInput = tr.querySelector('.v-input');
            const rInput = tr.querySelector('.t-input');
            const status = tr.querySelector('.lost-entry').innerText;

            rows.push({
                Linha: tds[0].innerText,
                Tabela: tds[1].innerText,
                Empresa: tds[2].innerText,
                Posto: tds[4].innerText,
                Previsto: tds[5].innerText.split(' ')[0],
                Veiculo: vInput.value,
                Real: rInput.value,
                Obs: status
            });
        });
        return rows;
    }

    function exportToExcel() {
        const data = getTableDataForExport();
        if (!data.length) return alert("Sem dados.");
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Programação");
        XLSX.writeFile(wb, `GIST_${new Date().toLocaleDateString()}.xlsx`);
    }

    function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const data = getTableDataForExport();
        if (!data.length) return alert("Sem dados.");

        const tableBody = data.map(i => [i.Linha, i.Tabela, i.Posto, i.Previsto, i.Veiculo, i.Real, i.Obs]);
        
        doc.text("Relatório de Programação Diária", 14, 15);
        doc.autoTable({
            head: [['Linha', 'Tab.', 'Posto', 'Prev.', 'Veíc.', 'Real', 'Status']],
            body: tableBody,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 8 }
        });
        doc.save(`GIST_${new Date().toLocaleDateString()}.pdf`);
    }

    exportExcelBtn.addEventListener('click', exportToExcel);
    exportPdfBtn.addEventListener('click', exportToPDF);

    initializeApp();
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updatePassedTimes, 30000);
});
