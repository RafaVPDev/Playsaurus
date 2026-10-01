/**
 * Configuração específica das auditorias Playwright.
 *
 * O loader normal de projetos não lê nem valida auditoria.json. Este módulo só
 * é acionado pelos comandos/configs de auditoria, mantendo build, preview, PDF
 * e publicação independentes das regras de QA.
 */
const fs = require('node:fs');
const path = require('node:path');

function erro(mensagem) {
  const e = new Error(mensagem);
  e.projetoInvalido = true;
  return e;
}

function normalizarRotas(rotas, fallback = []) {
  const lista = Array.isArray(rotas) ? rotas : fallback;
  return [
    ...new Set(
      lista
        .filter((rota) => typeof rota === 'string' && rota.startsWith('/') && !rota.startsWith('//'))
        .map((rota) => rota.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizarSelector(valor, fallback) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : fallback;
}

/** Acrescenta configuração e caminhos de auditoria a um projeto já carregado. */
function anexarAuditoria(projeto, auditoriaLegada = {}) {
  const arquivoAuditoria = path.join(projeto.dir, 'auditoria.json');
  let auditoriaArquivo = {};

  if (fs.existsSync(arquivoAuditoria)) {
    try {
      auditoriaArquivo = JSON.parse(fs.readFileSync(arquivoAuditoria, 'utf8'));
    } catch (e) {
      throw erro(`auditoria.json de "${projeto.id}" não é um JSON válido: ${e.message}`);
    }
    if (!auditoriaArquivo || Array.isArray(auditoriaArquivo) || typeof auditoriaArquivo !== 'object') {
      throw erro(`auditoria.json de "${projeto.id}" precisa conter um objeto JSON.`);
    }
  }

  const auditoriaBruta = {
    ...(auditoriaLegada || {}),
    ...auditoriaArquivo,
    login: {
      ...(auditoriaLegada?.login || {}),
      ...(auditoriaArquivo.login || {}),
    },
  };
  const idMaiusculo = projeto.id.toUpperCase().replace(/-/g, '_');
  const perfisBrutos = Array.isArray(auditoriaBruta.perfis) && auditoriaBruta.perfis.length
    ? auditoriaBruta.perfis
    : [
        {
          id: 'padrao',
          rotulo: 'Conta de demonstração',
          envEmail: `${idMaiusculo}_TEST_USER_EMAIL`,
          envPassword: `${idMaiusculo}_TEST_USER_PASSWORD`,
        },
      ];

  const perfis = perfisBrutos.map((perfil) => {
    if (!perfil.id || !/^[a-z0-9][a-z0-9-]*$/.test(perfil.id)) {
      throw erro(`auditoria de "${projeto.id}": cada perfil precisa de um id simples (a-z, 0-9 e hífen).`);
    }
    if (!perfil.rotulo || !perfil.envEmail || !perfil.envPassword) {
      throw erro(`auditoria de "${projeto.id}": cada perfil precisa de "rotulo", "envEmail" e "envPassword".`);
    }
    return {
      ...perfil,
      rotas: Array.isArray(perfil.rotas) ? perfil.rotas : undefined,
      rotasProibidas: Array.isArray(perfil.rotasProibidas) ? perfil.rotasProibidas : [],
      menusVisiveis: Array.isArray(perfil.menusVisiveis) ? perfil.menusVisiveis : [],
      menusOcultos: Array.isArray(perfil.menusOcultos) ? perfil.menusOcultos : [],
      textosEsperados: Array.isArray(perfil.textosEsperados) ? perfil.textosEsperados : [],
      textosProibidos: Array.isArray(perfil.textosProibidos) ? perfil.textosProibidos : [],
    };
  });

  if (new Set(perfis.map((perfil) => perfil.id)).size !== perfis.length) {
    throw erro(`auditoria de "${projeto.id}": existem ids de perfil duplicados.`);
  }

  const loginBruto = auditoriaBruta.login || {};
  const login = {
    rota:
      typeof loginBruto.rota === 'string' && loginBruto.rota.startsWith('/') && !loginBruto.rota.startsWith('//')
        ? loginBruto.rota
        : '/login',
    emailSelector: normalizarSelector(
      loginBruto.emailSelector,
      'input[type="email"], input[name="email"], input[autocomplete="username"], input[placeholder*="email" i], input[placeholder*="utilizador" i]',
    ),
    passwordSelector: normalizarSelector(
      loginBruto.passwordSelector,
      'input[type="password"], input[name="password"], input[autocomplete="current-password"]',
    ),
    submitSelector: normalizarSelector(loginBruto.submitSelector, 'form button[type="submit"]'),
    rotaSucesso:
      typeof loginBruto.rotaSucesso === 'string' && loginBruto.rotaSucesso.startsWith('/') && !loginBruto.rotaSucesso.startsWith('//')
        ? loginBruto.rotaSucesso
        : null,
    timeoutMs:
      Number.isFinite(Number(loginBruto.timeoutMs)) && Number(loginBruto.timeoutMs) >= 1_000
        ? Math.min(Number(loginBruto.timeoutMs), 120_000)
        : 20_000,
  };

  const rotas = normalizarRotas(auditoriaBruta.rotas, ['/']);
  const auditoria = {
    ...auditoriaBruta,
    login,
    rotas: rotas.length ? rotas : ['/'],
    menuSelector: normalizarSelector(auditoriaBruta.menuSelector, ''),
    testarPesquisas: auditoriaBruta.testarPesquisas === true,
    ignorarConsole: Array.isArray(auditoriaBruta.ignorarConsole) ? auditoriaBruta.ignorarConsole : [],
    ignorarUrls: Array.isArray(auditoriaBruta.ignorarUrls) ? auditoriaBruta.ignorarUrls : [],
    mensagensAcessoNegado: Array.isArray(auditoriaBruta.mensagensAcessoNegado)
      ? auditoriaBruta.mensagensAcessoNegado
      : [],
    perfis: perfis.map((perfil) => ({
      ...perfil,
      rotaInicial:
        typeof perfil.rotaInicial === 'string' && perfil.rotaInicial.startsWith('/') && !perfil.rotaInicial.startsWith('//')
          ? perfil.rotaInicial
          : '/',
      rotas: perfil.rotas ? normalizarRotas(perfil.rotas) : undefined,
      rotasProibidas: normalizarRotas(perfil.rotasProibidas),
      menusVisiveis: perfil.menusVisiveis.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
      menusOcultos: perfil.menusOcultos.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
      textosEsperados: perfil.textosEsperados.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
      textosProibidos: perfil.textosProibidos.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
    })),
  };

  const dirAuditoria = path.join(projeto.dirTrabalho, 'auditoria');
  return {
    ...projeto,
    auditoria,
    arquivoAuditoria,
    dirAuthAuditoria: path.join(projeto.dirTrabalho, 'auth', 'auditoria'),
    arquivoAuthPerfil: (perfilId) => path.join(projeto.dirTrabalho, 'auth', 'auditoria', `${perfilId}.json`),
    dirResultadosAuditoria: path.join(dirAuditoria, 'tecnica', 'test-results'),
    dirRelatorioHtmlAuditoria: path.join(dirAuditoria, 'tecnica', 'report'),
    dirAuditoriaEtapa: (etapa) => path.join(dirAuditoria, etapa),
    dirRelatorioAuditoria: path.join(projeto.dirOutput, 'auditoria'),
  };
}

function carregarProjetoAuditoria(id) {
  const { carregarProjeto } = require('../../compartilhado/projeto.cjs');
  return anexarAuditoria(carregarProjeto(id));
}

function projetoAuditoriaAtivo() {
  return carregarProjetoAuditoria(process.env.DOC_PROJETO);
}

module.exports = { anexarAuditoria, carregarProjetoAuditoria, projetoAuditoriaAtivo };
