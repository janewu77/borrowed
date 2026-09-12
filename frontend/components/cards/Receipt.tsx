import type { BookingResult } from "../../lib/api-types";
import { fmtDay, fmtRange } from "../../lib/dates";

export function BookingReceipt({ booking }: { booking: BookingResult }) {
  return (
    <section className="receipt" role="status">
      <p className="receipt__label">reserved · no payment taken</p>
      <p className="receipt__detail">{booking.booking_id} · {booking.garment_id}</p>
      <h2 className="receipt__title">Your garment is reserved</h2>
      <p className="receipt__detail">Held for {fmtRange(booking.wear_from, booking.wear_to)}. It lands {fmtDay(booking.lands_on)}; ship by {fmtDay(booking.ship_by)}.</p>
    </section>
  );
}
