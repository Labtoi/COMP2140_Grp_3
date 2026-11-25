import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files share one database when run against Supabase, so they must not run at the same time.
    fileParallelism: false,
  },
});
