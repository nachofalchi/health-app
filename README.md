# Salud Nacho

PWA personal de salud construida con Next.js, Vercel Hobby y Supabase Free.

## Stack

- Frontend/PWA: Next.js App Router
- Hosting: Vercel Hobby
- URL objetivo: `https://salud-nacho.vercel.app`
- Base de datos: Supabase Postgres Free
- Autenticación: Supabase Auth
- Backend: Next.js Route Handlers / Server Actions
- Jobs/sync: endpoint protegido inicialmente, cron después
- IA: modular y explicativa, conectada en una fase posterior
- Costo inicial: $0

## Primeros pasos

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL editor.
3. Copiar `.env.example` a `.env.local` y completar las variables públicas de Supabase.
4. Instalar dependencias con `npm.cmd install`.
5. Correr localmente con `npm.cmd run dev`.

## Google Health

Variables necesarias en `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
SYNC_SECRET=un-secreto-largo-para-sync-manual
OAUTH_STATE_SECRET=otro-secreto-largo
TOKEN_ENCRYPTION_KEY=otro-secreto-largo-para-cifrar-tokens
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key
SUPABASE_SERVICE_ROLE_KEY=opcional-para-cron-o-sync-sin-sesion
```

Redirect URIs a agregar en Google Cloud OAuth:

```txt
http://localhost:3000/api/google-health/callback
https://salud-nacho.vercel.app/api/google-health/callback
```

Después de iniciar sesión en la app, usar el botón `Conectar Google Health` y luego `Sincronizar ahora`.

Sync manual desde consola, opcional si configuraste `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/sync/google-health `
  -Method POST `
  -Headers @{Authorization="Bearer TU_SYNC_SECRET"; "x-user-id"="TU_SUPABASE_USER_ID"}
```

## Roadmap inmediato

- Login con Supabase Auth.
- Guardado real de carga manual diaria.
- Sync Google Health para `steps`, `exercise`, `weight` y `body-fat`.
- Baselines de 7/28 días.
- Scores determinísticos e insights con confianza.

## Contexto para IA y QA

Antes de pedirle cambios a una IA nueva, darle estos archivos:

- `docs/ai-context/PROJECT_CONTEXT.md`
- `docs/ai-context/QA_AND_INCIDENT_LOG.md`
- `docs/ai-context/UPDATE_PROTOCOL.md`

Ese context pack registra decisiones, pruebas, incidentes y estado real de Supabase/Google Health para no repetir errores.
