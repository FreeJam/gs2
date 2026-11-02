/**
 * Общие помощники для тестов GS2.
 * Запуск: npm test  (или node --test --test-concurrency=1 tests/)
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

export const BASE_URL = (process.env.GS2_BASE_URL || 'https://freejam.online/gs2').replace(/\/+$/, '');
const FETCH_TIMEOUT_MS = Number(process.env.GS2_TIMEOUT_MS || 15000);

/**
 * Найти playwright (глобально, локально или в кэше npx) и вернуть chromium.
 */
export function loadChromium() {
  const candidates = [];

  if (process.env.PLAYWRIGHT_MODULE) {
    candidates.push(process.env.PLAYWRIGHT_MODULE);
  }

  const npxDir = path.join(os.homedir(), '.npm', '_npx');
  if (existsSync(npxDir)) {
    for (const dir of readdirSync(npxDir)) {
      candidates.push(path.join(npxDir, dir, 'node_modules', 'playwright'));
      candidates.push(path.join(npxDir, dir, 'node_modules', 'playwright-core'));
    }
  }

  candidates.push('playwright', 'playwright-core');

  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (mod && mod.chromium) return mod.chromium;
    } catch {
      /* пробуем следующий */
    }
  }

  throw new Error('Playwright не найден. Установите playwright или задайте PLAYWRIGHT_MODULE.');
}

export async function launchBrowser() {
  const chromium = loadChromium();
  return chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

/**
 * Запрос к PHP API.
 */
export async function api(endpoint, payload = null, method = payload ? 'POST' : 'GET') {
  const url = `${BASE_URL}/api/${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* не JSON */
    }

    return { status: res.status, ok: res.ok, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export function uniqueName(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}
