# Manual de Usuario — Rol Administrador
## Sistema CDIMA Amuyt'a

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Dirigido a:** Usuarios con rol **Administrador**

---

## ÍNDICE

1. [Ingreso al Sistema](#1-ingreso-al-sistema)  
   1.1 [Ingreso a Asana](#11-ingreso-a-asana)  
   1.2 [Ingreso a CDIMA Amuyt'a](#12-ingreso-a-cdima-amuyta)  
   1.3 [Ingreso a Google Drive](#13-ingreso-a-google-drive)  
2. [Menú: PLANIFICACIÓN](#2-menú-planificación)  
   2.1 [Cargado de información en Asana](#21-cargado-de-información-en-asana)  
   2.2 [Visualización del calendario desde CDIMA Amuyt'a](#22-visualización-del-calendario-desde-cdima-amuyta)  
   2.3 [Indicadores de impacto del mes](#23-indicadores-de-impacto-del-mes)  
   2.4 [Lista de actividades y filtros](#24-lista-de-actividades-y-filtros)  
   2.5 [Cambiar el estado de una actividad](#25-cambiar-el-estado-de-una-actividad)  
   2.6 [Agregar fuentes de verificación](#26-agregar-fuentes-de-verificación)  
   2.7 [Generación de reportes](#27-generación-de-reportes)  
3. [Menú: COMUNICACIÓN](#3-menú-comunicación)  
   3.1 [Navegación por proyectos y carpetas](#31-navegación-por-proyectos-y-carpetas)  
   3.2 [Descarga de archivos](#32-descarga-de-archivos)  
4. [Menú: PROYECTOS](#4-menú-proyectos)  
   4.1 [Selección de proyecto, período y actividad](#41-selección-de-proyecto-período-y-actividad)  
   4.2 [Visualización del detalle de avance](#42-visualización-del-detalle-de-avance)  
5. [Inicio — Resumen Ejecutivo](#5-inicio--resumen-ejecutivo)  
   5.1 [Solicitudes pendientes de aprobación](#51-solicitudes-pendientes-de-aprobación)  
   5.2 [Contrataciones activas](#52-contrataciones-activas)  
   5.3 [Actividades con retraso](#53-actividades-con-retraso)  
   5.4 [Indicadores de avance global](#54-indicadores-de-avance-global)  

---

## 1. INGRESO AL SISTEMA

El rol **Administrador** trabaja con dos plataformas complementarias:

| Plataforma | Propósito |
|---|---|
| **Asana** | Ingreso y gestión de datos de las actividades: fechas, responsables, estados, subtareas, archivos adjuntos |
| **CDIMA Amuyt'a** | Visualización, seguimiento, aprobación de solicitudes y generación de reportes |

---

### 1.1 Ingreso a Asana

**URL de acceso:**  
```
https://app.asana.com
```

**Pasos:**

1. Abra su navegador web (Google Chrome o Microsoft Edge recomendados).
2. Ingrese a la URL: `https://app.asana.com`
3. En la pantalla de inicio de sesión ingrese:
   - **Correo electrónico:** su cuenta de correo registrada en el workspace **CDIMA**
   - **Contraseña:** su contraseña de Asana

> **[INSERTAR CAPTURA: pantalla de login de Asana]**

4. Una vez dentro, verifique que se encuentra en el **workspace CDIMA** (aparece en la barra lateral izquierda o en el selector de workspace).

> **[INSERTAR CAPTURA: workspace CDIMA en Asana con la lista de proyectos]**

**Estructura en Asana:**

Cada proyecto CDIMA contiene actividades organizadas por **períodos o secciones**. Cada actividad (tarea principal) puede tener **sub-actividades** (subtareas). Las solicitudes de fondos, materiales y contrataciones son sub-tareas con prefijos especiales:

| Prefijo | Tipo |
|---|---|
| `SFON` | Solicitud de Fondos |
| `SMAT` | Solicitud de Material |
| `DMAT` | Devolución de Material |
| `CPER` | Contratación de Personal |

---

### 1.2 Ingreso a CDIMA Amuyt'a

**URL de acceso:**  
```
https://cdima-reportes.vercel.app
```
*(o la URL de producción que le haya sido proporcionada)*

**Pasos:**

1. Abra su navegador e ingrese la URL del sistema.
2. En la pantalla de inicio de sesión ingrese:
   - **Correo electrónico:** `sandraveragutierrez@gmail.com` *(u otras credenciales asignadas para su cuenta de Administrador)*
   - **Contraseña:** la contraseña asignada para el rol Administrador

> **[INSERTAR CAPTURA: pantalla de login de CDIMA Amuyt'a]**

3. Haga clic en el botón **"Ingresar"**.
4. Si las credenciales son correctas, será redirigido automáticamente a la pantalla de **Inicio**.

> **[INSERTAR CAPTURA: pantalla de Inicio después del login]**

**Menú lateral disponible para el Administrador:**

Una vez ingresado, verá en la barra lateral izquierda las siguientes secciones:

| Ícono | Nombre | Descripción |
|---|---|---|
| 🏠 | **Inicio** | Resumen ejecutivo: solicitudes, contrataciones, retrasos e indicadores |
| 📊 | **Proyectos** | Detalle de avance por proyecto, período y actividad |
| 📡 | **Comunicación** | Biblioteca de archivos organizados por proyecto/carpeta |
| 📅 | **Planificación** | Calendario de actividades, estadísticas y reportes |

---

### 1.3 Ingreso a Google Drive

Google Drive es el repositorio de archivos utilizado por CDIMA para almacenar todos los documentos de respaldo: informes, actas, fotografías, planillas y fuentes de verificación. Desde CDIMA Amuyt'a se generan enlaces directos a documentos almacenados en Drive, por lo que es necesario tener una sesión activa.

**URL de acceso:**
```
https://drive.google.com
```

**Pasos:**

1. Abra su navegador e ingrese a `https://drive.google.com`.
2. Inicie sesión con la cuenta de Google institucional asignada por CDIMA.
   - **Correo:** la cuenta Google proporcionada por su organización
   - **Contraseña:** la contraseña de esa cuenta Google

> **[INSERTAR CAPTURA: pantalla de inicio de sesión de Google / Google Drive]**

3. Una vez dentro, verifique que tiene acceso a la carpeta compartida **"CDIMA"** (debe aparecer en **"Compartidos conmigo"** o en **"Mi unidad"** según como fue compartida).

> **[INSERTAR CAPTURA: carpeta CDIMA visible en Google Drive]**

**¿Por qué es necesario tener Drive abierto?**

Cuando haga clic en un enlace de fuente de verificación desde CDIMA Amuyt'a (en Planificación, Proyectos, Comunicación, Escuelas o Diplomados), el documento se abrirá en una nueva pestaña del navegador. Si no tiene sesión activa en Google, el navegador le pedirá que inicie sesión antes de mostrar el archivo.

**Recomendación:** mantenga las tres plataformas abiertas en pestañas distintas mientras trabaja:

| Pestaña | URL |
|---|---|
| **Asana** | `https://app.asana.com` |
| **CDIMA Amuyt'a** | `https://cdima-reportes.vercel.app` |
| **Google Drive** | `https://drive.google.com` |

Una vez ingresado, verá en la barra lateral izquierda las siguientes secciones:

| Ícono | Nombre | Descripción |
|---|---|---|
| 🏠 | **Inicio** | Resumen ejecutivo: solicitudes, contrataciones, retrasos e indicadores |
| 📊 | **Proyectos** | Detalle de avance por proyecto, período y actividad |
| 📡 | **Comunicación** | Biblioteca de archivos organizados por proyecto/carpeta |
| 📅 | **Planificación** | Calendario de actividades, estadísticas y reportes |



---

## 2. MENÚ: PLANIFICACIÓN

El menú **Planificación** permite visualizar y gestionar las actividades del proyecto de planificación CDIMA en un calendario interactivo. La información se obtiene directamente de Asana.

Para ingresar haga clic en **📅 Planificación** en el menú lateral.

---

### 2.1 Cargado de información en Asana

Antes de visualizar las actividades en CDIMA Amuyt'a, es necesario que la información esté correctamente ingresada en Asana. A continuación se describe cómo se carga cada dato relevante:

**Acceda al proyecto "Planificacion CDIMA" en Asana.**

> **[INSERTAR CAPTURA: proyecto Planificacion CDIMA en Asana]**

**Campos que deben completarse por cada actividad:**

| Campo en Asana | Descripción | Dónde se ingresa |
|---|---|---|
| **Nombre de la tarea** | Nombre descriptivo de la actividad | Campo principal de la tarea |
| **Fecha de inicio** | Cuándo comienza la actividad | Sección "Fechas" → "Fecha de inicio" |
| **Fecha de vencimiento** | Fecha límite de la actividad | Sección "Fechas" → "Fecha de vencimiento" |
| **Estado** | Estado actual (En Proceso, Ejecutado, Reprogramado) | Campo personalizado "Estado" |
| **Área** | Área responsable de la actividad | Campo personalizado "Área" |
| **Responsables de actividad** | Nombre(s) del o los responsables | Campo personalizado "Responsables de actividad" |
| **Fuente** | Nombre del documento de respaldo | Campo personalizado "Fuente" |
| **Fuente URL** | Enlace de Google Drive u otra fuente | Campo personalizado "Fuente URL" |

> **[INSERTAR CAPTURA: ficha de tarea en Asana mostrando los campos personalizados]**

**Pasos para ingresar una actividad en Asana:**

1. Dentro del proyecto "Planificacion CDIMA", seleccione la **sección** (período) correspondiente.
2. Haga clic en **"+ Agregar tarea"**.
3. Ingrese el nombre de la actividad.
4. Abra la tarea y complete:
   - Las fechas de inicio y vencimiento.
   - El campo "Estado" seleccionando la opción correspondiente.
   - El campo "Área".
   - El campo "Responsables de actividad".
5. Guarde los cambios. La actividad aparecerá automáticamente en el calendario de CDIMA Amuyt'a.

> **[INSERTAR CAPTURA: completando campos personalizados de una tarea en Asana]**

---

### 2.2 Visualización del calendario desde CDIMA Amuyt'a

Al ingresar a **Planificación**, el sistema carga automáticamente todas las actividades del proyecto **"Planificacion CDIMA"** y las muestra en un **calendario interactivo**.

> **[INSERTAR CAPTURA: vista general de la página de Planificación con el calendario]**

**Características del calendario:**

- **Vista por mes** (predeterminada), semana o día — use los botones en la esquina superior del calendario para cambiar la vista.
- **Navegación temporal** — use los botones **◀ Anterior** y **Siguiente ▶** para moverse entre meses.
- **Botón "Hoy"** — regresa inmediatamente al mes actual.
- Cada actividad se muestra como un **bloque de color** en el rango de fechas de inicio a fecha de vencimiento.
- El nombre entre paréntesis dentro del bloque indica el **responsable** de la actividad.

**Leyenda de colores:**

| Color / Estilo | Significado |
|---|---|
| Colores variados | Cada actividad tiene un color único para diferenciarlas |
| Fondo rojo con borde rojo | Actividad **atrasada** (En Proceso y fecha vencida) |
| Opacidad reducida (grisado) | Actividad **Ejecutada** o **Reprogramada** |

> **[INSERTAR CAPTURA: leyenda de colores debajo del encabezado del calendario]**

**Ver detalle de una actividad:**

Haga clic sobre cualquier bloque del calendario para ver una ventana emergente con:
- Nombre de la actividad
- Fecha de vencimiento
- Estado actual
- Área y responsable

> **[INSERTAR CAPTURA: modal de detalle de actividad al hacer clic en el calendario]**

---

### 2.3 Indicadores de impacto del mes

Debajo del calendario, el sistema muestra automáticamente los **indicadores estadísticos del mes visualizado**:

> **[INSERTAR CAPTURA: sección de estadísticas con indicadores del mes]**

| Indicador | Descripción |
|---|---|
| **Total** | Cantidad total de actividades programadas en el mes |
| **Ejecutadas** | Actividades con estado "Ejecutado" o "Reprogramado" |
| **En Proceso** | Actividades que aún no han sido completadas |
| **% de avance** | Porcentaje de actividades ejecutadas sobre el total |

Estos indicadores se **actualizan automáticamente** al navegar entre meses con los botones del calendario.

---

### 2.4 Lista de actividades y filtros

Debajo de los indicadores, el sistema muestra **tres tablas** con el detalle de las actividades del mes:

1. **⚠️ Actividades En Proceso (Atrasadas)** — Actividades cuya fecha de vencimiento ya pasó y que aún están "En Proceso".
2. **🔄 Actividades En Proceso** — Actividades que están en curso y aún dentro de su plazo.
3. **✅ Actividades Ejecutadas** — Actividades completadas en el mes visualizado.

> **[INSERTAR CAPTURA: tabla de actividades atrasadas con columnas visibles]**

**Columnas de cada tabla:**

| Columna | Descripción |
|---|---|
| **Actividad** | Nombre de la actividad, área y responsable |
| **Fecha** | Rango de fechas (inicio - vencimiento) |
| **Fuente** | Enlace a la fuente de verificación en Google Drive |
| **Estado** | Dropdown para cambiar el estado directamente |

**Filtrar por área:**

En la barra de herramientas sobre las tablas, encontrará el selector **"Filtrar por área"**:

1. Haga clic en el selector desplegable.
2. Elija el área que desea filtrar (ej.: "Comunicación", "Planificación").
3. Las tres tablas se actualizarán mostrando solo las actividades de esa área.
4. Para quitar el filtro, haga clic en **"✕ Limpiar"**.

> **[INSERTAR CAPTURA: selector de filtro por área con opciones visibles]**

---

### 2.5 Cambiar el estado de una actividad

En la columna **"Estado"** de cualquier tabla de actividades, se muestra un **menú desplegable (dropdown)** con las opciones de estado disponibles.

**Pasos:**

1. Ubique la actividad cuyo estado desea actualizar.
2. Haga clic en el **dropdown de estado** en la columna correspondiente.
3. Seleccione el nuevo estado (ej.: "Ejecutado", "Reprogramado", "En Proceso").
4. El sistema actualizará automáticamente el estado en **Asana** y el dropdown mostrará la fecha y hora del último cambio.

> **[INSERTAR CAPTURA: dropdown de estado abierto con las opciones visibles]**

> **Nota:** Debajo del dropdown aparece la fecha y usuario del último cambio de estado para trazabilidad.

---

### 2.6 Agregar fuentes de verificación

Las **fuentes de verificación** son enlaces de Google Drive u otras plataformas que respaldan la ejecución de una actividad.

**Pasos para agregar o editar una fuente:**

1. En la columna **"Fuente"** de la tabla, haga clic en el botón **"+ fuente"** (si no hay fuente) o en el ícono **✏️** (si ya existe una).
2. Se abrirá un pequeño formulario emergente con dos campos:
   - **Nombre:** nombre descriptivo del documento o evidencia (ej.: "Informe Febrero 2026")
   - **URL:** enlace directo de Google Drive o cualquier URL válida
3. Complete ambos campos y haga clic en **"Guardar"**.
4. La fuente se almacenará directamente en Asana como campo de la tarea.
5. El botón cambiará a un enlace **🔗 Ver fuente** que permite acceder directamente al documento.

> **[INSERTAR CAPTURA: formulario de fuente de verificación con los campos nombre y URL]**

> **[INSERTAR CAPTURA: enlace de fuente activo en la columna de la tabla]**

---

### 2.7 Generación de reportes

CDIMA Amuyt'a ofrece múltiples opciones de exportación para el módulo de planificación. Los botones se encuentran en la parte superior del área del calendario y en la barra sobre las tablas.

**Reportes disponibles:**

| Botón | Formato | Descripción |
|---|---|---|
| 📄 **Actividades PDF** | PDF | Exporta la vista actual del calendario como imagen (captura) |
| 📋 **Cronograma PDF** | PDF | Genera un cronograma mensual en formato tabla con todas las actividades del mes, sus fechas, responsables y estado |
| 📝 **Cronograma Word** | Word (.docx) | Igual que el cronograma PDF pero en formato editable Word |
| 📄 **Informe PDF** | PDF | Exporta las tres tablas de actividades (atrasadas, en proceso, ejecutadas) con el filtro de área aplicado |
| 📝 **Informe Word** | Word (.docx) | Igual que el Informe PDF pero en formato editable Word |

**Pasos para exportar un cronograma:**

1. Navegue al mes deseado usando los botones del calendario.
2. Aplique el filtro de área si es necesario.
3. Haga clic en el botón de exportación correspondiente (ej.: **📋 Cronograma PDF**).
4. El sistema generará el archivo automáticamente y lo descargará a su computadora.
5. El archivo descargado contendrá el mes, año y el nombre del proyecto en el nombre del archivo.

> **[INSERTAR CAPTURA: botones de exportación en la barra superior del calendario]**

> **[INSERTAR CAPTURA: botones de Informe PDF e Informe Word sobre las tablas de actividades]**

> **Nota:** Los botones de exportación estarán deshabilitados (grisados) si no hay actividades en el mes seleccionado.

---

## 3. MENÚ: COMUNICACIÓN

El menú **Comunicación** (📡) funciona como una **biblioteca digital** de archivos y documentos organizados por proyecto y carpeta. Permite a cualquier usuario (incluido el Administrador) navegar entre proyectos como si fueran carpetas y descargar los archivos que necesite.

Para ingresar haga clic en **📡 Comunicación** en el menú lateral.

> **[INSERTAR CAPTURA: vista general de la página de Comunicación]**

---

### 3.1 Navegación por proyectos y carpetas

La pantalla de Comunicación está organizada en tres niveles:

**Nivel 1 — Proyectos:**

Al ingresar verá una lista de todos los proyectos disponibles en el workspace CDIMA. Cada proyecto se muestra como una tarjeta con su nombre e ícono de carpeta.

> **[INSERTAR CAPTURA: lista de proyectos en la página de Comunicación]**

1. Haga clic sobre el **nombre o tarjeta del proyecto** que le interesa.
2. El sistema cargará las **secciones** de ese proyecto.

**Nivel 2 — Secciones (Carpetas):**

Las secciones representan las **agrupaciones de actividades** dentro del proyecto (pueden ser períodos, áreas, etc.). Se muestran como carpetas con un ícono de color.

> **[INSERTAR CAPTURA: secciones del proyecto mostradas como carpetas]**

1. Haga clic sobre la **sección o carpeta** de interés.
2. El sistema mostrará las **tareas** de esa sección.

**Nivel 3 — Tareas y Subtareas:**

Dentro de cada sección verá las tareas, y dentro de cada tarea sus subtareas. Los archivos y enlaces se muestran como elementos descargables.

> **[INSERTAR CAPTURA: archivos y enlaces dentro de una tarea en Comunicación]**

**Barra de navegación (breadcrumb):**

En la parte superior de la pantalla encontrará una barra de navegación que muestra el camino recorrido:  
`Proyectos > [Nombre Proyecto] > [Nombre Sección] > [Nombre Tarea]`

Puede hacer clic en cualquier nivel para **regresar** a ese punto de la navegación.

> **[INSERTAR CAPTURA: barra de navegación breadcrumb]**

**Búsqueda:**

Utilice el campo de búsqueda (ícono 🔍) para filtrar por nombre de archivo, carpeta o tarea dentro del nivel actual.

---

### 3.2 Descarga de archivos

Los archivos disponibles en cada tarea/subtarea se identifican visualmente por el **tipo de archivo** con íconos y colores diferenciados:

| Tipo | Color | Ícono |
|---|---|---|
| Carpeta (Google Drive folder) | Naranja/Café | 📁 |
| PDF | Rojo | 📄 |
| Word / Documento | Azul | 📄 |
| Excel / Hoja de cálculo | Verde | 📊 |
| PowerPoint / Presentación | Naranja | 📊 |
| Imagen | Morado | 🖼️ |
| Video | Azul claro | 🎬 |
| Enlace / Otro | Gris | 🔗 |

> **[INSERTAR CAPTURA: tarjetas de archivos con distintos tipos de íconos y colores]**

**Para descargar o abrir un archivo:**

1. Ubique el archivo que desea dentro de la tarea.
2. Haga clic en el botón **⬇ Descargar** o en el ícono de descarga que aparece en la tarjeta del archivo.
3. El archivo se abrirá en una nueva pestaña del navegador (para enlaces de Google Drive) o se descargará directamente a su computadora.

> **Nota:** El rol Administrador puede **ver y descargar** todos los archivos disponibles. Solo el rol **Comunicación** puede agregar o eliminar archivos y enlaces.

---

## 4. MENÚ: PROYECTOS

El menú **Proyectos** (📊) permite al Administrador acceder al **detalle de avance** de cada actividad dentro de los diferentes proyectos CDIMA. Aquí se puede navegar por proyecto, período y actividad, visualizando su información, sub-actividades, solicitudes y contrataciones.

Para ingresar haga clic en **📊 Proyectos** en el menú lateral.

---

### 4.1 Selección de proyecto, período y actividad

La pantalla de Proyectos muestra un **selector jerárquico** con tres niveles:

**Paso 1 — Seleccionar Proyecto:**

1. En la primera columna del selector verá la lista de todos los proyectos disponibles.
2. Haga clic sobre el **nombre del proyecto** que desea revisar (ej.: "Proyecto EV 2026").
3. El sistema cargará automáticamente los períodos de ese proyecto en la columna siguiente.

> **[INSERTAR CAPTURA: selector de proyecto con lista de proyectos]**

**Paso 2 — Seleccionar Período (Sección):**

1. En la segunda columna verá los **períodos o secciones** del proyecto seleccionado (ej.: "Enero", "Primer Trimestre", etc.).
2. Haga clic sobre el período que desea revisar.
3. El sistema cargará las actividades de ese período.

> **[INSERTAR CAPTURA: selector de período con secciones del proyecto]**

**Paso 3 — Seleccionar Actividad:**

1. En la tercera columna verá la lista de **actividades** del período seleccionado.
2. Haga clic sobre la actividad para ver su detalle completo.

> **[INSERTAR CAPTURA: selector de actividad con lista de tareas del período]**

También puede usar la **barra de búsqueda** y el **filtro de estado** para encontrar rápidamente una actividad específica.

---

### 4.2 Visualización del detalle de avance

Al seleccionar una actividad, el panel derecho (o la vista principal) mostrará toda la información de esa actividad:

> **[INSERTAR CAPTURA: pantalla de detalle de actividad con toda la información]**

**Información general de la actividad:**

| Dato | Descripción |
|---|---|
| Nombre | Nombre completo de la actividad |
| Estado | Estado actual (En Proceso, Ejecutado, Reprogramado) |
| Fechas | Fecha de inicio y fecha de vencimiento |
| Área | Área responsable |
| Responsables | Nombre(s) del responsable de la actividad |
| Notas | Descripción o notas adicionales de la actividad |

**Pestañas de información:**

La vista de detalle tiene múltiples pestañas que organizan la información:

| Pestaña | Contenido |
|---|---|
| **Sub-actividades** | Lista de subtareas con su estado individual (✅ Ejecutada / ⏳ En Proceso), barras de progreso y fechas |
| **Solicitudes** | Historial de solicitudes de fondos, materiales y devoluciones asociadas a esta actividad |
| **Contrataciones** | Estado de las contrataciones de personal (CPER) ligadas a esta actividad con el proceso paso a paso |
| **Distribución** | Distribución de responsabilidades por área o persona |
| **Beneficiarios** | Registro de beneficiarios cuando aplica |

> **[INSERTAR CAPTURA: pestañas de la vista de detalle de actividad]**

**Indicadores de avance de la actividad:**

En la parte superior del detalle, verá indicadores visuales del progreso:
- **Barra de progreso** con porcentaje de sub-actividades ejecutadas.
- **Conteo:** X de Y sub-actividades ejecutadas.
- **Gantt Chart** (cuando haya fechas definidas): muestra las subtareas como barras en el tiempo.

> **[INSERTAR CAPTURA: barra de progreso y gráfico Gantt de la actividad]**

**Diagrama de Gantt:**

El diagrama Gantt muestra gráficamente el cronograma de las sub-actividades:
- Las barras verdes representan sub-actividades **ejecutadas**.
- Las barras azules/grises representan sub-actividades **en proceso**.

> **[INSERTAR CAPTURA: diagrama de Gantt de las sub-actividades]**

**Exportación de reportes dinámicos desde Proyectos:**

En la vista de detalle de una actividad, encontrará botones para generar reportes:

| Botón | Formato | Descripción |
|---|---|---|
| 📄 **Exportar PDF** | PDF | Genera un informe completo de la actividad con todas sus sub-actividades, estado, fechas y distribución de responsables |
| 📝 **Exportar Word** | Word (.docx) | Igual que el PDF pero en formato editable |

1. Seleccione la actividad cuyo reporte desea generar.
2. Haga clic en el botón de exportación deseado.
3. El archivo se descargará automáticamente con el nombre del proyecto y la actividad.

> **[INSERTAR CAPTURA: botones de exportación en la vista de detalle]**

---

## 5. INICIO — RESUMEN EJECUTIVO

La pantalla de **Inicio** (🏠) es el panel de control principal del Administrador. Muestra una visión completa y en tiempo real del estado de solicitudes, contrataciones, retrasos e indicadores de avance de todos los proyectos.

Para ingresar haga clic en **🏠 Inicio** en el menú lateral, o acceda directamente desde la pantalla raíz del sistema.

> **[INSERTAR CAPTURA: pantalla completa de Inicio con todas las secciones visibles]**

En la parte superior encontrará el botón **🔄 Actualizar** para recargar todos los datos desde Asana.

---

### 5.1 Solicitudes pendientes de aprobación

La primera sección de la pantalla de Inicio es la tabla de **Solicitudes Pendientes de Aprobación** 🔔.

Esta tabla muestra todas las solicitudes que los técnicos han generado desde los distintos proyectos y que requieren una acción del Administrador.

> **[INSERTAR CAPTURA: tabla de solicitudes pendientes con filas de ejemplo]**

**Tipos de solicitudes:**

| Tipo | Color | Descripción |
|---|---|---|
| **Solicitud de Fondos** | Azul | Solicitudes de dinero para actividades (prefijo SFON) |
| **Solicitud de Material** | Naranja | Pedidos de materiales o insumos (prefijo SMAT) |
| **Devolución de Material** | Morado | Registro de devolución de materiales (prefijo DMAT) |

**Información en la tabla:**

Cada fila muestra:
- **Nombre** de la solicitud
- **Tipo** (etiqueta de color)
- **Proyecto** al que pertenece
- **Período** (sección)
- **Actividad** a la que pertenece
- **Solicitante** (nombre y correo del técnico)
- **Fecha** de la solicitud

**Acciones disponibles por solicitud:**

| Botón | Descripción |
|---|---|
| 👁️ **Ver detalle** | Abre una ventana emergente con el detalle completo: lista de ítems, cantidades, importes, lugar, fechas |
| 💬 **Observar** | Permite escribir un comentario de observación y enviar la solicitud de vuelta al solicitante para corrección |
| ✅ **Aprobar** | Marca la solicitud como aprobada y la elimina de la lista pendiente |

> **[INSERTAR CAPTURA: botones de acción en la columna Acciones de la tabla]**

**Ver el detalle de una solicitud:**

1. Haga clic en el botón **👁️** de la solicitud que desea revisar.
2. Se abrirá una ventana emergente mostrando:
   - Información de la actividad y área
   - Lista de fondos o materiales solicitados con montos o cantidades
   - Lugar de entrega y fechas
   - Datos del solicitante
3. Cierre la ventana cuando termine la revisión.

> **[INSERTAR CAPTURA: modal de detalle de una solicitud de fondos]**

**Observar una solicitud:**

Si la solicitud tiene algún problema o requiere corrección:

1. Haga clic en **💬 Observar**.
2. Escriba el motivo de la observación en el campo de texto.
3. Haga clic en **"Guardar observación"**.
4. La solicitud se marcará como observada y dejará de aparecer en la lista de pendientes. El técnico podrá ver el motivo desde su sesión.

> **[INSERTAR CAPTURA: modal de observación con campo de texto y botón guardar]**

**Aprobar una solicitud:**

1. Revise el detalle de la solicitud (opcional pero recomendado).
2. Haga clic en el botón **✅ Aprobar**.
3. Aparecerá una ventana de confirmación con el mensaje "¿Aprobar solicitud? Se marcará esta solicitud como aprobada."
4. Haga clic en **"Aprobar"** para confirmar.
5. La solicitud desaparecerá de la lista y quedará registrada en Asana con la fecha y hora de aprobación.

> **[INSERTAR CAPTURA: ventana de confirmación de aprobación]**

> **Importante:** Solo los roles **Administrador** y **Director** pueden aprobar u observar solicitudes.

---

### 5.2 Contrataciones activas

La segunda sección del Inicio es **Contrataciones Activas** 📋. Muestra todas las contrataciones de personal (tareas con prefijo `CPER`) que están activas en cualquier proyecto.

> **[INSERTAR CAPTURA: sección de Contrataciones Activas con tarjetas de ejemplo]**

Cada contratación se muestra como una **tarjeta** con la siguiente información:

- **Nombre** de la contratación (sin el prefijo CPER)
- **Proyecto** al que pertenece (📁)
- **Período/Sección** (📅)
- **Actividad padre** (📌)
- **Proceso paso a paso** (barra de progreso con 5 etapas)
- **Historial de estados** (registro de todos los cambios realizados)

**Etapas del proceso de contratación:**

El stepper visual muestra el avance a través de las 5 etapas:

```
1. Requerimiento de contratación
       ↓
2. Elaboración de TDRs
       ↓
3. Lanzamiento de convocatoria
       ↓
4. Selección del consultor
       ↓
5. Informe final del consultor
```

Los puntos verdes y la línea verde indican las etapas completadas. El punto del color actual indica la etapa en proceso.

> **[INSERTAR CAPTURA: stepper de 5 etapas de una contratación mostrando progreso]**

**Actualizar el estado de una contratación:**

1. Haga clic en el botón **✏️ Actualizar estado** en la tarjeta de la contratación.
2. Se abrirá el formulario de actualización con los siguientes campos:
   - **Estado actual:** seleccione la etapa del proceso
   - **Observaciones:** describa el avance o novedades (opcional)
   - **Archivos adjuntos:** puede agregar enlaces de documentos de respaldo
   - **Usuario:** se registra automáticamente con su nombre y correo
3. Haga clic en **"Guardar"** para confirmar el cambio.
4. El stepper y el historial se actualizarán inmediatamente.

> **[INSERTAR CAPTURA: modal de actualización de estado de contratación]**

**Ver y gestionar el historial de estados:**

Cada tarjeta tiene una sección **"Historial"** que puede expandir:

1. Haga clic en **▶ Historial (N registros)** para expandir el historial.
2. Cada entrada muestra:
   - Estado registrado
   - Nombre y correo del usuario que registró el cambio
   - Fecha y hora del registro
   - Observaciones escritas
   - Archivos o enlaces de respaldo (como hipervínculos clicables)

> **[INSERTAR CAPTURA: historial expandido de una contratación con varias entradas]**

**Eliminar una entrada del historial:**

Si necesita eliminar un registro incorrecto del historial:

1. En la entrada que desea eliminar, haga clic en el ícono 🗑️.
2. Aparecerá una confirmación: "¿Eliminar esta entrada del historial?"
3. Haga clic en **"Sí"** para confirmar.
4. La entrada se eliminará y el estado actual de la contratación se actualizará al último registro válido.

> **[INSERTAR CAPTURA: botón de eliminar entrada del historial con confirmación]**

---

### 5.3 Actividades con retraso

La tercera sección del Inicio es la tabla de **Actividades con Retraso** ⚠️. Muestra todas las actividades de todos los proyectos que tienen el estado **"En Proceso"** pero cuya fecha de vencimiento ya ha pasado.

> **[INSERTAR CAPTURA: tabla de actividades atrasadas en el Inicio]**

**Columnas de la tabla:**

| Columna | Descripción |
|---|---|
| **Actividad / Proyecto / Responsable** | Nombre de la actividad, proyecto al que pertenece, período y responsable asignado |
| **Sub-actividades** | Lista de sub-actividades con su estado individual (✅/⏳) y barra de progreso |
| **Fecha vencimiento** | Fecha límite que ya fue superada (en rojo) |
| **Días de retraso** | Cantidad de días transcurridos desde la fecha de vencimiento (en rojo) |

La tabla está ordenada de **mayor a menor días de retraso**, poniendo al tope las actividades más críticas.

**Para cada actividad atrasada se puede ver:**

- El **porcentaje de avance** en sub-actividades (barras de progreso verdes).
- Cuántas sub-actividades están ✅ ejecutadas vs. ⏳ pendientes.

Esta información permite al Administrador **priorizar las gestiones** y comunicarse con los responsables correspondientes.

> **[INSERTAR CAPTURA: fila de actividad atrasada con sub-actividades y barra de progreso]**

---

### 5.4 Indicadores de avance global

Al fondo de la pantalla de Inicio se encuentra la sección de **Indicadores de Avance Global** 📊. Esta sección muestra el estado de avance de **todos los proyectos activos** en el workspace CDIMA.

> **[INSERTAR CAPTURA: cuadrícula de indicadores globales por proyecto]**

Cada proyecto se muestra como una **tarjeta** con:

| Indicador | Descripción |
|---|---|
| **Nombre del proyecto** | Nombre completo del proyecto con su color identificador |
| **Gráfico de dona (%)** | Porcentaje de actividades ejecutadas del proyecto |
| **Total** | Número total de actividades (tareas principales) del proyecto |
| **Ejecutadas** | Cantidad de actividades con estado "Ejecutado" |
| **Atrasadas** | Cantidad de actividades cuya fecha ya pasó y no están ejecutadas |
| **Próximas a vencer** | Actividades que vencen en los próximos 7 días |
| **Solicitudes pendientes** | Número de solicitudes pendientes de aprobación en ese proyecto |

El gráfico de dona muestra visualmente el **porcentaje de completud** del proyecto. Cuanto más cerca del 100% (círculo completo), más avanzado está el proyecto.

Los proyectos están ordenados de **mayor a menor porcentaje de avance**.

> **[INSERTAR CAPTURA: tarjeta de un proyecto con el gráfico de dona y todos los indicadores]**

**Uso de los indicadores para toma de decisiones:**

- Proyectos con **alta cantidad de atrasadas** → requieren atención inmediata.
- Proyectos con **solicitudes pendientes > 0** → hay solicitudes esperando aprobación.
- Proyectos con **porcentaje de avance bajo** y fecha avanzada → riesgo de no cumplimiento.

---

---

## 6. MENÚ: ESCUELA DE FORMACIÓN

El menú **Escuela de Formación** (🏫) permite gestionar las escuelas de formación del programa CDIMA. Desde aquí se pueden crear escuelas, inscribir estudiantes, registrar asistencia, centralizar notas y gestionar documentos.

> **Nota:** Este menú solo es visible para los roles **Director** y **Técnico EP**. El rol Administrador **no tiene acceso** a este módulo por defecto según la configuración de permisos actual. Si su organización requiere habilitarlo, debe solicitarlo al equipo técnico.

> Si su rol tiene acceso, haga clic en **🏫 Escuela de Formación** en el menú lateral.

---

### 6.1 Crear una nueva Escuela

1. En la esquina superior derecha de la pantalla, haga clic en el botón **⚙️** (configuración).
2. Del menú desplegable seleccione **➕ Crear nueva Escuela**.
3. Se abrirá el formulario de creación con los siguientes campos:

**Información de la Escuela:**

| Campo | Descripción | Obligatorio |
|---|---|---|
| **Nombre de la Escuela** | Nombre oficial de la escuela (ej.: "Escuela de Lideresas 2026") | Sí |
| **Tipo de Escuela** | Clasificación o tipo del programa | No |

**Registro de Estudiantes iniciales (opcional):**

En la misma pantalla puede registrar uno o más estudiantes desde el inicio. Para cada estudiante complete:

| Campo | Descripción |
|---|---|
| **Nombre(s)** | Primer nombre(s) del estudiante |
| **Apellido Paterno** | Apellido paterno |
| **Apellido Materno** | Apellido materno (opcional) |
| **Género** | Femenino / Masculino / Otro |
| **Fecha de nacimiento** | En formato DD/MM/AAAA |
| **Documento de identidad** | Número de cédula o carnet |
| **Cargo / Especialidad** | Cargo o especialidad del participante |
| **Teléfono** | Número de contacto |
| **Lugar de nacimiento** | Ciudad o localidad |
| **Domicilio** | Dirección actual |
| **Identidad cultural** | Nación/pueblo indígena si corresponde |

4. Haga clic en **"+ Agregar otro estudiante"** si necesita registrar más de uno.
5. Haga clic en **"Guardar"** para crear la escuela. La escuela aparecerá en el selector principal.

> **[INSERTAR CAPTURA: formulario de creación de escuela con campos visibles]**

> **Nota:** El nombre de cada persona se almacena en Asana con el formato: `Nombre, Apellido Paterno, Apellido Materno`. El sistema lo convierte automáticamente para mostrarlo en el orden correcto (Apellido Paterno Apellido Materno, Nombre).

---

### 6.2 Editar una Escuela existente

1. Seleccione la escuela en el selector desplegable superior.
2. Haga clic en el botón **⚙️**.
3. Seleccione **✏️ Editar Escuela**.
4. Se abrirá el formulario con los datos actuales precargados.
5. Puede modificar el nombre, tipo, o los datos de cualquier estudiante.
6. Si desea **eliminar un estudiante**, haga clic en el botón **✕** junto a su nombre. Aparecerá una confirmación antes de eliminarlo permanentemente de Asana.
7. Haga clic en **"Guardar"** para aplicar los cambios.

> **[INSERTAR CAPTURA: formulario de edición de escuela con datos precargados]**

---

### 6.3 Seleccionar una Escuela

En la parte superior de la página encontrará el selector desplegable:

```
🏫 Escuela en: [Seleccionar escuela...]
```

1. Haga clic en el selector.
2. Escriba parte del nombre para filtrar (el campo tiene búsqueda).
3. Seleccione la escuela deseada.
4. El sistema cargará automáticamente todos los datos de esa escuela y mostrará las pestañas de gestión.

> **[INSERTAR CAPTURA: selector de escuela desplegado con opciones visibles]**

---

### 6.4 Pestañas de gestión de la Escuela

Al seleccionar una escuela, aparece una tarjeta con 4 pestañas:

| Pestaña | Ícono | Descripción |
|---|---|---|
| **Estudiantes** | 👨‍🎓 Estudiantes (N) | Lista completa de estudiantes inscritos |
| **Centralizador** | 📊 Centralizador | Tabla de notas por módulo de todos los estudiantes |
| **Asistencia** | ✓ Asistencia | Registro y visualización de asistencias por fecha |
| **Documentos** | 📄 Documentos | Archivos y enlaces asociados a la escuela |

> **[INSERTAR CAPTURA: pestañas de gestión de la escuela seleccionada]**

---

### 6.5 Pestaña: Estudiantes

La pestaña **👨‍🎓 Estudiantes** muestra la lista completa de estudiantes inscritos en la escuela.

> **[INSERTAR CAPTURA: pestaña de estudiantes con lista de personas]**

**Información visible por estudiante:**
- Nombre completo (Apellido Paterno, Apellido Materno, Nombre)
- Género
- Fecha de nacimiento y edad calculada automáticamente
- Documento de identidad
- Especialidad / Cargo
- Teléfono y domicilio

**Acciones disponibles:**

| Botón | Descripción |
|---|---|
| **👁 Ver información** | Muestra la ficha completa de datos del estudiante |
| **📄 Reporte individual** | Genera un PDF con la información del estudiante y sus asistencias |

**Inscribir un nuevo estudiante individualmente:**

1. Haga clic en el botón **"➕ Agregar Estudiante"** en la parte superior de la pestaña.
2. Se abrirá el formulario de registro con los siguientes campos:
   - Nombre(s), Apellido Paterno, Apellido Materno
   - Género, Fecha de nacimiento, Documento de identidad
   - Especialidad, Teléfono, Lugar de nacimiento, Domicilio, Identidad cultural
3. Haga clic en **"Guardar"** para registrar al estudiante.
4. La lista se actualizará mostrando el nuevo estudiante.

> **[INSERTAR CAPTURA: modal de agregar estudiante con todos los campos]**

---

### 6.6 Pestaña: Centralizador de Notas

La pestaña **📊 Centralizador** muestra la tabla consolidada de todas las notas de los estudiantes de la escuela.

> **[INSERTAR CAPTURA: tabla del centralizador de notas con módulos y promedios]**

**Estructura de la tabla:**

| Columna | Descripción |
|---|---|
| **N°** | Número correlativo |
| **Apellidos y Nombre** | Nombre completo del estudiante |
| **Módulo 1...N** | Nota de cada módulo (admite decimales con 2 cifras) |
| **Final** | Nota final calculada (promedio de todos los módulos) |
| **Promedio General** | Fila al pie mostrando el promedio de cada módulo y el promedio global |

**Registrar o actualizar notas:**

1. Haga clic en el botón **"✏️ Registrar Notas"** en la parte superior de la pestaña.
2. Se abrirá el modal de registro de notas con:
   - **Selector de Módulo:** elija el módulo cuyas notas desea registrar (Módulo 1, Módulo 2, etc.)
   - **Lista de estudiantes** con sus notas actuales del módulo seleccionado
3. Modifique las notas que necesite (campo numérico, admite decimales).
4. Al cambiar de módulo, los valores se cargan automáticamente.
5. Al terminar, haga clic en **"Guardar Notas"**.
6. Aparecerá una confirmación indicando cuántas notas se modificarán.
7. Si alguna nota falla al guardarse, el sistema marcará en **rojo** los estudiantes con error y habilitará el botón **"Reintentar Guardado"** para procesar solo los fallidos.

> **[INSERTAR CAPTURA: modal de registro de notas con selector de módulo y tabla]**

---

### 6.7 Pestaña: Asistencia

La pestaña **✓ Asistencia** permite registrar la asistencia de los estudiantes por fecha y visualizar el historial completo.

> **[INSERTAR CAPTURA: pestaña de asistencia con tabla de registros]**

**Registrar asistencia de un día:**

1. Haga clic en el botón **"✓ Registrar Asistencia"**.
2. Se abrirá el modal de asistencia con:
   - **Selector de fecha** (por defecto: hoy) — use el campo de fecha para seleccionar cualquier día.
   - **Lista de todos los estudiantes** con:
     - Checkbox **"Asistió"** (marcado = presente, sin marcar = ausente)
     - Campo de **"Observaciones"** (opcional, ej.: "Permiso médico")
3. Marque o desmarque cada estudiante según corresponda.
4. Haga clic en **"Guardar Asistencias"**.
5. Se mostrará una confirmación con la fecha y la cantidad de estudiantes.
6. Si un registro ya existe para esa fecha, se **reemplazará** automáticamente.
7. Si algún guardado falla, los estudiantes afectados se marcan en **rojo** y puede usar **"Reintentar Guardado"**.

> **[INSERTAR CAPTURA: modal de registro de asistencia con checkbox y fecha]**

**Visualización del historial de asistencias:**

La pestaña muestra una **tabla cruzada** con:
- **Filas:** cada estudiante
- **Columnas:** cada fecha registrada, ordenadas cronológicamente
- **Celdas:** ✅ (asistió) o ❌ (faltó)

> **[INSERTAR CAPTURA: tabla cruzada de asistencias con fechas como columnas]**

**Eliminar registros de asistencia:**

- Para eliminar el registro de **una fecha completa** (todos los estudiantes): haga clic en el ícono 🗑️ en el encabezado de la columna de esa fecha.
- Para eliminar el registro de **un estudiante en una fecha específica**: haga clic en el ícono 🗑️ en la celda correspondiente.
- Ambas acciones piden confirmación antes de ejecutarse.

---

### 6.8 Pestaña: Documentos

La pestaña **📄 Documentos** permite agregar y gestionar enlaces de documentos asociados a la escuela (actas, materiales, fotografías, etc.).

> **[INSERTAR CAPTURA: pestaña de documentos con tarjetas de archivos]**

**Agregar un nuevo documento:**

1. Haga clic en el botón **"+ Agregar archivo"** o en el ícono **➕** dentro de la categoría correspondiente.
2. Se abrirá un formulario con:
   - **Nombre del archivo:** nombre descriptivo (ej.: "Acta de apertura - Enero 2026")
   - **Enlace (URL):** URL válida de Google Drive, OneDrive, o cualquier plataforma
3. Haga clic en **"Guardar"**.
4. El documento aparecerá como una tarjeta con ícono según el tipo (📕 PDF, 📘 Word, 📗 Excel, 📁 Carpeta, etc.).

> **[INSERTAR CAPTURA: modal de agregar documento con campos nombre y URL]**

**Abrir o descargar un documento:**

Haga clic sobre el nombre del archivo o en el ícono de la tarjeta. El enlace se abrirá en una nueva pestaña del navegador.

**Eliminar un documento:**

Haga clic en el ícono **✕** o **🗑️** de la tarjeta del documento. Se pedirá confirmación antes de eliminar.

---

### 6.9 Generación de Reportes de Escuela

En la pantalla de la escuela seleccionada, en la esquina superior derecha, encontrará el botón **"⋯ Reportes ▾"**. Haga clic para ver las opciones de exportación:

| Opción | Formato | Descripción |
|---|---|---|
| **📄 Listado General PDF** | PDF | Lista completa de estudiantes con sus datos personales |
| **📝 Listado General Word** | Word (.docx) | Igual que el anterior en formato editable |
| **🗂 Centralizador de Notas PDF** | PDF | Tabla completa con notas de todos los módulos y promedio |
| **📋 Acta de Calificaciones Word** | Word (.docx) | Documento formal de actas con el formato institucional |

**Pasos para generar un reporte:**

1. Asegúrese de tener una escuela seleccionada y con datos cargados.
2. Haga clic en **"⋯ Reportes ▾"**.
3. Seleccione el tipo de reporte deseado.
4. El archivo se descargará automáticamente.

> **[INSERTAR CAPTURA: menú desplegable de reportes de escuela]**

> **Nota:** Los botones de reportes solo aparecen cuando hay estudiantes registrados en la escuela.

---

## 7. MENÚ: DIPLOMADOS

El menú **Diplomados** (🎓) permite gestionar los diplomados del programa CDIMA. Funciona de manera muy similar a Escuelas, con la diferencia de que los diplomados tienen **Docentes** además de Estudiantes, y manejan **5 módulos** de notas.

> **Nota:** Este menú solo es visible para los roles **Director** y **Técnico EP**. El rol Administrador **no tiene acceso** por defecto. Si se requiere habilitarlo, debe solicitarse al equipo técnico.

> Si su rol tiene acceso, haga clic en **🎓 Diplomados** en el menú lateral.

---

### 7.1 Crear un nuevo Diplomado

1. Haga clic en el botón **⚙️** en la esquina superior derecha.
2. Seleccione **➕ Crear nuevo Diplomado**.
3. Se abrirá el formulario de creación con:

| Campo | Descripción | Obligatorio |
|---|---|---|
| **Nombre del Diplomado** | Nombre oficial (ej.: "Diplomado en Liderazgo Político 2026") | Sí |
| **Descripción** | Descripción breve del programa | No |

4. En la creación de un diplomado no se registran estudiantes ni docentes directamente — estos se agregan desde las pestañas una vez creado el diplomado.
5. Haga clic en **"Crear"** para guardar.

> **[INSERTAR CAPTURA: formulario de creación de diplomado]**

---

### 7.2 Seleccionar un Diplomado

En la parte superior de la página:

```
🎓 Diplomado en: [Seleccionar diplomado...]
```

1. Haga clic en el selector.
2. Escriba parte del nombre para filtrar.
3. Seleccione el diplomado.
4. El sistema cargará los datos y mostrará las 5 pestañas de gestión.

> **[INSERTAR CAPTURA: selector de diplomado desplegado con opciones visibles]**

---

### 7.3 Pestañas de gestión del Diplomado

Al seleccionar un diplomado, aparece una tarjeta con **5 pestañas**:

| Pestaña | Ícono | Descripción |
|---|---|---|
| **Docentes** | 👨‍🏫 Docentes (N) | Lista de docentes del diplomado |
| **Estudiantes** | 👨‍🎓 Estudiantes (N) | Lista de estudiantes inscritos |
| **Centralizador** | 📊 Centralizador | Tabla de notas (5 módulos + Final + Promedio) |
| **Asistencia** | ✓ Asistencia | Registro de asistencias por fecha |
| **Documentos** | 📄 Documentos | Archivos y enlaces del diplomado |

> **[INSERTAR CAPTURA: 5 pestañas de gestión del diplomado seleccionado]**

---

### 7.4 Pestaña: Docentes

La pestaña **👨‍🏫 Docentes** muestra y gestiona los docentes asignados al diplomado.

> **[INSERTAR CAPTURA: pestaña de docentes con lista de personas]**

**Agregar un Docente:**

1. Haga clic en el botón **"➕ Agregar Docente"**.
2. Se abrirá el formulario con los mismos campos que para estudiantes:
   - Nombre(s), Apellidos, Género, Fecha de nacimiento, Documento de identidad
   - **Cargo** (en lugar de Especialidad para docentes), Teléfono, Domicilio, etc.
3. Haga clic en **"Guardar"** para registrar al docente.

> **[INSERTAR CAPTURA: modal de agregar docente con campos visibles]**

**Acciones por docente:**
- **👁 Ver información:** muestra la ficha completa del docente
- **📄 Reporte individual:** genera un PDF con la información del docente

---

### 7.5 Pestaña: Estudiantes (Diplomado)

Idéntica a la pestaña de Estudiantes de Escuelas (ver sección 6.5), con las mismas funciones de agregar, ver información y generar reportes individuales.

**Inscribir un Estudiante:**

1. Haga clic en **"➕ Agregar Estudiante"**.
2. Complete todos los campos del formulario.
3. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: pestaña de estudiantes del diplomado]**

---

### 7.6 Pestaña: Centralizador de Notas (Diplomado)

La pestaña **📊 Centralizador** funciona igual que en Escuelas (ver sección 6.6), pero con una estructura específica de **5 módulos**:

| Columna | Descripción |
|---|---|
| **Módulo 1 — Módulo 5** | Notas de cada uno de los 5 módulos del diplomado |
| **Final** | Promedio calculado de los 5 módulos (admite decimales) |
| **Promedio General** | Fila al pie con el promedio de cada módulo y el promedio global |

> **[INSERTAR CAPTURA: tabla del centralizador con 5 módulos, columna Final y fila de Promedio General]**

**Registrar notas:**

1. Haga clic en **"✏️ Registrar Notas"**.
2. En el modal, use el **selector de módulo** para elegir entre Módulo 1 a Módulo 5.
3. Ingrese las notas de cada estudiante (admite valores con decimales).
4. Solo se guardarán en Asana las notas que fueron **modificadas** respecto a los valores actuales.
5. Haga clic en **"Guardar Notas"** y confirme la acción.
6. El sistema procesa los cambios en lotes y notifica el resultado.

> **[INSERTAR CAPTURA: modal de registro de notas del diplomado con selector de módulo]**

---

### 7.7 Pestaña: Asistencia (Diplomado)

Idéntica a la pestaña de Asistencia de Escuelas (ver sección 6.7). Las funcionalidades son exactamente las mismas:

- Registrar asistencia para una fecha seleccionada
- Ver tabla cruzada histórica de asistencias
- Eliminar registros por fecha o por estudiante individual

> **[INSERTAR CAPTURA: pestaña de asistencia del diplomado con tabla histórica]**

---

### 7.8 Pestaña: Documentos (Diplomado)

Idéntica a la pestaña de Documentos de Escuelas (ver sección 6.8). Permite agregar, visualizar y eliminar documentos y enlaces del diplomado.

> **[INSERTAR CAPTURA: pestaña de documentos del diplomado con tarjetas de archivos]**

---

### 7.9 Generación de Reportes de Diplomado

En la esquina superior derecha del diplomado seleccionado, haga clic en **"⋯ Reportes ▾"**:

| Opción | Formato | Descripción |
|---|---|---|
| **📄 Listado General PDF** | PDF | Lista completa de docentes y estudiantes con datos personales |
| **📝 Listado General Word** | Word (.docx) | Igual en formato editable |
| **🗂 Centralizador PDF** | PDF | Tabla con los 5 módulos, columna Final y Promedio General por estudiante |
| **📊 Centralizador Word** | Word (.docx) | Igual en formato editable |

> **[INSERTAR CAPTURA: menú desplegable de reportes del diplomado]**

> **Nota:** Para exportar el Centralizador debe haber al menos un estudiante registrado en el diplomado.

---

## NOTAS FINALES

- Todos los cambios realizados desde CDIMA Amuyt'a (cambios de estado, aprobaciones, observaciones, actualizaciones de contrataciones) se guardan directamente en **Asana** y son visibles para todos los usuarios del workspace.
- Se recomienda **no cerrar la sesión** de Asana mientras se trabaja en CDIMA Amuyt'a, ya que el sistema requiere el token de conexión activo.
- Para cualquier problema técnico, consulte al equipo de soporte de CDIMA.

---

*Manual generado para uso interno de CDIMA — Rol Administrador*  
*Sistema CDIMA Amuyt'a — Sistema de Gestión de Proyectos y Control Académico*
