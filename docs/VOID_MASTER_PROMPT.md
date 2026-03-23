# The Void — Master Prompt

> The room where capital waits for orders.

---

## 1. Product Identity

**The Void** is a premium private capital command platform. It is an operator-grade system built for people who manage real capital across markets, strategies, and venues.

### What The Void IS

- A capital overview and command center
- A market intelligence and opportunity evaluation surface
- A strategy control and inventory management system
- A risk control and execution lifecycle platform
- A replay/lab simulation environment
- An audit and admin governance layer

### What The Void is NOT

- Not a retail exchange or consumer trading app
- Not a crypto wallet or portfolio tracker
- Not a generic admin panel or SaaS dashboard
- Not a toy, prototype-looking demo, or hackathon project

### Core Principles

| Principle | Meaning |
|---|---|
| **Operator-first** | Every screen, every interaction is designed for someone who commands capital — not someone browsing casually. |
| **Clarity over decoration** | Dense information, but never confusing. Every element earns its space. |
| **Control over convenience** | Explicit actions, explicit states. No auto-magic. The operator decides. |
| **Explainability** | Every number, state, and action can be traced. Nothing is a black box. |
| **Premium execution** | The product feels like institutional infrastructure, not a startup MVP. |

---

## 2. Target Users

| Role | Description | Primary Concerns |
|---|---|---|
| **Operator** | Core platform user. Commands capital allocation, monitors positions, triggers executions. | Capital state, position health, execution outcomes, risk exposure. |
| **Treasury User** | Manages vault balances, fund flows, and capital reserves. | Inflows/outflows, reserve ratios, allocation to strategies, liquidity. |
| **Analyst** | Evaluates market opportunities, reviews strategy performance, builds simulations. | Market data quality, strategy backtests, scenario modeling, signal clarity. |
| **Strategy User** | Designs and manages automated or semi-automated trading strategies. | Strategy lifecycle, parameter tuning, execution fidelity, P&L attribution. |
| **Admin** | Governs access, audits actions, manages system configuration. | Audit trails, role permissions, system health, compliance. |

---

## 3. Domain Model

### 3.1 Core Entities

```
Vault
├── balance (by asset)
├── reserved (locked in active strategies/orders)
├── available (balance - reserved)
└── history (all mutations with audit trail)

Strategy
├── id, name, description
├── type (manual | algorithmic | hybrid)
├── status (draft → active → paused → stopped → archived)
├── parameters (strategy-specific config)
├── allocated_capital
├── positions[] → Position
├── orders[] → Order
└── performance (P&L, drawdown, Sharpe, etc.)

Position
├── asset / pair
├── side (long | short)
├── size, entry_price, current_price
├── unrealized_pnl, realized_pnl
├── opened_at, updated_at
└── source_strategy → Strategy

Order
├── id, type (market | limit | stop | conditional)
├── side (buy | sell)
├── status (pending → submitted → partial → filled → cancelled → rejected)
├── price, quantity, filled_quantity
├── venue → Venue
├── timestamps (created, submitted, last_update, completed)
└── source_strategy → Strategy

Venue
├── id, name, type (exchange | OTC | simulated)
├── status (online | degraded | offline)
├── supported_pairs[]
├── fee_schedule
└── connector_config

Market
├── pair (e.g. BTC/USD)
├── venues[] (where this pair is tradeable)
├── orderbook_snapshot
├── ticker (last, bid, ask, volume_24h)
├── candles (OHLCV by timeframe)
└── signals[] → Signal

Signal
├── id, type (technical | fundamental | sentiment | custom)
├── source, confidence, timestamp
├── payload (indicator values, news, etc.)
└── linked_strategies[]

Simulation
├── id, name, type (backtest | replay | scenario)
├── config (timerange, initial_capital, strategies, market_data_source)
├── status (configuring → running → completed → failed)
├── results (equity_curve, trades[], metrics)
└── comparison_baseline

AuditEvent
├── id, timestamp
├── actor (user_id, role, ip)
├── action (e.g. "strategy.activate", "order.submit", "vault.withdraw")
├── target (entity_type, entity_id)
├── before_state, after_state
└── metadata
```

### 3.2 Lifecycle State Machines

**Strategy Lifecycle:**
```
draft → active → paused ⇄ active → stopped → archived
                                 ↘ failed → archived
```

