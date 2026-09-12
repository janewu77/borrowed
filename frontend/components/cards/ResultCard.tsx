"use client";
/* eslint-disable @next/next/no-img-element -- FastAPI supplies a configurable image origin. */

import Link from "next/link";
import { apiAssetUrl } from "../../lib/api";
import type { SearchHit } from "../../lib/api-types";
import { fmtDay } from "../../lib/dates";

export function ResultGrid({ hits, relaxed, onReserve }: {
  hits: SearchHit[];
  relaxed: string | null;
  onReserve: (hit: SearchHit) => void;
}) {
  return (
    <section aria-label="Available garments">
      {relaxed && <p className="relaxed-chip">also showing: {relaxed}</p>}
      <div className="results">
        {hits.map((hit) => <ResultCard hit={hit} key={hit.garment.id} onReserve={onReserve} />)}
      </div>
    </section>
  );
}

function ResultCard({ hit, onReserve }: { hit: SearchHit; onReserve: (hit: SearchHit) => void }) {
  const { garment, feasibility } = hit;
  const image = garment.thumb || garment.image;

  return (
    <article className="result-card">
      <img alt={garment.name} src={apiAssetUrl(image)} />
      <div className="result-card__body">
        <div>
          <p className="result-card__designer">{garment.designer}</p>
          <h2 className="result-card__name">{garment.name}</h2>
        </div>
        <p className="result-card__lender">{garment.lender_name} · {garment.lender_rating.toFixed(1)} · {garment.city}</p>
        <p className="result-card__price">€{garment.rental_price} · {garment.rental_days} days</p>
        {feasibility.lands_on && <span className="lands-pill">lands {fmtDay(feasibility.lands_on)}</span>}
        {hit.reason && <p className="result-card__reason">{hit.reason}</p>}
        <div className="result-card__actions">
          <Link href={`/garment/${encodeURIComponent(garment.id)}?wear=${encodeURIComponent(feasibility.wear_from)}`}>Dates</Link>
          <button className="primary" onClick={() => onReserve(hit)} type="button">Reserve</button>
        </div>
      </div>
    </article>
  );
}
