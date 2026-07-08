// 📦 Armazena a lista de postos para usar na tabela
let listaPostos = [];

// 🌗 Alternar Tema (mantém a lógica original da página)
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    themeToggle.textContent = document.body.classList.contains('dark-mode') 
        ? 'Alternar Tema' 
        : 'Alternar Tema';
});

// 🚀 Carrega dados da API com proxy seguro para resolver erro de acesso
async function carregarDadosPostos() {
    try {
        const urlApi = 'http://gistapis.etufor.ce.gov.br:8081/api/postoControle';
        const urlProxy = 'https://corsproxy.io/?' + encodeURIComponent(urlApi);

        const resposta = await fetch(urlProxy);
        if (!resposta.ok) throw new Error(`Falha ao carregar: ${resposta.status}`);

        listaPostos = await resposta.json();
        console.log('Postos carregados com sucesso:', listaPostos);

    } catch (erro) {
        console.error('Erro ao acessar API:', erro);
        // Em caso de erro, mantém a estrutura e preenche com valor padrão
        listaPostos = [];
    }
}

// 🔍 Função para buscar o nome do posto pelo número
function obterNomePosto(numeroPosto) {
    if (!listaPostos.length || !numeroPosto) return '-';
    const posto = listaPostos.find(p => String(p.numero) === String(numeroPosto));
    return posto ? posto.nomeFantasia : numeroPosto;
}

// 📝 Exemplo de preenchimento da tabela com a coluna Posto
// Essa função será chamada ao carregar o arquivo ou gerar os dados
function preencherLinhaTabela(linhaDados) {
    const corpoTabela = document.querySelector('#tabelaPrincipal tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${linhaDados.linha || '-'}</td>
        <td>${linhaDados.tabela || '-'}</td>
        <td>${linhaDados.empresa || '-'}</td>
        <td>${linhaDados.passagem || '-'}</td>
        <td>${obterNomePosto(linhaDados.posto)}</td> <!-- Coluna Posto com nome -->
        <td>${linhaDados.inicio || '-'}</td>
        <td>${linhaDados.horarioReal || '-'}</td>
        <td><input type="text" class="obs-input" placeholder="Observações"></td>
    `;

    corpoTabela.appendChild(tr);
}

// 🧹 Limpar dados
document.getElementById('clear-data-button').addEventListener('click', () => {
    if (confirm('Deseja limpar todos os dados?')) {
        document.querySelector('#tabelaPrincipal tbody').innerHTML = 
            `<tr><td colspan="8" class="info-centro">Carregue um arquivo para começar.</td></tr>`;
    }
});

// ⏳ Inicia carregamento dos postos quando a página abre
window.addEventListener('load', carregarDadosPostos);
