import type { Reason } from "./api-types";

const reasonCopy: Record<Reason, string> = {
  TOO_LATE_TO_SHIP: "can't arrive in time",
  OUTSIDE_LENDER_WINDOW: "outside the lender's dates",
  OVERLAPS_BOOKING: "already booked for those days",
  IN_CLEANING: "still in cleaning",
  SIZE_MISMATCH: "not in your size",
  WRONG_CITY: "not in Hamburg",
};

export function reasonLabel(reason: string | null | undefined): string | null {
  return reason && reason in reasonCopy ? reasonCopy[reason as Reason] : null;
}
