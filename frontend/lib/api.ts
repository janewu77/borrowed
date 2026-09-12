import type { ConversationCreated, ConversationRole, Feasibility, GarmentPublic, SearchHit } from "./api-types";

const productionApiOrigin = "http://127.0.0.1:8000";
const apiBase = (
  typeof window === "undefined"
    ? process.env.API_ORIGIN ?? productionApiOrigin
    : process.env.NEXT_PUBLIC_API_BASE ?? ""
).replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

/** Resolves an image served by FastAPI without exposing another configuration knob. */
export function apiAssetUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : apiUrl(path);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "detail" in body
    ? String(body.detail)
    : `Request failed (${response.status})`;
  return new ApiError(message, response.status, body);
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export function createConversation(role: ConversationRole, signal?: AbortSignal) {
  return fetchApi<ConversationCreated>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ role }),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

export function getGarment(id: string) {
  return fetchApi<GarmentPublic>(`/api/garments/${encodeURIComponent(id)}`, { cache: "no-store" });
}

export function getAvailability(id: string, wear: string, options?: {
  returnDate?: string;
  city?: string;
  sizesEu?: number[];
}) {
  const query = new URLSearchParams({ wear, city: options?.city ?? "Hamburg" });
  for (const size of options?.sizesEu ?? []) query.append("sizes_eu", String(size));
  if (options?.returnDate) query.set("return", options.returnDate);
  return fetchApi<Feasibility>(`/api/garments/${encodeURIComponent(id)}/availability?${query}`, {
    cache: "no-store",
  });
}

/** Stage 1 production API: deterministic catalogue search. */
export function searchGarments(request: {
  city: string;
  wear_date: string;
  return_date?: string | null;
  sizes_eu?: number[];
  category?: "dress" | "jewellery" | "bag";
  occasion?: string | null;
  colour_family?: string | null;
  style_hints?: string[];
  max_price?: number | null;
  limit?: number;
}) {
  return fetchApi<SearchHit[]>("/api/garments/search", {
    method: "POST",
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
  });
}

/** Stage 1 production API: create an idempotent reservation. */
export function createBooking(request: {
  city: string;
  wear_date: string;
  return_date?: string | null;
  sizes_eu: number[];
  garment_id: string;
  borrower_name?: string | null;
  idempotency_key: string;
}) {
  return fetchApi<import("./api-types").BookingResult>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
  });
}

export function getLenderGarments(lenderId: string) {
  return fetchApi<Array<{ garment: GarmentPublic; next_hold: { ship_by: string } | null }>>(
    `/api/lender/${encodeURIComponent(lenderId)}/garments`,
    { cache: "no-store" },
  );
}

export function publishListing(id: string) {
  return fetchApi<{ garment_id: string; ship_by_hint: string | null }>(
    `/api/listings/${encodeURIComponent(id)}/publish`,
    { method: "POST" },
  );
}
