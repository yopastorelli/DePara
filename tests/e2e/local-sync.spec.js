const { test, expect } = require('@playwright/test');

test('sincronização é carregada sob demanda, mantém operação única e mostra preview', async ({ page }) => {
  let requests = 0;
  const job = { id: 'fixture-job', name: 'Backup teste', sourcePath: 'D:\Fotos', targetPath: 'E:\Backup', mode: 'versioned', retention: 3, frequency: 'manual', active: false };
  let created = false;
  await page.route('**/api/sync/**', async (route) => {
    requests++;
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith('/jobs') && route.request().method() === 'POST') {
      expect(route.request().postDataJSON().retention).toBe(3); created = true; data = job;
    } else if (url.pathname.endsWith('/jobs')) data = created ? [job] : [];
    else if (url.pathname.endsWith('/preview')) data = { id: 'fixture-run' };
    else if (url.pathname.endsWith('/results')) data = { items: [{ relative: 'viagem.jpg', type: 'new' }], nextOffset: null };
    else data = { id: 'fixture-run', status: 'completed', counts: { new: 1 }, bytes: 1024 };
    await route.fulfill({ status: url.pathname.endsWith('/preview') ? 202 : 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.goto('/ui');
  await page.locator('#splash-screen').waitFor({ state: 'hidden' });
  if (await page.locator('#onboarding-overlay').isVisible()) await page.locator('.onboarding-skip-btn').click();
  expect(requests).toBe(0);
  await page.locator('.nav-btn[data-tab="fileops"]').click();
  await page.locator('#sync-mode').click();
  await expect(page.locator('#operation-config-zone')).toBeHidden();
  await page.locator('#sync-name').fill(job.name);
  await page.locator('#sync-source').fill(job.sourcePath);
  await page.locator('#sync-target').fill(job.targetPath);
  await page.locator('#sync-create button[type="submit"]').click();
  await expect(page.locator('#sync-jobs')).toContainText(job.name);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('#sync-results')).toContainText('Novo: viagem.jpg');
  await page.locator('#single-mode').click();
  await expect(page.locator('#operation-config-zone')).toBeVisible();
  await expect(page.locator('#sync-panel')).toBeHidden();
});
