import type { ApiResponse, ApiError } from "@void/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const body = (await res.json()) as ApiError;
      throw new Error(body.error.message);
    }

    return res.json() as Promise<ApiResponse<T>>;
  }

  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!res.ok) {
      const body = (await res.json()) as ApiError;
      throw new Error(body.error.message);
    }

    return res.json() as Promise<ApiResponse<T>>;
  }
}

export const apiClient = new ApiClient();
