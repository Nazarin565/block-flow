const corsOrigin = process.env.CORS_ORIGIN ?? '*';

if (corsOrigin === '*') {
  console.warn('Warning: CORS_ORIGIN is not set — accepting requests from any origin.');
}

const config = Object.freeze({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databasePath: process.env.DATABASE_PATH ?? './data.sqlite',
  corsOrigin,
});

export default config;
