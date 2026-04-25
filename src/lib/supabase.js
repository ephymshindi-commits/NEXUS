import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env vars. Check your .env file.')
}

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

export const SUPPORT = {
  phone: '0114419282',
  helpline: '0797317925',
  email: 'ephy3605@gmail.com',
}
