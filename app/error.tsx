"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Root Error Boundary]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)"
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px"
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#fce8e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <AlertTriangle size={28} color="var(--red)" />
        </div>

        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px", color: "var(--ink)" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
            Ocurrió un error inesperado al cargar el dashboard. Podés intentar recargar.
          </p>
          {error.digest && (
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "8px", fontFamily: "monospace" }}>
              Error: {error.digest}
            </p>
          )}
        </div>

        <button
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            borderRadius: "24px",
            background: "var(--blue)",
            color: "white",
            border: 0,
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer"
          }}
        >
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    </main>
  );
}
