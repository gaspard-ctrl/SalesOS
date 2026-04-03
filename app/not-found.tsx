import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold" style={{ color: "#f01563" }}>
          404
        </h1>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: "#111" }}>
          Page introuvable
        </h2>
        <p className="mt-2 text-sm" style={{ color: "#888" }}>
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ background: "#f01563", color: "#fff" }}
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
