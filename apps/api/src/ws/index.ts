import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";

export async function registerWebSocket(app: FastifyInstance) {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket, _request) => {
    app.log.info("WebSocket client connected");

    socket.send(
      JSON.stringify({
        event: "connection:established",
        data: { message: "Connected to The Void" },
        timestamp: new Date().toISOString(),
      }),
    );

    socket.on("message", (raw: Buffer) => {
      app.log.debug({ msg: "WS message received", data: raw.toString() });
    });

    socket.on("close", () => {
      app.log.info("WebSocket client disconnected");
    });
  });
}
