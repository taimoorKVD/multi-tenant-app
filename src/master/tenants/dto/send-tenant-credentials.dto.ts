import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendTenantCredentialsDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
