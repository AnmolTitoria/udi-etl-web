import { useEffect, useState } from 'react'
import { ApiError, createConnection, getSourceSchema, getSources, listConnections, testConnection } from '../api/client'
import type { ConnectionCreate, ConnectionResponse, SourceType } from '../api/types'
import { SOURCE_FIELDS, defaultsFor, resolveJsonFields, schemaFieldsToFieldSpecs, type FieldSpec } from '../lib/fieldSpecs'
import DynamicForm from '../components/DynamicForm'

interface ConnectorStepProps {
  onComplete: (connection: ConnectionResponse, tables?: string[], sourceConfig?: Record<string, unknown>) => void
}

const HIDDEN_CONFIG_KEYS = new Set(['password', 'secret_key', 'session_token'])

function formatDate(raw: string | null): string {
  if (!raw) return 'N/A'
  try {
    const d = new Date(raw)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return raw
  }
}

function displayValue(key: string, val: unknown): string {
  if (HIDDEN_CONFIG_KEYS.has(key)) return '****'
  if (val === null || val === undefined) return '—'
  return String(val)
}

export default function ConnectorStep({ onComplete }: ConnectorStepProps) {
  const [sources, setSources] = useState<string[]>([])
  const [existing, setExisting] = useState<ConnectionResponse[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Field specs fetched from GET /sources/{type}/schema for any source type
  // that isn't one of the curated SOURCE_FIELDS entries below — this is
  // what makes a custom/plugin connector selectable and configurable
  // without a frontend code change.
  const [customFields, setCustomFields] = useState<Record<string, FieldSpec[]>>({})
  const [schemaLoading, setSchemaLoading] = useState(false)

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function ensureFieldsFor(type: string) {
    if (SOURCE_FIELDS[type] || customFields[type]) return
    setSchemaLoading(true)
    try {
      const schema = await getSourceSchema(type)
      setCustomFields((prev) => ({ ...prev, [type]: schemaFieldsToFieldSpecs(schema.fields) }))
    } catch {
      // Leave it as an empty field list rather than blocking selection —
      // the connector is still usable via Test/Create with no extra config
      // if it happens to need none.
      setCustomFields((prev) => ({ ...prev, [type]: [] }))
    } finally {
      setSchemaLoading(false)
    }
  }

  useEffect(() => {
    getSources()
      .then(async (sourcesRes) => {
        setSources(sourcesRes.sources)
        if (sourcesRes.sources.length > 0) {
          const first = sourcesRes.sources[0]
          setSourceType(first)
          if (SOURCE_FIELDS[first]) {
            setValues(defaultsFor(SOURCE_FIELDS[first]))
          } else {
            await ensureFieldsFor(first)
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))

    // Saved connections are a convenience; don't block the form if this fails
    // (e.g. the metadata database isn't reachable yet).
    listConnections()
      .then((res) => setExisting(res.connections))
      .catch(() => setExisting([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once a dynamically-fetched schema lands for the currently selected
  // type, seed its default values (curated types already get this in
  // handleSourceTypeChange/the initial load, synchronously).
  useEffect(() => {
    if (!SOURCE_FIELDS[sourceType] && customFields[sourceType]) {
      setValues(defaultsFor(customFields[sourceType]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, customFields[sourceType]])

  function handleSourceTypeChange(next: string) {
    setSourceType(next)
    setError(null)
    if (SOURCE_FIELDS[next]) {
      setValues(defaultsFor(SOURCE_FIELDS[next]))
    } else if (customFields[next]) {
      setValues(defaultsFor(customFields[next]))
    } else {
      setValues({})
      void ensureFieldsFor(next)
    }
  }

  function buildPayload(): { payload: ConnectionCreate | null; error: string | null } {
    const { values: resolved, error: jsonError } = resolveJsonFields(fields, values)
    if (jsonError) return { payload: null, error: jsonError }
    return {
      payload: {
        name: name || `${sourceType}-connection`,
        source_type: sourceType as SourceType,
        description: description || undefined,
        // Sent uniformly through extra_config rather than spread at the top
        // level — the backend resolves it against whichever fields the
        // connector's Config class actually declares, so this works the
        // same for a built-in connector's named fields and a custom
        // connector's arbitrary ones without this form needing to know the
        // difference.
        extra_config: resolved,
      },
      error: null,
    }
  }

  async function handleTest(e: React.MouseEvent) {
    e.preventDefault()
    setError(null)

    if (sourceType === 'file_upload' && !values.input_dir) {
      setError('Input Directory is required for file upload')
      return
    }

    const { payload, error: buildError } = buildPayload()
    if (buildError || !payload) {
      setError(buildError)
      return
    }

    setTesting(true)
    try {
      const res = await testConnection(payload)
      setError(null)
      alert(res.message || 'Connection test successful!')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  async function handleCreate(e: React.MouseEvent) {
    e.preventDefault()
    setError(null)

    if (sourceType === 'file_upload' && !values.input_dir) {
      setError('Input Directory is required for file upload')
      return
    }

    const { payload, error: buildError } = buildPayload()
    if (buildError || !payload) {
      setError(buildError)
      return
    }

    setCreating(true)
    try {
      const connection = await createConnection(payload)
      const sourceConfig =
        sourceType === 'file_upload'
          ? ({
              input_dir: values.input_dir,
              files: values.files,
              include_content: values.include_content,
            } as Record<string, unknown>)
          : values
      const tables = sourceType === 'file_upload' ? ['my-uploads'] : undefined
      onComplete(connection, tables, sourceConfig)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const fields = SOURCE_FIELDS[sourceType] ?? customFields[sourceType] ?? []
  const isCustomType = !SOURCE_FIELDS[sourceType]

  if (loading) return <p>Loading connector types...</p>

  return (
    <div className="step">
      <h2>Connect to a data source</h2>
      <p className="step-subtitle">Choose a source type and enter its connection details, or reuse a saved connection.</p>

      <div className="connector-layout">
        <form className="card connector-form">
          <div className="form-field">
            <label htmlFor="conn-name">Connection Name</label>
            <input
              id="conn-name"
              type="text"
              value={name}
              placeholder={`${sourceType}-connection`}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="conn-description">Description</label>
            <textarea
              id="conn-description"
              value={description}
              placeholder="Optional description for this connection"
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-field">
            <label htmlFor="source-type">Source Type</label>
            <select id="source-type" value={sourceType} onChange={(e) => handleSourceTypeChange(e.target.value)}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {isCustomType && (
              <p className="field-help">
                Custom connector — fields below are read from its own config schema.
              </p>
            )}
          </div>

          {isCustomType && schemaLoading ? (
            <p className="muted">Loading field list for "{sourceType}"…</p>
          ) : (
            <DynamicForm fields={fields} values={values} onChange={(n, v) => setValues((prev) => ({ ...prev, [n]: v }))} disabled={testing || creating} />
          )}

          {error && <p className="error-message">{error}</p>}

          <div className="button-group">
            <button type="button" className="secondary-button" disabled={testing || creating} onClick={handleTest}>
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button type="button" className="primary-button" disabled={testing || creating} onClick={handleCreate}>
              {creating ? 'Creating…' : 'Create Connection'}
            </button>
          </div>
        </form>

        {existing.length > 0 && (
          <div className="connector-sidebar">
            <h3>Saved connections</h3>
            <div className="saved-list">
              {existing.map((c) => {
                const isOpen = expandedId === c.id
                const entries = Object.entries(c.config ?? {}).filter(([k]) => !HIDDEN_CONFIG_KEYS.has(k))
                return (
                  <div key={c.id} className={`saved-item${isOpen ? ' saved-item--open' : ''}`}>
                    <button type="button" className="saved-item__header" onClick={() => toggleExpand(c.id)}>
                      <span className="saved-item__name">{c.name}</span>
                      <span className="tag">{c.source_type}</span>
                      <span className="saved-item__arrow">{isOpen ? '▼' : '▶'}</span>
                    </button>

                    {c.description && <div className="saved-item__desc">{c.description}</div>}
                    <div className="saved-item__body">
                      <div className="saved-item__date">{formatDate(c.created_at)}</div>

                      {entries.length > 0 && (
                        <div className="saved-item__details">
                          {entries.map(([key, val]) => (
                            <div key={key} className="saved-item__row">
                              <span className="saved-item__key">{key.replace(/_/g, ' ')}</span>
                              <span className="saved-item__val">{displayValue(key, val)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button type="button" className="saved-item__use" onClick={() => onComplete(c)}>
                        Use
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
