import { getLenderGarments } from "../../../lib/api";

export default async function LenderPage({ params }: { params: Promise<{ lenderId: string }> }) {
  const { lenderId } = await params;
  const garments = await getLenderGarments(lenderId);

  return (
    <main className="page">
      <h1>Garments</h1>
      <ul>
        {garments.map(({ garment, next_hold }) => (
          <li key={garment.id}>
            {garment.name}{next_hold ? ` · ship by ${next_hold.ship_by}` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
