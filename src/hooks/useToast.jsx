import { createContext, useContext, useRef, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ show: false, icon: '', msg: '' })
  const timer = useRef()

  const showToast = useCallback((icon, msg) => {
    setToast({ show: true, icon, msg })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <div className={`toast${toast.show ? ' show' : ''}`}>
        <span>{toast.icon}</span>
        <span>{toast.msg}</span>
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
