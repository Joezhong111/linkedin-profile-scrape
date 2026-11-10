import { handleApiRequest } from './router';

const worker = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },

  // No-op until the Scrape Job cleanup ticket wires the daily Cron Trigger.
  async scheduled() {},
} satisfies ExportedHandler<Env>;

export default worker;
