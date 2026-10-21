// --- DADOS E LÓGICA DE NEGÓCIO REVISADA E APRIMORADA ---
const AGENCIA = "0219";
let ultimoSequencial = 10000;

const Banco = {
    contasCorrente: [],
    contaPoupanca: [],
    solicitacoesPendentes: [],
    contaLogada: null,
    tipoAbertura: null,
    telaAnterior: 'tela-principal'
};

// --- FUNÇÕES AUXILIARES DE VALIDAÇÃO E FORMATAÇÃO ---
function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function gerarNumeroConta(prefixo) {
    const num = ultimoSequencial++;
    const digito = num % 10;
    return `${prefixo}${String(num).padStart(5, '0')}-${digito}`;
}

function validarNome(nome) {
    nome = String(nome).trim();
    if (nome.length < 3 || nome.length > 100) {
        throw new Error("Nome inválido. Deve ter entre 3 e 100 caracteres.");
    }
    if (nome.includes("  ")) {
        throw new Error("Nome inválido. Não use espaços duplicados.");
    }
    if (nome.split(/\s+/).length < 2) {
        throw new Error("Informe pelo menos nome e sobrenome.");
    }
    for (let char of nome) {
        if (!/[a-zA-ZáéíóúâêîôûãõàèìòùäëïöüçÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÄËÏÖÜÇ \.\'\-]/.test(char)) {
            throw new Error("Nome inválido. Use apenas letras, espaços, hífen, apóstrofo ou ponto.");
        }
    }
    return nome.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function validarEndereco(endereco) {
    endereco = String(endereco).trim();
    if (!endereco) {
        throw new Error("O endereço não pode ficar vazio.");
    }
    if (/^\d+$/.test(endereco.replace(/\s+/g, ""))) {
        throw new Error("O endereço não pode conter apenas números.");
    }
    for (let char of endereco) {
        if (!/[a-zA-Z0-9\.,\-\/\sáéíóúâêîôûãõàèìòùäëïöüçÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÄËÏÖÜÇ]/.test(char)) {
            throw new Error("Endereço contém caracteres não permitidos.");
        }
    }
    return endereco;
}

function validarFormatarCPF(cpf) {
    const limpo = String(cpf).replace(/\D/g, "");
    if (limpo.length !== 11) {
        throw new Error("CPF deve conter exatamente 11 dígitos.");
    }
    return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

function validarCpfDepositante(cpf) {
    const limpo = String(cpf).replace(/\D/g, "");
    if (limpo.length !== 11) return null;
    return limpo;
}

function validarSenha(senha) {
    senha = String(senha).trim();
    if (senha.length !== 6 || !/^\d+$/.test(senha)) {
        throw new Error("Senha deve conter exatamente 6 dígitos numéricos.");
    }
    return senha;
}

function parseData(strData) {
    if (!strData) return new Date();
    const partes = strData.split('/');
    if (partes.length === 3) {
        return new Date(partes[2], partes[1] - 1, partes[0]);
    }
    return new Date(strData);
}

function formatarData(data = new Date()) {
    const d = new Date(data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// --- CLASSES DE CONTAS ---
class Conta {
    constructor(titular, endereco, cpf, senha, prefixo) {
        this.agencia = AGENCIA;
        this.numero = gerarNumeroConta(prefixo);
        this.login = this.numero;
        this.titular = validarNome(titular);
        this.cpf = validarFormatarCPF(cpf);
        this.endereco = validarEndereco(endereco);
        this.senha = validarSenha(senha);
        this.saldo = 0.0;
        this.historico = [];
        this.agendamentos = [];
        this.solicitacaoExclusao = null;
    }

    adicionarTransacao(tipo, valor, data = new Date(), descricao = "") {
        this.historico.push({
            tipo: tipo,
            valor: Number(valor),
            data: new Date(data),
            descricao: descricao
        });
    }

    formatarTransacao(t) {
        const dataStr = formatarData(t.data);
        const valStr = formatarMoeda(Math.abs(t.valor));
        if (["Taxa de manutenção projetada", "Rendimento projetado", "Rendimento total projetado"].includes(t.tipo)) {
            return `${t.tipo} - R$ ${valStr} - ${dataStr}`;
        }
        if (t.tipo === "Saldo projetado") {
            return `${t.tipo}: R$ ${valStr} - ${dataStr}${t.descricao ? ' - ' + t.descricao : ''}`;
        }
        let texto = `${t.tipo} - R$ ${valStr} - ${dataStr}`;
        if (t.descricao) {
            texto += ` - ${t.descricao}`;
        }
        return texto;
    }

    solicitarExclusao() {
        if (this.solicitacaoExclusao !== null) {
            throw new Error("Já existe uma solicitação ativa para esta conta.");
        }
        this.solicitacaoExclusao = {
            numero_conta: this.numero,
            titular: this.titular,
            tipo_conta: this.constructor.name,
            data: `${formatarData()} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            status: 'pendente'
        };
        Administrador.adicionarSolicitacao(this.solicitacaoExclusao);
    }
}

class ContaCorrente extends Conta {
    constructor(titular, endereco, cpf, senha) {
        super(titular, endereco, cpf, senha, "CC");
        this.limiteOriginal = 100.00;
        this.limite = 100.00;
        this.tipoConta = "CORRENTE";
        Administrador.adicionarContaCorrente(this);
    }
}

class ContaPoupanca extends Conta {
    constructor(titular, endereco, cpf, senha) {
        super(titular, endereco, cpf, senha, "CP");
        this.tipoConta = "POUPANÇA";
        this.taxaRendimento = 0.005;
        Administrador.adicionarContaPoupanca(this);
    }
}

// --- ADMINISTRADOR ---
const Administrador = {
    usuario: "Admin",
    codigo: "000",

    todasContas() {
        return [...Banco.contasCorrente, ...Banco.contaPoupanca];
    },

    buscarConta(numero) {
        numero = String(numero).trim().toUpperCase();
        return this.todasContas().find(c => c.numero.toUpperCase() === numero) || null;
    },

    verificaSeExisteCadastro(numero, agencia) {
        const conta = this.buscarConta(numero);
        if (conta && conta.agencia === String(agencia).trim()) {
            return conta;
        }
        return null;
    },

    adicionarContaCorrente(conta) {
        Banco.contasCorrente.push(conta);
    },

    adicionarContaPoupanca(conta) {
        Banco.contaPoupanca.push(conta);
    },

    excluirContas(numero) {
        const conta = this.buscarConta(numero);
        if (!conta) throw new Error("Conta não encontrada.");
        if (conta instanceof ContaCorrente) {
            Banco.contasCorrente = Banco.contasCorrente.filter(c => c !== conta);
        } else {
            Banco.contaPoupanca = Banco.contaPoupanca.filter(c => c !== conta);
        }
    },

    adicionarSolicitacao(solicitacao) {
        if (Banco.solicitacoesPendentes.some(s => s.numero_conta === solicitacao.numero_conta)) {
            throw new Error("Já existe solicitação pendente para esta conta.");
        }
        Banco.solicitacoesPendentes.push(solicitacao);
    },

    listarSolicitacoes() {
        return Banco.solicitacoesPendentes.map((s, idx) =>
            `ID: ${idx + 1} | Conta: ${s.numero_conta} | Titular: ${s.titular} | Tipo: ${s.tipo_conta} | Data: ${s.data}`
        );
    },

    aprovarExclusao(id) {
        const index = id - 1;
        if (index < 0 || index >= Banco.solicitacoesPendentes.length) {
            throw new Error("ID de solicitação inválido.");
        }
        const solicitacao = Banco.solicitacoesPendentes.splice(index, 1)[0];
        const conta = this.buscarConta(solicitacao.numero_conta);
        if (conta) {
            conta.solicitacaoExclusao = null;
            this.excluirContas(solicitacao.numero_conta);
        }
        return `Conta ${solicitacao.numero_conta} excluída com sucesso.`;
    },

    rejeitarExclusao(id) {
        const index = id - 1;
        if (index < 0 || index >= Banco.solicitacoesPendentes.length) {
            throw new Error("ID de solicitação inválido.");
        }
        const solicitacao = Banco.solicitacoesPendentes.splice(index, 1)[0];
        const conta = this.buscarConta(solicitacao.numero_conta);
        if (conta) conta.solicitacaoExclusao = null;
        return `Solicitação da conta ${solicitacao.numero_conta} rejeitada.`;
    },

    cancelarSolicitacao(numeroConta) {
        const index = Banco.solicitacoesPendentes.findIndex(s => s.numero_conta === numeroConta);
        if (index === -1) throw new Error("Não existe solicitação pendente para esta conta.");
        Banco.solicitacoesPendentes.splice(index, 1);
    },

    verificarStatusExclusao(numeroConta) {
        const pendente = Banco.solicitacoesPendentes.some(s => s.numero_conta === numeroConta);
        return pendente ? "Solicitação em análise (pendente)" : "Conta ativa (sem solicitação)";
    },

    alterarEnderecoPorNome(titular, novoEndereco, cpf) {
        novoEndereco = validarEndereco(novoEndereco);
        const cpfFormatado = validarFormatarCPF(cpf);
        let alteradas = 0;
        this.todasContas().forEach(c => {
            if (c.titular.toUpperCase() === titular.toUpperCase() && c.cpf === cpfFormatado) {
                c.endereco = novoEndereco;
                alteradas++;
            }
        });
        return alteradas;
    }
};

// --- OPERAÇÕES FINANCEIRAS ---
function executarDeposito(conta, valor, data = new Date(), desc = "") {
    if (valor <= 0) throw new Error("O valor do depósito deve ser positivo.");
    let valorOriginal = valor;
    if (conta instanceof ContaCorrente) {
        let deficit = conta.limiteOriginal - conta.limite;
        if (deficit > 0) {
            let recomposicao = Math.min(valor, deficit);
            conta.limite += recomposicao;
            valor -= recomposicao;
        }
    }
    conta.saldo += valor;
    conta.adicionarTransacao("Depósito", valorOriginal, data, desc);
}

function executarSaqueInterno(conta, valor, data = new Date(), permitirCheque = true, tipoTransacao = "Saque") {
    if (valor <= 0) return { sucesso: false, usado: 0 };
    if (conta instanceof ContaPoupanca) {
        if (valor > conta.saldo) return { sucesso: false, usado: 0 };
        conta.saldo -= valor;
        conta.adicionarTransacao(tipoTransacao, valor, data);
        return { sucesso: true, usado: 0 };
    }
    if (valor <= conta.saldo) {
        conta.saldo -= valor;
        conta.adicionarTransacao(tipoTransacao, valor, data);
        return { sucesso: true, usado: 0 };
    }
    let valorCheque = valor - conta.saldo;
    if (!permitirCheque || valorCheque > conta.limite) {
        return { sucesso: false, usado: valorCheque };
    }
    conta.saldo -= valor;
    conta.limite -= valorCheque;
    conta.adicionarTransacao(
        tipoTransacao === "Saque"
            ? "Saque com cheque especial"
            : tipoTransacao,
        valor,
        data,
        `Cheque especial utilizado: R$ ${formatarMoeda(valorCheque)}`
    );
    return { sucesso: true, usado: valorCheque };
}

function gerarRendimentosPoupanca(conta, dataInicial, dataFinal) {
    let projetados = [];
    conta.historico.forEach(t => {
        if (!["Depósito", "Transferência recebida"].includes(t.tipo)) return;
        let origem = new Date(t.data);
        let valor = t.valor;
        let ciclo = 1;
        while (true) {
            let aniversario = new Date(origem);
            aniversario.setDate(aniversario.getDate() + 30 * ciclo);
            if (aniversario > dataFinal) break;
            if (aniversario >= dataInicial) {
                let rendimento = valor * conta.taxaRendimento;
                projetados.push({
                    tipo: "Rendimento projetado",
                    valor: rendimento,
                    data: aniversario,
                    descricao: `Origem: ${formatarData(origem)}`
                });
            }
            ciclo++;
        }
    });
    return projetados;
}

function gerarTaxasCorrente(conta, dataInicial, dataFinal) {
    let taxas = [];
    let ano = dataInicial.getFullYear();
    let mes = dataInicial.getMonth();
    let dataTaxa = new Date(ano, mes, 5);
    if (dataTaxa < dataInicial) {
        if (mes === 11) dataTaxa = new Date(ano + 1, 0, 5);
        else dataTaxa = new Date(ano, mes + 1, 5);
    }
    while (dataTaxa <= dataFinal) {
        taxas.push({
            tipo: "Taxa de manutenção projetada",
            valor: conta.TAXA_MANUTENCAO,
            data: new Date(dataTaxa),
            descricao: "Projeção"
        });
        if (dataTaxa.getMonth() === 11) dataTaxa = new Date(dataTaxa.getFullYear() + 1, 0, 5);
        else dataTaxa = new Date(dataTaxa.getFullYear(), dataTaxa.getMonth() + 1, 5);
    }
    return taxas;
}

// --- TELA DE ERRO (Evita alerts e retorna à anterior) ---
function mostrarErro(mensagem, telaRetorno = 'tela-principal') {
    Banco.telaAnterior = telaRetorno;
    let errScreen = document.getElementById('tela-erro');
    if (!errScreen) {
        errScreen = document.createElement('div');
        errScreen.id = 'tela-erro';
        errScreen.className = 'screen';
        document.querySelector('.app-window').appendChild(errScreen);
    }
    errScreen.innerHTML = `
        <img src="logo.png" alt="Logo Banco" class="logo-app">
        <h2>ATENÇÃO / ERRO</h2>
        <p style="text-align: center; color: #D26060; margin: 15px 0; font-weight: bold; font-size: 13px;">${mensagem}</p>
        <button class="btn-secondary" onclick="nav(Banco.telaAnterior)">VOLTAR</button>
    `;
    nav('tela-erro');
}

// --- NAVEGAÇÃO DE TELAS ---
function nav(telaId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(telaId);
    if (target) target.classList.add('active');
}

// --- ABERTURA DE CONTA ---
function prepararAbertura(tipo) {
    Banco.tipoAbertura = tipo;
    document.getElementById('abertura-titulo').innerText = tipo === 'CC' ? 'ABERTURA DE CONTA CORRENTE' : 'ABERTURA DE CONTA POUPANÇA';
    ['cad-nome', 'cad-endereco', 'cad-cpf', 'cad-senha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    nav('tela-abertura-form');
}

function criarConta() {
    try {
        const nome = document.getElementById('cad-nome').value;
        const end = document.getElementById('cad-endereco').value;
        const cpf = document.getElementById('cad-cpf').value;
        const senha = document.getElementById('cad-senha').value;

        let novaConta = Banco.tipoAbertura === 'CC' ?
            new ContaCorrente(nome, end, cpf, senha) :
            new ContaPoupanca(nome, end, cpf, senha);

        Banco.contaLogada = novaConta;

        document.getElementById('msg-boas-vindas').innerText = `${novaConta.titular}, é um prazer ter você com a gente.`;
        document.getElementById('sucesso-agencia').value = novaConta.agencia;
        document.getElementById('sucesso-conta').value = novaConta.numero;

        nav('tela-abertura-sucesso');
    } catch (err) {
        mostrarErro(err.message, 'tela-abertura-form');
    }
}

// --- LOGIN CLIENTE ---
function efetuarLogin() {
    try {
        const agencia = document.getElementById('login-agencia').value.trim();
        const numero = document.getElementById('login-conta').value.trim().toUpperCase();
        const senha = document.getElementById('login-senha').value.trim();

        if (!agencia || !numero || !senha) {
            throw new Error("Todos os campos devem ser preenchidos.");
        }

        const conta = Administrador.verificaSeExisteCadastro(numero, agencia);

        if (!conta || conta.senha !== senha) {
            throw new Error("Dados incorretos ou conta não encontrada.");
        }

        // Login do cliente
        Banco.contaLogada = conta;

        // Limpa apenas os campos do login do cliente
        document.getElementById('login-conta').value = '';
        document.getElementById('login-senha').value = '';

        atualizarDashboard();

    } catch (err) {
        mostrarErro(err.message, 'tela-login-cliente');
    }
}


// --- LOGIN ADMINISTRADOR ---
function loginAdmin() {
    try {
        const cod = document.getElementById('login-admin-cod').value;

        if (cod !== Administrador.codigo) {
            throw new Error("Código de administrador incorreto.");
        }

        nav('tela-admin');

    } catch (err) {
        mostrarErro(err.message, 'tela-login-admin');
    }
}

// --- DASHBOARD CLIENTE ---
function atualizarDashboard() {
    const c = Banco.contaLogada;
    document.getElementById('dash-nome').innerText = `BEM-VINDO(A),\n${c.titular}`;
    document.getElementById('dash-saldo').innerText = `R$ ${formatarMoeda(c.saldo)}`;

    const labelLimite = document.getElementById('dash-limite');
    if (c.tipoConta === "CORRENTE") {
        labelLimite.innerText = `Cheque Especial: R$ ${formatarMoeda(c.limite)}`;
    } else {
        labelLimite.innerText = "";
    }

    nav('tela-cliente');
}

// --- TRANSAÇÕES ---
function efetuarDeposito() {
    try {
        const val = parseFloat(document.getElementById('val-deposito').value);
        if (isNaN(val) || val <= 0) throw new Error("Valor inválido.");

        executarDeposito(Banco.contaLogada, val, new Date(), "Depósito web");
        document.getElementById('val-deposito').value = "";
        atualizarDashboard();
    } catch (err) {
        mostrarErro(err.message, 'tela-deposito');
    }
}

function efetuarSaque() {
    try {
        const val = parseFloat(document.getElementById('val-saque').value);
        if (isNaN(val) || val <= 0) throw new Error("Valor inválido.");

        let c = Banco.contaLogada;
        let permitirCheque = true;

        if (c instanceof ContaCorrente && val > c.saldo) {
            let necessario = val - c.saldo;
            if (necessario > c.limite) throw new Error("Saldo + Cheque Especial insuficientes.");
            if (!confirm(`Será utilizado R$ ${formatarMoeda(necessario)} do Cheque Especial. Continuar?`)) return;
        }

        let res = executarSaqueInterno(c, val, new Date(), permitirCheque);
        if (!res.sucesso) throw new Error("Saldo insuficiente.");

        document.getElementById('val-saque').value = "";
        atualizarDashboard();
    } catch (err) {
        mostrarErro(err.message, 'tela-saque');
    }
}

function efetuarTransferencia() {
    try {
        const numDestino = document.getElementById('val-transf-conta').value.trim().toUpperCase();
        const val = parseFloat(document.getElementById('val-transf').value);

        if (isNaN(val) || val <= 0) throw new Error("Valor inválido.");

        let cOrigem = Banco.contaLogada;
        if (numDestino === cOrigem.numero) throw new Error("Não pode transferir para si mesmo.");

        let cDestino = Administrador.buscarConta(numDestino);
        if (!cDestino) throw new Error("Conta destino não encontrada.");

        let permitirCheque = true;
        if (cOrigem instanceof ContaCorrente && val > cOrigem.saldo) {
            let necessario = val - cOrigem.saldo;
            if (necessario > cOrigem.limite) throw new Error("Saldo insuficiente.");
            if (!confirm(`Será utilizado R$ ${formatarMoeda(necessario)} do Cheque Especial. Continuar?`)) return;
        }

        let res = executarSaqueInterno(
            cOrigem,
            val,
            new Date(),
            permitirCheque,
            "Transferência enviada"
        );
        if (!res.sucesso) throw new Error("Saldo insuficiente.");

        cDestino.saldo += val;
        cDestino.adicionarTransacao("Transferência recebida", val, new Date(), `De: ${cOrigem.numero}`);
        cOrigem.historico[cOrigem.historico.length - 1].descricao += ` | Para: ${cDestino.numero}`;

        document.getElementById('val-transf-conta').value = "";
        document.getElementById('val-transf').value = "";
        atualizarDashboard();
    } catch (err) {
        mostrarErro(err.message, 'tela-transferencia');
    }
}

// --- EXTRATO COM FILTROS E PROJEÇÕES ---
function gerarExtrato() {
    renderizarExtrato();
    nav('tela-extrato');
}

function renderizarExtrato(listaTransacoes = null) {
    const c = Banco.contaLogada;
    let html = `Ag: ${c.agencia} | CC: ${c.numero}\nTitular: ${c.titular}\nSaldo: R$ ${formatarMoeda(c.saldo)}\n`;

    if (c instanceof ContaCorrente) {
        html += `Cheque Especial: R$ ${formatarMoeda(c.limite)}\n`;
    }

    html += `\nHistórico:\n=====================\n`;

    let transacoes = listaTransacoes || c.historico;
    if (transacoes.length === 0) {
        html += "Nenhuma transação.\n";
    } else {
        [...transacoes].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(t => {
            html += `• ${c.formatarTransacao(t)}\n`;
        });
    }

    const box = document.getElementById('extrato-box');
    if (box) box.innerText = html;
}

function aplicarFiltroExtrato() {
    try {
        const ini = document.getElementById('extrato-ini').value;
        const fim = document.getElementById('extrato-fim').value;
        if (!ini || !fim) throw new Error("Preencha ambas as datas.");

        const dataIni = parseData(ini);
        const dataFim = parseData(fim);
        if (dataIni > dataFim) throw new Error("Data inicial maior que a final.");

        let c = Banco.contaLogada;
        let transacoes = c.historico.filter(t => {
            let d = new Date(t.data);
            return d >= dataIni && d <= dataFim;
        });

        let saldoProjetado = c.saldo;
        if (c instanceof ContaCorrente) {
            let taxas = gerarTaxasCorrente(c, dataIni, dataFim);
            transacoes.push(...taxas);
            saldoProjetado -= taxas.reduce((acc, t) => acc + t.valor, 0);
            transacoes.push({ tipo: "Saldo projetado", valor: saldoProjetado, data: dataFim, descricao: "Após taxas" });
        } else if (c instanceof ContaPoupanca) {
            let rendimentos = gerarRendimentosPoupanca(c, dataIni, dataFim);
            transacoes.push(...rendimentos);
            let totalRend = rendimentos.reduce((acc, t) => acc + t.valor, 0);
            saldoProjetado += totalRend;
            transacoes.push({ tipo: "Rendimento total projetado", valor: totalRend, data: dataFim, descricao: "No período" });
            transacoes.push({ tipo: "Saldo projetado", valor: saldoProjetado, data: dataFim, descricao: "Com rendimentos" });
        }

        renderizarExtrato(transacoes);
    } catch (err) {
        mostrarErro(err.message, 'tela-extrato');
    }
}

function limparFiltroExtrato() {
    if (document.getElementById('extrato-ini')) document.getElementById('extrato-ini').value = '';
    if (document.getElementById('extrato-fim')) document.getElementById('extrato-fim').value = '';
    renderizarExtrato();
}

// --- ADMIN ---
function listarContasAdmin() {
    const contas = Administrador.todasContas();
    if (contas.length === 0) {
        mostrarErro("Nenhuma conta cadastrada.", 'tela-admin');
        return;
    }
    let relatorio = "CONTAS CADASTRADAS:\n\n";
    contas.forEach(c => {
        relatorio += `${c.tipoConta} | ${c.numero} | ${c.titular} | Saldo: R$ ${formatarMoeda(c.saldo)}\n`;
    });
    alert(relatorio);
}

// Conta de teste inicial
window.onload = function () {
    try {
        let contaTeste = new ContaCorrente("João Teste", "Rua A, 123", "12345678901", "123456");
        console.log(`Conta de teste: Ag: 0219 | CC: ${contaTeste.numero} | Senha: 123456`);
    } catch (e) {
        console.error(e);
    }
};

let introTimer;
let countdown = 15;

function skipIntro() {
    clearInterval(introTimer);
    nav('tela-principal');
}

introTimer = setInterval(() => {
    countdown--;

    const counter = document.getElementById("intro-countdown");

    if (counter) {
        counter.textContent = countdown;
    }

    if (countdown <= 0) {
        clearInterval(introTimer);
        skipIntro();
    }
}, 1000);


function abrirGerenciamentoContas() {
    const lista = document.getElementById('lista-contas-admin');

    lista.innerHTML = '';

    const contas = [
        ...Banco.contasCorrente,
        ...Banco.contaPoupanca
    ];

    if (contas.length === 0) {
        lista.innerHTML = `
            <div class="card">
                <p>Nenhuma conta cadastrada.</p>
            </div>
        `;

        nav('tela-gerenciar-contas');
        return;
    }

    contas.forEach(conta => {

        const tipo = conta.tipoConta === 'CORRENTE'
            ? 'Conta Corrente'
            : 'Conta Poupança';

        const card = document.createElement('div');
        card.className = 'conta-admin-card';

        card.innerHTML = `
            <h3>${conta.titular}</h3>

            <div class="conta-admin-info">
                <strong>Tipo:</strong> ${tipo}
            </div>

            <div class="conta-admin-info">
                <strong>Agência:</strong> ${conta.agencia}
            </div>

            <div class="conta-admin-info">
                <strong>Conta:</strong> ${conta.numero}
            </div>

            <div class="conta-admin-info">
                <strong>Saldo:</strong>
                R$ ${formatarMoeda(conta.saldo)}
            </div>

            <div class="conta-admin-acoes">

                <button
                    class="btn-primary"
                    onclick="verDetalhesContaAdmin('${conta.numero}')"
                >
                    DETALHES
                </button>

                <button
                    class="btn-danger"
                    onclick="excluirContaAdmin('${conta.numero}')"
                >
                    EXCLUIR
                </button>

            </div>
        `;

        lista.appendChild(card);
    });

    nav('tela-gerenciar-contas');
}

function excluirContaAdmin(numero) {

    const confirmar = confirm(
        `Deseja realmente excluir a conta ${numero}?`
    );

    if (!confirmar) {
        return;
    }

    const indiceCorrente = Banco.contasCorrente.findIndex(
        conta => conta.numero === numero
    );

    if (indiceCorrente !== -1) {
        Banco.contasCorrente.splice(indiceCorrente, 1);
        alert("Conta corrente excluída com sucesso.");
        abrirGerenciamentoContas();
        return;
    }

    const indicePoupanca = Banco.contaPoupanca.findIndex(
        conta => conta.numero === numero
    );

    if (indicePoupanca !== -1) {
        Banco.contaPoupanca.splice(indicePoupanca, 1);
        alert("Conta poupança excluída com sucesso.");
        abrirGerenciamentoContas();
        return;
    }

    alert("Conta não encontrada.");
}

function verDetalhesContaAdmin(numero) {

    const conta =
        Banco.contasCorrente.find(c => c.numero === numero) ||
        Banco.contaPoupanca.find(c => c.numero === numero);

    if (!conta) {
        alert("Conta não encontrada.");
        return;
    }

    const tipo = conta.tipoConta === 'CORRENTE'
        ? 'Conta Corrente'
        : 'Conta Poupança';

    alert(
        `DADOS DA CONTA\n\n` +
        `Titular: ${conta.titular}\n` +
        `CPF: ${conta.cpf}\n` +
        `Endereço: ${conta.endereco}\n` +
        `Tipo: ${tipo}\n` +
        `Agência: ${conta.agencia}\n` +
        `Conta: ${conta.numero}\n` +
        `Saldo: R$ ${formatarMoeda(conta.saldo)}`
    );
}