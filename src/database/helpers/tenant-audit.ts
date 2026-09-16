import { DataSource, EntityMetadata } from 'typeorm';

const AUDIT_TABLE = 'audit_logs';
const AUDIT_TRIGGER = 'trg_tenant_audit_row_change';

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function qualifiedTableName(metadata: EntityMetadata): string {
  const tableName = quoteIdentifier(metadata.tableName);
  return metadata.schema
    ? `${quoteIdentifier(metadata.schema)}.${tableName}`
    : tableName;
}

function primaryColumnArgument(metadata: EntityMetadata): string {
  return metadata.primaryColumns
    .map((column) => column.databaseName)
    .join(',');
}

/**
 * Installs database-level auditing for every entity in a tenant database.
 *
 * PostgreSQL triggers are used deliberately: they also capture repository.update,
 * query-builder, transaction, background-job, and raw SQL writes that bypass
 * Nest services. The audit table itself is excluded to prevent recursion.
 */
export async function installTenantAuditTriggers(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION public.tenant_audit_redact(payload jsonb)
    RETURNS jsonb
    LANGUAGE plpgsql
    IMMUTABLE
    AS $audit_redact$
    DECLARE
      result jsonb;
    BEGIN
      IF payload IS NULL THEN
        RETURN NULL;
      END IF;

      CASE jsonb_typeof(payload)
        WHEN 'object' THEN
          SELECT COALESCE(
            jsonb_object_agg(
              entry.key,
              CASE
                WHEN lower(entry.key) = ANY (ARRAY[
                  'password',
                  'plain_password',
                  'encrypted_password',
                  'token',
                  'token_hash',
                  'reset_token',
                  'access_token',
                  'refresh_token',
                  'secret',
                  'client_secret',
                  'api_key',
                  'authorization'
                ])
                THEN to_jsonb('[REDACTED]'::text)
                ELSE public.tenant_audit_redact(entry.value)
              END
            ),
            '{}'::jsonb
          )
          INTO result
          FROM jsonb_each(payload) AS entry;
        WHEN 'array' THEN
          SELECT COALESCE(
            jsonb_agg(public.tenant_audit_redact(element.value)),
            '[]'::jsonb
          )
          INTO result
          FROM jsonb_array_elements(payload) AS element;
        ELSE
          result := payload;
      END CASE;

      RETURN result;
    END;
    $audit_redact$;
  `);

  await dataSource.query(`
    CREATE OR REPLACE FUNCTION public.tenant_audit_row_change()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $audit_row$
    DECLARE
      source_row jsonb;
      old_row jsonb;
      new_row jsonb;
      entity_key_value jsonb;
      entity_id_text text;
      entity_id_value integer;
      actor_text text;
      actor_id integer;
      request_ip_address text;
      action_name text;
    BEGIN
      old_row := CASE
        WHEN TG_OP IN ('UPDATE', 'DELETE')
        THEN public.tenant_audit_redact(to_jsonb(OLD))
        ELSE NULL
      END;
      new_row := CASE
        WHEN TG_OP IN ('INSERT', 'UPDATE')
        THEN public.tenant_audit_redact(to_jsonb(NEW))
        ELSE NULL
      END;
      source_row := COALESCE(new_row, old_row);

      SELECT jsonb_object_agg(entry.key, entry.value)
      INTO entity_key_value
      FROM jsonb_each(source_row) AS entry
      WHERE entry.key = ANY (string_to_array(TG_ARGV[0], ','));

      entity_id_text := source_row ->> 'id';
      IF entity_id_text ~ '^[0-9]+$' THEN
        entity_id_value := entity_id_text::integer;
      END IF;

      actor_text := COALESCE(
        NULLIF(current_setting('app.tenant_audit_actor_id', true), ''),
        new_row ->> 'updated_by',
        new_row ->> 'created_by',
        old_row ->> 'updated_by',
        old_row ->> 'created_by'
      );
      IF actor_text ~ '^[0-9]+$' THEN
        actor_id := actor_text::integer;
      END IF;

      request_ip_address := NULLIF(
        current_setting('app.tenant_audit_ip_address', true),
        ''
      );

      action_name := CASE TG_OP
        WHEN 'INSERT' THEN 'create'
        WHEN 'DELETE' THEN 'delete'
        ELSE 'update'
      END;

      IF TG_OP = 'UPDATE'
        AND old_row -> 'deleted_at' = 'null'::jsonb
        AND new_row -> 'deleted_at' IS DISTINCT FROM 'null'::jsonb
      THEN
        action_name := 'soft_delete';
      END IF;

      INSERT INTO public.audit_logs (
        entity_type,
        entity_id,
        entity_key,
        action,
        old_value,
        new_value,
        ip_address,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at
      )
      VALUES (
        TG_TABLE_NAME,
        entity_id_value,
        entity_key_value,
        action_name,
        old_row,
        new_row,
        request_ip_address,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        actor_id,
        actor_id,
        NULL
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $audit_row$;
  `);

  const auditedEntities = [
    ...new Map(
      dataSource.entityMetadatas
        .filter(
          (metadata) => metadata.tableName !== AUDIT_TABLE && metadata.tableType !== 'view',
        )
        .map((metadata) => [metadata.tablePath, metadata]),
    ).values(),
  ];

  for (const metadata of auditedEntities) {
    const tableName = qualifiedTableName(metadata);
    const primaryColumns = primaryColumnArgument(metadata).replace(/'/g, "''");

    await dataSource.query(`
      DROP TRIGGER IF EXISTS ${quoteIdentifier(AUDIT_TRIGGER)} ON ${tableName};
      CREATE TRIGGER ${quoteIdentifier(AUDIT_TRIGGER)}
      AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION public.tenant_audit_row_change('${primaryColumns}');
    `);
  }
}
