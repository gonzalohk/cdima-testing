# Phase 1 — Quickstart: Validación de Archivado de Solicitudes por Mes

**Feature**: `001-archivar-solicitudes` | **Date**: 2026-07-28

Guía de validación end-to-end (manual, coherente con la constitución IV: no hay framework de test). Los detalles de datos y comportamiento están en [data-model.md](./data-model.md) y [contracts/ui-behavior.md](./contracts/ui-behavior.md).

---

## Prerrequisitos

- Node.js instalado y dependencias del proyecto (`npm install`).
- Variables de entorno configuradas (`.env`): `VITE_ASANA_TOKEN` válido y credenciales `VITE_PASSWORD_*`.
- Existir en Asana al menos **una solicitud de material (SMAT) aprobada** con su **solicitud de fondos (SFON) anidada aprobada** (ciclo completo), idealmente con `fechaAprobacion` en distintos meses para probar la agrupación.

## Puertas de calidad (obligatorias antes de integrar)

```bash
npm run lint    # ESLint sin warnings (--max-warnings 0)
npm run build   # tsc + vite build sin errores
```

## Arrancar la app

```bash
npm run dev
# abrir la URL local que muestra Vite (p. ej. http://localhost:5173)
```

Inicia sesión con un usuario **administrador** o **director** (rol aprobador).

---

## Escenarios de validación

### V1 — Archivar una solicitud elegible *(FR-002/003/004/007)*
1. Ir a la tarjeta **Solicitudes** → pestaña **✅ Aprobadas**.
2. Localizar un grupo SMAT con su SFON aprobada. Debe verse el botón **Archivar**.
3. Pulsar **Archivar**.
4. **Esperado**: el grupo desaparece de "Aprobadas"; el `Badge` de Aprobadas baja; el `Badge` de **🗄️ Archivadas** sube.

### V2 — Elegibilidad del botón *(FR-003)*
1. En **Aprobadas**, localizar una SMAT aprobada **sin** SFON aprobada.
2. **Esperado**: NO aparece el botón **Archivar** para esa fila.

### V3 — Ver agrupación por mes y colapsar/expandir *(FR-007/008/009)*
1. Abrir la pestaña **🗄️ Archivadas**.
2. **Esperado**: secciones por mes (ej. "Julio 2026") con conteo, ordenadas de más reciente a más antiguo, todas **colapsadas**.
3. Pulsar el encabezado de un mes → se **expande** mostrando la tabla.
4. Pulsar de nuevo → se **colapsa**; el conteo permanece visible.

### V4 — Desarchivar (revertir) *(FR-005/006)*
1. En **Archivadas**, expandir un mes y pulsar **Desarchivar** en una solicitud.
2. **Esperado**: desaparece de "Archivadas" y reaparece en **Aprobadas** con todos sus datos intactos (fondo, informe, estado de almacén, fechas).

### V5 — Permisos por rol *(FR-013)*
1. Cerrar sesión y entrar con un rol **no aprobador** (p. ej. técnico/comunicación).
2. **Esperado**: no se muestran acciones de **Archivar**/**Desarchivar**. La pestaña "Archivadas" respeta la visibilidad de solicitudes del rol.

### V6 — Búsqueda dentro de Archivadas *(FR-014)*
1. En **Archivadas**, escribir un término en el buscador (actividad/proyecto/solicitante).
2. **Esperado**: solo se muestran meses con coincidencias; los meses sin resultados no se renderizan.

### V7 — Persistencia tras recarga *(FR-015)*
1. Archivar una solicitud y **recargar** la página (F5).
2. **Esperado**: la solicitud sigue en "Archivadas" (el estado se leyó desde Asana).

### V8 — Sin fecha de aprobación *(FR-016)*
1. (Si aplica) Con una solicitud archivada sin `fechaAprobacion` determinable.
2. **Esperado**: aparece en la sección **"Sin fecha"** al final, no se pierde.

---

## Criterios de aceptación de la validación

- Todos los escenarios V1–V8 se comportan según lo esperado.
- `npm run lint` y `npm run build` pasan sin errores ni warnings.
- Verificación manual documentada en el PR (constitución IV y flujo de calidad).
- `specs/modelo-de-datos.md` actualizado con los campos `archivado`/`fechaArchivado` (constitución VI).
