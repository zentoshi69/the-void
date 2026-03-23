export const StrategyStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  STOPPED: "stopped",
  FAILED: "failed",
  ARCHIVED: "archived",
} as const;
export type StrategyStatus = (typeof StrategyStatus)[keyof typeof StrategyStatus];

export const StrategyType = {
  MANUAL: "manual",
  ALGORITHMIC: "algorithmic",
  HYBRID: "hybrid",
} as const;
export type StrategyType = (typeof StrategyType)[keyof typeof StrategyType];

export const OrderStatus = {
  PENDING: "pending",
  SUBMITTED: "submitted",
  PARTIAL: "partial",
  FILLED: "filled",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  MARKET: "market",
  LIMIT: "limit",
  STOP: "stop",
  CONDITIONAL: "conditional",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderSide = {
  BUY: "buy",
  SELL: "sell",
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const PositionSide = {
  LONG: "long",
  SHORT: "short",
} as const;
export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide];

export const VenueType = {
  EXCHANGE: "exchange",
  OTC: "otc",
  SIMULATED: "simulated",
} as const;
export type VenueType = (typeof VenueType)[keyof typeof VenueType];

export const VenueStatus = {
  ONLINE: "online",
  DEGRADED: "degraded",
  OFFLINE: "offline",
} as const;
export type VenueStatus = (typeof VenueStatus)[keyof typeof VenueStatus];

export const SignalType = {
  TECHNICAL: "technical",
  FUNDAMENTAL: "fundamental",
  SENTIMENT: "sentiment",
  CUSTOM: "custom",
} as const;
export type SignalType = (typeof SignalType)[keyof typeof SignalType];

export const SimulationStatus = {
  CONFIGURING: "configuring",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type SimulationStatus = (typeof SimulationStatus)[keyof typeof SimulationStatus];

export const SimulationType = {
  BACKTEST: "backtest",
  REPLAY: "replay",
  SCENARIO: "scenario",
} as const;
export type SimulationType = (typeof SimulationType)[keyof typeof SimulationType];
