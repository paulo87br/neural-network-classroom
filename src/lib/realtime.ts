import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

export type ConnectionState = 'connecting' | 'connected' | 'local' | 'error'
export type ClassroomEvent = 'frame' | 'process' | 'clear' | 'replay' | 'lock'
export type EventHandler = (payload: Record<string, unknown>) => void

function getClient() {
  return getSupabaseClient()
}

export function sanitizeRoom(value: string | null | undefined) {
  const room = (value || 'AULA-IA').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
  return room || 'AULA-IA'
}

export class ClassroomBus {
  private channel: RealtimeChannel | null = null
  private local: BroadcastChannel | null = null
  private handlers = new Map<ClassroomEvent, Set<EventHandler>>()
  private state: ConnectionState = 'connecting'

  constructor(private readonly room: string, private readonly role: string) {}

  connect(onState?: (state: ConnectionState) => void) {
    const supabase = getClient()
    if (!supabase) {
      this.state = 'local'
      this.local = new BroadcastChannel(`nn-classroom:${this.room}`)
      this.local.onmessage = (message) => this.dispatch(message.data.event, message.data.payload)
      onState?.('local')
      return
    }

    this.channel = supabase.channel(`nn-classroom:${this.room}`, {
      config: { broadcast: { ack: true, self: false }, presence: { key: this.role } },
    })
    this.channel.on('broadcast', { event: '*' }, ({ event, payload }) => this.dispatch(event as ClassroomEvent, payload))
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.state = 'connected'
        onState?.('connected')
        void this.channel?.track({ role: this.role, joinedAt: Date.now() })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.state = 'error'
        onState?.('error')
      }
    })
  }

  on(event: ClassroomEvent, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  async send(event: ClassroomEvent, payload: Record<string, unknown> = {}) {
    const envelope = { ...payload, sender: this.role, sentAt: Date.now() }
    if (this.state === 'connected' && this.channel) {
      return this.channel.send({ type: 'broadcast', event, payload: envelope })
    }
    this.local?.postMessage({ event, payload: envelope })
    return 'ok'
  }

  disconnect() {
    if (this.channel) void getClient()?.removeChannel(this.channel)
    this.local?.close()
    this.handlers.clear()
  }

  private dispatch(event: ClassroomEvent, payload: Record<string, unknown>) {
    this.handlers.get(event)?.forEach((handler) => handler(payload))
  }
}
