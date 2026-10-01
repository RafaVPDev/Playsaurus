import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { BasePage } from '../../compartilhado/playwright/BasePage';

type ConfiguracaoAuditoria = {
  ignorarConsole?: string[];
  ignorarUrls?: string[];
  mensagensAcessoNegado?: string[];
  menuSelector?: string;
  testarPesquisas?: boolean;
};

type Problema = {
  tipo: string;
  mensagem: string;
};

function correspondeAAlgum(valor: string, padroes: string[] = []) {
  return padroes.some((padrao) => {
    try {
      return new RegExp(padrao, 'i').test(valor);
    } catch {
      return valor.toLowerCase().includes(padrao.toLowerCase());
    }
  });
}

function normalizarTexto(valor: string) {
  return valor.replace(/\s+/g, ' ').trim();
}

/**
 * Auditoria técnica read-only para páginas do produto.
 *
 * A classe registra erros de console, exceções de página, falhas de rede e
 * respostas HTTP 4xx/5xx enquanto a rota é visitada. Também verifica página vazia,
 * overflow horizontal e links visíveis sem destino útil.
 */
export class AuditPage extends BasePage {
  private readonly configuracao: ConfiguracaoAuditoria;
  private readonly problemas: Problema[] = [];
  private monitorando = false;

  constructor(page: Page, configuracao: ConfiguracaoAuditoria = {}) {
    super(page);
    this.configuracao = configuracao;
  }

  iniciarMonitoramento() {
    if (this.monitorando) return;
    this.monitorando = true;

    this.page.on('console', (mensagem) => {
      if (mensagem.type() !== 'error') return;
      const texto = mensagem.text();
      if (correspondeAAlgum(texto, this.configuracao.ignorarConsole)) return;

      // Chromium escreve apenas uma mensagem genérica para recursos HTTP 4xx/5xx.
      // O listener de `response` abaixo regista o método, a URL exata e, quando
      // possível, o corpo da resposta, portanto evitamos duplicar o mesmo erro.
      if (/^Failed to load resource: the server responded with a status of \d{3}/i.test(texto)) return;

      this.adicionar('console.error', texto);
    });

    this.page.on('pageerror', (erro) => {
      this.adicionar('pageerror', erro.message);
    });

    this.page.on('requestfailed', (requisicao) => {
      const url = requisicao.url();
      if (correspondeAAlgum(url, this.configuracao.ignorarUrls)) return;
      const falha = requisicao.failure()?.errorText || 'falha de rede';
      if (/ERR_ABORTED/i.test(falha)) return;
      this.adicionar('requestfailed', `${requisicao.method()} ${url} — ${falha}`);
    });

    this.page.on('response', async (resposta) => {
      const status = resposta.status();
      if (status < 400) return;

      const url = resposta.url();
      if (correspondeAAlgum(url, this.configuracao.ignorarUrls)) return;

      let detalhe = '';
      const contentType = resposta.headers()['content-type'] || '';
      if (/json|text\//i.test(contentType)) {
        try {
          const corpo = normalizarTexto(await resposta.text());
          if (corpo) detalhe = ` — ${corpo.slice(0, 800)}`;
        } catch {
          // Nem todas as respostas permitem leitura do corpo (redirect/stream/etc.).
        }
      }

      this.adicionar(
        'http',
        `${status} ${resposta.request().method()} ${url}${detalhe}`,
      );
    });
  }

