// ============================================================
// permissions.ts — Roles, permisos y páginas permitidas
// Para dar/quitar acceso: editar ROLE_PERMISSIONS o ROLE_PAGES
// ============================================================

export type UserRole = 'admin' | 'tecnico' | 'comunicacion' | 'direccion';

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
  | 'diplomados.exportar';

// ─────────────────────────────────────────────────────────────
// Qué puede hacer cada rol
// ─────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
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
  ],

  tecnico: [
    'home.solicitud.ver_detalle',
    'reporte.solicitud.crear',
    'reporte.subactividad.cambiar_estado',
    'reporte.subactividad.beneficiarios',
    'reporte.fuentes.agregar',
    'reporte.exportar',
    'escuelas.asistencia.registrar',
    'escuelas.notas.registrar',
    'escuelas.exportar',
    'diplomados.asistencia.registrar',
    'diplomados.notas.registrar',
    'diplomados.exportar',
  ],

  comunicacion: [
    'home.solicitud.ver_detalle',
    'reporte.solicitud.crear',
    'reporte.exportar',
    'escuelas.exportar',
    'diplomados.exportar',
  ],

  direccion: [
    'home.solicitud.ver_detalle',
    'home.solicitud.aprobar',
    'home.solicitud.observar',
    'reporte.solicitud.aprobar',
    'reporte.solicitud.observar',
    'reporte.exportar',
    'escuelas.exportar',
    'diplomados.exportar',
  ],
};

// ─────────────────────────────────────────────────────────────
// Qué páginas puede visitar cada rol
// ─────────────────────────────────────────────────────────────
export const ROLE_PAGES: Record<UserRole, string[]> = {
  admin:        ['/', '/report', '/planificacion', '/biblioteca', '/escuelas', '/diplomados', '/produccion-alto-nivel', '/investigacion-e-incidencia'],
  tecnico:      ['/', '/report', '/planificacion', '/biblioteca', '/escuelas', '/diplomados'],
  comunicacion: ['/', '/report', '/biblioteca'],
  direccion:    ['/', '/report', '/planificacion'],
};
