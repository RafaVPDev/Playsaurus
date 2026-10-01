import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Page, type Locator } from '@playwright/test';

const { projetoAtivo } = require('../projeto.cjs');

export type ScreenshotOptions = {
  /** Se quiser uma screenshot de um elemento específico (ex: modal), passe o Locator. */
  element?: Locator;
  /** true = página toda (scroll); false (padrão AGORA) = só viewport visível. */
  fullPage?: boolean;
  /** Padding extra em volta do element (se fornecido). Ex: 24 adiciona 24px em cada lado. */
  padding?: number;
};

export class BasePage {
  readonly page: Page;
  constructor(page: Page) { this.page = page; }

  static readonly LARGURA_PADRAO = 1680;
  static readonly ALTURA_PADRAO = 900;
  static readonly ALTURA_MINIMA = 780;
  static readonly ALTURA_MAXIMA = 1000;
  static readonly PADDING_LATERAL_EXTRA = 96;
  static readonly PADDING_VERTICAL_EXTRA = 40;

  private async garantirMargensFlutuantes() {
    try {
      const vp = this.page.viewportSize();
      const dimensoes = await this.page.evaluate((maxAlt) => {
        const sw = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0,
          document.documentElement.clientWidth,
        );
        let ultimoY = 0;
        document.querySelectorAll<HTMLElement>('body > *:not(script):not(style), main, section, [role="main"], [data-testid*="content"], [data-testid*="panel"]').forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.top > (maxAlt + 200)) return;
          ultimoY = Math.max(ultimoY, b.bottom || (el.offsetTop + el.offsetHeight));
        });
        document.querySelectorAll<HTMLElement>('table, [role="grid"], [role="list"], [data-testid*="table"], [data-testid*="grid"], [data-testid*="list"]').forEach((el) => {
          const b = el.getBoundingClientRect();
          if (!b.height || b.top > (maxAlt + 200)) return;
          ultimoY = Math.max(ultimoY, b.top + Math.min(b.height, maxAlt - 60));
        });
        return {
          scrollWidth: sw,
          ultimoBottom: ultimoY || document.documentElement.clientHeight,
        };
      }, BasePage.ALTURA_MAXIMA);

      const larguraDesejada = Math.max(
        BasePage.LARGURA_PADRAO,
        dimensoes.scrollWidth + BasePage.PADDING_LATERAL_EXTRA,
        vp?.width || BasePage.LARGURA_PADRAO,
      );
      const alturaBruta = Math.max(
        BasePage.ALTURA_MINIMA,
        dimensoes.ultimoBottom + BasePage.PADDING_VERTICAL_EXTRA,
        vp?.height || BasePage.ALTURA_PADRAO,
      );
      const alturaDesejada = Math.min(alturaBruta, BasePage.ALTURA_MAXIMA);

      const larguraFinal = Math.min(larguraDesejada, 3200);
      const alturaFinal = Math.min(alturaDesejada, 3200);
      if (!vp || vp.width !== larguraFinal || vp.height !== alturaFinal) {
        await this.page.setViewportSize({ width: larguraFinal, height: alturaFinal });
        await this.page.waitForTimeout(420);
        await this.prepareForScreenshot();
      }
    } catch {}
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async prepareForScreenshot() {
    await this.page.addStyleTag({ content: `
      *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}
      html,body{background:#EDEEF0!important}
    ` });
    await this.page.evaluate(() => document.fonts?.ready).catch(() => {});
  }

  /** Corta linhas de tabelas/cards que ficariam abaixo de 760px (1 tela) para a screenshot não ficar gigante. */
  async cortarConteudoLongo(offsetMaxPx = 760) {
    try {
      await this.page.evaluate((topMax) => {
        document.querySelectorAll('table, [role="grid"], [data-testid*="table"], [data-testid*="grid"], [data-testid*="list"]').forEach((el) => {
          const h = el as HTMLElement;
          h.style.maxHeight = `${topMax + 80}px`;
          h.style.overflow = 'hidden';
        });
        document.querySelectorAll('tr, [role="row"]').forEach((r) => {
          const row = r as HTMLElement;
          if (row.offsetTop > topMax) row.style.display = 'none';
        });
        document.querySelectorAll('main > *, section > *').forEach((child) => {
          const c = child as HTMLElement;
          const box = c.getBoundingClientRect();
          if (box.top > topMax + 80) c.style.display = 'none';
        });
      }, offsetMaxPx);
      await this.page.waitForTimeout(320);
    } catch {}
  }

  private destino(locale: string, projeto: any) {
    return locale === projeto.idiomas.padrao
      ? projeto.dirScreenshots
      : path.join(projeto.dirScreenshots, locale);
  }

  async takeScreenshot(name: string, opts: ScreenshotOptions = {}) {
    await this.waitForPageLoad();
    await this.prepareForScreenshot();

    const fullPage = opts.fullPage === true;
    const projeto = projetoAtivo();
    const locale = process.env.DOC_SCREENSHOT_LOCALE || projeto.idiomas.padrao;
    const destino = this.destino(locale, projeto);
    mkdirSync(destino, { recursive: true });
    const outPath = path.join(destino, `${name}.png`);

    if (!opts.element) {
      await this.garantirMargensFlutuantes();
    }

    if (opts.element) {
      const padding = typeof opts.padding === 'number' ? opts.padding : 48;
      try {
        await opts.element.evaluate((el, pad) => {
          const box = el.getBoundingClientRect();
          const w = Math.ceil(box.width + pad * 2);
          const h = Math.ceil(box.height + pad * 2);
          const targetW = Math.min(w, 4000);
          const targetH = Math.min(h, 4000);
          const vp = (window as any).__basePageOrigViewport;
          if (!vp) (window as any).__basePageOrigViewport = { w: window.innerWidth, h: window.innerHeight };
          window.resizeTo?.(targetW, targetH + 160);
        }, padding).catch(() => {});
        await this.page.waitForTimeout(350);
        await opts.element.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(250);
        await opts.element.screenshot({
          path: outPath,
          animations: 'disabled',
          timeout: 20000,
          padding: { top: padding, bottom: padding, left: padding, right: padding },
          mask: opts.element ? undefined : undefined,
        });
        return;
      } catch (e) {
        console.log(`   [takeScreenshot] elemento para "${name}" falhou, tentando fallback viewport → ${(e as Error).message}`);
      }
    }

    if (fullPage) {
      const scrollWidth = await this.page.evaluate(() => document.documentElement.scrollWidth);
      const viewport = this.page.viewportSize();
      if (viewport && scrollWidth > viewport.width) {
        await this.page.setViewportSize({ width: Math.min(scrollWidth + 48, 3000), height: viewport.height });
        await this.page.waitForTimeout(400);
        await this.prepareForScreenshot();
      }
      await this.page.screenshot({ path: outPath, fullPage: true, animations: 'disabled', timeout: 30000 });
      return;
    }

    await this.page.screenshot({ path: outPath, fullPage: false, animations: 'disabled', timeout: 20000 });
  }
}
