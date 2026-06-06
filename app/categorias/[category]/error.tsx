"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CategoryError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Category Error Boundary]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px"
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px"
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#fce8e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <AlertTriangle size={24} color="var(--red)" />
        </div>

        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }}>
            Error al cargar la categoría
          </h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.9rem" }}>
            No se pudieron cargar los datos de esta categoría. Podés reintentar o volver al dashboard.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              borderRadius: "20px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              fontWeight: 600,
              fontSize: "0.88rem",
              textDecoration: "none"
            }}
          >
            <ArrowLeft size={14} />
            Volver
          </Link>
          <button
            onClick={reset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              borderRadius: "20px",
              background: "var(--blue)",
              color: "white",
              border: 0,
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      </div>
    </main>
  );
}