**Order Lifecycle:**
```
pending → submitted → partial_fill → filled
                   ↘ cancelled
                   ↘ rejected
```

**Simulation Lifecycle:**
```
configuring → running → completed
                     ↘ failed
```

### 3.3 Key Relationships

- A **Vault** funds one or more **Strategies**.
- A **Strategy** generates **Orders** against **Venues**.
- An **Order** may produce or modify **Positions**.
- **Markets** aggregate data across **Venues** for a given pair.
- **Signals** inform **Strategies** or surface to **Analysts**.
- Every mutation to any entity produces an **AuditEvent**.

---

## 4. System Architecture

### 4.1 Monorepo Structure

```
the-void/
├── apps/
│   ├── web/                  # Frontend — Next.js / React
│   │   ├── app/              # App router pages
│   │   ├── components/       # UI components
│   │   │   ├── ui/           # Primitive design system components
│   │   │   ├── layout/       # Shell, sidebar, topbar, panels
│   │   │   ├── capital/      # Vault, balances, allocation views
│   │   │   ├── markets/      # Tickers, orderbooks, charts
│   │   │   ├── strategies/   # Strategy cards, lifecycle, config
│   │   │   ├── orders/       # Order tables, forms, status
│   │   │   ├── positions/    # Position grids, P&L
│   │   │   ├── risk/         # Exposure, limits, alerts
│   │   │   ├── simulation/   # Backtest, replay, scenario lab
│   │   │   └── admin/        # Audit log, users, settings
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Client utilities, API client, websocket
│   │   ├── stores/           # Client state (Zustand or similar)
│   │   └── styles/           # Global styles, design tokens
│   │
│   └── api/                  # Backend — Node.js / Fastify or Express
│       ├── src/
│       │   ├── routes/       # Thin route handlers
│       │   ├── controllers/  # Request validation, delegation to services
│       │   ├── services/     # Core business logic
│       │   │   ├── vault/
│       │   │   ├── strategy/
│       │   │   ├── order/
│       │   │   ├── market/
│       │   │   ├── simulation/
│       │   │   ├── risk/
│       │   │   └── audit/
│       │   ├── connectors/   # Venue adapters (real + simulated)
│       │   ├── ws/           # WebSocket event system
│       │   ├── db/           # Database access, migrations, seeds
│       │   ├── jobs/         # Background tasks, schedulers
│       │   └── middleware/   # Auth, logging, rate limiting
│       └── tests/
│
├── packages/
│   ├── types/                # Shared TypeScript types & enums
│   ├── utils/                # Shared utility functions
│   ├── validators/           # Shared Zod schemas / validation
│   └── config/               # Shared configuration constants
│
├── docs/                     # Project documentation
├── scripts/                  # Dev/build/deploy scripts
├── .cursor/rules/            # AI agent rules
├── turbo.json                # Turborepo config
├── package.json              # Root workspace config
└── tsconfig.base.json        # Shared TS config
```

### 4.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend framework** | Next.js 14+ (App Router) | Server components, file-based routing, strong ecosystem. |
| **UI library** | React 18+ | Industry standard, composable, large talent pool. |
| **Styling** | Tailwind CSS + custom design tokens | Utility-first, fast iteration, consistent with token system. |
| **Component primitives** | Radix UI or shadcn/ui (customized) | Accessible, unstyled primitives that respect our visual system. |
| **Charts** | Lightweight Charts (TradingView) or Recharts | Financial-grade charting for orderbooks, candles, equity curves. |
| **Client state** | Zustand | Minimal, typed, no boilerplate. |
| **Data fetching** | TanStack Query (React Query) | Caching, background refetch, optimistic updates. |
| **WebSocket client** | Native WebSocket + custom hook | Real-time tickers, order updates, vault changes. |
| **Backend framework** | Fastify (or Express) | Fast, typed, plugin-based. |
| **Validation** | Zod | Runtime + compile-time type safety, shared with frontend. |
| **Database** | PostgreSQL | ACID, relational, excellent for financial data. |
| **ORM** | Drizzle ORM or Prisma | Type-safe queries, migrations, schema introspection. |
| **Auth** | JWT + refresh tokens (or session-based) | Stateless, auditable, role-based. |
| **Real-time** | WebSocket server (ws or Fastify plugin) | Push updates for prices, order status, vault changes. |
| **Task queue** | BullMQ (Redis-backed) | Background jobs: simulations, data ingestion, reconciliation. |
| **Monorepo tooling** | Turborepo + pnpm workspaces | Fast builds, shared packages, dependency hoisting. |
| **Testing** | Vitest + Testing Library + Supertest | Fast, TypeScript-native, component + API testing. |

