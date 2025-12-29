import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          kvNamespaces: ['TOKENS'],
          bindings: {
            TRIPIT_CONSUMER_KEY: 'test-consumer-key',
            TRIPIT_CONSUMER_SECRET: 'test-consumer-secret',
          },
        },
      },
    },
  },
});
