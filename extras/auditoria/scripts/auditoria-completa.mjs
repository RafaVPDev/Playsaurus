/**
 * Executa as cinco fases de auditoria do NasaMotor em sequência e gera
 * um único relatório-resumo com o estado geral e links para cada fase.
 *
 * Uso:
 *   npm run auditoria:completa -- nasa-motor-web
 *   npm run auditoria:completa -- nasa-motor-web --headed
 *   npm run auditoria:completa -- nasa-motor-web --atualizar-baseline
 *
 * A execução continua mesmo quando uma fase falha, para que o resumo final
 * mostre o estado das cinco fases numa só passagem.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ, idDoArgumento, encerrarComErro } from '../../../scripts/comum.mjs';

const require = createRequire(import.meta.url);
const { carregarProjetoAuditoria } = require('../projeto.cjs');

function segundos(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}

function caminhoUnix(valor) {
  return valor.split(path.sep).join('/');
}

function executarScript(script, id, args = []) {
  const inicio = Date.now();
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, [path.join(RAIZ, 'extras', 'auditoria', 'scripts', script), id, ...args], {
      cwd: RAIZ,
      stdio: 'inherit',
      env: { ...process.env },
    });

    filho.on('error', (erro) => {
      console.error(`\nNão foi possível iniciar ${script}: ${erro.message}`);
      resolve({ codigo: 1, duracaoMs: Date.now() - inicio, erro: erro.message });
    });
    filho.on('close', (codigo) => {
      resolve({ codigo: codigo ?? 1, duracaoMs: Date.now() - inicio });
    });
  });
}

function lerLinha(texto, rotulo) {
  const prefixo = `- **${rotulo}:** `;
  return texto
    .split(/\r?\n/)
    .find((linha) => linha.startsWith(prefixo))
    ?.slice(prefixo.length)
    .trim();
}

function lerContagens(texto) {
  const linha = texto
    .split(/\r?\n/)
    .find((item) => /^- \*\*(Testes|Cenários[^*]*):\*\*/.test(item));
  if (!linha) return null;

  const match = linha.match(/:\*\*\s+(\d+) OK\s+·\s+(\d+) falharam\s+·\s+(\d+) ignorados/i);
  if (!match) return null;
  return {
    ok: Number(match[1]),
    falhou: Number(match[2]),
    ignorado: Number(match[3]),
  };
}

function lerRelatorio(fase, caminho) {
  if (!existsSync(caminho)) {
    return {
      ...fase,
      relatorioExiste: false,
      resultado: 'Relatório não gerado',
      contagens: null,
      html: null,
    };
  }

  const texto = readFileSync(caminho, 'utf8');
  return {
    ...fase,
    relatorioExiste: true,
    resultado: lerLinha(texto, 'Resultado') || 'Resultado não identificado',
    contagens: lerContagens(texto),
    html: lerLinha(texto, 'Relatório HTML')?.replace(/^`|`$/g, '') || null,
  };
}

function estadoFase(fase) {
  const relatorioOk = fase.relatorioExiste && /^OK$/i.test(fase.resultado);
  return fase.codigo === 0 && relatorioOk ? 'OK' : 'FALHOU';
}

