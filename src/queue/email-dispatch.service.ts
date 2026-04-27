import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { EmailLog } from '../master/mail/entities';
import { EMAIL_LOG_STATUS } from '../mail/constants/mail.constants';
import { EmailJobPayload } from '../mail/interfaces/mail-job.interface';

@Injectable()
export class EmailDispatchService {
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
  ) {}

  async dispatch(payload: EmailJobPayload, attempt = 1, maxAttempts = 3) {
    const transporter = nodemailer.createTransport({
      host: payload.smtp.host,
      port: payload.smtp.port,
      secure: payload.smtp.secure,
      auth: payload.smtp.username
        ? {
            user: payload.smtp.username,
            pass: payload.smtp.password || undefined,
          }
        : undefined,
    });

    const sendMessage = async (activeTransport: nodemailer.Transporter) =>
      activeTransport.sendMail({
        from: payload.smtp.fromName
          ? `"${payload.smtp.fromName}" <${payload.smtp.fromEmail}>`
          : payload.smtp.fromEmail,
        to: payload.to,
        cc: payload.cc.length ? payload.cc : undefined,
        bcc: payload.bcc.length ? payload.bcc : undefined,
        replyTo: payload.smtp.replyTo || undefined,
        subject: payload.subject,
        html: payload.body,
      });

    const shouldUseEthereal =
      (process.env.NODE_ENV || 'development').toLowerCase() === 'development' &&
      String(process.env.MAIL_ETHEREAL_FALLBACK || 'true') === 'true';

    const isDnsLookupError = (error: unknown) => {
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : String(error || '');
      return code === 'ENOTFOUND' || /ENOTFOUND/i.test(message);
    };

    const configuredIps = (process.env.MAILTRAP_FALLBACK_IPS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const tryMailtrapIpFallback = async (originalHost: string): Promise<nodemailer.SentMessageInfo> => {
      const fallbackIps = configuredIps.length
        ? configuredIps
        : ['3.86.141.192', '18.215.44.90', '3.219.2.182', '54.158.84.126'];

      let lastIpError: unknown;
      for (const ip of fallbackIps) {
        const ipTransport = nodemailer.createTransport({
          host: ip,
          port: payload.smtp.port,
          secure: payload.smtp.secure,
          auth: payload.smtp.username
            ? { user: payload.smtp.username, pass: payload.smtp.password || undefined }
            : undefined,
          tls: { servername: originalHost },
        });
        try {
          const result = await sendMessage(ipTransport);
          ipTransport.close();
          return result;
        } catch (ipErr) {
          ipTransport.close();
          lastIpError = ipErr;
        }
      }
      throw lastIpError;
    };

    const isMailtrapHost = (host: string) =>
      /mailtrap/i.test(host) || host === 'sandbox.smtp.mailtrap.io';

    try {
      let info;

      try {
        info = await sendMessage(transporter);
      } catch (primaryError) {
        // Try Mailtrap IP fallback if DNS lookup fails for Mailtrap host
        if (isDnsLookupError(primaryError) && isMailtrapHost(payload.smtp.host)) {
          try {
            info = await tryMailtrapIpFallback(payload.smtp.host);
            await this.emailLogRepo.update(payload.logId, {
              metadata: { provider_fallback: 'mailtrap-ip' },
            });
          } catch (ipFallbackError) {
            // IP fallback also failed; try Ethereal or rethrow
            if (!shouldUseEthereal) {
              const combinedMsg = `Primary SMTP failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. IP fallback failed: ${ipFallbackError instanceof Error ? ipFallbackError.message : String(ipFallbackError)}`;
              throw new Error(combinedMsg);
            }
            // fall through to Ethereal below
            const etherealPrimaryError = new Error(
              `Primary SMTP failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. IP fallback failed: ${ipFallbackError instanceof Error ? ipFallbackError.message : String(ipFallbackError)}`,
            );
            throw etherealPrimaryError;
          }
        } else if (!shouldUseEthereal) {
          throw primaryError;
        } else {
          const testAccount = await nodemailer.createTestAccount();
          const etherealTransport = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });

          try {
            info = await sendMessage(etherealTransport);
          } catch (etherealError) {
            etherealTransport.close();
            const combinedMsg = `Primary SMTP failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. Ethereal fallback failed: ${etherealError instanceof Error ? etherealError.message : String(etherealError)}`;
            throw new Error(combinedMsg);
          }

          const previewUrl = nodemailer.getTestMessageUrl(info) || null;

          await this.emailLogRepo.update(payload.logId, {
            metadata: {
              provider_fallback: 'ethereal',
              preview_url: previewUrl || '',
              original_provider: payload.smtp.provider || '',
            },
          });

          etherealTransport.close();
        }
      }

      await this.emailLogRepo.update(payload.logId, {
        status: EMAIL_LOG_STATUS.SENT,
        retryCount: Math.max(attempt - 1, 0),
        errorMessage: null,
        lastAttemptAt: new Date(),
        transportMessageId: info.messageId,
      });

      return info;
    } catch (error) {
      await this.emailLogRepo.update(payload.logId, {
        status: attempt >= maxAttempts ? EMAIL_LOG_STATUS.FAILED : EMAIL_LOG_STATUS.PENDING,
        retryCount: attempt,
        errorMessage: error instanceof Error ? error.message : 'Unknown email failure',
        lastAttemptAt: new Date(),
      });

      throw error;
    } finally {
      transporter.close();
    }
  }
}