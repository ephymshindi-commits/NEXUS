import { useState, useEffect } from 'react'
import { Av, Icons } from '../components/Av'
import { clr, ini, DEMO_MATCHES, DEMO_NOTIFS } from '../lib/helpers'
import { SUPPORT, sb } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

/* ── SOCIAL FEED (real Supabase posts) ── */
export function SocialFeed({ currentUser, currentProfile }) {
  const toast = useToast()
  const [liked,   setLiked]   = useState({})
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)

  const loadPosts = async () => {
    setLoading(true)
    const { data, error } = await sb
      .from('posts')
      .select('*, profiles(display_name, username, id)')
      .order('created_at', { ascending: false })
      .limit(30)
    if (!error && data) setPosts(data)
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  useEffect(() => {
    const sub = sb.channel('posts_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadPosts())
      .subscribe()
    return () => sb.removeChannel(sub)
  }, [])

  const submitPost = async () => {
    if (!newPost.trim()) { toast('✏️', 'Write something first!'); return }
    setPosting(true)
    const { error } = await sb.from('posts').insert({
      user_id: currentUser?.id,
      content: newPost.trim(),
    })
    if (error) toast('❌', 'Could not post: ' + error.message)
    else { setNewPost(''); toast('✅', 'Post shared!') }
    setPosting(false)
  }

  const toggleLike = async (postId, currentLikes) => {
    const isLiked = liked[postId]
    setLiked(l => ({ ...l, [postId]: !isLiked }))
    await sb.from('posts')
      .update({ likes: isLiked ? currentLikes - 1 : currentLikes + 1 })
      .eq('id', postId)
  }

  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    return new Date(ts).toLocaleDateString()
  }

  const myName = currentProfile?.display_name || currentProfile?.username || 'Me'

  return (
    <div className="feed">
      {/* Compose box */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: '.9rem', marginBottom: '1rem', display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
        <Av name={myName} id={currentUser?.id} size={34} />
        <div style={{ flex: 1 }}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 9, padding: '.55rem .8rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.78rem', resize: 'none', outline: 'none', minHeight: 58, lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.4rem' }}>
            <button
              onClick={submitPost}
              disabled={posting}
              style={{ padding: '.4rem .85rem', background: 'var(--accentg)', color: '#fff', border: 'none', fontFamily: 'var(--font)', fontSize: '.7rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', opacity: posting ? .6 : 1 }}
            >
              {posting ? '...' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Posts list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.78rem' }}>
          <span className="spinner" /> &nbsp;Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="ei">📝</div>
          <p>No posts yet.<br />Be the first to share something!</p>
        </div>
      ) : posts.map((p) => {
        const author   = p.profiles?.display_name || p.profiles?.username || 'User'
        const authorId = p.profiles?.id || p.user_id
        return (
          <div key={p.id} className="feed-post fade-up">
            <div className="post-header">
              <Av name={author} id={authorId} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.8rem', fontWeight: 700 }}>{author}</div>
                <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{timeAgo(p.created_at)}</div>
              </div>
              <button className="icon-btn">{Icons.dots}</button>
            </div>
            <div className="post-body">{p.content}</div>
            <div className="post-actions">
              <button
                className={`post-action${liked[p.id] ? ' liked' : ''}`}
                onClick={() => toggleLike(p.id, p.likes || 0)}
              >
                ❤️ {liked[p.id] ? (p.likes || 0) + 1 : p.likes || 0}
              </button>
              <button className="post-action" onClick={() => toast('💬', 'Comments coming soon!')}>
                💬 {p.comments_count || 0}
              </button>
              <button
                className="post-action"
                onClick={() => { navigator.clipboard?.writeText(window.location.href); toast('🔗', 'Link copied!') }}
              >
                🔗 Share
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── DATING SCREEN ── */
export function DatingScreen({ onUpgrade }) {
  const toast = useToast()
  return (
    <div className="dating-screen">
      <div style={{ background: 'linear-gradient(135deg,rgba(247,91,138,.12),rgba(124,79,247,.12))', border: '1px solid rgba(247,91,138,.22)', borderRadius: 13, padding: '1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
        <div style={{ fontSize: '1.8rem', animation: 'heartbeat 1.5s ease-in-out infinite' }}>💝</div>
        <div>
          <div style={{ fontSize: '.85rem', fontWeight: 700, marginBottom: '.2rem' }}>Nexus Hearts</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted2)', lineHeight: 1.6 }}>
            Discover people who match your vibe. Unlock profiles with a Premium subscription.
          </div>
        </div>
      </div>

      <div className="stripe-pending" style={{ marginBottom: '1rem' }}>
        <div className="stripe-dot" />
        <p>Stripe payments coming soon — unlock features will activate once payment is live!</p>
      </div>

      <div className="match-grid">
        {DEMO_MATCHES.map((m) => (
          <div
            key={m.id}
            className={`match-card${m.locked ? ' locked' : ''}`}
            onClick={() => !m.locked && toast('💝', "It's a match! Start chatting 🎉")}
          >
            {m.locked && (
              <div className="lock-layer" onClick={onUpgrade}>
                <span>🔒</span>
                <p>Upgrade to unlock</p>
              </div>
            )}
            <div className="match-av" style={{ background: clr(m.id), filter: m.locked ? 'blur(3px)' : 'none' }}>
              {m.emoji}
            </div>
            <div className="match-pct">{m.pct}</div>
            <div className="match-name"  style={{ filter: m.locked ? 'blur(4px)' : 'none' }}>{m.name}</div>
            <div className="match-detail" style={{ filter: m.locked ? 'blur(4px)' : 'none' }}>{m.detail}</div>
            <div className="match-tags"  style={{ filter: m.locked ? 'blur(4px)' : 'none' }}>
              {m.tags.map((t) => <span key={t} className="mtag">{t}</span>)}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn-dating"
        style={{ width: '100%', padding: '.7rem', borderRadius: 10, fontSize: '.8rem' }}
        onClick={onUpgrade}
      >
        💝 Unlock All Matches — Go Premium
      </button>
    </div>
  )
}

/* ── NOTIFICATIONS ── */
export function NotificationsPanel() {
  const [notifs, setNotifs] = useState(DEMO_NOTIFS)
  const markAll = () => setNotifs((n) => n.map((x) => ({ ...x, unread: false })))
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '.88rem', fontWeight: 700 }}>Notifications</h2>
        <button
          onClick={markAll}
          style={{ fontSize: '.65rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          Mark all read
        </button>
      </div>
      {notifs.map((n) => (
        <div key={n.id} className={`notif-item${n.unread ? ' unread' : ''}`}>
          <div className="notif-icon" style={{ background: n.bg }}>{n.icon}</div>
          <div style={{ flex: 1 }}>
            <div className="notif-title">{n.title}</div>
            <div className="notif-desc">{n.desc}</div>
            <div className="notif-time">{n.time}</div>
          </div>
          {n.unread && (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── SETTINGS ── */
export function SettingsPanel({ user, profile, onSignOut }) {
  const toast = useToast()
  const [toggles, setToggles] = useState({
    notifs: true, sounds: true, typing: true, online: true, darkMode: true, dating: false,
  })
  const tog = (k) => setToggles((t) => ({ ...t, [k]: !t[k] }))
const myName = profile?.display_name || profile?.username || 'User'
const [showEditProfile, setShowEditProfile] = useState(false)
const [showPrivacy,     setShowPrivacy]     = useState(false)
const [showChangePass,  setShowChangePass]  = useState(false)
const [newName,         setNewName]         = useState(profile?.display_name || '')
const [newPass,         setNewPass]         = useState('')
const [saving,          setSaving]          = useState(false)

const saveProfile = async () => {
  setSaving(true)
  const { error } = await sb.from('profiles').update({ display_name: newName }).eq('id', user?.id)
  if (error) toast('❌', 'Could not save: ' + error.message)
  else { toast('✅', 'Profile updated!'); setShowEditProfile(false) }
  setSaving(false)
}

const changePassword = async () => {
  if (newPass.length < 6) { toast('❌', 'Password needs at least 6 characters'); return }
  setSaving(true)
  const { error } = await sb.auth.updateUser({ password: newPass })
  if (error) toast('❌', error.message)
  else { toast('✅', 'Password changed!'); setShowChangePass(false); setNewPass('') }
  setSaving(false)
}

  const sections = [
    { title: 'Account', items: [
      { icon: '👤', label: 'Edit Profile',    desc: myName,                       action: () => setShowEditProfile(true) },
      { icon: '🔒', label: 'Privacy',         desc: 'Manage who can contact you', action: () => setShowPrivacy(true) },
      { icon: '🔑', label: 'Change Password', desc: 'Update your password',        action: () => setShowChangePass(true) },
    ]},
    { title: 'Notifications', items: [
      { icon: '🔔', label: 'Push Notifications', desc: 'Message and activity alerts',  toggle: 'notifs' },
      { icon: '🔊', label: 'Message Sounds',     desc: 'Play sounds for new messages', toggle: 'sounds' },
      { icon: '✍️', label: 'Typing Indicators',  desc: "Show when you're typing",      toggle: 'typing' },
    ]},
    { title: 'Privacy', items: [
      { icon: '🟢', label: 'Online Status', desc: "Show when you're online", toggle: 'online' },
      { icon: '💝', label: 'Dating Mode',   desc: 'Appear in Nexus Hearts',  toggle: 'dating' },
    ]},
    { title: 'Appearance', items: [
      { icon: '🌙', label: 'Dark Mode',    desc: 'Use dark theme',        toggle: 'darkMode' },
      { icon: '🎨', label: 'Theme Color', desc: 'Customize accent color', action: () => toast('🎨', 'Theme customization — coming soon!') },
    ]},
  ]

  return (
    <div className="settings-panel">

      {/* Profile card */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', marginBottom: '1.3rem', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
        <Av name={myName} id={user?.id} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.88rem', fontWeight: 700 }}>{myName}</div>
          <div style={{ fontSize: '.68rem', color: 'var(--muted2)', marginTop: '.15rem' }}>{user?.email}</div>
          <div style={{ fontSize: '.6rem', color: 'var(--green)', marginTop: '.2rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Premium Trial · 58 days left
          </div>
        </div>
      </div>

      {/* Settings sections */}
      {sections.map((sec) => (
        <div key={sec.title} className="settings-section">
          <h3>{sec.title}</h3>
          {sec.items.map((item) => (
            <div
              key={item.label}
              className="settings-item"
              style={{ cursor: item.action ? 'pointer' : 'default' }}
              onClick={item.action}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--panel)' }}>{item.icon}</div>
                <div>
                  <div className="si-title">{item.label}</div>
                  <div className="si-desc">{item.desc}</div>
                </div>
              </div>
              {item.toggle
                ? <button className={`toggle${toggles[item.toggle] ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); tog(item.toggle) }} />
                : <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>›</span>
              }
            </div>
          ))}
        </div>
      ))}

      {/* Support */}
      <div className="settings-section">
        <h3>Support & Help</h3>
        <div className="help-card">
          <h3>🛟 Contact Support</h3>
          <a className="help-item" href={`tel:${SUPPORT.phone}`}>
            <div className="help-icon" style={{ background: 'rgba(45,214,138,.12)' }}>📞</div>
            <div><div className="help-label">General Support</div><div className="help-val">{SUPPORT.phone}</div></div>
          </a>
          <a className="help-item" href={`tel:${SUPPORT.helpline}`}>
            <div className="help-icon" style={{ background: 'rgba(79,110,247,.12)' }}>🆘</div>
            <div><div className="help-label">Help Line</div><div className="help-val">{SUPPORT.helpline}</div></div>
          </a>
          <a className="help-item" href={`mailto:${SUPPORT.email}`}>
            <div className="help-icon" style={{ background: 'rgba(240,192,96,.12)' }}>✉️</div>
            <div><div className="help-label">Email Support</div><div className="help-val">{SUPPORT.email}</div></div>
          </a>
          <div style={{ marginTop: '.5rem', padding: '.55rem .65rem', background: 'rgba(255,255,255,.02)', borderRadius: 7, fontSize: '.64rem', color: 'var(--muted2)', lineHeight: 1.6 }}>
            Available Mon–Sat, 8am–8pm EAT. We typically respond within 2 hours.
          </div>
        </div>
      </div>

      {/* About + sign out */}
      <div className="settings-section">
        <h3>About</h3>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '.85rem', fontSize: '.72rem', color: 'var(--muted2)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '.3rem' }}>NEXUS v4.0</div>
          <div>One platform for every connection — messaging, voice, video, stories, dating and more.</div>
          <div style={{ marginTop: '.5rem', color: 'var(--muted)' }}>© 2025 Nexus. All rights reserved.</div>
        </div>
        <button
          onClick={onSignOut}
          style={{ width: '100%', marginTop: '.75rem', padding: '.65rem', background: 'rgba(247,91,138,.1)', border: '1px solid rgba(247,91,138,.22)', color: 'var(--rose)', fontFamily: 'var(--font)', fontSize: '.78rem', fontWeight: 600, borderRadius: 9, cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>

{/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 360 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.3rem' }}>Edit Profile</h3>
            <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1.2rem' }}>Update your display name.</p>
            <div className="form-group">
              <label>Display Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '.68rem .88rem', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.8rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
              <button onClick={() => setShowEditProfile(false)} style={{ flex: 1, padding: '.65rem', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted2)', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveProfile} disabled={saving} style={{ flex: 2, padding: '.65rem', background: 'var(--accentg)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 360 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.3rem' }}>Privacy Settings</h3>
            <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1.2rem' }}>Control who can see and contact you.</p>
            {[
              { label: 'Show online status',    desc: 'Let others see when you\'re active' },
              { label: 'Allow DMs from anyone', desc: 'Anyone can start a conversation with you' },
              { label: 'Show in search results',desc: 'Appear when people search by username' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem .9rem', background: 'var(--card)', borderRadius: 10, marginBottom: '.4rem', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '.78rem', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '.64rem', color: 'var(--muted2)', marginTop: '.1rem' }}>{item.desc}</div>
                </div>
                <button className="toggle on" />
              </div>
            ))}
            <button onClick={() => setShowPrivacy(false)} style={{ width: '100%', marginTop: '1rem', padding: '.65rem', background: 'var(--accentg)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.78rem', fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePass && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 360 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.3rem' }}>Change Password</h3>
            <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1.2rem' }}>Choose a new secure password.</p>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min. 6 characters" style={{ width: '100%', padding: '.68rem .88rem', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.8rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
              <button onClick={() => setShowChangePass(false)} style={{ flex: 1, padding: '.65rem', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted2)', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button onClick={changePassword} disabled={saving} style={{ flex: 2, padding: '.65rem', background: 'var(--accentg)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}