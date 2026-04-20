# Manual de Usuario — Rol Administrador
## Sistema CDIMA Amuyt'a

**Versión:** 2.0  
**Fecha:** Abril 2026  
**Dirigido a:** Usuarios con rol **Administrador**

---

## ÍNDICE

1. [Ingreso al Sistema](#1-ingreso-al-sistema)  
   1.1 [Ingreso a Asana](#11-ingreso-a-asana)  
   1.2 [Ingreso a CDIMA Amuyt'a](#12-ingreso-a-cdima-amuyta)  
   1.3 [Ingreso a Google Drive](#13-ingreso-a-google-drive)  
2. [Roles y Permisos](#2-roles-y-permisos)  
   2.1 [Tabla de roles del sistema](#21-tabla-de-roles-del-sistema)  
   2.2 [Permisos del rol Administrador](#22-permisos-del-rol-administrador)  
   2.3 [Menú disponible según rol](#23-menú-disponible-según-rol)  
3. [Menú: INICIO](#3-menú-inicio)  
   3.1 [Solicitudes pendientes de aprobación](#31-solicitudes-pendientes-de-aprobación)  
   3.2 [Aprobar una solicitud](#32-aprobar-una-solicitud)  
   3.3 [Observar una solicitud](#33-observar-una-solicitud)  
   3.4 [Contrataciones activas](#34-contrataciones-activas)  
   3.5 [Actividades con retraso](#35-actividades-con-retraso)  
   3.6 [Indicadores de avance global](#36-indicadores-de-avance-global)  
4. [Menú: PROYECTOS](#4-menú-proyectos)  
   4.1 [Selección de proyecto, período y actividad](#41-selección-de-proyecto-período-y-actividad)  
   4.2 [Visualización del detalle de avance](#42-visualización-del-detalle-de-avance)  
   4.3 [Cambiar estado de una sub-actividad](#43-cambiar-estado-de-una-sub-actividad)  
   4.4 [Gestionar solicitudes desde la actividad](#44-gestionar-solicitudes-desde-la-actividad)  
   4.5 [Agregar fuentes de verificación](#45-agregar-fuentes-de-verificación)  
   4.6 [Actualizar estado de contratación](#46-actualizar-estado-de-contratación)  
   4.7 [Exportar reporte de actividad](#47-exportar-reporte-de-actividad)  
5. [Menú: COMUNICACIÓN](#5-menú-comunicación)  
   5.1 [Navegación por proyectos y carpetas](#51-navegación-por-proyectos-y-carpetas)  
   5.2 [Descarga de archivos](#52-descarga-de-archivos)  
6. [Menú: PLANIFICACIÓN](#6-menú-planificación)  
   6.1 [Cargado de información en Asana](#61-cargado-de-información-en-asana)  
   6.2 [Visualización del calendario](#62-visualización-del-calendario)  
   6.3 [Indicadores del mes](#63-indicadores-del-mes)  
   6.4 [Lista de actividades y filtros](#64-lista-de-actividades-y-filtros)  
   6.5 [Cambiar el estado de una actividad](#65-cambiar-el-estado-de-una-actividad)  
   6.6 [Agregar fuentes de verificación desde Planificación](#66-agregar-fuentes-de-verificación-desde-planificación)  
   6.7 [Generación de reportes de Planificación](#67-generación-de-reportes-de-planificación)  
7. [Menú: INVESTIGACIÓN E INCIDENCIA](#7-menú-investigación-e-incidencia)  
   7.1 [Visualización de tareas](#71-visualización-de-tareas)  
   7.2 [Agregar un documento a una tarea](#72-agregar-un-documento-a-una-tarea)  
   7.3 [Eliminar un documento](#73-eliminar-un-documento)  

---

## 1. INGRESO AL SISTEMA

El rol **Administrador** trabaja con tres plataformas complementarias:

| Plataforma | Propósito |
|---|---|
| **Asana** | Ingreso y gestión de datos de las actividades: fechas, responsables, estados, subtareas, archivos adjuntos |
| **CDIMA Amuyt'a** | Visualización, seguimiento, aprobación de solicitudes y generación de reportes |
| **Google Drive** | Repositorio de archivos y documentos de respaldo |

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
4. Haga clic en **"Iniciar sesión"**.
5. Una vez dentro, verifique que se encuentra en el **workspace CDIMA** (aparece en la barra lateral izquierda o en el selector de workspace).

> **[INSERTAR CAPTURA: pantalla de login de Asana]**

**Resultado esperado:** Ingresa al workspace CDIMA y puede ver la lista de proyectos en la barra lateral.

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
   - **Correo electrónico:** `sandraveragutierrez@gmail.com` *(u otras credenciales asignadas por el Director)*
   - **Contraseña:** la contraseña del rol Administrador
3. Haga clic en el botón **"Ingresar"**.

> **[INSERTAR CAPTURA: pantalla de login de CDIMA Amuyt'a]**

**Resultado esperado:** Es redirigido automáticamente a la pantalla de **Inicio** con el menú lateral visible.

> **[INSERTAR CAPTURA: pantalla de Inicio después del login con menú lateral]**

**Menú lateral disponible para el Administrador:**

| Ícono | Nombre | Descripción |
|---|---|---|
| 🏠 | **Inicio** | Resumen ejecutivo: solicitudes, contrataciones, retrasos e indicadores |
| 📊 | **Proyectos** | Detalle de avance por proyecto, período y actividad |
| 📡 | **Comunicación** | Biblioteca de archivos organizados por proyecto/carpeta |
| 📅 | **Planificación** | Calendario de actividades, estadísticas y reportes |
| 🔬 | **Investigación e Incidencia** | Gestión de documentos del proyecto SAIH investigación |

---

### 1.3 Ingreso a Google Drive

**URL de acceso:**
```
https://drive.google.com
```

**Pasos:**

1. Abra su navegador e ingrese a `https://drive.google.com`.
2. Inicie sesión con la cuenta de Google institucional asignada por CDIMA.
3. Verifique que tiene acceso a la carpeta compartida **"CDIMA"** (debe aparecer en **"Compartidos conmigo"** o en **"Mi unidad"**).

> **[INSERTAR CAPTURA: carpeta CDIMA visible en Google Drive]**

**Resultado esperado:** Tiene acceso a los documentos compartidos en Drive que se vinculan desde CDIMA Amuyt'a.

> **Recomendación:** Mantenga las tres plataformas abiertas en pestañas distintas mientras trabaja:

| Pestaña | URL |
|---|---|
| **Asana** | `https://app.asana.com` |
| **CDIMA Amuyt'a** | `https://cdima-reportes.vercel.app` |
| **Google Drive** | `https://drive.google.com` |

---

## 2. ROLES Y PERMISOS

CDIMA Amuyt'a gestiona el acceso mediante **roles de usuario**. Cada rol define qué menús puede ver y qué acciones puede realizar dentro del sistema.

---

### 2.1 Tabla de roles del sistema

| Rol | Descripción |
|---|---|
| **Director** | Acceso total a todos los módulos y funciones |
| **Administrador** | Gestión administrativa: aprueba solicitudes, supervisa proyectos y planificación, gestiona documentos |
| **Técnico EV** | Técnico de Erradicación de Violencia: gestiona proyectos y escuelas del área EV |
| **Técnico EP** | Técnico de Empoderamiento Político: gestiona proyectos, escuelas, diplomados y cursos de alto nivel |
| **Comunicación** | Acceso a reportes, biblioteca y planificación; sin aprobación de solicitudes |
| **Planificador** | Solo puede ver la biblioteca y planificación |

---

### 2.2 Permisos del rol Administrador

El rol **Administrador** tiene los siguientes permisos habilitados:

**Módulo Inicio:**
| Permiso | ¿Tiene acceso? |
|---|---|
| Ver detalle de solicitudes | ✅ Sí |
| Aprobar solicitudes | ✅ Sí |
| Observar / devolver solicitudes | ✅ Sí |

**Módulo Proyectos:**
| Permiso | ¿Tiene acceso? |
|---|---|
| Crear solicitudes de fondos/materiales | ✅ Sí |
| Aprobar y observar solicitudes | ✅ Sí |
| Eliminar solicitudes | ✅ Sí |
| Cambiar estado de sub-actividades | ✅ Sí |
| Registrar beneficiarios | ✅ Sí |
| Agregar fuentes de verificación | ✅ Sí |
| Actualizar estado de contrataciones | ✅ Sí |
| Exportar reportes | ✅ Sí |

**Módulo Escuelas / Diplomados / Alto Nivel:**
| Permiso | ¿Tiene acceso? |
|---|---|
| Crear, editar, gestionar | ❌ No (exclusivo de Director y Técnico EP) |

**Módulo Investigación e Incidencia:**
| Permiso | ¿Tiene acceso? |
|---|---|
| Gestionar documentos | ✅ Sí |

> **Nota:** Solo los roles **Administrador** y **Director** pueden aprobar u observar solicitudes. Los demás roles solo pueden ver el detalle.

---

### 2.3 Menú disponible según rol

| Menú | Administrador | Director | Técnico EV | Técnico EP | Comunicación | Planificador |
|---|---|---|---|---|---|---|
| 🏠 Inicio | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 📊 Proyectos | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 📡 Comunicación | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📅 Planificación | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🏫 Escuelas | ❌ | ✅ | ✅ (solo área EV) | ✅ (solo área EP) | ❌ | ❌ |
| 🎓 Diplomados | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 🏆 Prod. Alto Nivel | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 🔬 Investigación | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 3. MENÚ: INICIO

La pantalla de **Inicio** (🏠) es el panel de control principal del Administrador. Muestra en tiempo real el estado de solicitudes pendientes, contrataciones activas, actividades con retraso e indicadores de avance global.

**Acción:** Acceder al panel de control.

**Pasos:**
1. Haga clic en **🏠 Inicio** en el menú lateral izquierdo.
2. Si ya está en Inicio, haga clic en el botón **🔄 Actualizar** para recargar todos los datos desde Asana.

> **[INSERTAR CAPTURA: pantalla completa de Inicio con todas las secciones visibles]**

**Resultado esperado:** El sistema carga todas las solicitudes, contrataciones e indicadores desde Asana y los muestra en las secciones correspondientes.

---

### 3.1 Solicitudes pendientes de aprobación

Esta sección muestra todas las solicitudes que los técnicos han generado y que requieren una acción del Administrador.

**Tipos de solicitudes:**

| Tipo | Color | Prefijo en Asana | Descripción |
|---|---|---|---|
| **Solicitud de Fondos** | 🔵 Azul | `SFON` | Solicitudes de dinero para actividades |
| **Solicitud de Material** | 🟠 Naranja | `SMAT` | Pedidos de materiales o insumos |
| **Devolución de Material** | 🟣 Morado | `DMAT` | Registro de devolución de materiales |

**Información en la tabla:**

| Columna | Descripción |
|---|---|
| **Nombre** | Nombre de la solicitud (sin prefijo) |
| **Tipo** | Etiqueta de color según el tipo |
| **Proyecto** | Proyecto al que pertenece |
| **Período** | Sección del proyecto |
| **Actividad** | Nombre de la actividad padre |
| **Solicitante** | Nombre y correo del técnico que generó la solicitud |
| **Fecha** | Fecha de creación de la solicitud |
| **Acciones** | Botones de Ver detalle, Observar y Aprobar |

**Acción:** Ver el detalle de una solicitud.

**Pasos:**
1. Ubique la solicitud en la tabla de pendientes.
2. Haga clic en el botón **👁️** en la columna **Acciones**.
3. Revise la ventana emergente: lista de ítems, cantidades, importes, lugar de entrega, fechas y datos del solicitante.
4. Cierre la ventana cuando termine la revisión.

> **[INSERTAR CAPTURA: modal de detalle de una solicitud de fondos con ítems y montos]**

**Resultado esperado:** Se abre un modal con toda la información de la solicitud sin realizar ningún cambio.

---

### 3.2 Aprobar una solicitud

**Acción:** Marcar una solicitud como aprobada.

**Pasos:**
1. Revise el detalle de la solicitud (recomendado antes de aprobar).
2. Haga clic en el botón **✅ Aprobar** en la fila de la solicitud.
3. Aparecerá una ventana de confirmación: *"¿Aprobar solicitud? Se marcará esta solicitud como aprobada."*
4. Haga clic en **"Aprobar"** para confirmar.

> **[INSERTAR CAPTURA: ventana de confirmación de aprobación]**

**Resultado esperado:** La solicitud desaparece de la lista de pendientes y queda registrada en Asana con la fecha y hora de aprobación.

> **Importante:** Solo los roles **Administrador** y **Director** pueden aprobar solicitudes.

---

### 3.3 Observar una solicitud

**Acción:** Devolver una solicitud al técnico con un comentario de corrección.

**Pasos:**
1. Ubique la solicitud en la tabla de pendientes.
2. Haga clic en el botón **💬 Observar**.
3. Escriba el motivo de la observación en el campo de texto (ej.: "Falta adjuntar cotización").
4. Haga clic en **"Guardar observación"**.

> **[INSERTAR CAPTURA: modal de observación con campo de texto y botón guardar]**

**Resultado esperado:** La solicitud se marca como observada, desaparece de la lista de pendientes y el técnico puede ver el motivo desde su sesión para proceder a la corrección.

---

### 3.4 Contrataciones activas

Esta sección muestra todas las contrataciones de personal (tareas con prefijo `CPER`) activas en cualquier proyecto.

Cada contratación se presenta como una **tarjeta** con:
- **Nombre** de la contratación
- **Proyecto, Período y Actividad** padre
- **Barra de progreso** con las 5 etapas del proceso
- **Historial de estados** expandible

**Etapas del proceso de contratación:**

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

> **[INSERTAR CAPTURA: tarjeta de contratación con el stepper de 5 etapas y barra de progreso]**

**Acción:** Actualizar el estado de una contratación.

**Pasos:**
1. Ubique la tarjeta de la contratación que desea actualizar.
2. Haga clic en el botón **✏️ Actualizar estado**.
3. En el formulario emergente, complete:
   - **Estado actual:** seleccione la etapa del proceso
   - **Observaciones / comentario:** detalle del avance o nota relevante
   - **Archivos de respaldo:** enlace o URL de documentos de soporte
4. Haga clic en **"Guardar"** para confirmar.

> **[INSERTAR CAPTURA: modal de actualización de estado de contratación con los campos]**

**Resultado esperado:** El stepper visual se actualiza, el historial registra la nueva entrada con fecha y usuario, y los cambios se guardan en Asana.

**Acción:** Ver el historial de estados de una contratación.

**Pasos:**
1. En la tarjeta de la contratación, haga clic en **▶ Historial (N registros)**.
2. Se despliega la lista de todos los cambios: estado, observaciones, fecha, usuario y enlaces de respaldo.

> **[INSERTAR CAPTURA: historial expandido de una contratación con entradas de cambio]**

**Resultado esperado:** Se muestran todos los registros de cambio en orden cronológico con sus datos completos.

---

### 3.5 Actividades con retraso

Esta sección lista las actividades de todos los proyectos cuya fecha de vencimiento ya pasó y que aún están en estado **"En Proceso"**.

> **[INSERTAR CAPTURA: sección de actividades con retraso en el panel de Inicio]**

Cada fila muestra: nombre de la actividad, proyecto, período, fecha de vencimiento y días de retraso.

---

### 3.6 Indicadores de avance global

En la parte inferior del Inicio se presentan los **indicadores generales** de todos los proyectos activos:

| Indicador | Descripción |
|---|---|
| **Total de actividades** | Conteo total de actividades en todos los proyectos |
| **Ejecutadas** | Actividades con estado "Ejecutado" o "Reprogramado" |
| **En Proceso** | Actividades que aún no han sido completadas |
| **% de avance** | Porcentaje de actividades ejecutadas sobre el total |

> **[INSERTAR CAPTURA: panel de indicadores de avance global]**

---

## 4. MENÚ: PROYECTOS

El menú **Proyectos** (📊) permite acceder al **detalle de avance** de cada actividad dentro de los diferentes proyectos CDIMA. Permite gestionar sub-actividades, solicitudes, contrataciones, beneficiarios y fuentes de verificación.

Para ingresar haga clic en **📊 Proyectos** en el menú lateral.

---

### 4.1 Selección de proyecto, período y actividad

**Acción:** Navegar hasta una actividad específica.

**Pasos:**
1. En la primera columna del **selector jerárquico**, haga clic sobre el **nombre del proyecto** (ej.: "Proyecto EV 2026"). El sistema carga sus períodos.
2. En la segunda columna, haga clic sobre el **período o sección** (ej.: "Enero 2026"). El sistema carga sus actividades.
3. En la tercera columna, haga clic sobre la **actividad** que desea revisar.

> **[INSERTAR CAPTURA: selector jerárquico de tres columnas con proyecto, período y actividad]**

**Resultado esperado:** El panel de detalle de la actividad se despliega a la derecha con toda su información.

> **Tip:** Use la **barra de búsqueda** y el **filtro de estado** en la parte superior del selector para encontrar actividades más rápido.

---

### 4.2 Visualización del detalle de avance

Al seleccionar una actividad se muestra su información completa en pestañas:

**Información general:**

| Dato | Descripción |
|---|---|
| **Nombre** | Nombre completo de la actividad |
| **Estado** | Estado actual (En Proceso, Ejecutado, Reprogramado) |
| **Fechas** | Fecha de inicio y fecha de vencimiento |
| **Área** | Área responsable |
| **Responsables** | Nombre(s) del responsable |
| **Notas** | Descripción o notas adicionales |

**Pestañas disponibles:**

| Pestaña | Contenido |
|---|---|
| **Sub-actividades** | Lista de subtareas con estado, barras de progreso, fechas y diagrama Gantt |
| **Solicitudes** | Historial de solicitudes de fondos, materiales y devoluciones |
| **Contrataciones** | Estado de contrataciones paso a paso con historial |
| **Distribución** | Distribución de responsabilidades |
| **Beneficiarios** | Registro de beneficiarios cuando aplica |

> **[INSERTAR CAPTURA: vista de detalle de actividad con pestañas y barra de progreso]**

**Resultado esperado:** Visualiza el estado completo de la actividad con todos sus datos y sub-elementos.

---

### 4.3 Cambiar estado de una sub-actividad

**Acción:** Actualizar el estado de una sub-actividad (subtarea).

**Pasos:**
1. Seleccione la actividad padre en el selector.
2. Haga clic en la pestaña **Sub-actividades**.
3. Ubique la sub-actividad en la lista.
4. En la columna **Estado**, haga clic en el **dropdown** de estado.
5. Seleccione el nuevo estado: *"Ejecutado"*, *"Reprogramado"* o *"En Proceso"*.

> **[INSERTAR CAPTURA: dropdown de estado de una sub-actividad abierto con las opciones]**

**Resultado esperado:** El estado se actualiza en Asana inmediatamente. La barra de progreso de la actividad padre se recalcula automáticamente.

---

### 4.4 Gestionar solicitudes desde la actividad

**Acción:** Crear una nueva solicitud de fondos o materiales.

**Pasos:**
1. Seleccione la actividad y vaya a la pestaña **Solicitudes**.
2. Haga clic en **"+ Nueva solicitud"** (o el botón correspondiente según el tipo).
3. Complete el formulario: tipo de solicitud, ítems, cantidades, importes, lugar de entrega y fecha.
4. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: formulario de nueva solicitud de fondos con los campos]**

**Resultado esperado:** La solicitud queda registrada en Asana con el prefijo correspondiente (`SFON`, `SMAT`, `DMAT`) y aparece en la lista de pendientes del Inicio para su aprobación.

**Acción:** Aprobar o eliminar una solicitud desde la actividad.

**Pasos:**
1. En la pestaña **Solicitudes**, ubique la solicitud.
2. Haga clic en **✅ Aprobar** o en el ícono de eliminar según corresponda.
3. Confirme la acción en la ventana emergente.

> **[INSERTAR CAPTURA: tabla de solicitudes dentro de la actividad con botones de acción]**

**Resultado esperado:** La solicitud cambia de estado o se elimina, y el registro en Asana se actualiza.

---

### 4.5 Agregar fuentes de verificación

**Acción:** Vincular un documento de respaldo a una actividad.

**Pasos:**
1. En la columna **"Fuente"** de cualquier tabla de actividades, haga clic en **"+ fuente"** (primera vez) o en **✏️** (para editar una existente).
2. En el formulario emergente complete:
   - **Nombre:** nombre descriptivo del documento (ej.: "Informe Febrero 2026")
   - **URL:** enlace de Google Drive u otra URL válida
3. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: formulario de fuente de verificación con los campos nombre y URL]**

**Resultado esperado:** El enlace queda guardado en Asana y la columna Fuente muestra el botón **🔗 Ver fuente** como hipervínculo clicable.

> **[INSERTAR CAPTURA: columna Fuente con enlace activo "Ver fuente"]**

---

### 4.6 Actualizar estado de contratación

**Acción:** Avanzar el proceso de contratación al siguiente paso.

**Pasos:**
1. Seleccione la actividad y vaya a la pestaña **Contrataciones**.
2. Ubique la contratación (tarjeta CPER) que desea actualizar.
3. Haga clic en **✏️ Actualizar estado**.
4. Seleccione la etapa actual del proceso, agregue observaciones y un enlace de respaldo si corresponde.
5. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: modal de actualización de estado de contratación desde la pestaña]**

**Resultado esperado:** El stepper avanza a la nueva etapa y el historial registra el cambio con fecha y usuario.

---

### 4.7 Exportar reporte de actividad

**Acción:** Generar un informe PDF o Word de una actividad específica.

**Pasos:**
1. Seleccione la actividad cuyo reporte desea generar.
2. En la barra superior del panel de detalle, haga clic en el botón de exportación:
   - **📄 Exportar PDF** — genera un informe completo en formato PDF
   - **📝 Exportar Word** — genera el mismo informe en formato editable Word
3. El archivo se descarga automáticamente.

> **[INSERTAR CAPTURA: botones de exportación PDF y Word en la vista de detalle de actividad]**

**Resultado esperado:** Se descarga un archivo con el nombre del proyecto y la actividad, conteniendo sub-actividades, estados, fechas, distribución de responsables y solicitudes.

---

## 5. MENÚ: COMUNICACIÓN

El menú **Comunicación** (📡) funciona como una **biblioteca digital** de archivos organizados por proyecto y carpeta. Permite navegar y descargar documentos de respaldo de todos los proyectos.

Para ingresar haga clic en **📡 Comunicación** en el menú lateral.

> **[INSERTAR CAPTURA: vista general de la página de Comunicación con lista de proyectos]**

---

### 5.1 Navegación por proyectos y carpetas

La pantalla de Comunicación está organizada en tres niveles de navegación:

**Acción:** Navegar hasta los archivos de un proyecto.

**Pasos:**
1. **Nivel 1 — Proyectos:** Al ingresar verá la lista de todos los proyectos del workspace CDIMA como tarjetas. Haga clic sobre el proyecto que le interesa.

> **[INSERTAR CAPTURA: lista de proyectos en la página de Comunicación como tarjetas]**

2. **Nivel 2 — Secciones:** Las secciones del proyecto se muestran como carpetas. Haga clic sobre la sección/carpeta de interés.

> **[INSERTAR CAPTURA: secciones del proyecto mostradas como carpetas con ícono]**

3. **Nivel 3 — Tareas y archivos:** Dentro de cada sección verá las tareas y sus archivos adjuntos.

> **[INSERTAR CAPTURA: archivos y enlaces dentro de una tarea en Comunicación]**

**Resultado esperado:** Accede al nivel deseado y puede ver los archivos disponibles.

**Barra de navegación (breadcrumb):**  
`Proyectos > [Nombre Proyecto] > [Nombre Sección] > [Nombre Tarea]`

Haga clic en cualquier nivel del breadcrumb para regresar a ese punto.

**Búsqueda:** Use el campo 🔍 para filtrar por nombre de archivo, carpeta o tarea dentro del nivel actual.

---

### 5.2 Descarga de archivos

Los archivos se identifican visualmente por tipo:

| Tipo | Color | Ícono |
|---|---|---|
| Carpeta (Google Drive) | Naranja/Café | 📁 |
| PDF | Rojo | 📕 |
| Word / Documento | Azul | 📘 |
| Excel / Hoja de cálculo | Verde | 📗 |
| PowerPoint | Naranja | 📙 |
| Imagen | Morado | 🖼️ |
| Video | Azul claro | 🎬 |
| Enlace / Otro | Gris | 🔗 |

**Acción:** Abrir o descargar un archivo.

**Pasos:**
1. Ubique el archivo dentro de la tarea.
2. Haga clic en el botón **⬇ Descargar** o en el ícono de descarga de la tarjeta.

> **[INSERTAR CAPTURA: tarjetas de archivos con distintos tipos de íconos y botón descargar]**

**Resultado esperado:** El archivo se abre en una nueva pestaña del navegador (para enlaces de Google Drive) o se descarga directamente a su computadora.

> **Nota:** El rol Administrador puede **ver y descargar** todos los archivos disponibles. Solo el rol **Comunicación** puede agregar o eliminar archivos desde este módulo.

---

## 6. MENÚ: PLANIFICACIÓN

El menú **Planificación** (📅) permite visualizar y gestionar las actividades del proyecto de planificación CDIMA en un calendario interactivo. La información se obtiene directamente de Asana.

Para ingresar haga clic en **📅 Planificación** en el menú lateral.

---

### 6.1 Cargado de información en Asana

Antes de visualizar las actividades en CDIMA Amuyt'a, la información debe estar ingresada en Asana.

**Acción:** Ingresar o completar una actividad en Asana para que aparezca en el calendario.

**Pasos:**
1. Acceda al proyecto **"Planificacion CDIMA"** en Asana.
2. Seleccione la **sección** (período) correspondiente.
3. Haga clic en **"+ Agregar tarea"** e ingrese el nombre de la actividad.
4. Abra la tarea y complete los siguientes campos:

| Campo en Asana | Descripción | Dónde se ingresa |
|---|---|---|
| **Nombre de la tarea** | Nombre descriptivo de la actividad | Campo principal de la tarea |
| **Fecha de inicio** | Cuándo comienza la actividad | Sección "Fechas" → "Fecha de inicio" |
| **Fecha de vencimiento** | Fecha límite de la actividad | Sección "Fechas" → "Fecha de vencimiento" |
| **Estado** | Estado actual (En Proceso, Ejecutado, Reprogramado) | Campo personalizado "Estado" |
| **Área** | Área responsable | Campo personalizado "Área" |
| **Responsables de actividad** | Nombre(s) del responsable | Campo personalizado "Responsables de actividad" |
| **Fuente** | Nombre del documento de respaldo | Campo personalizado "Fuente" |
| **Fuente URL** | Enlace de Google Drive | Campo personalizado "Fuente URL" |

5. Guarde los cambios.

> **[INSERTAR CAPTURA: ficha de tarea en Asana con los campos personalizados completados]**

**Resultado esperado:** La actividad aparece automáticamente en el calendario de CDIMA Amuyt'a en el rango de fechas indicado.

---

### 6.2 Visualización del calendario

**Acción:** Ver el calendario de actividades del mes.

**Pasos:**
1. Ingrese a **📅 Planificación**. El sistema carga automáticamente el mes actual.
2. Use los botones **◀ Anterior** y **Siguiente ▶** para navegar entre meses.
3. Use el botón **"Hoy"** para regresar al mes actual.
4. Use los botones de vista para cambiar entre **Mes**, **Semana** o **Día**.
5. Haga clic sobre cualquier bloque del calendario para ver el detalle de una actividad.

> **[INSERTAR CAPTURA: vista general del calendario con actividades en distintos colores]**

**Resultado esperado:** Se muestra el calendario con todas las actividades del período como bloques de color. Al hacer clic en un bloque aparece el detalle: nombre, fecha de vencimiento, estado, área y responsable.

> **[INSERTAR CAPTURA: modal de detalle de actividad al hacer clic en el calendario]**

**Leyenda de colores:**

| Color / Estilo | Significado |
|---|---|
| Colores variados | Cada actividad tiene un color único |
| Fondo rojo con borde rojo | Actividad **atrasada** (En Proceso y fecha vencida) |
| Opacidad reducida (grisado) | Actividad **Ejecutada** o **Reprogramada** |

---

### 6.3 Indicadores del mes

Debajo del calendario se muestran automáticamente los **indicadores estadísticos del mes visualizado**:

| Indicador | Descripción |
|---|---|
| **Total** | Cantidad total de actividades programadas en el mes |
| **Ejecutadas** | Actividades con estado "Ejecutado" o "Reprogramado" |
| **En Proceso** | Actividades que aún no han sido completadas |
| **% de avance** | Porcentaje de actividades ejecutadas sobre el total |

> **[INSERTAR CAPTURA: sección de estadísticas con indicadores numéricos del mes]**

**Resultado esperado:** Los indicadores se actualizan automáticamente al navegar entre meses.

---

### 6.4 Lista de actividades y filtros

Debajo de los indicadores se muestran **tres tablas** con el detalle de actividades del mes:

1. **⚠️ Actividades En Proceso (Atrasadas)** — Fecha vencida y aún "En Proceso".
2. **🔄 Actividades En Proceso** — En curso y dentro de su plazo.
3. **✅ Actividades Ejecutadas** — Completadas en el mes visualizado.

**Columnas de cada tabla:**

| Columna | Descripción |
|---|---|
| **Actividad** | Nombre, área y responsable |
| **Fecha** | Rango de fechas (inicio - vencimiento) |
| **Fuente** | Enlace a la fuente de verificación |
| **Estado** | Dropdown para cambiar el estado directamente |

**Acción:** Filtrar actividades por área.

**Pasos:**
1. En la barra de herramientas sobre las tablas, haga clic en el selector **"Filtrar por área"**.
2. Elija el área deseada (ej.: "Comunicación", "Planificación").
3. Las tres tablas se actualizan mostrando solo las actividades de esa área.
4. Para quitar el filtro, haga clic en **"✕ Limpiar"**.

> **[INSERTAR CAPTURA: selector de filtro por área con opciones desplegadas]**

**Resultado esperado:** Las tablas muestran únicamente las actividades del área seleccionada.

---

### 6.5 Cambiar el estado de una actividad

**Acción:** Actualizar el estado de una actividad directamente desde la tabla.

**Pasos:**
1. Ubique la actividad en cualquiera de las tres tablas.
2. Haga clic en el **dropdown de estado** en la columna correspondiente.
3. Seleccione el nuevo estado: *"Ejecutado"*, *"Reprogramado"* o *"En Proceso"*.

> **[INSERTAR CAPTURA: dropdown de estado abierto en la columna de la tabla]**

**Resultado esperado:** El sistema actualiza el estado en Asana inmediatamente. El dropdown muestra la fecha y hora del último cambio. La actividad se mueve a la tabla correspondiente.

---

### 6.6 Agregar fuentes de verificación desde Planificación

**Acción:** Vincular un documento de respaldo a una actividad del calendario.

**Pasos:**
1. En la columna **"Fuente"** de la tabla, haga clic en **"+ fuente"** (si no hay fuente) o en **✏️** (si ya existe una).
2. En el formulario emergente complete:
   - **Nombre:** nombre descriptivo del documento (ej.: "Acta reunión Febrero")
   - **URL:** enlace de Google Drive o cualquier URL válida
3. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: formulario de fuente de verificación con los campos nombre y URL]**

**Resultado esperado:** La fuente queda vinculada en Asana. La columna Fuente muestra el enlace **🔗 Ver fuente** para acceder directamente al documento.

---

### 6.7 Generación de reportes de Planificación

**Acción:** Exportar el calendario o las tablas de actividades como reporte.

**Reportes disponibles:**

| Botón | Formato | Descripción |
|---|---|---|
| 📄 **Actividades PDF** | PDF | Exporta la vista actual del calendario como imagen |
| 📋 **Cronograma PDF** | PDF | Cronograma mensual en tabla con actividades, fechas, responsables y estado |
| 📝 **Cronograma Word** | Word | Igual que el cronograma PDF pero editable |
| 📄 **Informe PDF** | PDF | Exporta las tres tablas de actividades con el filtro de área aplicado |
| 📝 **Informe Word** | Word | Igual que el Informe PDF pero editable |

**Pasos:**
1. Navegue al mes deseado usando los botones del calendario.
2. Aplique el filtro de área si es necesario.
3. Haga clic en el botón de exportación correspondiente (ej.: **📋 Cronograma PDF**).
4. El sistema genera el archivo y lo descarga automáticamente.

> **[INSERTAR CAPTURA: botones de exportación en la barra superior del calendario]**

> **[INSERTAR CAPTURA: botones de Informe PDF e Informe Word sobre las tablas de actividades]**

**Resultado esperado:** Se descarga un archivo con el mes, año y nombre del proyecto en el nombre del archivo, listo para compartir o imprimir.

> **Nota:** Los botones de exportación estarán deshabilitados (grisados) si no hay actividades en el mes seleccionado.

---

## 7. MENÚ: INVESTIGACIÓN E INCIDENCIA

El menú **Investigación e Incidencia** (🔬) permite gestionar los documentos y enlaces del proyecto **SAIH investigación**. Está disponible para el Administrador y todos los roles excepto Planificador.

Para ingresar haga clic en **🔬 Investigación e Incidencia** en el menú lateral.

---

### 7.1 Visualización de tareas

**Acción:** Ver las tareas y sus documentos del proyecto de investigación.

**Pasos:**
1. Al ingresar, el sistema carga automáticamente las tareas del proyecto "SAIH investigacion".
2. Cada tarea se muestra con su nombre y la lista de documentos vinculados.
3. Use el campo de búsqueda para filtrar las tareas por nombre.

> **[INSERTAR CAPTURA: vista general de Investigación e Incidencia con lista de tareas y documentos]**

**Resultado esperado:** Se muestra la lista completa de tareas del proyecto con sus documentos asociados, listos para consultar o gestionar.

---

### 7.2 Agregar un documento a una tarea

**Acción:** Vincular un nuevo documento o enlace a una tarea del proyecto.

**Pasos:**
1. Ubique la tarea a la que desea agregar el documento.
2. Haga clic en el botón **"+ Agregar documento"** (o el ícono correspondiente junto a la tarea).
3. En el formulario emergente complete:
   - **Nombre del documento:** nombre descriptivo (ej.: "Informe de avance Mayo 2026")
   - **URL:** enlace al documento en Google Drive u otra plataforma válida
4. Haga clic en **"Guardar"**.

> **[INSERTAR CAPTURA: formulario de agregar documento con campos nombre y URL]**

**Resultado esperado:** El documento aparece en la lista de la tarea como un enlace activo. El registro se guarda en Asana en las notas de la tarea.

---

### 7.3 Eliminar un documento

**Acción:** Eliminar un documento vinculado a una tarea.

**Pasos:**
1. Ubique el documento dentro de la tarea.
2. Haga clic en el ícono **🗑️** junto al documento que desea eliminar.
3. Confirme la eliminación en la ventana de confirmación.

> **[INSERTAR CAPTURA: tarjeta de documento con ícono de eliminar visible]**

**Resultado esperado:** El documento se elimina de la lista y el registro se actualiza en Asana. Aparece una notificación de confirmación en la parte superior de la pantalla.

> **Nota:** La eliminación es permanente. Verifique que el documento correcto antes de confirmar.


