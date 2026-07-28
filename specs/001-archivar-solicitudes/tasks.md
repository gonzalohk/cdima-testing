---
description: "Task list for Archivado de Solicitudes por Mes"
---

# Tasks: Archivado de Solicitudes por Mes

**Input**: Design documents from `/specs/001-archivar-solicitudes/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-behavior.md](./contracts/ui-behavior.md)

**Tests**: NO se incluyen tareas de test. El proyecto no tiene framework de pruebas (Constitución IV); la verificación es manual vía [quickstart.md](./quickstart.md). Puertas de calidad: `npm run lint` y `npm run build`.

**Organization**: Tareas agrupadas por historia de usuario. La app es una SPA cliente-only; el cambio se concentra en [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) y persiste el estado en el JSON de `Task.notes` vía `asanaService.updateTask`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia de usuario (US1, US2, US3)
- La mayoría de tareas tocan el mismo archivo (`HomePage.tsx`), por lo que hay poca paralelización real

## Path Conventions

- Proyecto único (SPA React): código en `src/` en la raíz del repositorio
- Archivo principal de cambios: `src/pages/HomePage.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar la línea base del proyecto antes de modificar

- [X] T001 Verificar línea base ejecutando `npm run lint` y `npm run build` sin errores en la raíz del repositorio, para partir de un estado limpio
- [X] T002 Revisar en [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) los puntos de integración existentes: `extractJsonData`, tipo `SolicitudRow`, `loadSolicitudes`, `handleApprove`, estados `solicitudesAprobadas`/`searchAprobadas`, columnas `columnsAprobadas` y el bloque de `Tabs` de Solicitudes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Utilidades de lectura/agrupación y reclasificación de solicitudes que TODAS las historias necesitan

**⚠️ CRITICAL**: Ninguna historia puede completarse hasta terminar esta fase

- [X] T003 En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir helper `isArchivada(task)` que lea el campo `archivado` desde el JSON de `notes` con `extractJsonData` (ausente/`false` ⇒ no archivada), conforme a data-model.md §1
- [X] T004 En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir helpers de mes: `mesKeyFromFecha(fechaAprobacion)` que devuelva la clave `YYYY-MM` (o `sin-fecha`) parseando `DD/MM/YYYY, HH:mm`, y `mesLabelFromKey(key)` que devuelva la etiqueta en español (ej. "Julio 2026", "Sin fecha") en zona `America/La_Paz`, conforme a research D4/D6
- [X] T005 En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir estado `solicitudesArchivadas` (`SolicitudRow[]`) y, en `loadSolicitudes`, clasificar como archivadas las filas con `isArchivada` y EXCLUIRLAS de `solicitudesAprobadas` (FR-012), preservando la agrupación SMAT+SFON existente
- [X] T006 En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir helper reutilizable `setArchivadoEnGrupo(row, archivado)` que reescriba el bloque JSON (`archivado`, `fechaArchivado`) de la SMAT y de su SFON anidada con el patrón `notasBase.replace(...) + JSON.stringify`, invocando `asanaService.updateTask` en ambas subtareas y devolviendo las `notes` actualizadas, conforme a contracts C1 y research D8

**Checkpoint**: Clasificación y utilidades listas — las historias pueden implementarse

---

## Phase 3: User Story 1 - Archivar solicitud aprobada con fondos aprobados (Priority: P1) 🎯 MVP

**Goal**: Permitir a un aprobador archivar un grupo SMAT+SFON aprobado, retirándolo de "Aprobadas".

**Independent Test**: Localizar una solicitud aprobada con su SFON aprobada, pulsar "Archivar" y verificar que sale de "Aprobadas" y su conteo baja.

### Implementation for User Story 1

- [X] T007 [US1] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir estado `archivandoKey` (`string | null`) e implementar `handleArchivar(row)` que use `setArchivadoEnGrupo(row, true)`, y al tener éxito mueva el grupo de `solicitudesAprobadas` a `solicitudesArchivadas` (actualización local optimista), con manejo de error visible sin dejar el grupo partido (contracts C3, research D8)
- [X] T008 [US1] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir helper de elegibilidad `puedeArchivar(row)` que valide `canApprove`, que la SMAT esté aprobada y que exista su SFON anidada aprobada (ciclo completo, RN-11 / FR-003)
- [X] T009 [US1] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir el botón "Archivar" en la columna de acciones de aprobadas (`colAccionesHistorico`), visible solo cuando `puedeArchivar(row)` es verdadero y `!isArchivada`, con spinner/disable según `archivandoKey` (FR-002/013, contracts C3/C5)

**Checkpoint**: US1 funcional — se puede archivar y la solicitud desaparece de "Aprobadas"

---

## Phase 4: User Story 2 - Consultar solicitudes archivadas agrupadas por mes (Priority: P1)

**Goal**: Nueva pestaña "Archivadas" con secciones colapsables por mes según fecha de aprobación.

**Independent Test**: Con solicitudes archivadas de distintos meses, abrir "Archivadas" y verificar secciones por mes, colapsables, ordenadas de más reciente a más antiguo.

### Implementation for User Story 2

