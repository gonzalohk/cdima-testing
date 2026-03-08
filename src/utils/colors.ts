/**
 * Genera un color pastel único y consistente basado en un string (ID de tarea)
 * Utiliza un hash simple para asegurar que el mismo ID siempre genere el mismo color
 */

// Paleta de colores pastel suaves
const pastelColors = [
  { bg: '#FFE5E5', border: '#FFB3B3', text: '#CC0000' }, // Rosa suave
  { bg: '#FFE5CC', border: '#FFB380', text: '#CC5200' }, // Naranja suave
  { bg: '#FFF4E5', border: '#FFD699', text: '#CC8800' }, // Amarillo suave
  { bg: '#E5F4E5', border: '#99D699', text: '#006600' }, // Verde suave
  { bg: '#E5F9FF', border: '#99E6FF', text: '#0066CC' }, // Azul cielo suave
  { bg: '#E5E5FF', border: '#B3B3FF', text: '#3333CC' }, // Azul suave
  { bg: '#F0E5FF', border: '#D4B3FF', text: '#6600CC' }, // Púrpura suave
  { bg: '#FFE5F4', border: '#FFB3E0', text: '#CC0066' }, // Magenta suave
  { bg: '#E5FFFF', border: '#99FFFF', text: '#006666' }, // Cyan suave
  { bg: '#F5E5FF', border: '#E0B3FF', text: '#7700CC' }, // Lavanda suave
  { bg: '#FFE5E0', border: '#FFB3A3', text: '#CC3300' }, // Coral suave
  { bg: '#E5FFE5', border: '#B3FFB3', text: '#00CC00' }, // Verde menta suave
  { bg: '#E5F0FF', border: '#B3D4FF', text: '#0033CC' }, // Azul claro suave
  { bg: '#FFF0E5', border: '#FFD9B3', text: '#CC6600' }, // Durazno suave
  { bg: '#FFE5F0', border: '#FFB3D9', text: '#CC0033' }, // Rosa claro suave
  { bg: '#E5FFE0', border: '#B3FFA3', text: '#00CC33' }, // Verde lima suave
  { bg: '#E5ECFF', border: '#B3C7FF', text: '#0044CC' }, // Azul periwinkle
  { bg: '#FFF5E5', border: '#FFE0B3', text: '#CC7700' }, // Crema suave
  { bg: '#F8E5FF', border: '#E8B3FF', text: '#8800CC' }, // Violeta suave
  { bg: '#E5FFF5', border: '#B3FFE0', text: '#00CC66' }, // Turquesa suave
];

/**
 * Función hash simple para convertir un string en un número
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Obtiene un color pastel consistente para un ID de tarea
 */
export function getTaskColor(taskId: string): { bg: string; border: string; text: string } {
  const hash = hashString(taskId);
  const index = hash % pastelColors.length;
  return pastelColors[index];
}

/**
 * Obtiene solo el color de fondo para usar en estilos simples
 */
export function getTaskBackgroundColor(taskId: string): string {
  return getTaskColor(taskId).bg;
}

/**
 * Obtiene solo el color del borde para usar en estilos simples
 */
export function getTaskBorderColor(taskId: string): string {
  return getTaskColor(taskId).border;
}

/**
 * Obtiene solo el color del texto para usar en estilos simples
 */
export function getTaskTextColor(taskId: string): string {
  return getTaskColor(taskId).text;
}
