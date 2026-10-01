/**
 * Painel local da documentação.
 *
 * Uso: npm run painel
 *
 * Sobe uma página em http://127.0.0.1:4321 para escolher o produto, conferir
 * onde está o repositório dele nesta máquina e disparar screenshots, build e
 * publicação — com o log aparecendo ao vivo.
 *
 * Só módulos nativos do Node: o painel não deve adicionar dependência nenhuma
 * à instalação compartilhada.
 *
 * Segurança: o painel executa comandos, então escuta apenas em 127.0.0.1, checa
 * o cabeçalho Host (contra DNS rebinding) e só aceita ações e projetos de uma
 * lista fechada — nada vindo da requisição vira comando.
 */
import { createServer } from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  RAIZ,
  listarProjetos,
  carregarProjeto,
  resolverRepositorio,
  salvarCaminhoLocal,
  lerPastaBase,
  salvarPastaBase,
  definirPublicacaoSecao,
  salvarUrlPublica,
} = require('../compartilhado/projeto.cjs');
const {
  SECOES_PADRAO,
  criarProjeto,
  excluirProjeto,
  repositoriosCandidatos,
} = require('../compartilhado/novo-projeto.cjs');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIR_PAINEL = path.resolve(aqui, '..', 'painel');
const HOST = '127.0.0.1';
const PORTA_INICIAL = Number(process.env.PORT) || 4321;

/** Ações permitidas — o cliente escolhe pelo nome, nunca monta o comando. */
const ACOES = {
  screenshots: { script: 'screenshots.mjs', titulo: 'Gerando screenshots' },
  build: { script: 'build.mjs', titulo: 'Gerando build' },
  publicar: { script: 'publicar.mjs', titulo: 'Publicando' },
  'exportar-pdf': { script: 'exportar-pdf.mjs', titulo: 'Exportando PDF' },
};

const FERRAMENTAS = new Set([
  'abrir-projeto',
  'abrir-output',
  'limpar-cache',
  'limpar-builds',
]);

let emExecucao = null;

// --------------------------------------------------------------- pré-visualização
//
// Diferente das ações one-shot (screenshots/build/publicar), a pré-visualização
// sobe um servidor standalone que fica no ar. Por isso vive fora do fluxo de SSE
// e do guard `emExecucao`: um servidor persistente, um por vez.

let preview = null; // { proc, id, port, url }

/** Descobre uma porta livre pedindo a porta 0 ao SO e devolvendo a que ele deu. */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const sonda = net.createServer();
    sonda.on('error', reject);
    sonda.listen(0, HOST, () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  });
}

/** Espera a porta aceitar conexão — sinal de que o serve está pronto. */
function esperarPorta(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const tentar = () => {
      const s = net.connect(port, HOST);
      s.once('connect', () => {
        s.destroy();
        resolve();
      });
      s.once('error', () => {
        s.destroy();
        if (Date.now() - inicio > timeout) reject(new Error('tempo esgotado'));
        else setTimeout(tentar, 250);
      });
    };
    tentar();
  });
}

function pararPreview() {
  if (preview?.proc && !preview.proc.killed) preview.proc.kill();
  preview = null;
}


/** Executa um script Node curto e espera terminar. */
function executarNode(script, args, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [script, ...args], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let erro = '';
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk) => { erro += chunk; });
    proc.on('error', reject);
    proc.on('close', (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(erro.trim() || `Compactação standalone terminou com código ${codigo}`));
    });
  });
}

/** Sobe (ou re-sobe) a pré-visualização de um projeto e devolve a URL. */
async function iniciarPreview(id, modo = 'interno') {
  const projeto = carregarProjeto(id);
  // O build Markdown agora é rápido e não tem etapa intermediária. Regeramos
  // antes do preview para que a janela sempre reflita docs/runtime atuais.
  pararPreview();
  await executarNode(
    path.join(aqui, 'build.mjs'),
    [id],
    { ...process.env, DOC_PROJETO: id, FORCE_COLOR: '0' },
  );

  const dir = modo === 'publico' ? projeto.dirBuildCliente : projeto.dirBuild;
  if (!existsSync(dir)) {
    const e = new Error(`Build de ${id} não foi gerado.`);
    e.status = 400;
    throw e;
  }

  const port = await portaLivre();
  const env = { ...process.env, DOC_PROJETO: id, DOC_MODO: modo, FORCE_COLOR: '0', PORT: String(port) };
  const proc = spawn(process.execPath, [path.join(aqui, 'serve.mjs'), id], { cwd: RAIZ, env });

  // `baseUrl` já vem com barra final (validada no carregamento).
  const atual = { proc, id, modo, port, url: `http://${HOST}:${port}${projeto.baseUrl}` };
  preview = atual;
  const limpar = () => {
    if (preview === atual) preview = null;
  };
  proc.on('exit', limpar);
  proc.on('error', limpar);

  await esperarPorta(port).catch(() => {}); // se demorar, devolve a URL mesmo assim
  return atual.url;
}

