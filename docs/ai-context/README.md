# AI context pack

Este directorio es la memoria operacional del proyecto para cualquier IA o desarrollador que entre despues.

## Como usarlo

1. Leer primero `PROJECT_CONTEXT.md`.
2. Revisar `QA_AND_INCIDENT_LOG.md` antes de tocar sync, auth, dashboard o Supabase.
3. Al terminar una tarea importante, actualizar `QA_AND_INCIDENT_LOG.md` y, si cambia el estado del producto, `PROJECT_CONTEXT.md`.
4. No pegar secretos. Nombrar variables de entorno, nunca valores.

## Regla de oro

La IA no debe adivinar el estado de la app. Debe mirar este context pack, correr pruebas concretas y dejar registro de que hizo, que funciono y que sigue roto.
