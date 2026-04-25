import { useState, useEffect, useRef } from 'react'
import { clr, ini } from "../lib/helpers"

export default function CallOverlay({ call, onEnd, localStream, remoteStream }) {
  const [muted, setMuted]   = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const lRef = useRef()
  const rRef = useRef()

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (lRef.current && localStream)  lRef.current.srcObject = localStream
    if (rRef.current && remoteStream) rRef.current.srcObject = remoteStream
  }, [localStream, remoteStream])

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = muted))
    setMuted(!muted)
  }
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = camOff))
    setCamOff(!camOff)
  }
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="call-overlay">
      {call.type === 'video' ? (
        <>
          <p className="call-status">🎥 Video Call</p>
          <div className="video-wrap">
            <div className="video-main">
              <video ref={rRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span className="v-lbl">{call.name}</span>
            </div>
            <div className="video-local">
              <video ref={lRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span className="v-lbl">You</span>
            </div>
          </div>
          <div className="call-timer" style={{ marginTop: '.5rem' }}>{fmt(elapsed)}</div>
        </>
      ) : (
        <>
          <p className="call-status">{call.status === 'connecting' ? '⏳ Connecting…' : '🎙️ Voice Call'}</p>
          <div className="call-av" style={{ background: clr(call.id) }}>{ini(call.name)}</div>
          <h2 className="call-name">{call.name}</h2>
          <div className="call-timer">{fmt(elapsed)}</div>
        </>
      )}
      <div className="call-controls">
        <button className={`call-btn mute-btn${muted ? ' on' : ''}`} onClick={toggleMute}>
          {muted ? '🔇' : '🎙️'}
        </button>
        {call.type === 'video' && (
          <button className={`call-btn mute-btn${camOff ? ' on' : ''}`} onClick={toggleCam}>
            {camOff ? '📵' : '🎥'}
          </button>
        )}
        <button className="call-btn end-btn" onClick={onEnd}>📵</button>
      </div>
    </div>
  )
}
