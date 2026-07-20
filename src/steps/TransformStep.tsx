import { useEffect, useRef, useState } from 'react'
import { ApiError, getMigrationStatus, transformConnection } from '../api/client'
import type { ConnectionResponse, TaskStatusResponse, TransformRuleConfig } from '../api/types'
import DynamicForm from '../components/DynamicForm'
import { SOURCE_FIELDS, defaultsFor } from '../lib/fieldSpecs'

interface TransformStepProps {
  connection: ConnectionResponse
  tables: string[]
  targetConfig: Record<string, unknown>
  onBack: () => void
  onRestart: () => void
  onPublish: (tableName: string) => void
}

const POLL_INTERVAL_MS = 2000
const ATHENA_FIELDS = SOURCE_FIELDS.athena ?? []

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function TransformStep({ connection, tables, targetConfig, onBack, onRestart, onPublish }: TransformStepProps) {
  const [tableName, setTableName] = useState(tables[0] ?? '')
  const [mode, setMode] = useState<'sql' | 'rule'>('rule')
  const [sql, setSql] = useState('SELECT * FROM table_name')
  const [renameJson, setRenameJson] = useState('{}')
  const [castJson, setCastJson] = useState('{}')
  const [dropColumns, setDropColumns] = useState('')
  const [dropNulls, setDropNulls] = useState('')
  const [dedupeKeys, setDedupeKeys] = useState('')

  const [readerType, setReaderType] = useState<'athena' | 's3'>('athena')
  const [athenaValues, setAthenaValues] = useState<Record<string, unknown>>(() => defaultsFor(ATHENA_FIELDS))

  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<TaskStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    }
  }, [])

  function buildRule(): TransformRuleConfig {
    let rename: Record<string, string> = {}
    let cast: Record<string, string> = {}
    try {
      rename = renameJson.trim() ? JSON.parse(renameJson) : {}
    } catch {
      throw new Error('"Rename columns" must be valid JSON, e.g. {"old_col": "new_col"}')
    }
    try {
      cast = castJson.trim() ? JSON.parse(castJson) : {}
    } catch {
      throw new Error('"Cast types" must be valid JSON, e.g. {"amount": "float64"}')
    }
    return {
      rename,
      cast,
      drop_columns: parseList(dropColumns),
      drop_nulls: parseList(dropNulls),
      dedupe_keys: dedupeKeys.trim() ? parseList(dedupeKeys) : null,
    }
  }

  async function handleStart() {
    setError(null)
    if (!tableName) {
      setError('Pick a table to transform')
      return
    }

    let rule: TransformRuleConfig | undefined
    if (mode === 'rule') {
      try {
        rule = buildRule()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return
      }
    }

    const sourceConfig =
      readerType === 's3'
        ? {
            bucket_name: targetConfig.bucket_name,
            region: targetConfig.region,
            endpoint_url: targetConfig.endpoint_url,
            access_key: targetConfig.access_key,
            secret_key: targetConfig.secret_key,
          }
        : athenaValues

    setStarting(true)
    try {
      const res = await transformConnection(connection.id, {
        table_name: tableName,
        sql: mode === 'sql' ? sql : null,
        rule: mode === 'rule' ? rule : null,
        source_type: readerType,
        source_config: sourceConfig,
        target_config: targetConfig,
      })
      setTaskId(res.task_id)
      setStatus({ task_id: res.task_id, status: 'running', stage: 'transformed', result: null, error: null, detail: null })

      intervalRef.current = window.setInterval(async () => {
        try {
          const latest = await getMigrationStatus(res.task_id)
          setStatus(latest)
          if (latest.status === 'completed' || latest.status === 'failed') {
            if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
          }
        } catch (e) {
          if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
        }
      }, POLL_INTERVAL_MS)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  const isRunning = status?.status === 'running'
  const isDone = status?.status === 'completed' || status?.status === 'failed'

  return (
    <div className="step">
      <h2>Transform data (Stage 2)</h2>
      <p className="step-subtitle">
        Read the raw landing for <strong>{connection.name}</strong>, apply a transform, and land the result in the
        curated zone.
      </p>

      <div className="card">
        <div className="form-field">
          <label htmlFor="transform-table">Table</label>
          <select id="transform-table" value={tableName} onChange={(e) => setTableName(e.target.value)} disabled={Boolean(taskId)}>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="transform-reader">Read raw zone via</label>
          <select
            id="transform-reader"
            value={readerType}
            onChange={(e) => setReaderType(e.target.value as 'athena' | 's3')}
            disabled={Boolean(taskId)}
          >
            <option value="athena">Athena (SQL)</option>
            <option value="s3">Direct S3 reader (no SQL, fallback)</option>
          </select>
          {readerType === 's3' && (
            <p className="field-help">Reads straight from the raw zone's Parquet/CSV/JSONL files — no Glue Catalog needed.</p>
          )}
        </div>

        {readerType === 'athena' && (
          <DynamicForm
            fields={ATHENA_FIELDS}
            values={athenaValues}
            onChange={(n, v) => setAthenaValues((prev) => ({ ...prev, [n]: v }))}
            disabled={Boolean(taskId)}
          />
        )}

        <div className="form-field">
          <label htmlFor="transform-mode">Transform</label>
          <select id="transform-mode" value={mode} onChange={(e) => setMode(e.target.value as 'sql' | 'rule')} disabled={Boolean(taskId)}>
            <option value="rule">Automatic (rules)</option>
            <option value="sql">Manual (SQL, Athena only)</option>
          </select>
        </div>

        {mode === 'sql' ? (
          <div className="form-field">
            <label htmlFor="transform-sql">SQL</label>
            <textarea
              id="transform-sql"
              className="query-editor"
              rows={6}
              value={sql}
              spellCheck={false}
              onChange={(e) => setSql(e.target.value)}
              disabled={Boolean(taskId) || readerType !== 'athena'}
            />
            {readerType !== 'athena' && <p className="field-help">SQL transforms require the Athena reader.</p>}
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="rule-rename">Rename columns (JSON)</label>
              <textarea
                id="rule-rename"
                className="json-field"
                rows={2}
                value={renameJson}
                placeholder='{"old_col": "new_col"}'
                onChange={(e) => setRenameJson(e.target.value)}
                disabled={Boolean(taskId)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="rule-cast">Cast types (JSON)</label>
              <textarea
                id="rule-cast"
                className="json-field"
                rows={2}
                value={castJson}
                placeholder='{"amount": "float64"}'
                onChange={(e) => setCastJson(e.target.value)}
                disabled={Boolean(taskId)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="rule-drop-columns">Drop columns (comma-separated)</label>
              <input id="rule-drop-columns" type="text" value={dropColumns} onChange={(e) => setDropColumns(e.target.value)} disabled={Boolean(taskId)} />
            </div>
            <div className="form-field">
              <label htmlFor="rule-drop-nulls">Drop rows with null in (comma-separated)</label>
              <input id="rule-drop-nulls" type="text" value={dropNulls} onChange={(e) => setDropNulls(e.target.value)} disabled={Boolean(taskId)} />
            </div>
            <div className="form-field">
              <label htmlFor="rule-dedupe">Dedupe by key(s) (comma-separated)</label>
              <input id="rule-dedupe" type="text" value={dedupeKeys} onChange={(e) => setDedupeKeys(e.target.value)} disabled={Boolean(taskId)} />
            </div>
          </>
        )}

        {error && <p className="error-message">{error}</p>}

        {!taskId && (
          <button type="button" className="primary-button" disabled={starting} onClick={handleStart}>
            {starting ? 'Starting…' : 'Run Transform'}
          </button>
        )}

        {status && (
          <div className="run-status">
            <p>
              Status: <span className={`status-badge status-badge--${status.status}`}>{status.status}</span>
            </p>
            {isRunning && <p className="muted">Working… this page updates automatically.</p>}
            {status.status === 'failed' && status.error && <p className="error-message">{status.error}</p>}
            {status.status === 'completed' && status.result && (
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Rows Loaded</th>
                    <th>Batches</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {status.result.map((r) => (
                    <tr key={r.table_name}>
                      <td>{r.table_name}</td>
                      <td>{r.rows_loaded}</td>
                      <td>{r.batch_count}</td>
                      <td>{r.errors.length > 0 ? r.errors.join('; ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button type="button" className="secondary-button" onClick={onBack} disabled={Boolean(taskId) && !isDone}>
          Back
        </button>
        {isDone && status?.status === 'completed' && (
          <button type="button" className="primary-button" onClick={() => onPublish(tableName)}>
            Continue to Publish
          </button>
        )}
        {isDone && (
          <button type="button" className="secondary-button" onClick={onRestart}>
            Start Over
          </button>
        )}
      </div>
    </div>
  )
}
