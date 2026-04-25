export const COLORS = [
  'linear-gradient(135deg,#4f6ef7,#7c4ff7)',
  'linear-gradient(135deg,#f75b8a,#c0306a)',
  'linear-gradient(135deg,#2dd68a,#1a9a60)',
  'linear-gradient(135deg,#f0c060,#e89040)',
  'linear-gradient(135deg,#2dd6c8,#1a9aaa)',
  'linear-gradient(135deg,#f77a4f,#d0501a)',
  'linear-gradient(135deg,#a04ff7,#6020c0)',
]

export const clr = (str) => {
  let h = 0
  for (const c of (str || 'x')) h = c.charCodeAt(0) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

export const ini = (n) =>
  (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export const ago = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return new Date(ts).toLocaleDateString()
}

export const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export const STORIES_DATA = [
  { id: 's1', name: 'Amara',  emoji: '🌅', text: 'Nairobi sunsets are unmatched ✨' },
  { id: 's2', name: 'Kwame',  emoji: '🚀', text: 'Just shipped something big today!' },
  { id: 's3', name: 'Sofia',  emoji: '☕', text: 'Perfect morning vibes ☕🎵' },
  { id: 's4', name: 'Zara',   emoji: '💪', text: 'New week, new goals. Let\'s crush it!' },
]

export const DEMO_POSTS = [
  { id: 'p1', user: 'Amara Johnson', uid: 'u1', time: '2m',  text: 'Just launched something huge with the team today 🚀 The future of communication is truly here!', emoji: '🚀', likes: 247, comments: 38 },
  { id: 'p2', user: 'Kwame Asante',  uid: 'u2', time: '45m', text: 'Nairobi tech scene is growing faster than ever 🇰🇪 Proud to be building here. Who else is creating?', emoji: '🌍', likes: 183, comments: 51 },
  { id: 'p3', user: 'Sofia Mendes',  uid: 'u3', time: '2h',  text: 'Coffee + code + music = perfect Sunday ☕🎵 What\'s everyone working on this weekend?', emoji: '☕', likes: 312, comments: 74 },
  { id: 'p4', user: 'Zara Osei',     uid: 'u4', time: '4h',  text: 'Reminder: you don\'t have to have it all figured out. Just keep moving forward 💪✨', emoji: '💪', likes: 529, comments: 92 },
]

export const DEMO_MATCHES = [
  { id: 'm1', name: 'Sofia, 26',  detail: '📍 Nairobi', pct: '98% match', tags: ['Travel ✈️', 'Music 🎵', 'Coffee ☕'], emoji: '😊', locked: false },
  { id: 'm2', name: 'Alex, 29',   detail: '📍 Nairobi', pct: '95% match', tags: ['Fitness 💪', 'Tech 💻', 'Gaming 🎮'], emoji: '😍', locked: true  },
  { id: 'm3', name: 'Jordan, 24', detail: '📍 Nairobi', pct: '91% match', tags: ['Art 🎨', 'Food 🍜', 'Nature 🌿'], emoji: '🥰', locked: true  },
  { id: 'm4', name: 'Aisha, 27',  detail: '📍 Nairobi', pct: '88% match', tags: ['Books 📚', 'Dance 💃', 'Cooking 🍳'], emoji: '🤩', locked: true  },
]

export const DEMO_NOTIFS = [
  { id: 1, icon: '💬', title: 'New message',     desc: 'Amara sent you a message',                    time: '2m ago',  unread: true,  bg: 'rgba(79,110,247,.1)'  },
  { id: 2, icon: '❤️', title: 'New match!',      desc: 'Someone liked your Nexus Hearts profile',     time: '14m ago', unread: true,  bg: 'rgba(247,91,138,.1)'  },
  { id: 3, icon: '👥', title: 'Group invite',    desc: 'You were added to "Design Team 🎨"',          time: '1h ago',  unread: false, bg: 'rgba(45,214,138,.1)'  },
  { id: 4, icon: '🎉', title: 'Trial milestone', desc: 'You\'ve been on Nexus for 2 days — keep going!', time: '3h ago', unread: false, bg: 'rgba(240,192,96,.1)' },
  { id: 5, icon: '👑', title: 'Trial reminder',  desc: '58 days left on your free premium trial',     time: '1d ago',  unread: false, bg: 'rgba(79,110,247,.08)' },
]
