import { describe, expect, it } from 'vitest';
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../worker/index';

async function fetchWorker(path: string): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`https://preview.example.com${path}`), env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('GET /api/health', () => {
  it('reports readiness and the supported providers', async () => {
    const response = await fetchWorker('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      status: 'ok',
      providers: ['apify', 'treg'],
    });
  });

  it('exposes no token or secret presence', async () => {
    const body = await (await fetchWorker('/api/health')).text();

    expect(body).not.toMatch(/token|secret|api.?key|credential/i);
  });
});

describe('unknown /api/* routes', () => {
  it('returns 501 JSON for an unimplemented endpoint', async () => {
    const response = await fetchWorker('/api/does-not-exist');

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ error: 'Not implemented' });
  });
});