### 4.3 Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (apps/web)                       │
│                                                                  │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Stores  │←→│  Hooks   │←→│   API    │←→│  WebSocket Client│ │
│  │(Zustand)│  │(TanStack)│  │ Client   │  │  (live events)   │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│       ↕                          ↕                  ↕           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    React Components                         ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                         ↕ HTTP/REST         ↕ WebSocket
┌──────────────────────────────────────────────────────────────────┐
│                        BACKEND (apps/api)                        │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Routes  │→ │Controllers │→ │  Services  │→ │ Connectors │  │
│  │  (thin)  │  │(validate)  │  │  (logic)   │  │ (venues)   │  │
│  └──────────┘  └────────────┘  └────────────┘  └────────────┘  │
│                                      ↕               ↕          │
│                               ┌────────────┐  ┌────────────┐   │
│                               │  Database  │  │  External  │   │
│                               │ (Postgres) │  │   APIs     │   │
│                               └────────────┘  └────────────┘   │
│                                      ↕                          │
│                               ┌────────────┐                    │
│                               │   Audit    │                    │
│                               │   Log      │                    │
│                               └────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Module Breakdown

### 5.1 Capital Overview (Vault)

**Purpose:** Single source of truth for all capital state.

| Feature | Description |
|---|---|
| Balance dashboard | Total, available, reserved — broken down by asset. |
| Allocation view | Where capital is deployed (by strategy, by venue). |
| Fund flow history | Deposits, withdrawals, internal transfers — full audit trail. |
| Reserve ratio monitoring | How much is liquid vs. locked. Threshold alerts. |

**Key API endpoints:**
- `GET /api/vault/balances` — Current balances by asset
- `GET /api/vault/allocations` — Capital deployed per strategy
- `GET /api/vault/history` — Paginated fund flow events
- `POST /api/vault/transfer` — Internal capital transfer between strategies

**WebSocket events:**
- `vault:balance_update` — Real-time balance change
- `vault:transfer_complete` — Transfer confirmed

---

### 5.2 Market Intelligence

**Purpose:** Aggregated market data, signals, and opportunity surface.

| Feature | Description |
|---|---|
| Ticker board | Real-time prices across all tracked pairs and venues. |
| Orderbook viewer | Depth visualization for selected pairs. |
| Candle charts | OHLCV charts with multiple timeframes and overlays. |
| Signal feed | Incoming signals (technical, fundamental, sentiment) with confidence scores. |
| Venue status | Connectivity and health status of all connected venues. |

**Key API endpoints:**
- `GET /api/markets/tickers` — All tracked tickers
- `GET /api/markets/:pair/orderbook` — Orderbook snapshot
- `GET /api/markets/:pair/candles?timeframe=1h` — OHLCV data
- `GET /api/markets/signals` — Recent signals
- `GET /api/venues/status` — Venue health

**WebSocket events:**
- `market:ticker` — Price update
- `market:orderbook` — Orderbook delta
- `market:signal` — New signal arrived
- `venue:status_change` — Venue connectivity change

---

### 5.3 Strategy Control

**Purpose:** Full lifecycle management of capital deployment strategies.

| Feature | Description |
|---|---|
| Strategy list | All strategies with status, performance summary, allocated capital. |
| Strategy detail | Full config, parameters, linked positions, order history, P&L. |
| Lifecycle controls | Activate, pause, resume, stop, archive — with confirmation. |
| Parameter editor | Edit strategy parameters with validation and dry-run preview. |
| Performance metrics | P&L, drawdown, Sharpe ratio, win rate, avg trade duration. |

**Key API endpoints:**
- `GET /api/strategies` — List all strategies
- `GET /api/strategies/:id` — Strategy detail
- `POST /api/strategies` — Create strategy
- `PATCH /api/strategies/:id` — Update config/parameters
- `POST /api/strategies/:id/activate` — Lifecycle transition
- `POST /api/strategies/:id/pause`
- `POST /api/strategies/:id/stop`
- `GET /api/strategies/:id/performance` — Performance metrics

