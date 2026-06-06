"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px" }}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export function AuthPanel() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithGoogle() {
    if (!supabase) {
      setMessage("Faltan variables de configuración de Supabase.");
      return;
    }

    setMessage("Redirigiendo a Google...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setMessage(null);
  }

  if (userEmail) {
    const initial = userEmail.charAt(0).toUpperCase();
    return (
      <div className="auth-panel signed-in">
        <span>{userEmail}</span>
        <div className="auth-avatar" aria-hidden="true">
          {initial}
        </div>
        <button type="button" onClick={signOut} aria-label="Cerrar sesión">
          <LogOut size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="auth-google-btn"
        aria-label="Entrar con Google"
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#ffffff",
          color: "#1f1f1f",
          border: "1px solid #e0e2e6",
          borderRadius: "20px",
          padding: "0 16px",
          height: "40px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.88rem",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <GoogleIcon />
        Continuar con Google
      </button>
      {message ? <span className="form-message">{message}</span> : null}
    </div>
  );
}
