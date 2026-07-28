# Especificación — Reglas de Negocio Implementadas

> Documento de **ingeniería inversa**. Cataloga las reglas de negocio **presentes en el código actual**. No propone reglas nuevas. Las rutas usan la forma `archivo#Lnn` respecto a la raíz del repositorio.

**Convención**: las reglas se numeran `RN-xx`. Para cada una: Nombre · Descripción · Ubicación · Método · Entradas · Salidas · Validaciones · Excepciones · Dependencias.

---

## RN-01 · Clasificación de solicitud por prefijo
- **Descripción**: El tipo de una solicitud se determina por el prefijo del nombre de la subtarea: `SFON`→Fondos, `SMAT`→Material, `DMAT`→Devolución.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L194)
- **Método**: `getSolicitudPrefix(name)` / `getTipoFromPrefix(prefix)`
- **Entradas**: `name: string` (nombre de la subtarea).
- **Salidas**: `'SFON' | 'SMAT' | 'DMAT' | null`; y el label de negocio.
- **Validaciones**: `trim().toUpperCase()`; `startsWith` del prefijo.
- **Excepciones**: ninguna; retorna `null` si no coincide.
- **Dependencias**: constante `SOLICITUD_PREFIXES` ([HomePage.tsx#L183](../src/pages/HomePage.tsx#L183)).

## RN-02 · Derivación del estado de una solicitud
- **Descripción**: El estado (Pendiente/Aprobada/Observada) se deriva del JSON en `notes`: aprobada si existe `fechaAprobacion`; observada si existen `motivoObservacion` y `fechaObservacion`; pendiente en otro caso.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (dentro de `loadSolicitudes`)
- **Método**: lógica en `loadSolicitudes` con `extractJsonData(notes)`
- **Entradas**: `sub.notes` (JSON embebido).
- **Salidas**: clasificación en `rows`/`approvedRows`/`observedRows`.
- **Validaciones**: `!!jsonData?.fechaAprobacion`; `!!(motivoObservacion && fechaObservacion)`.
- **Excepciones**: errores de parseo/subtarea se ignoran (try/catch local).
- **Dependencias**: `extractJsonData`, `getSolicitudPrefix`, `asanaService.getSubtasks`.

## RN-03 · Aprobación de solicitud
- **Descripción**: Aprobar agrega `fechaAprobacion` al JSON, marca la subtarea `completed=true` y la mueve a "Aprobadas". Notifica al solicitante si el flag está activo.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L900)
- **Método**: `handleApprove(row)`
- **Entradas**: `row: SolicitudRow`.
- **Salidas**: `updateTask` (PUT) + actualización de estado de UI; notificación opcional.
- **Validaciones**: solo roles aprobadores pueden invocarla (botón `disabled` con `canApprove`); reescribe el bloque JSON con regex.
- **Excepciones**: `catch` con `console.error`; no propaga.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`, `notificationsService.notify`, `insertApprovedRow`. Fecha en `America/La_Paz`.

## RN-04 · Observación de solicitud
- **Descripción**: Observar agrega `observado=true`, `motivoObservacion` y `fechaObservacion` al JSON (sin completar la tarea) y la mueve a "Observadas". Notifica al solicitante si el flag está activo.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L936)
- **Método**: `handleObserveSubmit()`
- **Entradas**: `observeModal` (fila) + `observeText` (motivo).
- **Salidas**: `updateTask` (PUT) + actualización de UI; notificación opcional.
- **Validaciones**: requiere `observeText.trim()` no vacío; solo aprobadores.
- **Excepciones**: `catch` con `console.error`.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`, `notificationsService.notify`.

## RN-05 · Eliminación de solicitud
- **Descripción**: Elimina la subtarea de la solicitud. La visibilidad del botón depende del rol/propiedad (ver RN-21).
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L1127) (acción); gating en [#L1258](../src/pages/HomePage.tsx#L1258) y [#L1378](../src/pages/HomePage.tsx#L1378)
- **Método**: `handleDeleteSolicitud(row)`
- **Entradas**: `row: SolicitudRow`.
- **Salidas**: `deleteTask` (DELETE) + remoción de todas las listas.
- **Validaciones**: `canDelPending` (pendientes) / `role==='director'` (otra vista) — criterios inconsistentes.
- **Excepciones**: `catch` con `console.error`.
- **Dependencias**: `asanaService.deleteTask`. Permisos: `permissions.ts`.

## RN-06 · Estado de almacén por ítem de material
- **Descripción**: En solicitudes de material aprobadas se fija por ítem el estado de almacén: `ENTREGADO` / `NO AUTORIZADO` / `NO EXISTENTE`, persistido en `materiales[].almacen`.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L999); enum en [#L185](../src/pages/HomePage.tsx#L185)
- **Método**: `handleSaveAlmacen(row, materialId, value)`
- **Entradas**: `row`, `materialId: number`, `value: string`.
- **Salidas**: `updateTask` con JSON actualizado; refresco de listas y modal de detalle.
- **Validaciones**: valor dentro de `ALMACEN_OPCIONES`; color por `almacenColor`.
- **Excepciones**: `alert('Error al guardar el estado de almacén.')` + `console.error`.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`.

## RN-07 · Adjuntar/editar/eliminar informe e informe final
- **Descripción**: Adjunta enlaces `informe` / `informe_final` (`{nombre, url}`) al JSON de la solicitud; permite eliminarlos.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L1025) (`handleSaveInforme`), [#L1076](../src/pages/HomePage.tsx#L1076) (`handleSaveInformeFinal`), y sus `handleDelete*`
- **Método**: `handleSaveInforme` / `handleDeleteInforme` / `handleSaveInformeFinal` / `handleDeleteInformeFinal`
- **Entradas**: `informeNombre`, `informeUrl` (y variantes final).
- **Salidas**: `updateTask` con JSON actualizado.
- **Validaciones**: URL debe cumplir `^https?:\/\//i` si no está vacía.
- **Excepciones**: `alert('El enlace debe comenzar con http:// o https://')`; `alert('Error al guardar…')`.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`.

## RN-08 · Creación de solicitud de material (SMAT)
- **Descripción**: Crea subtarea `SMAT - {titulo}` bajo la actividad, con JSON en `notes`, `due_on=fechaFinalizacion`, `completed=true` y campo `Tipo de Solicitud="Solicitud de Material"`. Genera PDF automáticamente.
- **Ubicación**: [src/components/MaterialRequestModal.tsx](../src/components/MaterialRequestModal.tsx#L82)
- **Método**: `handleSubmit()`
- **Entradas**: `titulo`, `area`, `lugar`, `fechaInicio`, `fechaFinalizacion`, `materiales[]`, `solicitante`, `cargo`, `user`.
- **Salidas**: `createSubtask` (POST) + `exportMaterialRequestToPDF` + `onSuccess(titulo)`.
- **Validaciones**: `area`, `lugar`, `fechaInicio`, `fechaFinalizacion` obligatorios; `fin ≥ inicio`; ≥1 material con `detalle`.
- **Excepciones**: `throw new Error(...)` por cada validación; `'No se pudo obtener el workspace de la tarea'`.
- **Dependencias**: `asanaService.createSubtask`, `pdf.service`, `AuthContext`, campo `Tipo de Solicitud`.

## RN-09 · Creación de solicitud de fondos (SFON)
- **Descripción**: Crea subtarea `SFON - {titulo}` con ítems de fondos; puede anidarse bajo una SMAT aprobada.
- **Ubicación**: [src/components/FundsRequestModal.tsx](../src/components/FundsRequestModal.tsx#L76)
- **Método**: `handleSubmit()`
- **Entradas**: `titulo`, `area`, `lugar`, fechas, `fondos[] {descripcion, importeBolivianos}`.
- **Salidas**: `createSubtask` (POST) + `exportFundsRequestToPDF` + `onSuccess(titulo)`.
- **Validaciones**: `area`/`lugar`/fechas obligatorios; `fin ≥ inicio`; ≥1 ítem de fondos.
- **Excepciones**: `throw new Error(...)` (incl. `'Debe agregar al menos un ítem de fondos'`, workspace ausente).
- **Dependencias**: `asanaService.createSubtask`, `pdf.service`.

## RN-10 · Creación de devolución de material (DMAT)
- **Descripción**: Crea subtarea `DMAT - {titulo}` con ítems de material a devolver y `fechaDevolucion`.
- **Ubicación**: [src/components/MaterialReturnModal.tsx](../src/components/MaterialReturnModal.tsx#L82)
- **Método**: `handleSubmit()`
- **Entradas**: `titulo`, `area`, `lugar`, `fechaDevolucion`, `materiales[]`.
- **Salidas**: `createSubtask` (POST) + `exportMaterialReturnToPDF` + `onSuccess`.
- **Validaciones**: `fechaDevolucion` obligatoria; ≥1 material con `detalle`.
- **Excepciones**: `throw new Error('La fecha de devolución es obligatoria')`, etc.
- **Dependencias**: `asanaService.createSubtask`, `pdf.service`.

## RN-11 · Relación 1:1 entre SMAT y SFON
- **Descripción**: Una SMAT aprobada puede originar una SFON anidada (subtarea de la SMAT). En la vista de aprobadas, cada SMAT se agrupa con su SFON y las SMAT que ya tienen SFON se ordenan al final.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L820) (agrupación) y bloque de SFON anidadas en `loadSolicitudes`
- **Método**: lógica de `loadSolicitudes` + `smatConSfon: Set<parentTaskGid>`
- **Entradas**: subtareas SMAT aprobadas y sus sub-subtareas.
- **Salidas**: listas agrupadas/ordenadas.
- **Validaciones**: `getSolicitudPrefix(s.name)==='SMAT'` y `fechaAprobacion` presente.
- **Excepciones**: errores de sub-subtareas ignorados.
- **Dependencias**: `asanaService.getSubtasks`, `extractJsonData`.

## RN-12 · Determinación de actividad "ejecutada"
- **Descripción**: Una actividad se considera ejecutada si su campo `Estado` = `EJECUTADO`; si el campo no existe, se usa `task.completed`.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (`isEjecutado` dentro de `loadSolicitudes`)
- **Método**: `isEjecutado(task)`
- **Entradas**: `task.custom_fields` (`Estado`), `task.completed`.
- **Salidas**: `boolean`.
- **Validaciones**: comparación en mayúsculas con `'EJECUTADO'`.
- **Excepciones**: ninguna.
- **Dependencias**: campos personalizados de Asana; `constants/asana-fields.ts`.

## RN-13 · Actividades atrasadas
- **Descripción**: Actividad de primer nivel con `due_on < hoy` y no ejecutada es "atrasada"; se calcula `daysLate` y sub-actividades. Excluye el proyecto Administración y no aplica a técnicos.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (`atrasadasMap`/`atrasadasRows`)
- **Método**: lógica en `loadSolicitudes`
- **Entradas**: `topLevel`, `today`, `isEjecutado`.
- **Salidas**: `AtrasadaRow[]` con `daysLate` y `subActividades`.
- **Validaciones**: `!isEjecutado(t) && t.due_on && t.due_on < today`; `!isTecnico && !isAdministracion`.
- **Excepciones**: errores por proyecto ignorados.
- **Dependencias**: `getSubtasks`, normalización de nombre de proyecto (Administración).

## RN-14 · Actividades próximas a vencer
- **Descripción**: Actividad no ejecutada con `due_on` entre hoy y +7 días cuenta como "próxima a vencer".
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (`dueSoon`, `nextWeek`)
- **Método**: lógica en `loadSolicitudes`
- **Entradas**: `topLevel`, `today`, `nextWeek`.
- **Salidas**: contador `dueSoon` en `ProjectStats`.
- **Validaciones**: `due_on >= today && due_on <= nextWeek`.
- **Excepciones**: ninguna específica.
- **Dependencias**: `isEjecutado`.

## RN-15 · Estadísticas por proyecto
- **Descripción**: Por proyecto (no técnico, no Administración) se calcula: total, ejecutadas, atrasadas, próximas a vencer y solicitudes pendientes.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L780) (`allStats.push`)
- **Método**: lógica en `loadSolicitudes`
- **Entradas**: `topLevel`, `pendingReqs`.
- **Salidas**: `ProjectStats`.
- **Validaciones**: exclusiones de rol/proyecto.
- **Excepciones**: ninguna específica.
- **Dependencias**: `isEjecutado`, `getProjectColor`.

## RN-16 · Contrataciones activas (CPER)
- **Descripción**: Subtareas cuyo nombre inicia con `CPER`, no completadas y no ejecutadas, se listan como contrataciones activas.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (`contRows`)
- **Método**: lógica en `loadSolicitudes`
- **Entradas**: subtareas, `isEjecutado`.
- **Salidas**: `ContratacionRow[]`.
- **Validaciones**: `!isTecnico`, `startsWith('CPER')`, `!completed`, `!isEjecutado`.
- **Excepciones**: ninguna específica.
- **Dependencias**: `asanaService.getSubtasks`.

## RN-17 · Máquina de estados de contratación
- **Descripción**: La contratación avanza por 5 estados fijos; cada cambio agrega un registro al `historialEstados` (append) y actualiza `estadoActual`. Se pueden eliminar entradas del historial (recalcula `estadoActual`).
- **Ubicación**: [src/components/ContratacionUpdateModal.tsx](../src/components/ContratacionUpdateModal.tsx#L9) (estados) y [#L95](../src/components/ContratacionUpdateModal.tsx#L95); eliminación en [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L977) (`handleDeleteHistorialEntry`)
- **Método**: `handleSubmit` (modal) / `handleDeleteHistorialEntry`
- **Entradas**: `estado`, `observaciones`, `archivos[]`, `usuario`.
- **Salidas**: `updateTask` con `ContratacionJsonData` actualizado.
- **Validaciones**: estado dentro de `ESTADOS` (`Requerimiento de contratación`, `Elaboración de TDRs`, `Lanzamiento de convocatoria`, `Selección del consultor`, `Informe final del consultor`).
- **Excepciones**: `console.error` en fallo.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`, `ContratacionJsonData`.

## RN-18 · Exclusión de proyectos y tareas del seguimiento
- **Descripción**: Se excluyen proyectos con nombre que contiene `CDIMA` y el proyecto `NOTIFICACIONES`; se ignoran tareas `Resumen:` y `FUENTES DE VERIFICACION`; el proyecto Administración se excluye de stats/atrasadas.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L575) (`filteredProjects`, filtros `topLevel`)
- **Método**: lógica en `loadSolicitudes`
- **Entradas**: lista de proyectos y tareas.
- **Salidas**: conjuntos filtrados.
- **Validaciones**: `!name.includes('CDIMA') && name !== 'NOTIFICACIONES'`; `!startsWith('Resumen:')`; normalización de "administracion".
- **Excepciones**: ninguna específica.
- **Dependencias**: `asanaService.getProjects/getProjectTasks`.