function gerarMarkdown(projeto, fases, inicio, fim, caminhoResumo) {
  const linhas = [];
  const todasOk = fases.every((fase) => estadoFase(fase) === 'OK');
  const contagensValidas = fases.map((fase) => fase.contagens).filter(Boolean);
  const totais = contagensValidas.reduce(
    (acc, item) => ({
      ok: acc.ok + item.ok,
      falhou: acc.falhou + item.falhou,
      ignorado: acc.ignorado + item.ignorado,
    }),
    { ok: 0, falhou: 0, ignorado: 0 },
  );

  linhas.push(`# Auditoria completa — ${projeto.nome}`);
  linhas.push('');
  linhas.push(`- **Projeto:** \`${projeto.id}\``);
  linhas.push(`- **Executada em:** ${new Date(fim).toLocaleString('pt-BR')}`);
  linhas.push(`- **Resultado geral:** ${todasOk ? 'OK' : 'Falhas encontradas'}`);
  linhas.push(`- **Fases:** ${fases.filter((fase) => estadoFase(fase) === 'OK').length}/5 OK`);
  if (contagensValidas.length === fases.length) {
    linhas.push(`- **Verificações reportadas:** ${totais.ok} OK · ${totais.falhou} falharam · ${totais.ignorado} ignorados`);
  }
  linhas.push(`- **Duração total:** ${segundos(fim - inicio)}`);
  linhas.push('');

  linhas.push('## Resultado por fase');
  linhas.push('');
  linhas.push('| Fase | Estado | OK | Falharam | Ignorados | Duração | Relatório |');
  linhas.push('|---|---|---:|---:|---:|---:|---|');

  for (const fase of fases) {
    const contagens = fase.contagens;
    const relativo = fase.relatorioExiste
      ? caminhoUnix(path.relative(path.dirname(caminhoResumo), fase.relatorio))
      : null;
    const link = relativo ? `[Abrir](${relativo})` : '—';
    linhas.push(
      `| ${fase.nome} | **${estadoFase(fase)}** | ${contagens?.ok ?? '—'} | ${contagens?.falhou ?? '—'} | ${contagens?.ignorado ?? '—'} | ${segundos(fase.duracaoMs)} | ${link} |`,
    );
  }

  linhas.push('');
  linhas.push('## Relatórios detalhados');
  linhas.push('');
  for (const fase of fases) {
    const relativo = fase.relatorioExiste
      ? caminhoUnix(path.relative(path.dirname(caminhoResumo), fase.relatorio))
      : null;
    const estado = estadoFase(fase);
    linhas.push(`### ${fase.nome} — ${estado}`);
    linhas.push('');
    if (relativo) linhas.push(`- Resumo: [abrir relatório da fase](${relativo})`);
    else linhas.push('- Resumo: não foi gerado.');
    if (fase.html) linhas.push(`- HTML Playwright: \`${fase.html}\``);
    if (fase.erro) linhas.push(`- Erro ao iniciar: ${fase.erro}`);
    linhas.push('');
  }

  linhas.push('## Como interpretar');
  linhas.push('');
  linhas.push('A auditoria completa não interrompe a execução na primeira falha: todas as fases disponíveis são executadas e o estado final só é **OK** quando as cinco terminam sem falhas.');
  linhas.push('As baselines visuais da Fase 5 continuam a ser comparadas normalmente. Para aceitar intencionalmente um novo layout, execute a auditoria completa com `--atualizar-baseline` ou rode apenas a Fase 5 com essa opção.');
  linhas.push('');

  return `${linhas.join('\n')}\n`;
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjetoAuditoria(id);

  if (id !== 'nasa-motor-web') {
    throw new Error(
      'A auditoria completa Fases 1–5 está configurada para o NasaMotor. ' +
        'As fases de segurança, robustez e performance ainda são específicas deste produto.',
    );
  }

  const indiceId = argv.indexOf(id);
  const extras = (indiceId >= 0 ? argv.slice(indiceId + 1) : argv).filter((arg) => arg !== id);
  const permitidos = new Set(['--headed', '--atualizar-baseline']);
  const desconhecidos = extras.filter((arg) => !permitidos.has(arg));
  if (desconhecidos.length) {
    throw new Error(
      `Opção não suportada na auditoria completa: ${desconhecidos.join(', ')}. ` +
        'Use apenas --headed e/ou --atualizar-baseline.',
    );
  }

  const headed = extras.includes('--headed') ? ['--headed'] : [];
  const atualizarBaseline = extras.includes('--atualizar-baseline') ? ['--atualizar-baseline'] : [];
  const dirRelatorios = projeto.dirRelatorioAuditoria;
  const dirCompleta = path.join(dirRelatorios, 'completa');
  const caminhoResumo = path.join(dirCompleta, 'relatorio.md');

  const definicoes = [
    {
      numero: 1,
      nome: 'Fase 1 — Técnica / read-only',
      script: 'auditoria.mjs',
      args: [...headed],
      relatorio: path.join(dirRelatorios, 'relatorio.md'),
    },
    {
      numero: 2,
      nome: 'Fase 2 — Funcional',
      script: 'auditoria-funcional.mjs',
      args: [...headed],
      relatorio: path.join(dirRelatorios, 'funcional', 'relatorio.md'),
    },
    {
      numero: 3,
      nome: 'Fase 3 — Segurança / RLS / RBAC',
      script: 'auditoria-seguranca.mjs',
      args: [...headed],
      relatorio: path.join(dirRelatorios, 'seguranca', 'relatorio.md'),
    },
    {
      numero: 4,
      nome: 'Fase 4 — Robustez operacional',
      script: 'auditoria-robustez.mjs',
      args: [...headed],
      relatorio: path.join(dirRelatorios, 'robustez', 'relatorio.md'),
    },
    {
      numero: 5,
      nome: 'Fase 5 — Performance e regressão visual',
      script: 'auditoria-performance.mjs',
      args: [...headed, ...atualizarBaseline],
      relatorio: path.join(dirRelatorios, 'performance', 'relatorio.md'),
    },
  ];

  mkdirSync(dirCompleta, { recursive: true });
  rmSync(caminhoResumo, { force: true });
  for (const fase of definicoes) rmSync(fase.relatorio, { force: true });

  console.log(`Auditoria completa de ${projeto.nome} (${id})...`);
  console.log('Fases: técnica, funcional, segurança, robustez e performance/regressão visual.');
  console.log('A execução continua até ao fim mesmo que uma fase falhe.\n');

  const inicio = Date.now();
  const resultados = [];

  for (const fase of definicoes) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`${fase.nome} (${fase.numero}/5)`);
    console.log(`${'='.repeat(72)}\n`);

    const execucao = await executarScript(fase.script, id, fase.args);
    const relatorio = lerRelatorio(fase, fase.relatorio);
    resultados.push({ ...relatorio, ...execucao });

    console.log(`\n${fase.nome}: ${estadoFase({ ...relatorio, ...execucao })}`);
  }

  const fim = Date.now();
  writeFileSync(caminhoResumo, gerarMarkdown(projeto, resultados, inicio, fim, caminhoResumo));

  const todasOk = resultados.every((fase) => estadoFase(fase) === 'OK');
  console.log(`\n${'='.repeat(72)}`);
  console.log(`Resultado geral: ${todasOk ? 'OK' : 'FALHAS ENCONTRADAS'}`);
  console.log(`Duração total: ${segundos(fim - inicio)}`);
  console.log(`Resumo consolidado: ${path.relative(RAIZ, caminhoResumo)}`);
  console.log(`${'='.repeat(72)}`);

  if (!todasOk) process.exitCode = 1;
} catch (erro) {
  encerrarComErro(erro);
}
