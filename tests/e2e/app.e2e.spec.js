const { test, expect } = require('@playwright/test');

async function waitForInteractiveUI(page) {
  const splash = page.locator('#splash-screen');
  if (await splash.isVisible().catch(() => false)) {
    await splash.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  const onboarding = page.locator('#onboarding-overlay');
  if (await onboarding.isVisible().catch(() => false)) {
    const skipButton = page.locator('.onboarding-skip-btn');
    const closeButton = page.locator('.onboarding-close-btn');

    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
    } else if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }

    await onboarding.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }
}

test.describe('DePara UI E2E', () => {
  test('configura e executa operacao canonica de copy em fileops pelo browser interno', async ({ page }) => {
    const fixtureRoot = process.env.DEPARA_E2E_FILEOPS_ROOT;
    const sourceDir = `${fixtureRoot}/source`;
    const targetDir = `${fixtureRoot}/target`;

    await page.request.post('/api/files/folders', {
      data: { name: 'Source Fixture', path: sourceDir, type: 'source' }
    });
    await page.request.post('/api/files/folders', {
      data: { name: 'Target Fixture', path: targetDir, type: 'target' }
    });

    await page.goto('/ui');
    await waitForInteractiveUI(page);

    await page.locator('.nav-btn[data-tab="fileops"]').click();

    await page.locator('.select-folder-btn').click();
    await expect(page.locator('.folder-browser-modal h3')).toContainText('Origem');
    await expect(page.locator('.folder-browser-select-btn')).toContainText('origem');
    await page.locator('#browser-path').fill(sourceDir);
    await page.locator('.folder-browser-select-btn').click();

    await expect(page.locator('#source-folder-path')).toHaveValue(sourceDir);
    await page.locator('.copy-btn').click();

    await page.locator('.select-target-btn').click();
    await expect(page.locator('.folder-browser-modal h3')).toContainText('Destino');
    await expect(page.locator('.folder-browser-select-btn')).toContainText('destino');
    await page.locator('#browser-path').fill(targetDir);
    await page.locator('.folder-browser-select-btn').click();

    await expect(page.locator('#target-folder-path')).toHaveValue(targetDir);

    await expect(page.locator('#fileops-summary-source')).toContainText(sourceDir);
    await expect(page.locator('#fileops-summary-action')).toContainText('COPY');
    await expect(page.locator('#fileops-summary-target')).toContainText(targetDir);
    await expect(page.locator('.execute-now-btn')).toBeEnabled();
    await expect(page.locator('.schedule-btn')).toBeEnabled();

    const executeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/execute') && response.request().method() === 'POST'
    );

    await page.locator('.execute-now-btn').click();

    const executeResponse = await executeResponsePromise;
    const executePayload = await executeResponse.json();
    expect(executeResponse.ok(), JSON.stringify(executePayload)).toBeTruthy();
    expect(executePayload.success).toBeTruthy();
  });

  test('carrega a UI sem erro de parser e exibe a navegacao principal', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/ui');
    await waitForInteractiveUI(page);

    await expect(page.locator('body')).toContainText('DePara');
    await expect(page.locator('.nav')).toContainText('Dashboard');
    await expect(page.locator('.nav')).toContainText('Opera');
    await expect(page.locator('#api-status')).not.toHaveText('Testando...', { timeout: 15000 });

    expect(pageErrors).toEqual([]);
  });

  test('persiste configuracao canonica e reidrata a pasta do slideshow', async ({ page }) => {
    const fixturePath = process.env.DEPARA_E2E_IMAGES_DIR;

    await page.goto('/ui');
    await waitForInteractiveUI(page);

    const response = await page.request.post('/api/config', {
      data: {
        config: {
          slideshowSelectedPath: fixturePath,
          slideshowConfig: {
            interval: 4,
            recursive: true,
            extensions: ['.png']
          }
        }
      }
    });

    expect(response.ok()).toBeTruthy();

    await page.reload();
    await waitForInteractiveUI(page);
    await page.locator('.action-slideshow-card').click();
    await expect(page.locator('#slideshow-config-modal')).toBeVisible();
    await expect(page.locator('#slideshow-folder-path')).toHaveValue(fixturePath);
  });

  test('abre o slideshow com fixtures locais e permite navegar', async ({ page }) => {
    const fixturePath = process.env.DEPARA_E2E_IMAGES_DIR;

    await page.goto('/ui');
    await waitForInteractiveUI(page);

    await page.request.post('/api/config', {
      data: {
        config: {
          slideshowSelectedPath: fixturePath,
          slideshowConfig: {
            interval: 2,
            recursive: true,
            extensions: ['.png']
          }
        }
      }
    });

    await page.reload();
    await waitForInteractiveUI(page);
    await page.locator('.action-slideshow-card').click();
    await expect(page.locator('#slideshow-config-modal')).toBeVisible();

    await page.locator('.slideshow-start-btn').click();

    await expect(page.locator('#slideshow-viewer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#slideshow-counter')).not.toHaveText('1 / 0', { timeout: 15000 });

    const initialCounter = await page.locator('#slideshow-counter').textContent();
    await page.locator('#static-next-btn').click();
    await expect(page.locator('#slideshow-counter')).not.toHaveText(initialCounter);

    await page.locator('#static-close-btn').click();
    await expect(page.locator('#slideshow-viewer')).toBeHidden();
  });
});
