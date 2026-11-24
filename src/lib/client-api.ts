"use client";
/** fetch JSON same-origin com mensagens de erro legíveis. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(data?.details) ? `: ${data.details.join("; ")}` : "";
    throw new Error((data?.error ?? `Erro ${res.status}`) + details);
  }
  return data as T;
}
