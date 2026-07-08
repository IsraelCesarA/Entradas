// 🚀 Carregar dados da API usando proxy seguro para contornar o bloqueio de HTTP
async function carregarPostos() {
    const corpoTabela = document.querySelector('#tabelaDados tbody');
    corpoTabela.innerHTML = `<tr><td colspan="8" class="loading">Carregando dados dos postos...</td></tr>`;

    try {
        // Usamos um proxy HTTPS para acessar a API que só tem HTTP
        const urlProxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://gistapis.etufor.ce.gov.br:8081/api/postoControle');

        const resposta = await fetch(urlProxy);
        
        if (!resposta.ok) throw new Error(`Erro na requisição: ${resposta.status}`);
        
        const postos = await resposta.json();
        corpoTabela.innerHTML = '';

        if (postos.length === 0) {
            corpoTabela.innerHTML = `<tr><td colspan="8" class="erro">Nenhum posto encontrado.</td></tr>`;
            return;
        }

        // Preenche a tabela com os dados
        postos.forEach(posto => {
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td>${posto.numero || '-'}</td>
                <td><strong>${posto.nomeFantasia || '-'}</strong></td>
                <td>${posto.nomeFantasia || '-'}</td>
                <td>${posto.nome || '-'}</td>
                <td>${posto.latitude ? posto.latitude.toFixed(6) : '-'}</td>
                <td>${posto.longitude ? posto.longitude.toFixed(6) : '-'}</td>
                <td>${posto.raio ? posto.raio + ' m' : '-'}</td>
                <td><input type="text" class="obs-input" placeholder="Observações"></td>
            `;
            corpoTabela.appendChild(linha);
        });

    } catch (erro) {
        corpoTabela.innerHTML = `<tr><td colspan="8" class="erro">Erro ao carregar dados: ${erro.message}</td></tr>`;
        console.error(erro);
    }
}

// 🌗 Alternar modo escuro/claro
const botaoTema = document.getElementById('theme-toggle');
botaoTema.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    botaoTema.textContent = document.body.classList.contains('dark-mode') 
        ? 'Modo Claro' 
        : 'Modo Escuro';
});

// 🧹 Limpar e recarregar dados
document.getElementById('clear-data-button').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja recarregar os dados?')) {
        carregarPostos();
    }
});

// 📋 Carregar dados ao abrir a página
window.addEventListener('load', carregarPostos);
