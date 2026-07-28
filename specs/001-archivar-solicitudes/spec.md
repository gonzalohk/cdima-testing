# Especificación de Funcionalidad: Archivado de Solicitudes por Mes

**Feature Branch**: `001-archivar-solicitudes`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "tengo demasiadas solicitudes aprobadas, por lo que se me hace muy dificil desplazarme entre ellas en su respectivo tab, necesito que se cree una nueva sección o pestaña que se llame 'Archivadas', en ellas se debe almacenar aquellas solicitudes que hayan sido marcadas como archivadas, es decir necesito un nuevo botón que permita archivar solicitudes aprobadas que ya tengan su solicitud de fondos aprobados, esta debe permitir revertir este estado para volver a la pestaña de aprobadas y viceversa. Sin embargo, necesito que se despliegue por mes, según la fecha de aprobación, es decir que se muestren en secciones según el mes aprobado y que este se pueda expandir y colapsar por mes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archivar una solicitud aprobada con fondos aprobados (Priority: P1)

Como aprobador (director/administrador), cuando una Solicitud de Material (SMAT) aprobada ya cuenta con su Solicitud de Fondos (SFON) anidada también aprobada (ciclo completo), quiero marcarla como "Archivada" con un botón, para que salga de la pestaña "Aprobadas" y deje de saturar mi lista de trabajo activa.

**Why this priority**: Es el núcleo de la petición. Sin la acción de archivar, no existe forma de descongestionar la pestaña "Aprobadas", que es el problema principal reportado por el usuario. Entrega valor inmediato por sí sola.

**Independent Test**: Se puede probar completamente localizando una solicitud aprobada con su fondo aprobado, pulsando "Archivar" y verificando que desaparece de "Aprobadas" y aparece en "Archivadas". Entrega el valor de descongestión de forma autónoma.

**Acceptance Scenarios**:

1. **Given** una solicitud (grupo SMAT + SFON) aprobada y con el ciclo de fondos aprobado visible en "Aprobadas", **When** el aprobador pulsa el botón "Archivar" de esa fila, **Then** el grupo completo desaparece de "Aprobadas" y queda registrado como archivado.
2. **Given** una solicitud aprobada cuyo fondo aún **no** está aprobado, **When** el aprobador ve la fila en "Aprobadas", **Then** el botón "Archivar" no está disponible (oculto o deshabilitado) para esa fila.
3. **Given** que el usuario tiene un rol sin permiso de aprobación, **When** visualiza una solicitud aprobada, **Then** no ve la acción de archivar.

---

### User Story 2 - Consultar solicitudes archivadas agrupadas por mes (Priority: P1)

Como aprobador, quiero una pestaña "Archivadas" donde las solicitudes archivadas se muestren agrupadas en secciones por mes según su fecha de aprobación, y poder expandir o colapsar cada mes, para navegar grandes volúmenes históricos sin desplazamiento excesivo.

**Why this priority**: La acción de archivar sin un lugar donde consultar lo archivado no resuelve el problema de navegación. La agrupación colapsable por mes es el mecanismo que hace utilizable el histórico. Es tan crítica como la P1 de archivar.

**Independent Test**: Se puede probar abriendo la pestaña "Archivadas" con solicitudes de distintos meses y verificando que cada mes es una sección colapsable/expandible independiente, ordenada cronológicamente.

**Acceptance Scenarios**:

1. **Given** solicitudes archivadas con fechas de aprobación en distintos meses, **When** el usuario abre la pestaña "Archivadas", **Then** ve una sección por cada mes con su etiqueta (ej. "Julio 2026") y el conteo de solicitudes de ese mes.
2. **Given** una sección de mes expandida, **When** el usuario pulsa su encabezado, **Then** la sección se colapsa ocultando sus solicitudes y conserva el conteo visible.
3. **Given** una sección de mes colapsada, **When** el usuario pulsa su encabezado, **Then** la sección se expande mostrando sus solicitudes.
4. **Given** solicitudes archivadas de varios meses, **When** se listan las secciones, **Then** aparecen ordenadas del mes más reciente al más antiguo.

---

### User Story 3 - Revertir el archivado (desarchivar) (Priority: P2)

Como aprobador, quiero poder desarchivar una solicitud desde la pestaña "Archivadas" para devolverla a la pestaña "Aprobadas", por si la archivé por error o necesito volver a trabajarla.