**WebSocket events:**
- `strategy:status_change` — Lifecycle transition
- `strategy:performance_update` — Metrics refresh

---

### 5.4 Order Management

**Purpose:** Full visibility into the execution pipeline.

| Feature | Description |
|---|---|
| Order blotter | Live table of all orders with filtering, sorting, status badges. |
| Order detail | Full order lifecycle: timestamps, fills, venue response. |
| Manual order entry | Form for placing manual orders against a venue. |
| Order cancellation | Cancel pending/submitted orders with confirmation. |
| Fill history | All executed fills with price, quantity, fees. |

**Key API endpoints:**
- `GET /api/orders` — List orders (filterable by status, strategy, venue)
- `GET /api/orders/:id` — Order detail with fills
- `POST /api/orders` — Submit new order
- `POST /api/orders/:id/cancel` — Cancel order
- `GET /api/orders/:id/fills` — Fill history

**WebSocket events:**
- `order:status_change` — Order state transition
- `order:fill` — New fill received
- `order:rejected` — Order rejected by venue

---

### 5.5 Position Management

**Purpose:** Real-time view of all open exposure.

| Feature | Description |
|---|---|
| Position grid | All open positions with size, entry, current, P&L. |
| Position detail | Full history: how it was opened, partial closes, linked orders. |
| Aggregated view | Exposure by asset, by strategy, by venue. |
| Close position | Manual close with order type selection. |

**Key API endpoints:**
- `GET /api/positions` — All open positions
- `GET /api/positions/:id` — Position detail
- `GET /api/positions/exposure` — Aggregated exposure
- `POST /api/positions/:id/close` — Close position

**WebSocket events:**
- `position:update` — Price/P&L change
- `position:closed` — Position fully closed

---

### 5.6 Risk Control

**Purpose:** Exposure monitoring, limit enforcement, and alerting.

| Feature | Description |
|---|---|
| Exposure dashboard | Total exposure by asset, strategy, venue. Drawdown tracking. |
| Risk limits | Configurable limits (max position size, max drawdown, concentration). |
| Alert system | Threshold breaches trigger alerts (UI, potentially webhook/email). |
| Kill switch | Emergency stop: halt all strategies, cancel all pending orders. |
| Risk report | Downloadable/viewable risk snapshot at a point in time. |

**Key API endpoints:**
- `GET /api/risk/exposure` — Current exposure summary
- `GET /api/risk/limits` — Active risk limits
- `PUT /api/risk/limits` — Update limits
- `GET /api/risk/alerts` — Recent alerts
- `POST /api/risk/kill-switch` — Emergency stop

**WebSocket events:**
- `risk:alert` — Limit breached
- `risk:exposure_update` — Exposure change

---

### 5.7 Simulation Lab

**Purpose:** Backtest strategies, replay historical scenarios, run what-if analysis.

| Feature | Description |
|---|---|
| Backtest runner | Run a strategy against historical data. Configure timerange, capital, fees. |
| Replay mode | Step through historical market events and see strategy behavior. |
| Scenario builder | What-if: modify parameters, inject events, compare outcomes. |
| Results viewer | Equity curve, trade log, metrics comparison against baseline. |
| Saved simulations | Library of past simulations with results. |

**Key API endpoints:**
- `POST /api/simulations` — Create and start simulation
- `GET /api/simulations/:id` — Simulation status and results
- `GET /api/simulations` — List saved simulations
- `POST /api/simulations/:id/replay/step` — Advance replay one step
- `DELETE /api/simulations/:id` — Remove simulation

**WebSocket events:**
- `simulation:progress` — Simulation progress update
- `simulation:complete` — Simulation finished

---

### 5.8 Audit & Admin

**Purpose:** Full governance, access control, and system administration.

| Feature | Description |
|---|---|
| Audit log | Every action in the system, searchable, filterable, exportable. |
| User management | Create/edit users, assign roles, deactivate accounts. |
| Role-based access | Operator, Treasury, Analyst, Strategy, Admin — granular permissions. |
| System settings | Global config: default venues, fee overrides, notification preferences. |
| System health | API uptime, database status, queue depth, connector status. |