// ------------------------------------------------------------------ estado

const SUFIXO_ROTEIRO = '.jornada.spec.ts';

/** Roteiros de vídeo (*.jornada.spec.ts) sob playwright/, em caminho relativo posix. */
function listarRoteiros(dirPlaywright) {
  const achados = [];
  const varrer = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) varrer(p);
      else if (entry.name.endsWith(SUFIXO_ROTEIRO)) {
        achados.push(path.relative(dirPlaywright, p).split(path.sep).join('/'));
      }
    }
  };
  varrer(dirPlaywright);
  return achados;
}

function estadoDosProjetos() {
  return listarProjetos().map((id) => {
    try {
      const projeto = carregarProjeto(id);
      const repo = resolverRepositorio(projeto);

      // O caminho versionado no projeto.json. Serve de referência: publicar em
      // uma pasta diferente dela é legítimo (cada máquina organiza como quer),
      // mas é também o jeito de apagar o public/docs do produto errado — então
      // a divergência vira aviso em vez de passar batido.
      const padrao = projeto.repositorio?.relativo
        ? path.resolve(RAIZ, projeto.repositorio.relativo)
        : null;

      // A Arquitetura é a única seção com publicação opcional (interna). Se o
      // projeto a tiver, o painel mostra o check; `null` esconde o controle.
      const arquitetura = projeto.secoes.find((s) => s.id === 'arquitetura');

      return {
        id,
        nome: projeto.nome,
        tagline: projeto.tagline ?? '',
        baseUrl: projeto.baseUrl,
        url: projeto.url,
        urlPublica: projeto.urlPublica ?? null,
        secoes: projeto.secoes.map((s) => s.rotulo),
        arquiteturaPublicar: arquitetura ? arquitetura.publicar !== false : null,
        destino: projeto.repositorio?.destino ?? 'public/docs',
        env: projeto.repositorio?.env ?? null,
        caminho: repo.caminho,
        origem: repo.origem,
        detalhe: repo.detalhe,
        padrao,
        foraDoPadrao: Boolean(padrao && repo.caminho && path.relative(padrao, repo.caminho) !== ''),
        existe: repo.caminho ? existsSync(repo.caminho) : false,
        temEnv: existsSync(projeto.arquivoEnv),
        temBuild: existsSync(projeto.dirBuild),
        temBuildCliente: existsSync(projeto.dirBuildCliente),
        idiomas: projeto.idiomas.disponiveis.map((i) => i.rotulo),
        traducoesObrigatorias: projeto.idiomas.exigirTraducoes === true,
      };
    } catch (e) {
      return { id, erro: e.message };
    }
  });
}

// ------------------------------------------------------------------ helpers

function json(res, dados, status = 200) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(corpo);
}

function hostConfiavel(req) {
  const host = (req.headers.host || '').split(':')[0];
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

async function lerCorpo(req, limite = 64 * 1024) {
  let dados = '';
  for await (const pedaco of req) {
    dados += pedaco;
    if (dados.length > limite) throw new Error('Corpo da requisição grande demais.');
  }
  return dados ? JSON.parse(dados) : {};
}

// ------------------------------------------------------------------ execução

/**
 * Roda um script de scripts/ repassando a saída por Server-Sent Events.
 * `arg` é um parâmetro opcional do script. Não vira comando: entra como
 * argumento do processo (spawn sem shell) e o próprio script faz a validação.
 */
function executarComStream(res, acao, id, modo, arg) {
  const { script, titulo, args: argsFixos = [] } = ACOES[acao];

  // Uma pré-visualização do mesmo projeto segura os arquivos de output/; no
  // Windows o build falharia ao sobrescrevê-los. Encerra o serve antes.
  if (preview && preview.id === id) pararPreview();

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });

  const enviar = (tipo, dados) =>
    res.write(`event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`);

  if (emExecucao) {
    enviar('linha', `Já existe uma tarefa rodando (${emExecucao}). Aguarde terminar.`);
    enviar('fim', { codigo: 1 });
    return res.end();
  }

  emExecucao = `${acao}/${id}`;
  const sufixo = modo === 'publico' ? ' (cliente)' : '';
  enviar('inicio', { titulo: `${titulo}${sufixo} — ${id}` });

  const filho = spawn(process.execPath, [path.join(aqui, script), id, ...argsFixos, ...(arg ? [arg] : [])], {
    cwd: RAIZ,
    env: { ...process.env, FORCE_COLOR: '0', ...(modo ? { DOC_MODO: modo } : {}) },
  });

  const repassar = (fluxo) => {
    let resto = '';
    fluxo.setEncoding('utf8');
    fluxo.on('data', (pedaco) => {
      const linhas = (resto + pedaco).split(/\r?\n/);
      resto = linhas.pop() ?? '';
      for (const linha of linhas) enviar('linha', linha);
    });
    fluxo.on('end', () => {
      if (resto) enviar('linha', resto);
    });
  };
  repassar(filho.stdout);
  repassar(filho.stderr);

  filho.on('error', (e) => {
    enviar('linha', `Falha ao iniciar: ${e.message}`);
  });
  filho.on('close', (codigo) => {
    emExecucao = null;
    enviar('fim', { codigo });
    res.end();
  });

  // Se a aba fechar no meio, não deixa o processo órfão.
  res.on('close', () => {
    if (!filho.killed) filho.kill();
  });
}

