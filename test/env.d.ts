/// <reference types="@cloudflare/vitest-plugin/types" />

import type { D1Migration } from '@cloudflare/vitest-plugin';

// Injected by the Vitest miniflare bindings in vitest.config.ts.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
