import type { SourceSchemaField } from '../api/types'

export type FieldType = 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'file' | 'json'

export interface FieldSpec {
  name: string
  label: string
  type: FieldType
  required?: boolean
  default?: string | number | boolean
  options?: { label: string; value: string }[]
  placeholder?: string
  help?: string
}

export const SOURCE_FIELDS: Record<string, FieldSpec[]> = {
  postgresql: [
    { name: 'host', label: 'Host', type: 'text', required: true, default: 'localhost' },
    { name: 'port', label: 'Port', type: 'number', default: 5432 },
    { name: 'database', label: 'Database', type: 'text', required: true },
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true },
    {
      name: 'ssl_mode',
      label: 'SSL Mode',
      type: 'select',
      default: 'prefer',
      options: ['disable', 'allow', 'prefer', 'require'].map((v) => ({ label: v, value: v })),
    },
    { name: 'batch_size', label: 'Batch Size', type: 'number', default: 20000 },
    { name: 'incremental_column', label: 'Incremental Column (optional)', type: 'text', help: 'Column to track progress, e.g. id' },
    { name: 'checkpoint_file', label: 'Checkpoint File (optional)', type: 'text' },
  ],
  mongodb: [
    { name: 'connection_string', label: 'Connection String', type: 'text', required: true, placeholder: 'mongodb://host:27017' },
    { name: 'database', label: 'Database', type: 'text', required: true },
    { name: 'batch_size', label: 'Batch Size', type: 'number', default: 20000 },
    { name: 'incremental_field', label: 'Incremental Field (optional)', type: 'text' },
    { name: 'checkpoint_file', label: 'Checkpoint File (optional)', type: 'text' },
  ],
  sql: [
    {
      name: 'dialect',
      label: 'Dialect',
      type: 'select',
      required: true,
      default: 'postgresql',
      options: ['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite'].map((v) => ({ label: v, value: v })),
    },
    { name: 'host', label: 'Host', type: 'text', required: true, default: 'localhost' },
    { name: 'port', label: 'Port', type: 'number' },
    { name: 'database', label: 'Database', type: 'text', required: true },
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'batch_size', label: 'Batch Size', type: 'number', default: 20000 },
    { name: 'incremental_column', label: 'Incremental Column (optional)', type: 'text' },
    { name: 'checkpoint_file', label: 'Checkpoint File (optional)', type: 'text' },
  ],
  file_upload: [
    { name: 'input_dir', label: 'Input Directory', type: 'text', required: true, placeholder: 'C:/Users/you/Downloads' },
    { name: 'files', label: 'Selected Files', type: 'file' },
    { name: 'recursive', label: 'Scan subfolders', type: 'checkbox', default: false },
    { name: 'include_content', label: 'Include file content', type: 'checkbox', default: false },
    { name: 'batch_size', label: 'Batch Size', type: 'number', default: 20000 },
    { name: 'checkpoint_file', label: 'Checkpoint File (optional)', type: 'text' },
  ],
  athena: [
    { name: 'database', label: 'Database (Glue catalog)', type: 'text', required: true, help: 'The Athena/Glue database the dump’s table is registered in' },
    { name: 'workgroup', label: 'Workgroup', type: 'text', default: 'primary' },
    { name: 'output_location', label: 'Query Output Location', type: 'text', placeholder: 's3://my-athena-results/', help: 'S3 path for Athena to stage query results; optional if the workgroup has a default' },
    { name: 'region', label: 'Region', type: 'text', default: 'us-east-1' },
    { name: 'catalog', label: 'Data Catalog', type: 'text', default: 'AwsDataCatalog' },
    { name: 'access_key', label: 'Access Key (optional)', type: 'text', help: 'Leave blank to use the default AWS credential chain' },
    { name: 'secret_key', label: 'Secret Key (optional)', type: 'password' },
    { name: 'session_token', label: 'Session Token (optional)', type: 'password' },
    { name: 'batch_size', label: 'Batch Size', type: 'number', default: 1000 },
    { name: 'incremental_column', label: 'Incremental Column (optional)', type: 'text' },
    { name: 'checkpoint_file', label: 'Checkpoint File (optional)', type: 'text' },
  ],
}

export const TARGET_FIELDS: Record<string, FieldSpec[]> = {
  s3: [
    { name: 'bucket_name', label: 'Bucket Name', type: 'text', required: true },
    { name: 'region', label: 'Region', type: 'text', default: 'us-east-1' },
    {
      name: 'endpoint_url',
      label: 'Endpoint URL (optional)',
      type: 'text',
      placeholder: 'http://localhost:9000',
      help: 'Set this for an S3-compatible store (e.g. MinIO); leave blank for real AWS S3',
    },
    { name: 'access_key', label: 'Access Key (optional)', type: 'text', help: 'Leave blank to use the default AWS credential chain' },
    { name: 'secret_key', label: 'Secret Key (optional)', type: 'password' },
    {
      name: 'file_format',
      label: 'File Format',
      type: 'select',
      default: 'parquet',
      options: ['csv', 'parquet', 'jsonl'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'compression',
      label: 'Compression',
      type: 'select',
      default: 'snappy',
      options: ['none', 'snappy', 'gzip'].map((v) => ({ label: v, value: v })),
    },
  ],
}

export function defaultsFor(fields: FieldSpec[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.default !== undefined && f.default !== null) values[f.name] = f.default
    else if (f.type === 'checkbox') values[f.name] = false
    else if (f.type === 'file') values[f.name] = []
    else if (f.type === 'json') values[f.name] = '{}'
    else values[f.name] = ''
  }
  return values
}

// 'json' fields hold raw textarea text while being edited (so a
// mid-edit/invalid string doesn't fight the user); this resolves them to
// real objects right before a payload is sent, surfacing a field-level
// error instead of letting the server reject a malformed body.
export function resolveJsonFields(
  fields: FieldSpec[],
  values: Record<string, unknown>,
): { values: Record<string, unknown>; error: string | null } {
  const resolved = { ...values }
  for (const f of fields) {
    if (f.type !== 'json') continue
    const raw = resolved[f.name]
    if (typeof raw !== 'string') continue
    if (raw.trim() === '') {
      resolved[f.name] = {}
      continue
    }
    try {
      resolved[f.name] = JSON.parse(raw)
    } catch {
      return { values: resolved, error: `"${f.label}" must be valid JSON` }
    }
  }
  return { values: resolved, error: null }
}

function humanizeLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Renders a connector's schema (from GET /sources/{name}/schema) as a form —
// the fallback for any connector, built-in or custom, that doesn't have a
// hand-authored entry in SOURCE_FIELDS/TARGET_FIELDS above.
export function schemaFieldsToFieldSpecs(fields: SourceSchemaField[]): FieldSpec[] {
  return fields.map((f) => ({
    name: f.name,
    label: humanizeLabel(f.name) + (f.optional ? ' (optional)' : ''),
    type: f.type,
    required: f.required,
    default: f.default ?? undefined,
    options: f.options?.map((v) => ({ label: v, value: v })),
    help: f.description ?? undefined,
  }))
}
