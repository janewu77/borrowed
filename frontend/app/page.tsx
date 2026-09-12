import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <p>MORE</p>
      <h1>More to wear. More to give. More to share.</h1>
      <nav className="side-chooser" aria-label="Choose your path">
        <Link href="/find">I need something to wear</Link>
        <Link href="/list">I have something to lend</Link>
      </nav>
    </main>
  );
}
