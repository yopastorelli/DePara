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
