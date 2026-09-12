import type { components } from "./openapi.generated";

type Schemas = components["schemas"];
export type ConversationRole = "borrower" | "lender";
export type ConversationCreated = { conversation_id: string; role: ConversationRole };
export type Reason = Schemas["Reason"];
export type GarmentPublic = Schemas["GarmentPublic"];
export type Feasibility = Schemas["Feasibility"];
export type SearchHit = Schemas["SearchHit"];
export type BookingResult = Schemas["BookingResult"];
export type Turn = Schemas["Turn"];
type Envelope<T> = T extends { event?: infer E } ? { event: E; data: Omit<T, "event"> } : never;
export type SseEvent = Envelope<Schemas["BorrowerEvent"]>;

// Legacy lender views remain outside the borrower implementation.
export interface ListingDraft {
  listing_id?: string;
  image?: string;
  name: string;
  category: "dress" | "jewellery" | "bag";
  colour_family: string | null;
  silhouette: string | null;
  occasion: string[];
  formality: number;
  style_tags: string[];
  sizes_eu: number[];
  rental_price: number;
  condition: string;
  description: string;
  provenance: Record<string, "vision" | "user">;
  size_unverified: boolean;
  ready?: boolean;
}
