/**
 * Peças compartilhadas pelos scripts de linha de comando.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projetos = require('../compartilhado/projeto.cjs');

export const {
  RAIZ,
  listarProjetos,
  carregarProjeto,
  aplicarModo,
  destinoPublicacao,
  resolverRepositorio,
} = projetos;

/**
 * Descobre o projeto alvo: argumento da linha de comando, DOC_PROJETO ou —
 * quando só existe um projeto instalado — ele mesmo.
 */
export function idDoArgumento(argv = process.argv.slice(2)) {
  const informado = argv.find((a) => !a.startsWith('-'));
  if (informado) return informado;
  if (process.env.DOC_PROJETO) return process.env.DOC_PROJETO;

  const disponiveis = listarProjetos();
  if (disponiveis.length === 1) return disponiveis[0];

  console.error(
    `Informe o projeto. Ex.: npm run build -- meu-projeto\n` +
      `Disponíveis: ${disponiveis.join(', ') || '(nenhum)'}`,
  );
  process.exit(1);
}

/**
 * Caminho dos executáveis, chamados via `node` para não depender de .cmd/shell.
 * Resolvidos sob demanda: um pacote ausente só atrapalha o comando que o usa.
 */
export const BIN = {
  get playwright() {
    return require.resolve('@playwright/test/cli');
  },
};

/** Executa um comando repassando a saída, e rejeita se ele falhar. */
export function executar(comando, args, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(comando, args, {
      cwd: RAIZ,
      stdio: 'inherit',
      ...opcoes,
      env: { ...process.env, ...(opcoes.env || {}) },
    });
    filho.on('error', reject);
    filho.on('close', (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(`${path.basename(comando)} terminou com código ${codigo}`));
    });
  });
}

/** Encerra com mensagem limpa em vez de stack trace, para erros esperados. */
export function encerrarComErro(e) {
  console.error(`\n${e.message}`);
  process.exit(1);
}
