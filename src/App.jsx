import { useState, useEffect, useRef, useCallback } from 'react'
import { sb } from './lib/supabase'
import { clr, ini, ago, fmtTime } from './lib/helpers'
import { useToast } from './hooks/useToast'
import { Av, Icons }         from './components/Av'
import AuthScreen            from './components/AuthScreen'
import { StoriesBar, StoryViewer } from './components/Stories'
import CallOverlay           from './components/CallOverlay'
import { PlansModal, NewConvModal } from './components/Modals'
import { SocialFeed, DatingScreen, NotificationsPanel, SettingsPanel } from './pages/Views'

export default function App() {
  const toast = useToast()

  /* ── auth state ── */
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)

  /* ── nav state ── */
  const [view,    setView]    = useState('chats') // chats | feed | dating | notifs | settings

  /* ── conversations ── */
  const [convs,      setConvs]      = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [msgs,       setMsgs]       = useState([])
  const [input,      setInput]      = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])

  /* ── call state ── */
  const [call,         setCall]         = useState(null)
  const [localStream,  setLocalStream]  = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  /* ── ui toggles ── */
  const [storyView,   setStoryView]   = useState(null)
  const [showNewConv, setShowNewConv] = useState(false)
  const [showPlans,   setShowPlans]   = useState(false)
  const [tab,         setTab]         = useState('all')
  const [search,      setSearch]      = useState('')

  const msgSub  = useRef(null)
  const msgEnd  = useRef(null)
  const peerConn = useRef(null)

  /* ────────────────────────────────────────────── */
  /* AUTH                                           */
  /* ────────────────────────────────────────────── */
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) handleAuth(session.user)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      if (session) handleAuth(session.user)
      else { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (u) => {
    setUser(u)
    const { data: p } = await sb.from('profiles').select('*').eq('id', u.id).single()
    setProfile(p)
    await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', u.id)
    loadConvs(u.id)
    loadOnline(u.id)
    toast('👋', `Welcome back${p?.display_name ? ', ' + p.display_name : ''}!`)

    // heartbeat every 2 min
    const iv = setInterval(() => sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', u.id), 120_000)
    return () => clearInterval(iv)
  }

  const signOut = async () => {
    await sb.auth.signOut()
    setUser(null); setProfile(null); setConvs([]); setActiveConv(null); setMsgs([])
  }

  /* ────────────────────────────────────────────── */
  /* CONVERSATIONS                                  */
  /* ────────────────────────────────────────────── */
  const loadConvs = async (uid) => {
    const { data: mems } = await sb.from('conversation_members').select('conversation_id').eq('user_id', uid)
    if (!mems?.length) { setConvs([]); return }
    const ids = mems.map((m) => m.conversation_id)
    const { data } = await sb.from('conversations').select('*').in('id', ids).order('last_message_at', { ascending: false })
    setConvs(data || [])
  }

  /* ────────────────────────────────────────────── */
  /* MESSAGES                                       */
  /* ────────────────────────────────────────────── */
  const openConv = useCallback(async (conv) => {
    setActiveConv(conv)
    if (msgSub.current) { await sb.removeChannel(msgSub.current); msgSub.current = null }

    const { data } = await sb
      .from('messages')
      .select('*, profiles(display_name, username)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(60)
    setMsgs(data || [])
    setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 80)

    // realtime subscription
    msgSub.current = sb
      .channel('msgs_' + conv.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          setMsgs((m) => [...m, payload.new])
          setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
      .subscribe()
  }, [])

  const sendMsg = async () => {
    const text = input.trim()
    if (!text || !activeConv || !user) return
    setInput('')
    const { error } = await sb.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: user.id,
      content: text,
      message_type: 'text',
    })
    if (error) { toast('❌', 'Send failed: ' + error.message); return }
    await sb.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', activeConv.id)
    loadConvs(user.id)
  }

  /* ────────────────────────────────────────────── */
  /* ONLINE USERS                                   */
  /* ────────────────────────────────────────────── */
  const loadOnline = async (uid) => {
    const five = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await sb.from('profiles').select('*').gt('last_seen', five).neq('id', uid).limit(6)
    setOnlineUsers(data || [])
    setTimeout(() => loadOnline(uid), 30_000)
  }

  /* ────────────────────────────────────────────── */
  /* WEBRTC CALLS                                   */
  /* ────────────────────────────────────────────── */
  const startCall = async (type) => {
    if (!activeConv) { toast('💬', 'Select a conversation first'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        type === 'video' ? { video: true, audio: true } : { audio: true }
      )
      setLocalStream(stream)
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] })
      peerConn.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      pc.ontrack = (e) => setRemoteStream(e.streams[0])
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      setCall({ type, status: 'connecting', name: activeConv.name, id: activeConv.id })
      toast(type === 'video' ? '🎥' : '📞', `${type === 'video' ? 'Video' : 'Voice'} call started`)
    } catch (err) {
      toast('❌', 'Camera/mic error: ' + err.message)
    }
  }

  const endCall = () => {
    localStream?.getTracks().forEach((t) => t.stop())
    peerConn.current?.close()
    setLocalStream(null); setRemoteStream(null); setCall(null)
    toast('📵', 'Call ended')
  }

  /* ────────────────────────────────────────────── */
  /* FILTERED CONVS                                 */
  /* ────────────────────────────────────────────── */
  const filteredConvs = convs.filter((c) => {
    const ms = !search || c.name?.toLowerCase().includes(search.toLowerCase())
    const mt = tab === 'all' || (tab === 'groups' ? c.is_group : !c.is_group)
    return ms && mt
  })

  const myName = profile?.display_name || profile?.username || 'Me'

  if (!user) return <AuthScreen onAuth={handleAuth} />

  /* ────────────────────────────────────────────── */
  /* RENDER                                         */
  /* ────────────────────────────────────────────── */
  return (
    <div className="shell">

      {/* ── RAIL ── */}
      <nav className="rail">
        <div className="rail-logo" onClick={() => toast('🚀', 'NEXUS — Phase 4 Complete! 🎉')}>N</div>

        <button className={`rail-btn${view === 'chats'    ? ' active' : ''}`} onClick={() => setView('chats')}    title="Messages">{Icons.chat}</button>
        <button className={`rail-btn${view === 'feed'     ? ' active' : ''}`} onClick={() => setView('feed')}     title="Social Feed">{Icons.feed}</button>
        <button className={`rail-btn${view === 'dating'   ? ' active' : ''}`} onClick={() => setView('dating')}   title="💝 Hearts">
          {Icons.heart}<span className="rdot" style={{ background: 'var(--rose)' }} />
        </button>
        <button className={`rail-btn${view === 'notifs'   ? ' active' : ''}`} onClick={() => setView('notifs')}   title="Notifications">
          {Icons.bell}<span className="rdot" style={{ background: 'var(--accent)' }} />
        </button>
        <button className={`rail-btn`}                                         onClick={() => startCall('phone')}  title="Voice Call">{Icons.phone}</button>
        <button className={`rail-btn`}                                         onClick={() => startCall('video')}  title="Video Call">{Icons.video}</button>

        <div className="rail-spacer" />
        <button className={`rail-btn${view === 'settings' ? ' active' : ''}`} onClick={() => setView('settings')} title="Settings">{Icons.cog}</button>
        <div className="rav" style={{ background: clr(user.id) }} title={myName}>{ini(myName)}</div>
      </nav>

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <div className="sb-head">
          <div className="sb-top">
            <span className="sb-title">
              {{ chats: 'Messages', feed: 'Social Feed', dating: '💝 Hearts', notifs: 'Notifications', settings: 'Settings' }[view]}
            </span>
            <button className="icon-btn" onClick={() => setShowNewConv(true)} title="New">{Icons.plus}</button>
          </div>
          <div className="search-row">
            {Icons.search}
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {view === 'chats' && (
          <div className="tabs">
            {['all', 'direct', 'groups'].map((t) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="new-chat-row" onClick={() => setShowNewConv(true)}>{Icons.plus} New Conversation</div>

        <div className="chat-list">
          {filteredConvs.length === 0
            ? <div style={{ padding: '1.3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.73rem', lineHeight: 1.8 }}>
                {search ? 'No results found' : 'No conversations yet.\nStart one above!'}
              </div>
            : filteredConvs.map((c) => (
                <div
                  key={c.id}
                  className={`ci${activeConv?.id === c.id ? ' active' : ''}`}
                  onClick={() => { openConv(c); if (view !== 'chats') setView('chats') }}
                >
                  <Av name={c.name || '?'} id={c.id} size={40} />
                  <div className="ci-meta">
                    <div className="ci-nr">
                      <span className="ci-name">{c.name}</span>
                      <span className="ci-time">{c.last_message_at ? ago(c.last_message_at) : ''}</span>
                    </div>
                    <div className="ci-pr">
                      <span className="ci-prev">{c.last_message || (c.is_group ? 'Group chat' : 'Start chatting')}</span>
                      {c.is_group && <span style={{ fontSize: '.55rem', background: 'rgba(79,110,247,.14)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>GRP</span>}
                    </div>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="main">
        {view === 'feed'     ? <SocialFeed currentUser={user} currentProfile={profile} /> :
         view === 'dating'   ? <DatingScreen onUpgrade={() => setShowPlans(true)} /> :
         view === 'notifs'   ? <NotificationsPanel /> :
         view === 'settings' ? <SettingsPanel user={user} profile={profile} onSignOut={signOut} /> :

         /* CHATS view */
         activeConv ? (
           <>
             <StoriesBar onView={setStoryView} />
             {/* Topbar */}
             <div className="topbar">
               <Av name={activeConv.name} id={activeConv.id} size={34} />
               <div className="tb-info">
                 <div className="tb-name">{activeConv.name}</div>
                 <div className="tb-status on">{activeConv.is_group ? `Group · ${msgs.length} messages` : 'Active'}</div>
               </div>
               <div className="tb-actions">
                 <button className="icon-btn" onClick={() => startCall('voice')} title="Voice call">{Icons.phone}</button>
                 <button className="icon-btn" onClick={() => startCall('video')} title="Video call">{Icons.video}</button>
                 <button className="icon-btn">{Icons.dots}</button>
               </div>
             </div>

             {/* Messages */}
             <div className="msgs">
               {msgs.length === 0 && (
                 <div className="empty-state">
                   <div className="ei">👋</div>
                   <p>Say hello! Start the conversation.</p>
                 </div>
               )}
               <div className="date-div"><span>Today</span></div>
               {msgs.map((m, i) => {
                 const mine = m.sender_id === user.id
                 const sn   = m.profiles?.display_name || m.profiles?.username || 'Unknown'
                 return (
                   <div key={m.id || i} className={`mrow msg-anim${mine ? ' mine' : ''}`}>
                     {!mine && <div className="mav" style={{ background: clr(m.sender_id), width: 24, height: 24, fontSize: '.55rem' }}>{ini(sn)}</div>}
                     <div className="bubble">
                       {!mine && activeConv.is_group && <div className="msender">{sn}</div>}
                       {m.content}
                       <div className="mtime">{fmtTime(m.created_at)}{mine && ' ✓✓'}</div>
                     </div>
                   </div>
                 )
               })}
               <div ref={msgEnd} />
             </div>

             {/* Input */}
             <div className="input-bar">
               <div className="input-wrap">
                 <button className="ib" onClick={() => toast('📎', 'File sharing — coming soon!')}>{Icons.attach}</button>
                 <input
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                   placeholder={`Message ${activeConv.name}…`}
                 />
                 <button className="ib">{Icons.mic}</button>
               </div>
               <button className="send-btn" onClick={sendMsg}>{Icons.send}</button>
             </div>
           </>
         ) : (
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <StoriesBar onView={setStoryView} />
             <div className="empty-state">
               <div className="ei">💬</div>
               <p>Select a conversation to start messaging<br />or create a new one above</p>
             </div>
           </div>
         )
        }
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="rpanel">
        {/* Trial */}
        <div className="rp-sec">
          <div className="rp-lbl">Your Trial</div>
          <div className="trial-card">
            <h3>⏳ Trial Active</h3>
            <p>Full premium access free for 60 days.</p>
            <div className="trial-days"><span className="big">58</span><span className="sm">days<br />remaining</span></div>
            <div className="trial-bar"><div className="trial-fill" style={{ width: '3%' }} /></div>
            <button className="btn-upgrade" onClick={() => setShowPlans(true)}>⭐ View Plans — from $1</button>
          </div>
        </div>

        {/* Dating teaser */}
        <div className="rp-sec">
          <div className="rp-lbl">💝 Nexus Hearts</div>
          <div className="dating-card">
            <h3>💝 Find Your Match</h3>
            <p>3 people near you match your profile. Unlock with Premium.</p>
            <button className="btn-dating" onClick={() => setView('dating')}>See Who Likes You →</button>
          </div>
        </div>

        {/* Online now */}
        <div className="rp-sec">
          <div className="rp-lbl">Active Now</div>
          {onlineUsers.length === 0
            ? <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>No one online right now</div>
            : onlineUsers.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.55rem', cursor: 'pointer' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.56rem', fontWeight: 700, color: '#fff', flexShrink: 0, position: 'relative' }}>
                    {ini(u.display_name || u.username)}
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 7, height: 7, background: 'var(--green)', borderRadius: '50%', border: '1.5px solid var(--surface)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '.74rem', fontWeight: 500 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--green)' }}>online</div>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Support quick links */}
        <div className="rp-sec">
          <div className="rp-lbl">🛟 Support</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {[
              { href: `tel:0114419282`,           icon: '📞', label: 'Support', val: '0114419282' },
              { href: `tel:0797317925`,            icon: '🆘', label: 'Helpline', val: '0797317925' },
              { href: `mailto:ephy3605@gmail.com`, icon: '✉️', label: 'Email',   val: 'ephy3605@gmail.com' },
            ].map((s) => (
              <a key={s.label} href={s.href} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', padding: '.45rem .6rem', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', textDecoration: 'none' }}>
                <span style={{ fontSize: '.82rem' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{s.val}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

                {/* Support quick links */}
        <div className="rp-sec">
          <div className="rp-lbl">🛟 Support</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {[
              { href: `tel:0114419282`, icon: '📞', label: 'Support', val: '0114419282' },
              { href: `tel:0797317925`, icon: '🆘', label: 'Helpline', val: '0797317925' },
              { href: `mailto:ephy3605@gmail.com`, icon: '✉️', label: 'Email', val: 'ephy3605@gmail.com' },
            ].map((s) => (
              <a key={s.label} href={s.href} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', padding: '.45rem .6rem', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', textDecoration: 'none' }}>
                <span style={{ fontSize: '.82rem' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{s.val}</div>
                </div>
              </a>
            ))}
          </div>
        </div> {/* ✅ CLOSE Support */}

        {/* Suggested Users */}
        <div className="rp-sec">
          <div className="rp-lbl">Suggested for You</div>
          {onlineUsers.length === 0 ? (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              Invite friends to join Nexus!<br />
              <a
                href={`mailto:?subject=Join me on NEXUS&body=Hey! Join me on NEXUS — sign up at ${window.location.origin}`}
                style={{ color: 'var(--accent)', fontSize: '.68rem', textDecoration: 'none', fontWeight: 600 }}
              >
                📨 Send invite link
              </a>
            </div>
          ) : onlineUsers.slice(0, 4).map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.58rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {ini(u.display_name || u.username)}
                </div>
                <div>
                  <div style={{ fontSize: '.74rem', fontWeight: 600 }}>{u.display_name || u.username}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--muted2)' }}>New member</div>
                </div>
              </div>
              <button
                onClick={() => toast('💬', `Starting chat with ${u.display_name || u.username}`)}
                style={{ fontSize: '.6rem', padding: '3px 8px', background: 'rgba(79,110,247,.14)', color: 'var(--accent)', border: '1px solid rgba(79,110,247,.25)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}
              >
                Message
              </button>
            </div>
          ))}
        </div> {/* ✅ CLOSE Suggested */}

      </div> {/* ✅ CLOSE rpanel */}

      {/* ── OVERLAYS ── */}

      {call && (
        <CallOverlay
          call={call}
          onEnd={endCall}
          localStream={localStream}
          remoteStream={remoteStream}
        />
      )}

      {storyView && (
        <StoryViewer
          story={storyView}
          onClose={() => setStoryView(null)}
        />
      )}

      {showNewConv && (
        <NewConvModal
          onClose={() => setShowNewConv(false)}
          uid={user.id}
          onCreated={(conv) => {
            setShowNewConv(false);
            loadConvs(user.id);
            openConv(conv);
            setView('chats');
            toast('✅', 'Conversation created!');
          }}
        />
      )}

      {showPlans && (
        <PlansModal
          onClose={() => setShowPlans(false)}
          onSelect={(plan) => {
            setShowPlans(false);
            toast(
              '⭐',
              `${plan === 'premium' ? 'Premium' : 'Basic'} selected — payment coming soon!`
            );
          }}
        />
      )}

    </div> /* END shell */
  );
}
