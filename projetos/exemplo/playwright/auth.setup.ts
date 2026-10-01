import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { LoginPage } from './LoginPage';

const { projetoAtivo } = require('../../../compartilhado/projeto.cjs');

const authFile = projetoAtivo().arquivoAuth;

setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(
    process.env.EXEMPLO_TEST_USER_EMAIL || '',
    process.env.EXEMPLO_TEST_USER_PASSWORD || ''
  );
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
