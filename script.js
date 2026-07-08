document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const loadPostosButton = document.getElementById('load-postos-button');
    const exportExcelButton = document.getElementById('export-excel-button');
    const exportPdfButton = document.getElementById('export-pdf-button');
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

    let allData = [];
    let updateInterval;
    let nomesPostos = JSON.parse(localStorage.getItem('gistNomesPostos')) || {};

    // Botão de Carregar Postos (Consulta API via Proxy)
    loadPostosButton.addEventListener('click', async () => {
        const originalText = loadPostosButton.innerText;
        loadPostosButton.innerText = 'Carregando...';
        loadPostosButton.disabled = true;

        try {
            const apiUrl = 'http://gistapis.etufor.ce.gov.br:8081/api/postoControle';
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);

            const response = await fetch(proxyUrl);
            
            if (!response.ok) throw new Error('Falha API Postos através do proxy');
            const data = await response.json();
            
            data.forEach(posto => {
                const idPosto = String(posto.id || posto.codigo || posto.Id || posto.codPosto || posto.ID_POSTO || posto.numero); 
                const nome = posto.nomeFantasia || posto.nome || posto.NomeFantasia || posto.Descricao || posto.descricao || posto.NOM_POSTO;
                
                if (idPosto && idPosto !== "undefined") {
                    nomesPostos[idPosto] = nome;
                }
            });

            localStorage.setItem('gistNomesPostos', JSON.stringify(nomesPostos));
            loadPostosButton.innerText = 'Concluído!';
            
            if (allData.length > 0) {
                populateFilters(allData);
                updateSelectedFiltersDisplay();
                renderTable(allData);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao carregar os nomes dos postos. Verifique a rede ou o serviço de proxy.');
            loadPostosButton.innerText = 'Erro';
        }

        setTimeout(() => {
            loadPostosButton.innerText = originalText;
            loadPostosButton.disabled = false;
        }, 3000);
    });

    // Função auxiliar para capturar os dados exibidos atualmente na tabela (incluindo inputs)
    function getTableExportData() {
        const rows = Array.from(dataTableBody.querySelectorAll('tr'));
        return rows.map(tr => {
            const cells = tr.querySelectorAll('td');
            const vIn = tr.querySelector('.v-input');
            const tIn = tr.querySelector('.t-input');
            const oIn = tr.querySelector('.obs-input');

            // Limpa o texto da coluna de Início removendo o aviso de atraso/adiantamento se houver
            let inicioText = cells[5].innerText.split('\n')[0].trim();
            inicioText = inicioText.replace('(Atraso)', '').replace('(Adiantamento)', '').trim();

            return {
                "Linha": cells[0].innerText,
                "Tabela": cells[1].innerText,
                "Empresa": cells[2].innerText,
                "Passagem": cells[3].innerText,
                "Posto": cells[4].innerText,
                "Início": inicioText,
                "Veículo": vIn ? vIn.value : '',
                "Horário Real": tIn ? tIn.value : '',
                "Observações": oIn ? oIn.value : ''
            };
        });
    }

    // Evento de Exportar Excel
    exportExcelButton.addEventListener('click', () => {
        const data = getTableExportData();
        if (data.length === 0) {
            alert('Não há dados visíveis para exportar.');
            return;
        }
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Programação");
        XLSX.writeFile(wb, "programacao_diaria.xlsx");
    });

    // Evento de Exportar PDF
    exportPdfButton.addEventListener('click', () => {
        const data = getTableExportData();
        if (data.length === 0) {
            alert('Não há dados visíveis para exportar.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Usar paisagem para caber mais colunas

        const columns = ["Linha", "Tabela", "Empresa", "Passagem", "Posto", "Início", "Veículo", "Horário Real", "Observações"];
        const rows = data.map(item => [
            item["Linha"], item["Tabela"], item["Empresa"], item["Passagem"],
            item["Posto"], item["Início"], item["Veículo"], item["Horário Real"], item["Observações"]
        ]);

        doc.text("Consulta de Programação Diária", 14, 15);
        
        doc.autoTable({
            startY: 20,
            head: [columns],
            body: rows,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 123, 255] }
        });

        doc.save("programacao_diaria.pdf");
    });

    // Evento de Carregamento de Arquivo Excel/CSV
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
            } catch (err) { 
                alert('Erro ao processar o arquivo. Verifique se o formato está correto.'); 
                loadingMessage.style.display = 'none'; 
            }
        };
        reader.readAsArrayBuffer(file);
    });

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
                opt.value = val; 
                
                if (key === 'PostoControle' && nomesPostos[val]) {
                    opt.textContent = `${val} - ${nomesPostos[val]}`;
                } else {
                    opt.textContent = val;
                }
                
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
            localStorage.removeItem('gistFileData');
            localStorage.removeItem('gistUserInputs');
            window.location.reload();
        }
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
            const val = inputs[item.id] || { veiculo: '', realTime: '', observacao: '' };
            
            const nomePostoDisplay = nomesPostos[item.PostoControle] 
                ? ` - ${nomesPostos[item.PostoControle]}` 
                : '';

            tr.innerHTML = `
                <td>${item.Linha}</td>
                <td>${item.Tabela}</td>
                <td>${item.Empresa}</td>
                <td>${item.TipoPassagem}</td>
                <td>${item.PostoControle}${nomePostoDisplay}</td>
                <td>${item.GOP_PDH_HORARIO_INICIO} <span class="passed-time-dot" data-schedule-time="${item.GOP_PDH_HORARIO_INICIO}" data-item-id="${item.id}"></span><span id="lost-msg-${item.id}" class="lost-entry"></span></td>
                <td><input type="text" maxlength="5" id="veiculo-${item.id}" value="${val.veiculo || ''}" class="v-input table-input"></td>
                <td><input type="time" id="real-time-${item.id}" value="${val.realTime || ''}" class="t-input table-input"></td>
                <td><input type="text" id="obs-${item.id}" value="${val.observacao || ''}" class="obs-input table-input" placeholder="Obs..."></td>`;
            
            dataTableBody.appendChild(tr);
            
            const vIn = tr.querySelector(`#veiculo-${item.id}`);
            const rIn = tr.querySelector(`#real-time-${item.id}`);
            const oIn = tr.querySelector(`#obs-${item.id}`);
            
            vIn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    rIn.focus();
                }
            });

            rIn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    oIn.focus();
                }
            });

            oIn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextRow = tr.nextElementSibling;
                    if (nextRow) {
                        const nextVIn = nextRow.querySelector('.v-input');
                        if (nextVIn) nextVIn.focus();
                    }
                }
            });

            const updateRow = () => {
                inputs[item.id] = { veiculo: vIn.value, realTime: rIn.value, observacao: oIn.value };
                localStorage.setItem('gistUserInputs', JSON.stringify(inputs));
                checkTime(item.id, item.GOP_PDH_HORARIO_INICIO);
                updatePassedTimes();
            };

            vIn.oninput = rIn.onchange = oIn.oninput = updateRow;
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

    initializeApp();
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updatePassedTimes, 30000);
});
