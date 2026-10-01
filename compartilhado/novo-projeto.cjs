/**
 * Criação de um produto novo — o que o botão "Novo produto" do painel executa.
 *
 * Gera um `projetos/<id>/` completo e que **compila de primeira**: projeto.json,
 * uma página inicial por seção, tema derivado de uma cor e um modelo de captura
 * de screenshots. A partir daí é só escrever os artigos.
 */
const fs = require('node:fs');
const path = require('node:path');

const {
  RAIZ,
  DIR_PROJETOS,
  listarProjetos,
  validarId,
  salvarCaminhoLocal,
} = require('./projeto.cjs');

/** Seções padrão sugeridas, para os projetos ficarem com a mesma cara. */
const SECOES_PADRAO = [
  {
    id: 'arquitetura',
    rotulo: 'Arquitetura',
    tag: 'Para desenvolvedores',
    descricao: 'Documentação técnica: stack, banco de dados, autenticação, integrações e segurança.',
  },
  {
    id: 'usabilidade',
    rotulo: 'Usabilidade',
    tag: 'Para usuários',
    descricao: 'Guias passo a passo para o dia a dia de quem usa o produto.',
  },
  {
    id: 'referencia',
    rotulo: 'Referência',
    tag: 'Consulta rápida',
    descricao: 'Glossário, permissões e perguntas frequentes para tirar dúvidas rapidamente.',
  },
];

const SECOES_PADRAO_PT_PT = [
  {
    id: 'arquitetura',
    rotulo: 'Arquitetura',
    tag: 'Para programadores',
    descricao: 'Documentação técnica: stack, base de dados, autenticação, integrações e segurança.',
  },
  {
    id: 'usabilidade',
    rotulo: 'Usabilidade',
    tag: 'Para utilizadores',
    descricao: 'Guias passo a passo para o dia a dia de quem utiliza o produto.',
  },
  {
    id: 'referencia',
    rotulo: 'Referência',
    tag: 'Consulta rápida',
    descricao: 'Glossário, permissões e perguntas frequentes para esclarecer dúvidas rapidamente.',
  },
];

const SECOES_PADRAO_EN = [
  {
    id: 'arquitetura',
    rotulo: 'Architecture',
    tag: 'For developers',
    descricao: 'Technical documentation: stack, database, authentication, integrations, and security.',
  },
  {
    id: 'usabilidade',
    rotulo: 'Usability',
    tag: 'For users',
    descricao: 'Step-by-step guides for the day-to-day use of the product.',
  },
  {
    id: 'referencia',
    rotulo: 'Reference',
    tag: 'Quick reference',
    descricao: 'Glossary, permissions, and frequently asked questions for quick consultation.',
  },
];

const SECOES_PADRAO_ES = [
  {
    id: 'arquitetura',
    rotulo: 'Arquitectura',
    tag: 'Para desarrolladores',
    descricao: 'Documentación técnica: stack, base de datos, autenticación, integraciones y seguridad.',
  },
  {
    id: 'usabilidade',
    rotulo: 'Usabilidad',
    tag: 'Para usuarios',
    descricao: 'Guías paso a paso para el uso diario del producto.',
  },
  {
    id: 'referencia',
    rotulo: 'Referencia',
    tag: 'Consulta rápida',
    descricao: 'Glosario, permisos y preguntas frecuentes para resolver dudas rápidamente.',
  },
];

const LOCALES_SUPORTADOS = {
  'pt-BR': { locale: 'pt-BR', appLocale: 'pt-BR', htmlLang: 'pt-BR', rotulo: 'Português (Brasil)' },
  'pt-PT': { locale: 'pt-PT', appLocale: 'pt-PT', htmlLang: 'pt-PT', rotulo: 'Português (Portugal)' },
  en: { locale: 'en', appLocale: 'en-US', htmlLang: 'en-US', rotulo: 'English (United States)' },
  es: { locale: 'es', appLocale: 'es-ES', htmlLang: 'es-ES', rotulo: 'Español (España)' },
};

