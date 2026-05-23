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

  test('agenda, edita, duplica e pausa operacao a partir do draft canonico de fileops', async ({ page }) => {
    const fixtureRoot = process.env.DEPARA_E2E_FILEOPS_ROOT;
    const sourceDir = `${fixtureRoot}/source`;
    const targetDir = `${fixtureRoot}/target`;

    await page.goto('/ui');
    await waitForInteractiveUI(page);

    await page.locator('.nav-btn[data-tab="fileops"]').click();

    await page.locator('.select-folder-btn').click();
    await page.locator('#browser-path').fill(sourceDir);
    await page.locator('.folder-browser-select-btn').click();

    await page.locator('.copy-btn').click();

    await page.locator('.select-target-btn').click();
    await page.locator('#browser-path').fill(targetDir);
    await page.locator('.folder-browser-select-btn').click();

    await page.locator('.schedule-btn').click();
    await expect(page.locator('#schedule-modal')).toBeVisible();
    await expect(page.locator('#schedule-source')).toHaveValue(sourceDir);
    await expect(page.locator('#schedule-target')).toHaveValue(targetDir);
    await expect(page.locator('#schedule-action')).toHaveValue('copy');

    await page.locator('#schedule-name').fill('E2E Schedule');
    await page.locator('#schedule-frequency').selectOption('manual');

    const createResponses = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/api/files/schedule') &&
        response.request().method() === 'POST' &&
        !response.url().includes('/execute')
      ) {
        createResponses.push(response);
      }
    });

    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/schedule') &&
      response.request().method() === 'POST' &&
      !response.url().includes('/execute')
    );

    await page.locator('#schedule-modal .schedule-operation-btn').click();

    const createResponse = await createResponsePromise;
    const createPayload = await createResponse.json();
    expect(createResponse.ok(), JSON.stringify(createPayload)).toBeTruthy();
    expect(createPayload.success).toBeTruthy();
    await expect.poll(() => createResponses.length).toBe(1);

    await page.locator('.nav-btn[data-tab="scheduled"]').click();
    await expect(page.locator('#scheduled-operations-list')).toContainText('E2E Schedule');
    await expect(page.locator('#scheduled-operations-list .operation-item')).toHaveCount(1);

    const operationItem = page.locator('#scheduled-operations-list .operation-item', {
      has: page.locator('h4', { hasText: 'E2E Schedule' })
    }).first();

    const pauseResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/schedule/') && response.request().method() === 'PUT'
    );
    await operationItem.locator('.toggle-scheduled-operation-btn').click();
    const pauseResponse = await pauseResponsePromise;
    const pausePayload = await pauseResponse.json();
    expect(pausePayload.success).toBeTruthy();
    await expect(operationItem).toContainText('Pausada');

    const resumeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/schedule/') && response.request().method() === 'PUT'
    );
    await operationItem.locator('.toggle-scheduled-operation-btn').click();
    const resumePayload = await (await resumeResponsePromise).json();
    expect(resumePayload.success).toBeTruthy();
    await expect(operationItem).toContainText('Ativa');

    await operationItem.locator('.edit-scheduled-operation-btn').click();
    await expect(page.locator('#schedule-modal')).toBeVisible();
    await expect(page.locator('#schedule-name')).toHaveValue('E2E Schedule');
    await page.locator('#schedule-name').fill('E2E Schedule Edited');
    await page.locator('#schedule-frequency').selectOption('30s');

    const editResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/schedule/') && response.request().method() === 'PUT'
    );
    await page.locator('#schedule-modal .schedule-operation-btn').click();
    const editPayload = await (await editResponsePromise).json();
    expect(editPayload.success).toBeTruthy();
    await expect(page.locator('#scheduled-operations-list')).toContainText('E2E Schedule Edited');

    const editedItem = page.locator('#scheduled-operations-list .operation-item', {
      has: page.locator('h4', { hasText: 'E2E Schedule Edited' })
    }).first();

    await editedItem.locator('.duplicate-scheduled-operation-btn').click();
    await expect(page.locator('#schedule-modal')).toBeVisible();
    await expect(page.locator('#schedule-name')).toHaveValue('E2E Schedule Edited (Cópia)');
    await expect(page.locator('#schedule-source')).toHaveValue(sourceDir);
    await expect(page.locator('#schedule-target')).toHaveValue(targetDir);

    const duplicateResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/schedule') &&
      response.request().method() === 'POST' &&
      !response.url().includes('/execute')
    );
    await page.locator('#schedule-modal .schedule-operation-btn').click();
    const duplicatePayload = await (await duplicateResponsePromise).json();
    expect(duplicatePayload.success).toBeTruthy();
    await expect(page.locator('#scheduled-operations-list')).toContainText('E2E Schedule Edited (Cópia)');

    await page.locator('.schedule-modal-btn').click();
    await expect(page.locator('#schedule-modal')).toBeVisible();
    await expect(page.locator('#schedule-name')).toHaveValue('');
    await expect(page.locator('#schedule-source')).toHaveValue('');
    await expect(page.locator('#schedule-target')).toHaveValue('');
    await page.locator('.close-schedule-btn').click();
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
    test.skip(process.platform === 'win32', 'Viewer fullscreen do slideshow deve ser validado no RP4/Linux; o runner headless Windows nao e autoritativo.');
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

    const listImagesResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/files/list-images') && response.request().method() === 'POST'
    );
    await page.evaluate(() => window.startSlideshow());
    const listImagesResponse = await listImagesResponsePromise;
    const listImagesPayload = await listImagesResponse.json();
    expect(listImagesResponse.ok(), JSON.stringify(listImagesPayload)).toBeTruthy();
    expect(listImagesPayload.success).toBeTruthy();

    await expect(page.locator('#slideshow-viewer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#slideshow-counter')).not.toHaveText('1 / 0', { timeout: 15000 });

    const initialCounter = await page.locator('#slideshow-counter').textContent();
    await page.locator('#static-next-btn').click();
    await expect(page.locator('#slideshow-counter')).not.toHaveText(initialCounter);

    await page.locator('#static-close-btn').click();
    await expect(page.locator('#slideshow-viewer')).toBeHidden();
  });
});
