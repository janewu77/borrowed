"use client";
/* eslint-disable @next/next/no-img-element -- FastAPI supplies a configurable image origin. */

import { apiAssetUrl } from "../../lib/api";
import type { ListingDraft } from "../../lib/api-types";

const fields: Array<[keyof ListingDraft, string]> = [
  ["category", "Category"], ["colour_family", "Colour"], ["silhouette", "Silhouette"],
  ["occasion", "Occasion"], ["sizes_eu", "Size"], ["rental_price", "Rental price"],
];

export function ListingDraftCard({ draft, onPublish }: { draft: ListingDraft; onPublish?: (id: string) => void }) {
  const ready = Boolean(draft.ready && draft.listing_id);
  return (
    <section className="draft" aria-label="Draft listing">
      <div className="draft__body">
        {draft.image && <img alt={draft.name} src={apiAssetUrl(draft.image)} />}
        <div className="draft__content">
          <p className="draft__label">draft listing</p>
          {fields.map(([key, label]) => {
            const raw = draft[key];
            const value = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "—");
            const source = draft.provenance[key as string];
            return (
              <div className="draft__row" key={key}>
                <span className="draft__field">{label}</span><span>{value}</span>
                {source && <span className={`provenance ${source === "user" ? "provenance--said" : ""}`}>{source === "user" ? "you said" : "from photo"}</span>}
              </div>
            );
          })}
          {draft.size_unverified && <p className="draft__warning">size not verified</p>}
        </div>
      </div>
      <footer className="draft__footer">
        <span>{ready ? "Ready. Ship-by dates are computed for each booking." : "Waiting for the details still needed."}</span>
        <button disabled={!ready} onClick={() => draft.listing_id && onPublish?.(draft.listing_id)} type="button">Publish</button>
      </footer>
    </section>
  );
}