**Key API endpoints:**
- `GET /api/audit/events` — Paginated audit log
- `GET /api/admin/users` — User list
- `POST /api/admin/users` — Create user
- `PATCH /api/admin/users/:id` — Update user/role
- `GET /api/admin/settings` — System settings
- `PUT /api/admin/settings` — Update settings
- `GET /api/admin/health` — System health check

---

## 6. Visual System

### 6.1 Design Philosophy

The Void's visual language is **light luxury** — a warm, refined aesthetic that communicates institutional seriousness without the cold sterility of typical fintech dashboards. Every pixel should feel intentional.

### 6.2 Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--void-bg-primary` | `#FAF9F6` | Main background. Warm off-white. |
| `--void-bg-secondary` | `#F5F3EE` | Cards, panels, elevated surfaces. Subtle cream. |
| `--void-bg-tertiary` | `#EDEAE3` | Borders, dividers, hover states. |
| `--void-text-primary` | `#1A1035` | Primary text. Super dark purple, not black. |
| `--void-text-secondary` | `#4A4060` | Secondary text. Muted purple. |
| `--void-text-tertiary` | `#7A7490` | Captions, timestamps, disabled. |
| `--void-accent-primary` | `#E8650A` | Primary actions, emphasis, CTAs. Bright refined orange. |
| `--void-accent-primary-hover` | `#D05A08` | Hover state for primary accent. |
| `--void-positive` | `#0DB88E` | Profit, healthy, active, success. Mint-cyan. |
| `--void-negative` | `#D9344F` | Loss, error, danger, critical alerts. |
| `--void-warning` | `#E8A817` | Warnings, approaching thresholds. Warm amber. |
| `--void-neutral` | `#6B7280` | Neutral states, paused, pending. |
| `--void-border` | `#E5E2DB` | Default borders. Warm gray. |
| `--void-border-strong` | `#D1CCC2` | Emphasized borders, focused inputs. |
| `--void-shadow` | `rgba(26, 16, 53, 0.06)` | Subtle card shadows. |

### 6.3 Typography

| Token | Value |
|---|---|
| Font family | Inter (or similar clean sans-serif) |
| Monospace | JetBrains Mono (for numbers, code, IDs) |
| Base size | 14px |
| Line height | 1.5 (body), 1.2 (headings) |
| Weight — normal | 400 |
| Weight — medium | 500 |
| Weight — semibold | 600 |
| Weight — bold | 700 |
| Numbers in tables | Tabular nums, monospace, right-aligned |

### 6.4 Component Patterns

| Component | Style |
|---|---|
| **Cards** | `bg-secondary`, `border`, `shadow`, rounded-lg. No harsh outlines. |
| **Tables** | Dense but readable. Alternating row tints. Sticky headers. Monospace numbers. Right-aligned numeric columns. |
| **Buttons — primary** | `accent-primary` bg, white text, subtle shadow. Rounded-md. |
| **Buttons — secondary** | `bg-secondary`, `text-primary`, border. |
| **Buttons — danger** | `negative` bg, white text. Used sparingly (kill switch, delete). |
| **Status badges** | Rounded-full pills. Color-coded by state. Subtle bg with matching text. |
| **Inputs** | `bg-primary`, `border`, rounded-md. Focus ring in `accent-primary`. |
| **Sidebar** | `bg-secondary`, fixed width. Active item uses `accent-primary` left border. |
| **Modals** | Centered, backdrop blur, `bg-primary`, generous padding. |
| **Charts** | Dark gridlines on cream bg. Orange for primary series. Mint for profit. Red for loss. |

### 6.5 Layout

- **Shell:** Fixed sidebar (240px) + topbar (56px) + main content area.
- **Content width:** Max 1440px, centered on ultrawide screens.
- **Spacing scale:** 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- **Grid:** 12-column for dashboards. Cards snap to grid.
- **Responsive:** Desktop-first. Minimum supported width: 1280px. This is an operator tool, not a mobile app.

---

## 7. Backend Design

### 7.1 API Conventions

| Convention | Rule |
|---|---|
| Base path | `/api/v1/` |
| Auth | Bearer token in `Authorization` header. |
| Content type | `application/json` everywhere. |
| Pagination | `?page=1&limit=50` with response envelope: `{ data, meta: { page, limit, total } }` |
| Filtering | Query params: `?status=active&venue=binance` |
| Sorting | `?sort=created_at&order=desc` |
| Errors | `{ error: { code, message, details? } }` with appropriate HTTP status. |
| Timestamps | ISO 8601, always UTC. |
| IDs | UUIDs (v4) for all entities. |

