# Phase 0 — Research: Archivado de Solicitudes por Mes

**Feature**: `001-archivar-solicitudes` | **Date**: 2026-07-28

Este documento consolida las decisiones de diseño. No quedaban marcadores `NEEDS CLARIFICATION` en el Technical Context; las incógnitas provienen de los supuestos de la spec y se resuelven aquí anclándose al código y a las reglas de negocio existentes (`specs/reglas-de-negocio.md`, `specs/modelo-de-datos.md`).

---

## D1 · Dónde persistir el estado de archivado

- **Decision**: Persistir en el bloque JSON embebido en `Task.notes` de la subtarea, añadiendo `archivado: boolean` y `fechaArchivado: string` (timestamp La Paz). Se reescribe el bloque completo con el patrón existente (`notasBase.replace(/===DATOS_JSON===.../) + JSON.stringify`).
- **Rationale**: Es el mecanismo canónico de persistencia del proyecto (RN-30) y no requiere backend ni campos personalizados nuevos de Asana. Reutiliza `extractJsonData` y `asanaService.updateTask`.
- **Alternatives considered**:
  - *Campo personalizado de Asana "Archivada"*: rechazado — exige tocar `constants/asana-fields.ts`, crear el enum en Asana y coordinar migración; mayor acoplamiento sin beneficio para una bandera booleana.
  - *Sección de Asana "Archivadas"*: rechazado — la app deriva el estado del JSON, no de secciones; mover subtareas entre secciones no encaja con el modelo actual y complica el desarchivado.
  - *`localStorage`*: rechazado — no persiste entre dispositivos/usuarios ni sobrevive a limpiezas del navegador; viola la expectativa de estado compartido (FR-015).

## D2 · Cómo derivar la pertenencia a cada pestaña

- **Decision**: Una solicitud pertenece a "Archivadas" si su JSON tiene `archivado === true`. Pertenece a "Aprobadas" si está aprobada (`fechaAprobacion` presente, RN-02) **y** `archivado !== true`. La derivación se hace en `loadSolicitudes` al clasificar filas.
- **Rationale**: Coherente con RN-02 (estado derivado del JSON). Evita nuevas fuentes de verdad. Ausencia del campo ⇒ no archivado (retrocompatibilidad, Principio VIII).
- **Alternatives considered**:
  - *Mantener una lista separada persistida*: rechazado — duplica la fuente de verdad y arriesga inconsistencias.

## D3 · Unidad archivable (SMAT + SFON)

- **Decision**: La unidad archivable es el **grupo** SMAT + su SFON aprobada anidada (relación 1:1, RN-11). Archivar marca `archivado=true` en **ambas** subtareas del grupo; desarchivar lo revierte en ambas. La elegibilidad del botón "Archivar" requiere que la SMAT esté aprobada y que exista su SFON anidada también aprobada.
- **Rationale**: La spec pide explícitamente archivar "solicitudes aprobadas que ya tengan su solicitud de fondos aprobados". Mantener el grupo íntegro evita estados incoherentes (FR-011). La UI de aprobadas ya agrupa SMAT+SFON (`aprobadasGroupIndex`, `insertApprovedRow`).
- **Alternatives considered**:
  - *Archivar solo la SMAT y dejar la SFON en Aprobadas*: rechazado — rompe la unidad visual del ciclo y contradice FR-011.
  - *Permitir archivar cualquier solicitud aprobada suelta*: rechazado — fuera del alcance solicitado; se puede considerar en una iteración futura.

## D4 · Fecha que determina el mes de agrupación

- **Decision**: El mes se deriva de `fechaAprobacion` de la **SMAT** (solicitud principal del grupo). Para solicitudes archivadas sin `fechaAprobacion` determinable, se agrupan en una sección "Sin fecha" (FR-016).
- **Rationale**: La spec pide agrupar "según la fecha de aprobación". La SMAT es el ancla del grupo (D3). El formato de `fechaAprobacion` es `DD/MM/YYYY, HH:mm` (RN-03), parseable con el helper existente `parseFechaSol`.
- **Alternatives considered**:
  - *Usar la fecha de la SFON*: rechazado — la SFON puede aprobarse después; la SMAT representa el inicio del ciclo.
  - *Usar `fechaArchivado`*: rechazado — la spec especifica "fecha de aprobación", no la de archivado.

## D5 · Componente de UI para secciones colapsables por mes

