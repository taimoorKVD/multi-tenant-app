import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {TenantMiddleware} from "./common/middleware";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.use(new TenantMiddleware().use);
    await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
