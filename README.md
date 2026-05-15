# Fantasy MMA Draft System

A high-performance, real-time draft and management engine for Fantasy UFC/MMA leagues. This backend handles complex draft sequencing, trade negotiations with veto mechanics, and live scoring cascades based on real-world fight results.

## 🚀 Tech Stack

- **Runtime:** [Node.js](https://nodejs.org/) (v18+)
- **Framework:** [Express.js](https://expressjs.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Database:** PostgreSQL (with [PostGIS](https://postgis.net/) for spatial indexing)
- **Caching & Real-time:** [Redis](https://redis.io/) (Pub/Sub) & [Socket.io](https://socket.io/)
- **Validation:** [Zod](https://zod.dev/)
- **Authentication:** JWT with Role-Based Access Control (RBAC)

## 🏗️ Core Architecture

### 1. Database Integrity (3NF)
The system follows strict Third Normal Form to ensure data consistency:
- **Fighter Normalization:** Static fighter data (Bio, Nationality) is decoupled from performance data.
- **League Isolation:** `ScoringSettings` are unique per league. Points in League A never affect status in League B.
- **The "Drop" Integrity:** When a fighter is dropped, points are archived in `DroppedFighter`, subtracted from `Team.totalPoints`, and the fighter returns to the free agent pool with 0 points.
- **Transaction Safety:** All roster mutations (picks, drops, trades) use Prisma `$transaction` with **Optimistic Locking** (version field).

### 2. Real-Time Draft Engine
- **Hybrid Timing:** Combines `node-cron` for scheduled league activation and in-memory `setTimeout` for the 60-second turn heartbeat.
- **Snake Sequencing:** Automatic generation of alternating draft orders (Round 1: 1-10, Round 2: 10-1).
- **Auto-Pick Service:** Automatically triggers picks for inactive users to maintain draft momentum.

### 3. 🔒 The Saturday Lockdown
Enforces a global and local freeze on all roster mutations (trades, drops, picks) during live UFC events via:
- `SystemState` singleton toggle.
- `lockdownGuard` middleware applied to critical API routes and socket listeners.

### 4. 📈 Admin & Point Cascade
- **Point Cascade:** When a bout result is entered, the engine identifies all teams owning the winning fighter, queries each league's specific `ScoringSettings`, and increments `TeamFighter` and `Team` totals simultaneously.
- **Instant Notifications:** Uses Socket.io to alert users the moment their team's score increases.

## 📁 Project Structure

```text
src/
├── app.ts                  # Express setup & global middlewares
├── server.ts               # Entry point, DB & Socket.io initialization
├── app/
│   ├── modules/            # Domain-driven modules
│   │   ├── auth/           # RBAC & User verification
│   │   ├── fighter/        # Fighter & Division management
│   │   ├── event/          # UFC Event management
│   │   ├── bout/           # Fight results & Point cascades
│   │   ├── league/         # League management & Scoring settings
│   │   ├── team/           # Team rosters & Points tracking
│   │   ├── draft/          # Real-time draft engine & Timers
│   │   ├── trade/          # Trade offers & Veto system
│   │   ├── queue/          # Draft pick wishlists
│   │   ├── system/         # Global state & Saturday Lockdown
│   │   └── newsletter/     # News & updates
│   ├── routes/             # Centralized API routing
│   └── shared/             # Reusable utilities
├── helpers/                # Socket, Redis, and Email helpers
└── types/                  # Global TypeScript definitions
```

## ⚙️ Installation

1. **Clone & Install:**
   ```bash
   pnpm install
   ```

2. **Environment Setup:**
   ```bash
   cp .example.env .env
   # Update .env with DATABASE_URL, REDIS_URL, and JWT_SECRET
   ```

3. **Database Migration:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

## 💻 Available Scripts

- `pnpm dev`: Start development server with hot-reloading (`tsx watch`).
- `pnpm start`: Run the server directly using `tsx`.
- `pnpm build`: Compile TypeScript to `dist`.
- `pnpm start:prod`: Run the production build from `dist`.

## 📝 Development Guidelines

Refer to [instructions.md](./instructions.md) for detailed coding standards, naming conventions, and the "Saturday Lockdown" implementation details.
