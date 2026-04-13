/**
 * Utilidades helper para trabajar con datos de Asana de forma robusta
 * 
 * Estas funciones manejan casos edge y proveen valores por defecto
 * para evitar crashes cuando los datos tienen formato inesperado.
 */

import type { AsanaTask } from '../types/asana.types';

/**
 * Extrae el valor de un campo personalizado de forma segura
 * 
 * Intenta múltiples fuentes de valor y retorna un default si ninguna funciona.
 * Esto previene crashes cuando campos no existen o tienen formato inesperado.
 * 
 * @param task - Tarea de Asana
 * @param fieldName - Nombre del campo personalizado
 * @param defaultValue - Valor por defecto si no se encuentra
 * @returns Valor del campo o defaultValue
 * 
 * @example
 * ```typescript
 * const nota = getCustomFieldValueSafe(task, 'Módulo 1', 0);
 * // nota = 75 (si existe) o 0 (si no existe)
 * ```
 */
export function getCustomFieldValueSafe<T = any>(
  task: AsanaTask | undefined | null,
  fieldName: string,
  defaultValue: T
): T {
  try {
    // Validar que task existe y tiene custom_fields
    if (!task || !task.custom_fields) {
      console.warn(`Task o custom_fields undefined para campo '${fieldName}'`);
      return defaultValue;
    }
    
    // Buscar el campo
    const field = task.custom_fields.find(f => f.name === fieldName);
    
    if (!field) {
      console.warn(`Campo personalizado '${fieldName}' no encontrado en tarea ${task.gid || 'unknown'}`);
      return defaultValue;
    }
    
    // Intentar múltiples fuentes de valor (orden de prioridad)
    const value = field.number_value 
      ?? (field.text_value ? parseFloat(field.text_value) : undefined)
      ?? (field.display_value ? parseFloat(field.display_value) : undefined)
      ?? field.text_value 
      ?? field.display_value 
      ?? defaultValue;
    
    return value as T;
  } catch (error) {
    console.error(`Error obteniendo campo '${fieldName}':`, error);
    return defaultValue;
  }
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento.
 * Soporta los formatos:
 *   - DD/MM/YYYY  (formato boliviano con barras)
 *   - DD-MM-YYYY  (formato boliviano con guiones)
 *   - YYYY-MM-DD  (ISO 8601, salida de <input type="date">)
 *   - YYYY/MM/DD  (ISO con barras)
 *
 * Devuelve '—' cuando la fecha está vacía o no se puede interpretar.
 */
export function calcularEdad(fechaNacimiento: string | undefined | null): string {
  if (!fechaNacimiento) return '—';
  const s = fechaNacimiento.trim();
  if (!s) return '—';

  let day = 0, month = 0, year = 0;

  // DD/MM/YYYY o DD-MM-YYYY
  const mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mDMY) {
    day   = +mDMY[1];
    month = +mDMY[2];
    year  = +mDMY[3];
  } else {
    // YYYY-MM-DD o YYYY/MM/DD
    const mYMD = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (mYMD) {
      year  = +mYMD[1];
      month = +mYMD[2];
      day   = +mYMD[3];
    }
  }

  if (!day || !month || !year) return '—';

  const bd = new Date(year, month - 1, day);
  if (isNaN(bd.getTime())) return '—';

  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  ) age--;

  return (age >= 0 && age < 120) ? String(age) : '—';
}

/**
 * Sanitiza un valor de texto para evitar que backticks (`) rompan los bloques
 * de código markdown usados para almacenar JSON en Asana.
 */
