import { notFound } from "next/navigation";
import { ApiError, getGarment } from "../../../lib/api";

export default async function GarmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const garment = await getGarment(id);
    return (
      <main className="page">
        <p>{garment.designer}</p>
        <h1>{garment.name}</h1>
        <p>€{garment.rental_price} · {garment.rental_days} days</p>
        <p>Lent by {garment.lender_name}</p>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