- [X] T010 [US2] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir estado `searchArchivadas` y estado de expansión `mesesExpandidos` (`string[]`), y un `useMemo` `filteredArchivadas` que aplique `matchSolicitud` con `searchArchivadas` (FR-014, research D9)
- [X] T011 [US2] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir un `useMemo` `seccionesArchivadasPorMes` que agrupe `filteredArchivadas` por `mesKeyFromFecha` de la SMAT, ordene los meses desc (con "sin-fecha" al final), ordene las filas internas por `fechaAprobacion` desc, y exponga `{ clave, etiqueta, solicitudes, conteo }` (FR-007/009/010/016, data-model §2)
- [X] T012 [US2] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir la pestaña "🗄️ Archivadas" al bloque `Tabs` de Solicitudes con `Badge` = total archivadas, usando Ant Design `Collapse` (un panel por mes, encabezado con etiqueta + conteo, colapsado por defecto) y dentro de cada panel una `Table` que reutilice `columnsAprobadas`; incluir `emptyText` "No hay solicitudes archivadas" (FR-001/007/008, contracts C2, research D5)
- [X] T013 [US2] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) conectar el input de búsqueda existente (`tabBarExtraContent`) para que en la pestaña `archivadas` lea/escriba `searchArchivadas`, coherente con el patrón de las otras pestañas (FR-014)

**Checkpoint**: US2 funcional — el histórico archivado es navegable por mes de forma independiente

---

## Phase 5: User Story 3 - Revertir el archivado / desarchivar (Priority: P2)

**Goal**: Permitir devolver una solicitud archivada a "Aprobadas" sin pérdida de datos.

**Independent Test**: Archivar una solicitud, pulsar "Desarchivar" en "Archivadas" y verificar que reaparece en "Aprobadas" con sus datos intactos.

### Implementation for User Story 3

- [X] T014 [US3] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir estado `desarchivandoKey` e implementar `handleDesarchivar(row)` que use `setArchivadoEnGrupo(row, false)` y al tener éxito mueva el grupo de `solicitudesArchivadas` a `solicitudesAprobadas` respetando la inserción agrupada (`insertApprovedRow`), con manejo de error visible (FR-005/006, contracts C4)
- [X] T015 [US3] En [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx) añadir el botón "Desarchivar" en las filas de la pestaña "Archivadas", visible solo si `canApprove`, con spinner/disable según `desarchivandoKey` (FR-013, contracts C4/C5)

**Checkpoint**: Las tres historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Sincronización de documentación y validación final

- [X] T016 [P] Actualizar [specs/modelo-de-datos.md](../modelo-de-datos.md) (tabla T6 · `solicitud_json`) añadiendo los campos `archivado` y `fechaArchivado`, conforme al Principio VI de la constitución
- [X] T017 [P] Actualizar [specs/reglas-de-negocio.md](../reglas-de-negocio.md) añadiendo una regla nueva (p. ej. RN-34 · Archivado/Desarchivado de solicitudes) que documente la funcionalidad implementada
- [X] T018 Ejecutar puertas de calidad en la raíz: `npm run lint` (sin warnings) y `npm run build` (`tsc` + vite sin errores)
- [ ] T019 Ejecutar la validación manual de [quickstart.md](./quickstart.md) (escenarios V1–V8) y documentar resultados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las historias
- **User Stories (Phase 3–5)**: Dependen de Foundational
  - US1 (P1) y US2 (P1) son el MVP; US2 requiere que la clasificación de archivadas (T005) exista
  - US3 (P2) depende de que exista la pestaña Archivadas (US2) para ubicar el botón Desarchivar
- **Polish (Phase 6)**: Depende de las historias deseadas completadas

### User Story Dependencies

- **US1**: Tras Foundational. Escribe el estado archivado y lo saca de Aprobadas
- **US2**: Tras Foundational (usa `solicitudesArchivadas` de T005 y helpers de mes de T004). Independientemente testeable con datos ya archivados
- **US3**: Tras US2 (el botón vive en la pestaña Archivadas) y reutiliza `setArchivadoEnGrupo` (T006) e `insertApprovedRow`

### Within Each User Story

- Helpers/estado antes que handlers; handlers antes que UI (botones/pestaña)
- Historia completa antes de pasar a la siguiente prioridad

### Parallel Opportunities

- La mayoría de tareas modifican `src/pages/HomePage.tsx`, por lo que **no** son paralelizables entre sí (mismo archivo)
- Solo las tareas de documentación de Polish son paralelas: **T016** y **T017** (archivos distintos)

---

## Parallel Example: Phase 6 (documentación)

```
# T016 y T017 tocan archivos distintos y pueden hacerse en paralelo:
T016 → specs/modelo-de-datos.md
T017 → specs/reglas-de-negocio.md
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational)
2. Implementar US1 (archivar) → valida que descongestiona "Aprobadas"
3. Implementar US2 (pestaña Archivadas por mes) → valida navegación del histórico
4. **PARAR y validar**: con US1+US2 se cumple el objetivo principal del usuario (descongestión + consulta por mes)

### Incremental Delivery

- Añadir US3 (desarchivar) como red de seguridad/reversibilidad
- Cerrar con Polish: sincronizar `specs/` y correr puertas de calidad + quickstart
