/**
 * Auditoria de performance e regressão visual Playwright — Fase 5.
 *
 * Mede tempos/requests nas rotas principais, testa uma lista sintética de
 * 120 despesas sem escrever no banco e mantém baselines visuais persistentes.
 *
 * Uso:
 *   npm run auditoria:performance -- nasa-motor-web
 *   npm run auditoria:performance -- nasa-motor-web --atualizar-baseline
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BIN, RAIZ, idDoArgumento, encerrarComErro } from '../../../scripts/comum.mjs';

const require = createRequire(import.meta.url);
const { carregarProjetoAuditoria } = require('../projeto.cjs');
const dotenv = require('dotenv');

function alvoAuditoria(projeto) {
  const envBaseUrl = projeto.auditoria?.envBaseUrl || projeto.screenshots?.envBaseUrl;
  return (
    (envBaseUrl && process.env[envBaseUrl]) ||
    projeto.auditoria?.baseUrlPadrao ||
    projeto.url ||
    projeto.screenshots?.baseUrlPadrao ||
    'http://localhost:8080'
  );
}

function executarPlaywright(args, env) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [BIN.playwright, ...args], {
      cwd: RAIZ,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    filho.on('error', reject);
    filho.on('close', (codigo) => resolve(codigo ?? 1));
  });
}

function specsRecursivos(suites, acumulado = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) acumulado.push(spec);
    specsRecursivos(suite.suites, acumulado);
  }
  return acumulado;
}

function resultadoFinal(teste) {
  const resultados = teste.results || [];
  return resultados[resultados.length - 1] || {};
}

function limparErro(erro) {
  const mensagem = erro?.message || erro?.value || String(erro || 'Falha sem mensagem.');
  return mensagem.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '').trim();
}

function numero(valor, casas = 0) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-PT', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function gerarMarkdown(projeto, dados, metricas, codigo, caminhoHtml) {
  const specs = specsRecursivos(dados.suites);
  const linhas = [];
  const falhas = [];
  let ok = 0;
  let falhou = 0;
  let ignorado = 0;
  let authOk = 0;
  let authFalhou = 0;

  for (const spec of specs) {
    for (const teste of spec.tests || []) {
      const projetoNome = teste.projectName || teste.projectId || '';
      const final = resultadoFinal(teste);
      const status = final.status || teste.status || 'unknown';
      const ehAuth = String(projetoNome).startsWith('auth:');

      if (ehAuth) {
        if (status === 'passed') authOk += 1;
        else if (status !== 'skipped') authFalhou += 1;
        continue;
      }

      if (status === 'passed') ok += 1;
      else if (status === 'skipped') ignorado += 1;
      else {
        falhou += 1;
        const erros = (final.errors?.length ? final.errors : final.error ? [final.error] : [])
          .map(limparErro)
          .filter(Boolean);
        falhas.push({
          titulo: spec.title,
          ficheiro: spec.file,
          erros: erros.length ? erros : ['Falha sem mensagem detalhada.'],
        });
      }
    }
  }

  const stats = dados.stats || {};
  const perf = Array.isArray(metricas?.performance) ? metricas.performance : [];
  const visuals = Array.isArray(metricas?.visuals) ? metricas.visuals : [];
  const baselinesCriadas = visuals.filter((item) => item.baseline === 'created').length;
  const baselinesAtualizadas = visuals.filter((item) => item.baseline === 'updated').length;
  const baselinesComparadas = visuals.filter((item) => item.baseline === 'compared').length;
  const thresholds = metricas?.thresholds || {};

  linhas.push(`# Auditoria de performance e regressão visual — ${projeto.nome}`);
  linhas.push('');
  linhas.push(`- **Projeto:** \`${projeto.id}\``);
  linhas.push(`- **Alvo:** \`${alvoAuditoria(projeto)}\``);
  linhas.push(`- **Executada em:** ${new Date().toLocaleString('pt-PT')}`);
  linhas.push(`- **Resultado:** ${codigo === 0 && falhou === 0 ? 'OK' : 'Falhas encontradas'}`);
  linhas.push(`- **Cenários Fase 5:** ${ok} OK · ${falhou} falharam · ${ignorado} ignorados`);
  linhas.push(`- **Sessões autenticadas:** ${authOk} OK · ${authFalhou} falharam`);
  linhas.push('- **Modo:** leitura + tabela sintética em memória; sem escrita de dados de negócio');
  if (stats.duration) linhas.push(`- **Duração:** ${(stats.duration / 1000).toFixed(1)} s`);
  linhas.push(`- **Relatório HTML:** \`${path.relative(RAIZ, caminhoHtml).split(path.sep).join('/')}\``);
  linhas.push('');

  linhas.push('## Limites aplicados');
  linhas.push('');
  linhas.push(`- rota estabilizada: até ${numero(thresholds.readyMs)} ms;`);
  linhas.push(`- evento load: até ${numero(thresholds.loadMs)} ms;`);
  linhas.push(`- requests por rota: até ${numero(thresholds.requests)};`);
  linhas.push(`- requests de API por rota: até ${numero(thresholds.apiRequests)};`);
  linhas.push(`- GET idêntico: no máximo ${numero(thresholds.duplicateGets)} vezes;`);
  linhas.push(`- tabela sintética com 120 despesas: até ${numero(thresholds.largeTableMs)} ms.`);
  linhas.push('');

  linhas.push('## Performance por rota');
  linhas.push('');
  if (!perf.length) {
    linhas.push('Sem métricas disponíveis.');
  } else {
    linhas.push('| Rota | Estável | DOMContentLoaded | load | Requests | API | GET repetido | Transferência |');
    linhas.push('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const item of perf) {
      linhas.push(
        `| \`${item.route}\` | ${numero(item.readyMs)} ms | ${numero(item.domContentLoadedMs)} ms | ${numero(item.loadMs)} ms | ${numero(item.requestCount)} | ${numero(item.apiRequestCount)} | ${numero(item.duplicateGetMax)}× | ${numero(item.transferKb, 1)} KB |`,
      );
    }
  }
  linhas.push('');

  linhas.push('## Tabela maior');
  linhas.push('');
  if (metricas?.largeTable) {
    linhas.push(
      `Foram injetadas **${numero(metricas.largeTable.rows)} despesas apenas na resposta HTTP do browser**, sem gravação no Supabase. A página estabilizou em **${numero(metricas.largeTable.renderMs)} ms** e renderizou **${numero(metricas.largeTable.visibleRows)} linhas visíveis** (a paginação pode limitar o número mostrado).`,
    );
  } else {
    linhas.push('Sem métrica da tabela sintética.');
  }
  linhas.push('');

  linhas.push('## Regressão visual');
  linhas.push('');
  linhas.push(`- baselines criadas nesta execução: ${baselinesCriadas};`);
  linhas.push(`- baselines atualizadas explicitamente: ${baselinesAtualizadas};`);
  linhas.push(`- baselines comparadas: ${baselinesComparadas}.`);
  linhas.push('');
  if (visuals.length) {
    linhas.push('| Rota | Estado da baseline |');
    linhas.push('|---|---|');
    for (const item of visuals) {
      const estado = item.baseline === 'created' ? 'criada' : item.baseline === 'updated' ? 'atualizada' : 'comparada';
      linhas.push(`| \`${item.route}\` | ${estado} |`);
    }
    linhas.push('');
  }
  linhas.push('A comparação visual usa dois recortes de viewport por rota (topo e fundo), normaliza datas, horas, valores monetários, UUIDs e oculta conteúdo transacional/gráficos dinâmicos. Assim, alterações na quantidade de registos não mudam a altura da baseline nem geram falsos positivos.');
  linhas.push('');

  linhas.push('## Falhas');
  linhas.push('');
  if (!falhas.length) {
    linhas.push('Nenhuma falha encontrada.');
  } else {
    falhas.forEach((falha, indice) => {
      linhas.push(`### ${indice + 1}. ${falha.titulo}`);
      linhas.push('');
      if (falha.ficheiro) linhas.push(`Ficheiro: \`${falha.ficheiro}\``);
      linhas.push('');
      for (const erro of falha.erros) {
        linhas.push('```text');
        linhas.push(erro.slice(0, 10_000));
        linhas.push('```');
      }
      linhas.push('');
    });
  }

  linhas.push('## Baselines visuais');
  linhas.push('');
  linhas.push('Na primeira execução, cada rota cria duas referências visuais de viewport (topo e fundo) e o teste passa. Nas execuções seguintes, alterações acima da tolerância configurada falham e aparecem no relatório HTML do Playwright.');
  linhas.push('Para aceitar intencionalmente um novo layout, execute `npm run auditoria:performance -- nasa-motor-web --atualizar-baseline`.');
  linhas.push('');

  return `${linhas.join('\n')}\n`;
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjetoAuditoria(id);
  const indiceId = argv.indexOf(id);
  const extrasBrutos = (indiceId >= 0 ? argv.slice(indiceId + 1) : argv).filter((arg) => arg !== id);
  const atualizarBaseline = extrasBrutos.includes('--atualizar-baseline');
  const extras = extrasBrutos.filter((arg) => arg !== '--atualizar-baseline');

  if (!existsSync(projeto.arquivoEnv)) {
    throw new Error(`Falta projetos/${id}/.env com as credenciais usadas pela auditoria de performance.`);
  }
  dotenv.config({ path: projeto.arquivoEnv });

  if (id !== 'nasa-motor-web') {
    throw new Error(
      'A Fase 5 de performance/visual atual está configurada especificamente para o NasaMotor. ' +
        'Defina rotas, limites e normalizações próprias antes de a ativar noutro produto.',
    );
  }

  const perfil = projeto.auditoria.perfis.find((item) => item.id === 'adm');
  if (!perfil) throw new Error('O perfil adm não está configurado em auditoria.json.');
  const credenciaisAusentes = [perfil.envEmail, perfil.envPassword].filter(
    (nome) => !String(process.env[nome] || '').trim(),
  );
  if (credenciaisAusentes.length) {
    throw new Error(`Faltam credenciais do administrador: ${credenciaisAusentes.join(', ')}`);
  }

  const config = path.join(RAIZ, 'extras', 'auditoria', 'config', 'playwright.audit.performance.config.ts');
  const dirEtapa = projeto.dirAuditoriaEtapa('performance');
  const dirResultados = path.join(dirEtapa, 'test-results');
  const htmlOutput = path.join(dirEtapa, 'report');
  const dirResumo = path.join(projeto.dirRelatorioAuditoria, 'performance');
  const jsonOutput = path.join(dirResultados, 'resultado.json');
  const metricsOutput = path.join(dirResultados, 'metricas.json');
  const markdownOutput = path.join(dirResumo, 'relatorio.md');

  if (!existsSync(config)) {
    throw new Error(`Falta ${path.basename(config)} na raiz do Playsaurus.`);
  }

  rmSync(dirResultados, { recursive: true, force: true });
  rmSync(htmlOutput, { recursive: true, force: true });
  mkdirSync(dirResultados, { recursive: true });
  mkdirSync(dirResumo, { recursive: true });

  console.log(`Auditoria de performance/visual de ${projeto.nome} (${id})...`);
  console.log(`Alvo: ${alvoAuditoria(projeto)}`);
  console.log('Modo: leitura + tabela sintética em memória; sem escrita de dados de negócio.');
  console.log(`Baselines: ${atualizarBaseline ? 'ATUALIZAR as referências existentes' : 'comparar; criar apenas as que ainda não existem'}.`);
  console.log('Perfil principal: adm.\n');

  const codigo = await executarPlaywright(
    ['test', '--config', config, ...extras],
    {
      DOC_PROJETO: id,
      PLAYSAURUS_PERFORMANCE_JSON: jsonOutput,
      PLAYSAURUS_PERFORMANCE_HTML: htmlOutput,
      PLAYSAURUS_PERFORMANCE_DATA: metricsOutput,
      PLAYSAURUS_UPDATE_VISUAL_BASELINE: atualizarBaseline ? '1' : '0',
    },
  );

  if (!existsSync(jsonOutput)) {
    throw new Error('O Playwright terminou sem gerar o resultado JSON da auditoria de performance.');
  }

  const dados = JSON.parse(readFileSync(jsonOutput, 'utf8'));
  const specs = specsRecursivos(dados.suites);
  const cenariosFase5 = specs.reduce(
    (total, spec) =>
      total +
      (spec.tests || []).filter((teste) => {
        const projetoNome = teste.projectName || teste.projectId || '';
        return !String(projetoNome).startsWith('auth:');
      }).length,
    0,
  );
  if (cenariosFase5 === 0) {
    throw new Error(
      'A auditoria de performance terminou sem executar cenários da Fase 5. ' +
        'Verifique o testMatch do projeto performance-visual e o nome do ficheiro de spec.',
    );
  }

  if (!existsSync(metricsOutput)) {
    throw new Error(
      'A auditoria de performance executou testes, mas não gerou metricas.json. ' +
        'A execução não será considerada válida.',
    );
  }

  const metricas = JSON.parse(readFileSync(metricsOutput, 'utf8'));
  writeFileSync(markdownOutput, gerarMarkdown(projeto, dados, metricas, codigo, htmlOutput));

  console.log(`\nResumo: ${path.relative(RAIZ, markdownOutput)}`);
  console.log(`HTML detalhado: ${path.relative(RAIZ, htmlOutput)}`);
  if (codigo !== 0) {
    console.log('\nA auditoria de performance/visual encontrou falhas. Consulte o relatório acima.');
    process.exitCode = codigo;
  } else {
    console.log('\nAuditoria de performance/visual concluída.');
  }
} catch (e) {
  encerrarComErro(e);
}
