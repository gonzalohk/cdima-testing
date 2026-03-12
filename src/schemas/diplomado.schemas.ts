/**
 * Schemas de validación con Zod para datos de Diplomados
 * 
 * Estos schemas validan que los datos tengan el formato correcto
 * antes de guardarlos en Asana, previniendo errores de formato.
 */

import { z } from 'zod';

/**
 * Schema para validar datos de estudiante
 */
export const EstudianteDataSchema = z.object({
  genero: z.string().min(1, 'Género es requerido'),
  telefono: z.string().optional(),
  lugarNacimiento: z.string().optional(),
  documentoIdentidad: z.string().optional(),
  identidadCultural: z.string().optional(),
  observaciones: z.string().optional(),
});

/**
 * Schema para validar datos de docente
 */
export const DocenteDataSchema = z.object({
  genero: z.string().min(1, 'Género es requerido'),
  telefono: z.string().optional(),
  especialidad: z.string().optional(),
  experiencia: z.string().optional(),
  observaciones: z.string().optional(),
});

/**
 * Schema para validar un registro de asistencia individual
 */
export const AsistenciaRecordSchema = z.object({
  fecha: z.string().regex(
    /^\d{2}\/\d{2}\/\d{4}$/,
    'Fecha debe estar en formato DD/MM/YYYY'
  ),
  asistio: z.boolean(),
  observaciones: z.string(),
});

/**
 * Schema para validar array de asistencias
 */
export const AsistenciaRecordsSchema = z.array(AsistenciaRecordSchema);

/**
 * Schema para validar notas de módulo (0-100)
 */
export const NotaModuloSchema = z.number()
  .min(0, 'Nota no puede ser negativa')
  .max(100, 'Nota no puede ser mayor a 100');

/**
 * Schema para validar un estudiante completo con notas
 */
export const EstudianteCompletoSchema = EstudianteDataSchema.extend({
  nombre: z.string().min(1, 'Nombre es requerido'),
  gid: z.string().min(1, 'GID de Asana es requerido'),
  modulo1: NotaModuloSchema.optional().default(0),
  modulo2: NotaModuloSchema.optional().default(0),
  modulo3: NotaModuloSchema.optional().default(0),
  modulo4: NotaModuloSchema.optional().default(0),
  modulo5: NotaModuloSchema.optional().default(0),
});

/**
 * Schema para validar un docente completo
 */
export const DocenteCompletoSchema = DocenteDataSchema.extend({
  nombre: z.string().min(1, 'Nombre es requerido'),
  gid: z.string().min(1, 'GID de Asana es requerido'),
});

/**
 * Schema para validar datos al guardar asistencia
 */
export const GuardarAsistenciaSchema = z.object({
  fecha: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Fecha debe estar en formato YYYY-MM-DD'
  ),
  asistencias: z.array(z.object({
    gid: z.string().min(1),
    nombre: z.string().min(1),
    asistio: z.boolean(),
    observaciones: z.string(),
  })).min(1, 'Debe haber al menos una asistencia'),
});

/**
 * Tipos TypeScript derivados de los schemas
 */
export type EstudianteData = z.infer<typeof EstudianteDataSchema>;
export type DocenteData = z.infer<typeof DocenteDataSchema>;
export type AsistenciaRecord = z.infer<typeof AsistenciaRecordSchema>;
export type EstudianteCompleto = z.infer<typeof EstudianteCompletoSchema>;
export type DocenteCompleto = z.infer<typeof DocenteCompletoSchema>;
export type GuardarAsistenciaData = z.infer<typeof GuardarAsistenciaSchema>;

/**
 * Helper para validar datos con mejor manejo de errores
 * 
 * @param schema - Schema de Zod a usar
 * @param data - Datos a validar
 * @param errorMessage - Mensaje personalizado si falla
 * @returns Resultado con success y data o error
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: errorMessage ? `${errorMessage}: ${errors}` : errors,
      };
    }
    return {
      success: false,
      error: errorMessage || 'Error de validación desconocido',
    };
  }
}

/**
 * Safe parse que retorna datos parciales si falla
 * Útil para backward compatibility con datos legacy
 */
export function safeParseWithDefaults<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  defaults: T
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    console.warn('Validación falló, usando valores por defecto:', error);
    return defaults;
  }
}
