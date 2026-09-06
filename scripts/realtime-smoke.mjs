import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')

const sender = createClient(url, key, { auth: { persistSession: false } })
const receiver = createClient(url, key, { auth: { persistSession: false } })
const topic = `nn-classroom:smoke-${Date.now()}`
const sendChannel = sender.channel(topic)
const receiveChannel = receiver.channel(topic)

let resolveMessage
const received = new Promise((resolve) => { resolveMessage = resolve })
receiveChannel.on('broadcast', { event: 'ping' }, ({ payload }) => resolveMessage(payload))

const subscribe = (channel) => new Promise((resolve, reject) => {
  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') resolve()
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error || new Error(status))
  })
})

await Promise.all([subscribe(sendChannel), subscribe(receiveChannel)])
await sendChannel.send({ type: 'broadcast', event: 'ping', payload: { ok: true } })
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout no Broadcast.')), 8000))
const payload = await Promise.race([received, timeout])
if (!payload?.ok) throw new Error('Payload inválido.')

await Promise.all([sender.removeChannel(sendChannel), receiver.removeChannel(receiveChannel)])
console.log('Supabase Realtime: OK')
