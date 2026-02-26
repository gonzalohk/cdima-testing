# CDIMA - Reportes de Asana

Aplicación web 100% frontend para generar reportes personalizados consumiendo la API de Asana.

## 🚀 Características

- ✅ **100% Frontend** - No requiere backend, toda la lógica corre en el navegador
- 📊 **Reportes Detallados** - Visualiza actividades, subtareas y estadísticas completas
- 📥 **Exportación a PDF** - Genera reportes en PDF con jsPDF
- 🔐 **Autenticación Segura** - Usa tu token personal de Asana (almacenado localmente)
- 🎨 **Interfaz Moderna** - Diseño limpio y responsivo
- 📈 **Estadísticas en Tiempo Real** - Progreso, distribución por asignado, y más
- 🔍 **Filtros y Búsqueda** - Filtra subtareas por estado, asignado o nombre

## 🛠️ Stack Tecnológico

### Core
- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server ultrarrápido

### Navegación y Routing
- **React Router DOM v6** - Navegación entre páginas

### Exportación
- **jsPDF** - Generación de PDFs
- **jsPDF-AutoTable** - Tablas en PDF

## 📋 Requisitos Previos

- Node.js 18 o superior
- npm o yarn
- Token de acceso personal de Asana

## 🔧 Instalación

1. **Clonar el repositorio** (o usar el proyecto existente)

```bash
cd cdima-reportes
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

4. **Abrir en el navegador**

La aplicación se abrirá en `http://localhost:5173`

## 🔑 Configuración de Asana

### Obtener Token de Acceso Personal

