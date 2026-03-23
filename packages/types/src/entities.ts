import type {
  StrategyStatus,
  StrategyType,
  OrderStatus,
  OrderType,
  OrderSide,
  PositionSide,
  VenueType,
  VenueStatus,
  SignalType,
  SimulationStatus,
  SimulationType,
} from "./enums.js";

export interface Vault {
  id: string;
  balances: VaultBalance[];
  updatedAt: string;
}

export interface VaultBalance {
  asset: string;
  balance: string;
  reserved: string;
  available: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  status: StrategyStatus;
  parameters: Record<string, unknown>;
  allocatedCapital: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  asset: string;
  pair: string;
  side: PositionSide;
  size: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  openedAt: string;
  updatedAt: string;
  sourceStrategyId: string;
}

export interface Order {
  id: string;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  price: string;
  quantity: string;
  filledQuantity: string;
  venueId: string;
  sourceStrategyId: string;
  createdAt: string;
  submittedAt: string | null;
  lastUpdateAt: string;
  completedAt: string | null;
}

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  status: VenueStatus;
  supportedPairs: string[];
  feeSchedule: Record<string, string>;
}

export interface Market {
  pair: string;
  venues: string[];
  ticker: Ticker;
}

export interface Ticker {
  last: string;
  bid: string;
  ask: string;
  volume24h: string;
  timestamp: string;
}

export interface Signal {
  id: string;
  type: SignalType;
  source: string;
  confidence: number;
  timestamp: string;
  payload: Record<string, unknown>;
  linkedStrategyIds: string[];
}

export interface Simulation {
  id: string;
  name: string;
  type: SimulationType;
  status: SimulationStatus;
  config: Record<string, unknown>;
  results: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: {
    userId: string;
    role: string;
    ip: string;
  };
  action: string;
  target: {
    entityType: string;
    entityId: string;
  };
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}
