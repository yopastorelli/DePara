const { test, expect } = require('@playwright/test');

async function openSlideshow(page, options = {}) {
  if (options.clock) await page.clock.install();
  await page.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
  if (options.fallback) {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen indisponível'));
    });
  }
  await page.request.post('/api/config', {
    data: {
      config: {
        slideshowSelectedPath: process.env.DEPARA_E2E_LAYOUT_IMAGES_DIR,
        slideshowConfig: { interval: options.interval ?? 60, recursive: false, extensions: ['.png'], preload: false, random: false,
          ...options.slideshowConfig },
        screensaverConfig: { enabled: false }
      }
    }
  });
  await page.goto('/ui', { waitUntil: 'domcontentloaded' });
  await page.locator('#splash-screen').waitFor({ state: 'hidden', timeout: 15000 });
  const onboarding = page.locator('#onboarding-overlay');
  if (await onboarding.isVisible()) {
    await page.locator('.onboarding-skip-btn').click();
    await onboarding.waitFor({ state: 'hidden' });
  }
  await page.locator('.action-slideshow-card').click();
  if (options.start === false) return;
  await page.locator('.slideshow-start-btn').click();
  await expect(page.locator('#slideshow-viewer')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#slideshow-image')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#static-fullscreen-btn')).toBeEnabled();
}

async function expectImageInsideViewport(page) {
  const geometry = await page.locator('#slideshow-image').evaluate((image) => {
    const box = image.getBoundingClientRect();
    const container = image.parentElement.getBoundingClientRect();
    const viewer = document.getElementById('slideshow-viewer');
    return {
      width: innerWidth, height: innerHeight,
      left: box.left, top: box.top, right: box.right, bottom: box.bottom,
      containerBottom: container.bottom,
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      overflowX: viewer.scrollWidth - viewer.clientWidth,
      overflowY: viewer.scrollHeight - viewer.clientHeight
    };
  });
  expect(geometry.naturalWidth).toBeGreaterThan(1000);
  expect(geometry.naturalHeight).toBeGreaterThan(500);
  expect(geometry.objectFit).toBe('contain');
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.containerBottom + 1);
  expect(geometry.overflowX).toBeLessThanOrEqual(1);
  expect(geometry.overflowY).toBeLessThanOrEqual(1);
}

test('setas, pausa, foco e fechamento funcionam sem erros', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openSlideshow(page, { fallback: true });
  const viewer = page.getByRole('dialog', { name: 'Visualizador de fotos', exact: true });
  await expect(viewer).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slideshow-filename')).toHaveText('02-paisagem.png');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#slideshow-filename')).toHaveText('01-retrato.png');
  await page.keyboard.press('Space');
  await expect(page.locator('#static-play-pause-btn')).toHaveAccessibleName('Reproduzir slideshow (Espaço)');
  await expect.poll(() => page.evaluate(() => window.deParaUI.autoPlayInterval)).toBeNull();
  await page.keyboard.press('Space');
  await expect(page.locator('#static-play-pause-btn')).toHaveAccessibleName('Pausar slideshow (Espaço)');
  await page.keyboard.press('Tab');
  await expect(page.locator('#static-favorite-btn')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#slideshow-viewer button:not(:disabled)').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#static-favorite-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page.locator('.action-slideshow-card')).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test('hover não desloca imagem nem botões de navegação', async ({ page }) => {
  await openSlideshow(page, { fallback: true });
  const image = page.locator('#slideshow-image');
  const next = page.locator('#static-next-btn');
  await page.mouse.move(2, 2);
  const initialImage = await image.boundingBox();
  const initialButton = await next.boundingBox();
  await image.hover();
  expect(await image.boundingBox()).toEqual(initialImage);
  await next.hover();
  expect(await next.boundingBox()).toEqual(initialButton);
  await next.click();
  await expect(page.locator('#slideshow-filename')).toHaveText('02-paisagem.png');
});

