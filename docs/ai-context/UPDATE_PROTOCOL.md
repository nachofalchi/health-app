# Protocolo para mantener contexto de IA

## Cuando actualizar

Actualizar este context pack cuando ocurra cualquiera de estas cosas:

- Se agrega una feature visible.
- Se cambia auth, sync, schema o lectura de Supabase.
- Una prueba falla y se descubre la causa.
- Se aplica una migracion.
- Se cambia una variable de entorno requerida.
- Se detecta un comportamiento que parece raro pero es esperado.

## Formato de entrada para incidentes

Copiar este bloque en `QA_AND_INCIDENT_LOG.md`:

```md
## YYYY-MM-DD - Titulo corto

Problema:

- Que vio el usuario o la prueba.

Causa:

- Por que pasaba, si se sabe.

Accion:

- Archivos tocados.
- Migraciones/scripts corridos.

Resultado:

- Estado final verificable.

Pruebas:

- Comandos/rutas/queries usados.

Pendiente:

- Que queda sin resolver.
```

## Handoff para una IA nueva

Pegar esto al iniciar una conversacion nueva:

```txt
Estoy trabajando en la app Salud Nacho. Antes de proponer cambios, lee:

1. docs/ai-context/PROJECT_CONTEXT.md
2. docs/ai-context/QA_AND_INCIDENT_LOG.md
3. README.md

Reglas:
- No repitas fixes ya documentados.
- No inventes el estado de Supabase: usa los scripts db:query cuando haga falta.
- No muestres secretos de .env.local.
- Despues de cambios importantes, actualiza docs/ai-context.
- Antes de decir que algo esta listo, corre build/typecheck y pruebas HTTP/API relevantes.
```

## Checklist minimo de cierre

- [ ] `PROJECT_CONTEXT.md` sigue siendo cierto.
- [ ] `QA_AND_INCIDENT_LOG.md` tiene los incidentes nuevos.
- [ ] Las pruebas relevantes estan escritas con resultado.
- [ ] No hay secretos pegados.
- [ ] Si se escribieron datos de QA en Supabase, quedaron documentados.
