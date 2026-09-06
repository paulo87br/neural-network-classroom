import type { ConnectionState } from '../lib/realtime'

const labels: Record<ConnectionState, string> = {
  connecting: 'Conectando',
  connected: 'Ao vivo',
  local: 'Modo local',
  error: 'Sem conexão',
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <span className={`connection-badge connection-${state}`} role="status">
      <span className="connection-dot" />
      {labels[state]}
    </span>
  )
}
