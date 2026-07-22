import { useEffect, useRef, useState } from 'react'
import { ApiError, getMigrationStatus, publishConnection } from '../api/client'
import type { ConnectionResponse, TaskStatusResponse } from '../api/types'

interface PublishStepProps {
  connection: ConnectionResponse
  tableName: string
  targetConfig: Record<string, unknown>
  onBack: () => void
  onRestart: () => void
}

const POLL_INTERVAL_MS = 2000

export default function PublishStep({ connection, tableName, targetConfig, onBack, onRestart }: PublishStepProps) {
  const [mergeKeys, setMergeKeys] = useState('')
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

  async function handleStart() {
    setError(null)
    setStarting(true)
    try {
      const keys = mergeKeys
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await publishConnection(connection.id, {
        table_name: tableName,
        merge_keys: keys.length > 0 ? keys : null,
        target_config: targetConfig,
      })
      setTaskId(res.task_id)
      setStatus({ task_id: res.task_id, status: 'running', stage: 'published', result: null, error: null, detail: null })

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

  const isDone = status?.status === 'completed' || status?.status === 'failed'
  const action = status?.detail?.action
  const schemaChanged = status?.detail?.schema_changed

  return (
    <div className="step">
      <h2>Publish (Stage 3)</h2>
      <p className="step-subtitle">
        Move the transformed increment for <strong>{tableName}</strong> into the published curated dataset — create,
        append, or upsert, decided automatically from whether it already exists.
      </p>

      <div className="card">
        <div className="form-field">
          <label htmlFor="merge-keys">Merge key(s) (comma-separated, optional)</label>
          <input
            id="merge-keys"
            type="text"
            value={mergeKeys}
            placeholder="e.g. id"
            onChange={(e) => setMergeKeys(e.target.value)}
            disabled={Boolean(taskId)}
          />
          <p className="field-help">
            Leave blank to append. Set this if re-publishing should update matching rows instead of duplicating them.
          </p>
        </div>

        {error && <p className="error-message">{error}</p>}

        {!taskId && (
          <button type="button" className="primary-button" disabled={starting} onClick={handleStart}>
            <span className="btn-icon">▶</span> {starting ? 'Starting…' : 'Publish'}
          </button>
        )}

        {status && (
          <div className="run-status">
            <p>
              Status: <span className={`status-badge status-badge--${status.status}`}>{status.status}</span>
            </p>
            {status.status === 'running' && <p className="muted">Working… this page updates automatically.</p>}
            {status.status === 'failed' && status.error && <p className="error-message">{status.error}</p>}
            {status.status === 'completed' && (
              <>
                {action && (
                  <p>
                    Action taken: <span className="tag">{action}</span>
                  </p>
                )}
                {schemaChanged && (
                  <p className="error-message">
                    Schema changed since the last publish — re-run your Glue crawler before querying via Athena.
                  </p>
                )}
                {status.result && (
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
              </>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button type="button" className="secondary-button" onClick={onBack} disabled={Boolean(taskId) && !isDone}>
          <span className="btn-icon">←</span> Back
        </button>
        {isDone && (
          <button type="button" className="primary-button" onClick={onRestart}>
            <span className="btn-icon">↺</span> Start Over
          </button>
        )}
      </div>
    </div>
  )
}
