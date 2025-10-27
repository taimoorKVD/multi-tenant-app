import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MasterAuthGuard extends AuthGuard('master-jwt') {

}