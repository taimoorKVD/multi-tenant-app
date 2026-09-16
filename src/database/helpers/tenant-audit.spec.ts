import { installTenantAuditTriggers } from './tenant-audit';

describe('installTenantAuditTriggers', () => {
  it('installs redaction, row audit, and per-table triggers', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      query,
      entityMetadatas: [
        {
          tableName: 'users',
          tablePath: 'users',
          tableType: 'regular',
          schema: undefined,
          primaryColumns: [{ databaseName: 'id' }],
        },
        {
          tableName: 'role_permissions_permission',
          tablePath: 'role_permissions_permission',
          tableType: 'junction',
          schema: undefined,
          primaryColumns: [
            { databaseName: 'roleId' },
            { databaseName: 'permissionId' },
          ],
        },
        {
          tableName: 'audit_logs',
          tablePath: 'audit_logs',
          tableType: 'regular',
          schema: undefined,
          primaryColumns: [{ databaseName: 'id' }],
        },
      ],
    };

    await installTenantAuditTriggers(dataSource as any);

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0][0]).toContain('tenant_audit_redact');
    expect(query.mock.calls[1][0]).toContain('tenant_audit_row_change');
    expect(query.mock.calls[1][0]).toContain(
      "current_setting('app.tenant_audit_actor_id', true)",
    );
    expect(query.mock.calls[1][0]).toContain(
      "current_setting('app.tenant_audit_ip_address', true)",
    );
    expect(query.mock.calls[2][0]).toContain('ON "users"');
    expect(query.mock.calls[2][0]).toContain("tenant_audit_row_change('id')");
    expect(query.mock.calls[3][0]).toContain('ON "role_permissions_permission"');
    expect(query.mock.calls[3][0]).toContain(
      "tenant_audit_row_change('roleId,permissionId')",
    );
    expect(query.mock.calls.some(([sql]) => sql.includes('ON "audit_logs"'))).toBe(false);
  });

  it('quotes schema and table identifiers', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      query,
      entityMetadatas: [
        {
          tableName: 'order',
          tablePath: 'tenant.order',
          tableType: 'regular',
          schema: 'tenant',
          primaryColumns: [{ databaseName: 'id' }],
        },
      ],
    };

    await installTenantAuditTriggers(dataSource as any);

    expect(query.mock.calls[2][0]).toContain('ON "tenant"."order"');
  });
});
