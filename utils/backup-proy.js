// ============================================================
// ASANA → CSV EXPORT (Multi-proyecto)  |  Google Apps Script
// Exporta todos los proyectos del workspace CDIMA cuyo nombre
// NO contenga "CDIMA". Cada proyecto genera su propio CSV.
// Todos los archivos se agrupan en una carpeta con fecha/hora.
// Ejecutar: exportAllProjectsToCSV()
// ============================================================

// ── Configuración ──────────────────────────────────────────
const ASANA_TOKEN_MP     = '';
const DRIVE_FOLDER_ID_MP = ''; // Carpeta raíz donde se creará la subcarpeta de backup

// ── Punto de entrada ────────────────────────────────────────
function exportAllProjectsToCSV() {
  const token = ASANA_TOKEN_MP ||
    PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Configura ASANA_TOKEN en las propiedades del script.');

  // 1. Calcular fecha/hora en zona Bolivia
  const now = new Date();
  const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const datePart = boliviaTime.getFullYear() + '-' + pad(boliviaTime.getMonth() + 1) + '-' + pad(boliviaTime.getDate());
  const timePart = pad(boliviaTime.getHours()) + '-' + pad(boliviaTime.getMinutes()) + '-' + pad(boliviaTime.getSeconds());
  const folderName = 'asana_backup_' + datePart + '_' + timePart;

  // 2. Crear subcarpeta en Drive
  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID_MP);
  const backupFolder = rootFolder.createFolder(folderName);
  Logger.log('Carpeta de backup creada: ' + backupFolder.getUrl());

  // 3. Obtener todos los proyectos del workspace que no contengan "CDIMA"
  const projects = findProjectsExcludingCDIMA(token);
  Logger.log('Proyectos a exportar: ' + projects.length);

  // 4. Exportar cada proyecto
  const results = [];
  for (const project of projects) {
    Logger.log('Exportando: ' + project.name + ' (' + project.gid + ')');
    const allTasks = fetchAllTasksWithSubtasksMP(token, project.gid);
    Logger.log('  Tareas: ' + allTasks.length);

    const customFieldNames = detectCustomFieldNames(allTasks);
    const csv = buildCsvMP(allTasks, customFieldNames);

    // Nombre del archivo: nombre del proyecto + fecha/hora
    const safeName = project.name.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 80);
    const fileName = safeName + '_' + datePart + '_' + timePart + '.csv';
    const blob = Utilities.newBlob(csv, MimeType.CSV, fileName);
    const file = backupFolder.createFile(blob);
    results.push({ project: project.name, url: file.getUrl() });
    Logger.log('  Guardado: ' + file.getUrl());
  }

  Logger.log('=== Backup completado ===');
  Logger.log('Carpeta: ' + backupFolder.getUrl());
  results.forEach(function(r) { Logger.log(r.project + ' → ' + r.url); });
  return backupFolder.getUrl();
}

// ── Búsqueda de proyectos ────────────────────────────────────
function findProjectsExcludingCDIMA(token) {
  const workspaces = asanaGetMP(token, '/workspaces?opt_fields=name,gid').data;
  const result = [];
  for (const ws of workspaces) {
    let offset = null;
    do {
      const page = '/projects?workspace=' + ws.gid +
        '&archived=false&opt_fields=name,gid&limit=100' +
        (offset ? '&offset=' + offset : '');
      const data = asanaGetMP(token, page);
      for (const p of data.data) {
        if (!p.name.toLowerCase().includes('cdima')) {
          result.push(p);
        }
      }
      offset = data.next_page ? data.next_page.offset : null;
    } while (offset);
  }
  return result;
}

// ── Detección dinámica de campos personalizados ─────────────
// Lee las tareas descargadas y recolecta todos los nombres de
// campos personalizados en el orden en que aparecen.
function detectCustomFieldNames(tasks) {
  const seen = [];
  const seenSet = {};
  for (const task of tasks) {
    if (!task.custom_fields) continue;
    for (const cf of task.custom_fields) {
      if (cf.name && !seenSet[cf.name]) {
        seenSet[cf.name] = true;
        seen.push(cf.name);
      }
    }
  }
  return seen;
}

// ── API helpers ─────────────────────────────────────────────
function asanaGetMP(token, path) {
  const resp = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + path, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Asana API ' + code + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

const OPT_FIELDS_MP = [
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

function fetchPagedMP(token, url) {
  const items = [];
  let offset = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = url + sep + 'limit=100' + (offset ? '&offset=' + offset : '');
    const data = asanaGetMP(token, page);
    items.push.apply(items, data.data);
    offset = data.next_page ? data.next_page.offset : null;
  } while (offset);
  return items;
}

function fetchSubtasksRecursiveMP(token, taskGid, result) {
  var subs = fetchPagedMP(token, '/tasks/' + taskGid + '/subtasks?opt_fields=' + OPT_FIELDS_MP);
  for (var i = 0; i < subs.length; i++) {
    result.push(subs[i]);
    if (subs[i].num_subtasks > 0) {
      fetchSubtasksRecursiveMP(token, subs[i].gid, result);
    }
  }
}

function fetchAllTasksWithSubtasksMP(token, projectGid) {
  var tasks = fetchPagedMP(token, '/projects/' + projectGid + '/tasks?opt_fields=' + OPT_FIELDS_MP);
  var result = [];
  for (var i = 0; i < tasks.length; i++) {
    result.push(tasks[i]);
    if (tasks[i].num_subtasks > 0) {
      fetchSubtasksRecursiveMP(token, tasks[i].gid, result);
    }
  }
  return result;
}

// ── Construcción del CSV ────────────────────────────────────
const CSV_BASE_HEADERS_MP = [
  'Task ID', 'Created At', 'Completed At', 'Last Modified',
  'Name', 'Section/Column',
  'Assignee', 'Assignee Email',
  'Start Date', 'Due Date',
  'Tags', 'Notes', 'Projects', 'Parent task',
  'Blocked By (Dependencies)', 'Blocking (Dependencies)',
];

function getCustomFieldMP(task, fieldName) {
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

function escMP(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function taskToRowMP(task, customFieldNames) {
  const section = task.memberships && task.memberships.length > 0 && task.memberships[0].section
    ? task.memberships[0].section.name : '';
  const tags     = task.tags     ? task.tags.map(function(t)     { return t.name; }).join(', ') : '';
  const projects = task.projects ? task.projects.map(function(p) { return p.name; }).join(', ') : '';
  const parent   = task.parent   ? task.parent.name : '';
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
  ].concat(customFieldNames.map(function(n) { return getCustomFieldMP(task, n); }))
   .map(escMP).join(',');
}

function buildCsvMP(tasks, customFieldNames) {
  const headers = CSV_BASE_HEADERS_MP.concat(customFieldNames);
  const lines = [headers.map(escMP).join(',')];
  tasks.forEach(function(t) { lines.push(taskToRowMP(t, customFieldNames)); });
  return lines.join('\r\n');
}
