# Salud Nacho - contexto para IA

Actualizado: 2026-06-04

## Objetivo

PWA personal de salud para centralizar datos reales de Google Health/Supabase, mostrar dashboard por categorias y luego conectar modulos de IA explicativa.

## Stack

- Next.js App Router.
- Supabase Postgres/Auth.
- Google Health API via OAuth.
- Backend en Route Handlers.
- Hosting objetivo: Vercel Hobby.
- Costo inicial objetivo: USD 0.

## Estado funcional actual

- Dashboard lee datos reales si hay sesion Supabase.
- En desarrollo local, si no hay sesion pero existe un unico usuario con Google Health conectado, la app usa fallback local server-side.
- Google Health OAuth conecta y guarda tokens cifrados.
- Sync manual funciona contra Google Health y Supabase.
- Paginas por categoria funcionan: recuperacion, sueno, entrenamiento, cardiovascular, composicion y bienestar.
- Carga manual diaria funciona y hace upsert por `(user_id, date)`.
- Hay scripts locales para consultar y migrar Supabase Postgres.

## Datos sincronizados confirmados

Ultimo sync verificado:

- `status`: `success`
- `errors`: `[]`
- `daily_metrics_upserted`: `12`
- `raw_datapoints_upserted`: `228`
- `body_measurements_upserted`: `7`
- `exercises_upserted`: `1`
- `sleep_sessions_upserted`: `14`

## Decisiones importantes

- `total-calories` es el data type correcto para calorias diarias en Google Health, no `calories-burned`.
- El valor de calorias se lee desde `totalCalories.kcalSum`.
- `body_measurements` se fusiona por `measurement_group_key` para juntar peso y grasa corporal de la misma medicion.
- Las paginas de categorias son dinamicas, no SSG, porque deben leer cookies/Supabase en runtime.
- El fallback local de usuario unico no debe usarse como modelo de seguridad de produccion.
- Las escalas manuales `energy_score` y `mood_score` son de 1 a 5.

## Variables necesarias

No guardar valores en docs.

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SYNC_SECRET`
- `OAUTH_STATE_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `ALLOW_SINGLE_USER_FALLBACK` opcional; en local tambien se activa si `NEXT_PUBLIC_SITE_URL` es localhost.

## Archivos clave

- `lib/google-health.ts`: sync, normalizacion y score/insights basicos.
- `lib/app-user.ts`: resolucion de usuario por sesion o fallback local.
- `lib/dashboard-data.ts`: datos del dashboard.
- `lib/category-data.ts`: datos de paginas por categoria.
- `app/api/sync/google-health/route.ts`: endpoint de sync.
- `app/api/google-health/connect/route.ts`: inicio OAuth Google.
- `app/api/google-health/callback/route.ts`: callback OAuth.
- `app/api/manual-log/route.ts`: carga manual diaria.
- `components/google-health-panel.tsx`: botones de conectar/sync.
- `components/quick-log-form.tsx`: carga manual.
- `supabase/schema.sql` y `supabase/00*.sql`: schema/migraciones.

## Pruebas recomendadas

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run db:query -- --file supabase/queries/health_snapshot.sql
```

Validar en servidor local:

- `/` devuelve 200 y muestra datos reales en local.
- Las seis rutas `/categorias/*` devuelven 200.
- `POST /api/sync/google-health` devuelve 200 con `ok:true`.
- `POST /api/manual-log` devuelve 303 hacia `/`.

## Riesgos actuales

- Hay mojibake en algunos textos antiguos del README/componentes; conviene normalizar a UTF-8 o ASCII.
- El fallback local de usuario unico es util para desarrollo, pero hay que evitarlo en Vercel salvo decision explicita.
- Los scores e insights son v0, deterministas y todavia simples.
- HRV/resting HR dependen de formas de payload que pueden necesitar mas normalizacion.
- La carpeta `.next` en OneDrive a veces queda corrupta; si `next build` falla con `readlink` o `TS6053` sobre `.next/types`, borrar `.next` y reconstruir.
