import {NestFactory} from '@nestjs/core';
import {ExpressAdapter} from '@nestjs/platform-express';
import express, {Request, Response} from 'express';
import path from 'path';
import {ValidationPipe} from '@nestjs/common';
import {AppModule} from '../src/app.module';
import {setupSwagger} from '../src/config/swagger.config';

let cachedServer: any;

async function bootstrap() {
    const expressApp = express();

    expressApp.use(
        '/api/collection-assets',
        express.static(path.join(process.cwd(), 'node_modules/swagger-ui-dist'))
    );

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    app.useGlobalPipes(new ValidationPipe({whitelist: true}));

    setupSwagger(app);

    await app.init();
    return expressApp;
}

export default async function handler(req: Request, res: Response) {
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }
    cachedServer(req, res);
}
