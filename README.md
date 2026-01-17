# Recent (r3cent.com)

Your recency layer across trusted sources. A modern PWA that captures thoughts, syncs email/calendar/music, and provides AI-powered insights.

## 🏗️ Architecture

```
r3cent/
├── apps/
│   └── web/              # React + Vite PWA (Cloudflare Pages)
├── packages/
│   └── shared/           # Shared types & Zod schemas
├── workers/
│   └── api/              # Cloudflare Worker API
└── infra/
    └── migrations/       # D1 database migrations
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account (for deployment)

### Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Create D1 database**
   ```bash
   cd workers/api
   wrangler d1 create r3cent-db
   # Copy the database_id to wrangler.toml
   ```

3. **Create KV namespace**
   ```bash
   wrangler kv:namespace create KV
   # Copy the id to wrangler.toml
   ```

4. **Set secrets for local dev**
   ```bash
   cd workers/api
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your secrets
   ```

5. **Run migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start development**
   ```bash
   pnpm dev
   ```

   This starts:
   - Frontend: http://localhost:5173
   - API Worker: http://localhost:8787

## 📁 Project Structure

### Frontend (`apps/web`)

```
src/
├── components/       # Reusable UI components
│   ├── BottomNav.tsx
│   ├── ChannelCard.tsx
│   ├── CaptureSheet.tsx
│   └── ...
├── routes/          # Page components
│   ├── Now.tsx      # Main dashboard
│   ├── Ask.tsx      # AI chat
│   ├── Capture.tsx  # Voice/text capture
│   └── Settings.tsx
├── lib/             # Utilities
│   ├── api.ts       # API client
│   ├── store.ts     # Zustand stores
│   ├── speech.ts    # Web Speech API
│   └── time.ts      # Time formatting
└── styles/
    └── index.css    # Tailwind CSS
```

### API Worker (`workers/api`)

```
src/
├── index.ts         # Hono app entry
├── routes/          # API endpoints
│   ├── now.ts       # GET /api/now
│   ├── ask.ts       # POST /api/ask
│   ├── items.ts     # CRUD items
│   └── connections.ts
├── providers/       # External integrations
│   ├── google/
│   │   ├── gmail.ts
│   │   └── calendar.ts
│   └── spotify/
│       └── recentlyPlayed.ts
├── security/        # Auth & crypto
│   ├── crypto.ts
│   └── tokens.ts
└── middleware/
    └── auth.ts
```

## 🔌 API Endpoints

### Auth
- `GET /api/auth/google` - Start Google OAuth
- `GET /api/auth/spotify` - Start Spotify OAuth
- `POST /api/auth/logout` - Log out
- `GET /api/me` - Get current user

### Now (Dashboard)
- `GET /api/now` - Get all channel data
- `POST /api/now/refresh/:channel` - Refresh a channel

### Items
- `POST /api/items` - Create thought/scrawl
- `GET /api/items/:id` - Get item
- `PATCH /api/items/:id` - Update item status
- `DELETE /api/items/:id` - Delete item

### Ask (AI Chat)
- `POST /api/ask` - Ask a question
- `GET /api/ask/sessions` - List sessions
- `GET /api/ask/sessions/:id` - Get session messages

### Connections
- `GET /api/connections` - List connections
- `POST /api/connections/:provider/start` - Start OAuth
- `POST /api/connections/:provider/disconnect` - Disconnect

## 🔐 Environment Variables

### Worker Secrets

For **local development**, copy `.dev.vars.example` to `.dev.vars`:
```bash
cd workers/api
cp .dev.vars.example .dev.vars
```

For **production**, use Wrangler secrets:
```bash
wrangler secret put TOKEN_ENC_KEY
wrangler secret put GOOGLE_CLIENT_ID
# ... etc
```

| Variable | Description |
|----------|-------------|
| `TOKEN_ENC_KEY` | 64-char hex string for AES-256-GCM |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth client secret |
| `AI_API_KEY` | OpenAI/Gemini API key |

## 🚢 Deployment

### Deploy API Worker
```bash
cd workers/api
wrangler deploy
```

### Deploy Frontend
```bash
cd apps/web
pnpm build
wrangler pages deploy dist
```

Or connect to GitHub for automatic deployments.

## 📊 Data Model

### Channels & Item Types

| Channel | Item Types | Source |
|---------|-----------|--------|
| Thoughts | `thought.voice` | Local voice recordings |
| Scrawls | `scrawl.text` | Local text notes |
| Email | `email.received`, `email.sent` | Gmail |
| Calendar | `calendar.past`, `calendar.upcoming` | Google Calendar |
| Tunes | `tunes.track` | Spotify |

## 🎨 Design Principles

1. **3 Items Only** - Show exactly 3 items per channel on the Now screen
2. **Mobile-First** - PWA optimized for mobile, works on desktop
3. **Minimal Data** - Only store what's needed (headers, not full emails)
4. **Fast Capture** - Voice and text capture in < 2 taps
5. **AI Grounded** - Answers cite your own data, not the web

## 📝 License

MIT