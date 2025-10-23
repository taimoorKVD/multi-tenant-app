import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {NestExpressApplication} from '@nestjs/platform-express';
import {join} from 'path';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.setBaseViewsDir(join(__dirname, '..', 'src/views'));
    app.setViewEngine('ejs');

    await app.listen(process.env.PORT ?? 3000);
    console.log(`✅ App running on port ${process.env.PORT ?? 3000}`);
}

bootstrap();
