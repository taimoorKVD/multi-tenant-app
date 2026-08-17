import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { User } from '../users/entities';
import { JobPosition } from '../job-positions/entities';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyResetTokenDto,
} from './dto';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from './entities';
import { EntityDynamicData, DynamicModule } from '../form-builder/entities';

@Injectable()
export class TenantAuthService {
  private readonly resetTokenTtlMinutes = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES || 15);
  private readonly emailVerificationTokenTtlMinutes = Number(
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || 60 * 24,
  );
  private readonly accessTokenTtl = process.env.JWT_ACCESS_TOKEN_TTL || '2h';
  private readonly refreshTokenTtlDays = Number(process.env.JWT_REFRESH_TOKEN_TTL_DAYS || 7);
  private readonly PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
  ]);

  constructor(private readonly jwtService: JwtService) {}

  private serializeJobPosition(jobPosition: JobPosition | null | undefined) {
    if (!jobPosition?.id) return null;
    return {
      id: jobPosition.id,
      name: jobPosition.name,
    };
  }

  /**
   * Distinguishes tenant workspace admins/managers from employee users on the same /tenant/login.
   * - tenant_admin: Admin/Manager role name, or management permissions
   * - tenant_user: everyone else (Today's Work / assignments)
   */
  private resolveAccountType(
    user: User,
    permissionNames: string[],
  ): 'tenant_admin' | 'tenant_user' {
    const roleName = String(user.role?.name || '')
      .trim()
      .toLowerCase();

    if (
      roleName === 'admin' ||
      roleName.includes('admin') ||
      roleName.includes('manager') ||
      roleName.includes('owner')
    ) {
      return 'tenant_admin';
    }

    const adminPermissionHints = [
      'create-user',
      'edit-user',
      'create-role',
      'create-dc-template',
      'edit-dc-template',
      'activate-dc-template',
      'archive-dc-template',
      'review-dc-submission',
    ];

    if (adminPermissionHints.some((name) => permissionNames.includes(name))) {
      return 'tenant_admin';
    }

    return 'tenant_user';
  }

  private coerceRelationId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object' && value !== null && 'id' in (value as Record<string, unknown>)) {
      const id = Number((value as Record<string, unknown>).id);
      return Number.isFinite(id) ? id : null;
    }
    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }

  /**
   * Prefer FK relation; fall back to legacy users-form dynamic field values.
   */
  private async resolveJobPositionSummary(
    tenantConnection: DataSource,
    user: User,
  ): Promise<{ id: number; name: string } | null> {
    const fromRelation = this.serializeJobPosition(user.jobPosition);
    if (fromRelation) return fromRelation;

    try {
      const moduleRepo = tenantConnection.getRepository(DynamicModule);
      const usersModule = await moduleRepo.findOne({ where: { slug: 'users' } });
      if (!usersModule?.id) return null;

      const dynamicRepo = tenantConnection.getRepository(EntityDynamicData);
      const row = await dynamicRepo.findOne({
        where: { moduleId: usersModule.id, entityId: user.id },
      });
      if (!row?.data || typeof row.data !== 'object') return null;

      const data = row.data as Record<string, unknown>;
      const candidates: unknown[] = [
        data.job_position_id,
        data.jobPosition,
        data.job_position,
        ...Object.entries(data)
          .filter(([key]) => /job.?position/i.test(key))
          .map(([, value]) => value),
      ];

      let jobPositionId: number | null = null;
      for (const candidate of candidates) {
        jobPositionId = this.coerceRelationId(candidate);
        if (jobPositionId !== null) break;
      }
      if (jobPositionId === null) return null;

      const jobPosition = await tenantConnection.getRepository(JobPosition).findOne({
        where: { id: jobPositionId },
      });
      return this.serializeJobPosition(jobPosition);
    } catch {
      return null;
    }
  }

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200'; // Default fallback, should ideally be overridden in production via env variable
  }

  private buildTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getTenantResetUrl(
    req: any,
    email: string,
    token: string,
    scope: 'tenant' | 'tenant-user',
  ): string {
    const path = scope === 'tenant-user' ? '/tenant/user/reset-password' : '/tenant/reset-password';
    const base = `${this.getFrontendBaseUrl()}${path}`;
    const tenantSlug = req?.tenantId ? `&tenant_slug=${encodeURIComponent(String(req.tenantId))}` : '';
    return `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}${tenantSlug}`;
  }

  private getTenantVerifyEmailUrl(
    req: any,
    email: string,
    token: string,
    scope: 'tenant' | 'tenant-user',
  ): string {
    const path = scope === 'tenant-user' ? '/tenant/user/verify-email' : '/tenant/verify-email';
    const base = `${this.getFrontendBaseUrl()}${path}`;
    const tenantSlug = req?.tenantId ? `&tenant_slug=${encodeURIComponent(String(req.tenantId))}` : '';
    return `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}${tenantSlug}`;
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

  private getRefreshTokenSecret(): string {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'tenant_default_secret';
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

  private extractClientIp(req: any): string | null {
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : null;

    return this.sanitizeNullableString(forwardedIp || req?.ip || req?.socket?.remoteAddress, 64);
  }

  private extractUserAgent(req: any): string | null {
    const userAgent = req?.headers?.['user-agent'];
    if (Array.isArray(userAgent)) {
      return this.sanitizeNullableString(userAgent[0], 1024);
    }

    return this.sanitizeNullableString(userAgent, 1024);
  }

  private extractDeviceName(req: any): string | null {
    const headerValue =
      req?.headers?.['x-device-name'] || req?.headers?.['device-name'] || req?.headers?.['x-client-device'];

    if (Array.isArray(headerValue)) {
      return this.sanitizeNullableString(headerValue[0], 128);
    }

    return this.sanitizeNullableString(headerValue, 128);
  }

  private getPasswordResetTokenRepo(tenantConnection: DataSource): Repository<PasswordResetToken> {
    return tenantConnection.getRepository(PasswordResetToken);
  }

  private getEmailVerificationTokenRepo(tenantConnection: DataSource): Repository<EmailVerificationToken> {
    return tenantConnection.getRepository(EmailVerificationToken);
  }

  private getRefreshTokenRepo(tenantConnection: DataSource): Repository<RefreshToken> {
    return tenantConnection.getRepository(RefreshToken);
  }

  private async isEmailVerified(tenantConnection: DataSource, userId: number): Promise<boolean> {
    const token = await this.getEmailVerificationTokenRepo(tenantConnection)
      .createQueryBuilder('token')
      .where('token.user_id = :userId', { userId })
      .andWhere('token.verified_at IS NOT NULL')
      .getOne();

    return Boolean(token);
  }

  private async clearPasswordResetTokens(tenantConnection: DataSource, userId: number): Promise<void> {
    await this.getPasswordResetTokenRepo(tenantConnection)
      .createQueryBuilder()
      .delete()
      .from(PasswordResetToken)
      .where('user_id = :userId', { userId })
      .execute();
  }

  private async clearPendingEmailVerificationTokens(
    tenantConnection: DataSource,
    userId: number,
  ): Promise<void> {
    await this.getEmailVerificationTokenRepo(tenantConnection)
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationToken)
      .where('user_id = :userId', { userId })
      .andWhere('verified_at IS NULL')
      .execute();
  }

  private async clearRefreshTokens(tenantConnection: DataSource, userId: number): Promise<void> {
    await this.getRefreshTokenRepo(tenantConnection)
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('user_id = :userId', { userId })
      .execute();
  }

  private async revokeRefreshToken(
    tenantConnection: DataSource,
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    await this.getRefreshTokenRepo(tenantConnection)
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('token_hash = :tokenHash', { tokenHash: this.buildTokenHash(refreshToken) })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async persistRefreshToken(
    tenantConnection: DataSource,
    user: User,
    refreshToken: string,
    req: any,
  ): Promise<void> {
    await this.clearRefreshTokens(tenantConnection, user.id);
    await this.getRefreshTokenRepo(tenantConnection).save({
      user,
      tokenHash: this.buildTokenHash(refreshToken),
      expiresAt: this.getRefreshTokenExpiryDate(),
      revokedAt: null,
      deviceName: this.extractDeviceName(req),
      ipAddress: this.extractClientIp(req),
      userAgent: this.extractUserAgent(req),
    });
  }

  private async issueAuthTokens(
    tenantConnection: DataSource,
    req: any,
    user: User,
    permissionNames: string[],
    emailVerified: boolean,
  ) {
    const payload = {
      sub: user.id,
      userType: 'tenant',
      accountType: this.resolveAccountType(user, permissionNames),
      tenantId: req.tenantId || null,
      tenantDb: req.tenantConnection?.options?.database,
      email: user.email,
      role: user.role?.name,
      jobPositionId: user.jobPosition?.id ?? null,
      permissions: permissionNames,
      emailVerified,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.accessTokenTtl as any,
    });

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: `${this.refreshTokenTtlDays}d` as any,
      },
    );

    await this.persistRefreshToken(tenantConnection, user, refreshToken, req);

    return {
      accessToken,
      refreshToken,
      expires_in: this.accessTokenTtl,
      refresh_expires_in_days: this.refreshTokenTtlDays,
    };
  }

  private async sendResetPasswordEmail(
    req: any,
    email: string,
    name: string,
    token: string,
    scope: 'tenant' | 'tenant-user',
  ): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      throw new InternalServerErrorException('SMTP is not configured for password reset emails.');
    }

    const resetUrl = this.getTenantResetUrl(req, email, token, scope);
    const logoUrl = `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });

    const subject = 'Reset your tenant account password';
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
                    <p style="margin:0 0 16px;">We received a request to reset your tenant account password.</p>
                    <p style="margin:24px 0;">
                      <a href="${resetUrl}" style="background:#ff9900;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a>
                    </p>
                    <p style="margin:0 0 12px;">This link expires in ${this.resetTokenTtlMinutes} minutes and can be used only once.</p>
                    <p style="margin:0;">If you did not request a password reset, you can safely ignore this email.</p>
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

  private async sendVerificationEmail(
    req: any,
    email: string,
    name: string,
    token: string,
    scope: 'tenant' | 'tenant-user',
  ): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      throw new InternalServerErrorException('SMTP is not configured for verification emails.');
    }

    const verifyUrl = this.getTenantVerifyEmailUrl(req, email, token, scope);
    const logoUrl = `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });

    const subject = 'Verify your tenant account email';
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
                    <p style="margin:0 0 16px;">Please confirm your email address to complete your tenant account verification.</p>
                    <p style="margin:24px 0;">
                      <a href="${verifyUrl}" style="background:#ff9900;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Verify email</a>
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

  private async issueEmailVerificationToken(
    tenantConnection: DataSource,
    user: User,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.clearPendingEmailVerificationTokens(tenantConnection, user.id);
    await this.getEmailVerificationTokenRepo(tenantConnection).save({
      user,
      tokenHash: this.buildTokenHash(rawToken),
      expiresAt: new Date(Date.now() + this.emailVerificationTokenTtlMinutes * 60 * 1000),
      verifiedAt: null,
    });
    return rawToken;
  }

  private async issuePasswordResetToken(
    tenantConnection: DataSource,
    user: User,
    req: any,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.clearPasswordResetTokens(tenantConnection, user.id);
    await this.getPasswordResetTokenRepo(tenantConnection).save({
      user,
      tokenHash: this.buildTokenHash(rawToken),
      expiresAt: new Date(Date.now() + this.resetTokenTtlMinutes * 60 * 1000),
      requestedIp: this.extractClientIp(req),
      userAgent: this.extractUserAgent(req),
    });
    return rawToken;
  }

  private async findValidPasswordResetToken(
    tenantConnection: DataSource,
    email: string,
    tokenHash: string,
  ) {
    return this.getPasswordResetTokenRepo(tenantConnection)
      .createQueryBuilder('token')
      .innerJoinAndSelect('token.user', 'user')
      .where('LOWER(user.email) = :email', { email })
      .andWhere('token.token_hash = :tokenHash', { tokenHash })
      .andWhere('token.expires_at > NOW()')
      .getOne();
  }

  private async findValidEmailVerificationToken(
    tenantConnection: DataSource,
    email: string,
    tokenHash: string,
  ) {
    return this.getEmailVerificationTokenRepo(tenantConnection)
      .createQueryBuilder('token')
      .innerJoinAndSelect('token.user', 'user')
      .where('LOWER(user.email) = :email', { email })
      .andWhere('token.token_hash = :tokenHash', { tokenHash })
      .andWhere('token.expires_at > NOW()')
      .andWhere('token.verified_at IS NULL')
      .getOne();
  }

  private validateTenantLoginEmail(email: string) {
    const domain = String(email || '').toLowerCase().trim().split('@')[1] || '';

    if (!domain || this.PUBLIC_EMAIL_DOMAINS.has(domain)) {
      throw new BadRequestException(
        'Please sign in using your company email address (for example, user@companyname.com).',
      );
    }
  }

  async login(req: any, dto: { email: string; password: string }) {
    try {
      this.validateTenantLoginEmail(dto.email);

      const tenantConnection: DataSource = req.tenantConnection;
      if (!tenantConnection) {
        throw new BadRequestException('Missing tenant connection');
      }

      const userRepo = tenantConnection.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: dto.email },
        relations: ['role', 'role.permissions', 'jobPosition'],
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await argon2.verify(user.password, dto.password);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const resolvedPermissions = user.role?.permissions ?? [];
      const permissionNames = resolvedPermissions.map((permission) => permission.name);
      const emailVerified = await this.isEmailVerified(tenantConnection, user.id);
      const jobPosition = await this.resolveJobPositionSummary(tenantConnection, user);
      const accountType = this.resolveAccountType(user, permissionNames);
      const tokens = await this.issueAuthTokens(
        tenantConnection,
        req,
        user,
        permissionNames,
        emailVerified,
      );

      return {
        success: true,
        message: 'Login successful',
        user_type: 'tenant',
        account_type: accountType,
        tenant_slug: req.tenantId || null,
        tenant: tenantConnection.options.database,
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          email_verified: emailVerified,
          account_type: accountType,
          job_position: jobPosition,
          role: {
            ...user.role,
            permissions: resolvedPermissions,
          },
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Tenant Login Error:', {
        message: err.message,
        stack: err.stack,
      });

      throw new InternalServerErrorException('Something went wrong during login');
    }
  }

  async forgotPassword(req: any, dto: ForgotPasswordDto, scope: 'tenant' | 'tenant-user' = 'tenant') {
    const genericSuccess = {
      success: true,
      message: 'If the account exists, a password reset link has been sent to the registered email.',
    };

    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      return genericSuccess;
    }

    const email = dto.email.trim().toLowerCase();
    const userRepo = tenantConnection.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
      return genericSuccess;
    }

    const rawToken = await this.issuePasswordResetToken(tenantConnection, user, req);

    try {
      await this.sendResetPasswordEmail(req, user.email || email, user.name || '', rawToken, scope);
    } catch (error) {
      console.error('Tenant forgot-password email dispatch failed:', error);
    }

    return genericSuccess;
  }

  async verifyResetToken(req: any, dto: VerifyResetTokenDto) {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidPasswordResetToken(tenantConnection, email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    return {
      success: true,
      message: 'Reset token is valid.',
    };
  }

  async resetPassword(req: any, dto: ResetPasswordDto) {
    if (dto.password !== dto.password_confirm) {
      throw new BadRequestException('Passwords do not match.');
    }

    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidPasswordResetToken(tenantConnection, email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    token.user.password = await argon2.hash(dto.password);
    token.user.plainPassword = dto.password;
    await tenantConnection.getRepository(User).save(token.user);
    await this.clearPasswordResetTokens(tenantConnection, token.user.id);
    await this.clearRefreshTokens(tenantConnection, token.user.id);

    return {
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    };
  }

  async sendEmailVerification(req: any, dto: ForgotPasswordDto, scope: 'tenant' | 'tenant-user' = 'tenant') {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      return {
        success: true,
        message: 'If the account exists, an email verification link has been sent to the registered email.',
      };
    }

    const email = dto.email.trim().toLowerCase();
    const userRepo = tenantConnection.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
      return {
        success: true,
        message: 'If the account exists, an email verification link has been sent to the registered email.',
      };
    }

    if (await this.isEmailVerified(tenantConnection, user.id)) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    const rawToken = await this.issueEmailVerificationToken(tenantConnection, user);

    try {
      await this.sendVerificationEmail(req, user.email || email, user.name || '', rawToken, scope);
    } catch (error) {
      console.error('Tenant email verification dispatch failed:', error);
    }

    return {
      success: true,
      message: 'If the account exists, an email verification link has been sent to the registered email.',
    };
  }

  async verifyEmail(req: any, dto: VerifyEmailDto) {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

    const email = dto.email.trim().toLowerCase();
    const tokenHash = this.buildTokenHash(dto.token.trim());
    const token = await this.findValidEmailVerificationToken(tenantConnection, email, tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    token.verifiedAt = new Date();
    await this.getEmailVerificationTokenRepo(tenantConnection).save(token);

    return {
      success: true,
      message: 'Email verified successfully.',
    };
  }

  async refreshToken(req: any, dto: RefreshTokenDto) {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

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
    const storedToken = await this.getRefreshTokenRepo(tenantConnection)
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
      await this.clearRefreshTokens(tenantConnection, payload.sub);
      throw new UnauthorizedException('Refresh token expired.');
    }

    const user = await tenantConnection.getRepository(User).findOne({
      where: { id: payload.sub },
      relations: ['role', 'role.permissions', 'jobPosition'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const permissionNames = (user.role?.permissions ?? []).map((permission) => permission.name);
    const emailVerified = await this.isEmailVerified(tenantConnection, user.id);
    const accountType = this.resolveAccountType(user, permissionNames);
    const tokens = await this.issueAuthTokens(
      tenantConnection,
      req,
      user,
      permissionNames,
      emailVerified,
    );

    return {
      success: true,
      message: 'Token refreshed successfully.',
      user_type: 'tenant',
      account_type: accountType,
      tenant_slug: req.tenantId || null,
      tenant: tenantConnection.options.database,
      ...tokens,
    };
  }

  async getProfile(req: any, userId: number) {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

    const user = await tenantConnection.getRepository(User).findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions', 'jobPosition'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const emailVerified = await this.isEmailVerified(tenantConnection, user.id);
    const jobPosition = await this.resolveJobPositionSummary(tenantConnection, user);
    const permissionNames = (user.role?.permissions ?? []).map((permission) => permission.name);
    const accountType = this.resolveAccountType(user, permissionNames);

    return {
      success: true,
      message: 'Session is active.',
      user_type: 'tenant',
      account_type: accountType,
      tenant_slug: req.tenantId || null,
      tenant: tenantConnection.options.database,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: emailVerified,
        account_type: accountType,
        job_position: jobPosition,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              permissions: user.role.permissions ?? [],
            }
          : null,
        is_system: user.isSystem,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async logout(req: any, userId: number, dto: RefreshTokenDto) {
    const tenantConnection: DataSource = req.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

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

    await this.revokeRefreshToken(tenantConnection, userId, dto.refresh_token);

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }
}
