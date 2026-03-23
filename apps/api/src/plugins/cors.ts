import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "@void/config";

export async function registerCors(app: FastifyInstance) {
  const env = loadEnv();
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? false : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