// ------------------------------------------------------------------ servidor

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function abrirPasta(caminho) {
  if (process.platform === 'win32') {
    spawn('explorer.exe', [caminho], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [caminho], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [caminho], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function servirEstatico(res, nome) {
  const arquivo = path.join(DIR_PAINEL, nome);
  // Não deixa sair da pasta do painel.
  if (!arquivo.startsWith(DIR_PAINEL)) {
    res.writeHead(403).end('Proibido');
    return;
  }
  try {
    await stat(arquivo);
    const conteudo = await readFile(arquivo);
    res.writeHead(200, {
      'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404).end('Não encontrado');
  }
}

const servidor = createServer(async (req, res) => {
  if (!hostConfiavel(req)) {
    res.writeHead(403).end('Host não permitido');
    return;
  }

  const url = new URL(req.url, `http://${HOST}`);

  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return await servirEstatico(res, 'index.html');
    }

    if (url.pathname === '/api/projetos' && req.method !== 'POST') {
      return json(res, {
        projetos: estadoDosProjetos(),
        raiz: RAIZ,
        pastaBase: lerPastaBase(),
        secoesPadrao: SECOES_PADRAO,
        preview: preview ? { id: preview.id, modo: preview.modo, url: preview.url } : null,
      });
    }

    // Repositórios candidatos dentro da pasta-base, para escolher na lista.
    if (url.pathname === '/api/repositorios') {
      const base = url.searchParams.get('base') || lerPastaBase();
      return json(res, {
        base,
        existe: Boolean(base) && existsSync(base),
        repositorios: repositoriosCandidatos(base),
      });
    }

    if (url.pathname === '/api/base' && req.method === 'POST') {
      const { base } = await lerCorpo(req);
      const salva = salvarPastaBase((base ?? '').trim() || null);
      return json(res, {
        base: salva,
        existe: Boolean(salva) && existsSync(salva),
        repositorios: repositoriosCandidatos(salva),
      });
    }

    if (url.pathname === '/api/projetos' && req.method === 'POST') {
      const dados = await lerCorpo(req);
      const { dir, criados } = criarProjeto(dados);
      console.log(`Projeto "${dados.id}" criado em ${path.relative(RAIZ, dir)} (${criados.length} arquivos)`);
      return json(res, { criado: dados.id, arquivos: criados, projetos: estadoDosProjetos() });
    }

    if (url.pathname === '/api/excluir' && req.method === 'POST') {
      const { id } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      excluirProjeto(id);
      console.log(`Projeto "${id}" excluído.`);
      return json(res, { excluido: id, projetos: estadoDosProjetos() });
    }

    if (url.pathname === '/api/caminho' && req.method === 'POST') {
      const { id, caminho } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      salvarCaminhoLocal(id, (caminho ?? '').trim() || null);
      return json(res, { projetos: estadoDosProjetos() });
    }

    if (url.pathname === '/api/visualizar' && req.method === 'POST') {
      const { id, modo } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      try {
        const endereco = await iniciarPreview(id, modo === 'publico' ? 'publico' : 'interno');
        return json(res, { url: endereco });
      } catch (e) {
        return json(res, { erro: e.message }, e.status || 500);
      }
    }

    // Liga/desliga a publicação de uma seção (hoje só a Arquitetura).
    if (url.pathname === '/api/secao' && req.method === 'POST') {
      const { id, secao, publicar } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      try {
        definirPublicacaoSecao(id, secao, publicar);
        return json(res, { projetos: estadoDosProjetos() });
      } catch (e) {
        return json(res, { erro: e.message }, 400);
      }
    }

    if (url.pathname === '/api/url-publica' && req.method === 'POST') {
      const { id, urlPublica } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      try {
        salvarUrlPublica(id, (urlPublica ?? '').trim() || null);
        return json(res, { projetos: estadoDosProjetos() });
      } catch (e) {
        return json(res, { erro: e.message }, 400);
      }
    }

    if (url.pathname === '/api/visualizar/parar' && req.method === 'POST') {
      pararPreview();
      return json(res, { ok: true });
    }

    if (url.pathname === '/api/ferramenta' && req.method === 'POST') {
      const { id, acao } = await lerCorpo(req);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      if (!FERRAMENTAS.has(acao)) {
        return json(res, { erro: `Ferramenta desconhecida: ${acao}` }, 400);
      }

      const projeto = carregarProjeto(id);
      if (acao === 'abrir-projeto') {
        abrirPasta(projeto.dir);
        return json(res, { ok: true });
      }
      if (acao === 'abrir-output') {
        mkdirSync(projeto.dirOutput, { recursive: true });
        abrirPasta(projeto.dirOutput);
        return json(res, { ok: true });
      }

      if (preview?.id === id) pararPreview();
      if (acao === 'limpar-cache') {
        rmSync(projeto.dirTrabalho, { recursive: true, force: true });
        return json(res, { ok: true, mensagem: 'Cache e temporários removidos.' });
      }
      if (acao === 'limpar-builds') {
        rmSync(projeto.dirBuild, { recursive: true, force: true });
        rmSync(projeto.dirBuildCliente, { recursive: true, force: true });
        return json(res, { ok: true, mensagem: 'Builds interno e cliente removidos.' });
      }
    }

    if (url.pathname === '/api/executar') {
      const acao = url.searchParams.get('acao');
      const id = url.searchParams.get('projeto');
      const modo = url.searchParams.get('modo') === 'publico' ? 'publico' : undefined;
      // Parâmetro opcional do script (ex.: o roteiro de vídeo). Uma linha, curto:
      // o script é quem valida de fato; aqui só barramos abuso óbvio.
      const argBruto = (url.searchParams.get('arg') ?? '').trim();
      const arg = argBruto && argBruto.length <= 200 && !/[\r\n]/.test(argBruto) ? argBruto : undefined;
      if (!ACOES[acao]) return json(res, { erro: `Ação desconhecida: ${acao}` }, 400);
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      return executarComStream(res, acao, id, modo, arg);
    }

    // Lista os roteiros de vídeo (*.jornada.spec.ts) do projeto, para o autocomplete.
    if (url.pathname === '/api/roteiros') {
      const id = url.searchParams.get('projeto');
      if (!listarProjetos().includes(id)) {
        return json(res, { erro: `Projeto desconhecido: ${id}` }, 400);
      }
      try {
        const projeto = carregarProjeto(id);
        return json(res, { roteiros: listarRoteiros(projeto.dirPlaywright) });
      } catch (e) {
        return json(res, { erro: e.message }, 400);
      }
    }

    if (url.pathname.startsWith('/painel/')) {
      return await servirEstatico(res, url.pathname.slice('/painel/'.length));
    }

    res.writeHead(404).end('Não encontrado');
  } catch (e) {
    json(res, { erro: e.message }, 500);
  }
});

function abrirNoNavegador(endereco) {
  // `--sem-navegador` para quem já tem a aba aberta ou está rodando sem sessão gráfica.
  if (process.argv.includes('--sem-navegador')) return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', endereco], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [endereco], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [endereco], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // Abrir o navegador é conveniência: se falhar, o endereço já foi impresso.
  }
}

// Registrado uma única vez, fora do laço de tentativas: um callback passado a
// cada `listen()` sobrevive à tentativa que falhou e dispararia de novo quando
// outra porta desse certo — anunciando (e abrindo no navegador) uma porta morta.
// A porta sai de `address()`, que é a que valeu de fato.
servidor.on('listening', () => {
  const endereco = `http://${HOST}:${servidor.address().port}`;
  console.log(`\nPainel da documentação: ${endereco}`);
  console.log('Ctrl+C para encerrar.\n');
  abrirNoNavegador(endereco);
});

function ouvir(porta, tentativas = 10) {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tentativas > 0) {
      console.log(`Porta ${porta} ocupada, tentando ${porta + 1}...`);
      ouvir(porta + 1, tentativas - 1);
    } else {
      console.error(e.message);
      process.exit(1);
    }
  });
  servidor.listen(porta, HOST);
}

// Não deixa o servidor de pré-visualização órfão quando o painel encerra.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    pararPreview();
    process.exit(0);
  });
}
process.on('exit', pararPreview);

ouvir(PORTA_INICIAL);
