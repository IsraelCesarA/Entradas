
Destaques da pasta
Web app code (HTML, CSS, JS) facilitates loading Excel/CSV data for daily schedule review with real-time tracking.

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const fileInput = document.getElementById('file-input');
    const linesInput = document.getElementById('lines-input');
    const linesFilter = document.getElementById('lines-filter');
    const selectedLinesDisplay = document.getElementById('selected-lines-display');
    const dataTableBody = document.getElementById('data-table-body');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const themeToggleButton = document.getElementById('theme-toggle');
    const clearDataButton = document.getElementById('clear-data-button');
    const filterSection = document.getElementById('filter-section');

    let allData = [];
    let updateInterval;

    // --- FUNÇÕES GLOBAIS DE APOIO ---
    // Esta função agora está fora do escopo principal para ser acessível
    function checkTime(itemId, scheduledTimeStr) {
        const realTimeInput = document.getElementById(`real-time-${itemId}`);
        const veiculoInput = document.getElementById(`veiculo-${itemId}`);
        const lostMessageSpan = document.getElementById(`lost-msg-${itemId}`);
        
        if (!lostMessageSpan) return; // Sai se o elemento não existir

        lostMessageSpan.style.display = 'none';
        lostMessageSpan.className = 'lost-entry';

        if (!realTimeInput.value) return;
        if (!veiculoInput.value || veiculoInput.value.length !== 5) {
            alert('Por favor, insira um número de veículo válido com 5 dígitos antes de preencher o horário.');
            realTimeInput.value = '';
            saveUserInputs(itemId, veiculoInput.value, ''); // Salva a limpeza
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

    // --- LÓGICA DO TEMA E INICIALIZAÇÃO ---
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
            
            updateSelectedLinesDisplay();
            renderTable(allData);
        } else {
            filterSection.style.display = 'none';
        }
    }

    initializeApp();

    // --- EVENT LISTENERS ---
    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    clearDataButton.addEventListener('click', () => {
        if (confirm('Tem certeza de que deseja limpar todos os dados carregados e preenchidos?')) {
            localStorage.removeItem('gistFileData');
            localStorage.removeItem('gistUserInputs');
            localStorage.removeItem('gistSelectedLines');
            window.location.reload();
        }
    });

    fileInput.addEventListener('change', handleFile);
    linesFilter.addEventListener('change', () => {
        updateSelectedLinesDisplay();
        renderTable(allData);
        saveSelectedLines();
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

    // --- FUNÇÕES PRINCIPAIS ---
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
                localStorage.removeItem('gistUserInputs');
                localStorage.removeItem('gistSelectedLines');
                
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
    }

    function updateSelectedLinesDisplay() {
        selectedLinesDisplay.innerHTML = '';
        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);

        selectedLines.forEach(line => {
            const tag = document.createElement('span');
            tag.className = 'selected-line-tag';
            tag.innerHTML = `${line} <span class="remove-tag" data-line="${line}">&times;</span>`;
            tag.querySelector('.remove-tag').addEventListener('click', (e) => {
                const lineToRemove = e.target.dataset.line;
                const option = Array.from(linesFilter.options).find(opt => opt.value === lineToRemove);
                if (option) option.selected = false;
                linesFilter.dispatchEvent(new Event('change'));
            });
            selectedLinesDisplay.appendChild(tag);
        });
    }

    function renderTable(data) {
        dataTableBody.innerHTML = '';
        if (updateInterval) clearInterval(updateInterval);

        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);
        const filteredByPassagem = data.filter(item => ['4', '7'].includes(item.TipoPassagem));
        const filteredData = filteredByPassagem.filter(item => selectedLines.length === 0 || selectedLines.includes(item.Linha.trim()));
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

            // **CORREÇÃO DE ACESSIBILIDADE**: Adicionado aria-label
            tr.innerHTML = `
                <td>${item.Linha}</td><td>${item.Tabela}</td><td>${item.Empresa}</td>
                <td>${item.TipoPassagem}</td><td>${item.PostoControle}</td>
                <td>${item.GOP_PDH_HORARIO_INICIO} <span class="passed-time-dot" data-schedule-time="${item.GOP_PDH_HORARIO_INICIO}"></span><span id="lost-msg-${item.id}" class="lost-entry"></span></td>
                <td><div class="input-group">
                    <input type="text" placeholder="Veículo" pattern="\\d{5}" maxlength="5" id="veiculo-${item.id}" value="${savedInput.veiculo}" aria-label="Veículo para a linha ${item.Linha} às ${item.GOP_PDH_HORARIO_INICIO}">
                    <input type="time" id="real-time-${item.id}" value="${savedInput.realTime}" aria-label="Horário real para a linha ${item.Linha} às ${item.GOP_PDH_HORARIO_INICIO}">
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
                // **CORREÇÃO DO ERRO 'checkTime'**: Listener adicionado programaticamente
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

    function saveSelectedLines() {
        const selectedLines = Array.from(linesFilter.selectedOptions).map(option => option.value);
        localStorage.setItem('gistSelectedLines', JSON.stringify(selectedLines));
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
