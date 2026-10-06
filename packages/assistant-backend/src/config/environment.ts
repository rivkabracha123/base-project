import Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  CORS_ORIGIN: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  FIXTURE_SET: Joi.string().valid('default').default('default'),
  LOCAL_STORAGE_PATH: Joi.string().min(1).default('../../.local-storage'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent').default('info'),
  AI_PROVIDER_MODE: Joi.string().valid('fixture', 'real').default('fixture'),
  AI_GENERATE_URL: Joi.string().uri().optional(),
  AI_GENERATE_API_KEY: Joi.string().optional(),
});