test('slideshow manual mantém o cursor e suspende o protetor de tela', async ({ page }) => {
  await openSlideshow(page, { fallback: true });
  await page.evaluate(() => {
    window.deParaUI.screensaverConfig.enabled = true;
    window.deParaUI.resetScreensaverTimer();
  });
  await expect.poll(() => page.evaluate(() => window.deParaUI.screensaverState.timerId)).toBeNull();
  await page.locator('#slideshow-image').hover();
  await expect(page.locator('#slideshow-viewer')).not.toHaveClass(/screensaver-mode/);
  await expect(page.locator('#slideshow-viewer')).toHaveCSS('cursor', 'default');
  await page.locator('#static-close-btn').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.deParaUI.screensaverState.timerId))).toBe(true);
});

test('interface e ícones não dependem de serviços externos', async ({ page }) => {
  const externalRequests = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:3100/')) externalRequests.push(request.url());
  });
  await openSlideshow(page, { fallback: true });
  const iconFonts = await page.evaluate(async () => {
    const loaded = await document.fonts.load('24px "Material Icons"', 'dashboard');
    return loaded.map(font => font.status);
  });
  expect(iconFonts).toEqual(['loaded']);
  expect(externalRequests).toEqual([]);
  const iconGeometry = await page.locator('.status-item .material-icons').first().evaluate(icon => {
    const style = getComputedStyle(icon);
    return { width: icon.getBoundingClientRect().width,
      content: parseFloat(style.fontSize) + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) };
  });
  expect(iconGeometry.width).toBeGreaterThanOrEqual(iconGeometry.content);
});

test('interface continua utilizável com monitoramento pendente', async ({ page }) => {
  await page.route('**/api/status/resources', () => {});
  await openSlideshow(page, { fallback: true });
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slideshow-filename')).toHaveText('02-paisagem.png');
  await page.locator('#static-close-btn').click();
  await expect(page.locator('#slideshow-viewer')).toBeHidden();
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1024, height: 600 },
  { width: 800, height: 600 },
  { width: 640, height: 360 },
  { width: 360, height: 640 },
  { width: 320, height: 480 }
]) {
  test(`fotos inteiras e controles acessíveis em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openSlideshow(page, { fallback: true });
    await expect(page.locator('.slideshow-footer')).toHaveCount(0);
    await expect(page.locator('.slideshow-header #static-slideshow-controls')).toBeVisible();
    await expect(page.locator('.slideshow-header #static-close-btn')).toBeVisible();
    await expect(page.locator('#slideshow-keyboard-hint')).toBeVisible();
    if (viewport.width >= 800) {
      const headerBox = await page.locator('.slideshow-header').boundingBox();
      expect(headerBox.height).toBeLessThanOrEqual(52);
    }
    for (let photoIndex = 0; photoIndex < 3; photoIndex += 1) {
      await expect(page.locator('#slideshow-image')).toBeVisible();
      await expectImageInsideViewport(page);
      await page.locator('#static-next-btn').click();
    }
    for (const button of await page.locator('#slideshow-viewer button').all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await page.screenshot({ path: testInfo.outputPath('slideshow.png') });
    await page.locator('#static-close-btn').click();
    for (const tab of ['dashboard', 'fileops', 'scheduled', 'backups', 'settings']) {
      await page.locator(`.nav-btn[data-tab="${tab}"]`).click();
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        oversized: Array.from(document.querySelectorAll('body *'))
          .filter(element => element.getClientRects().length && element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 8)
          .map(element => ({ tag: element.tagName, id: element.id, className: element.className })),
        overflowing: Array.from(document.querySelectorAll('body *'))
          .filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 1)
          .slice(0, 12)
          .map(element => ({ tag: element.tagName, id: element.id, className: element.className,
            width: element.clientWidth, scrollWidth: element.scrollWidth, overflow: getComputedStyle(element).overflowX }))
      }));
      if (layout.overflow > 1) await page.screenshot({ path: testInfo.outputPath(`${tab}-overflow.png`), fullPage: true });
      expect(layout.overflow, `overflow horizontal na aba ${tab}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(1);
    }
  });
}

