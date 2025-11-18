import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MasterAuthGuard extends AuthGuard('master-jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException({
        statusCode: 401,
        success: false,
        message: 'Your session has expired or is invalid. Please log in again.',
      });
    }
    return user;
  }
}
