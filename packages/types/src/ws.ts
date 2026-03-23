export interface WsMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
  sequence?: number;
}

export interface WsSubscription {
  action: "subscribe" | "unsubscribe";
  channels: string[];
}
