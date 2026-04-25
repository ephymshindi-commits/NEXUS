# NEXUS — Complete Communication Platform

> One platform for every connection — messaging, voice, video, stories, dating and more.

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
Your `.env` file is already configured with your Supabase credentials:
```
VITE_SUPABASE_URL=https://uahqyubjyqozlmeoshvr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_26pF0v_9Osk2rnw4L3n3tw_tlU_RcQo
```

### 3. Run Supabase SQL (if not done yet)
Go to your Supabase dashboard → SQL Editor → paste and run:

```sql
-- Profiles (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '60 days'),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages (Realtime ENABLED)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "profiles_readable"    ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "convs_member_select"  ON conversations FOR SELECT USING (
  id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
);
CREATE POLICY "convs_insert"         ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "convs_update"         ON conversations FOR UPDATE USING (true);

CREATE POLICY "members_select"       ON conversation_members FOR SELECT USING (true);
CREATE POLICY "members_insert"       ON conversation_members FOR INSERT WITH CHECK (true);

CREATE POLICY "msgs_member_select"   ON messages FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
);
CREATE POLICY "msgs_insert"          ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (true);

### 4. Enable Realtime
Supabase Dashboard → Database → Replication → enable `messages` and `profiles` tables.

### 5. Start dev server
```bash
npm run dev
```
Open http://localhost:5173

### 6. Build for production
```bash
npm run build
```
Then deploy the `dist/` folder to **Vercel**, **Netlify**, or **GitHub Pages**.

---

## 📁 Project Structure

```
nexus/
├── index.html
├── vite.config.js
├── package.json
├── .env                          ← your Supabase keys
└── src/
    ├── main.jsx                  ← React entry point
    ├── App.jsx                   ← main app + all chat logic
    ├── lib/
    │   ├── supabase.js           ← Supabase client + support contacts
    │   └── helpers.js            ← utils, colors, demo data
    ├── hooks/
    │   └── useToast.jsx          ← toast notification context
    ├── components/
    │   ├── Av.jsx                ← Avatar + Icons
    │   ├── AuthScreen.jsx        ← login / register
    │   ├── Stories.jsx           ← stories bar + viewer
    │   ├── CallOverlay.jsx       ← WebRTC voice/video UI
    │   └── Modals.jsx            ← Plans + NewConversation modals
    ├── pages/
    │   └── Views.jsx             ← Feed, Dating, Notifications, Settings
    └── styles/
        └── global.css            ← all styles + animations
```

## ✅ Features Included

| Feature | Status |
|---|---|
| Auth (sign up / sign in) | ✅ Live |
| Real-time messaging | ✅ Live |
| Group chats | ✅ Live |
| Direct messages | ✅ Live |
| Online presence | ✅ Live |
| Voice calls (WebRTC) | ✅ Live |
| Video calls (WebRTC) | ✅ Live |
| Stories | ✅ UI Live |
| Social feed | ✅ UI Live |
| Dating / Nexus Hearts | ✅ UI Live |
| Notifications | ✅ UI Live |
| Settings + toggles | ✅ Live |
| 2-month free trial system | ✅ Live |
| Support contacts | ✅ Live |
| Stripe payments | ⏳ Phase 5 |
| Mobile app | ⏳ Phase 5 |
| File/media sharing | ⏳ Phase 5 |

## 📞 Support
- **Support Line:** 0114419282  
- **Help Line:** 0797317925  
- **Email:** ephy3605@gmail.com
