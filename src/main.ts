import 'ejs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setBaseViewsDir(join(__dirname, '..', 'src/views'));
  app.setViewEngine('ejs');

  const uploadsRoot = process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads' });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
      { path: 'uploads/(.*)', method: RequestMethod.GET },
    ],
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
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    'http://localhost:4200',
    'http://localhost:3001',
    'https://eusocial.thebetawebsite.com',
    'https://admin.eusocial.thebetawebsite.com',
    'https://api.eusocial.thebetawebsite.com',
    ...(process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL.trim().replace(/\/+$/, '')]
      : []),
    ...(process.env.PUBLIC_WEBSITE_URL
      ? [process.env.PUBLIC_WEBSITE_URL.trim().replace(/\/+$/, '')]
      : []),
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server, same-origin) send no Origin.
      if (!origin) {
        return callback(null, true);
      }

      const normalized = origin.replace(/\/+$/, '');
      const isAllowed =
        allowedOrigins.has(normalized) ||
        /^https:\/\/[a-z0-9-]+\.eusocial\.thebetawebsite\.com$/i.test(normalized) ||
        /^http:\/\/[a-z0-9-]+\.eusocial\.localhost:4200$/i.test(normalized);

      if (isAllowed) {
        return callback(null, true);
      }

      // Do NOT throw — throwing becomes Nest 500 "Internal server error".
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Slug'],
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`✅ App running on port ${process.env.PORT ?? 3000}`, '0.0.0.0');
}

bootstrap();
