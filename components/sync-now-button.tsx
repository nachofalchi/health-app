"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncNowButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/sync/google-health", {
        method: "POST"
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMsg(data?.message ?? "Error al sincronizar.");
        return;
      }

      setSuccessMsg("Sincronización completa");
      router.refresh();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg("Error de conexión al sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
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
          fontSize: "0.9rem",
          cursor: isSyncing ? "not-allowed" : "pointer",
          opacity: isSyncing ? 0.7 : 1,
          transition: "var(--transition)"
        }}
      >
        <RefreshCw size={16} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
        {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      
      {errorMsg && (
        <span style={{ fontSize: "0.78rem", color: "var(--red)", fontWeight: 600 }}>
          {errorMsg}
        </span>
      )}
      {successMsg && (
        <span style={{ fontSize: "0.78rem", color: "var(--green)", fontWeight: 600 }}>
          {successMsg}
        </span>
      )}
    </div>
  );
}
