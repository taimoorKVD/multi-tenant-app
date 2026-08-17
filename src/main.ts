import 'ejs';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {NestExpressApplication} from '@nestjs/platform-express';
import {join} from 'path';
import {RequestMethod, ValidationPipe} from '@nestjs/common';
import {setupSwagger} from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setBaseViewsDir(join(__dirname, '..', 'src/views'));
  app.setViewEngine('ejs');

  app.setGlobalPrefix('api', {
    exclude: [{path: '/', method: RequestMethod.GET}],
  });

  setupSwagger(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    'http://localhost:4200',
    'https://eusocial-admin.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug', 'x-tenant-slug'],
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`✅ App running on port ${process.env.PORT ?? 3000}`, '0.0.0.0');
}

bootstrap();
