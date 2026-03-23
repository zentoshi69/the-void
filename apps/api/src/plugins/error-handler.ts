import type { FastifyInstance, FastifyError } from "fastify";
import type { ApiError } from "@void/types";

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    const body: ApiError = {
      error: {
        code: error.code ?? "INTERNAL_ERROR",
        message:
          statusCode >= 500 && app.log.level !== "debug"
            ? "An unexpected error occurred"
            : error.message,
      },
    };

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = {
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    };
    return reply.status(404).send(body);
  });
}
