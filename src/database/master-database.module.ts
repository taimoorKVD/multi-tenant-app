import {Global, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Tenant} from '../master/tenants/entities';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';
import {masterDatabaseConfig} from '../config/master-database.config';
import {JobPosition} from '../master/job-position/entities';
import {City} from '../master/cities/entities';
import {Country} from '../master/countries/entities';
import {State} from '../master/states/entities';
import {
  EmailLog,
  EmailTemplate,
  EmailTemplateRecipient,
  GlobalMailSetting,
} from '../master/mail/entities';
import { ActivityLog } from '../master/activity-logs/entities';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from '../master/auth/entities';
import {  
  Invoice,
  Plan,
  Subscription,
  WebsiteSignup,
} from '../master/billing/entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot(masterDatabaseConfig),
    TypeOrmModule.forFeature([
      Role,
      Permission,
      User,
      Tenant,
      JobPosition,
      City,
      Country,
      State,
      EmailTemplate,
      EmailTemplateRecipient,
      GlobalMailSetting,
      EmailLog,
      ActivityLog,
      PasswordResetToken,
      EmailVerificationToken,
      RefreshToken,
      Plan,
      Subscription,
      Invoice,
      WebsiteSignup,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class MasterDatabaseModule {
}
