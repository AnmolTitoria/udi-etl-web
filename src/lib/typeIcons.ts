export interface TypeMeta {
  icon: string
  color: string
}

const TYPE_META: Record<string, TypeMeta> = {
  postgresql: { icon: '🐘', color: '#336791' },
  mongodb: { icon: '🍃', color: '#12924f' },
  sql: { icon: '🗄️', color: '#d97706' },
  file_upload: { icon: '📁', color: '#7c3aed' },
  athena: { icon: '🏛️', color: '#0f766e' },
  s3: { icon: '🪣', color: '#d97706' },
}

const DEFAULT_META: TypeMeta = { icon: '🔌', color: '#71717a' }

export function getTypeMeta(type: string): TypeMeta {
  return TYPE_META[type] ?? DEFAULT_META
}