- **Decision**: Usar Ant Design **`Collapse`** (con `items`) donde cada panel es un mes; el cuerpo de cada panel es una `Table` con las columnas ya usadas en "Aprobadas". El encabezado del panel muestra la etiqueta del mes (ej. "Julio 2026") y un `Badge`/conteo. Secciones ordenadas de más reciente a más antigua; inician **colapsadas** por defecto (SC-006).
- **Rationale**: `Collapse` es el patrón nativo de Ant Design para expandir/colapsar, ya disponible en el stack (Principio III), sin dependencias nuevas. Reutiliza la definición de columnas de aprobadas para consistencia visual.
- **Alternatives considered**:
  - *Tabla única con filas de encabezado de mes*: rechazado — expandir/colapsar por grupo es más complejo de implementar manualmente que con `Collapse`.
  - *Nueva librería de acordeón*: rechazado — viola "no nuevas dependencias de UI" (Restricciones de stack).

## D6 · Etiqueta de mes y localización

- **Decision**: Formatear la etiqueta de mes en español y zona `America/La_Paz` (ej. "Julio 2026", con mayúscula inicial). Clave de agrupación estable `YYYY-MM` para ordenar; etiqueta legible derivada de esa clave.
- **Rationale**: Coherencia con el formateo de fechas de negocio existente (`toLocaleString('es-ES', { timeZone: 'America/La_Paz' })`). Separar clave de orden (`YYYY-MM`) de etiqueta evita errores de ordenamiento por texto.
- **Alternatives considered**:
  - *Ordenar por etiqueta de texto*: rechazado — "Abril" < "Enero" alfabéticamente; incorrecto cronológicamente.

## D7 · Permisos de archivar/desarchivar

- **Decision**: Solo roles con permiso de aprobación (director/administrador, `canApprove`) ven y ejecutan Archivar/Desarchivar. Para otros roles la acción se oculta.
- **Rationale**: Coherente con RN-21 y con el patrón `canApprove` ya usado para aprobar/observar/eliminar. Principio VII (acciones sensibles verificadas contra permisos en UI).
- **Alternatives considered**:
  - *Permitir a todos archivar*: rechazado — archivar afecta la vista compartida de todos los aprobadores; debe restringirse.

## D8 · Actualización de estado local (optimista) e integridad

- **Decision**: Al archivar/desarchivar, actualizar el estado local (mover la fila entre `solicitudesAprobadas` y una nueva lista `solicitudesArchivadas`) tras la escritura `updateTask`, siguiendo el patrón de `handleApprove`/`handleObserveSubmit`. Como el grupo tiene 2 subtareas (D3), se realizan 2 escrituras (SMAT y SFON) y se actualiza el estado solo si ambas tienen éxito.
- **Rationale**: Consistente con los handlers existentes que actualizan listas locales tras persistir. Evita recargar toda la vista. Respeta semáforos/retry del `asanaService` (RN-29).
- **Alternatives considered**:
  - *Recargar todo (`loadSolicitudes`) tras cada acción*: aceptable pero más lento; se prefiere actualización local puntual, con recarga como fallback ante error.
  - *Escritura única*: no aplicable — el grupo son dos subtareas distintas en Asana.

## D9 · Búsqueda dentro de "Archivadas"

- **Decision**: Reutilizar `matchSolicitud` (busca en actividad, proyecto, tipo, fecha, solicitante) con un nuevo término `searchArchivadas`. Filtrar primero las solicitudes y luego construir las secciones de mes; los meses sin coincidencias no se renderizan.
- **Rationale**: Consistencia con el comportamiento de búsqueda de las otras pestañas y con FR-014.
- **Alternatives considered**:
  - *Buscar solo por mes*: rechazado — menos útil; la búsqueda existente ya cubre múltiples campos.

## D10 · Contadores y estadísticas

- **Decision**: Las solicitudes archivadas se excluyen del `Badge`/conteo y del `dataSource` de "Aprobadas" (FR-012). El `Badge` de "Archivadas" muestra el total archivado. No se alteran las estadísticas por proyecto (`ProjectStats`), que ya se basan en actividades ejecutadas/atrasadas, no en el conteo de aprobadas.
- **Rationale**: Cumple FR-012 sin efectos colaterales en KPIs no relacionados.
- **Alternatives considered**: ninguna relevante.

---

## Resumen de decisiones

| ID | Decisión |
|---|---|
| D1 | Persistir `archivado`/`fechaArchivado` en JSON de `notes` |
| D2 | Pertenencia a pestaña derivada del JSON (`archivado` + `fechaAprobacion`) |
| D3 | Unidad archivable = grupo SMAT + SFON (marca ambas) |
| D4 | Mes por `fechaAprobacion` de la SMAT; "Sin fecha" si falta |
| D5 | Ant Design `Collapse` por mes + `Table` reutilizada |
| D6 | Etiqueta de mes en español/La Paz; clave de orden `YYYY-MM` |
| D7 | Solo aprobadores (`canApprove`) archivan/desarchivan |
| D8 | Actualización local optimista tras 2 escrituras `updateTask` |
| D9 | Reutilizar `matchSolicitud` con `searchArchivadas` |
| D10 | Excluir archivadas del conteo de Aprobadas |

**Todas las incógnitas resueltas. Listo para Fase 1.**
