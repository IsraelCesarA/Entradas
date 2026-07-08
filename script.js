let allData = [];
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    elements = {
        loginScreen: document.getElementById('login-screen'),
        mainDashboard: document.getElementById('main-dashboard'),
        loginButton: document.getElementById('login-button'),
        fileInput: document.getElementById('file-input'),
        autoFillBtn: document.getElementById('auto-fill-btn'),
        dataTableBody: document.getElementById('data-table-body'),
        loadingOverlay: document.getElementById('loading-message'),
        linesFilter: document.getElementById('lines-filter'),
        tableFilter: document.getElementById('table-filter'),
        postoFilter: document.getElementById('posto-filter')
    };

    // Relógio e atualização de cores
    setInterval(() => {
        document.getElementById('clock').innerText = new Date().toLocaleTimeString();
        if(allData.length > 0) renderTable(allData);
    }, 30000);

    elements.loginButton.addEventListener('click', () => {
        if (document.getElementById('username').value === "CCO" && document.getElementById('password').value === "l6y;CqXV") {
            elements.loginScreen.style.display = 'none';
            elements.mainDashboard.style.display = 'block';
            loadStoredData();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });

    [elements.linesFilter, elements.tableFilter, elements.postoFilter].forEach(f => 
        f.addEventListener('change', () => renderTable(allData))
    );

    elements.autoFillBtn.addEventListener('click', async () => {
        if (allData.length === 0) return;
        elements.loadingOverlay.style.display = 'flex';
        
        try {
            const response = await fetch('http://201.49.34.51:8081/gps?verde&gar=0');
            
            // PROTEÇÃO: Verifica se o retorno é HTML em vez de JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new TypeError("O servidor enviou uma página (HTML) em vez de dados. Verifique o login.");
            }

            const gpsData = await response.json();
            const inputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
            const mapaGps = {};
            gpsData.forEach(bus => mapaGps[`${bus.LINHA}-${bus.TABELA}`] = bus.VEICULO || bus.PREFIXO);

            allData.forEach(item => {
                const key = `${item.Linha}-${item.Tabela}`;
                if (mapaGps[key] && (!inputs[item.id] || !inputs[item.id].veiculo)) {
                    if (!inputs[item.id]) inputs[item.id] = { veiculo: '', real: '', obs: '' };
                    inputs[item.id].veiculo = mapaGps[key];
                }
            });
            localStorage.setItem('gistUserInputs', JSON.stringify(inputs));
            renderTable(allData);
        } catch (err) { 
            alert("Erro no GPS: O servidor retornou uma página de login ou erro. " + err.message);
        }
        elements.loadingOverlay.style.display = 'none';
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            allData = json.map((row, idx) => ({
                id: idx,
                Linha: String(row.GOP_PDH_LINHA || ''),
                Tabela: String(row.GOP_PDH_TABELA || ''),
                Posto: String(row.GOP_PDH_POSTO_CONTROLE_INICIAL || ''),
                Inicio: String(row.GOP_PDH_HORARIO_INICIO || '').slice(-5)
            }));
            localStorage.setItem('gistFileData', JSON.stringify(allData));
            populateFilters(allData);
            renderTable(allData);
            document.getElementById('filter-section').style.display = 'flex';
        };
        reader.readAsArrayBuffer(file);
    });
});

function populateFilters(data) {
    const fill = (select, key) => {
        const vals = [...new Set(data.map(i => i[key]))].sort();
        select.innerHTML = vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill(elements.linesFilter, 'Linha');
    fill(elements.tableFilter, 'Tabela');
    fill(elements.postoFilter, 'Posto');
}

function renderTable(data) {
    const body = document.getElementById('data-table-body');
    const lSel = Array.from(elements.linesFilter.selectedOptions).map(o => o.value);
    const tSel = Array.from(elements.tableFilter.selectedOptions).map(o => o.value);
    const pSel = Array.from(elements.postoFilter.selectedOptions).map(o => o.value);

    // ORDENAÇÃO CRESCENTE[cite: 2]
    const filtered = data.filter(i => 
        (lSel.length === 0 || lSel.includes(i.Linha)) &&
        (tSel.length === 0 || tSel.includes(i.Tabela)) &&
        (pSel.length === 0 || pSel.includes(i.Posto))
    ).sort((a, b) => a.Inicio.localeCompare(b.Inicio));

    body.innerHTML = '';
    const inputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
    const curMin = new Date().getHours() * 60 + new Date().getMinutes();

    filtered.forEach(item => {
        const val = inputs[item.id] || { veiculo: '', real: '', obs: '' };
        const [h, m] = item.Inicio.split(':').map(Number);
        const isPast = (h * 60 + m) < curMin;

        const tr = document.createElement('tr');
        if (isPast) tr.classList.add('row-past');
        
        tr.innerHTML = `
            <td>${item.Linha}</td><td>${item.Tabela}</td><td>${item.Posto}</td>
            <td class="${isPast ? 'text-red' : ''}">${item.Inicio}</td>
            <td><div class="input-group">
                <input type="text" class="v-input" value="${val.veiculo || ''}" onchange="save(${item.id}, 'veiculo', this.value)">
                <input type="time" class="t-input" value="${val.real || ''}" onchange="save(${item.id}, 'real', this.value)">
            </div></td>
            <td>${calculateStatus(item.Inicio, val.real, isPast)}</td>
            <td><input type="text" class="obs-input" value="${val.obs || ''}" onchange="save(${item.id}, 'obs', this.value)"></td>
        `;
        body.appendChild(tr);
    });
}

function calculateStatus(prev, real, isPast) {
    if (!real) return isPast ? "<span class='perdeu'>Perdeu a entrada</span>" : "";
    const p = prev.split(':').map(Number);
    const r = real.split(':').map(Number);
    const diff = (r[0] * 60 + r[1]) - (p[0] * 60 + p[1]);
    if (diff > 10) return "<span class='atraso'>Atraso</span>";
    if (diff < -10) return "<span class='adianto'>Adiantamento</span>";
    return "<span class='ok'>OK</span>";
}

function save(id, field, val) {
    const inputs = JSON.parse(localStorage.getItem('gistUserInputs')) || {};
    if (!inputs[id]) inputs[id] = { veiculo: '', real: '', obs: '' };
    inputs[id][field] = val;
    localStorage.setItem('gistUserInputs', JSON.stringify(inputs));
    if (field === 'real') renderTable(allData);
}

function loadStoredData() {
    const saved = localStorage.getItem('gistFileData');
    if (saved) {
        allData = JSON.parse(saved);
        populateFilters(allData);
        renderTable(allData);
        document.getElementById('filter-section').style.display = 'flex';
    }
}
