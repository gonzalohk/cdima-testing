# Phase 1 — Contract: Comportamiento de UI y forma de datos

**Feature**: `001-archivar-solicitudes` | **Date**: 2026-07-28

Este proyecto es una SPA sin API pública propia; su "contrato" es el **comportamiento observable de la UI** y la **forma del JSON** que se persiste en Asana. Este documento define ese contrato de forma verificable.

---

## C1 · Contrato de datos: campos de archivado en `solicitud_json`

Escrituras vía `asanaService.updateTask(gid, { notes })`. El bloque JSON debe conservar todos los campos previos y solo modificar los de archivado.

**Archivar** (por cada subtarea del grupo SMAT+SFON):

```jsonc
// notes → bloque ===DATOS_JSON=== ... ===FIN_DATOS_JSON===
{
  // ...todos los campos previos intactos...
  "fechaAprobacion": "12/07/2026, 14:30",   // debe existir (precondición)
  "archivado": true,                          // AÑADIDO
  "fechaArchivado": "28/07/2026, 11:05"       // AÑADIDO (La Paz, DD/MM/YYYY, HH:mm)
}
```

**Desarchivar**:

```jsonc
{
  // ...todos los campos previos intactos...
  "archivado": false                          // (o campo eliminado)
  // fechaArchivado eliminado o ignorado
}
```

**Reglas del contrato de datos**:
- MUST preservar el texto legible base y reemplazar el bloque JSON completo (patrón RN-30).
- MUST NOT eliminar ni alterar otros campos (`materiales`, `fondos`, `informe`, `almacen`, etc.).
- Ausencia de `archivado` MUST interpretarse como `false`.

---

## C2 · Contrato de UI: pestaña "Archivadas"

| Elemento | Comportamiento esperado |
|---|---|
| Pestaña | Existe una 4.ª pestaña "🗄️ Archivadas" con `Badge` = nº total de solicitudes archivadas visibles al usuario. |
| Contenido | Ant Design `Collapse` con un panel por mes. Cada panel: encabezado `"<Mes> <Año>"` + conteo; cuerpo = `Table` con las columnas de "Aprobadas". |
| Orden de meses | Descendente (más reciente primero); "Sin fecha" al final. |
| Estado inicial | Todos los paneles **colapsados**. |
| Expandir/Colapsar | Pulsar el encabezado alterna la visibilidad del cuerpo del mes; el conteo permanece visible. |
| Búsqueda | El input existente filtra por actividad/proyecto/tipo/fecha/solicitante; meses sin coincidencias no se renderizan. |
| Vacío | Si no hay archivadas: mensaje "No hay solicitudes archivadas". |

---

## C3 · Contrato de acción: Archivar

| Aspecto | Especificación |
|---|---|
| Visibilidad | Botón "Archivar" visible SOLO si `canApprove` **y** la fila es un grupo SMAT+SFON aprobado (ciclo completo) **y** `archivado !== true`. |
| Precondición | La SMAT tiene `fechaAprobacion` y existe SFON anidada aprobada. |
| Efecto persistencia | `updateTask` en SMAT y en SFON fijando `archivado=true`, `fechaArchivado=<ahora La Paz>`. |
| Efecto UI (éxito) | El grupo desaparece de "Aprobadas" y aparece en "Archivadas" bajo el mes de `fechaAprobacion` de la SMAT. Conteos actualizados. |
| Efecto UI (error) | Se muestra error visible; el estado local NO cambia (o se recarga). No queda el grupo partido entre pestañas. |
| Atomicidad UI | El estado local cambia solo si **ambas** escrituras tienen éxito. |
| Idempotencia | Archivar una ya archivada no está disponible (botón ausente). |

---

## C4 · Contrato de acción: Desarchivar

| Aspecto | Especificación |
|---|---|
| Visibilidad | Botón "Desarchivar" visible SOLO si `canApprove` y la fila está en "Archivadas". |
| Efecto persistencia | `updateTask` en SMAT y SFON fijando `archivado=false` (limpia/ignora `fechaArchivado`). |
| Efecto UI (éxito) | El grupo desaparece de "Archivadas" y reaparece en "Aprobadas" conservando el 100% de sus datos. |
| Efecto UI (error) | Error visible; estado local sin cambios. |
| Reversibilidad | Un grupo puede archivarse y desarchivarse múltiples veces sin pérdida de datos. |

---

## C5 · Contrato de permisos

| Rol | Ver pestaña "Archivadas" | Archivar | Desarchivar |
|---|---|---|---|
| administrador / director | Sí | Sí | Sí |
| planificador / comunicación / técnicos | Según visibilidad de solicitudes existente | No | No |

> El rol `comunicación` sigue viendo solo sus propias solicitudes (RN-20) también en "Archivadas".

---

## C6 · Escenarios de aceptación verificables (resumen)

1. Archivar grupo elegible ⇒ sale de Aprobadas, entra en Archivadas (mes correcto). *(FR-002/004/007)*
2. Fila aprobada sin SFON aprobada ⇒ sin botón Archivar. *(FR-003)*
3. Rol no aprobador ⇒ sin acciones de archivar/desarchivar. *(FR-013)*
4. Colapsar/expandir un mes ⇒ oculta/muestra sus filas; conteo persiste. *(FR-008)*
5. Meses ordenados desc; "Sin fecha" al final. *(FR-009/016)*
6. Desarchivar ⇒ vuelve a Aprobadas con datos intactos. *(FR-005/006)*
7. Buscar en Archivadas ⇒ filtra y oculta meses sin coincidencias. *(FR-014)*
8. Recargar la app ⇒ el estado archivado persiste. *(FR-015)*
