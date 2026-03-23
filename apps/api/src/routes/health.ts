import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@void/types";

interface HealthData {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get<{ Reply: ApiResponse<HealthData> }>("/api/v1/health", async (_request, reply) => {
    const data: HealthData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "0.1.0",
    };

    return reply.status(200).send({ data });
  });
}
