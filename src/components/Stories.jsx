import { useEffect } from 'react'
import { STORIES_DATA } from "../lib/helpers"
import { clr } from "../lib/helpers"

export function StoriesBar({ onView }) {
  return (
    <div className="stories">
      <div className="story-item">
        <div className="story-add-btn">+</div>
        <span className="story-lbl">Add</span>
      </div>
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