function secoesPadraoPara(idiomaPadrao) {
  if (idiomaPadrao === 'pt-PT') return SECOES_PADRAO_PT_PT;
  if (idiomaPadrao === 'en') return SECOES_PADRAO_EN;
  if (idiomaPadrao === 'es') return SECOES_PADRAO_ES;
  return SECOES_PADRAO;
}

function metadadosHomePara(idiomaPadrao, nome, primeiraSecao) {
  if (idiomaPadrao === 'en') {
    return {
      tagline: `${nome} documentation`,
      titulo: `${nome} documentation`,
      acao: `View ${primeiraSecao.rotulo}`,
    };
  }
  if (idiomaPadrao === 'es') {
    return {
      tagline: `Documentación de ${nome}`,
      titulo: `Documentación de ${nome}`,
      acao: `Ver ${primeiraSecao.rotulo}`,
    };
  }
  return {
    tagline: `Documentação do ${nome}`,
    titulo: `Documentação do ${nome}`,
    acao: `Ver ${primeiraSecao.rotulo}`,
  };
}

// ------------------------------------------------------------------ cores

/** #rrggbb -> {h, s, l} em graus e porcentagem. */
function hexParaHsl(hex) {
  const limpo = String(hex).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(limpo)) return { h: 220, s: 70, l: 40 };
  const r = parseInt(limpo.slice(0, 2), 16) / 255;
  const g = parseInt(limpo.slice(2, 4), 16) / 255;
  const b = parseInt(limpo.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Monta o tema a partir de uma cor só.
 *
 * A estrutura (quais tokens existem, o que cada um pinta) vive em
 * compartilhado/standalone/runtime.css. Aqui só se define o valor de cada um.
 */
function temaCss(nome, corPrimaria) {
  const { h, s: sBruto, l: lBruto } = hexParaHsl(corPrimaria);
  const ehNeutra = sBruto < 12;
  // Saturação muito baixa deve continuar neutra (cinzas/grafite). Só forçamos
  // saturação mínima nas cores realmente cromáticas.
  const s = ehNeutra ? Math.max(0, Math.min(8, sBruto)) : Math.min(95, Math.max(45, sBruto));
  const sEscuro = ehNeutra ? 0 : Math.round(s * 0.75);

  const claroSuave = ehNeutra ? 0 : 15;
  const claroMedio = ehNeutra ? 0 : 20;
  const textoClaro = ehNeutra ? 0 : 8;
  const textoMutedClaro = ehNeutra ? 0 : 10;
  const menuAtivoClaro = ehNeutra ? 0 : 60;
  const menuHoverClaro = ehNeutra ? 0 : 40;
  const hoverNavbarClaro = ehNeutra ? 0 : 80;
  const scrollClaro = ehNeutra ? 0 : 45;

  const escuroSuave = ehNeutra ? 0 : 15;
  const escuroNavbar = ehNeutra ? 0 : 16;
  const escuroMedio = ehNeutra ? 0 : 18;
  const menuAtivoEscuro = ehNeutra ? 0 : 55;
  const scrollEscuro = ehNeutra ? 0 : 45;

  const heroInicioSat = ehNeutra ? 0 : 15;
  const heroFimSat = ehNeutra ? 0 : s;
  const heroFimLight = ehNeutra ? Math.max(20, Math.min(28, lBruto + 2)) : 20;
  const heroBtnTextoSat = ehNeutra ? 0 : 60;

  return `/**
 * ${nome} — identidade visual do portal de documentação
 * ----------------------------------------------------------------------------
 * Gerado a partir da cor ${corPrimaria}. Só cor mora aqui: layout e componentes
 * ficam em compartilhado/standalone/runtime.css, que consome estes tokens.
 *
 * Para mudar a identidade do produto, mexa nos valores abaixo — nenhum outro
 * arquivo precisa saber.
 */

/* ============================================================
   TEMA CLARO
   ============================================================ */
:root {
  --doc-primary: hsl(${h} ${s}% 35%);
  --doc-primary-hover: hsl(${h} ${s}% 28%);
  --doc-navbar-bg: hsl(${h} ${claroSuave}% 12%);
  --doc-sidebar-bg: hsl(${h} ${claroMedio}% 98%);
  --doc-background: hsl(0 0% 100%);
  --doc-surface: hsl(0 0% 100%);
  --doc-surface-2: hsl(${h} ${claroMedio}% 96%);
  --doc-border: hsl(${h} ${claroSuave}% 90%);
  --doc-text: hsl(${h} ${textoClaro}% 12%);
  --doc-text-muted: hsl(${h} ${textoMutedClaro}% 45%);
  --doc-success: hsl(145 80% 42%);
  --doc-warning: hsl(36 100% 48%);
  --doc-danger: hsl(356 95% 45%);

  --doc-pre-bg: hsl(${h} ${claroMedio}% 97%);
  --doc-menu-ativo-bg: hsl(${h} ${menuAtivoClaro}% 94%);
  --doc-menu-hover-bg: hsl(${h} ${menuHoverClaro}% 96%);
  --doc-menu-ativo-cor: var(--doc-primary-hover);
  --doc-navbar-link-hover: hsl(${h} ${hoverNavbarClaro}% 65%);
  --doc-footer-bg: var(--doc-navbar-bg);
  --doc-scrollbar-thumb: hsl(${h} ${scrollClaro}% 72%);
  --doc-selection: hsl(${h} ${s}% 35% / 0.25);

  /* --- Homepage --- */
  --doc-hero-gradient: linear-gradient(135deg, hsl(${h} ${heroInicioSat}% 12%) 0%, hsl(${h} ${heroFimSat}% ${heroFimLight}%) 100%);
  --doc-hero-btn-bg: hsl(${h} ${s}% 45%);
  --doc-hero-btn-bg-hover: hsl(${h} ${s}% 52%);
  --doc-hero-btn-text: hsl(${h} ${heroBtnTextoSat}% 8%);

}

/* ============================================================
   TEMA ESCURO
   ============================================================ */
[data-theme='dark'] {
  --doc-primary: hsl(${h} ${sEscuro}% 58%);
  --doc-primary-hover: hsl(${h} ${sEscuro}% 68%);
  --doc-navbar-bg: hsl(${h} ${escuroNavbar}% 8%);
  --doc-sidebar-bg: hsl(${h} ${escuroSuave}% 12%);
  --doc-background: hsl(${h} ${escuroSuave}% 10%);
  --doc-surface: hsl(${h} ${escuroSuave}% 13%);
  --doc-surface-2: hsl(${h} ${escuroMedio}% 16%);
  --doc-border: hsl(${h} ${escuroMedio}% 22%);
  --doc-text: hsl(${h} ${claroMedio}% 96%);
  --doc-text-muted: hsl(${h} ${escuroSuave}% 65%);
  --doc-success: hsl(145 70% 48%);
  --doc-warning: hsl(36 100% 55%);
  --doc-danger: hsl(356 85% 60%);

  --doc-pre-bg: hsl(${h} ${escuroMedio}% 12%);
  --doc-menu-ativo-bg: hsl(${h} ${menuAtivoEscuro}% 16%);
  --doc-menu-hover-bg: hsl(${h} ${escuroMedio}% 16%);
  --doc-menu-ativo-cor: hsl(${h} ${sEscuro}% 70%);
  --doc-footer-bg: hsl(${h} ${claroMedio}% 6%);
  --doc-scrollbar-thumb: hsl(${h} ${scrollEscuro}% 34%);

}
`;
}

// ------------------------------------------------------------------ conteúdo

function paginaInicial(nome, secao, idiomaPadrao = 'pt-BR') {
  if (idiomaPadrao === 'pt-PT') {
    return `# ${secao.rotulo}

${secao.descricao}

:::info Página inicial gerada automaticamente
Esta secção ainda não tem conteúdo. Substitua este texto pelo que interessa ao
${nome} e crie novos ficheiros \`.md\` nesta pasta. Para ordenar páginas, use um
prefixo numérico no nome, por exemplo \`01-primeiros-passos.md\`.
:::

## Por onde começar

- Os ficheiros desta secção ficam em \`projetos/${'${id}'}/docs/${secao.id}/\`.
- As imagens ficam em \`projetos/${'${id}'}/static/img/\` e são referenciadas como \`/img/ficheiro.png\`.
- Para ver o resultado enquanto escreve, utilize o botão **Gerar build** no painel,
  ou \`npm run start -- ${'${id}'}\` para recarregar após cada alteração.
`;
  }

  if (idiomaPadrao === 'en') {
    return `# ${secao.rotulo}

${secao.descricao}

:::info Automatically generated landing page
This section does not have content yet. Replace this text with information that
is relevant to ${nome} and create new \`.md\` files in this folder. To order
pages, prefix the file name with a number, for example \`01-getting-started.md\`.
:::

## Where to start

- Files for this section live in \`projetos/${'${id}'}/docs/${secao.id}/\`.
- Images live in \`projetos/${'${id}'}/static/img/\` and are referenced as \`/img/file.png\`.
- To preview changes while writing, use **Gerar build** in the Playsaurus panel,
  or run \`npm run start -- ${'${id}'}\` to reload after each change.
`;
  }

  if (idiomaPadrao === 'es') {
    return `# ${secao.rotulo}

${secao.descricao}

:::info Página inicial generada automáticamente
Esta sección todavía no tiene contenido. Sustituye este texto por la información
relevante para ${nome} y crea nuevos archivos \`.md\` en esta carpeta. Para
ordenar páginas, usa un prefijo numérico, por ejemplo \`01-primeros-pasos.md\`.
:::

## Por dónde empezar

- Los archivos de esta sección se encuentran en \`projetos/${'${id}'}/docs/${secao.id}/\`.
- Las imágenes se encuentran en \`projetos/${'${id}'}/static/img/\` y se referencian como \`/img/archivo.png\`.
- Para ver los cambios mientras escribes, usa **Gerar build** en el panel de Playsaurus,
  o ejecuta \`npm run start -- ${'${id}'}\` para recargar después de cada cambio.
`;
  }

  return `# ${secao.rotulo}

${secao.descricao}

:::info Página inicial gerada automaticamente
Esta seção ainda não tem conteúdo. Troque este texto pelo que interessa ao
${nome} e crie novos arquivos \`.md\` nesta pasta. Para ordenar páginas, use um
prefixo numérico no nome, por exemplo \`01-primeiros-passos.md\`.
:::

## Por onde começar

- Os arquivos desta seção ficam em \`projetos/${'${id}'}/docs/${secao.id}/\`.
- Imagens ficam em \`projetos/${'${id}'}/static/img/\` e são referenciadas como \`/img/arquivo.png\`.
- Para ver o resultado enquanto escreve, use o botão **Gerar build** no painel,
  ou \`npm run start -- ${'${id}'}\` para recarregar a cada alteração.
`;
}

const LOGIN_PAGE = (nome) => `import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../../../compartilhado/playwright/BasePage';

/**
 * MODELO — precisa ser ajustado para o ${nome}.
 *
 * Os seletores abaixo são um chute razoável. Abra a tela de login do produto,
 * confira os ids/rótulos reais e troque. Enquanto isso não for feito, a captura
 * de screenshots vai falhar no passo de autenticação — e é para falhar mesmo,
 * em vez de gerar imagens da tela errada.
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    // Selecionar por id costuma ser mais estável que por texto, que muda com o idioma.
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('form button[type="submit"]');
  }

  async goto() {
    const appLocale = process.env.PLAYSAURUS_AUDIT_APP_LOCALE || process.env.DOC_SCREENSHOT_APP_LOCALE;
    if (appLocale) {
      await this.page.addInitScript((locale) => {
        try { localStorage.setItem('app-language', locale); } catch { /* ignore */ }
      }, appLocale);
    }
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.waitForPageLoad();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // Ajuste para as rotas que o produto usa depois de autenticar.
    await this.page.waitForURL(/dashboard|home|app/i, { waitUntil: 'networkidle' });
  }
}
`;

const AUTH_SETUP = (idMaiusculo) => `import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { LoginPage } from './LoginPage';

const { projetoAtivo } = require('../../../compartilhado/projeto.cjs');

const authFile = projetoAtivo().arquivoAuth;

setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(
    process.env.${idMaiusculo}_TEST_USER_EMAIL || '',
    process.env.${idMaiusculo}_TEST_USER_PASSWORD || ''
  );
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
`;

const SPEC = (nome) => `import { test } from '@playwright/test';
import { BasePage } from '../../../compartilhado/playwright/BasePage';

/**
 * MODELO — as telas abaixo são exemplos e precisam virar as do ${nome}.
 *
 * Cada teste navega até uma rota e salva a imagem em
 * static/img/usabilidade/geradas/, que os artigos referenciam como
 * \`/img/usabilidade/geradas/<nome>.png\`.
 *
 * Rotas e seletores são de cada produto — este arquivo não é compartilhado
 * justamente por isso.
 */

// A tela de login precisa ser capturada SEM sessão autenticada.
test.describe('Login (sem autenticação)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Login', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/login');
    await base.takeScreenshot('01-login');
  });
});

test.describe('Telas autenticadas', () => {
  test('Início', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/');
    await base.takeScreenshot('02-inicio');
  });

  // Copie o bloco acima para cada tela que a documentação precisar mostrar.
});
`;

const ENV_EXEMPLO = (nome, idMaiusculo, urlLocal) => `# Screenshots do ${nome} — copie para .env (mesma pasta) e preencha.
# O .env não é versionado. Use uma conta de demonstração, nunca dados reais.
${idMaiusculo}_BASE_URL=${urlLocal}
${idMaiusculo}_TEST_USER_EMAIL=
${idMaiusculo}_TEST_USER_PASSWORD=

# A auditoria usa estas mesmas credenciais no perfil "padrao".
# Para vários perfis/roles, adicione as variáveis aqui e configure auditoria.json.

# Opcional: sobrescreve onde fica o repositório do produto nesta máquina.
# Normalmente não é preciso — o painel resolve isso.
# ${idMaiusculo}_REPO=
`;

const README = (nome, id, url, baseUrl, repositorio, destino) => `# ${nome} — documentação

- **Publicada em:** ${url}${baseUrl}
- **Repositório do produto:** \`${path.basename(repositorio)}\`
- **Destino:** \`${destino}\`
- **Formato padrão:** standalone (um \`index.html\` + \`help-index.json\` + PDFs)

## Fluxo

\`\`\`bash
npm run i18n:init -- ${id}        # cria scaffolds dos idiomas adicionais configurados
npm run i18n:check -- ${id}       # mostra traduções pendentes
npm run screenshots -- ${id}      # captura os idiomas configurados
npm run auditoria -- ${id}         # auditoria Playwright read-only
npm run pdf -- ${id}              # PDFs por idioma
npm run build -- ${id}            # gera interno + cliente a partir do mesmo modelo de páginas
npm run publish -- ${id}          # publica só o artefato final
\`\`\`

O Playsaurus compila Markdown diretamente para o portal standalone. Não há
build HTML intermediário nem runtime de outro gerador no artefato publicado.

## Idiomas

O idioma escolhido na criação do projeto fica em \`docs/\` e é o único idioma
habilitado inicialmente. Para disponibilizar traduções, adicione os locales
pretendidos em \`idiomas.disponiveis\` no \`projeto.json\` e execute
\`npm run i18n:init -- ${id}\`.

As traduções ficam em
\`i18n/<locale>/\`, espelhando a estrutura de \`docs/\`. Locales ainda marcados
como \`PLAYSAURUS_TRANSLATION_PENDING\` não entram no build enquanto a tradução
não estiver pronta.

O runtime final usa hash routing para continuar funcionando com um único arquivo
físico. O idioma inicial respeita \`localStorage["app-language"]\` quando o
produto hospedeiro já usa essa chave.

## Screenshots

Cada idioma é capturado separadamente. O locale padrão permanece na pasta atual
e os demais entram em subpastas \`en/\`, \`es/\` etc. O compilador standalone
embute a imagem correspondente ao idioma automaticamente.

## Auditoria Playwright

A auditoria read-only usa \`auditoria.json\`, separado do \`projeto.json\`. O perfil
\`padrao\` reaproveita as credenciais de screenshots; para testar várias roles,
adicione perfis com \`envEmail\`, \`envPassword\`, \`rotas\`, \`rotasProibidas\`,
\`menusVisiveis\`, \`menusOcultos\` e, quando útil, \`textosEsperados\`.

Para executar só uma role: \`npm run auditoria -- ${id} --perfil <id-do-perfil>\`.

O resumo é gravado em
\`projetos/${id}/output/auditoria/relatorio.md\`. Screenshots e traces
de falha ficam em \`projetos/${id}/.playsaurus/auditoria/\`.
`;

// ------------------------------------------------------------------ criação

/**
 * Cria projetos/<id>/ inteiro. Devolve o caminho e a lista de arquivos criados.
 *
 * Escreve tudo ou nada: se algo falhar no meio, a pasta parcial é removida —
 * um projeto meio criado quebraria o painel para todos os outros, já que
 * `listarProjetos` varre o diretório.
 */
function criarProjeto({ id, nome, url, baseUrl, repositorio, destino, cor, secoes, idiomaPadrao }) {
  const problema = validarId(id);
  if (problema) throw new Error(problema);
  if (!nome) throw new Error('Informe o nome do produto.');
  if (!repositorio) throw new Error('Informe o repositório do produto.');
  if (!fs.existsSync(repositorio)) throw new Error(`A pasta ${repositorio} não existe.`);

  const urlFinal = (url || 'http://localhost:8080').replace(/\/+$/, '');
  let baseFinal = baseUrl || '/docs/';
  if (!baseFinal.startsWith('/')) baseFinal = `/${baseFinal}`;
  if (!baseFinal.endsWith('/')) baseFinal += '/';
  const destinoFinal = destino || 'public/docs';
  const idiomaFinal = idiomaPadrao || 'pt-BR';
  if (!LOCALES_SUPORTADOS[idiomaFinal]) {
    throw new Error('Idioma padrão inválido. Use pt-BR, pt-PT, en ou es.');
  }
  const secoesFinais = secoes?.length ? secoes : secoesPadraoPara(idiomaFinal);
  const homePadrao = metadadosHomePara(idiomaFinal, nome, secoesFinais[0]);
  const idMaiusculo = id.toUpperCase().replace(/-/g, '_');

  const dir = path.join(DIR_PROJETOS, id);
  const criados = [];
  const escrever = (relativo, conteudo) => {
    const alvo = path.join(dir, relativo);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, conteudo);
    criados.push(relativo.split(path.sep).join('/'));
  };

  try {
    fs.mkdirSync(dir, { recursive: false });

    const projeto = {
      nome,
      tagline: homePadrao.tagline,
      url: urlFinal,
      baseUrl: baseFinal,
      repositorio: {
        // Relativo à raiz da instalação, para funcionar em outra máquina.
        relativo: path.relative(RAIZ, repositorio).split(path.sep).join('/'),
        env: `${idMaiusculo}_REPO`,
        destino: destinoFinal,
      },
      screenshots: {
        envBaseUrl: `${idMaiusculo}_BASE_URL`,
        baseUrlPadrao: 'http://localhost:8080',
        destino: 'img/usabilidade/geradas',
      },
      idiomas: {
        padrao: idiomaFinal,
        exigirTraducoes: false,
        // O idioma escolhido no cadastro é o único habilitado inicialmente.
        // Outros idiomas só entram no build quando forem adicionados de forma
        // explícita a idiomas.disponiveis no projeto.json.
        disponiveis: [LOCALES_SUPORTADOS[idiomaFinal]],
      },
      secoes: secoesFinais,
      home: {
        titulo: homePadrao.titulo,
        acaoPrincipal: { rotulo: homePadrao.acao, para: `/${secoesFinais[0].id}` },
      },
      // O publish sempre gera help-index.json. Se houver uma página chamada
      // perguntas-frequentes.md, ela é localizada automaticamente.
      indiceAjuda: {},
    };

    escrever('projeto.json', `${JSON.stringify(projeto, null, 2)}\n`);
    escrever('tema.css', temaCss(nome, cor || '#2f6feb'));

    secoesFinais.forEach((secao) => {
      escrever(
        path.join('docs', secao.id, 'index.md'),
        paginaInicial(nome, secao, idiomaFinal).replace(/\$\{id\}/g, id),
      );
    });

    // Pasta de assets estáticos do projeto.
    escrever(path.join('static', 'img', 'usabilidade', 'geradas', '.gitkeep'), '');

    escrever(path.join('playwright', 'LoginPage.ts'), LOGIN_PAGE(nome));
    escrever(path.join('playwright', 'auth.setup.ts'), AUTH_SETUP(idMaiusculo));
    escrever(path.join('playwright', 'screenshots.spec.ts'), SPEC(nome));
    escrever('.env.example', ENV_EXEMPLO(nome, idMaiusculo, 'http://localhost:8080'));
    escrever(
      'README.md',
      README(nome, id, urlFinal, baseFinal, repositorio, destinoFinal),
    );

    return { dir, criados };
  } catch (e) {
    // Não deixa esqueleto pela metade atrapalhando os outros projetos.
    fs.rmSync(dir, { recursive: true, force: true });
    if (e.code === 'EEXIST') throw new Error(`A pasta projetos/${id} já existe.`);
    throw e;
  }
}


