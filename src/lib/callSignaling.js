import { sb } from './supabase'

export const sendSignal = async (payload) => {
  return await sb.from('call_signals').insert(payload)
}

export const subscribeToCalls = (conversationId, callback) => {
  return sb
    .channel('call_channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'call_signals',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      callback(payload.new)
    })
    .subscribe()
}