import "server-only";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, Clock, Activity } from "lucide-react";
import { getAppUserContext } from "@/lib/app-user";
import { SyncNowButton } from "@/components/sync-now-button";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Historial de Sincronizaciones — Salud Nacho",
  description: "Registro completo de todas las sincronizaciones de Google Health con detalles de datos importados."
};

type SyncRun = {
  id: string;
  provider: string;
  status: "success" | "partial" | "failed";
  started_at: string | null;
  finished_at: string | null;
  date_start: string | null;
  date_end: string | null;
  daily_metrics_upserted: number;
  raw_datapoints_upserted: number;
  exercises_upserted: number;
  sleep_sessions_upserted: number;
  body_measurements_upserted: number;
  scores_upserted: number | null;
  empty_responses: number;
  errors_json: Array<{ dataType?: string; operation?: string; message?: string }> | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function durationMs(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Date.parse(end) - Date.parse(start);
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: "success" | "partial" | "failed" }) {
  const labels = { success: "Exitoso", partial: "Parcial", failed: "Fallido" };
  const icons = {
    success: <CheckCircle size={12} />,
    partial: <AlertTriangle size={12} />,
    failed: <XCircle size={12} />
  };
  return (
    <span className={`sync-badge ${status}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

export default async function SyncHistoryPage() {
  const appUser = await getAppUserContext();

  if (!appUser) {
    redirect("/");
  }

  const { supabase, userId } = appUser;

  const { data: syncRuns } = await supabase
    .from("sync_runs")
    .select("id,provider,status,started_at,finished_at,date_start,date_end,daily_metrics_upserted,raw_datapoints_upserted,exercises_upserted,sleep_sessions_upserted,body_measurements_upserted,scores_upserted,empty_responses,errors_json")
    .eq("user_id", userId)
    .order("finished_at", { ascending: false })
    .limit(50);

  const runs = (syncRuns ?? []) as SyncRun[];

  return (
    <main className="shell">
      {/* Header */}
      <header style={{ marginBottom: "32px" }}>
        <Link href="/" className="back-link" style={{ marginBottom: "20px" }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginTop: "16px" }}>
          <div>
            <p className="eyebrow">Google Health</p>
            <h1 style={{ marginTop: "4px" }}>Historial de Sincronizaciones</h1>
          </div>
          <SyncNowButton />
        </div>
      </header>

      {/* Stats Summary */}
      {runs.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "14px",
            marginBottom: "28px"
          }}
        >
          {[
            { label: "Total sincronizaciones", value: runs.length },
            { label: "Exitosas", value: runs.filter(r => r.status === "success").length },
            { label: "Parciales", value: runs.filter(r => r.status === "partial").length },
            { label: "Fallidas", value: runs.filter(r => r.status === "failed").length }
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                padding: "20px",
                boxShadow: "var(--shadow)"
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {stat.label}
              </span>
              <strong style={{ display: "block", fontSize: "2rem", fontWeight: 800, marginTop: "6px" }}>
                {stat.value}
              </strong>
            </div>
          ))}
        </section>
      )}

      {/* Table */}
      {runs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            background: "var(--panel)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--line)"
          }}
        >
          <Activity size={36} style={{ color: "var(--muted)", marginBottom: "16px", opacity: 0.5 }} />
          <h2 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Sin sincronizaciones aún</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Cuando sincronices Google Health, el historial aparecerá aquí.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow)",
            overflow: "hidden"
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table className="sync-history-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Fecha/Hora</th>
                  <th>Duración</th>
                  <th>Métricas</th>
                  <th>Raw</th>
                  <th>Ejercicios</th>
                  <th>Sueño</th>
                  <th>Cuerpo</th>
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const dur = durationMs(run.started_at, run.finished_at);
                  const hasErrors = run.errors_json && run.errors_json.length > 0;
                  return (
                    <tr key={run.id} style={{ backgroundColor: hasErrors ? "rgba(217,48,37,0.03)" : undefined }}>
                      <td><StatusBadge status={run.status} /></td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.83rem" }}>
                        <span style={{ display: "block", fontWeight: 600 }}>{formatDateTime(run.finished_at)}</span>
                        {run.date_start && run.date_end && (
                          <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                            {run.date_start} → {run.date_end}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDuration(dur)}</td>
                      <td style={{ fontWeight: 700 }}>{run.daily_metrics_upserted}</td>
                      <td style={{ fontWeight: 700 }}>{run.raw_datapoints_upserted}</td>
                      <td style={{ fontWeight: 700 }}>{run.exercises_upserted}</td>
                      <td style={{ fontWeight: 700 }}>{run.sleep_sessions_upserted}</td>
                      <td style={{ fontWeight: 700 }}>{run.body_measurements_upserted}</td>
                      <td>
                        {hasErrors ? (
                          <details>
                            <summary
                              style={{
                                cursor: "pointer",
                                color: "var(--red)",
                                fontSize: "0.8rem",
                                fontWeight: 700
                              }}
                            >
                              {run.errors_json!.length} error{run.errors_json!.length > 1 ? "es" : ""}
                            </summary>
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "10px",
                                background: "var(--line-light)",
                                borderRadius: "8px",
                                fontSize: "0.72rem",
                                maxWidth: "300px"
                              }}
                            >
                              {run.errors_json!.map((err, i) => (
                                <div key={i} style={{ marginBottom: "6px", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                                  <strong>{err.dataType ?? "—"}</strong> / {err.operation ?? "—"}
                                  <br />
                                  <span style={{ color: "var(--muted)" }}>{err.message}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span style={{ color: "var(--green)", fontSize: "0.8rem" }}>✓ Ninguno</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
