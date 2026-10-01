import { type Page } from '@playwright/test';

/**
 * Sobreposições para os vídeos de jornada — cursor visível e legenda.
 *
 * O Playwright não desenha o mouse nem legenda no vídeo. Como o vídeo grava a
 * própria página, injetamos os dois como elementos na página (via addInitScript,
 * para sobreviverem a cada navegação) e eles entram gravados naturalmente.
 *
 * Reutilizável por qualquer jornada de qualquer produto.
 */
export async function installOverlay(page: Page) {
  await page.addInitScript(() => {
    const ID_CURSOR = '__pw_cursor';
    const ID_LEGENDA = '__pw_legenda';

    function montar() {
      if (document.getElementById(ID_CURSOR)) return;

      // ---- cursor ----
      const cursor = document.createElement('div');
      cursor.id = ID_CURSOR;
      cursor.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:22px', 'height:22px',
        'margin:-11px 0 0 -11px', 'border-radius:50%',
        'background:rgba(0,173,179,0.35)', 'border:2px solid #00ADB3',
        'box-shadow:0 0 0 2px rgba(255,255,255,0.6)',
        'pointer-events:none', 'z-index:2147483647',
        'transition:width .08s, height .08s, margin .08s, background .08s',
        'left:-100px', // começa fora da tela até o primeiro movimento
      ].join(';');
      document.body.appendChild(cursor);

      const mover = (e: MouseEvent) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      };
      document.addEventListener('mousemove', mover, true);
      document.addEventListener('mousedown', () => {
        cursor.style.width = '32px';
        cursor.style.height = '32px';
        cursor.style.margin = '-16px 0 0 -16px';
        cursor.style.background = 'rgba(0,173,179,0.6)';
      }, true);
      document.addEventListener('mouseup', () => {
        cursor.style.width = '22px';
        cursor.style.height = '22px';
        cursor.style.margin = '-11px 0 0 -11px';
        cursor.style.background = 'rgba(0,173,179,0.35)';
      }, true);

      // ---- legenda ----
      const legenda = document.createElement('div');
      legenda.id = ID_LEGENDA;
      legenda.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
        'max-width:80%', 'padding:10px 20px', 'border-radius:10px',
        'background:rgba(17,21,24,0.92)', 'color:#fff',
        'font:600 17px/1.4 Inter, system-ui, Segoe UI, Arial, sans-serif',
        'letter-spacing:.2px', 'text-align:center',
        'box-shadow:0 8px 24px rgba(0,0,0,.35)', 'pointer-events:none',
        'z-index:2147483647', 'opacity:0', 'transition:opacity .25s',
      ].join(';');
      document.body.appendChild(legenda);

      // Função global que o teste chama para trocar o texto da legenda.
      (window as unknown as { __setLegenda: (t: string) => void }).__setLegenda = (texto: string) => {
        legenda.textContent = texto;
        legenda.style.opacity = texto ? '1' : '0';
      };
    }

    if (document.body) montar();
    else document.addEventListener('DOMContentLoaded', montar);
  });
}

/** Atualiza a legenda exibida no vídeo. Texto vazio esconde. */
export async function legenda(page: Page, texto: string) {
  await page
    .evaluate((t) => (window as unknown as { __setLegenda?: (s: string) => void }).__setLegenda?.(t), texto)
    .catch(() => {});
}
