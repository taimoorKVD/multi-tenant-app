import { existsSync } from 'fs';
import { join } from 'path';
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_PUBLIC_PATH,
  prepareEmailLogo,
  resolveEmailLogoUrl,
  toNodemailerLogoAttachments,
} from './email-logo.util';

describe('email-logo.util', () => {
  const originalEnv = process.env;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MAIL_LOGO_URL;
    delete process.env.LOGO_URL;
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.MAIL_LOGO_PATH;
    fetchMock = jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('logo unavailable'));
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchMock.mockRestore();
  });

  it('points the remote fallback at /images/eusocial-logo.png', () => {
    process.env.FRONTEND_URL = 'https://eusocial.thebetawebsite.com';
    expect(resolveEmailLogoUrl()).toBe(
      `https://eusocial.thebetawebsite.com${EMAIL_LOGO_PUBLIC_PATH}`,
    );
  });

  it('embeds the bundled logo as an inline CID attachment without fetching', async () => {
    const localPath = join(__dirname, '..', 'assets', 'eusocial-logo.png');
    expect(existsSync(localPath)).toBe(true);

    const prepared = await prepareEmailLogo();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prepared.logoSrc).toBe(`cid:${EMAIL_LOGO_CID}`);
    expect(prepared.attachment?.filename).toBe('eusocial-logo.png');
    expect(prepared.attachment?.content.length).toBeGreaterThan(0);
    expect(toNodemailerLogoAttachments(prepared.attachment)).toEqual([
      expect.objectContaining({
        cid: EMAIL_LOGO_CID,
        contentDisposition: 'inline',
        contentType: 'image/png',
      }),
    ]);
  });
});