function sanitizeJsonValue(value: string): string {
  return value.replace(/`/g, "'");
}

/**
 * Estructura de datos para Estudiante/Docente
 */
export interface EstudianteData {
  genero: string;
  telefono?: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  domicilio?: string;
  documentoIdentidad?: string;
  identidadCultural?: string;
  observaciones?: string;
  // Campo adicional solicitado
  especialidad?: string;
  // Campo legacy de docentes
  experiencia?: string;
  /** true cuando el JSON no pudo parsearse o validarse correctamente */
  _parseError?: boolean;
}

/**
 * Estructura de datos para registro de asistencia
 */
export interface AsistenciaRecord {
  fecha: string; // formato: DD/MM/YYYY
  asistio: boolean;
  observaciones: string;
}

/**
 * Parsea datos de estudiante/docente desde las notas de Asana
 * 
 * NUEVO FORMATO: Intenta parsear JSON estructurado primero
 * LEGACY: Si no hay JSON, intenta regex (backward compatibility)
 * 
 * @param notes - Notas de la tarea de Asana
 * @returns Datos parseados o valores por defecto
 * 
 * @example
 * ```typescript
 * // Formato JSON (nuevo):
 * const notes = `
 * === DATOS ESTUDIANTE ===
 * \`\`\`json
 * {
 *   "genero": "Masculino",
 *   "telefono": "555-1234",
 *   "lugarNacimiento": "La Paz"
 * }
 * \`\`\`
 * `;
 * 
 * // Formato regex (legacy):
 * const notes = `
 * === DATOS ESTUDIANTE ===
 * Género: Masculino
 * Teléfono: 555-1234
 * `;
 * ```
 */
export function parseEstudianteData(notes: string | undefined | null): EstudianteData {
  // Valores por defecto seguros
  const defaultData: EstudianteData = {
    genero: 'No especificado',
    telefono: '',
    lugarNacimiento: '',
    fechaNacimiento: '',
    domicilio: '',
    documentoIdentidad: '',
    identidadCultural: '',
  };
  
  if (!notes) {
    return defaultData;
  }
  
  try {
    // INTENTO 1: Parsear JSON estructurado (formato nuevo)
    const jsonMatch = notes.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        // Verificar que el objeto tiene al menos una clave esperada
        if (typeof parsed === 'object' && parsed !== null && 'genero' in parsed) {
          return { ...defaultData, ...parsed };
        }
        // Estructura inesperada — datos posiblemente editados manualmente en Asana
        console.warn('JSON parseado pero estructura inesperada:', parsed);
        return { ...defaultData, _parseError: true };
      } catch (jsonError) {
        console.warn('Error parseando JSON de estudiante:', jsonError);
        return { ...defaultData, _parseError: true };
      }
    }
    
    // INTENTO 2: Extraer de sección "=== DATOS ESTUDIANTE ===" (formato nuevo estructurado)
    const datosMatch = notes.match(/=== DATOS ESTUDIANTE ===\s*\n```json\s*\n([\s\S]*?)\n```/);
    if (datosMatch && datosMatch[1]) {
      try {
        const parsed = JSON.parse(datosMatch[1]);
        if (typeof parsed === 'object' && parsed !== null && 'genero' in parsed) {
          return { ...defaultData, ...parsed };
        }
        console.warn('JSON de sección DATOS ESTUDIANTE con estructura inesperada:', parsed);
        return { ...defaultData, _parseError: true };
      } catch (jsonError) {
        console.warn('Error parseando JSON de sección DATOS ESTUDIANTE:', jsonError);
        return { ...defaultData, _parseError: true };
      }
    }
    
    // INTENTO 3: Regex para formato legacy (backward compatibility)
    return parseLegacyFormat(notes, defaultData);
    
  } catch (error) {
    console.error('Error parseando datos de estudiante:', error);
    return { ...defaultData, _parseError: true };
  }
}

/**
 * Parsea formato legacy usando regex (backward compatibility)
 */
function parseLegacyFormat(notes: string, defaultData: EstudianteData): EstudianteData {
  try {
    const generoMatch = notes.match(/Género:\s*(.+)/i);
    const telefonoMatch = notes.match(/Teléfono:\s*(.+)/i);
    const lugarMatch = notes.match(/Lugar de Nacimiento:\s*(.+)/i);
    const fechaNacimientoMatch = notes.match(/Fecha de Nacimiento:\s*(.+)/i);
    const domicilioMatch = notes.match(/Domicilio:\s*(.+)/i);
    const documentoMatch = notes.match(/Documento de Identidad:\s*(.+)/i);
    const identidadMatch = notes.match(/Identidad Cultural:\s*(.+)/i);
    const especialidadMatch = notes.match(/Especialidad:\s*(.+)/i);
    const experienciaMatch = notes.match(/Experiencia:\s*(.+)/i);
    
    return {
      genero: generoMatch?.[1]?.trim() || defaultData.genero,
      telefono: telefonoMatch?.[1]?.trim() || defaultData.telefono,
      lugarNacimiento: lugarMatch?.[1]?.trim() || defaultData.lugarNacimiento,
      fechaNacimiento: fechaNacimientoMatch?.[1]?.trim() || defaultData.fechaNacimiento,
      domicilio: domicilioMatch?.[1]?.trim() || defaultData.domicilio,
      documentoIdentidad: documentoMatch?.[1]?.trim() || defaultData.documentoIdentidad,
      identidadCultural: identidadMatch?.[1]?.trim() || defaultData.identidadCultural,
      especialidad: especialidadMatch?.[1]?.trim(),
      experiencia: experienciaMatch?.[1]?.trim(),
    };
  } catch (error) {
    console.error('Error parseando formato legacy:', error);
    return defaultData;
  }
}

/**
 * Serializa datos de estudiante/docente a formato JSON estructurado
 * 
 * @param data - Datos a serializar
 * @returns String con formato JSON en markdown
 * 
 * @example
 * ```typescript
 * const serialized = serializeEstudianteData({
 *   genero: 'Masculino',
 *   telefono: '555-1234'
 * });
 * // Resultado:
 * // === DATOS ESTUDIANTE ===
 * // ```json
 * // {
 * //   "genero": "Masculino",
 * //   "telefono": "555-1234"
 * // }
 * // ```
 * ```
 */
export function serializeEstudianteData(data: EstudianteData): string {
  // Excluir la flag interna _parseError y sanitizar valores con backticks
  const cleanData = Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => key !== '_parseError' && value !== undefined && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? sanitizeJsonValue(value) : value])
  );
  
  return `=== DATOS ESTUDIANTE ===
\`\`\`json
${JSON.stringify(cleanData, null, 2)}
\`\`\``;
}

/**
 * Parsea registros de asistencia desde las notas
 * 
 * @param notes - Notas de la tarea
 * @returns Array de registros de asistencia
 */
export function parseAsistenciaRecords(notes: string | undefined | null): AsistenciaRecord[] {
  if (!notes) return [];
  
  try {
    // INTENTO 1: JSON estructurado
    const jsonMatch = notes.match(/=== REGISTRO DE ASISTENCIA ===\s*\n```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return Array.isArray(parsed) ? parsed : [];
      } catch (jsonError) {
        console.warn('Error parseando JSON de asistencia:', jsonError);
      }
    }
    
    // INTENTO 2: Formato legacy con regex
    const seccionAsistencia = notes.split('=== REGISTRO DE ASISTENCIA ===')[1];
    if (!seccionAsistencia) return [];
    
    const lineas = seccionAsistencia
      .split('\n')
      .filter(linea => linea.trim() && !linea.includes('==='));
    
    return lineas.map(linea => {
      const fechaMatch = linea.match(/^(\d{2}\/\d{2}\/\d{4})/);
      const asistioMatch = linea.match(/Asistió:\s*(Sí|No)/i);
      const observacionesMatch = linea.match(/Observaciones:\s*(.+)$/i);
      
      return {
        fecha: fechaMatch?.[1] || '',
        asistio: asistioMatch?.[1]?.toLowerCase() === 'sí',
        observaciones: observacionesMatch?.[1]?.trim() || 'Ninguna',
      };
    }).filter(record => record.fecha); // Solo registros válidos con fecha
    
  } catch (error) {
    console.error('Error parseando asistencia:', error);
    return [];
  }
}

/**
 * Serializa registros de asistencia a formato JSON estructurado
 * 
 * @param records - Array de registros de asistencia
 * @returns String con formato JSON
 */
export function serializeAsistenciaRecords(records: AsistenciaRecord[]): string {
  return `=== REGISTRO DE ASISTENCIA ===
\`\`\`json
${JSON.stringify(records, null, 2)}
\`\`\``;
}

/**
 * Combina notas existentes con nuevos datos de asistencia
 * Preserva la sección de DATOS ESTUDIANTE y actualiza ASISTENCIA
 * 
 * @param existingNotes - Notas existentes
 * @param newRecords - Nuevos registros de asistencia
 * @returns Notas actualizadas
 */
export function updateNotasWithAsistencia(
  existingNotes: string,
  newRecords: AsistenciaRecord[]
): string {
  // Extraer datos de estudiante si existen
  const datosMatch = existingNotes.match(/(=== DATOS ESTUDIANTE ===[\s\S]*?)(?==== OBSERVACIONES|=== REGISTRO|$)/);
  const datosSection = datosMatch ? datosMatch[1].trim() : '';

  // Preservar sección de observaciones de notas si existe
  const obsMatch = existingNotes.match(/(=== OBSERVACIONES NOTAS ===[\s\S]*?)(?==== REGISTRO|$)/);
  const obsSection = obsMatch ? obsMatch[1].trim() : '';

  // Combinar secciones
  const parts = [datosSection, obsSection, serializeAsistenciaRecords(newRecords)].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Parsea las observaciones de notas por módulo desde las notas del task.
 * Returns a map of module name → observation text.
 */
export function parseNotasObservaciones(notes: string | undefined | null): Record<string, string> {
  if (!notes) return {};
  try {
    const jsonMatch = notes.match(/=== OBSERVACIONES NOTAS ===\s*\n```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      return typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null ? parsed : {};
    }
  } catch {}
  return {};
}

/**
 * Updates (or creates) the observaciones for a specific module in task notes,
 * preserving all other sections (DATOS ESTUDIANTE, REGISTRO DE ASISTENCIA).
 */
export function setNotaObservacion(
  existingNotes: string,
  moduloNombre: string,
  observacion: string
): string {
  const datosMatch = existingNotes.match(/(=== DATOS ESTUDIANTE ===[\s\S]*?)(?==== OBSERVACIONES|=== REGISTRO|$)/);
  const datosSection = datosMatch ? datosMatch[1].trim() : '';

  const asistenciaMatch = existingNotes.match(/(=== REGISTRO DE ASISTENCIA ===[\s\S]*?)$/);
  const asistenciaSection = asistenciaMatch ? asistenciaMatch[1].trim() : '';

  const obsActuales = parseNotasObservaciones(existingNotes);
  if (observacion.trim()) {
    obsActuales[moduloNombre] = observacion.trim();
  } else {
    delete obsActuales[moduloNombre];
  }

  const obsSection = Object.keys(obsActuales).length > 0
    ? `=== OBSERVACIONES NOTAS ===\n\`\`\`json\n${JSON.stringify(obsActuales, null, 2)}\n\`\`\``
    : '';

  const parts = [datosSection, obsSection, asistenciaSection].filter(Boolean);
  return parts.join('\n\n');
}
