import { useState } from 'react'
import { ApiError, runQuery } from '../api/client'
import type { ConnectionResponse, QueryResponse } from '../api/types'

interface QueryStepProps {
  connection: ConnectionResponse
  onBack: () => void
  onRestart: () => void
}

const DEFAULT_SQL = 'SELECT * FROM table_name LIMIT 100'

export default function QueryStep({ connection, onBack, onRestart }: QueryStepProps) {
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun(e: React.MouseEvent) {
    e.preventDefault()
    if (!sql.trim()) {
      setError('Enter a query to run')
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await runQuery(connection.id, sql)
      setResult(res)
    } catch (e) {
      setResult(null)
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="step">
      <h2>Query Athena</h2>
      <p className="step-subtitle">
        Write a SQL query and run it against <strong>{connection.name}</strong> (database{' '}
        <strong>{String(connection.config.database ?? '')}</strong>).
      </p>

      <div className="card">
        <div className="form-field">
          <label htmlFor="athena-sql">SQL Query</label>
          <textarea
            id="athena-sql"
            className="query-editor"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={8}
            spellCheck={false}
            disabled={running}
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="button" className="primary-button" disabled={running} onClick={handleRun}>
          {running ? 'Running…' : 'Run Query'}
        </button>

        {result && (
          <div className="query-results">
            <p className="muted">{result.row_count} row{result.row_count === 1 ? '' : 's'} returned</p>
            {result.columns.length > 0 && (
              <div className="results-table-wrap">
                <table className="results-table">
                  <thead>
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((val, j) => (
                          <td key={j}>{val === null || val === undefined ? '—' : String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button type="button" className="primary-button" onClick={onRestart}>
          Start Over
        </button>
      </div>
    </div>
  )
}
