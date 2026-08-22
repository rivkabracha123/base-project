import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.use(
    pinoHttp({
      level: config.get<string>('LOG_LEVEL', 'info'),
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'res.headers["set-cookie"]'],
    }),
  );
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGIN'), credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.get<number>('PORT', 3001));
}

void bootstrap();