test('fullscreen nativo e saída preservam o enquadramento', async ({ page }) => {
  await openSlideshow(page);
  if (await page.evaluate(() => Boolean(document.fullscreenElement))) {
    await page.locator('#static-fullscreen-btn').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id || null)).toBeNull();
  }
  await page.locator('#static-fullscreen-btn').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id || null)).toBe('slideshow-viewer');
  await expectImageInsideViewport(page);
  await expect(page.locator('#dashboard-fullscreen-controls')).toBeHidden();
  await page.locator('#static-fullscreen-btn').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id || null)).toBeNull();
  await expectImageInsideViewport(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slideshow-filename')).toHaveText('02-paisagem.png');
  await page.locator('#static-close-btn').click();
  await expect(page.locator('#slideshow-viewer')).toBeHidden();
});

test('fullscreen não aceita solicitações concorrentes', async ({ page }) => {
  await openSlideshow(page, { fallback: true });
  await page.evaluate(() => {
    window.fullscreenRequests = 0;
    document.getElementById('slideshow-viewer').requestFullscreen = () => {
      window.fullscreenRequests += 1;
      return new Promise(resolve => { window.finishFullscreenRequest = resolve; });
    };
  });
  await page.locator('#static-fullscreen-btn').click();
  await expect(page.locator('#static-fullscreen-btn')).toBeDisabled();
  await page.keyboard.press('F11');
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
  await page.locator('#static-close-btn').click();
  await expect(page.locator('#slideshow-viewer')).toBeHidden();
  await page.evaluate(() => window.finishFullscreenRequest());
  await expect.poll(() => page.evaluate(() => window.deParaUI.slideshowFullscreenPending)).toBe(false);
});

test('intervalos escalonados até cinco minutos persistem e aceitam valor personalizado', async ({ page }) => {
  await openSlideshow(page, { interval: 10, start: false });
  const interval = page.locator('#slideshow-interval');
  const preset = page.getByRole('combobox', { name: 'Intervalos sugeridos' });
  await expect(interval).toHaveValue('10');
  for (const seconds of [15, 30, 60, 90, 120, 180, 240, 300]) {
    await preset.selectOption(String(seconds));
    await expect(interval).toHaveValue(String(seconds));
  }
  await page.locator('.slideshow-save-btn').click();
  await expect.poll(async () => (await (await page.request.get('/api/config')).json()).config.slideshowConfig.interval).toBe(300);
  await page.locator('.slideshow-close-btn').click();
  await page.locator('.action-slideshow-card').click();
  await expect(interval).toHaveValue('300');
  await expect(preset).toHaveValue('300');
  await interval.fill('75');
  await interval.press('Tab');
  await expect(preset).toHaveValue('');
  await page.locator('.slideshow-save-btn').click();
  await expect.poll(async () => (await (await page.request.get('/api/config')).json()).config.slideshowConfig.interval).toBe(75);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#splash-screen').waitFor({ state: 'hidden', timeout: 15000 });
  await page.locator('.action-slideshow-card').click();
  await expect(interval).toHaveValue('75');
  await expect(preset).toHaveValue('');
});

test('intervalo de cinco minutos só troca a foto ao completar 300 segundos', async ({ page }) => {
  await openSlideshow(page, { interval: 300, clock: true, fallback: true });
  await page.keyboard.press('Space');
  await page.clock.pauseAt(new Date(Date.now() + 60000));
  await page.keyboard.press('Space');
  await page.clock.fastForward(299999);
  await expect(page.locator('#slideshow-filename')).toHaveText('01-retrato.png');
  await page.clock.fastForward(1);
  await expect(page.locator('#slideshow-filename')).toHaveText('02-paisagem.png');
});

test('configuração do servidor prevalece sobre cache legado de três segundos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('slideshowConfig', JSON.stringify({ interval: 3 })));
  await openSlideshow(page, { interval: 10, start: false,
    slideshowConfig: { recursive: true, extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'] } });
  await expect(page.locator('#slideshow-interval')).toHaveValue('10');
  await expect(page.locator('#slideshow-interval-preset')).toHaveValue('10');
  await expect.poll(async () => (await (await page.request.get('/api/config')).json()).config.slideshowConfig.interval).toBe(10);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#splash-screen').waitFor({ state: 'hidden', timeout: 15000 });
  await page.locator('.action-slideshow-card').click();
  await expect(page.locator('#slideshow-interval')).toHaveValue('10');
});
