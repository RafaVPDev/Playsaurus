/**
 * Executa a auditoria Playwright read-only de um produto.
 *
 * Uso:
 *   npm run auditoria -- meu-projeto
 *   npm run auditoria -- meu-projeto --headed
 *   npm run auditoria -- meu-projeto --perfil colaborador
 *
 * O relatório resumido fica em:
 *   projetos/<id>/output/auditoria/relatorio.md
 *
 * O relatório HTML detalhado e traces ficam em projetos/<id>/.playsaurus/.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BIN, RAIZ, idDoArgumento, encerrarComErro } from '../../../scripts/comum.mjs';

const require = createRequire(import.meta.url);
const { carregarProjetoAuditoria } = require('../projeto.cjs');
const dotenv = require('dotenv');
const { garantirAuditoriaProjeto } = require('../scaffold.cjs');

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
  return mensagem
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .trim();
}

function gerarMarkdown(projeto, dados, codigo, caminhoHtml) {
  const specs = specsRecursivos(dados.suites);
  const linhas = [];
  const porPerfil = new Map();
  const falhas = [];
  const rotuloPorId = new Map(projeto.auditoria.perfis.map((perfil) => [perfil.id, perfil.rotulo]));

  for (const spec of specs) {
    for (const teste of spec.tests || []) {
      const projetoNome = teste.projectName || teste.projectId || 'desconhecido';
      const perfilId = String(projetoNome).replace(/^auditoria:/, '').replace(/^auth:/, '');
      const perfil = rotuloPorId.get(perfilId) || perfilId;
      const final = resultadoFinal(teste);
      const status = final.status || teste.status || 'unknown';
      const grupo = porPerfil.get(perfil) || { ok: 0, falhou: 0, ignorado: 0 };

      if (status === 'passed') grupo.ok += 1;
      else if (status === 'skipped') grupo.ignorado += 1;
      else {
        grupo.falhou += 1;
        const erros = (final.errors?.length ? final.errors : final.error ? [final.error] : [])
          .map(limparErro)
          .filter(Boolean);
        falhas.push({
          perfil,
          titulo: spec.title,
          arquivo: spec.file,
          erros: erros.length ? erros : ['Falha sem mensagem detalhada.'],
        });
      }
      porPerfil.set(perfil, grupo);
    }
  }

  const stats = dados.stats || {};
  const totalOk = [...porPerfil.values()].reduce((s, p) => s + p.ok, 0);
  const totalFalhou = [...porPerfil.values()].reduce((s, p) => s + p.falhou, 0);
  const totalIgnorado = [...porPerfil.values()].reduce((s, p) => s + p.ignorado, 0);

  linhas.push(`# Auditoria — ${projeto.nome}`);
  linhas.push('');
  linhas.push(`- **Projeto:** \`${projeto.id}\``);
  linhas.push(`- **Alvo:** \`${alvoAuditoria(projeto)}\``);
  linhas.push(`- **Executada em:** ${new Date().toLocaleString('pt-BR')}`);
  linhas.push(`- **Resultado:** ${codigo === 0 && totalFalhou === 0 ? 'OK' : 'Falhas encontradas'}`);
  linhas.push(`- **Testes:** ${totalOk} OK · ${totalFalhou} falharam · ${totalIgnorado} ignorados`);
  if (stats.duration) linhas.push(`- **Duração:** ${(stats.duration / 1000).toFixed(1)} s`);
  linhas.push(`- **Relatório HTML:** \`${path.relative(RAIZ, caminhoHtml).split(path.sep).join('/')}\``);
  linhas.push('');
  linhas.push('## Resultado por perfil');
  linhas.push('');
  linhas.push('| Perfil | OK | Falharam | Ignorados |');
  linhas.push('|---|---:|---:|---:|');
  for (const [perfil, grupo] of [...porPerfil.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    linhas.push(`| ${perfil} | ${grupo.ok} | ${grupo.falhou} | ${grupo.ignorado} |`);
  }

  linhas.push('');
  linhas.push('## Falhas');
  linhas.push('');
  if (!falhas.length) {
    linhas.push('Nenhuma falha encontrada.');
  } else {
    falhas.forEach((falha, indice) => {
      linhas.push(`### ${indice + 1}. ${falha.perfil} — ${falha.titulo}`);
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

  linhas.push('## O que a auditoria técnica verifica');
  linhas.push('');
  linhas.push('- erros de JavaScript (`pageerror`);');
  linhas.push('- `console.error`;');
  linhas.push('- falhas de rede;');
  linhas.push('- respostas HTTP 4xx/5xx, com URL e detalhe quando disponível;');
  linhas.push('- páginas vazias;');
  linhas.push('- overflow horizontal;');
  linhas.push('- links visíveis sem destino;');
  linhas.push('- rotas explicitamente marcadas como proibidas por perfil;');
  linhas.push('- menus e textos esperados por perfil;');
  linhas.push('- campos de pesquisa, quando a opção estiver ativa.');
  linhas.push('');
  linhas.push('Os testes específicos de negócio podem ser acrescentados como `*.audit.spec.ts` dentro da pasta `playwright/` do produto.');
  linhas.push('');

  return `${linhas.join('\n')}\n`;
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjetoAuditoria(id);
  const criados = garantirAuditoriaProjeto(id);
  if (criados.length) {
    console.log(`Auditoria preparada para projeto existente: ${criados.join(', ')}`);
  }
  const indiceId = argv.indexOf(id);
  let extras = (indiceId >= 0 ? argv.slice(indiceId + 1) : argv).filter((arg) => arg !== id);

  let perfilSolicitado = null;
  const argumentoPerfilIgual = extras.find((arg) => arg.startsWith('--perfil='));
  if (argumentoPerfilIgual) {
    perfilSolicitado = argumentoPerfilIgual.slice('--perfil='.length).trim();
    extras = extras.filter((arg) => arg !== argumentoPerfilIgual);
  } else {
    const indicePerfil = extras.indexOf('--perfil');
    if (indicePerfil >= 0) {
      perfilSolicitado = String(extras[indicePerfil + 1] || '').trim();
      extras = extras.filter((_, indice) => indice !== indicePerfil && indice !== indicePerfil + 1);
    }
  }

  const perfisExecutados = perfilSolicitado
    ? projeto.auditoria.perfis.filter((perfil) => perfil.id === perfilSolicitado)
    : projeto.auditoria.perfis;
  if (perfilSolicitado && !perfisExecutados.length) {
    throw new Error(
      `Perfil de auditoria desconhecido: ${perfilSolicitado}. Disponíveis: ${projeto.auditoria.perfis
        .map((perfil) => perfil.id)
        .join(', ')}.`,
    );
  }
  if (perfilSolicitado) extras.push(`--project=auditoria:${perfilSolicitado}`);

  if (!existsSync(projeto.arquivoEnv)) {
    throw new Error(
      `Falta projetos/${id}/.env com as credenciais usadas pela auditoria.\n` +
        `Copie projetos/${id}/.env.example ou .env.auditoria.example e preencha as contas configuradas.`,
    );
  }
  dotenv.config({ path: projeto.arquivoEnv });

  if (!projeto.auditoria.perfis.length) {
    throw new Error(`Nenhum perfil de auditoria configurado para projetos/${id}.`);
  }

  const credenciaisAusentes = perfisExecutados.flatMap((perfil) => {
    const faltam = [perfil.envEmail, perfil.envPassword].filter(
      (nome) => !String(process.env[nome] || '').trim(),
    );
    return faltam.length ? [`${perfil.rotulo}: ${faltam.join(', ')}`] : [];
  });
  if (credenciaisAusentes.length) {
    throw new Error(
      `Faltam credenciais para executar a auditoria:\n- ${credenciaisAusentes.join('\n- ')}\n\n` +
        `Preencha as variáveis acima em projetos/${id}/.env.`,
    );
  }


  const config = path.join(RAIZ, 'extras', 'auditoria', 'config', 'playwright.audit.config.ts');
  const jsonOutput = path.join(projeto.dirResultadosAuditoria, 'resultado.json');
  const htmlOutput = projeto.dirRelatorioHtmlAuditoria;
  const markdownOutput = path.join(projeto.dirRelatorioAuditoria, 'relatorio.md');

  rmSync(projeto.dirResultadosAuditoria, { recursive: true, force: true });
  rmSync(htmlOutput, { recursive: true, force: true });
  mkdirSync(projeto.dirResultadosAuditoria, { recursive: true });
  mkdirSync(projeto.dirRelatorioAuditoria, { recursive: true });

  console.log(`Auditando ${projeto.nome} (${id})...`);
  console.log(`Alvo: ${alvoAuditoria(projeto)}`);
  console.log(`Perfis: ${perfisExecutados.map((perfil) => perfil.rotulo).join(', ')}`);
  console.log('Modo: read-only (a auditoria base apenas navega e valida acesso/erros).\n');

  const codigo = await executarPlaywright(
    ['test', '--config', config, ...extras],
    {
      DOC_PROJETO: id,
      PLAYSAURUS_AUDIT_JSON: jsonOutput,
      PLAYSAURUS_AUDIT_HTML: htmlOutput,
    },
  );

  if (!existsSync(jsonOutput)) {
    throw new Error('O Playwright terminou sem gerar o resultado JSON da auditoria.');
  }

  const dados = JSON.parse(readFileSync(jsonOutput, 'utf8'));
  writeFileSync(markdownOutput, gerarMarkdown(projeto, dados, codigo, htmlOutput));

  console.log(`\nResumo: ${path.relative(RAIZ, markdownOutput)}`);
  console.log(`HTML detalhado: ${path.relative(RAIZ, htmlOutput)}`);
  if (codigo !== 0) {
    console.log('\nA auditoria encontrou falhas. Consulte o relatório acima.');
    process.exitCode = codigo;
  } else {
    console.log('\nAuditoria concluída sem falhas.');
  }
} catch (e) {
  encerrarComErro(e);
}
