/**
 * Configuración de variables de entorno
 * 
 * Las variables de entorno en Vite deben tener el prefijo VITE_ para estar
 * disponibles en el cliente. Se acceden mediante import.meta.env
 */

interface Config {
  asanaToken: string;
  asanaWorkspaceId?: string;
  asanaProjectId?: string;
  apiUrl?: string;
  notificacionesEnabled: boolean;
}

const config: Config = {
  asanaToken: import.meta.env.VITE_ASANA_TOKEN || '',
  asanaWorkspaceId: import.meta.env.VITE_ASANA_WORKSPACE_ID,
  asanaProjectId: import.meta.env.VITE_ASANA_PROJECT_ID,
  apiUrl: import.meta.env.VITE_API_URL,
  // Bandera de notificaciones: desactivada por defecto. Solo se activa si
  // VITE_NOTIFICACIONES_ENABLED es exactamente la cadena "true".
  notificacionesEnabled: import.meta.env.VITE_NOTIFICACIONES_ENABLED === 'true',
};

export default config;
