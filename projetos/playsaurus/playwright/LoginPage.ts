import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../../../compartilhado/playwright/BasePage';

/**
 * MODELO — precisa ser ajustado para o Playsaurus.
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
