"use client";
/* eslint-disable @next/next/no-img-element -- Images are served by the API. */

import { useState } from "react";
import { apiAssetUrl } from "../../lib/api";
import type { GarmentPublic } from "../../lib/api-types";

type Props = { garment: GarmentPublic };

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function GarmentDetail({ garment }: Props) {
  const [showImage, setShowImage] = useState(false);
  const image = apiAssetUrl(garment.image);
  const size = garment.sizes_eu[0] ?? null;
  const rentalPeriod = `${formatDate(garment.available_from)} — ${formatDate(garment.available_to)}`;

  return (
    <main className="garment-page">
      <header className="garment-nav">
        <a className="garment-nav__brand" href="/find">MORE THAN ONCE</a>
        <a className="garment-nav__back" href="/find">← Back to edit</a>
      </header>

      <div className="garment-detail">
        <section className="garment-gallery" aria-label={`${garment.name} images`}>
          <button aria-label={`View ${garment.name} larger`} className="garment-gallery__image" onClick={() => setShowImage(true)} type="button">
            <img alt={garment.name} src={image} />
            <span>View image ↗</span>
          </button>
          <p className="garment-gallery__caption">Colour · {garment.colour_family ?? "not specified"}</p>
        </section>

        <section className="garment-info" aria-labelledby="garment-title">
          <p className="garment-info__designer">{garment.designer}</p>
          <h1 id="garment-title">{garment.name}</h1>
          <p className="garment-info__intro">{garment.description}</p>

          <div className="garment-price">
            <strong>€{garment.rental_price}</strong>
            <span>for {garment.rental_days} days</span>
          </div>

          <div className="garment-section">
            <div className="garment-section__heading">
              <p>Size</p>
            </div>
            <p className="garment-size">{size ? `EU ${size}` : "One size"}</p>
          </div>

          <dl className="garment-facts">
            <div><dt>Rental period</dt><dd>{rentalPeriod}</dd></div>
            <div><dt>Condition</dt><dd>{garment.condition}</dd></div>
            <div><dt>Fit</dt><dd>{garment.silhouette ?? "not specified"}</dd></div>
          </dl>

          <div className="garment-lender">
            <div className="garment-lender__avatar" aria-hidden="true">{garment.lender_name.slice(0, 1)}</div>
            <div>
              <p>Lent by <strong>{garment.lender_name}</strong></p>
              <span>★ {garment.lender_rating.toFixed(1)} · {garment.city}</span>
            </div>
          </div>

        </section>
      </div>

      <section className="garment-details" aria-label="Garment details">
        <p>THE DETAILS</p>
        <div>
          <span>{garment.style_tags.join(" · ")}</span>
          <span>Retail price €{garment.retail_price}</span>
          <span>Ships from {garment.city}</span>
        </div>
      </section>

      {showImage && (
        <div className="garment-lightbox" onClick={() => setShowImage(false)} role="presentation">
          <button aria-label="Close image" className="garment-lightbox__close" onClick={() => setShowImage(false)} type="button">×</button>
          <img alt={garment.name} onClick={(event) => event.stopPropagation()} src={image} />
        </div>
      )}

    </main>
  );
}
