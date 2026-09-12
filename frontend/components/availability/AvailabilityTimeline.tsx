import type { Feasibility, GarmentPublic } from "../../lib/api-types";
import { fmtDay, fmtRange } from "../../lib/dates";

export function AvailabilityTimeline({ feasibility, garment }: { feasibility: Feasibility; garment: GarmentPublic }) {
  const shipBy = feasibility.ship_by;
  const landsOn = feasibility.lands_on;
  const freeAgain = feasibility.free_again;
  if (!shipBy || !landsOn || !freeAgain) return null;

  const rows = [
    ["ship", `${fmtDay(shipBy)} → ${fmtDay(landsOn)}`, "timeline__bar--ship"],
    ["wear", fmtRange(feasibility.wear_from, feasibility.wear_to), "timeline__bar--wear"],
    ["return", `after ${fmtDay(feasibility.wear_to)}`, "timeline__bar--return"],
    ["cleaning", `free again ${fmtDay(freeAgain)}`, "timeline__bar--cleaning"],
  ] as const;

  return (
    <section className="timeline" aria-label={`Availability for ${garment.name}`}>
      <div className="timeline__heading">
        <h2>{garment.name}</h2>
        <span>held {fmtRange(shipBy, freeAgain)} · worn {fmtRange(feasibility.wear_from, feasibility.wear_to)}</span>
      </div>
      {rows.map(([label, value, className]) => (
        <div className="timeline__row" key={label}>
          <span className="timeline__label">{label}</span>
          <div>
            <div className="timeline__track"><span className={`timeline__bar ${className}`} /></div>
            <small>{value}</small>
          </div>
        </div>
      ))}
    </section>
  );
}
