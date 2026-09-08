export type Video = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  videoId: string;
  category: string;
  isShowreel: boolean;
  createdAt?: string;
};
export type Category = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (import.meta.env.MODE === "demo")
    throw new Error("API indisponível na demonstração estática.");
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(!["GET", "HEAD"].includes(options.method || "GET")
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      Array.isArray(data?.message)
        ? data.message.join(" ")
        : data?.message || "Não foi possível concluir a solicitação.",
      response.status,
    );
  if (data === null) throw new Error("Não foi possível conectar ao servidor.");
  return data;
}
