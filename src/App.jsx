import { useState, useEffect, useRef, useCallback } from 'react'
import { sb } from './lib/supabase'
import { clr, ini, ago, fmtTime } from './lib/helpers'
import { useToast } from './hooks/useToast'
import { Av, Icons } from './components/Av'
import AuthScreen from './components/AuthScreen'
import { StoriesBar, StoryViewer } from './components/Stories'
import CallOverlay from './components/CallOverlay'
import { PlansModal, NewConvModal } from './components/Modals'
import { SocialFeed, DatingScreen, NotificationsPanel, SettingsPanel } from './pages/Views'

export default function App() {
  const toast = useToast()

  const [user,         setUser]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [view,         setView]         = useState('chats')
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [convs,        setConvs]        = useState([])
  const [activeConv,   setActiveConv]   = useState(null)
  const [msgs,         setMsgs]         = useState([])
  const [input,        setInput]        = useState('')
  const [onlineUsers,  setOnlineUsers]  = useState([])
  const [allMembers,   setAllMembers]   = useState([])
  const [call,         setCall]         = useState(null)
  const [localStream,  setLocalStream]  = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [storyView,    setStoryView]    = useState(null)
  const [showNewConv,  setShowNewConv]  = useState(false)
  const [showPlans,    setShowPlans]    = useState(false)
  const [showMembers,  setShowMembers]  = useState(false)
  const [showAddToGroup, setShowAddToGroup] = useState(false)
  const [showVoiceNote,  setShowVoiceNote]  = useState(false)
  const [tab,          setTab]          = useState('all')
  const [search,       setSearch]       = useState('')
  const [userResults,  setUserResults]  = useState([])
  const [trialDays,    setTrialDays]    = useState(60)
  const [recording,    setRecording]    = useState(false)
  const [mediaRec,     setMediaRec]     = useState(null)

  const msgSub    = useRef(null)
  const pollRef   = useRef(null)
  const msgEnd    = useRef(null)
  const peerConn  = useRef(null)
  const fileInput = useRef(null)

  /* ── AUTH ── */
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

  useEffect(() => {
    if (!user) return
    const iv = setInterval(() => {
      sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id)
    }, 60_000)
    return () => clearInterval(iv)
  }, [user])

  const handleAuth = async (u) => {
    setUser(u)
    const { data: p } = await sb.from('profiles').select('*').eq('id', u.id).single()
    setProfile(p)
    await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', u.id)

    // calculate trial days
    if (p?.trial_ends_at) {
      const days = Math.max(0, Math.ceil((new Date(p.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
      setTrialDays(days)
    }

    loadConvs(u.id)
    loadOnline(u.id)
    loadAllMembers(u.id)
    toast('👋', `Welcome back${p?.display_name ? ', ' + p.display_name : ''}!`)
  }

  const signOut = async () => {
    clearInterval(pollRef.current)
    if (msgSub.current) sb.removeChannel(msgSub.current)
    await sb.auth.signOut()
    setUser(null); setProfile(null); setConvs([])
    setActiveConv(null); setMsgs([])
  }

  /* ── CONVERSATIONS ── */
  const loadConvs = async (uid) => {
    const { data: mems } = await sb.from('conversation_members').select('conversation_id').eq('user_id', uid)
    if (!mems?.length) { setConvs([]); return }
    const ids = mems.map((m) => m.conversation_id)
    const { data } = await sb.from('conversations').select('*').in('id', ids).order('created_at', { ascending: false })
    setConvs(data || [])
  }

  /* ── ALL MEMBERS ── */
  const loadAllMembers = async (uid) => {
    const { data } = await sb.from('profiles').select('*').neq('id', uid).order('last_seen', { ascending: false }).limit(100)
    setAllMembers(data || [])
  }

  /* ── OPEN CONVERSATION ── */
  const openConv = useCallback(async (conv) => {
    setActiveConv(conv)
    setSidebarOpen(false)

    // cleanup old poll + subscription
    clearInterval(pollRef.current)
    if (msgSub.current) { sb.removeChannel(msgSub.current); msgSub.current = null }

    // load messages
    const { data } = await sb
      .from('messages')
      .select('*, profiles(display_name, username)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(60)
    setMsgs(data || [])
    setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    let lastTime = data?.length ? data[data.length - 1].created_at : new Date(0).toISOString()

    // POLLING every 2.5s — guaranteed delivery on all plans
    pollRef.current = setInterval(async () => {
      const { data: newMsgs } = await sb
        .from('messages')
        .select('*, profiles(display_name, username)')
        .eq('conversation_id', conv.id)
        .gt('created_at', lastTime)
        .order('created_at', { ascending: true })

      if (newMsgs?.length) {
        lastTime = newMsgs[newMsgs.length - 1].created_at
        setMsgs((prev) => {
          let updated = [...prev]
          newMsgs.forEach((msg) => {
            const tempIdx = updated.findIndex(
              (m) => m.id?.toString().startsWith('temp_') && m.content === msg.content && m.sender_id === msg.sender_id
            )
            if (tempIdx !== -1) updated[tempIdx] = msg
            else if (!updated.some((m) => m.id === msg.id)) updated.push(msg)
          })
          return updated
        })
        setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    }, 2500)

    // Realtime as bonus
    msgSub.current = sb.channel(`conv-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          if (payload.new.conversation_id !== conv.id) return
          const { data: fullMsg } = await sb.from('messages').select('*, profiles(display_name, username)').eq('id', payload.new.id).single()
          const msg = fullMsg || payload.new
          setMsgs((prev) => {
            const tempIdx = prev.findIndex((m) => m.id?.toString().startsWith('temp_') && m.content === msg.content && m.sender_id === msg.sender_id)
            if (tempIdx !== -1) { const u = [...prev]; u[tempIdx] = msg; return u }
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
      .subscribe()
  }, [user?.id])

  /* ── SEND MESSAGE ── */
  const sendMsg = async () => {
    const text = input.trim()
    if (!text || !activeConv || !user) return
    setInput('')
    const tempId = 'temp_' + Date.now()
    const tempMsg = {
      id: tempId, conversation_id: activeConv.id, sender_id: user.id,
      content: text, message_type: 'text', created_at: new Date().toISOString(),
      profiles: { display_name: profile?.display_name, username: profile?.username },
    }
    setMsgs((m) => [...m, tempMsg])
    setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const { data, error } = await sb.from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: user.id, content: text, message_type: 'text' })
      .select('*, profiles(display_name, username)').single()

    if (error) { toast('❌', 'Send failed: ' + error.message); setMsgs((m) => m.filter((x) => x.id !== tempId)); setInput(text); return }
    if (data) setMsgs((m) => m.map((x) => x.id === tempId ? data : x))
    await sb.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', activeConv.id)
    loadConvs(user.id)
  }

  /* ── SEND FILE ATTACHMENT ── */
  const sendFile = async (file) => {
    if (!file || !activeConv || !user) return
    toast('📎', 'Uploading file...')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { data: uploaded, error: upErr } = await sb.storage.from('attachments').upload(path, file)
    if (upErr) { toast('❌', 'Upload failed: ' + upErr.message); return }
    const { data: { publicUrl } } = sb.storage.from('attachments').getPublicUrl(path)
    const content = `📎 [${file.name}](${publicUrl})`
    const { error } = await sb.from('messages').insert({
      conversation_id: activeConv.id, sender_id: user.id, content, message_type: 'file'
    })
    if (error) toast('❌', 'Could not send file')
    else { toast('✅', 'File sent!'); loadConvs(user.id) }
  }

  /* ── VOICE NOTE ── */
  const startVoiceNote = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const path = `${user.id}/voice_${Date.now()}.webm`
        const { error: upErr } = await sb.storage.from('attachments').upload(path, blob)
        if (upErr) { toast('❌', 'Voice upload failed'); return }
        const { data: { publicUrl } } = sb.storage.from('attachments').getPublicUrl(path)
        await sb.from('messages').insert({
          conversation_id: activeConv.id, sender_id: user.id,
          content: `🎤 [Voice Note](${publicUrl})`, message_type: 'voice'
        })
        toast('✅', 'Voice note sent!')
        loadConvs(user.id)
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      setMediaRec(mr)
      setRecording(true)
      toast('🎤', 'Recording... tap mic again to stop')
    } catch (err) {
      toast('❌', 'Mic error: ' + err.message)
    }
  }

  const stopVoiceNote = () => {
    if (mediaRec && recording) { mediaRec.stop(); setRecording(false); setMediaRec(null) }
  }

  /* ── ONLINE USERS ── */
  const loadOnline = async (uid) => {
    const five = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await sb.from('profiles').select('*').gt('last_seen', five).neq('id', uid).limit(20)
    setOnlineUsers(data || [])
    setTimeout(() => loadOnline(uid), 30_000)
  }

  /* ── START DM FROM MEMBERS LIST ── */
  const startDMWith = async (otherUser) => {
    setShowMembers(false)
    const { data: conv, error } = await sb.from('conversations')
      .insert({ name: otherUser.display_name || otherUser.username, is_group: false })
      .select().single()
    if (error) { toast('❌', error.message); return }
    await sb.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: user.id, role: 'member' },
      { conversation_id: conv.id, user_id: otherUser.id, role: 'member' },
    ])
    loadConvs(user.id)
    openConv(conv)
    setView('chats')
    toast('✅', `Chat started with ${otherUser.display_name || otherUser.username}`)
  }

  /* ── ADD MEMBER TO GROUP ── */
  const addToGroup = async (targetUser) => {
    if (!activeConv?.is_group) return
    const { error } = await sb.from('conversation_members').insert({
      conversation_id: activeConv.id, user_id: targetUser.id, role: 'member'
    })
    if (error) toast('❌', 'Could not add member: ' + error.message)
    else toast('✅', `${targetUser.display_name || targetUser.username} added to group!`)
  }

  /* ── WEBRTC ── */
  const startCall = async (type) => {
    if (!activeConv) { toast('💬', 'Select a conversation first'); return }
    try {
      const constraints = type === 'video' ? { video: true, audio: true } : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
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

  /* ── SEARCH ── */
  const searchUsers = async (query) => {
    if (!query.trim() || query.length < 2) { setUserResults([]); return }
    const { data } = await sb.from('profiles').select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', user?.id).limit(6)
    setUserResults(data || [])
  }

  /* ── INVITE LINK ── */
  const copyInviteLink = () => {
    const link = `${window.location.origin}?invite=${activeConv?.id}`
    navigator.clipboard?.writeText(link)
    toast('🔗', 'Invite link copied! Share it to add people to this group.')
  }

  const filteredConvs = (convs || []).filter((c) => {
    const ms = !search || c.name?.toLowerCase().includes(search.toLowerCase())
    const mt = tab === 'all' || (tab === 'groups' ? c.is_group : !c.is_group)
    return ms && mt
  })

  const myName = profile?.display_name || profile?.username || 'Me'
  const trialPct = Math.max(0, Math.min(100, ((60 - trialDays) / 60) * 100))

  if (!user) return <AuthScreen onAuth={handleAuth} />

  const navItems = [
    { id: 'chats',    icon: Icons.chat,  label: 'Chats' },
    { id: 'feed',     icon: Icons.feed,  label: 'Feed' },
    { id: 'dating',   icon: Icons.heart, label: 'Hearts', dot: true, dotColor: 'var(--rose)' },
    { id: 'notifs',   icon: Icons.bell,  label: 'Alerts', dot: true, dotColor: 'var(--accent)' },
    { id: 'settings', icon: Icons.cog,   label: 'Settings' },
  ]

  return (
    <div className="shell">

      {/* DESKTOP RAIL */}
      <nav className="rail">
        <div className="rail-logo" onClick={() => toast('🚀', 'NEXUS')}>N</div>
        {navItems.map((n) => (
          <button key={n.id} className={`rail-btn${view === n.id ? ' active' : ''}`} onClick={() => setView(n.id)} title={n.label}>
            {n.icon}{n.dot && <span className="rdot" style={{ background: n.dotColor }} />}
          </button>
        ))}
        {/* Members button */}
        <button className="rail-btn" onClick={() => setShowMembers(true)} title="Members">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
        <div className="rail-spacer" />
        <div className="rav" style={{ background: clr(user.id) }} title={myName}>{ini(myName)}</div>
      </nav>

      {/* SIDEBAR */}
      <div className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
        <div className="sb-head">
          <div className="sb-top">
            <span className="sb-title">
              {{ chats: 'Messages', feed: 'Feed', dating: '💝 Hearts', notifs: 'Notifications', settings: 'Settings' }[view]}
            </span>
            <div style={{ display: 'flex', gap: '.3rem' }}>
              <button className="icon-btn" onClick={() => setShowMembers(true)} title="Members">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>
              <button className="icon-btn" onClick={() => setShowNewConv(true)} title="New">{Icons.plus}</button>
            </div>
          </div>
          <div className="search-row" style={{ position: 'relative' }}>
            {Icons.search}
            <input placeholder="Search people or chats…" value={search}
              onChange={(e) => { setSearch(e.target.value); searchUsers(e.target.value) }}
              onBlur={() => setTimeout(() => setUserResults([]), 200)} />
            {userResults.length > 0 && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 10, zIndex: 200, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                {userResults.map((u) => (
                  <div key={u.id} onMouseDown={() => startDMWith(u)}
                    style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem .85rem', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {ini(u.display_name || u.username)}
                    </div>
                    <div>
                      <div style={{ fontSize: '.78rem', fontWeight: 600 }}>{u.display_name || u.username}</div>
                      <div style={{ fontSize: '.62rem', color: 'var(--muted2)' }}>@{u.username} · tap to chat</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div key={c.id} className={`ci${activeConv?.id === c.id ? ' active' : ''}`}
                  onClick={() => { openConv(c); setView('chats') }}>
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
              ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {view === 'feed'     ? <SocialFeed currentUser={user} currentProfile={profile} /> :
         view === 'dating'   ? <DatingScreen onUpgrade={() => setShowPlans(true)} /> :
         view === 'notifs'   ? <NotificationsPanel /> :
         view === 'settings' ? <SettingsPanel user={user} profile={profile} onSignOut={signOut} /> :

         activeConv ? (
           <>
             <StoriesBar onView={setStoryView} currentUser={user} currentProfile={profile} />
             <div className="topbar">
               <button onClick={() => setSidebarOpen(true)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--panel)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '.3rem' }}>←</button>
               <Av name={activeConv.name} id={activeConv.id} size={34} />
               <div className="tb-info">
                 <div className="tb-name">{activeConv.name}</div>
                 <div className="tb-status on">{activeConv.is_group ? `Group · ${msgs.length} messages` : 'Active'}</div>
               </div>
               <div className="tb-actions">
                 <button className="icon-btn" onClick={() => startCall('audio')} title="Voice call">{Icons.phone}</button>
                 <button className="icon-btn" onClick={() => startCall('video')} title="Video call">{Icons.video}</button>
                 {activeConv.is_group && (
                   <>
                     <button className="icon-btn" onClick={() => setShowAddToGroup(true)} title="Add member">
                       <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                     </button>
                     <button className="icon-btn" onClick={copyInviteLink} title="Invite link">🔗</button>
                   </>
                 )}
                 <button className="icon-btn">{Icons.dots}</button>
               </div>
             </div>

             <div className="msgs">
               {msgs.length === 0 && <div className="empty-state"><div className="ei">👋</div><p>Say hello! Start the conversation.</p></div>}
               <div className="date-div"><span>Today</span></div>
               {msgs.map((m, i) => {
                 const mine = m.sender_id === user.id
                 const sn = m.profiles?.display_name || m.profiles?.username || 'Unknown'
                 const isVoice = m.message_type === 'voice'
                 const isFile  = m.message_type === 'file'
                 const urlMatch = m.content?.match(/\[.*?\]\((.*?)\)/)
                 const fileUrl  = urlMatch?.[1]
                 const fileName = m.content?.match(/\[(.*?)\]/)?.[1]
                 return (
                   <div key={m.id || i} className={`mrow msg-anim${mine ? ' mine' : ''}`}>
                     {!mine && <div className="mav" style={{ background: clr(m.sender_id), width: 24, height: 24, fontSize: '.55rem' }}>{ini(sn)}</div>}
                     <div className="bubble">
                       {!mine && activeConv.is_group && <div className="msender">{sn}</div>}
                       {isVoice && fileUrl ? (
                         <div>
                           <audio controls src={fileUrl} style={{ maxWidth: '100%', height: 36 }} />
                         </div>
                       ) : isFile && fileUrl ? (
                         <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: mine ? '#fff' : 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                           📎 <span style={{ textDecoration: 'underline', fontSize: '.75rem' }}>{fileName}</span>
                         </a>
                       ) : m.content}
                       <div className="mtime">{fmtTime(m.created_at)}{mine && ' ✓✓'}</div>
                     </div>
                   </div>
                 )
               })}
               <div ref={msgEnd} />
             </div>

             <div className="input-bar">
               <input ref={fileInput} type="file" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) sendFile(e.target.files[0]) }} />
               <div className="input-wrap">
                 <button className="ib" onClick={() => fileInput.current?.click()} title="Attach file">{Icons.attach}</button>
                 <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMsg()} placeholder={`Message ${activeConv.name}…`} />
                 <button
                   className="ib"
                   title={recording ? 'Stop recording' : 'Voice note'}
                   onClick={recording ? stopVoiceNote : startVoiceNote}
                   style={{ color: recording ? 'var(--rose)' : 'var(--muted2)' }}
                 >
                   {recording ? '⏹️' : Icons.mic}
                 </button>
               </div>
               <button className="send-btn" onClick={sendMsg}>{Icons.send}</button>
             </div>
           </>
         ) : (
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <StoriesBar onView={setStoryView} currentUser={user} currentProfile={profile} />
             <div className="empty-state">
               <div className="ei">💬</div>
               <p>Select a conversation or<br />browse members to start chatting</p>
               <button onClick={() => setShowMembers(true)} style={{ padding: '.6rem 1.2rem', background: 'var(--accentg)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font)', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', marginTop: '.5rem' }}>
                 👥 Browse Members
               </button>
             </div>
           </div>
         )}
      </div>

      {/* RIGHT PANEL */}
      <div className="rpanel">
        <div className="rp-sec">
          <div className="rp-lbl">Your Trial</div>
          <div className="trial-card">
            <h3>⏳ Trial Active</h3>
            <p>Full premium access free for 60 days.</p>
            <div className="trial-days"><span className="big">{trialDays}</span><span className="sm">days<br />remaining</span></div>
            <div className="trial-bar"><div className="trial-fill" style={{ width: `${trialPct}%` }} /></div>
            <button className="btn-upgrade" onClick={() => setShowPlans(true)}>⭐ View Plans — from $1</button>
          </div>
        </div>

        <div className="rp-sec">
          <div className="rp-lbl">💝 Nexus Hearts</div>
          <div className="dating-card">
            <h3>💝 Find Your Match</h3>
            <p>People near you match your profile.</p>
            <button className="btn-dating" onClick={() => setView('dating')}>See Who Likes You →</button>
          </div>
        </div>

        <div className="rp-sec">
          <div className="rp-lbl">
            Active Now
            <span style={{ marginLeft: '.4rem', fontSize: '.58rem', background: 'rgba(45,214,138,.15)', color: 'var(--green)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
              {onlineUsers.length}
            </span>
          </div>
          {onlineUsers.length === 0
            ? <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>No one online right now</div>
            : onlineUsers.slice(0, 6).map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.55rem', cursor: 'pointer' }}
                  onClick={() => startDMWith(u)}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.56rem', fontWeight: 700, color: '#fff', flexShrink: 0, position: 'relative' }}>
                    {ini(u.display_name || u.username)}
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 7, height: 7, background: 'var(--green)', borderRadius: '50%', border: '1.5px solid var(--surface)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.74rem', fontWeight: 500 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--green)' }}>online · tap to chat</div>
                  </div>
                </div>
              ))}
        </div>

        <div className="rp-sec">
          <div className="rp-lbl">🛟 Support</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {[
              { href: 'tel:0114419282',           icon: '📞', label: 'Support',  val: '0114419282' },
              { href: 'tel:0797317925',            icon: '🆘', label: 'Helpline', val: '0797317925' },
              { href: 'mailto:ephy3605@gmail.com', icon: '✉️', label: 'Email',    val: 'ephy3605@gmail.com' },
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
      </div>

      {/* MEMBERS MODAL */}
      {showMembers && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>👥 Members</h3>
              <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '.4rem', background: 'var(--panel)', borderRadius: 9, padding: '.45rem .75rem', border: '1px solid var(--border2)' }}>
                {Icons.search}
                <input placeholder="Search members…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.78rem', flex: 1 }}
                  onChange={(e) => { const q = e.target.value.toLowerCase(); if (!q) { loadAllMembers(user.id); return } setAllMembers((prev) => prev.filter((u) => (u.display_name || u.username)?.toLowerCase().includes(q))) }} />
              </div>
            </div>

            {/* Online section */}
            <div style={{ marginBottom: '.5rem' }}>
              <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '.5rem' }}>
                🟢 Online — {onlineUsers.length}
              </div>
              {onlineUsers.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.6rem .7rem', background: 'var(--card)', borderRadius: 10, marginBottom: '.4rem', border: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => startDMWith(u)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.72rem', color: '#fff', flexShrink: 0, position: 'relative' }}>
                    {ini(u.display_name || u.username)}
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--card)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--muted2)' }}>@{u.username}</div>
                  </div>
                  <button style={{ padding: '.35rem .8rem', background: 'var(--accentg)', color: '#fff', border: 'none', borderRadius: 7, fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    Message
                  </button>
                </div>
              ))}
            </div>

            {/* All members */}
            <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.5rem' }}>
              All Members — {allMembers.length}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {allMembers.filter((u) => !onlineUsers.some((o) => o.id === u.id)).map((u) => {
                const lastSeen = u.last_seen ? ago(u.last_seen) : 'long ago'
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.6rem .7rem', background: 'var(--card)', borderRadius: 10, marginBottom: '.4rem', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => startDMWith(u)}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.72rem', color: '#fff', flexShrink: 0 }}>
                      {ini(u.display_name || u.username)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 600 }}>{u.display_name || u.username}</div>
                      <div style={{ fontSize: '.65rem', color: 'var(--muted2)' }}>@{u.username} · last seen {lastSeen}</div>
                    </div>
                    <button style={{ padding: '.35rem .8rem', background: 'var(--panel)', color: 'var(--accent)', border: '1px solid rgba(79,110,247,.3)', borderRadius: 7, fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      Message
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADD TO GROUP MODAL */}
      {showAddToGroup && activeConv?.is_group && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Member to Group</h3>
              <button onClick={() => setShowAddToGroup(false)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Select a member to add to <strong>{activeConv.name}</strong>
            </p>
            {/* Invite link */}
            <div style={{ background: 'rgba(79,110,247,.1)', border: '1px solid rgba(79,110,247,.25)', borderRadius: 10, padding: '.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '.75rem', fontWeight: 600 }}>Share Invite Link</div>
                <div style={{ fontSize: '.65rem', color: 'var(--muted2)' }}>Anyone with the link can join</div>
              </div>
              <button onClick={copyInviteLink} style={{ padding: '.4rem .85rem', background: 'var(--accentg)', color: '#fff', border: 'none', borderRadius: 7, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                🔗 Copy Link
              </button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {allMembers.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.6rem .7rem', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: clr(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.68rem', color: '#fff', flexShrink: 0 }}>
                    {ini(u.display_name || u.username)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: '.63rem', color: 'var(--muted2)' }}>@{u.username}</div>
                  </div>
                  <button onClick={() => addToGroup(u)} style={{ padding: '.35rem .75rem', background: 'var(--accentg)', color: '#fff', border: 'none', borderRadius: 7, fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <div className="mobile-nav">
        {navItems.map((n) => (
          <button key={n.id} className={`mobile-nav-btn${view === n.id ? ' active' : ''}`}
            onClick={() => { setView(n.id); if (n.id === 'chats') setSidebarOpen(true) }}>
            {n.dot && <span className="mn-dot" style={{ background: n.dotColor }} />}
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
        <button className="mobile-nav-btn" onClick={() => setShowMembers(true)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Members</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span>Menu</span>
        </button>
      </div>

      {/* OVERLAYS */}
      {call        && <CallOverlay call={call} onEnd={endCall} localStream={localStream} remoteStream={remoteStream} />}
      {storyView   && <StoryViewer story={storyView} onClose={() => setStoryView(null)} />}
      {showNewConv && <NewConvModal onClose={() => setShowNewConv(false)} uid={user.id} onCreated={(conv) => { setShowNewConv(false); loadConvs(user.id); openConv(conv); setView('chats'); toast('✅', 'Conversation created!') }} />}
      {showPlans   && <PlansModal onClose={() => setShowPlans(false)} onSelect={(plan) => { setShowPlans(false); toast('⭐', `${plan === 'premium' ? 'Premium' : 'Basic'} — payment coming soon!`) }} />}

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 49 }} className="mobile-backdrop" />
      )}
    </div>
  )
}