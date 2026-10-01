/**
 * Auditoria de segurança Playwright.
 *
 * Usa sessões reais dos perfis para atacar diretamente a API Supabase exposta
 * ao frontend e validar RLS/RBAC, isolamento multitenant, transições de estado
 * e idempotência. O NasaMotor usa banco de teste, portanto os cenários de QA
 * ficam habilitados automaticamente.
 *
 * Uso:
 *   npm run auditoria:seguranca -- nasa-motor-web
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

function gerarMarkdown(projeto, dados, codigo, caminhoHtml) {
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
          arquivo: spec.file,
          erros: erros.length ? erros : ['Falha sem mensagem detalhada.'],
        });
      }
    }
  }

  const stats = dados.stats || {};
  linhas.push(`# Auditoria de segurança — ${projeto.nome}`);
  linhas.push('');
  linhas.push(`- **Projeto:** \`${projeto.id}\``);
  linhas.push(`- **Alvo:** \`${alvoAuditoria(projeto)}\``);
  linhas.push(`- **Executada em:** ${new Date().toLocaleString('pt-BR')}`);
  linhas.push(`- **Resultado:** ${codigo === 0 && falhou === 0 ? 'OK' : 'Falhas encontradas'}`);
  linhas.push(`- **Cenários de segurança:** ${ok} OK · ${falhou} falharam · ${ignorado} ignorados`);
  linhas.push(`- **Sessões autenticadas:** ${authOk} OK · ${authFalhou} falharam`);
  linhas.push('- **Modo:** RLS/RBAC + escrita controlada de QA no banco de teste');
  if (stats.duration) linhas.push(`- **Duração:** ${(stats.duration / 1000).toFixed(1)} s`);
  linhas.push(`- **Relatório HTML:** \`${path.relative(RAIZ, caminhoHtml).split(path.sep).join('/')}\``);
  linhas.push('');
  linhas.push('## Cenários cobertos');
  linhas.push('');
  linhas.push('- isolamento multitenant em empresas, perfis e centros de custo;');
  linhas.push('- `adm` limitado à própria empresa e sem escrita nas permissões globais;');
  linhas.push('- IDOR por UUID de despesa entre perfis da mesma empresa;');
  linhas.push('- criação forjada de despesa noutra empresa e criação por role sem permissão;');
  linhas.push('- tentativa de autoelevação de role do colaborador;');
  linhas.push('- chamadas RPC proibidas por role e pagamento antes da aprovação;');
  linhas.push('- divisão com participante duplicado ou de outra empresa;');
  linhas.push('- submissões concorrentes do mesmo rascunho;');
  linhas.push('- impossibilidade de forjar diretamente o registo imutável de auditoria.');
  linhas.push('');
  linhas.push('## Falhas');
  linhas.push('');
  if (!falhas.length) {
    linhas.push('Nenhuma falha encontrada.');
  } else {
    falhas.forEach((falha, indice) => {
      linhas.push(`### ${indice + 1}. ${falha.titulo}`);
      linhas.push('');
      if (falha.arquivo) linhas.push(`Arquivo: \`${falha.arquivo}\``);
      linhas.push('');
      for (const erro of falha.erros) {
        linhas.push('```text');
        linhas.push(erro.slice(0, 10_000));
        linhas.push('```');
      }
      linhas.push('');
    });
  }
  linhas.push('## Nota sobre os dados de QA');
  linhas.push('');
  linhas.push('Os registos criados por esta fase usam o prefixo `QA Playwright Segurança`. Rascunhos usados apenas para tentativas bloqueadas são removidos quando possível; uma despesa submetida no teste de concorrência permanece no histórico para preservar o resultado transacional.');
  linhas.push('');

  return `${linhas.join('\n')}\n`;
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjetoAuditoria(id);
  const indiceId = argv.indexOf(id);
  const extras = (indiceId >= 0 ? argv.slice(indiceId + 1) : argv).filter((arg) => arg !== id);

  if (!existsSync(projeto.arquivoEnv)) {
    throw new Error(`Falta projetos/${id}/.env com as credenciais usadas pela auditoria de segurança.`);
  }
  dotenv.config({ path: projeto.arquivoEnv });

  if (id !== 'nasa-motor-web') {
    throw new Error(
      'A Fase 3 de segurança atual está configurada especificamente para o NasaMotor. ' +
        'Crie cenários de segurança próprios antes de a ativar noutro produto.',
    );
  }

  const perfisNecessarios = new Set([
    'adm',
    'colaborador',
    'caixaapv',
    'diretor',
    'financeiro',
    'contabilidade',
  ]);
  const perfis = projeto.auditoria.perfis.filter((perfil) => perfisNecessarios.has(perfil.id));
  const credenciaisAusentes = perfis.flatMap((perfil) => {
    const faltam = [perfil.envEmail, perfil.envPassword].filter(
      (nome) => !String(process.env[nome] || '').trim(),
    );
    return faltam.length ? [`${perfil.rotulo}: ${faltam.join(', ')}`] : [];
  });
  if (credenciaisAusentes.length) {
    throw new Error(`Faltam credenciais:\n- ${credenciaisAusentes.join('\n- ')}`);
  }

  const config = path.join(RAIZ, 'extras', 'auditoria', 'config', 'playwright.audit.security.config.ts');
  const dirEtapa = projeto.dirAuditoriaEtapa('seguranca');
  const dirResultados = path.join(dirEtapa, 'test-results');
  const htmlOutput = path.join(dirEtapa, 'report');
  const dirResumo = path.join(projeto.dirRelatorioAuditoria, 'seguranca');
  const jsonOutput = path.join(dirResultados, 'resultado.json');
  const markdownOutput = path.join(dirResumo, 'relatorio.md');

  if (!existsSync(config)) {
    throw new Error(`Falta ${path.basename(config)} na raiz do Playsaurus.`);
  }

  rmSync(dirResultados, { recursive: true, force: true });
  rmSync(htmlOutput, { recursive: true, force: true });
  mkdirSync(dirResultados, { recursive: true });
  mkdirSync(dirResumo, { recursive: true });

  console.log(`Auditoria de segurança de ${projeto.nome} (${id})...`);
  console.log(`Alvo: ${alvoAuditoria(projeto)}`);
  console.log('Modo: RLS/RBAC + tentativas de escrita controladas no banco de teste.');
  console.log('Perfis: adm, colaborador, Caixa APV, diretor, financeiro e contabilidade.\n');

  const codigo = await executarPlaywright(
    ['test', '--config', config, ...extras],
    {
      DOC_PROJETO: id,
      PLAYSAURUS_SECURITY_JSON: jsonOutput,
      PLAYSAURUS_SECURITY_HTML: htmlOutput,
    },
  );

  if (!existsSync(jsonOutput)) {
    throw new Error('O Playwright terminou sem gerar o resultado JSON da auditoria de segurança.');
  }

  const dados = JSON.parse(readFileSync(jsonOutput, 'utf8'));
  writeFileSync(markdownOutput, gerarMarkdown(projeto, dados, codigo, htmlOutput));

  console.log(`\nResumo: ${path.relative(RAIZ, markdownOutput)}`);
  console.log(`HTML detalhado: ${path.relative(RAIZ, htmlOutput)}`);
  if (codigo !== 0) {
    console.log('\nA auditoria de segurança encontrou falhas. Consulte o relatório acima.');
    process.exitCode = codigo;
  } else {
    console.log('\nAuditoria de segurança concluída.');
  }
} catch (e) {
  encerrarComErro(e);
}