**Why this priority**: Complementa el flujo y evita bloqueos por errores, pero el valor principal (descongestión y consulta histórica) ya se obtiene con P1. Es reversibilidad de seguridad.

**Independent Test**: Se puede probar archivando una solicitud, luego pulsando "Desarchivar" en "Archivadas" y verificando que reaparece en "Aprobadas" y desaparece de "Archivadas".

**Acceptance Scenarios**:

1. **Given** una solicitud en la pestaña "Archivadas", **When** el aprobador pulsa "Desarchivar", **Then** la solicitud vuelve a aparecer en "Aprobadas" y deja de listarse en "Archivadas".
2. **Given** una solicitud recién desarchivada, **When** el usuario vuelve a la pestaña "Aprobadas", **Then** conserva todos sus datos previos (fondo, informe, estado de almacén, fechas) sin pérdida.

---

### Edge Cases

- ¿Qué ocurre con una solicitud archivada cuya fecha de aprobación no puede determinarse? Debe agruparse en una sección designada (ej. "Sin fecha") en lugar de desaparecer.
- ¿Qué pasa si un mes queda sin solicitudes archivadas tras desarchivar la última? La sección de ese mes deja de mostrarse.
- ¿Cómo se comporta la búsqueda existente dentro de "Archivadas"? El filtro de texto debe operar sobre las solicitudes archivadas sin romper el agrupado por mes (los meses sin coincidencias no se muestran).
- ¿Puede archivarse una solicitud que ya está archivada? La acción de archivar no debe estar disponible sobre solicitudes ya archivadas (solo aparece "Desarchivar").
- ¿Qué sucede si dos usuarios archivan/desarchivan la misma solicitud casi a la vez? El sistema debe reflejar el último estado persistido y no duplicar la solicitud en ambas pestañas.
- ¿Las solicitudes archivadas cuentan para las estadísticas y contadores de "Aprobadas"? No; una vez archivadas dejan de contarse como aprobadas activas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una nueva pestaña "Archivadas" junto a las pestañas existentes de solicitudes (Pendientes, Aprobadas, Observadas).
- **FR-002**: El sistema DEBE permitir al usuario con permiso de aprobación marcar una solicitud aprobada como "archivada" mediante una acción explícita ("Archivar").
- **FR-003**: La acción de archivar SOLO DEBE estar disponible para solicitudes aprobadas que ya tengan su Solicitud de Fondos asociada aprobada (ciclo SMAT ↔ SFON completo).
- **FR-004**: Al archivar una solicitud, el sistema DEBE retirarla de la pestaña "Aprobadas" y mostrarla en la pestaña "Archivadas".
- **FR-005**: El sistema DEBE permitir revertir el archivado ("Desarchivar") desde la pestaña "Archivadas", devolviendo la solicitud a la pestaña "Aprobadas".
- **FR-006**: El archivado y el desarchivado DEBEN preservar íntegramente todos los datos de la solicitud (fecha de aprobación, fondo asociado, estado de almacén por ítem, informe, informe final, solicitante), sin pérdida ni reescritura del contenido legible.
- **FR-007**: En la pestaña "Archivadas", el sistema DEBE agrupar las solicitudes en secciones por mes calendario según su fecha de aprobación.
- **FR-008**: Cada sección de mes DEBE poder expandirse y colapsarse de forma independiente, mostrando siempre una etiqueta de mes legible y el conteo de solicitudes contenidas.
- **FR-009**: Las secciones de mes DEBEN ordenarse del mes más reciente al más antiguo.
- **FR-010**: Dentro de cada sección de mes, las solicitudes DEBEN mantenerse ordenadas por fecha de aprobación de más reciente a más antigua.
- **FR-011**: El sistema DEBE mantener juntos, como una sola unidad archivable, el grupo SMAT y su SFON aprobada asociada (no debe archivarse una parte del ciclo y dejar la otra en "Aprobadas").
- **FR-012**: El sistema NO DEBE contar las solicitudes archivadas dentro de los indicadores y listados de la pestaña "Aprobadas".
- **FR-013**: El sistema DEBE ocultar o deshabilitar la acción "Archivar" para roles sin permiso de aprobación, coherente con los controles de acceso existentes.
- **FR-014**: La búsqueda de texto existente en la vista de solicitudes DEBE poder aplicarse a las solicitudes archivadas, ocultando las secciones de mes que no contengan coincidencias.
- **FR-015**: El estado de archivado DEBE persistir de forma que sobreviva a recargas de la aplicación y sea compatible con solicitudes históricas creadas antes de esta funcionalidad (las solicitudes previas se consideran "no archivadas" por defecto).
- **FR-016**: Si una solicitud archivada no tiene una fecha de aprobación determinable, el sistema DEBE agruparla en una sección designada para fechas desconocidas en lugar de omitirla.

