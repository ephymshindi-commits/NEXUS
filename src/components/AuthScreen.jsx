import { useState } from 'react'
import { sb, SUPPORT } from "../lib/supabase"

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const submit = async () => {
    if (!email || !pass) { setErr('Please fill in all fields'); return }
    setLoading(true); setErr('')

    if (mode === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass })
      if (error) { setErr(error.message); setLoading(false); return }
      onAuth(data.user)
    } else {
      if (pass.length < 6) { setErr('Password needs at least 6 characters'); setLoading(false); return }
      const { data, error } = await sb.auth.signUp({
        email, password: pass,
        options: { data: { display_name: name || email.split('@')[0] } },
      })
      if (error) { setErr(error.message); setLoading(false); return }
      if (data.user) onAuth(data.user)
      else setErr('✅ Check your email to verify your account!')
    }
    setLoading(false)
  }

  const switchMode = (m) => { setMode(m); setErr('') }

  return (
    <div className="auth-overlay">
      <div className="auth-box fade-up">
        {/* Logo */}
        <div className="modal-logo">
          <div className="lm">N</div>
          <span>NEXUS</span>
        </div>

        {/* Trial badge */}
        <div className="trial-badge">
          <span>👑</span>
          <p><strong>2 months FREE</strong> — Full premium access, no card needed. Then just <strong>$1/month</strong> basic or <strong>$9/month</strong> premium.</p>
        </div>

        {err && <div className="err-msg">{err}</div>}

        <h2 style={{ fontSize: '1.32rem', fontWeight: 700, letterSpacing: '-.02em', marginBottom: '.3rem' }}>
          {mode === 'login' ? 'Welcome back' : 'Join Nexus'}
        </h2>
        <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1.3rem', lineHeight: 1.6 }}>
          {mode === 'login' ? 'Sign in to continue your conversations.' : 'Create your account and start your free trial instantly.'}
        </p>

        {mode === 'register' && (
          <div className="form-group">
            <label>Display Name</label>
            <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>

        <button className="btn-auth" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" /> : (mode === 'login' ? 'Sign In →' : 'Start Free Trial →')}
        </button>

        <div className="auth-switch">
          {mode === 'login'
            ? <>No account? <a onClick={() => switchMode('register')}>Create one free</a></>
            : <>Have an account? <a onClick={() => switchMode('login')}>Sign in</a></>}
        </div>

        {/* Support footer */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ fontSize: '.62rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            Need help? Call <strong style={{ color: 'var(--green)' }}>{SUPPORT.helpline}</strong> or email{' '}
            <strong style={{ color: 'var(--accent)' }}>{SUPPORT.email}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