## RN-19 · Restricción de proyectos por área del técnico
- **Descripción**: Los técnicos ev/ep solo ven proyectos cuyo campo `Area` (tarea `Resumen:`) coincide con su área.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L360) (`tecnicoArea`) y verificación en `loadSolicitudes`
- **Método**: lógica en `loadSolicitudes` con `getProjectResumenTask`
- **Entradas**: `user.role`, campo `Area` del `Resumen:`.
- **Salidas**: descarte de proyectos no coincidentes.
- **Validaciones**: `areaVal.includes(tecnicoArea.toLowerCase())`.
- **Excepciones**: proyectos sin `Resumen:`/`Area` se descartan implícitamente.
- **Dependencias**: `asanaService.getProjectResumenTask`.

## RN-20 · Filtro de solicitudes por propietario (comunicación)
- **Descripción**: El rol `comunicacion` solo ve solicitudes cuyo `usuario.email` es el suyo.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L820) (`filterByOwner`)
- **Método**: `filterByOwner(rows)`
- **Entradas**: filas de solicitudes, `user`.
- **Salidas**: filas filtradas.
- **Validaciones**: `role==='comunicacion'` ⇒ `usuario.email === user.email`.
- **Excepciones**: ninguna.
- **Dependencias**: `extractJsonData`.

