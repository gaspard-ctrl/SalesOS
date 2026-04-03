"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold" style={{ color: "#111" }}>
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#888" }}>
          Quelque chose s&apos;est mal passé. Veuillez réessayer.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ background: "#f01563", color: "#fff" }}
      >
        Réessayer
      </button>
    </div>
  );
}
