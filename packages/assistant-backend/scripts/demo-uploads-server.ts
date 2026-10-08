import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { UploadsModule } from '../src/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [() => ({ LOCAL_STORAGE_PATH: './.local-storage/demo' })],
    }),
    UploadsModule,
  ],
})
class DemoAppModule {}

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(DemoAppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3099);
  console.log('Demo uploads server listening on http://localhost:3099');
}

void bootstrap();
