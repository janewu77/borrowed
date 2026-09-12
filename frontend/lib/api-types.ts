/*
 * GENERATED CONTRACT STUB — do not edit by hand.
 *
 * It mirrors specs/BACKEND_SPEC.md until the FastAPI OpenAPI endpoint is
 * available. `npm run gen:types` is the only supported update path thereafter.
 */

export type ConversationRole = "borrower" | "lender";

export interface ConversationCreated {
  conversation_id: string;
  role: ConversationRole;
}

export type Reason =
  | "TOO_LATE_TO_SHIP"
  | "OUTSIDE_LENDER_WINDOW"
  | "OVERLAPS_BOOKING"
  | "IN_CLEANING"
  | "SIZE_MISMATCH"
  | "WRONG_CITY";

export interface Booking {
  id: string;
  garment_id: string;
  wear_from: string;
  wear_to: string;
  hold_from: string;
  hold_to: string;
}

export interface GarmentPublic {
  id: string;
  name: string;
  designer: string;
  category: "dress" | "jewellery" | "bag";
  silhouette: string | null;
  colour_family: string | null;
  occasion: string[];
  style_tags: string[];
  sizes_eu: number[];
  rental_price: number;
  rental_days: number;
  image: string;
  thumb: string;
  lender_id: string;
  lender_name: string;
  lender_rating: number;
  city: string;
  condition: string;
  description: string;
  bookings: Booking[];
}

export interface Feasibility {
  garment_id: string;
  feasible: boolean;
  ship_by: string | null;
  lands_on: string | null;
  wear_from: string;
  wear_to: string;
  free_again: string | null;
  reason: Reason | null;
  blocking_booking_id: string | null;
}

export interface SearchHit {
  garment: GarmentPublic;
  feasibility: Feasibility;
  score: number;
  reason?: string;
}

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

export interface BookingResult {
  booking_id: string;
  garment_id: string;
  ship_by: string;
  lands_on: string;
  wear_from: string;
  wear_to: string;
  free_again: string;
  payment_taken: false;
  status: "reserved";
  already_existed: boolean;
}

export type SseEvent =
  | { event: "token"; data: { text: string } }
  | { event: "question"; data: { text: string; fields: string[] } }
  | { event: "listing_draft"; data: { draft: ListingDraft } }
  | { event: "results"; data: { hits: SearchHit[]; relaxed: string | null } }
  | { event: "availability"; data: { feasibility: Feasibility; garment: GarmentPublic } }
  | { event: "booking_claim"; data: { booking: BookingResult } }
  | { event: "error"; data: { message: string; recoverable: boolean } }
  | { event: "done"; data: { conversation_id: string } };
