// ============================================================
// ASANA → CSV EXPORT (Cursos CDIMA)  |  Google Apps Script
// Exporta los proyectos: "Escuelas CDIMA", "Diplomado CDIMA"
// y "Curso Alto Nivel CDIMA".
// Cada proyecto genera su propio CSV agrupados en una carpeta
// con fecha/hora (zona Bolivia).
// Ejecutar: exportCursosToCSV()
// ============================================================

// ── Configuración ───────────────────────────────────────────
const ASANA_TOKEN_CURSOS     = '';
const DRIVE_FOLDER_ID_CURSOS = ''; // Carpeta raíz en Drive

// Proyectos objetivo (búsqueda por inclusión, sin distinguir mayúsculas)
const TARGET_PROJECTS_CURSOS = [
  'Escuelas CDIMA',
  'Diplomado CDIMA',
  'Curso Alto Nivel CDIMA',
];

// Campos personalizados (orden = orden de columnas en el CSV)
// Estructura tomada de Escuelas.csv
const CUSTOM_FIELD_NAMES_CURSOS = [
  'Módulo 1',
  'Módulo 2',
  'Módulo 3',
  'Módulo 4',
  'Módulo 5',
  'Módulo 6',
  'Módulo 7',
  'Area',
  'Módulo 8',
  'Módulo 9',
  'Módulo 10',
  'Número de módulos',
];

// ── Punto de entrada ─────────────────────────────────────────
function exportCursosToCSV() {
  const token = ASANA_TOKEN_CURSOS ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Calcular fecha/hora en zona Bolivia
  const now = new Date();
  const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const datePart = boliviaTime.getFullYear() + '-' +
    pad(boliviaTime.getMonth() + 1) + '-' +
    pad(boliviaTime.getDate());
  const timePart = pad(boliviaTime.getHours()) + '-' +
    pad(boliviaTime.getMinutes()) + '-' +
    pad(boliviaTime.getSeconds());
  const folderName = 'asana_cursos_' + datePart + '_' + timePart;

  // 2. Crear subcarpeta en Drive
  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID_CURSOS);
  const backupFolder = rootFolder.createFolder(folderName);
  Logger.log('Carpeta de backup creada: ' + backupFolder.getUrl());

  // 3. Buscar los proyectos objetivo en el workspace
  const projects = findTargetProjects_Cursos(token);
  Logger.log('Proyectos encontrados: ' + projects.length);
  if (projects.length === 0) {
    Logger.log('No se encontró ninguno de los proyectos objetivo. Verifica los nombres.');
    return null;
  }

  // 4. Exportar cada proyecto
  const results = [];
  for (const project of projects) {
    Logger.log('Exportando: ' + project.name + ' (' + project.gid + ')');
    const allTasks = fetchAllTasksWithSubtasks_Cursos(token, project.gid);
    Logger.log('  Tareas + subtareas: ' + allTasks.length);

    const csv = buildCsv_Cursos(allTasks);

    const safeName = project.name.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 80);
    const fileName = safeName + '_' + datePart + '_' + timePart + '.csv';
    const blob = Utilities.newBlob(csv, MimeType.CSV, fileName);
    const file = backupFolder.createFile(blob);
    results.push({ project: project.name, url: file.getUrl() });
    Logger.log('  Guardado: ' + file.getUrl());
  }

  Logger.log('=== Backup de cursos completado ===');
  Logger.log('Carpeta: ' + backupFolder.getUrl());
  results.forEach(function(r) { Logger.log(r.project + ' → ' + r.url); });
  return backupFolder.getUrl();
}

// ── Búsqueda de proyectos objetivo ──────────────────────────
function findTargetProjects_Cursos(token) {
  const workspaces = asanaGet_Cursos(token, '/workspaces?opt_fields=name,gid').data;
  const result = [];

  for (const ws of workspaces) {
    let offset = null;
    do {
      const page = '/projects?workspace=' + ws.gid +
        '&archived=false&opt_fields=name,gid&limit=100' +
        (offset ? '&offset=' + offset : '');
      const data = asanaGet_Cursos(token, page);

      for (const p of data.data) {
        const nameLower = p.name.toLowerCase();
        const isTarget = TARGET_PROJECTS_CURSOS.some(function(target) {
          return nameLower === target.toLowerCase();
        });
        if (isTarget) result.push(p);
      }

      offset = data.next_page ? data.next_page.offset : null;
    } while (offset);
  }

  return result;
}

// ── API helpers ──────────────────────────────────────────────
function asanaGet_Cursos(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

const OPT_FIELDS_CURSOS = [
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
  'dependents.name',   'dependents.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.name',
].join(',');

function fetchPaged_Cursos(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGet_Cursos(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchAllTasksWithSubtasks_Cursos(token, projectGid) {
  const tasks = fetchPaged_Cursos(
    token,
    '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS_CURSOS
  );
  const result = [];
  for (const task of tasks) {
    result.push(task);
    if (task.num_subtasks > 0) {
      const subs = fetchPaged_Cursos(
        token,
        '/tasks/' + task.gid + '/subtasks?opt_fields=' + OPT_FIELDS_CURSOS
      );
      result.push.apply(result, subs);
    }
  }
  return result;
}

// ── Construcción del CSV ─────────────────────────────────────
const CSV_BASE_HEADERS_CURSOS = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking (Dependencies)',
];

function getCustomField_Cursos(task, fieldName) {
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

function esc_Cursos(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function taskToRow_Cursos(task) {
  const section = task.memberships && task.memberships.length > 0 && task.memberships[0].section
    ? task.memberships[0].section.name : '';
  const tags     = task.tags     ? task.tags.map(function(t)     { return t.name; }).join(', ') : '';
  const projects = task.projects ? task.projects.map(function(p) { return p.name; }).join(', ') : '';
  const parent   = task.parent   ? task.parent.name : '';
  const blockedBy = task.dependencies
    ? task.dependencies.map(function(d) { return d.name || d.gid; }).join(', ') : '';
  const blocking  = task.dependents
    ? task.dependents.map(function(d)   { return d.name || d.gid; }).join(', ') : '';

  const baseRow = [
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
  ];

  const customRow = CUSTOM_FIELD_NAMES_CURSOS.map(function(n) {
    return getCustomField_Cursos(task, n);
  });

  return baseRow.concat(customRow).map(esc_Cursos).join(',');
}

function buildCsv_Cursos(tasks) {
  const headers = CSV_BASE_HEADERS_CURSOS.concat(CUSTOM_FIELD_NAMES_CURSOS);
  const lines = [headers.map(esc_Cursos).join(',')];
  tasks.forEach(function(t) { lines.push(taskToRow_Cursos(t)); });
  return lines.join('\r\n');
}
