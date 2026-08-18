import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { User } from '../users/entities';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyResetTokenDto,
} from './dto';
import { UpdateUserDto } from '../users/dto';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from './entities';

@Injectable()
export class MasterAuthService {
  private readonly resetTokenTtlMinutes = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES || 15);
  private readonly emailVerificationTokenTtlMinutes = Number(
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || 60 * 24,
  );
  private readonly accessTokenTtl = process.env.MASTER_ACCESS_TOKEN_TTL || '2h';
  private readonly refreshTokenTtlDays = Number(process.env.MASTER_REFRESH_TOKEN_TTL_DAYS || 7);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailVerificationTokenRepo: Repository<EmailVerificationToken>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  private getMasterResetUrl(email: string, token: string): string {
    const base = `${this.getFrontendBaseUrl()}/reset-password`;
    return `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  }

  private getMasterVerifyEmailUrl(email: string, token: string): string {
    const base = `${this.getFrontendBaseUrl()}/verify-email`;
    return `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  }

  private buildTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildRefreshTokenPayload(user: User, emailVerified: boolean) {
    const permissions = (user.role?.permissions || []).map((permission) => permission.name);

    return {
      sub: user.id,
      userType: 'master',
      email: user.email,
      role: user.role?.name,
      permissions,
      emailVerified,
      type: 'refresh',
    };
  }

  private buildAccessTokenPayload(user: User, emailVerified: boolean) {
    const permissions = (user.role?.permissions || []).map((permission) => permission.name);

    return {
      sub: user.id,
      userType: 'master',
      email: user.email,
      role: user.role?.name,
      permissions,
      emailVerified,
    };
  }

  private getRefreshTokenSecret(): string {
    return process.env.MASTER_REFRESH_JWT_SECRET || process.env.MASTER_JWT_SECRET || 'master_secret_key';
  }

  private getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  }

  private sanitizeNullableString(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, maxLength);
  }

  private extractClientIp(req?: Request): string | null {
    if (!req) {
      return null;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : null;

    const ip = this.sanitizeNullableString(forwardedIp || req.ip || req.socket?.remoteAddress, 64);
    return ip;
  }

  private extractUserAgent(req?: Request): string | null {
    if (!req) {
      return null;
    }

    const userAgent = req.headers['user-agent'];
    if (Array.isArray(userAgent)) {
      return this.sanitizeNullableString(userAgent[0], 1024);
    }

    return this.sanitizeNullableString(userAgent, 1024);
  }

  private extractDeviceName(req?: Request): string | null {
    if (!req) {
      return null;
    }

    const headerValue =
      req.headers['x-device-name'] || req.headers['device-name'] || req.headers['x-client-device'];

    if (Array.isArray(headerValue)) {
      return this.sanitizeNullableString(headerValue[0], 128);
    }

    return this.sanitizeNullableString(headerValue, 128);
  }

  private async isEmailVerified(userId: number): Promise<boolean> {
    const token = await this.emailVerificationTokenRepo
      .createQueryBuilder('token')
      .where('token.user_id = :userId', { userId })
      .andWhere('token.verified_at IS NOT NULL')
      .getOne();

    return Boolean(token);
  }

  private async clearPasswordResetTokens(userId: number): Promise<void> {
    await this.passwordResetTokenRepo
      .createQueryBuilder()
      .delete()
      .from(PasswordResetToken)
      .where('user_id = :userId', { userId })
      .execute();
  }

  private async clearPendingEmailVerificationTokens(userId: number): Promise<void> {
    await this.emailVerificationTokenRepo
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationToken)
      .where('user_id = :userId', { userId })
      .andWhere('verified_at IS NULL')
      .execute();
  }

  private async clearRefreshTokens(userId: number): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('user_id = :userId', { userId })
      .execute();
  }

  private async revokeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('token_hash = :tokenHash', { tokenHash: this.buildTokenHash(refreshToken) })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async persistRefreshToken(
    user: User,
    refreshToken: string,
    req?: Request,
  ): Promise<void> {
    await this.clearRefreshTokens(user.id);
    await this.refreshTokenRepo.save({
      user,
      tokenHash: this.buildTokenHash(refreshToken),
      expiresAt: this.getRefreshTokenExpiryDate(),
      revokedAt: null,
      deviceName: this.extractDeviceName(req),
      ipAddress: this.extractClientIp(req),
      userAgent: this.extractUserAgent(req),
    });
  }

  private async issueAuthTokens(user: User, emailVerified: boolean, req?: Request) {
    const access_token = this.jwtService.sign(this.buildAccessTokenPayload(user, emailVerified), {
      secret: process.env.MASTER_JWT_SECRET || 'master_secret_key',
      expiresIn: this.accessTokenTtl as any,
    });

    const refresh_token = this.jwtService.sign(this.buildRefreshTokenPayload(user, emailVerified), {
      secret: this.getRefreshTokenSecret(),
      expiresIn: `${this.refreshTokenTtlDays}d` as any,
    });

    await this.persistRefreshToken(user, refresh_token, req);

    return {
      access_token,
      refresh_token,
      expires_in: this.accessTokenTtl,
      refresh_expires_in_days: this.refreshTokenTtlDays,
    };
  }

  private resolveSmtpConfig() {
    const explicitFrom =
      process.env.SMTP_FROM?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      process.env.MAIL_FROM_EMAIL?.trim();
    const smtpUsername = process.env.SMTP_USER?.trim() || process.env.MAIL_USER?.trim();
    const fromEmail = explicitFrom || (smtpUsername?.includes('@') ? smtpUsername : null);

    if (!fromEmail) return null;

    return {
      host: process.env.SMTP_HOST?.trim() || process.env.MAIL_HOST?.trim() || null,
      port: Number(process.env.SMTP_PORT?.trim() || process.env.MAIL_PORT?.trim() || 587),
      secure: (process.env.SMTP_SECURE?.trim() || process.env.MAIL_SECURE?.trim()) === 'true',
      username: smtpUsername,
      password: process.env.SMTP_PASS?.trim() || process.env.MAIL_PASS?.trim() || undefined,
      fromEmail,
      fromName: process.env.MAIL_FROM_NAME?.trim() || undefined,
      replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
    };
  }

  private async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      throw new InternalServerErrorException('SMTP is not configured for verification emails.');
    }

    const verifyUrl = this.getMasterVerifyEmailUrl(email, token);
    const logoUrl = `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });

    const subject = 'Verify your email address';
    const html = `
      <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
                <tr>
                  <td style="padding:24px 28px;background:#101820;">
                    <img src="${logoUrl}" alt="EuSocial" style="height:50px;display:block;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 22px;color:#1f2d3d;line-height:1.5;">
                    <h2 style="margin:0 0 10px;font-size:24px;line-height:30px;color:#0b2948;">Verify your email</h2>
                    <p style="margin:0 0 16px;">Hello ${name || 'there'},</p>
                    <p style="margin:0 0 16px;">Please confirm your email address to complete account verification.</p>
                    <p style="margin:24px 0;">
                      <a href="${verifyUrl}" style="background:#ff9900;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email</a>
                    </p>
                    <p style="margin:0 0 12px;">This link expires in ${this.emailVerificationTokenTtlMinutes} minutes.</p>
                    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#7b8794;">© 2026 EuSocial. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
        to: email,
        replyTo: smtp.replyTo || undefined,
        subject,
        html,
      });
    } finally {
      transporter.close();
    }
  }

  private async sendResetPasswordEmail(email: string, name: string, token: string): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      throw new InternalServerErrorException('SMTP is not configured for password reset emails.');
    }

    const resetUrl = this.getMasterResetUrl(email, token);
    const logoUrl = `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });

    const subject = 'Reset your password';
    const html = `
      <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
                <tr>
                  <td style="padding:24px 28px;background:#101820;">
                    <img src="${logoUrl}" alt="EuSocial" style="height:50px;display:block;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 22px;color:#1f2d3d;line-height:1.5;">
                    <h2 style="margin:0 0 10px;font-size:24px;line-height:30px;color:#0b2948;">Password reset request</h2>
                    <p style="margin:0 0 16px;">Hello ${name || 'there'},</p>
                    <p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to continue.</p>
                    <p style="margin:24px 0;">
                      <a href="${resetUrl}" style="background:#ff9900;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a>
                    </p>
                    <p style="margin:0 0 12px;">This link expires in ${this.resetTokenTtlMinutes} minutes and can be used only once.</p>
                    <p style="margin:0;">If you did not request a password reset, you can ignore this email.</p>
                    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#7b8794;">© 2026 EuSocial. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
        to: email,
        replyTo: smtp.replyTo || undefined,
        subject,
        html,
      });
    } finally {
      transporter.close();
    }
  }

  private async issueEmailVerificationToken(user: User): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.clearPendingEmailVerificationTokens(user.id);
    await this.emailVerificationTokenRepo.save({
      user,
      tokenHash: this.buildTokenHash(rawToken),
      expiresAt: new Date(Date.now() + this.emailVerificationTokenTtlMinutes * 60 * 1000),
      verifiedAt: null,
    });
    return rawToken;
  }

  private async issuePasswordResetToken(user: User, req?: Request): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.clearPasswordResetTokens(user.id);
    await this.passwordResetTokenRepo.save({
      user,
      tokenHash: this.buildTokenHash(rawToken),
      expiresAt: new Date(Date.now() + this.resetTokenTtlMinutes * 60 * 1000),
      requestedIp: this.extractClientIp(req),
      userAgent: this.extractUserAgent(req),
    });
    return rawToken;
  }

  private async findValidPasswordResetToken(email: string, tokenHash: string) {
    return this.passwordResetTokenRepo
      .createQueryBuilder('token')
      .innerJoinAndSelect('token.user', 'user')
      .where('LOWER(user.email) = :email', { email })
      .andWhere('token.token_hash = :tokenHash', { tokenHash })
      .andWhere('token.expires_at > NOW()')
      .getOne();
  }

  private async findValidEmailVerificationToken(email: string, tokenHash: string) {
    return this.emailVerificationTokenRepo
      .createQueryBuilder('token')
      .innerJoinAndSelect('token.user', 'user')
      .where('LOWER(user.email) = :email', { email })
      .andWhere('token.token_hash = :tokenHash', { tokenHash })
      .andWhere('token.expires_at > NOW()')
      .andWhere('token.verified_at IS NULL')
      .getOne();
  }

  async forgotPassword(dto: ForgotPasswordDto, req?: Request) {
    const genericSuccess = {
      success: true,
      message: 'If the account exists, a password reset link has been sent to the registered email.',
    };

    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      return genericSuccess;
    }

    const rawToken = await this.issuePasswordResetToken(user, req);

    try {
      await this.sendResetPasswordEmail(user.email, user.name, rawToken);
    } catch (error) {
      console.error('Master forgot-password email dispatch failed:', error);
    }

    return genericSuccess;
  }

  async verifyResetToken(dto: VerifyResetTokenDto) {
    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidPasswordResetToken(email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    return {
      success: true,
      message: 'Reset token is valid.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.password_confirm) {
      throw new BadRequestException('Passwords do not match.');
    }

    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidPasswordResetToken(email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    token.user.password = await argon2.hash(dto.password);
    await this.userRepo.save(token.user);
    await this.clearPasswordResetTokens(token.user.id);
    await this.clearRefreshTokens(token.user.id);

    return {
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name', 'role'],
      relations: ['role', 'role.permissions'],
    });

    if (!user) return null;

    const match = await argon2.verify(user.password, password);
    return match ? user : null;
  }

  async login(dto: LoginDto, req?: Request) {
    try {
      const user = await this.validateUser(dto.email, dto.password);
      if (!user) throw new UnauthorizedException('Invalid credentials');

      const emailVerified = await this.isEmailVerified(user.id);
      const tokens = await this.issueAuthTokens(user, emailVerified, req);

      return {
        success: true,
        message: 'User successfully authenticated',
        user_type: 'master',
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name,
          email_verified: emailVerified,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Login error:', error);
      throw new UnauthorizedException('Authentication failed. Please try again.');
    }
  }

  async getProfile(userId: number): Promise<{
    id: number;
    name: string;
    email: string;
    role?: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private splitDisplayName(fullName: string | null | undefined): {
    first_name: string;
    last_name: string;
  } {
    const trimmed = String(fullName || '').trim();
    if (!trimmed) return { first_name: '', last_name: '' };
    const parts = trimmed.split(/\s+/);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' '),
    };
  }

  private buildProfilePayload(user: User) {
    const { first_name, last_name } = this.splitDisplayName(user.name);
    return {
      id: user.id,
      name: user.name,
      first_name,
      last_name,
      email: user.email,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
          }
        : null,
      user_type: 'master',
      account_type: 'super_admin',
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  async getOwnProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      message: 'Profile fetched successfully',
      user_type: 'master',
      data: this.buildProfilePayload(user),
    };
  }

  async updateProfile(id: number, dto: UpdateUserDto & Record<string, any>) {
    try {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const firstName =
        dto.first_name !== undefined ? String(dto.first_name || '').trim() : undefined;
      const lastName =
        dto.last_name !== undefined ? String(dto.last_name || '').trim() : undefined;

      if (dto.name !== undefined) {
        const trimmed = String(dto.name || '').trim();
        if (!trimmed) {
          throw new BadRequestException('Name cannot be empty');
        }
        user.name = trimmed;
      } else if (firstName !== undefined || lastName !== undefined) {
        const current = this.splitDisplayName(user.name);
        const nextFirst = firstName !== undefined ? firstName : current.first_name;
        const nextLast = lastName !== undefined ? lastName : current.last_name;
        const nextName = [nextFirst, nextLast].filter(Boolean).join(' ');
        if (!nextName) {
          throw new BadRequestException('Name cannot be empty');
        }
        user.name = nextName;
      }

      if (dto.password) {
        if (!dto.password_confirm) {
          throw new BadRequestException('Confirm password is required');
        }
        if (dto.password !== dto.password_confirm) {
          throw new BadRequestException('Passwords do not match');
        }
        if (dto.password.length < 6) {
          throw new BadRequestException('Password must be at least 6 characters long');
        }

        user.password = await argon2.hash(dto.password);
      }

      const saved = await this.userRepo.save(user).catch((error) => {
        console.error('Error saving user profile:', error);
        throw new InternalServerErrorException(
          'Unable to update profile at this time. Please try again later.',
        );
      });

      delete (saved as any).password;

      const refreshed = await this.userRepo.findOne({
        where: { id: saved.id },
        relations: ['role'],
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        user_type: 'master',
        data: this.buildProfilePayload(refreshed as User),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      console.error('Unexpected error in updateProfile:', error);
      throw new InternalServerErrorException(
        'Something went wrong while updating your profile.',
      );
    }
  }

  async sendEmailVerification(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      return {
        success: true,
        message: 'If the account exists, an email verification link has been sent to the registered email.',
      };
    }

    if (await this.isEmailVerified(user.id)) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    const rawToken = await this.issueEmailVerificationToken(user);

    try {
      await this.sendVerificationEmail(user.email, user.name, rawToken);
    } catch (error) {
      console.error('Master email verification dispatch failed:', error);
    }

    return {
      success: true,
      message: 'If the account exists, an email verification link has been sent to the registered email.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidEmailVerificationToken(email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    token.verifiedAt = new Date();
    await this.emailVerificationTokenRepo.save(token);

    return {
      success: true,
      message: 'Email verified successfully.',
    };
  }

  async refreshToken(dto: RefreshTokenDto, req?: Request) {
    let payload: any;

    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (!payload?.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokenHash = this.buildTokenHash(dto.refresh_token);
    const storedToken = await this.refreshTokenRepo
      .createQueryBuilder('token')
      .where('token.user_id = :userId', { userId: payload.sub })
      .andWhere('token.token_hash = :tokenHash', { tokenHash })
      .getOne();

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.clearRefreshTokens(payload.sub);
      throw new UnauthorizedException('Refresh token expired.');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const emailVerified = await this.isEmailVerified(user.id);
    const tokens = await this.issueAuthTokens(user, emailVerified, req);

    return {
      success: true,
      message: 'Token refreshed successfully.',
      ...tokens,
    };
  }

  async logout(userId: number, dto: RefreshTokenDto) {
    let payload: any;

    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (!payload?.sub || payload.type !== 'refresh' || Number(payload.sub) !== Number(userId)) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    await this.revokeRefreshToken(userId, dto.refresh_token);

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }
}