/**
 * Repositórios candidatos dentro de uma pasta-base.
 *
 * "Candidato" = pasta que parece um projeto (tem .git ou package.json). O painel
 * mostra também se ela tem `public/`, porque sem isso não há onde publicar.
 */
function repositoriosCandidatos(base) {
  if (!base || !fs.existsSync(base)) return [];

  const jaUsados = new Map();
  for (const id of listarProjetos()) {
    try {
      const dados = JSON.parse(
        fs.readFileSync(path.join(DIR_PROJETOS, id, 'projeto.json'), 'utf8'),
      );
      if (dados.repositorio?.relativo) {
        jaUsados.set(path.resolve(RAIZ, dados.repositorio.relativo), id);
      }
    } catch {
      // Projeto ilegível não impede listar repositórios.
    }
  }

  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const caminho = path.join(base, e.name);
      return {
        nome: e.name,
        caminho,
        temGit: fs.existsSync(path.join(caminho, '.git')),
        temPackage: fs.existsSync(path.join(caminho, 'package.json')),
        temPublic: fs.existsSync(path.join(caminho, 'public')),
        usadoPor: jaUsados.get(caminho) ?? null,
      };
    })
    .filter((r) => r.temGit || r.temPackage)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Apaga um produto: a pasta projetos/<id>/ e os artefatos regeneráveis dele.
 *
 * NUNCA toca o repositório do produto nem o public/docs publicado — só o que
 * vive dentro desta instalação. É a saída para recriar um produto que ficou com
 * algum defeito.
 */
function excluirProjeto(id) {
  if (!listarProjetos().includes(id)) {
    throw new Error(`Produto "${id}" não existe.`);
  }

  const dir = path.resolve(DIR_PROJETOS, id);
  // Trava de segurança: o alvo tem que ser um filho direto de projetos/.
  // Sem isto, um id com "../" apagaria pasta fora daqui.
  if (path.dirname(dir) !== path.resolve(DIR_PROJETOS)) {
    throw new Error('Caminho inesperado — exclusão abortada.');
  }

  fs.rmSync(dir, { recursive: true, force: true });
  // Tira o caminho local, se houver, para não sobrar entrada órfã.
  salvarCaminhoLocal(id, null);

  return { id };
}

module.exports = {
  SECOES_PADRAO,
  criarProjeto,
  excluirProjeto,
  repositoriosCandidatos,
  temaCss,
};
