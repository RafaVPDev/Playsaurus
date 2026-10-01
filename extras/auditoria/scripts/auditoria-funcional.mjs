/**
 * Auditoria funcional Playwright.
 *
 * Diferente de `npm run auditoria`, esta modalidade ESCREVE dados no produto.
 * O NasaMotor usa atualmente um banco de teste, por isso a escrita funcional e
 * o ciclo financeiro completo ficam ativados automaticamente para esse produto.
 * Outros produtos continuam a exigir a flag de escrita no respetivo .env.
 *
 * Uso:
 *   npm run auditoria:funcional -- nasa-motor-web
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

function gerarMarkdown(projeto, dados, codigo, caminhoHtml, escritaFinanceiraAtiva) {
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
  linhas.push(`# Auditoria funcional — ${projeto.nome}`);
  linhas.push('');
  linhas.push(`- **Projeto:** \`${projeto.id}\``);
  linhas.push(`- **Alvo:** \`${alvoAuditoria(projeto)}\``);
  linhas.push(`- **Executada em:** ${new Date().toLocaleString('pt-BR')}`);
  linhas.push(`- **Resultado:** ${codigo === 0 && falhou === 0 ? 'OK' : 'Falhas encontradas'}`);
  linhas.push(`- **Cenários funcionais:** ${ok} OK · ${falhou} falharam · ${ignorado} ignorados`);
  linhas.push(`- **Sessões autenticadas:** ${authOk} OK · ${authFalhou} falharam`);
  linhas.push(`- **Escritas financeiras:** ${escritaFinanceiraAtiva ? 'ativadas' : 'desativadas'}`);
  if (stats.duration) linhas.push(`- **Duração:** ${(stats.duration / 1000).toFixed(1)} s`);
  linhas.push(`- **Relatório HTML:** \`${path.relative(RAIZ, caminhoHtml).split(path.sep).join('/')}\``);
  linhas.push('');
  linhas.push('## Cenários cobertos');
  linhas.push('');
  linhas.push('- criação e edição de rascunho;');
  linhas.push('- validação bloqueante do NIF da empresa;');
  linhas.push('- pesquisa da despesa criada;');
  linhas.push('- criação e cancelamento de adiantamento do Caixa APV;');
  linhas.push('- importação e reimportação idempotente de ficheiro Autoline;');
  linhas.push('- quando as escritas financeiras estão ativadas: submissão, aprovação, rejeição, pagamento e presença na fila de exportação.');
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
        linhas.push(erro.slice(0, 8_000));
        linhas.push('```');
      }
      linhas.push('');
    });
  }
  linhas.push('## Nota sobre dados de QA');
  linhas.push('');
  linhas.push('Os registos criados usam o prefixo `QA Playwright` para serem identificáveis. Rascunhos e despesas submetidas permanecem no histórico; adiantamentos criados pelo teste são cancelados no próprio cenário.');
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
    throw new Error(
      `Falta projetos/${id}/.env com as credenciais usadas pela auditoria funcional.`,
    );
  }
  dotenv.config({ path: projeto.arquivoEnv });

  const nasaMotorTeste = id === 'nasa-motor-web';
  const escritaFuncionalAtiva =
    nasaMotorTeste || process.env.NASA_MOTOR_WEB_AUDIT_FUNCTIONAL_WRITE === '1';
  const escritaFinanceiraAtiva =
    nasaMotorTeste || process.env.NASA_MOTOR_WEB_AUDIT_FINANCIAL_WRITE === '1';

  if (!escritaFuncionalAtiva) {
    throw new Error(
      'A auditoria funcional escreve dados e está bloqueada por segurança.\n' +
        'Defina a flag de escrita funcional do produto no respetivo .env e execute novamente.',
    );
  }

  const perfisNecessarios = new Set(['colaborador', 'diretor', 'financeiro', 'caixaapv', 'contabilidade']);
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

  const config = path.join(RAIZ, 'extras', 'auditoria', 'config', 'playwright.audit.functional.config.ts');
  const dirEtapa = projeto.dirAuditoriaEtapa('funcional');
  const dirResultados = path.join(dirEtapa, 'test-results');
  const htmlOutput = path.join(dirEtapa, 'report');
  const dirResumo = path.join(projeto.dirRelatorioAuditoria, 'funcional');
  const jsonOutput = path.join(dirResultados, 'resultado.json');
  const markdownOutput = path.join(dirResumo, 'relatorio.md');

  rmSync(dirResultados, { recursive: true, force: true });
  rmSync(htmlOutput, { recursive: true, force: true });
  mkdirSync(dirResultados, { recursive: true });
  mkdirSync(dirResumo, { recursive: true });

  console.log(`Auditoria funcional de ${projeto.nome} (${id})...`);
  console.log(`Alvo: ${alvoAuditoria(projeto)}`);
  console.log('Modo: escrita funcional. Os dados de QA usam o prefixo "QA Playwright".');
  if (nasaMotorTeste) {
    console.log('NasaMotor: banco de teste — escritas funcionais completas ATIVADAS.');
  }
  console.log(
    `Ciclo financeiro completo: ${escritaFinanceiraAtiva ? 'ATIVADO' : 'desativado (cenários serão ignorados)'}.\n`,
  );

  const codigo = await executarPlaywright(
    ['test', '--config', config, ...extras],
    {
      DOC_PROJETO: id,
      PLAYSAURUS_FUNCTIONAL_JSON: jsonOutput,
      PLAYSAURUS_FUNCTIONAL_HTML: htmlOutput,
      NASA_MOTOR_WEB_AUDIT_FUNCTIONAL_WRITE: escritaFuncionalAtiva ? '1' : '0',
      NASA_MOTOR_WEB_AUDIT_FINANCIAL_WRITE: escritaFinanceiraAtiva ? '1' : '0',
    },
  );

  if (!existsSync(jsonOutput)) {
    throw new Error('O Playwright terminou sem gerar o resultado JSON da auditoria funcional.');
  }

  const dados = JSON.parse(readFileSync(jsonOutput, 'utf8'));
  writeFileSync(
    markdownOutput,
    gerarMarkdown(projeto, dados, codigo, htmlOutput, escritaFinanceiraAtiva),
  );

  console.log(`\nResumo: ${path.relative(RAIZ, markdownOutput)}`);
  console.log(`HTML detalhado: ${path.relative(RAIZ, htmlOutput)}`);
  if (codigo !== 0) {
    console.log('\nA auditoria funcional encontrou falhas. Consulte o relatório acima.');
    process.exitCode = codigo;
  } else {
    console.log('\nAuditoria funcional concluída.');
  }
} catch (e) {
  encerrarComErro(e);
}