### 7.2 Response Envelope

```typescript
interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface ApiError {
  error: {
    code: string;          // e.g. "STRATEGY_NOT_FOUND", "INSUFFICIENT_BALANCE"
    message: string;       // Human-readable
    details?: unknown;     // Optional structured details
  };
}
```

### 7.3 WebSocket Protocol

```typescript
interface WsMessage<T = unknown> {
  event: string;           // e.g. "vault:balance_update"
  data: T;
  timestamp: string;       // ISO 8601
  sequence?: number;       // For ordering guarantees
}

interface WsSubscription {
  action: "subscribe" | "unsubscribe";
  channels: string[];      // e.g. ["vault", "market:BTC/USD", "orders"]
}
```

### 7.4 Database Schema Principles

- Every table has `id` (UUID), `created_at`, `updated_at`.
- Soft deletes where appropriate (`deleted_at`).
- Status fields use PostgreSQL enums.
- All monetary values stored as `DECIMAL(20, 8)` — never floats.
- Foreign keys enforced. Indexes on all query-path columns.
- Audit events in append-only table with no updates/deletes.

### 7.5 Venue Connectors

```typescript
interface VenueConnector {
  id: string;
  name: string;
  type: "live" | "simulated";

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): VenueStatus;

  getTicker(pair: string): Promise<Ticker>;
  getOrderbook(pair: string): Promise<Orderbook>;
  getCandles(pair: string, timeframe: string): Promise<Candle[]>;

  submitOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<void>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;

  onTicker(pair: string, callback: (ticker: Ticker) => void): void;
  onOrderUpdate(callback: (update: OrderUpdate) => void): void;
}
```

For MVP, all connectors are **simulated** — they produce plausible data using realistic models, not random noise. Simulated connectors must:
- Generate orderbooks with realistic spread and depth
- Produce candles that follow plausible price action
- Fill orders with simulated latency and partial fills
- Respect fee schedules

---

## 8. Implementation Phases

### Phase 0 — Foundation

**Goal:** Monorepo scaffolding, shared packages, design system primitives, basic API shell.

- [ ] Initialize monorepo (pnpm workspaces + Turborepo)
- [ ] Create `apps/web` (Next.js), `apps/api` (Fastify/Express)
- [ ] Create `packages/types`, `packages/utils`, `packages/validators`, `packages/config`
- [ ] Set up shared `tsconfig.base.json`
- [ ] Set up Tailwind with full design token system (colors, typography, spacing)
- [ ] Build primitive UI components: Button, Card, Table, Badge, Input, Modal, Sidebar
- [ ] Build app shell: sidebar navigation, topbar, main content layout
- [ ] Set up API with health endpoint, error handling, CORS, logging
- [ ] Set up PostgreSQL connection, migration system, seed framework
- [ ] Set up WebSocket server skeleton
- [ ] Verification: app compiles, shell renders, API responds, DB connects

### Phase 1 — Capital & Markets

**Goal:** Vault dashboard with balances + market data surface.

- [ ] Vault service: balance queries, allocation queries, fund flow history
- [ ] Vault API endpoints
- [ ] Vault UI: balance dashboard, allocation view, history table
- [ ] Market data service: tickers, orderbook, candles (from simulated connector)
- [ ] Simulated venue connector (first version)
- [ ] Market API endpoints
- [ ] Market UI: ticker board, orderbook viewer, candle chart
- [ ] WebSocket: vault updates, market tickers
- [ ] Verification: vault shows balances, markets show live-ish data

### Phase 2 — Strategy & Orders

**Goal:** Strategy CRUD, lifecycle management, order submission and tracking.

- [ ] Strategy service: CRUD, lifecycle state machine, parameter management
- [ ] Strategy API endpoints
- [ ] Strategy UI: list, detail, lifecycle controls, parameter editor
- [ ] Order service: submission, cancellation, status tracking, fill recording
- [ ] Order API endpoints
- [ ] Order UI: blotter, detail, manual order form
- [ ] Simulated order execution (connector fills orders with realistic behavior)
- [ ] WebSocket: strategy status, order updates, fills
- [ ] Verification: can create strategy, submit order, see it fill

### Phase 3 — Positions & Risk

