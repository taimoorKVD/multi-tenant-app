import { StripLegacyCreateTenantBodyMiddleware } from './strip-legacy-create-tenant-body.middleware';

describe('StripLegacyCreateTenantBodyMiddleware', () => {
  const middleware = new StripLegacyCreateTenantBodyMiddleware();

  it('removes deprecated admin credentials from create-tenant POST bodies', () => {
    const req = {
      method: 'POST',
      body: {
        name: 'logicose',
        email: 'omais.kv@gmail.com',
        admin: {
          name: 'logicose',
          email: 'omais.kv@gmail.com',
          password: '%teChX^2TbBd',
          confirmPassword: '%teChX^2TbBd',
        },
        confirmPassword: '%teChX^2TbBd',
      },
    } as any;

    middleware.use(req, {} as any, () => undefined);

    expect(req.body.admin).toBeUndefined();
    expect(req.body.confirmPassword).toBeUndefined();
    expect(req.body.name).toBe('logicose');
    expect(req.body.email).toBe('omais.kv@gmail.com');
  });

  it('leaves non-POST requests unchanged', () => {
    const req = {
      method: 'PUT',
      body: { admin: { password: 'secret' } },
    } as any;

    middleware.use(req, {} as any, () => undefined);

    expect(req.body.admin).toEqual({ password: 'secret' });
  });
});
