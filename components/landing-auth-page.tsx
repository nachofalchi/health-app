"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { LogIn, UserPlus, Heart } from "lucide-react";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export function LandingAuthPage() {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const supabase = createSupabaseBrowserClient();

  async function handleGoogleLogin() {
    if (!supabase) {
      setMessage({ text: "Faltan variables de configuración de Supabase.", type: "error" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setMessage({ text: error.message, type: "error" });
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setMessage(null);

    if (!email || !password) {
      setMessage({ text: "Por favor completá todos los campos.", type: "error" });
      return;
    }

    if (activeTab === "register" && password !== confirmPassword) {
      setMessage({ text: "Las contraseñas no coinciden.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      if (activeTab === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage({ text: error.message, type: "error" });
        else window.location.reload();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setMessage({ text: error.message, type: "error" });
        } else if (data.session) {
          window.location.reload();
        } else {
          setMessage({
            text: "Registro exitoso. Revisá tu correo para confirmar la cuenta.",
            type: "success",
          });
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setActiveTab("login");
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Ocurrió un error inesperado.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-landing-wrapper">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo-wrap">
          <div className="auth-logo-icon">
            <Heart size={32} color="white" fill="white" />
          </div>
        </div>

        <h1>Tu Salud,<br />De un vistazo.</h1>
        <p className="auth-subtitle">
          Métricas biométricas, bitácora diaria e insights inteligentes en un solo lugar.
        </p>

        {/* Google — primary CTA */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="auth-google-btn"
          disabled={loading}
          id="auth-google-btn"
        >
          {loading ? <span className="btn-spinner dark" /> : <GoogleIcon />}
          Continuar con Google
        </button>

        {/* OR divider */}
        <div className="auth-or">
          <span>o</span>
        </div>

        {/* Email toggle */}
        {!showEmailForm ? (
          <button
            type="button"
            className="auth-email-toggle"
            onClick={() => setShowEmailForm(true)}
            id="auth-show-email"
          >
            Usar correo electrónico
          </button>
        ) : (
          <>
            {/* Login / Register tabs */}
            <div className="auth-tabs">
              <button
                type="button"
                className={activeTab === "login" ? "active" : ""}
                onClick={() => { setActiveTab("login"); setMessage(null); }}
                id="auth-tab-login"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={activeTab === "register" ? "active" : ""}
                onClick={() => { setActiveTab("register"); setMessage(null); }}
                id="auth-tab-register"
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                Correo electrónico
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  id="auth-email"
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  id="auth-password"
                />
              </label>

              {activeTab === "register" && (
                <label>
                  Confirmar contraseña
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    id="auth-confirm-password"
                  />
                </label>
              )}

              {message && (
                <div className={`auth-message ${message.type}`} role="alert">
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
                id="auth-submit"
              >
                {loading ? (
                  <span className="btn-spinner" />
                ) : activeTab === "login" ? (
                  <><LogIn size={16} /> Iniciar sesión</>
                ) : (
                  <><UserPlus size={16} /> Crear cuenta</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
