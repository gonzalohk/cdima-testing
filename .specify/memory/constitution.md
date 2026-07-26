# Constitución del Proyecto CDIMA Reportes

> Basada en la arquitectura **actualmente existente** (`cdima-reportes`): SPA React 18 + TypeScript + Vite, Ant Design, y **Asana REST API como única fuente de datos/backend** (no hay base de datos ni servidor propios). Esta constitución no introduce tecnologías inexistentes en el proyecto.

## Core Principles

### I. Arquitectura cliente-only sobre Asana
- El sistema es una **SPA de solo cliente**; **no** se introduce backend propio, base de datos ni ORM.
- **Todo acceso a datos DEBE pasar por `src/services/asana.service.ts`** (`asanaService`). Ningún componente o página puede llamar a `fetch` de Asana directamente.
- Se respeta la separación por capas existente: `pages/` (vistas) → `components/` (UI reutilizable) → `hooks/` → `services/` → `config/`+`types/`+`utils/`.
- Los servicios de dominio (`notifications.service`, `pdf.service`, `reports/*`, `export.service`) **DEBEN** consumir Asana a través de `asanaService`, nunca por su cuenta.
- El ruteo y el control de acceso viven en `App.tsx` (`ProtectedRoute`/`PublicRoute`) y `context/permissions.ts`; toda página nueva DEBE registrarse en `ROLE_PAGES`.

### II. Estándares de código (TypeScript)
- **TypeScript estricto**: el proyecto DEBE compilar con `tsc` sin errores (`npm run build` ejecuta `tsc && vite build`).
- **ESLint es obligatorio**: `npm run lint` DEBE pasar con `--max-warnings 0`. No se permiten `eslint-disable` sin justificación en comentario.
- Prohibido `any` implícito; usar los tipos de `src/types/` (`asana.types.ts`, `notification.types.ts`). Los nuevos tipos compartidos van en `src/types/`.
- **Constantes centralizadas**: los nombres de campos personalizados de Asana se referencian desde `src/constants/asana-fields.ts` (no strings mágicos dispersos).
- Nombres de dominio en español (coherente con el código existente: `solicitante`, `atrasadas`, `contrataciones`).

### III. Estándares de frontend React
- **Componentes funcionales + hooks** exclusivamente (React 18). No class components salvo `ErrorBoundary` existente.
- **Ant Design (`antd`) es la librería de UI**; no se introducen otras librerías de componentes.
- La autenticación y los permisos se consumen vía `useAuth()` y `permissions.ts`; **la UI DEBE ocultar/deshabilitar** acciones no permitidas por el rol (patrón `canApprove`, `ROLE_PAGES`).
- Efectos de red DEBEN manejar estados de carga y error visibles (Spin/alert/notificación) y **no** deben romper el render global (uso de `ErrorBoundary`).
- El estado de sesión persiste solo en `localStorage` (`cdima_auth_user`); no se añade otra librería de estado global sin enmienda.

### IV. Requisitos de pruebas (Testing)
- **Estado actual**: el proyecto **no tiene framework de pruebas configurado**. Esta constitución NO obliga a uno inexistente.
- **Puertas mínimas obligatorias antes de integrar cambios**: (1) `tsc` sin errores y (2) `eslint` sin warnings.
- Todo cambio en flujos críticos (crear/aprobar/observar/eliminar solicitudes, permisos, notificaciones) DEBE verificarse manualmente y documentar los pasos de verificación en el PR.
- Si se añaden pruebas automatizadas, DEBEN usar un runner compatible con el stack Vite/TypeScript ya presente y ubicarse junto al código; **no** se agregan dependencias de test sin enmienda a esta constitución.

### V. Reglas de diseño de API (integración Asana)
- Todas las llamadas usan el patrón `fetchAsana<T>()`: `Authorization: Bearer <VITE_ASANA_TOKEN>`, control de concurrencia por **semáforos (30 lecturas / 12 escrituras)** y **reintento ante HTTP 429** (Retry-After / backoff, máx. 3). Cambios a este patrón requieren enmienda.
- Las lecturas DEBEN limitar campos con `opt_fields`; las escrituras usan `createTask`/`createSubtask`/`updateTask`/`deleteTask`.
- Los datos estructurados se persisten como **JSON embebido** en `Task.notes`, delimitado por `===DATOS_JSON=== … ===FIN_DATOS_JSON===`, más campos personalizados. Toda escritura DEBE **preservar el texto legible** y reemplazar el bloque JSON completo (patrón existente en los `handle*`).
- Las convenciones de nombres son contrato: prefijos `SFON`/`SMAT`/`DMAT`/`CPER`, tareas `Resumen:`/`FUENTES DE VERIFICACION`, y las exclusiones (`*CDIMA*`, `NOTIFICACIONES`, `Administración`). No se cambian sin enmienda.

