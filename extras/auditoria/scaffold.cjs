/** Scaffold opcional da auditoria. Só é carregado quando `npm run auditoria` é executado. */
const fs = require('node:fs');
const path = require('node:path');
const { DIR_PROJETOS } = require('../../compartilhado/projeto.cjs');

const AUDIT_AUTH_SETUP = `// PLAYSAURUS_AUDIT_TEMPLATE_V2
import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

type PerfilAuditoria = {
  id: string;
  rotulo: string;
  envEmail: string;
  envPassword: string;
  appLocale?: string;
};

type LoginAuditoria = {
  rota: string;
  emailSelector: string;
  passwordSelector: string;
  submitSelector: string;
  rotaSucesso?: string | null;
  timeoutMs: number;
};

const { projetoAuditoriaAtivo } = require('../../../../extras/auditoria/projeto.cjs');
const projeto = projetoAuditoriaAtivo();
const perfis = projeto.auditoria.perfis as PerfilAuditoria[];
const login = projeto.auditoria.login as LoginAuditoria;
const idiomaPadrao = (projeto.idiomas.disponiveis as Array<{ locale: string; appLocale?: string }>)
  .find((idioma) => idioma.locale === projeto.idiomas.padrao);

setup('autenticar perfil da auditoria', async ({ page }, testInfo) => {
  const perfilId = String(testInfo.project.metadata?.playsaurusAuditProfile || '');
  const perfil = perfis.find((item) => item.id === perfilId);
  if (!perfil) throw new Error(\`Perfil de auditoria não configurado: \${perfilId}\`);

  const email = process.env[perfil.envEmail] || '';
  const password = process.env[perfil.envPassword] || '';
  if (!email || !password) {
    throw new Error(
      \`Credenciais ausentes para \${perfil.rotulo}. Preencha \${perfil.envEmail} e \${perfil.envPassword} no .env.\`,
    );
  }

  const appLocale = perfil.appLocale || idiomaPadrao?.appLocale || projeto.idiomas.padrao;
  if (appLocale) {
    await page.addInitScript((locale) => {
      try { localStorage.setItem('app-language', locale); } catch { /* ignore */ }
    }, appLocale);
  }

  await page.goto(login.rota, { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator(login.emailSelector).first();
  const passwordInput = page.locator(login.passwordSelector).first();
  const submitButton = page.locator(login.submitSelector).first();

  await emailInput.waitFor({ state: 'visible', timeout: login.timeoutMs });
  await passwordInput.waitFor({ state: 'visible', timeout: login.timeoutMs });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();

  const loginPath = new URL(login.rota, 'http://playsaurus.local').pathname;
  try {
    await page.waitForURL(
      (url) => {
        if (login.rotaSucesso) {
          return url.pathname === login.rotaSucesso || url.pathname.startsWith(\`\${login.rotaSucesso}/\`);
        }
        return url.pathname !== loginPath;
      },
      { timeout: login.timeoutMs, waitUntil: 'domcontentloaded' },
    );
  } catch {
    const corpo = (await page.locator('body').innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
    await testInfo.attach('falha-login.txt', {
      body: Buffer.from(
        \`Perfil: \${perfil.rotulo}\\nURL final: \${page.url()}\\n\\n\${corpo.slice(0, 4000)}\`,
        'utf8',
      ),
      contentType: 'text/plain',
    });
    throw new Error(\`O login de \${perfil.rotulo} não saiu de \${login.rota}. Verifique as credenciais e a configuração do produto.\`);
  }

  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  const authFile = projeto.arquivoAuthPerfil(perfil.id);
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
`;

