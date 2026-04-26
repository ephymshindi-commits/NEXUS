import { useEffect, useState } from 'react'
import { STORIES_DATA, clr } from '../lib/helpers'
import { sb } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

export function StoriesBar({ onView, currentUser, currentProfile }) {
  const toast = useToast()
  const [showAddStory, setShowAddStory] = useState(false)
  const [storyText, setStoryText] = useState('')
  const [storyEmoji, setStoryEmoji] = useState('✨')
  const [posting, setPosting] = useState(false)

  const emojis = ['✨','🔥','❤️','😊','🚀','🎉','💪','🌅','☕','🎵','🌍','💝']

  const submitStory = async () => {
    if (!storyText.trim()) { toast('✏️', 'Write something for your story!'); return }
    setPosting(true)
    const { error } = await sb.from('stories').insert({
      user_id: currentUser?.id,
      content: storyText.trim(),
      emoji: storyEmoji,
    })
    if (error) toast('❌', 'Could not post story: ' + error.message)
    else { toast('✅', 'Story posted!'); setStoryText(''); setShowAddStory(false) }
    setPosting(false)
  }

  const myName = currentProfile?.display_name || currentProfile?.username || 'Me'

  return (
    <>
      <div className="stories">
        {/* Add story button */}
        <div className="story-item" onClick={() => setShowAddStory(true)}>
          <div className="story-add-btn" style={{ cursor: 'pointer' }}>+</div>
          <span className="story-lbl">Add Story</span>
        </div>

        {/* My story preview */}
        <div className="story-item" onClick={() => setShowAddStory(true)}>
          <div className="story-ring">
            <div className="story-inner" style={{ background: clr(currentUser?.id || 'me') }}>
              {myName[0]}
            </div>
          </div>
          <span className="story-lbl">My Story</span>
        </div>

        {/* Demo stories */}
        {STORIES_DATA.map((s) => (
          <div key={s.id} className="story-item" onClick={() => onView(s)}>
            <div className="story-ring">
              <div className="story-inner" style={{ background: clr(s.id) }}>
                {s.name[0]}
              </div>
            </div>
            <span className="story-lbl">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Add Story Modal */}
      {showAddStory && (
        <div className="overlay" style={{ zIndex: 900 }}>
          <div className="modal-box" style={{ width: 380 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.3rem' }}>Add Your Story</h3>
            <p style={{ fontSize: '.74rem', color: 'var(--muted2)', marginBottom: '1.2rem' }}>
              Share a moment — disappears after 24 hours.
            </p>

            {/* Emoji picker */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '.62rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: '.4rem' }}>
                Pick an emoji
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                {emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setStoryEmoji(e)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: storyEmoji === e ? '2px solid var(--accent)' : '1px solid var(--border2)', background: storyEmoji === e ? 'rgba(79,110,247,.15)' : 'var(--panel)', fontSize: '1.1rem', cursor: 'pointer' }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Story text */}
            <div className="form-group">
              <label>Your Story</label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="What's happening? Share your moment..."
                style={{ width: '100%', padding: '.68rem .88rem', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.8rem', outline: 'none', resize: 'none', minHeight: 80, lineHeight: 1.6 }}
              />
            </div>

            {/* Preview */}
            <div style={{ background: 'linear-gradient(135deg,var(--panel),var(--card))', borderRadius: 10, padding: '1rem', textAlign: 'center', marginBottom: '1rem', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.3rem' }}>{storyEmoji}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--text)', lineHeight: 1.5 }}>{storyText || 'Your story preview...'}</div>
            </div>

            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button
                onClick={() => { setShowAddStory(false); setStoryText('') }}
                style={{ flex: 1, padding: '.65rem', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted2)', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={submitStory}
                disabled={posting}
                style={{ flex: 2, padding: '.65rem', background: 'var(--accentg)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.75rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: posting ? .6 : 1 }}
              >
                {posting ? 'Posting...' : '📸 Share Story'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function StoryViewer({ story, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [story, onClose])

  return (
    <div className="story-viewer" onClick={onClose}>
      <div className="sv-content" onClick={(e) => e.stopPropagation()}>
        <div className="sv-prog">
          <div className="sv-prog-fill" />
        </div>
        <div className="sv-user">
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: clr(story.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.62rem', fontWeight: 700, color: '#fff' }}>
            {story.name[0]}
          </div>
          <span style={{ fontSize: '.68rem', fontWeight: 600, color: '#fff' }}>{story.name}</span>
        </div>
        <button className="sv-close" onClick={onClose}>✕</button>
        <div className="sv-body">
          <div style={{ fontSize: '3rem', marginBottom: '.55rem' }}>{story.emoji}</div>
          <div style={{ fontSize: '.86rem', color: '#fff', lineHeight: 1.6 }}>{story.text}</div>
        </div>
      </div>
    </div>
  )
}