  async auditarRota(rota: string, testInfo: TestInfo) {
    this.iniciarMonitoramento();

    const resposta = await this.page.goto(rota, { waitUntil: 'domcontentloaded' });
    await this.aguardarEstabilizacao();

    if (resposta && resposta.status() >= 400) {
      this.adicionar('documento', `${resposta.status()} ao abrir ${rota}`);
    }

    const normalizarPath = (valor: string) => {
      const limpo = valor.length > 1 ? valor.replace(/\/+$/, '') : valor;
      return limpo || '/';
    };
    const destino = new URL(rota, 'http://playsaurus.local');
    const atual = new URL(this.page.url());
    if (normalizarPath(atual.pathname) !== normalizarPath(destino.pathname)) {
      this.adicionar('acesso', `A rota permitida ${rota} redirecionou para ${atual.pathname}${atual.search}.`);
    }

    const diagnostico = await this.page.evaluate(() => {
      const body = document.body;
      const root = document.documentElement;
      const texto = body?.innerText?.replace(/\s+/g, ' ').trim() || '';
      const temConteudoVisual = Boolean(body?.querySelector('img,svg,canvas,video,iframe'));
      const overflow = Math.max(root.scrollWidth, body?.scrollWidth || 0) - window.innerWidth;
      const linksSemDestino = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .filter((link) => {
          const estilo = getComputedStyle(link);
          const visivel = estilo.display !== 'none' && estilo.visibility !== 'hidden' && link.getClientRects().length > 0;
          if (!visivel) return false;
          const href = (link.getAttribute('href') || '').trim();
          return href === '';
        })
        .slice(0, 10)
        .map((link) => (link.textContent || link.getAttribute('aria-label') || '(sem texto)').trim());

      return {
        texto,
        temConteudoVisual,
        overflow,
        linksSemDestino,
        titulo: document.title,
      };
    });

    if (!diagnostico.texto && !diagnostico.temConteudoVisual) {
      this.adicionar('conteúdo', 'A página parece vazia.');
    }
    if (diagnostico.overflow > 4) {
      this.adicionar('layout', `Overflow horizontal de ${Math.round(diagnostico.overflow)} px.`);
    }
    if (diagnostico.linksSemDestino.length) {
      this.adicionar(
        'links',
        `Links visíveis sem destino: ${diagnostico.linksSemDestino.map((texto) => `“${texto}”`).join(', ')}`,
      );
    }

    if (this.configuracao.testarPesquisas) {
      await this.exercitarPesquisas();
    }

    if (this.problemas.length) {
      await testInfo.attach('diagnostico.txt', {
        body: Buffer.from(this.formatarProblemas(rota, diagnostico.titulo), 'utf8'),
        contentType: 'text/plain',
      });
    }

    expect(this.problemas, this.formatarProblemas(rota, diagnostico.titulo)).toEqual([]);
  }

  async confirmarBloqueio(rota: string, testInfo: TestInfo) {
    const destino = new URL(rota, 'http://playsaurus.local');
    const resposta = await this.page.goto(rota, { waitUntil: 'domcontentloaded' });

    // SPAs costumam validar a role depois da hidratação. Damos alguns segundos
    // para o redirecionamento de segurança acontecer antes de concluir que a
    // rota ficou acessível.
    await Promise.race([
      this.page
        .waitForURL(
          (url) => url.pathname !== destino.pathname || url.search !== destino.search,
          { timeout: 3_000 },
        )
        .catch(() => {}),
      this.page.waitForTimeout(3_000),
    ]);
    await this.aguardarEstabilizacao(3_000);

    const status = resposta?.status() ?? 0;
    const atual = new URL(this.page.url());
    const redirecionou = atual.pathname !== destino.pathname || atual.search !== destino.search;
    const texto = await this.page.locator('body').innerText().catch(() => '');
    const padroes = this.configuracao.mensagensAcessoNegado?.length
      ? this.configuracao.mensagensAcessoNegado
      : [
          'acesso negado',
          'não autorizado',
          'nao autorizado',
          'sem permissão',
          'sem permissao',
          'forbidden',
          'unauthorized',
          'access denied',
        ];
    const mensagemDeBloqueio = correspondeAAlgum(texto, padroes);
    const statusBloqueado = [401, 403, 404].includes(status);

    if (!(redirecionou || mensagemDeBloqueio || statusBloqueado)) {
      await testInfo.attach('acesso-direto.txt', {
        body: Buffer.from(
          `Rota proibida: ${rota}\nURL final: ${this.page.url()}\nHTTP: ${status || '(SPA/sem resposta principal)'}\n`,
          'utf8',
        ),
        contentType: 'text/plain',
      });
    }

    expect(
      redirecionou || mensagemDeBloqueio || statusBloqueado,
      `A rota ${rota} deveria estar bloqueada para este perfil, mas permaneceu acessível em ${this.page.url()}.`,
    ).toBeTruthy();
  }

