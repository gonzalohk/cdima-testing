/**
 * Constantes para nombres de campos personalizados de Asana
 * 
 * Centraliza todos los nombres de campos personalizados para evitar typos
 * y facilitar refactorizaciones futuras.
 * 
 * IMPORTANTE: Si cambias nombres de campos en Asana, actualizar aquí.
 */

export const ASANA_CUSTOM_FIELDS = {
  // ============================================
  // CAMPOS DE DIPLOMADOS (Estudiantes/Docentes)
  // ============================================
  MODULO_1: 'Módulo 1',
  MODULO_2: 'Módulo 2',
  MODULO_3: 'Módulo 3',
  MODULO_4: 'Módulo 4',
  MODULO_5: 'Módulo 5',
  
  // ============================================
  // CAMPOS DE ESCUELAS (Estudiantes/Docentes) - 7 Módulos
  // ============================================
  MODULO_6: 'Módulo 6',
  MODULO_7: 'Módulo 7',
  MODULO_8: 'Módulo 8',
  MODULO_9: 'Módulo 9',
  MODULO_10: 'Módulo 10',
  TIPO_ESCUELA: 'Tipo de Escuela',
  AREA_ESCUELA: 'Area',
  NUMERO_MODULOS: 'Número de módulos',
  
  // ============================================
  // CAMPOS DE PLANIFICACIÓN
  // ============================================
  ESTADO: 'Estado',
  AREA: 'Area',
  RESPONSABLES: 'Responsables de actividad',
  
  // ============================================
  // CAMPOS DE REPORTES
  // ============================================
  MUNICIPIO: 'Municipio',
  FECHA_INICIO: 'Fecha inicio',
  FECHA_FIN: 'Fecha fin',
  ESTADO_CONTRATACION: 'Estado de contratación',
  
  // ============================================
  // VALORES ESPERADOS PARA ESTADO
  // ============================================
  ESTADO_VALORES: {
    EJECUTADO: 'Ejecutado',
    EN_PROCESO: 'En Proceso',
    PENDIENTE: 'En Proceso',
  },
  
  // ============================================
  // VALORES ESPERADOS PARA GÉNERO
  // ============================================
  GENERO_VALORES: {
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    OTRO: 'Otro',
  },
  
  // ============================================
  // VALORES ESPERADOS PARA TIPO DE ESCUELA
  // ============================================
  TIPO_ESCUELA_VALORES: {
    LIDERAZGO_SOCIAL: 'Liderazgo Social',
    LIDERAZGO_GESTION: 'Liderazgo de Gestión',
  },
  AREA_ESCUELA_VALORES: {
    EMPODERAMIENTO_POLITICO: 'Empoderamiento político',
    ERRADICACION_VIOLENCIA: 'Erradicación de violencia',
    OTRO: 'Otro',
  },
} as const;

/**
 * Tipos derivados de las constantes
 */
export type EstadoValor = typeof ASANA_CUSTOM_FIELDS.ESTADO_VALORES[keyof typeof ASANA_CUSTOM_FIELDS.ESTADO_VALORES];
export type GeneroValor = typeof ASANA_CUSTOM_FIELDS.GENERO_VALORES[keyof typeof ASANA_CUSTOM_FIELDS.GENERO_VALORES];
export type TipoEscuelaValor = typeof ASANA_CUSTOM_FIELDS.TIPO_ESCUELA_VALORES[keyof typeof ASANA_CUSTOM_FIELDS.TIPO_ESCUELA_VALORES];

/**
 * Helper para verificar si un valor es un estado válido
 */
export function isValidEstado(value: string): value is EstadoValor {
  return Object.values(ASANA_CUSTOM_FIELDS.ESTADO_VALORES).includes(value as EstadoValor);
}

/**
 * Helper para verificar si un valor es un género válido
 */
export function isValidGenero(value: string): value is GeneroValor {
  return Object.values(ASANA_CUSTOM_FIELDS.GENERO_VALORES).includes(value as GeneroValor);
}