1. Ve a [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Haz clic en **"Create new token"**
3. Dale un nombre descriptivo (ej: "CDIMA Reportes")
4. Copia el token generado
5. Pégalo en la página de configuración de la aplicación

> ⚠️ **Importante**: Guarda tu token de forma segura. No lo compartas con nadie.

## 📖 Uso de la Aplicación

### 1. Configuración Inicial

1. Abre la aplicación en tu navegador
2. Ve a la página de **"Configuración"**
3. Ingresa tu token de acceso personal de Asana
4. Haz clic en **"Guardar Token"**
5. La aplicación verificará la conexión y mostrará tus workspaces

### 2. Generar un Reporte

1. Ve a la página de **"Reportes"**
2. **Selecciona un Workspace** - Elige el workspace de Asana
3. **Selecciona un Proyecto** - Elige el proyecto que contiene tus actividades
4. **Selecciona una Actividad Principal** - Elige la tarea principal (sin parent)
5. La aplicación cargará automáticamente:
   - Información de la actividad principal
   - Todas las subtareas
   - Estadísticas calculadas

### 3. Visualizar Información

La página de reportes muestra:

#### Información de la Actividad
- Nombre y descripción
- Estado (completada/pendiente)
- Responsable asignado
- Fecha de vencimiento
- Número de subtareas

#### Estadísticas
- **Total de subtareas**
- **Completadas vs Pendientes**
- **Porcentaje de progreso** (barra visual)
- **Distribución por asignado** (contador por persona)

#### Tabla de Subtareas
- Lista completa de subtareas
- Filtros por:
  - Nombre (búsqueda)
  - Estado (completada/pendiente)
  - Asignado
- Información mostrada:
  - Nombre
  - Asignado
  - Estado
  - Fecha de vencimiento

### 4. Exportar a PDF

1. Una vez que hayas seleccionado una actividad
2. Haz clic en el botón **"📄 Exportar a PDF"**
3. El PDF se generará y descargará automáticamente
4. El PDF incluye:
   - Información del proyecto
   - Detalles de la actividad principal
   - Estadísticas completas
   - Distribución por asignado
   - Tabla completa de subtareas

## 📁 Estructura del Proyecto

```
cdima-reportes/
├── src/
│   ├── components/                  # Componentes presentacionales
│   │   ├── Layout.tsx               # Layout principal con navegación
│   │   ├── HierarchicalSelector.tsx # Selectores de workspace/proyecto/tarea
│   │   ├── TaskInfo.tsx             # Información de actividad
│   │   ├── StatisticsSection.tsx    # Estadísticas y progreso
│   │   └── SubtasksTable.tsx        # Tabla de subtareas con filtros
│   ├── hooks/
│   │   └── useReportPage.ts         # Lógica de negocio del reporte
│   ├── pages/
│   │   ├── HomePage.tsx             # Página de configuración
│   │   └── ReportPage.tsx           # Página de reportes (contenedor)
│   ├── services/
│   │   ├── asana.service.ts         # Servicio de API de Asana
│   │   └── pdf.service.ts           # Servicio de exportación a PDF
│   ├── types/
│   │   ├── asana.types.ts           # Tipos de Asana
│   │   └── autotable.d.ts           # Tipos de jsPDF-AutoTable
│   ├── App.tsx                      # Componente raíz con router
│   ├── App.css                      # Estilos de la aplicación
│   ├── main.tsx                     # Punto de entrada
│   └── index.css                    # Estilos globales
├── �️ Arquitectura

### Separación de Responsabilidades
- **Custom Hook (useReportPage)** - Toda la lógica de negocio
- **Componentes Presentacionales** - Solo renderización
- **Container Component** - Composición y coordinación

> 📖 Ver [ARCHITECTURE.md](ARCHITECTURE.md) y [REFACTORING.md](REFACTORING.md) para detalles completos

### Componentes Principales
- `HierarchicalSelector` - Selectores jerárquicos
- `TaskInfo` - Información de la actividad
- `StatisticsSection` - Estadísticas y progreso
- `SubtasksTable` - Tabla con filtros y exportación

## �index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md                        # Este archivo
├── QUICK_START.md                   # Guía de inicio rápido
├── TECHNICAL.md                     # Documentación técnica
├── DEPLOYMENT.md                    # Guía de despliegue
├── REFACTORING.md                   # Detalles de refactorización
└── ARCHITECTURE.md                  # Arquitectura visual
```

## 🎨 Características de la UI

### Diseño Responsivo
- Se adapta a diferentes tamaños de pantalla
- Optimizado para desktop y móvil

### Indicadores Visuales
- **Badges de estado** - Verde para completado, amarillo para pendiente
- **Barra de progreso** - Muestra visualmente el porcentaje de completitud
- **Tarjetas de estadísticas** - Con gradientes de colores distintivos

### Filtros Inteligentes
- Búsqueda en tiempo real
- Filtros combinables
- Contador de resultados

## 🔒 Seguridad y Privacidad

- El token se almacena **únicamente en localStorage** del navegador
- **No se envía a ningún servidor externo** (excepto Asana)
- Todas las peticiones se hacen directamente a la API de Asana
- Puedes borrar el token en cualquier momento

## 🏗️ Comandos Disponibles

```bash
# Desarrollo
npm run dev          # Inicia el servidor de desarrollo

# Producción
npm run build        # Compila la aplicación para producción
npm run preview      # Vista previa de la build de producción

# Otros
npm run lint         # Ejecuta el linter
```

## 🌐 Despliegue

La aplicación puede desplegarse en cualquier servicio de hosting estático:

### Vercel
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages
```bash
npm run build
# Sube la carpeta dist/ a GitHub Pages
```

## 📝 Notas Técnicas

### API de Asana
- Usa la versión 1.0 de la API de Asana
- Endpoint base: `https://app.asana.com/api/1.0`
- Autenticación mediante Bearer Token

### Limitaciones
- Solo funciona con tareas que tienen subtareas
- Requiere conexión a internet para acceder a la API de Asana
- El token debe tener permisos de lectura en los workspaces

### Optimizaciones
- Carga paralela de datos (task + subtasks)
- Memoización de cálculos estadísticos
- Filtrado eficiente con useMemo

## 🐛 Solución de Problemas

### Error: "Token de acceso no configurado"
- Verifica que hayas ingresado el token en la página de configuración
- Asegúrate de que el token sea válido

### Error: "Error al cargar proyectos/tareas"
- Verifica tu conexión a internet
- Confirma que el token tenga los permisos necesarios
- Verifica que el workspace/proyecto exista

### No aparecen actividades principales
- Solo se muestran tareas sin "parent" (tareas de nivel superior)
- Verifica que el proyecto tenga tareas

## 📄 Licencia

Este proyecto es de uso interno para CDIMA.

## 👥 Soporte

Para soporte o preguntas, contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ usando React + TypeScript + Vite**
