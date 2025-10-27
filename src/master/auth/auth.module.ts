import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MasterAuthService } from './auth.service';
import { MasterAuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities';
import { MasterJwtStrategy } from './strategies/master-jwt.strategy';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        PassportModule,
        JwtModule.register({
            secret: process.env.MASTER_JWT_SECRET || 'master_secret_key',
            signOptions: { expiresIn: '2h' },
        }),
    ],
    providers: [MasterAuthService, MasterJwtStrategy],
    controllers: [MasterAuthController],
    exports: [MasterAuthService],
})
export class MasterAuthModule {}