  async confirmarMenus(
    rotaInicial: string,
    menusVisiveis: string[],
    menusOcultos: string[],
    testInfo: TestInfo,
  ) {
    await this.page.goto(rotaInicial || '/', { waitUntil: 'domcontentloaded' });
    await this.aguardarEstabilizacao();

    const raiz = this.configuracao.menuSelector
      ? this.page.locator(this.configuracao.menuSelector).first()
      : this.page.locator('body');

    if (this.configuracao.menuSelector) {
      await raiz.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    }

    const estado = await this.elementosDeMenu(raiz).evaluateAll((elementos, esperado) => {
      const normalizar = (valor: string | null | undefined) => (valor || '').replace(/\s+/g, ' ').trim();
      const visivel = (elemento: Element) => {
        const html = elemento as HTMLElement;
        const estilo = getComputedStyle(html);
        return estilo.display !== 'none' && estilo.visibility !== 'hidden' && html.getClientRects().length > 0;
      };
      const rotulos = new Set(
        elementos
          .filter(visivel)
          .flatMap((elemento) => [
            normalizar(elemento.textContent),
            normalizar(elemento.getAttribute('aria-label')),
            normalizar(elemento.getAttribute('title')),
          ])
          .filter(Boolean),
      );
      return Object.fromEntries(esperado.map((rotulo) => [rotulo, rotulos.has(rotulo)]));
    }, [...new Set([...menusVisiveis, ...menusOcultos])]);

    const ausentes = menusVisiveis.filter((rotulo) => !estado[rotulo]);
    const indevidos = menusOcultos.filter((rotulo) => estado[rotulo]);

    if (ausentes.length || indevidos.length) {
      await testInfo.attach('menus.txt', {
        body: Buffer.from(
          [
            `Rota inicial: ${rotaInicial || '/'}`,
            this.configuracao.menuSelector ? `Escopo do menu: ${this.configuracao.menuSelector}` : '',
            ausentes.length ? `Menus esperados e ausentes: ${ausentes.join(', ')}` : '',
            indevidos.length ? `Menus que deveriam estar ocultos: ${indevidos.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          'utf8',
        ),
        contentType: 'text/plain',
      });
    }

    expect(ausentes, `Menus esperados não encontrados: ${ausentes.join(', ')}`).toEqual([]);
    expect(indevidos, `Menus indevidamente visíveis: ${indevidos.join(', ')}`).toEqual([]);
  }

  async confirmarTextos(
    rotaInicial: string,
    textosEsperados: string[],
    textosProibidos: string[],
    testInfo: TestInfo,
  ) {
    await this.page.goto(rotaInicial || '/', { waitUntil: 'domcontentloaded' });
    await this.aguardarEstabilizacao();

    const textoPagina = normalizarTexto(await this.page.locator('body').innerText().catch(() => ''));
    const textoMinusculo = textoPagina.toLocaleLowerCase();
    const ausentes = textosEsperados.filter((texto) => !textoMinusculo.includes(normalizarTexto(texto).toLocaleLowerCase()));
    const indevidos = textosProibidos.filter((texto) => textoMinusculo.includes(normalizarTexto(texto).toLocaleLowerCase()));

    if (ausentes.length || indevidos.length) {
      await testInfo.attach('textos-do-perfil.txt', {
        body: Buffer.from(
          [
            `Rota inicial: ${rotaInicial || '/'}`,
            ausentes.length ? `Textos esperados e ausentes: ${ausentes.join(', ')}` : '',
            indevidos.length ? `Textos que não deveriam aparecer: ${indevidos.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          'utf8',
        ),
        contentType: 'text/plain',
      });
    }

    expect(ausentes, `Textos esperados não encontrados: ${ausentes.join(', ')}`).toEqual([]);
    expect(indevidos, `Textos indevidos encontrados: ${indevidos.join(', ')}`).toEqual([]);
  }

  private async exercitarPesquisas() {
    const campos = this.page.locator(
      'input[type="search"], input[placeholder*="Pesquisar" i], input[aria-label*="Pesquisar" i], input[placeholder*="Procurar" i], input[aria-label*="Procurar" i]',
    );
    const quantidade = Math.min(await campos.count(), 6);
    const termo = `playsaurus-sem-resultado-${Date.now()}`;

    for (let indice = 0; indice < quantidade; indice += 1) {
      const campo = campos.nth(indice);
      if (!(await campo.isVisible().catch(() => false))) continue;
      if (!(await campo.isEnabled().catch(() => false))) continue;

      const original = await campo.inputValue().catch(() => '');
      try {
        await campo.fill(termo);
        await this.page.waitForTimeout(220);
        const preenchido = await campo.inputValue();
        if (preenchido !== termo) {
          this.adicionar('pesquisa', 'Um campo de pesquisa visível não manteve o texto introduzido.');
        }
        await campo.fill(original);
        await this.page.waitForTimeout(120);
      } catch (erro) {
        this.adicionar(
          'pesquisa',
          `Não foi possível exercitar um campo de pesquisa: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      }
    }
  }

  private elementosDeMenu(raiz: Locator) {
    return raiz.locator('a,button,[role="link"],[role="menuitem"]');
  }

  private async aguardarEstabilizacao(timeout = 8_000) {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => {});
    await this.page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
    await this.page.waitForTimeout(250);
  }

  private adicionar(tipo: string, mensagem: string) {
    const chave = `${tipo}:${mensagem}`;
    if (this.problemas.some((problema) => `${problema.tipo}:${problema.mensagem}` === chave)) return;
    this.problemas.push({ tipo, mensagem });
  }

  private formatarProblemas(rota: string, titulo?: string) {
    const cabecalho = [`Rota: ${rota}`, `URL: ${this.page.url()}`, `Título: ${titulo || '(sem título)'}`];
    if (!this.problemas.length) return cabecalho.join('\n');
    return `${cabecalho.join('\n')}\n\nProblemas encontrados:\n${this.problemas
      .map((problema) => `- [${problema.tipo}] ${problema.mensagem}`)
      .join('\n')}`;
  }
}
