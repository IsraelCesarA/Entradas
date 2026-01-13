document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const fileInput = document.getElementById('file-input');
    const linesInput = document.getElementById('lines-input');
    const linesFilter = document.getElementById('lines-filter');
    const selectAllLinesButton = document.getElementById('select-all-lines');
    const selectedFiltersDisplay = document.getElementById('selected-filters-display');
    const dataTableBody = document.getElementById('data-table-body');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const themeToggleButton = document.getElementById('theme-toggle');
    const clearDataButton = document.getElementById('clear-data-button');
    const filterSection = document.getElementById('filter-section');

    const tableFilter = document.getElementById('table-filter');
    const startTimeFilter = document.getElementById('start-time-filter');
    const endTimeFilter = document.getElementById('end-time-filter');

    let allData = [];
    let updateInterval;

    function checkTime(itemId, scheduledTimeStr) {
        const realTimeInput = document.getElementById(`real-time-${itemId}`);
        const veiculoInput = document.getElementById(`veiculo-${itemId}`);
        const lostMessageSpan = document.getElementById(`lost-msg-${itemId}`);
        
        if (!lostMessageSpan) return;

        lostMessageSpan.style.display = 'none';
        lostMessageSpan.className = 'lost-entry';

        if (!realTimeInput.value) return;
        if (!veiculoInput.value || veiculoInput.value.length !== 5) {
            alert('Por favor, insira um número de veículo válido com 5 dígitos antes de preencher o horário.');
            realTimeInput.value = '';
            saveUserInputs(itemId, veiculoInput.value, '');
            return;
        }

        const fixedTolerance = 10;
        const [hPrevisto, mPrevisto] = scheduledTimeStr.split(':').map(Number);
        const [hReal, mReal] = realTimeInput.value.split(':').map(Number);
        const diff = (hReal * 60 + mReal) - (hPrevisto * 60 + mPrevisto);

        if (diff > fixedTolerance) {
            lostMessageSpan.innerText = `(Atraso)`;
            lostMessageSpan.classList.add('lost-atraso');
            lostMessageSpan.style.display = 'inline';
        } else if (diff < -fixedTolerance) {
            lostMessageSpan.innerText = `(Adiantamento)`;
            lostMessageSpan.classList.add('lost-adiantamento');
            lostMessageSpan.style.display = 'inline';
        }
    }
    
    function applyTheme() {
        const currentTheme = localStorage.getItem('theme');
        document.body.classList.toggle('dark-mode', currentTheme === 'dark');
    }

    function initializeApp() {
        applyTheme();
        const savedData = localStorage.getItem('gistFileData');
        if (savedData) {
            allData = JSON.parse(savedData);
            filterSection.style.display = 'flex';
            populateFilters(allData);
            
            const savedLines = JSON.parse(localStorage.getItem('gistSelectedLines')) || [];
            Array.from(linesFilter.options).forEach(option => {
                option.selected = savedLines.includes(option.value);
            });

            const savedTables = JSON.parse(localStorage.getItem('gistSelectedTables')) || [];
            Array.from(tableFilter.options).forEach(option => {
                option.selected = savedTables.includes(option.value);
            });

            const savedTimeFilters = JSON.parse(localStorage.getItem('gistTimeFilters')) || { start: '', end: '' };
            startTimeFilter.value = savedTimeFilters.start;
            endTimeFilter.value = savedTimeFilters.end;
            
            updateSelectedFiltersDisplay();
            renderTable(allData);
        } else {
            filterSection.style.display = 'none';
        }
    }

    initializeApp();

    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    clearDataButton.addEventListener('click', () => {
        if (confirm('Tem certeza de que deseja limpar todos os dados carregados e preenchidos?')) {
            localStorage.clear();
            window.location.reload();
        }
    });

    fileInput.addEventListener('change', handleFile);
    
    linesFilter.addEventListener('change', () => {
        updateSelectedFiltersDisplay();
        renderTable(allData);
        saveFilterState();
    });

    tableFilter.addEventListener('change', () => {
        updateSelectedFiltersDisplay();
        renderTable(allData);
        saveFilterState();
    });

    startTimeFilter.addEventListener('input', () => {
        renderTable(allData);
        saveFilterState();
    });

    endTimeFilter.addEventListener('input', () => {
        renderTable(allData);
        saveFilterState();
    });

    // Lógica do botão Selecionar Todas
    selectAllLinesButton.addEventListener('click', () => {
        const options = Array.from(linesFilter.options);
        const allSelected = options.every(opt => opt.selected);
        options.forEach(opt => opt.selected = !allSelected);
        linesFilter.dispatchEvent(new Event('change'));
    });

    linesInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const lineValue = linesInput.value.trim();
            if (lineValue) {
                const foundOption = Array.from(linesFilter.options).find(opt => opt.value === lineValue);
                if (foundOption) {
                    foundOption.selected = true;
                    linesFilter.dispatchEvent(new Event('change'));
                } else {
                    alert(`Linha "${lineValue}" não encontrada no arquivo.`);
                }
                linesInput.value = '';
            }
        }
    });

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        dataTableBody.innerHTML = '';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', raw: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) throw new Error('O arquivo está vazio ou não pôde ser lido.');
                
                allData = jsonData.map((row, index) => {
                    const horarioPrevistoStr = String(row.GOP_PDH_HORARIO_INICIO || '').slice(-5);
                    if (!/^\d{2}:\d{2}$/.test(horarioPrevistoStr)) return null;
                    
                    return {
                        id: index,
                        Linha: String(row.GOP_PDH_LINHA), Tabela: String(row.GOP_PDH_TABELA),
                        Empresa: String(row.GOP_PDH_EMPRESA), PostoControle: String(row.GOP_PDH_POSTO_CONTROLE_INICIAL),
                        GOP_PDH_HORARIO_INICIO: horarioPrevistoStr, TipoPassagem: String(row.GOP_PDH_COD_PASSAGEM_INICIAL)
                    };
                }).filter(Boolean);

                if (allData.length === 0) throw new Error('Nenhum dado válido encontrado no arquivo.');

                localStorage.setItem('gistFileData', JSON.stringify(allData));
                window.location.reload();
            } catch (error) {
                console.error('Erro ao processar o arquivo:', error);
                errorMessage.innerHTML = `Erro ao processar o arquivo: ${error.message}`;
                errorMessage.style.display = 'block';
                loadingMessage.style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    function populateFilters(data) {
        const uniqueLines = [...new Set(data.map(item => item.Linha.trim()))].sort();
        linesFilter.innerHTML = '';
        uniqueLines.forEach(line => {
            const option = document.createElement('option');
            option.value = line;
            option.textContent = line;
            linesFilter.appendChild(option);
        });

        const uniqueTables = [...new Set(data.map(item => item.Tabela.trim()))].sort();
        tableFilter.innerHTML = '';
        uniqueTables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            tableFilter.appendChild(option);
        });
    }

    function updateSelectedFiltersDisplay() {
        selectedFiltersDisplay.innerHTML = '';
        
        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);
        selectedLines.forEach(line => {
            const tag = document.createElement('span');
            tag.className = 'selected-line-tag';
            tag.innerHTML = `Linha: ${line} <span class="remove-tag" data-line="${line}">&times;</span>`;
            tag.querySelector('.remove-tag').addEventListener('click', (e) => {
                const lineToRemove = e.target.dataset.line;
                const option = Array.from(linesFilter.options).find(opt => opt.value === lineToRemove);
                if (option) option.selected = false;
                linesFilter.dispatchEvent(new Event('change'));
            });
            selectedFiltersDisplay.appendChild(tag);
        });

        const selectedTables = Array.from(tableFilter.selectedOptions).map(option => option.value);
        selectedTables.forEach(table => {
            const tag = document.createElement('span');
            tag.className = 'selected-line-tag';
            tag.innerHTML = `Tabela: ${table} <span class="remove-tag" data-table="${table}">&times;</span>`;
            tag.querySelector('.remove-tag').addEventListener('click', (e) => {
                const tableToRemove = e.target.dataset.table;
                const option = Array.from(tableFilter.options).find(opt => opt.value === tableToRemove);
                if (option) option.selected = false;
                tableFilter.dispatchEvent(new Event('change'));
            });
            selectedFiltersDisplay.appendChild(tag);
        });
    }

    function renderTable(data) {
        dataTableBody.innerHTML = '';
        if (updateInterval) clearInterval(updateInterval);

        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);
        const selectedTables = Array.from(tableFilter.selectedOptions).map(option => option.value);
        const startTime = startTimeFilter.value;
        const endTime = endTimeFilter.value;

        const filteredData = data.filter(item => {
            const lineMatch = selectedLines.length === 0 || selectedLines.includes(item.Linha.trim());
            const tableMatch = selectedTables.length === 0 || selectedTables.includes(item.Tabela.trim());
            const startTimeMatch = !startTime || item.GOP_PDH_HORARIO_INICIO >= startTime;
            const endTimeMatch = !endTime || item.GOP_PDH_HORARIO_INICIO <= endTime;
            const passagemMatch = ['4', '7'].includes(item.TipoPassagem);
            
            return lineMatch && tableMatch && startTimeMatch && endTimeMatch && passagemMatch;
        });
        
        filteredData.sort((a, b) => a.GOP_PDH_HORARIO_INICIO.localeCompare(b.GOP_PDH_HORARIO_INICIO));

        if (filteredData.length === 0) {
            dataTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum resultado para os filtros selecionados.</td></tr>`;
            return;
        }

        const userInputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
        const fragment = document.createDocumentFragment();

        filteredData.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.scheduleTime = item.GOP_PDH_HORARIO_INICIO;
            const savedInput = userInputs[item.id] || { veiculo: '', realTime: '' };

            tr.innerHTML = `
                <td>${item.Linha}</td><td>${item.Tabela}</td><td>${item.Empresa}</td>
                <td>${item.TipoPassagem}</td><td>${item.PostoControle}</td>
                <td>${item.GOP_PDH_HORARIO_INICIO} <span class="passed-time-dot" data-schedule-time="${item.GOP_PDH_HORARIO_INICIO}"></span><span id="lost-msg-${item.id}" class="lost-entry"></span></td>
                <td><div class="input-group">
                    <input type="text" placeholder="Veículo" pattern="\\d{5}" maxlength="5" id="veiculo-${item.id}" value="${savedInput.veiculo}">
                    <input type="time" id="real-time-${item.id}" value="${savedInput.realTime}">
                </div></td>`;
            fragment.appendChild(tr);
        });

        dataTableBody.appendChild(fragment);
        addEventListenersToTable(filteredData);
        updatePassedTimes();
        updateInterval = setInterval(updatePassedTimes, 30000);
    }
    
    function addEventListenersToTable(tableData) {
        tableData.forEach(item => {
            const veiculoInput = document.getElementById(`veiculo-${item.id}`);
            const realTimeInput = document.getElementById(`real-time-${item.id}`);

            if (veiculoInput && realTimeInput) {
                veiculoInput.addEventListener('input', () => saveUserInputs(item.id, veiculoInput.value, realTimeInput.value));
                realTimeInput.addEventListener('change', () => {
                    checkTime(item.id, item.GOP_PDH_HORARIO_INICIO);
                    saveUserInputs(item.id, veiculoInput.value, realTimeInput.value);
                });
                veiculoInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        realTimeInput.focus();
                    }
                });
                if (realTimeInput.value) {
                    checkTime(item.id, item.GOP_PDH_HORARIO_INICIO);
                }
            }
        });
    }

    function saveUserInputs(itemId, veiculo, realTime) {
        const userInputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
        userInputs[itemId] = { veiculo, realTime };
        localStorage.setItem('gistUserInputs', JSON.stringify(userInputs));
    }

    function saveFilterState() {
        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);
        localStorage.setItem('gistSelectedLines', JSON.stringify(selectedLines));

        const selectedTables = Array.from(tableFilter.selectedOptions).map(option => option.value);
        localStorage.setItem('gistSelectedTables', JSON.stringify(selectedTables));

        const timeFilters = { start: startTimeFilter.value, end: endTimeFilter.value };
        localStorage.setItem('gistTimeFilters', JSON.stringify(timeFilters));
    }

    function getFortalezaTime() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Fortaleza'
        });
        const [hour, minute] = formatter.format(now).split(':').map(Number);
        return hour * 60 + minute;
    }

    function updatePassedTimes() {
        const currentTimeInMinutes = getFortalezaTime();
        document.querySelectorAll('.passed-time-dot').forEach(dot => {
            const [hour, minute] = dot.dataset.scheduleTime.split(':').map(Number);
            const scheduledTimeInMinutes = hour * 60 + minute;
            dot.classList.toggle('visible', scheduledTimeInMinutes < currentTimeInMinutes);
        });
    }
});
