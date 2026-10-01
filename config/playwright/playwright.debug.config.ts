import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
const { projetoAtivo } = require('../../compartilhado/projeto.cjs');
const p = projetoAtivo(); dotenv.config({ path: p.arquivoEnv });
const e = p.screenshots?.envBaseUrl;
const idiomaPadrao = p.idiomas.disponiveis.find((i: { locale: string; appLocale?: string }) => i.locale === p.idiomas.padrao);
if (!process.env.DOC_SCREENSHOT_APP_LOCALE) process.env.DOC_SCREENSHOT_APP_LOCALE = idiomaPadrao?.appLocale || p.idiomas.padrao;
export default defineConfig({ testDir: p.dirPlaywright, outputDir:p.dirPlaywrightResultados, workers:1, retries:0, reporter:'list', timeout:120000,
  use:{ baseURL:(e&&process.env[e])||'http://localhost:8080', ignoreHTTPSErrors:true, locale:idiomaPadrao?.appLocale||p.idiomas.padrao },
  projects:[{ name:'chromium', testMatch:/_debug\.spec\.ts/, use:{...devices['Desktop Chrome'], viewport:{width:1440,height:900}, storageState:p.arquivoAuth } }] });
