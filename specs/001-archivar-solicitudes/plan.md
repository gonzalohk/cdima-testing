# Implementation Plan: Archivado de Solicitudes por Mes

**Branch**: `001-archivar-solicitudes` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-archivar-solicitudes/spec.md`

## Summary

Añadir una pestaña **"Archivadas"** a la vista de Solicitudes en `HomePage.tsx`, junto a Pendientes/Aprobadas/Observadas. Un aprobador podrá **archivar** una solicitud aprobada cuyo ciclo de fondos (SMAT ↔ SFON) ya está aprobado, retirándola de "Aprobadas", y **desarchivarla** para revertir. En "Archivadas" las solicitudes se agrupan en secciones **colapsables por mes** según su `fechaAprobacion`, ordenadas del mes más reciente al más antiguo.

**Enfoque técnico**: Extender de forma retrocompatible el JSON embebido en `Task.notes` con un atributo `archivado` (booleano) y `fechaArchivado` (marca temporal), siguiendo el patrón existente de persistencia (RN-30) y reusando la infraestructura de UI (Ant Design `Tabs`, `Table`, `Collapse`) y la capa `asanaService.updateTask`. No se introduce backend, base de datos ni dependencias nuevas.

## Technical Context

**Language/Version**: TypeScript 5, React 18

**Primary Dependencies**: Vite 5, Ant Design 6 (`antd`, `@ant-design/icons`), `react-router-dom` v6, `date-fns`/`moment` (formateo de fechas ya presentes)

**Storage**: Sin base de datos. Persistencia vía Asana REST API — JSON embebido en `Task.notes` (bloque `===DATOS_JSON=== … ===FIN_DATOS_JSON===`) y campos personalizados. Todo acceso a través de `src/services/asana.service.ts` (`asanaService`).

**Testing**: No hay framework de pruebas configurado (constitución IV). Puertas mínimas: `tsc` sin errores (`npm run build`) y `eslint` sin warnings (`npm run lint --max-warnings 0`). Verificación manual de flujos críticos documentada en quickstart.

**Target Platform**: SPA cliente-only en navegador; despliegue estático en Vercel.

**Project Type**: Single project — SPA React por capas (`pages/` → `components/` → `hooks/` → `services/` → `config/`+`types/`+`utils/`).

**Performance Goals**: Interacción fluida (60 fps) en la UI; archivar/desarchivar debe reflejar el cambio de estado local de inmediato (optimista) y persistir con una sola escritura `updateTask`. La agrupación por mes debe manejar cientos de solicitudes archivadas sin desplazamiento largo (SC-006).

**Constraints**: Respetar semáforos de concurrencia y retry 429 del `asanaService` (RN-29). Fechas de negocio en zona `America/La_Paz`. Escrituras deben preservar el texto legible y reemplazar el bloque JSON completo. Sin secretos nuevos en el cliente.

**Scale/Scope**: Cambio acotado a la vista de Solicitudes de `HomePage.tsx` (una página), reutilizando el tipo `SolicitudRow` y `extractJsonData`. Alcance: 1 pestaña nueva, 2 acciones (archivar/desarchivar), 1 agrupación colapsable por mes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en este plan |
|---|---|
| **I. Cliente-only sobre Asana** | ✅ Sin backend/BD nuevos. El estado de archivado se persiste en `notes` vía `asanaService.updateTask`. Ningún acceso directo a `fetch` de Asana. |
| **II. Estándares TypeScript** | ✅ Sin `any` implícito; se extiende el tipado local de `SolicitudRow`/JSON. Debe compilar con `tsc` y pasar ESLint con `--max-warnings 0`. Sin strings mágicos nuevos de campos Asana (el atributo vive en el JSON de `notes`, no es un custom field). |
| **III. Frontend React** | ✅ Componentes funcionales + hooks; solo Ant Design (`Tabs`, `Table`, `Collapse`, `Button`, `Badge`). Acción oculta/deshabilitada por rol (`canApprove`). Estados de carga/error visibles reutilizados. |
| **IV. Testing** | ✅ No se añade framework de test. Puertas: `tsc` + `eslint`. Verificación manual documentada en quickstart. |
| **V. Diseño de API Asana** | ✅ Reutiliza `asanaService.updateTask` (patrón `fetchAsana`, semáforos, retry 429). No se altera el patrón. |
| **VI. Cambios de datos** | ✅ Cambio JSON **retrocompatible**: se **añade** `archivado`/`fechaArchivado`; ausencia ⇒ no archivado. No se eliminan campos. Se refleja en `specs/modelo-de-datos.md`. |
| **VII. Seguridad** | ✅ Sin secretos nuevos. `extractJsonData` seguro (try/catch). Acción sensible verificada contra permisos en UI (`canApprove`). |
| **VIII. Compatibilidad hacia atrás** | ✅ Solicitudes previas sin el atributo se tratan como no archivadas. No se renombran rutas ni se rompe el parseo legado. |

**Resultado del gate**: PASA. No hay violaciones que justificar. Sección de Complejidad no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-archivar-solicitudes/
├── plan.md              # Este archivo (/speckit.plan)
├── research.md          # Salida Fase 0 (/speckit.plan)
├── data-model.md        # Salida Fase 1 (/speckit.plan)
├── quickstart.md        # Salida Fase 1 (/speckit.plan)
├── contracts/           # Salida Fase 1 (/speckit.plan)
│   └── ui-behavior.md   # Contrato de comportamiento UI + forma del JSON
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec (ya existe)
└── tasks.md             # Salida Fase 2 (/speckit.tasks - NO lo crea /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── HomePage.tsx          # ← Cambio principal: nueva pestaña "Archivadas",
│                             #   acciones archivar/desarchivar, agrupación por mes
├── components/               # (Opcional) extraer secciones colapsables si crece la lógica
├── services/
│   └── asana.service.ts      # Sin cambios de API; se reutiliza updateTask
├── types/
│   └── asana.types.ts        # (Sin cambios obligatorios; el atributo vive en el JSON de notes)
└── utils/
    └── (helpers de fecha/mes si se extraen)
```

**Structure Decision**: Proyecto único (SPA React por capas). El cambio se concentra en la página existente [src/pages/HomePage.tsx](../../src/pages/HomePage.tsx), donde ya viven las pestañas de solicitudes, la lógica de agrupación de aprobadas y los handlers de escritura (`handleApprove`, `handleSaveAlmacen`, etc.). Se reutilizan el tipo `SolicitudRow`, `extractJsonData`, el patrón de reescritura del bloque JSON y `asanaService.updateTask`. No se crean capas ni carpetas nuevas; si la lógica de las secciones colapsables por mes crece, puede extraerse a un componente en `src/components/` (Ant Design `Collapse`), pero no es obligatorio para el MVP.

## Complexity Tracking

> No aplica: la verificación de Constitución no presenta violaciones. No se añaden proyectos, dependencias, backend ni patrones nuevos.
