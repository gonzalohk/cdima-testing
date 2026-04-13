// ============================================================
// permissions.ts — Roles, permisos y páginas permitidas
// Para dar/quitar acceso: editar ROLE_PERMISSIONS o ROLE_PAGES
// ============================================================

export type UserRole = 'administrador' | 'tecnico ev' | 'tecnico ep' | 'comunicacion' | 'director' | 'planificador';

export type Permission =
  // ── Home ────────────────────────────────────────────────
  | 'home.solicitud.ver_detalle'
  | 'home.solicitud.aprobar'
  | 'home.solicitud.observar'
  // ── Reportes: escritura ──────────────────────────────────
  | 'reporte.solicitud.crear'
  | 'reporte.solicitud.aprobar'
  | 'reporte.solicitud.observar'
  | 'reporte.solicitud.eliminar'
  | 'reporte.subactividad.cambiar_estado'
  | 'reporte.subactividad.beneficiarios'
  | 'reporte.fuentes.agregar'
  | 'reporte.contratacion.actualizar_estado'
  // ── Reportes: exportación / lectura ─────────────────────
  | 'reporte.exportar'
  // ── Escuelas: escritura ──────────────────────────────────
  | 'escuelas.crear'
  | 'escuelas.editar'
  | 'escuelas.asistencia.registrar'
  | 'escuelas.notas.registrar'
  // ── Escuelas: exportación ────────────────────────────────
  | 'escuelas.exportar'
  // ── Diplomados: escritura ────────────────────────────────
  | 'diplomados.crear'
  | 'diplomados.editar'
  | 'diplomados.asistencia.registrar'
  | 'diplomados.notas.registrar'
  // ── Diplomados: exportación ──────────────────────────────
  | 'diplomados.exportar'
  // ── Cursos de Alto Nivel: escritura ─────────────────────
  | 'alto-nivel.crear'
  | 'alto-nivel.editar'
  | 'alto-nivel.asistencia.registrar'
  | 'alto-nivel.notas.registrar'
  // ── Cursos de Alto Nivel: exportación ───────────────────
  | 'alto-nivel.exportar'
  // ── Investigación e Incidencia ───────────────────────────
  | 'investigacion.documentos.gestionar';

// ─────────────────────────────────────────────────────────────
// Qué puede hacer cada rol
// Solo "director" y "administrador" pueden aprobar u observar solicitudes
// ─────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  director: [
    'home.solicitud.ver_detalle',
    'home.solicitud.aprobar',
    'home.solicitud.observar',
    'reporte.solicitud.crear',
    'reporte.solicitud.aprobar',
    'reporte.solicitud.observar',
    'reporte.solicitud.eliminar',
    'reporte.subactividad.cambiar_estado',
    'reporte.subactividad.beneficiarios',
    'reporte.fuentes.agregar',
    'reporte.contratacion.actualizar_estado',
    'reporte.exportar',
    'escuelas.crear',
    'escuelas.editar',
    'escuelas.asistencia.registrar',
    'escuelas.notas.registrar',
    'escuelas.exportar',
    'diplomados.crear',
    'diplomados.editar',
    'diplomados.asistencia.registrar',
    'diplomados.notas.registrar',
    'diplomados.exportar',
    'alto-nivel.crear',
    'alto-nivel.editar',
    'alto-nivel.asistencia.registrar',
    'alto-nivel.notas.registrar',
    'alto-nivel.exportar',
    'investigacion.documentos.gestionar',
  ],

  administrador: [
    'home.solicitud.ver_detalle',
    'home.solicitud.aprobar',
    'home.solicitud.observar',
    'reporte.solicitud.crear',
    'reporte.solicitud.aprobar',
    'reporte.solicitud.observar',
    'reporte.solicitud.eliminar',
    'reporte.subactividad.cambiar_estado',
    'reporte.subactividad.beneficiarios',
    'reporte.fuentes.agregar',
    'reporte.contratacion.actualizar_estado',
    'reporte.exportar',
    'investigacion.documentos.gestionar',
  ],

  'tecnico ev': [
    'home.solicitud.ver_detalle',
    'reporte.solicitud.crear',
    'reporte.subactividad.cambiar_estado',
    'reporte.subactividad.beneficiarios',
    'reporte.fuentes.agregar',
    'reporte.contratacion.actualizar_estado',
    'reporte.exportar',
    'investigacion.documentos.gestionar',
  ],

  'tecnico ep': [
    'home.solicitud.ver_detalle',
    'reporte.solicitud.crear',
    'reporte.subactividad.cambiar_estado',
    'reporte.subactividad.beneficiarios',
    'reporte.fuentes.agregar',
    'reporte.contratacion.actualizar_estado',
    'reporte.exportar',
    'escuelas.crear',
    'escuelas.editar',
    'escuelas.asistencia.registrar',
    'escuelas.notas.registrar',
    'escuelas.exportar',
    'diplomados.crear',
    'diplomados.editar',
    'diplomados.asistencia.registrar',
    'diplomados.notas.registrar',
    'diplomados.exportar',
    'alto-nivel.crear',
    'alto-nivel.editar',
    'alto-nivel.asistencia.registrar',
    'alto-nivel.notas.registrar',
    'alto-nivel.exportar',
    'investigacion.documentos.gestionar',
  ],

  comunicacion: [
    'home.solicitud.ver_detalle',
    'reporte.solicitud.crear',
    'reporte.exportar',
    'investigacion.documentos.gestionar',
  ],

  planificador: [
    'reporte.exportar',
    'investigacion.documentos.gestionar',
  ],
};

// ─────────────────────────────────────────────────────────────
// Qué páginas puede visitar cada rol
// ─────────────────────────────────────────────────────────────
export const ROLE_PAGES: Record<UserRole, string[]> = {
  director:      ['/', '/report', '/planificacion', '/biblioteca', '/escuelas', '/diplomados', '/produccion-alto-nivel', '/investigacion-e-incidencia'],
  administrador: ['/', '/report', '/biblioteca', '/planificacion', '/investigacion-e-incidencia'],
  'tecnico ev':  ['/report', '/', '/biblioteca', '/planificacion', '/escuelas','/investigacion-e-incidencia'],
  'tecnico ep':  ['/report', '/', '/biblioteca', '/planificacion', '/escuelas', '/diplomados', '/produccion-alto-nivel', '/investigacion-e-incidencia'],
  comunicacion:   ['/report', '/biblioteca', '/planificacion', '/investigacion-e-incidencia'],
  planificador:   ['/biblioteca', '/planificacion'],
};

// ─────────────────────────────────────────────────────────────
// Restricción de área para escuelas
// Si el rol aparece aquí, solo verá escuelas cuya tarea "Resumen:"
// tenga el campo "Area" igual al valor indicado.
// Roles ausentes (director, administrador, comunicacion, etc.) ven todas.
// ─────────────────────────────────────────────────────────────
export const ROLE_ESCUELA_AREA: Partial<Record<UserRole, string>> = {
  'tecnico ev': 'Erradicación de violencia',
  'tecnico ep': 'Empoderamiento político',
};
