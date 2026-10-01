import { test } from '@playwright/test';
import { BasePage } from '../../../compartilhado/playwright/BasePage';

/**
 * MODELO — as telas abaixo são exemplos e precisam virar as do Playsaurus.
 *
 * Cada teste navega até uma rota e salva a imagem em
 * static/img/usabilidade/geradas/, que os artigos referenciam como
 * `/img/usabilidade/geradas/<nome>.png`.
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
