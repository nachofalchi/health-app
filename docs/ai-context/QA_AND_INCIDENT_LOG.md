# QA e incidentes

Este archivo registra problemas reales, pruebas hechas y estado final. Usarlo para evitar repetir investigaciones.

## 2026-06-04 - Supabase DB directo

Problema:

- La IA no podia ejecutar SQL directo contra Supabase.

Accion:

- Se agrego `pg`.
- Se crearon `scripts/db-common.mjs`, `scripts/db-query.mjs` y `scripts/db-migrate.mjs`.
- Se agrego `SUPABASE_DB_URL`.

Resultado:

- `select now()` contra Supabase funciona.
- `db:query` permite solo `SELECT`, `WITH` o `EXPLAIN`.
- `db:migrate` aplica archivos `.sql` bajo `supabase/`.

## 2026-06-04 - Duplicados de body_measurements

Problema:

- Migracion `005_cleanup_sync_quality.sql` fallaba por constraint unico en `(user_id, measurement_group_key)`.

Accion:

- Se corrigio y aplico `supabase/005_cleanup_sync_quality.sql`.
- La migracion fusiona mediciones por minuto/fuente/aplicacion.

Resultado:

- `body_measurements` quedo sin duplicados.
- Peso y grasa corporal quedan juntos cuando corresponden.

Prueba:

```sql
select user_id, measurement_group_key, count(*) as duplicates
from public.body_measurements
group by user_id, measurement_group_key
having count(*) > 1;
```

Resultado esperado: 0 filas.

## 2026-06-04 - Google Health calories

Problema:

- Sync quedaba `partial` por `Invalid data type ID ... calories-burned`.

Causa:

- `calories-burned` no es el identificador correcto del rollup.

Accion:

- En `lib/google-health.ts` se cambio `calories-burned` por `total-calories`.
- Se lee `totalCalories.kcalSum`.

Resultado:

- Sync real queda `success`.
- `errors_json` queda `[]`.
- `daily_metrics.calories_kcal` recibe valores.

## 2026-06-04 - Dashboard en modo demo y sync 401

Problema:

- Home mostraba modo demo.
- `POST /api/sync/google-health` devolvia 401: `Falta sesion de Supabase o SYNC_SECRET valido.`

Causa:

- El navegador no tenia cookie de sesion Supabase, aunque la base tenia un usuario con Google Health conectado.

Accion:

- Se creo `lib/app-user.ts`.
- Regla: primero sesion real; en local, si hay un unico usuario con Google Health conectado, fallback server-side con service role.
- Se aplico en dashboard, categorias, sync, connect y manual-log.

Resultado:

- Home muestra `Datos reales` en local.
- `POST /api/sync/google-health` sin cookie devuelve 200 con `ok:true`.

## 2026-06-04 - Paginas de categorias 404

Problema:

- `/categorias/sueno` y `/categorias/entrenamiento` daban 404 en pruebas HTTP.

Causa:

- La ruta dinamica recibia un parametro interno `nxtPcategory` en el entorno de build/test.

Accion:

- `app/categorias/[category]/page.tsx` tolera `category` y `nxtPcategory`.
- Se marco la ruta como dinamica.
- Se removio `generateStaticParams`.

Resultado:

- Las seis paginas de categoria devuelven 200.

## 2026-06-04 - Insights duplicados

Problema:

- React warning: `Encountered two children with the same key, Composicion corporal`.

Causa:

- Cada sync inserta insights con titulos repetidos.

Accion:

- `lib/dashboard-data.ts` deduplica insights por titulo.
- Las keys de render agregan indice como fallback.

Resultado:

- Warning eliminado.

## 2026-06-04 - Manual log bloqueado sin sesion

Problema:

- El cliente bloqueaba el formulario si no habia sesion Supabase.

Causa:

- `components/quick-log-form.tsx` llamaba `supabase.auth.getUser()` en cliente y abortaba.

Accion:

- Se removio el bloqueo cliente.
- El endpoint decide si usa sesion o fallback local.
- `app/api/manual-log/route.ts` hace upsert con `onConflict: "user_id,date"`.

Resultado:

- Submit valido devuelve `303 See Other` hacia `/`.
- La fila se escribe/actualiza en `manual_daily_logs`.

Dato de prueba escrito:

- `date`: 2026-06-04
- `energy_score`: 5
- `mood_score`: 4
- `notes`: `QA final local fallback test`

## 2026-06-04 - Warning Edge Runtime Supabase middleware

Problema:

- `next build` mostraba warning porque Supabase usaba `process.version` en Edge Runtime.

Causa:

- `utils/supabase/middleware.ts` importaba desde el indice de `@supabase/ssr`.

Accion:

- Se cambio import a `@supabase/ssr/dist/module/createServerClient`.

Resultado:

- El warning desaparecio del build.

## Suite final verificada

Comandos:

```powershell
npm.cmd run build
npm.cmd run typecheck
```

Resultado: OK.

Rutas/API verificadas:

- `/`: 200, contiene `Datos reales`.
- `/categorias/recuperacion`: 200.
- `/categorias/sueno`: 200.
- `/categorias/entrenamiento`: 200.
- `/categorias/cardiovascular`: 200.
- `/categorias/composicion`: 200.
- `/categorias/bienestar`: 200.
- `POST /api/sync/google-health`: 200, `ok:true`.
- `POST /api/manual-log`: 303 hacia `/`.

Ultimo sync consultado:

- `status`: `success`
- `errors`: `[]`
- `daily_metrics_upserted`: `12`
- `raw_datapoints_upserted`: `228`
- `body_measurements_upserted`: `7`
- `exercises_upserted`: `1`
- `sleep_sessions_upserted`: `14`
