# 📚 Documentación - Diplomados y Escuelas CDIMA

## 📋 Índice
- [Resumen General](#resumen-general)
- [Arquitectura de Datos en Asana](#arquitectura-de-datos-en-asana)
- [Funcionalidades](#funcionalidades)
- [Gestión de Diplomados](#gestión-de-diplomados)
- [Gestión de Escuelas](#gestión-de-escuelas)
- [Sistema de Asistencia](#sistema-de-asistencia)
- [Sistema de Notas](#sistema-de-notas)
- [Reportes Disponibles](#reportes-disponibles)
- [Validación de Datos](#validación-de-datos)
- [Campos Personalizados](#campos-personalizados)

---

## 🎯 Resumen General

El sistema de **Diplomados y Escuelas** permite a CDIMA gestionar programas educativos completos, incluyendo:

- ✅ **Registro de estudiantes y docentes** con información completa
- ✅ **Control de asistencia** por fecha con observaciones
- ✅ **Registro de notas** por módulo (5 módulos para diplomados, 7 para escuelas)
- ✅ **Actualización automática de notas** según inasistencias
- ✅ **3 tipos de reportes en PDF** por programa:
  - Reporte General (estudiantes y docentes)
  - Centralizador de Notas
  - Reporte Individual por Estudiante
- ✅ **Validación robusta** con Zod schemas
- ✅ **Soporte para datos legacy** (backward compatibility)

### Diferencias Clave entre Diplomados y Escuelas

| Característica | Diplomados | Escuelas |
|---------------|-----------|----------|
| **Módulos** | 5 módulos | 7 módulos |
| **Campos adicionales** | - | Tipo de Escuela |
| **Tipos de Escuela** | N/A | Liderazgo Social / Liderazgo de Gestión |
| **Página** | `/diplomados` | `/escuelas` |
| **Proyecto Asana** | "Diplomados" | "Escuelas CDIMA" |

---

## 🏗️ Arquitectura de Datos en Asana

### Estructura Jerárquica

```
WORKSPACE: CDIMA
│
├── PROYECTO: Diplomados
│   │
│   ├── SECCIÓN: Diplomado en Gestión Pública
│   │   ├── TAREA: Docentes
│   │   │   ├── SUBTAREA: García Torres, María Elena
│   │   │   ├── SUBTAREA: Pérez López, Juan Carlos
│   │   │   └── ...
│   │   │
│   │   ├── TAREA: Estudiantes
│   │   │   ├── SUBTAREA: Mamani Quispe, Rosa
│   │   │   ├── SUBTAREA: Condori Flores, Pedro
│   │   │   └── ...
│   │   │
│   │   └── TAREA: Documentos
│   │       ├── SUBTAREA: Programa del Diplomado
│   │       └── ...
│   │
│   └── SECCIÓN: Diplomado en Liderazgo Juvenil
│       └── ... (misma estructura)
│
└── PROYECTO: Escuelas CDIMA
    └── ... (misma estructura que Diplomados)
```

### Convención de Nombres

**Formato de nombres de personas:**
```
Nombre, Apellido Paterno, Apellido Materno
```

**Ejemplos:**
- `María Elena, García, Torres`
- `Juan Carlos, Pérez, López`
- `Rosa, Mamani, Quispe`

> 💡 **Importante:** El sistema automáticamente reformatea los nombres para exportación a: `Apellido Paterno Apellido Materno Nombre` (sin comas)

---

## ⚙️ Funcionalidades

### Página de Diplomados (`/diplomados`)

#### 1. Crear Nuevo Diplomado

**Flujo:**
1. Click en **"+ Crear Nuevo Diplomado"**
2. Ingresar nombre del diplomado
3. Agregar docentes:
   - Nombre (formato: Nombre, Apellido Paterno, Apellido Materno)
   - Género ⚠️ **REQUERIDO**
   - Teléfono
   - Especialidad
   - Experiencia
   - Observaciones
4. Agregar estudiantes:
   - Nombre (mismo formato)
   - Género ⚠️ **REQUERIDO**
   - Teléfono
   - Lugar de Nacimiento
   - Documento de Identidad
   - Identidad Cultural
   - Observaciones
5. Click en **"Guardar"**

**Lo que hace el sistema:**
- ✅ Crea una nueva sección en Asana
- ✅ Crea 3 tareas principales: "Docentes", "Estudiantes", "Documentos"
- ✅ Crea subtareas (una por persona)
- ✅ Almacena datos personales en formato JSON en las notas de cada subtarea
- ✅ Inicializa campos personalizados de notas en 0

#### 2. Ver Detalles de un Diplomado

**Información mostrada:**
- Nombre del diplomado
- Lista de docentes (ordenados alfabéticamente por apellido)
- Lista de estudiantes (ordenados alfabéticamente por apellido)
- Lista de documentos

**Acciones disponibles:**
- 📝 Editar diplomado
- 📊 Ver información primaria de cualquier persona
- 📅 Registrar asistencia
- 📝 Registrar notas
- 📄 Exportar reportes (3 tipos)

#### 3. Editar Diplomado

- Modificar nombre del diplomado
- Agregar/editar docentes y estudiantes
- Los cambios se sincronizan con Asana

---

## 📅 Sistema de Asistencia

### Registro de Asistencia

**Flujo:**
1. Seleccionar un diplomado
2. Click en **"Registrar Asistencia"**
3. Seleccionar fecha (por defecto: hoy)
4. Marcar asistencia para cada estudiante:
   - ✅ Asistió
   - ❌ No asistió
   - Observaciones (opcional)
5. Click en **"Guardar Asistencia"**

### Almacenamiento de Asistencia

Las asistencias se almacenan en las **notas de cada subtarea** en formato JSON:

```json
=== ASISTENCIA ===
```json
[
  {
    "fecha": "15/03/2026",
    "asistio": true,
    "observaciones": "Participación activa"
  },
  {
    "fecha": "16/03/2026",
    "asistio": false,
    "observaciones": "Justificó con certificado médico"
  }
]
```
```

### Ver Asistencia Individual

1. Click en el botón de **calendario** junto al nombre del estudiante
2. Se muestra el historial completo de asistencia ordenado por fecha

### Cálculo Automático de Notas por Inasistencia

⚠️ **Regla importante:** Si un estudiante tiene más del 20% de inasistencias, su nota para el módulo se actualiza automáticamente a **0**.

**Cómo funciona:**
- Se calcula: `(faltas / total_sesiones) * 100`
- Si el porcentaje > 20%, la nota se pone en 0
- Esto se verifica al guardar asistencia
- Se aplica a TODOS los módulos automáticamente

---

## 📝 Sistema de Notas

### Módulos Disponibles

**Diplomados:**
- Módulo 1
- Módulo 2
- Módulo 3
- Módulo 4
- Módulo 5

**Escuelas:**
- Módulo 1
- Módulo 2
- Módulo 3
- Módulo 4
- Módulo 5
- Módulo 6
- Módulo 7

### Registro de Notas

**Flujo - Registrar Notas para Todos:**
1. Seleccionar un diplomado/escuela
2. Click en **"Registrar Notas"**
3. Seleccionar módulo (desplegable)
4. Ingresar nota para cada estudiante (0-100)
5. Click en **"Guardar Notas"**

**Flujo - Registrar Nota Individual:**
1. Click en el botón de **nota** junto al nombre del estudiante
2. Ver todas las notas actuales
3. Seleccionar módulo
4. Ingresar/modificar nota (0-100)
5. Click en **"Guardar"**

### Validación de Notas

✅ **Rango válido:** 0 - 100
❌ **Rechaza:** Números negativos, mayores a 100, texto

### Almacenamiento de Notas

Las notas se almacenan como **campos personalizados (custom fields)** en Asana:

```typescript
// Estructura en Asana
Custom Fields:
  - "Módulo 1": 85
  - "Módulo 2": 90
  - "Módulo 3": 0  // Por inasistencia
  - "Módulo 4": 88
  - "Módulo 5": 92
```

---

## 📊 Reportes Disponibles

### 1. Reporte General del Diplomado

**Contenido:**
- ✅ Logo CDIMA
- ✅ Información del diplomado
- ✅ Fecha de generación
- ✅ Tabla de Docentes:
  - Nombre completo (formato: Apellido Paterno Apellido Materno Nombre)
  - Género
  - Teléfono
  - Especialidad
  - Experiencia
- ✅ Tabla de Estudiantes:
  - Nombre completo
  - Género
  - Teléfono
  - Lugar de Nacimiento
  - Documento de Identidad
  - Identidad Cultural
- ✅ Totales: cantidad de docentes y estudiantes

**Cómo generar:**
1. Seleccionar diplomado
2. Click en **"Exportar Reporte General"**

### 2. Centralizador de Notas

**Contenido:**
- ✅ Logo CDIMA
- ✅ Información del diplomado
- ✅ Tabla con todos los estudiantes y sus notas:
  - N° (numeración)
  - Nombre completo
  - Módulo 1
  - Módulo 2
  - Módulo 3
  - Módulo 4
  - Módulo 5
  - Promedio General
- ✅ Resumen estadístico:
  - Total de estudiantes
  - Promedio general del curso
  - Estudiantes aprobados (≥ 51)
  - Estudiantes reprobados (< 51)

**Cómo generar:**
1. Seleccionar diplomado
2. Click en **"Exportar Centralizador de Notas"**

### 3. Reporte Individual de Estudiante

**Contenido:**
- ✅ Logo CDIMA
- ✅ Información del estudiante
- ✅ Información personal completa
- ✅ Tabla de notas por módulo con promedio
- ✅ Historial de asistencia:
  - Fecha
  - Estado (Presente/Ausente)
  - Observaciones
- ✅ Resumen de asistencia:
  - Total de sesiones
  - Asistencias
  - Inasistencias
  - Porcentaje de asistencia

**Cómo generar:**
1. Seleccionar estudiante
2. Click en el botón de **reporte individual** (PDF)

### Formato de PDFs

**Características estéticas:**
- 🎨 Logo CDIMA en la esquina superior izquierda
- 🎨 Colores corporativos: Azul Navy (#466C8C)
- 🎨 Tipografía: Helvetica
- 🎨 Tablas con bordes elegantes y filas alternadas
- 🎨 Encabezados en color azul
- 🎨 Metadatos en la esquina superior derecha
- 🎨 Fecha de generación en español
- 📄 Formato: A4 Portrait

---

## ✅ Validación de Datos

El sistema usa **Zod** para validación robusta de datos antes de enviarlos a Asana.

### Schemas Disponibles

**1. EstudianteDataSchema**
```typescript
{
  genero: string (requerido, mínimo 1 carácter)
  telefono?: string (opcional)
  lugarNacimiento?: string (opcional)
  documentoIdentidad?: string (opcional)
  identidadCultural?: string (opcional)
  observaciones?: string (opcional)
}
```

**2. DocenteDataSchema**
```typescript
{
  genero: string (requerido, mínimo 1 carácter)
  telefono?: string (opcional)
  especialidad?: string (opcional)
  experiencia?: string (opcional)
  observaciones?: string (opcional)
}
```

**3. AsistenciaRecordSchema**
```typescript
{
  fecha: string (formato: DD/MM/YYYY, regex validado)
  asistio: boolean
  observaciones: string
}
```

**4. NotaModuloSchema**
```typescript
number (rango: 0-100)
```

**5. GuardarAsistenciaSchema**
```typescript
{
  fecha: string (formato: YYYY-MM-DD)
  asistencias: Array<{
    gid: string (requerido)
    nombre: string (requerido)
    asistio: boolean
    observaciones: string
  }> (mínimo 1 elemento)
}
```

### Funciones Helper

**validateData<T>(schema, data, errorMessage?)**
- Valida datos contra un schema
- Retorna: `{ success: true, data: T }` o `{ success: false, error: string }`
- Formatea errores de forma legible

**safeParseWithDefaults<T>(schema, data, defaults)**
- Intenta validar, si falla retorna valores por defecto
- Útil para backward compatibility

---

## 🔧 Campos Personalizados

### Constantes Centralizadas

Todos los nombres de campos personalizados están en:
```typescript
// src/constants/asana-fields.ts
export const ASANA_CUSTOM_FIELDS = {
  // Notas de Diplomados
  MODULO_1: 'Módulo 1',
  MODULO_2: 'Módulo 2',
  MODULO_3: 'Módulo 3',
  MODULO_4: 'Módulo 4',
  MODULO_5: 'Módulo 5',
  
  // Notas de Escuelas (adicionales)
  MODULO_6: 'Módulo 6',
  MODULO_7: 'Módulo 7',
  
  // Campo específico de Escuelas
  TIPO_ESCUELA: 'Tipo de Escuela',
  
  // Valores esperados
  TIPO_ESCUELA_VALORES: {
    LIDERAZGO_SOCIAL: 'Liderazgo Social',
    LIDERAZGO_GESTION: 'Liderazgo de Gestión',
  },
  
  GENERO_VALORES: {
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    OTRO: 'Otro',
  },
}
```

### Helpers para Campos Personalizados

**getCustomFieldValueSafe(task, fieldName, defaultValue)**
- Extrae valores de custom fields de forma segura
- Maneja múltiples formatos (number_value, text_value, display_value)
- Retorna valor por defecto si no encuentra el campo
- Previene crashes por datos inconsistentes

---

## 🔄 Compatibilidad con Datos Legacy

El sistema soporta **dos formatos de datos** en las notas de Asana:

### Formato Nuevo (JSON estructurado)
```
=== DATOS ESTUDIANTE ===
```json
{
  "genero": "Femenino",
  "telefono": "77123456",
  "lugarNacimiento": "La Paz",
  "documentoIdentidad": "1234567 LP",
  "identidadCultural": "Aymara",
  "observaciones": "Estudiante destacada"
}
```
```

### Formato Legacy (Regex parsing)
```
Género: Femenino
Teléfono: 77123456
Lugar de Nacimiento: La Paz
Documento de Identidad: 1234567 LP
Identidad Cultural: Aymara
Observaciones: Estudiante destacada
```

**La función `parseEstudianteData()`** automáticamente detecta y parsea ambos formatos.

---

## 📱 Interfaz de Usuario

### Componentes Principales

**1. Layout**
- Header con logo y navegación
- Links a: Home, Reportes, Biblioteca, Planificación, Diplomados, Escuelas, Configuración

**2. DiplomadosPage**
- Lista de diplomados (cards)
- Botón para crear nuevo diplomado
- Panel de detalles al seleccionar un diplomado
- Modales para:
  - Crear/Editar diplomado
  - Ver información primaria
  - Registrar asistencia
  - Registrar notas

**3. CreateDiplomadoModal**
- Formulario para nombre del diplomado
- Tabs para Docentes y Estudiantes
- Agregar múltiples personas
- Validación en tiempo real

**4. InfoPrimariaModal**
- Vista read-only de información personal
- Botón para cerrar

**5. Tablas con acciones**
- Botones de acción por fila:
  - 👁️ Ver información
  - 📅 Ver asistencia
  - 📝 Registrar nota
  - 📄 Exportar reporte individual

---

## 🚀 Flujo de Trabajo Típico

### Caso de Uso: Nuevo Diplomado de Gestión Municipal

**1. Crear el Diplomado**
```
Diplomados Page → + Crear Nuevo Diplomado
→ Nombre: "Gestión Municipal 2026"
→ Agregar 3 docentes
→ Agregar 25 estudiantes
→ Guardar
```

**2. Primera Sesión**
```
→ Seleccionar "Gestión Municipal 2026"
→ Registrar Asistencia
→ Fecha: 20/03/2026
→ Marcar asistencias
→ Guardar
```

**3. Después del Módulo 1**
```
→ Registrar Notas
→ Módulo: Módulo 1
→ Ingresar notas de los 25 estudiantes
→ Guardar
```

**4. Generar Reportes**
```
→ Exportar Reporte General (para entrega a dirección)
→ Exportar Centralizador de Notas (para seguimiento interno)
→ Exportar Reportes Individuales (para certificados)
```

---

## 🛠️ Archivos Relacionados

### Código Principal
- `src/pages/DiplomadosPage.tsx` - Página principal de diplomados
- `src/pages/EscuelasPage.tsx` - Página principal de escuelas
- `src/components/CreateDiplomadoModal.tsx` - Modal de creación/edición
- `src/components/CreateEscuelaModal.tsx` - Modal de creación/edición de escuelas
- `src/components/InfoPrimariaModal.tsx` - Modal de información personal

### Servicios
- `src/services/reports/diplomados-reports.service.ts` - Generación de PDFs
- `src/services/reports/escuelas-reports.service.ts` - Generación de PDFs
- `src/services/asana.service.ts` - Cliente API de Asana

### Utilidades
- `src/utils/asana-helpers.ts` - Funciones helper para parsear datos
- `src/constants/asana-fields.ts` - Constantes de campos personalizados

### Validación
- `src/schemas/diplomado.schemas.ts` - Schemas de validación con Zod

### Tipos
- `src/types/asana.types.ts` - Tipos TypeScript para Asana

---

## 📝 Notas Técnicas

### Performance
- ✅ Carga de datos en paralelo con `Promise.all()`
- ✅ Ordenamiento alfabético eficiente
- ✅ Estados de loading para mejor UX
- ✅ Manejo robusto de errores

### Seguridad
- ✅ Token almacenado en localStorage
- ✅ Validación en cliente antes de enviar a Asana
- ✅ Manejo de errores de API
- ✅ No se almacenan datos sensibles en código

### Mantenibilidad
- ✅ Código bien documentado
- ✅ Constantes centralizadas
- ✅ Funciones reutilizables
- ✅ Tipos TypeScript completos
- ✅ Schemas de validación centralizados

---

## 🔮 Mejoras Futuras Sugeridas

### Funcionalidades
- [ ] Importación masiva desde Excel/CSV
- [ ] Edición inline de notas desde la tabla
- [ ] Dashboard con estadísticas generales
- [ ] Gráficos de rendimiento por módulo
- [ ] Filtros avanzados (por género, rango de notas, etc.)
- [ ] Búsqueda global de estudiantes
- [ ] Historial de cambios (audit log)
- [ ] Notificaciones de inasistencias altas

### Campos Adicionales
- [ ] Edad/Fecha de Nacimiento
- [ ] Email
- [ ] Dirección completa
- [ ] Contacto de emergencia
- [ ] Nivel educativo previo
- [ ] Ocupación
- [ ] Institución/Organización

### Reportes
- [ ] Certificados individuales automáticos
- [ ] Reporte de docentes con evaluaciones
- [ ] Dashboard ejecutivo del diplomado
- [ ] Gráficos de asistencia por módulo
- [ ] Comparativa entre diplomados
- [ ] Reporte de beneficiarios totales CDIMA

### Mejoras Estéticas
- [ ] Temas/colores personalizables
- [ ] Más opciones de gráficos en PDFs
- [ ] Plantillas de PDF personalizables
- [ ] Vista previa antes de exportar
- [ ] Marca de agua en PDFs
- [ ] QR codes en certificados

---

## 📞 Soporte

Para dudas o problemas con el sistema de Diplomados y Escuelas, contactar al equipo técnico de CDIMA.

**Documentación actualizada:** Marzo 2026