## RN-21 · Permisos de acción por rol
- **Descripción**: Cada rol tiene un conjunto de permisos (`ROLE_PERMISSIONS`). Solo director/administrador aprueban, observan y eliminan; crear lo pueden todos salvo planificador; exportar lo puede todo rol.
- **Ubicación**: [src/context/permissions.ts](../src/context/permissions.ts) (`ROLE_PERMISSIONS`); uso en [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L358) (`canApprove`)
- **Método**: constante `ROLE_PERMISSIONS` + comprobaciones `role === …`
- **Entradas**: `user.role`.
- **Salidas**: habilitación/deshabilitación de acciones.
- **Validaciones**: pertenencia del permiso al arreglo del rol.
- **Excepciones**: ninguna.
- **Dependencias**: `AuthContext`.

## RN-22 · Acceso a páginas por rol
- **Descripción**: Cada rol solo accede a las rutas de `ROLE_PAGES`; si intenta otra, se redirige a su primera página permitida. Sin sesión, va a `/login`.
- **Ubicación**: [src/context/permissions.ts](../src/context/permissions.ts) (`ROLE_PAGES`); [src/App.tsx](../src/App.tsx#L20) (`ProtectedRoute`); menú en [src/components/Layout.tsx](../src/components/Layout.tsx#L15)
- **Método**: `ProtectedRoute` (`Navigate` según `allowedPaths`)
- **Entradas**: `user`, `location.pathname`.
- **Salidas**: render de la ruta o redirección.
- **Validaciones**: `allowedPaths.includes(pathname)`.
- **Excepciones**: ninguna.
- **Dependencias**: `react-router-dom`, `useAuth`.

## RN-23 · Restricción de área en Escuelas
- **Descripción**: Roles listados en `ROLE_ESCUELA_AREA` solo ven escuelas cuyo campo `Area` coincide (tecnico ev → Erradicación de violencia; tecnico ep → Empoderamiento político).
- **Ubicación**: [src/context/permissions.ts](../src/context/permissions.ts) (`ROLE_ESCUELA_AREA`); uso en [src/pages/EscuelasPage.tsx](../src/pages/EscuelasPage.tsx#L210) y [src/components/Layout.tsx](../src/components/Layout.tsx#L54)
- **Método**: filtrado por `areaRequerida`
- **Entradas**: `user.role`, campo `Area`.
- **Salidas**: escuelas filtradas.
- **Validaciones**: coincidencia de área.
- **Excepciones**: ninguna.
- **Dependencias**: `asanaService`.

## RN-24 · Autenticación local
- **Descripción**: El login valida email + contraseña contra el arreglo `USERS` (contraseñas desde env). La sesión se guarda en `localStorage`.
- **Ubicación**: [src/context/AuthContext.tsx](../src/context/AuthContext.tsx#L127) (`login`)
- **Método**: `login(email, password)`
- **Entradas**: `email`, `password`.
- **Salidas**: `AuthUser | null`; persistencia en `localStorage` (`cdima_auth_user`).
- **Validaciones**: email case-insensitive + password exacta.
- **Excepciones**: retorna `null` si no hay match (no lanza).
- **Dependencias**: `USERS`, variables `VITE_PASSWORD_*`.

## RN-25 · Determinación de aprobadores
- **Descripción**: Los aprobadores son los usuarios con rol director o administrador; se usan como destinatarios de notificaciones de creación.
- **Ubicación**: [src/context/AuthContext.tsx](../src/context/AuthContext.tsx#L109) (`getAprobadorEmails`)
- **Método**: `getAprobadorEmails()`
- **Entradas**: `USERS`.
- **Salidas**: `string[]` de emails.
- **Validaciones**: `role === 'director' || 'administrador'`.
- **Excepciones**: ninguna.
- **Dependencias**: `USERS`.

## RN-26 · Notificaciones: eventos y destinatarios
- **Descripción**: Al crear/aprobar/observar se generan notificaciones (una tarea por destinatario en `NOTIFICACIONES`): `solicitud_creada`→aprobadores; `aprobada`/`observada`→solicitante. Solo si el flag está activo.
- **Ubicación**: [src/services/notifications.service.ts](../src/services/notifications.service.ts#L66) (`notify`); disparadores en `HomePage`
- **Método**: `notificationsService.notify({type,title,description,sourceTaskGid,targetEmails})`
- **Entradas**: tipo, título, descripción jerárquica, gid origen, emails.
- **Salidas**: `createTask` por destinatario (fan-out, dedup).
- **Validaciones**: `isEnabled()`; existencia del proyecto/workspace; dedup de emails.
- **Excepciones**: nunca lanza; `console.error` en fallo.
- **Dependencias**: `asanaService`, `config.notificacionesEnabled`, `getAprobadorEmails`.

## RN-27 · Notificaciones: visibilidad y purga
- **Descripción**: `list(email)` retorna solo notificaciones con `targetEmail` == email (case-insensitive), ordenadas desc; purga (elimina) las leídas con más de 30 días.
- **Ubicación**: [src/services/notifications.service.ts](../src/services/notifications.service.ts#L110) (`list`)
- **Método**: `list(email)`
- **Entradas**: `email`.
- **Salidas**: `AppNotification[]`; efecto colateral de purga.
- **Validaciones**: comparación case-insensitive; `createdMs < limite (PURGE_DAYS=30)` y `completed`.
- **Excepciones**: nunca lanza; retorna `[]` en error.
- **Dependencias**: `asanaService.getProjectTasks/deleteTask`.

## RN-28 · Notificaciones: marcar leída
- **Descripción**: Marcar una notificación como leída completa la tarea (`completed=true`). Al abrir la campana se marcan todas las no leídas.
- **Ubicación**: [src/services/notifications.service.ts](../src/services/notifications.service.ts#L165) (`markRead`); disparo en `HomePage` (`handleNotifOpenChange`)
- **Método**: `markRead(gid)`
- **Entradas**: `gid`.
- **Salidas**: `updateTask(gid,{completed:true})`.
- **Validaciones**: `isEnabled()`.
- **Excepciones**: nunca lanza; `console.error`.
- **Dependencias**: `asanaService.updateTask`.

## RN-29 · Control de concurrencia y tasa (Asana)
- **Descripción**: Todas las llamadas pasan por semáforos (30 lecturas / 12 escrituras). Ante HTTP 429 se reintenta con `Retry-After` o backoff exponencial (máx. 3).
- **Ubicación**: [src/services/asana.service.ts](../src/services/asana.service.ts#L52) (`fetchAsana`, `Semaphore`)
- **Método**: `fetchAsana<T>(endpoint, options)`
- **Entradas**: endpoint, opciones (método).
- **Salidas**: `data.data` tipado.
- **Validaciones**: token presente; `MAX_RETRIES=3`.
- **Excepciones**: `'Token de acceso no configurado'`, `'Rate limit de Asana superado…'`, errores de Asana.
- **Dependencias**: `config.asanaToken`, `fetch`.

## RN-30 · Persistencia estructurada en `notes`
- **Descripción**: Toda escritura re-serializa el bloque `===DATOS_JSON===` eliminando el previo (regex) y anexando el JSON actualizado, preservando el texto legible base.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L900) (patrón en todos los `handle*`) y modales
- **Método**: patrón `notasBase.replace(/===DATOS_JSON===.../) + JSON.stringify`
- **Entradas**: `notes` actual + objeto de datos.
- **Salidas**: `notes` nuevas para `updateTask`.
- **Validaciones**: regex de reemplazo del bloque.
- **Excepciones**: dependen del handler.
- **Dependencias**: `extractJsonData`, `asanaService.updateTask`.

## RN-31 · Ordenamiento de solicitudes por fecha
- **Descripción**: Las solicitudes se ordenan por `fechaSolicitud` (desc); fechas ausentes (`-`) van al final.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L810) (`parseFechaSol`, `sort`)
- **Método**: `parseFechaSol(f)` + `sort`
- **Entradas**: `fecha: string` (`DD/MM/YYYY, HH:mm`).
- **Salidas**: timestamp para comparación.
- **Validaciones**: `f === '-'` ⇒ 0.
- **Excepciones**: ninguna.
- **Dependencias**: `extractFechaSolicitud`.

## RN-32 · Generación automática de PDF al crear solicitud
- **Descripción**: Tras crear una solicitud, se genera automáticamente su PDF (~500 ms) antes de cerrar el modal (~2 s).
- **Ubicación**: [src/components/MaterialRequestModal.tsx](../src/components/MaterialRequestModal.tsx#L82) (y homólogos SFON/DMAT)
- **Método**: `handleSubmit` → `export*ToPDF` en `setTimeout`
- **Entradas**: datos del formulario.
- **Salidas**: descarga de PDF; `onSuccess(titulo)`.
- **Validaciones**: se ejecuta solo tras `createSubtask` exitoso.
- **Excepciones**: heredadas de la creación.
- **Dependencias**: `pdf.service`.

## RN-33 · Codificación cromática de estado de almacén
- **Descripción**: Color por estado de almacén: ENTREGADO=verde, NO AUTORIZADO=rojo, NO EXISTENTE=naranja.
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx#L187) (`almacenColor`)
- **Método**: `almacenColor(v)`
- **Entradas**: `v: string`.
- **Salidas**: nombre de color (tag antd).
- **Validaciones**: comparación exacta con los 3 valores.
- **Excepciones**: `'default'` si no coincide.
- **Dependencias**: `ALMACEN_OPCIONES`.

## RN-34 · Archivado / Desarchivado de solicitudes por mes
- **Descripción**: Una solicitud aprobada cuyo ciclo SMAT↔SFON está aprobado puede archivarse: se marca `archivado=true` y `fechaArchivado` en el JSON de **ambas** subtareas (SMAT y su SFON anidada), retirándola de "Aprobadas" y mostrándola en la pestaña "Archivadas". El archivado es reversible (desarchivar ⇒ `archivado=false`). En "Archivadas" las solicitudes se agrupan en secciones colapsables por mes según `fechaAprobacion` de la SMAT (sección "Sin fecha" si falta), ordenadas de más reciente a más antigua. Las archivadas se excluyen del conteo de "Aprobadas".
- **Ubicación**: [src/pages/HomePage.tsx](../src/pages/HomePage.tsx) (`isArchivada`, `mesKeyFromFecha`, `mesLabelFromKey`, `writeArchivadoFlag`, `puedeArchivar`, `handleArchivar`, `handleDesarchivar`, `seccionesArchivadasPorMes`)
- **Método**: `handleArchivar(row)` / `handleDesarchivar(row)` + `writeArchivadoFlag(task, archivado)`
- **Entradas**: `row: SolicitudRow` (SMAT del grupo).
- **Salidas**: `updateTask` (PUT) en SMAT y SFON con el JSON actualizado; actualización local de listas.
- **Validaciones**: solo roles aprobadores (`canApprove`); `puedeArchivar` exige SMAT aprobada con SFON anidada aprobada; reescribe el bloque JSON preservando el texto legible (patrón RN-30).
- **Excepciones**: `alert('Error al archivar/desarchivar…')` + `console.error`; el estado local no cambia si falla.
- **Dependencias**: `asanaService.updateTask`, `extractJsonData`, `insertApprovedRow`, `matchSolicitud`. Fecha en `America/La_Paz`.

---

## Índice de reglas

| ID | Nombre | Módulo principal |
|---|---|---|
| RN-01 | Clasificación por prefijo | HomePage |
| RN-02 | Estado de solicitud | HomePage |
| RN-03 | Aprobación | HomePage |
| RN-04 | Observación | HomePage |
| RN-05 | Eliminación | HomePage |
| RN-06 | Estado de almacén | HomePage |
| RN-07 | Informe/Informe final | HomePage |
| RN-08 | Crear SMAT | MaterialRequestModal |
| RN-09 | Crear SFON | FundsRequestModal |
| RN-10 | Crear DMAT | MaterialReturnModal |
| RN-11 | SMAT↔SFON 1:1 | HomePage |
| RN-12 | Ejecutado (Estado) | HomePage |
| RN-13 | Atrasadas | HomePage |
| RN-14 | Próximas a vencer | HomePage |
| RN-15 | Estadísticas por proyecto | HomePage |
| RN-16 | Contrataciones activas | HomePage |
| RN-17 | Estados de contratación | ContratacionUpdateModal |
| RN-18 | Exclusiones de seguimiento | HomePage |
| RN-19 | Área del técnico | HomePage |
| RN-20 | Filtro por propietario | HomePage |
| RN-21 | Permisos por rol | permissions.ts |
| RN-22 | Acceso a páginas | App.tsx / permissions.ts |
| RN-23 | Área en Escuelas | permissions.ts |
| RN-24 | Autenticación local | AuthContext |
| RN-25 | Aprobadores | AuthContext |
| RN-26 | Notif.: eventos | notifications.service |
| RN-27 | Notif.: visibilidad/purga | notifications.service |
| RN-28 | Notif.: marcar leída | notifications.service |
| RN-29 | Concurrencia/tasa | asana.service |
| RN-30 | Persistencia en notes | HomePage/modales |
| RN-31 | Ordenamiento por fecha | HomePage |
| RN-32 | PDF automático | Modales |
| RN-33 | Color de almacén | HomePage |
| RN-34 | Archivado/Desarchivado por mes | HomePage |

---

### Documentos relacionados
- Especificación funcional: [specs/seguimiento-proyecto-y-solicitud-materiales.md](./seguimiento-proyecto-y-solicitud-materiales.md)
- Modelo de datos: [specs/modelo-de-datos.md](./modelo-de-datos.md)
- Arquitectura: [specs/arquitectura.md](./arquitectura.md)
</content>
