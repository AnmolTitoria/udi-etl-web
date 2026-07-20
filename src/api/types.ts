// Any registered connector name is valid here, not just the built-in ones —
// custom/plugin connectors show up in GET /sources alongside them.
export type SourceType = string
export type TargetType = string

export interface ConnectionCreate {
  name: string
  source_type: SourceType
  description?: string
  extra_config?: Record<string, unknown>
  [field: string]: unknown
}

export interface SourceSchemaField {
  name: string
  type: 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'json'
  required: boolean
  optional: boolean
  default: string | number | boolean | null
  options: string[] | null
  description: string | null
}

export interface ConnectorSchemaResponse {
  source_type?: string
  target_type?: string
  fields: SourceSchemaField[]
}

export interface ConnectionResponse {
  id: string
  name: string
  source_type: string
  description?: string
  config: Record<string, unknown>
  created_at: string | null
}

export interface ConnectionListResponse {
  connections: ConnectionResponse[]
}

export interface TableListResponse {
  tables: string[]
}

export interface QueryResponse {
  columns: string[]
  rows: unknown[][]
  row_count: number
}

export interface MigrationResponse {
  task_id: string
  status: string
  message: string
}

export interface LoadResultSchema {
  destination_type: string
  table_name: string
  rows_loaded: number
  batch_count: number
  errors: string[]
}

export interface TaskStatusResponse {
  task_id: string
  status: 'running' | 'completed' | 'failed' | string
  stage: 'landed' | 'transformed' | 'published' | string
  result: LoadResultSchema[] | null
  error: string | null
  detail: { action?: string; schema_changed?: boolean } & Record<string, unknown> | null
}

export interface TransformRuleConfig {
  rename?: Record<string, string>
  cast?: Record<string, string>
  drop_columns?: string[]
  drop_nulls?: string[]
  dedupe_keys?: string[] | null
}

export interface TransformRequest {
  table_name: string
  sql?: string | null
  rule?: TransformRuleConfig | null
  source_type?: string
  source_config?: Record<string, unknown>
  target_config?: Record<string, unknown>
  batch_size?: number | null
}

export interface PublishRequest {
  table_name: string
  merge_keys?: string[] | null
  target_config?: Record<string, unknown>
}

export interface SourcesResponse {
  sources: string[]
}

export interface TargetsResponse {
  targets: string[]
}

export interface ApiErrorBody {
  detail?: string
}

export interface UserResponse {
  id: string
  email: string
  name: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserResponse
}