**Goal:** Position tracking from fills, risk exposure monitoring, limits.

- [ ] Position service: derive from fills, track P&L, aggregate exposure
- [ ] Position API endpoints
- [ ] Position UI: grid, detail, aggregated exposure view
- [ ] Risk service: exposure calculation, limit enforcement, alerting
- [ ] Risk API endpoints
- [ ] Risk UI: exposure dashboard, limit config, alert feed, kill switch
- [ ] WebSocket: position updates, risk alerts
- [ ] Verification: positions appear from fills, risk limits trigger alerts

### Phase 4 — Simulation Lab

**Goal:** Backtest and replay infrastructure.

- [ ] Simulation service: backtest engine, replay controller, result storage
- [ ] Historical data seeding (realistic simulated history)
- [ ] Simulation API endpoints
- [ ] Simulation UI: config builder, progress viewer, results with equity curve
- [ ] Replay mode: step-through historical events
- [ ] Comparison view: sim results vs. baseline
- [ ] Verification: can run backtest, see results, replay events

### Phase 5 — Audit & Admin

**Goal:** Full audit trail, user management, system governance.

- [ ] Audit service: event recording (integrated from Phase 0+), querying, export
- [ ] Admin service: user CRUD, role assignment, settings management
- [ ] Auth system: login, JWT, refresh, role-based middleware
- [ ] Audit UI: searchable log with filters and export
- [ ] Admin UI: user list, role editor, system settings, health dashboard
- [ ] Verification: all actions produce audit events, roles restrict access

### Phase 6 — Polish & Hardening

**Goal:** Production-quality refinement.

- [ ] Performance optimization (query tuning, caching, lazy loading)
- [ ] Error boundaries and graceful degradation in UI
- [ ] Comprehensive input validation (Zod schemas on all endpoints)
- [ ] E2E test coverage for critical paths
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)
- [ ] Documentation: API reference, deployment guide
- [ ] Verification: no unhandled errors, all flows tested, docs complete

---

## 9. Rules of Engagement

These rules govern how any AI agent or developer works on The Void.

### 9.1 Before Writing Code

1. **Inspect the repo.** Read relevant files. Understand what exists.
2. **State the phase.** Declare which phase and which specific task you are working on.
3. **Summarize the plan.** What will you create, modify, or connect? What will you NOT touch?

### 9.2 While Writing Code

1. **Change only what is necessary.** Do not refactor unrelated code.
2. **Keep files small.** If a file exceeds ~300 lines, split it.
3. **Types are law.** Every entity, API request, API response, and WebSocket message has a shared type.
4. **No dead code.** Don't leave unused imports, commented-out blocks, or TODO placeholders that will never be addressed.
5. **Naming is design.** Names should be clear enough to read without comments.

### 9.3 After Writing Code

1. **Verify compilation.** Code must compile with zero errors.
2. **Verify imports.** Every import must resolve.
3. **Verify registration.** Routes, modules, and providers must be properly registered.
4. **State what was done.** Summarize changes and any known limitations.
5. **Provide a checklist.** List what can be verified (manually or with tests).

### 9.4 Absolute Prohibitions

- Do NOT generate fake "production" data that implies live connections.
- Do NOT create god files that handle everything.
- Do NOT duplicate type definitions across packages.
- Do NOT use `any` type unless absolutely unavoidable (and document why).
- Do NOT add dependencies without justification.
- Do NOT style the UI like a generic SaaS template or crypto gambling site.
- Do NOT skip error handling.
- Do NOT auto-commit or push without explicit instruction.

---

## 10. Glossary

| Term | Definition |
|---|---|
| **The Void** | The product. The room where capital waits for orders. |
| **Vault** | The capital store. Tracks all balances, reserves, and allocation. |
| **Strategy** | A defined approach to deploying capital. Can be manual or algorithmic. |
| **Position** | An open exposure in a market, resulting from executed orders. |
| **Venue** | An external or simulated market where orders are executed. |
| **Connector** | An adapter that interfaces with a venue's API. |
| **Signal** | A piece of market intelligence that may inform strategy decisions. |
| **Blotter** | A live table of orders or trades. |
| **Kill Switch** | Emergency control that halts all strategies and cancels pending orders. |
| **Simulation** | A controlled environment for testing strategies against historical or synthetic data. |
| **Audit Event** | An immutable record of an action taken in the system. |
