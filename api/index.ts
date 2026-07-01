import {NestFactory} from '@nestjs/core';
import {ExpressAdapter} from '@nestjs/platform-express';
import express, {Request, Response} from 'express';
import path, {join} from 'path';
import {RequestMethod, ValidationPipe} from '@nestjs/common';
import {AppModule} from '../src/app.module';
import {setupSwagger} from '../src/config/swagger.config';
import { TenantsService } from 'src/master/tenants/tenants.service';
import { Repository } from 'typeorm';
import { Tenant } from 'src/master/tenants/entities/tenant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantResetService } from 'src/tenant-reset/tenant-reset.service';

let cachedServer: any;

async function bootstrap() {
    const expressApp = express();

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

    // GLOBAL CORS
    expressApp.use((req, res, next) => {
        const origin = req.headers.origin as string | undefined;
        const allowedOrigin =
            origin && allowedOrigins.has(origin)
                ? origin
                : (process.env.FRONTEND_URL || 'http://localhost:4200');

        res.header("Access-Control-Allow-Origin", allowedOrigin);
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
        res.header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, Accept, X-Tenant-Slug, x-tenant-slug"
        );

        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }

        next();
    });

    // Configure EJS view engine
    expressApp.set('views', join(process.cwd(), 'src/views'));
    expressApp.set('view engine', 'ejs');

    // Serve Swagger UI static assets
    expressApp.use(
        '/api/collection-assets',
        express.static(path.join(process.cwd(), 'node_modules/swagger-ui-dist')),
    );

    // Create NestJS app using the Express adapter
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api', {
        exclude: [{path: '/', method: RequestMethod.GET}],
    });

    console.log('Commit SHA:', process.env.VERCEL_GIT_COMMIT_SHA);
console.log('Deployment ID:', process.env.VERCEL_DEPLOYMENT_ID);
    // Call your shared Swagger setup
    setupSwagger(app);

    const tenantReset = app.get(TenantResetService);
    await tenantReset.reset();

    await app.init();
    return expressApp;
}

export default async function handler(req: Request, res: Response) {
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }
    cachedServer(req, res);
}
