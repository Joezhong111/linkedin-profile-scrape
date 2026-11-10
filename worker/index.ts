import { createDb } from './db';
import { cleanupOldJobs } from './jobs';
import { handleApiRequest } from './router';

const worker = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },

  // Daily Cron Trigger: drop Scrape Jobs (and their items) after seven days.
  async scheduled(_controller, env, _ctx) {
    await cleanupOldJobs(createDb(env.DB));
  },
} satisfies ExportedHandler<Env>;

export default worker;