### Key Entities *(include if feature involves data)*

- **Solicitud (estado de archivado)**: Representa una solicitud existente (Material/Fondos/Devolución) a la que se añade un atributo de "archivado" y la marca temporal del momento de archivado. La pertenencia a "Aprobadas" vs "Archivadas" se deriva de este atributo combinado con su estado aprobado. No se crea una entidad nueva: se extiende la entidad Solicitud existente de forma retrocompatible.
- **Sección de mes (agrupación de vista)**: Agrupación lógica y efímera de solicitudes archivadas por mes calendario derivada de la fecha de aprobación. Atributos: etiqueta del mes, conteo de solicitudes, estado expandido/colapsado. No se persiste; se calcula al mostrar la pestaña.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un aprobador puede archivar una solicitud aprobada elegible en 1 sola acción (un clic) y verla desaparecer de "Aprobadas" de inmediato.
- **SC-002**: La pestaña "Aprobadas" muestra únicamente solicitudes no archivadas, reduciendo la cantidad de filas visibles en esa pestaña en proporción directa a las solicitudes archivadas.
- **SC-003**: Un usuario puede localizar una solicitud archivada de un mes concreto expandiendo su sección en un máximo de 2 interacciones (abrir pestaña + expandir mes).
- **SC-004**: El 100% de las solicitudes archivadas aparecen agrupadas bajo el mes correcto correspondiente a su fecha de aprobación.
- **SC-005**: Una solicitud desarchivada reaparece en "Aprobadas" conservando el 100% de sus datos previos, verificable comparando su contenido antes y después.
- **SC-006**: Con la pestaña "Archivadas" y todos los meses colapsados, el usuario ve la lista completa de meses disponibles sin necesidad de desplazamiento largo, incluso con cientos de solicitudes archivadas.

## Assumptions

- **Unidad archivable**: La solicitud archivable es el ciclo completo SMAT + su SFON aprobada anidada (relación 1:1 documentada en RN-11). Al archivar se archiva el grupo completo; al desarchivar se restaura el grupo completo. Las solicitudes sueltas sin ciclo de fondos aprobado no son elegibles para archivar, conforme a la petición explícita del usuario.
- **Fecha de agrupación**: El mes de agrupación se determina por la fecha de aprobación (`fechaAprobacion`) de la solicitud; para un grupo SMAT+SFON se usa la fecha de aprobación de la SMAT (la solicitud principal del grupo).
- **Permisos**: Archivar y desarchivar son acciones reservadas a los roles con permiso de aprobación (director/administrador), coherente con RN-21; los técnicos y demás roles no ven estas acciones.
- **Persistencia**: El estado de archivado se almacena en el bloque JSON embebido en `notes` de la solicitud (patrón RN-30), preservando el texto legible y reemplazando el bloque JSON completo. Las solicitudes previas sin este atributo se tratan como no archivadas (compatibilidad hacia atrás, Principio VIII de la constitución).
- **Etiquetado de mes**: Las etiquetas de mes se formatean en español y en zona horaria `America/La_Paz`, coherente con el formateo de fechas de negocio existente.
- **Estado inicial de secciones**: Al abrir "Archivadas", las secciones de mes inician colapsadas por defecto para maximizar la visión general; el usuario expande el mes de interés. (Detalle de presentación ajustable en diseño.)
- **Alcance de UI**: La funcionalidad se implementa dentro de la vista de solicitudes existente (HomePage), reutilizando el patrón de pestañas y de tablas ya presente, sin introducir nuevas dependencias ni backend (Principios I y III de la constitución).
- **Búsqueda**: Se reutiliza el mecanismo de búsqueda de texto existente aplicado a la nueva pestaña; el término filtra solicitudes y, en consecuencia, las secciones de mes visibles.
