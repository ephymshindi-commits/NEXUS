import { useState } from 'react'
import { sb } from "../lib/supabase"
import { useToast } from "../hooks/useToast"

const PLANS = [
  {
    id: 'basic', name: 'Basic', price: '$1', per: '/month', badge: null,
    feats: [
      { y: true,  t: 'Direct messages' },
      { y: true,  t: 'Up to 5 group chats' },
      { y: false, t: 'Voice & video calls' },
      { y: false, t: 'File sharing' },
      { y: false, t: 'Dating / Nexus Hearts' },
      { y: false, t: 'Stories & social feed' },
    ],
  },
  {
    id: 'premium', name: 'Premium ✦', price: '$9', per: '/month', badge: 'MOST POPULAR',
    feats: [
      { y: true, t: 'Everything in Basic' },
      { y: true, t: 'Unlimited group chats' },
      { y: true, t: 'Voice & video calls' },
      { y: true, t: 'File sharing (2 GB)' },
      { y: true, t: 'Dating / Nexus Hearts' },
      { y: true, t: 'Stories & social feed' },
    ],
  },
]

export function PlansModal({ onClose, onSelect }) {
  const [sel, setSel] = useState('premium')

  return (
    <div className="overlay">
      <div className="modal-box">
        <div className="modal-logo"><div className="lm">N</div><span>NEXUS</span></div>
        <h2 className="modal-title">Choose your plan</h2>
        <p className="modal-sub">Keep everything running after your 60-day trial. Cancel anytime.</p>

        <div className="stripe-pending">
          <div className="stripe-dot" />
          <p><strong>Payment system coming soon</strong> — Stripe integration activates shortly. Choose your plan and we'll notify you when it's ready.</p>
        </div>

        <div className="plans">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`plan${sel === p.id ? ' sel' : ''}${p.badge ? ' featured' : ''}`}
              onClick={() => setSel(p.id)}
            >
              {p.badge && <div className="plan-badge">{p.badge}</div>}
              <div className="plan-name">
                {p.name}
                {sel === p.id && (
                  <span style={{ fontSize: '.6rem', background: 'rgba(79,110,247,.15)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                    SELECTED
                  </span>
                )}
              </div>
              <div className="plan-price">
                <span className="amt">{p.price}</span>
                <span className="per">{p.per}</span>
              </div>
              <div className="plan-feats">
                {p.feats.map((f, i) => (
                  <div key={i} className={`plan-feat${f.y ? ' y' : ' n'}`}>{f.t}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-auth" onClick={() => onSelect(sel)}>
          {sel === 'basic' ? 'Continue with Basic — $1/mo' : 'Continue with Premium — $9/mo'}
        </button>
        <div className="auth-switch"><a onClick={onClose}>Maybe later</a></div>
      </div>
    </div>
  )
}

export function NewConvModal({ onClose, onCreated, uid }) {
  const toast = useToast()
  const [mode, setMode]       = useState('dm')
  const [target, setTarget]   = useState('')
  const [gname, setGname]     = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    setLoading(true)
    if (mode === 'group') {
      const { data: conv, error } = await sb
        .from('conversations')
        .insert({ name: gname || 'New Group', is_group: true, last_message: '', last_message_at: new Date().toISOString() })
        .select().single()
      if (error) { toast('❌', error.message); setLoading(false); return }
      await sb.from('conversation_members').insert({ conversation_id: conv.id, user_id: uid, role: 'admin' })
      onCreated(conv)
    } else {
      const { data: profiles } = await sb.from('profiles').select('*').ilike('username', target.trim()).limit(1)
      if (!profiles?.length) { toast('❌', 'User not found — check the username'); setLoading(false); return }
      const other = profiles[0]
      if (other.id === uid) { toast('❌', "That's you! Try someone else 😄"); setLoading(false); return }
      const { data: conv, error } = await sb
        .from('conversations')
        .insert({ name: other.display_name || other.username, is_group: false, last_message: '', last_message_at: new Date().toISOString() })
        .select().single()
      if (error) { toast('❌', error.message); setLoading(false); return }
      await sb.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: uid,      role: 'member' },
        { conversation_id: conv.id, user_id: other.id, role: 'member' },
      ])
      onCreated(conv)
    }
    setLoading(false)
  }

  const btnStyle = (active) => ({
    flex: 1, padding: '.52rem', borderRadius: 7, border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border2)',
    background: active ? 'rgba(79,110,247,.12)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--muted2)',
    fontFamily: 'var(--font)', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer',
  })

  const inputStyle = {
    width: '100%', padding: '.65rem .85rem', background: 'var(--bg)',
    border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: '.78rem', outline: 'none',
  }

  return (
    <div className="overlay">
      <div className="modal-box" style={{ width: 360 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.3rem' }}>New Conversation</h3>
        <p style={{ fontSize: '.76rem', color: 'var(--muted2)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Start a DM or create a group chat.
        </p>
        <div style={{ display: 'flex', gap: '.45rem', marginBottom: '1rem' }}>
          <button style={btnStyle(mode === 'dm')}    onClick={() => setMode('dm')}>💬 Direct</button>
          <button style={btnStyle(mode === 'group')} onClick={() => setMode('group')}>👥 Group</button>
        </div>

        {mode === 'group' ? (
          <div className="form-group">
            <label>Group Name</label>
            <input style={inputStyle} placeholder="e.g. Design Team 🎨" value={gname} onChange={(e) => setGname(e.target.value)} />
          </div>
        ) : (
          <div className="form-group">
            <label>Username</label>
            <input style={inputStyle} placeholder="Enter their username" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.9rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '.62rem', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted2)', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={create} disabled={loading} style={{ flex: 2, padding: '.62rem', background: 'var(--accentg)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: loading ? .55 : 1 }}>
            {loading ? <span className="spinner" /> : (mode === 'group' ? 'Create Group' : 'Start Chat')}
          </button>
        </div>
      </div>
    </div>
  )
}
