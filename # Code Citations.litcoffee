# Code Citations

## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```


## License: GPL-3.0
https://github.com/wondrous-dev/wondrous-frontend/blob/aa55a624a2f9c9516858eb123755051bc9a06870/wondrous-app/components/Settings/TaskImport/GenericImportTaskModal/constants.tsx

```
Aquí está el script completo para Google Apps Script. Pégalo en [script.google.com](https://script.google.com), configura el token, y ejecuta `exportAsanaToCSV`:

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
// Opción A: pega el token directamente (solo para pruebas locales)
// Opción B (recomendada): guárdalo en Propiedades del script:
//   Proyecto → Configuración del proyecto → Propiedades del script
//   Clave: ASANA_TOKEN  |  Valor: <tu PAT>
const ASANA_TOKEN   = '';
const PROJECT_GID   = '';          // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA';  // Se usa si PROJECT_GID está vacío

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
];

// ── Punto de entrada ────────────────────────────────────────
function exportAsanaToCSV() {
  const token = ASANA_TOKEN ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Resolver GID del proyecto
  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  // 2. Obtener todas las tareas y subtareas
  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  // 3. Construir CSV
  const csv = buildCsv(allTasks);

  // 4. Guardar en Drive
  const fileName = 'asana_export_' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  Logger.log('Archivo guardado: ' + file.getUrl());
  Logger.log('Descarga directa: ' + file.getDownloadUrl());
  return file.getDownloadUrl();
}

// ── API helpers ─────────────────────────────────────────────
function asanaGet(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function findProjectGid(token, name) {
  const workspaces = asanaGet(token, '/workspaces?opt_fields=name,gid').data;
  for (const ws of workspaces) {
    const projects = asanaGet(
      token,
      '/projects?workspace=' + ws.gid + '&archived=false&opt_fields=name,gid'
    ).data;
    for (const p of projects) {
      if (p.name.toLowerCase().includes(name.toLowerCase())) return p.gid;
    }
  }
  return null;
}

const OPT_FIELDS = [
  'gid', 'created_at', 'completed_at', 'modified_at',
  'name', 'completed', 'num_subtasks',
  'memberships.section.name',
  'assignee.name', 'assignee.email',
  'start_on', 'due_on',
  'tags.name',
  'notes',
  'projects.name',
  'parent.name',
  'dependencies.name', 'dependencies.gid',
  'dependents.name',  'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks(token, projectGid) {
  const tasks = fetchPaged(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS);
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged(token, '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS);
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_HEADERS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking
```

