import { notFound } from "next/navigation";
import { GarmentDetail } from "../../../components/garment/GarmentDetail";
import { ApiError, getGarment } from "../../../lib/api";

export default async function GarmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const garment = await getGarment(id);
    return <GarmentDetail garment={garment} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