const AUDIT_SPEC = `// PLAYSAURUS_AUDIT_TEMPLATE_V2
import { test } from '@playwright/test';
import { AuditPage } from '../../../../extras/auditoria/AuditPage';

type PerfilAuditoria = {
  id: string;
  rotaInicial?: string;
  appLocale?: string;
  rotas?: string[];
  rotasProibidas?: string[];
  menusVisiveis?: string[];
  menusOcultos?: string[];
  textosEsperados?: string[];
  textosProibidos?: string[];
};

const { projetoAuditoriaAtivo } = require('../../../../extras/auditoria/projeto.cjs');
const projeto = projetoAuditoriaAtivo();
const perfis = projeto.auditoria.perfis as PerfilAuditoria[];
const idiomaPadrao = (projeto.idiomas.disponiveis as Array<{ locale: string; appLocale?: string }>)
  .find((idioma) => idioma.locale === projeto.idiomas.padrao);

function rotasDoPerfil(perfil: PerfilAuditoria): string[] {
  return Array.isArray(perfil.rotas) && perfil.rotas.length ? perfil.rotas : projeto.auditoria.rotas;
}

const configTecnica = {
  ignorarConsole: projeto.auditoria.ignorarConsole,
  ignorarUrls: projeto.auditoria.ignorarUrls,
  mensagensAcessoNegado: projeto.auditoria.mensagensAcessoNegado,
  menuSelector: projeto.auditoria.menuSelector,
  testarPesquisas: projeto.auditoria.testarPesquisas,
};

for (const perfil of perfis) {
  const marca = \`[perfil:\${perfil.id}]\`;

  for (const rota of rotasDoPerfil(perfil)) {
    test(\`\${marca} rota permitida: \${rota}\`, async ({ page }, testInfo) => {
      const appLocale = perfil.appLocale || idiomaPadrao?.appLocale || projeto.idiomas.padrao;
      if (appLocale) {
        await page.addInitScript((locale) => {
          try { localStorage.setItem('app-language', locale); } catch { /* ignore */ }
        }, appLocale);
      }

      const auditoria = new AuditPage(page, configTecnica);
      await auditoria.auditarRota(rota, testInfo);
    });
  }

  const visiveis = perfil.menusVisiveis || [];
  const ocultos = perfil.menusOcultos || [];
  if (visiveis.length || ocultos.length) {
    test(\`\${marca} menus do perfil\`, async ({ page }, testInfo) => {
      const auditoria = new AuditPage(page, configTecnica);
      await auditoria.confirmarMenus(perfil.rotaInicial || '/', visiveis, ocultos, testInfo);
    });
  }

  const textosEsperados = perfil.textosEsperados || [];
  const textosProibidos = perfil.textosProibidos || [];
  if (textosEsperados.length || textosProibidos.length) {
    test(\`\${marca} identidade e textos do perfil\`, async ({ page }, testInfo) => {
      const auditoria = new AuditPage(page, configTecnica);
      await auditoria.confirmarTextos(
        perfil.rotaInicial || '/',
        textosEsperados,
        textosProibidos,
        testInfo,
      );
    });
  }

  for (const rota of perfil.rotasProibidas || []) {
    test(\`\${marca} rota proibida: \${rota}\`, async ({ page }, testInfo) => {
      const auditoria = new AuditPage(page, configTecnica);
      await auditoria.confirmarBloqueio(rota, testInfo);
    });
  }
}
`;


function garantirAuditoriaProjeto(id) {
  const dir = path.join(DIR_PROJETOS, id);
  if (!fs.existsSync(path.join(dir, 'projeto.json'))) {
    throw new Error(`Projeto "${id}" não encontrado.`);
  }

  const arquivos = [
    [path.join('playwright', 'auditoria', 'auth.audit.setup.ts'), AUDIT_AUTH_SETUP],
    [path.join('playwright', 'auditoria', 'geral.audit.spec.ts'), AUDIT_SPEC],
  ];
  const criados = [];

  for (const [relativo, conteudo] of arquivos) {
    const alvo = path.join(dir, relativo);
    if (fs.existsSync(alvo)) continue;
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, conteudo);
    criados.push(relativo.split(path.sep).join('/'));
  }

  return criados;
}

/**
 * Repositórios candidatos dentro de uma pasta-base.
 *
 * "Candidato" = pasta que parece um projeto (tem .git ou package.json). O painel
 * mostra também se ela tem `public/`, porque sem isso não há onde publicar.
 */

module.exports = { garantirAuditoriaProjeto };