### VI. Cambios de datos (sin base de datos)
- **No existe base de datos**; el "esquema" es el conjunto de estructuras JSON en `notes` y los campos personalizados de Asana.
- Cambiar la forma del JSON de una entidad (Solicitud, Contratación, Notificación) DEBE ser **retrocompatible**: mantener el `fallback` de parseo de registros antiguos (texto libre) y no eliminar campos que datos existentes ya usan.
- Renombrar o eliminar un campo personalizado de Asana requiere actualizar `src/constants/asana-fields.ts` y validar todos los consumidores.
- Ver el modelo documentado en `specs/modelo-de-datos.md`; cualquier cambio DEBE reflejarse allí.

### VII. Consideraciones de seguridad
- La app es **cliente-only**: el token de Asana y las contraseñas se inyectan como variables `VITE_*` y **quedan embebidos en el bundle**. Esta limitación DEBE documentarse y no ampliarse (no agregar más secretos al cliente de los estrictamente necesarios).
- **Nunca** hardcodear secretos en el código: usar `import.meta.env.VITE_*` (patrón actual de `AuthContext` y `env.ts`).
- Los controles de rol (`ROLE_PERMISSIONS`, `ROLE_PAGES`, `ROLE_ESCUELA_AREA`) son la autoridad de permisos; toda acción sensible DEBE verificarse contra ellos en la UI.
- Validar entradas en los límites (formularios): campos obligatorios, `fin ≥ inicio`, URLs `http(s)://` (patrón existente). No confiar en datos de `notes` sin `extractJsonData` seguro (try/catch, nunca lanzar en servicios como notificaciones).
- No registrar secretos en consola; los `console.error` existentes no deben incluir el token.

### VIII. Compatibilidad hacia atrás
- Los cambios DEBEN preservar la compatibilidad con datos ya almacenados en Asana (solicitudes/contrataciones/notificaciones antiguas).
- **Mantener los `fallback` de parseo** (JSON nuevo + texto legado) mientras existan registros antiguos.
- Las rutas públicas existentes (`/`, `/report`, `/planificacion`, `/biblioteca`, `/escuelas`, `/diplomados`, `/produccion-alto-nivel`, `/investigacion-e-incidencia`, `/publicaciones`, `/login`) no se renombran ni eliminan sin plan de migración.
- El feature flag `VITE_NOTIFICACIONES_ENABLED` DEBE permanecer **desactivado por defecto** y con comportamiento **no-op** cuando está apagado.

## Restricciones adicionales (stack tecnológico)

- **Runtime/UI**: React 18, TypeScript 5, Vite 5, Ant Design 6 (`antd`, `@ant-design/icons`).
- **Ruteo**: `react-router-dom` v6.
- **Fechas/calendario**: `date-fns`, `moment`, `react-big-calendar` (ya presentes).
- **Reportes**: `jspdf` + `jspdf-autotable` (PDF), `docx` (Word), CSV vía `export.service`.
- **Validación**: `zod` (`src/schemas/`).
- **Despliegue**: hosting estático en Vercel con rewrites SPA (`vercel.json`).
- **Prohibido** introducir nuevas dependencias mayores (backend, base de datos, ORM, otra librería de UI o de estado) sin enmienda a esta constitución.

## Flujo de desarrollo y puertas de calidad

- **Antes de integrar**: `npm run build` (incluye `tsc`) y `npm run lint` DEBEN pasar sin errores ni warnings.
- **Zona horaria**: las fechas de negocio se formatean en `America/La_Paz` (coherencia con el código existente).
- **Documentación viva**: cambios funcionales relevantes DEBEN actualizar los documentos de `specs/` (funcional, modelo de datos, arquitectura, reglas de negocio).
- **Revisión**: todo PR DEBE indicar qué principios de esta constitución afecta y cómo se verificó (incluida verificación manual de flujos críticos).

## Governance

- Esta constitución **prevalece** sobre otras prácticas del proyecto. Ante conflicto, se sigue la constitución.
- **Enmiendas**: requieren (1) descripción del cambio, (2) justificación, (3) impacto en datos/rutas/compatibilidad y (4) actualización de los documentos en `specs/` y de esta constitución.
- **Versionado semántico** de la constitución: MAJOR (cambios incompatibles de principios/gobernanza), MINOR (nuevo principio o sección), PATCH (aclaraciones).
- Todo cambio de código DEBE poder justificarse frente a estos principios; la complejidad añadida DEBE estar justificada.

**Version**: 1.0.0 | **Ratified**: 2026-07-26 | **Last Amended**: 2026-07-26
