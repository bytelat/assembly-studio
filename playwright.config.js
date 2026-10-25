import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:8011', headless: true, launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: '.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8011',
    url: 'http://127.0.0.1:8011/api/health',
    reuseExistingServer: false,
  },
});
