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
const PROJECT_GID   = '';                    // Si lo conoces, ponlo aquí para saltar la búsqueda
const PROJECT_NAME  = 'Planificación CDIMA'; // Se usa si PROJECT_GID está vacío
const DRIVE_FOLDER_ID = ''; // ID de la carpeta destino en Drive https://drive.google.com/drive/u/4/folders/1BNqckgJx8AXzshKjd12KOrjOdILYnHRe

// Campos personalizados a incluir (orden = orden de columnas en el CSV)
const CUSTOM_FIELD_NAMES = [
  'Estado',
  'Area',
  'Responsables de actividad',
  'lmod',
  'Fuente URL',
  'Fuente',
  'Observaciones',
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

  // 4. Guardar en la carpeta de Drive configurada
  const now = new Date();
  const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const datePart = boliviaTime.getFullYear() + '-' + pad(boliviaTime.getMonth() + 1) + '-' + pad(boliviaTime.getDate());
  const timePart = pad(boliviaTime.getHours()) + '-' + pad(boliviaTime.getMinutes()) + '-' + pad(boliviaTime.getSeconds());
  const fileName = 'asana_export_' + datePart + '_' + timePart + '.csv';
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const blob = Utilities.newBlob(csv, MimeType.CSV, fileName);
  const file = folder.createFile(blob);
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
  'Blocked By (Dependencies)', 'Blocking (Dependencies)',
].concat(CUSTOM_FIELD_NAMES);

function getCustomField(task, fieldName) {
  if (!task.custom_fields) return '';
  const f = task.custom_fields.find(function(cf) { return cf.name === fieldName; });
  if (!f) return '';
  if (f.display_value) return f.display_value;
  if (f.type === 'multi_enum' && f.multi_enum_values && f.multi_enum_values.length)
    return f.multi_enum_values.map(function(v) { return v.name; }).join(', ');
  if (f.type === 'enum' && f.enum_value) return f.enum_value.name;
  if (f.type === 'number' && f.number_value != null) return String(f.number_value);
  if (f.type === 'text' && f.text_value) return f.text_value;
  return '';
}

function esc(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function taskToRow(task) {
  const section = task.memberships && task.memberships.length > 0 && task.memberships[0].section
    ? task.memberships[0].section.name : '';
  const tags     = task.tags         ? task.tags.map(function(t)        { return t.name; }).join(', ') : '';
  const projects = task.projects     ? task.projects.map(function(p)    { return p.name; }).join(', ') : '';
  const parent   = task.parent       ? task.parent.name : '';
  const blockedBy = task.dependencies
    ? task.dependencies.map(function(d) { return d.name || d.gid; }).join(', ') : '';
  const blocking = task.dependents
    ? task.dependents.map(function(d)   { return d.name || d.gid; }).join(', ') : '';

  return [
    task.gid,
    task.created_at   || '',
    task.completed_at || '',
    task.modified_at  || '',
    task.name         || '',
    section,
    task.assignee ? task.assignee.name          : '',
    task.assignee ? (task.assignee.email || '') : '',
    task.start_on || '',
    task.due_on   || '',
    tags, task.notes || '', projects, parent,
    blockedBy, blocking,
  ].concat(CUSTOM_FIELD_NAMES.map(function(n) { return getCustomField(task, n); }))
   .map(esc).join(',');
}

function buildCsv(tasks) {
  const lines = [CSV_HEADERS.map(esc).join(',')];
  tasks.forEach(function(t) { lines.push(taskToRow(t)); });
  return lines.join('\r\n');
}
