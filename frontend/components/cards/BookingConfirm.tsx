"use client";
/* eslint-disable @next/next/no-img-element -- FastAPI supplies a configurable image origin. */

import { useState } from "react";
import { apiAssetUrl } from "../../lib/api";
import type { SearchHit } from "../../lib/api-types";
import { fmtDay, fmtRange } from "../../lib/dates";

export function BookingConfirm({ hit, onCancel, onConfirm }: {
  hit: SearchHit;
  onCancel: () => void;
  onConfirm: (idempotencyKey: string) => void;
}) {
  const { garment, feasibility } = hit;
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-modal="true" aria-label="Confirm reservation" className="sheet" role="dialog">
        <div className="sheet__body">
          <p className="sheet__label">confirm reservation</p>
          <div className="sheet__garment">
            <img alt={garment.name} src={apiAssetUrl(garment.thumb || garment.image)} />
            <div><h2>{garment.name}</h2><p>{garment.lender_name} · {garment.lender_rating.toFixed(1)} · {garment.city}</p></div>
          </div>
          <div className="sheet__rows">
            <Row label="Wear" value={fmtRange(feasibility.wear_from, feasibility.wear_to)} />
            {feasibility.ship_by && <Row label="Ship by" value={fmtDay(feasibility.ship_by)} />}
            {feasibility.lands_on && <Row label="Lands" value={fmtDay(feasibility.lands_on)} />}
            <Row label="Price" value={`€${garment.rental_price} · ${garment.rental_days} days`} />
          </div>
          <p className="sheet__note">reserved · no payment taken</p>
        </div>
        <footer className="sheet__actions"><button onClick={onCancel} type="button">Back</button><button className="primary" onClick={() => onConfirm(idempotencyKey)} type="button">Reserve</button></footer>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <p className="sheet__row"><span>{label}</span><strong>{value}</strong></p>;
}
