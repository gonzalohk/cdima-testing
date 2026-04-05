# Backup Asana → CSV | Google Apps Script

Script para replicar el export CSV de Asana del proyecto **Planificación CDIMA**, ejecutable desde [script.google.com](https://script.google.com).

---

## Configuración inicial

1. Ve a [script.google.com](https://script.google.com) y crea un nuevo proyecto.
2. Pega el script completo (ver sección de código abajo).
3. Configura el token de Asana en **Proyecto → Configuración del proyecto → Propiedades del script**:
   - Clave: `ASANA_TOKEN`
   - Valor: `<tu Personal Access Token de Asana>`
4. Ejecuta la función `exportAsanaToCSV`.

---

## Dónde se guarda el archivo

- El archivo se guarda en la **raíz de tu Google Drive** (`Mi unidad /`) con el nombre:
  ```
  asana_export_YYYY-MM-DD.csv
  ```
- Después de ejecutar, en **Vista → Registros** (Logger) verás:
  ```
  Archivo guardado: https://drive.google.com/file/d/...
  Descarga directa: https://drive.google.com/uc?export=download&id=...
  ```
- El link de "Descarga directa" permite bajar el `.csv` directamente desde el navegador.

### Guardar en carpeta específica de Drive

Reemplaza en el script:
```js
const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
```
por:
```js
const folder = DriveApp.getFolderById('ID_DE_TU_CARPETA');
const file = folder.createFile(fileName, csv, MimeType.CSV);
```
El ID de la carpeta está en la URL de Drive: `drive.google.com/drive/folders/<ID_DE_TU_CARPETA>`.

---

## Columnas del CSV generado

Replica exactamente el export nativo de Asana:

| Columna | Fuente |
|---|---|
| Task ID | `gid` |
| Created At | `created_at` |
| Completed At | `completed_at` |
| Last Modified | `modified_at` |
| Name | `name` |
| Section/Column | `memberships.section.name` |
| Assignee | `assignee.name` |
| Assignee Email | `assignee.email` |
| Start Date | `start_on` |
| Due Date | `due_on` |
| Tags | `tags.name` (unidas por `, `) |
| Notes | `notes` |
| Projects | `projects.name` |
| Parent task | `parent.name` |
| Blocked By (Dependencies) | `dependencies.name` |
| Blocking (Dependents) | `dependents.name` |
| Estado | custom_field `Estado` |
| Area | custom_field `Area` |
| Responsables de actividad | custom_field `Responsables de actividad` |
| lmod | custom_field `lmod` |
| Fuente URL | custom_field `Fuente URL` |
| Fuente | custom_field `Fuente` |

---

## Script completo

```javascript
// ============================================================
// ASANA → CSV EXPORT  |  Google Apps Script
// Replica el export CSV de Asana para "Planificación CDIMA"
// Ejecutar: exportAsanaToCSV()
// ============================================================

const ASANA_TOKEN  = '';           // Dejar vacío y usar Propiedades del script
const PROJECT_GID  = '';           // Si se conoce, poner aquí para saltar búsqueda
const PROJECT_NAME = 'Planificación CDIMA';

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

  const projectGid = PROJECT_GID || findProjectGid(token, PROJECT_NAME);
  if (!projectGid) throw new Error(`Proyecto "${PROJECT_NAME}" no encontrado.`);
  Logger.log('Proyecto encontrado: ' + projectGid);

  const allTasks = fetchAllTasksWithSubtasks(token, projectGid);
  Logger.log('Total filas (tareas + subtareas): ' + allTasks.length);

  const csv = buildCsv(allTasks);

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
  'Blocked By (Dependencies)', 'Blocking (Dependents)',
  ...CUSTOM_FIELD_NAMES,
];

function q(val) {
  const s = (val == null ? '' : String(val)).replace(/"/g, '""');
  return '"' + s + '"';
}

function getCustomField(task, fieldName) {
  if (!task.custom_fields) return '';
  const cf = task.custom_fields.find(f => f.name === fieldName);
  if (!cf) return '';
  if (cf.type === 'enum')       return cf.enum_value ? cf.enum_value.name : '';
  if (cf.type === 'multi_enum') return (cf.multi_enum_values || []).map(v => v.name).join(', ');
  if (cf.type === 'text')       return cf.text_value || '';
  if (cf.type === 'number')     return cf.number_value != null ? String(cf.number_value) : '';
  return cf.display_value || '';
}

function buildCsv(tasks) {
  const rows = [CSV_HEADERS.map(q).join(',')];
  for (const t of tasks) {
    const section = (t.memberships && t.memberships[0] && t.memberships[0].section)
      ? t.memberships[0].section.name : '';
    const tags        = (t.tags || []).map(tg => tg.name).join(', ');
    const projects    = (t.projects || []).map(p => p.name).join(', ');
    const blockedBy   = (t.dependencies || []).map(d => d.name).join(', ');
    const blocking    = (t.dependents   || []).map(d => d.name).join(', ');

    const customValues = CUSTOM_FIELD_NAMES.map(name => getCustomField(t, name));

    const row = [
      t.gid,
      t.created_at  || '',
      t.completed_at || '',
      t.modified_at  || '',
      t.name         || '',
      section,
      t.assignee ? t.assignee.name  : '',
      t.assignee ? t.assignee.email : '',
      t.start_on || '',
      t.due_on   || '',
      tags,
      t.notes    || '',
      projects,
      t.parent   ? t.parent.name : '',
      blockedBy,
      blocking,
      ...customValues,
    ].map(q).join(',');

    rows.push(row);
  }
  return rows.join('\r\n');
}
```

---

## Notas importantes

- **Timeout**: Google Apps Script tiene un límite de ~6 minutos por ejecución. Si el proyecto tiene cientos de tareas con subtareas, puede alcanzar el límite. En ese caso, dividir la exportación por sección.
- **Permisos requeridos**: El script necesita permiso para acceder a servicios externos (`UrlFetchApp`) y a Drive (`DriveApp`). Google lo solicitará en la primera ejecución.
- **Ejecuciones programadas**: Se puede configurar un trigger en **Editar → Activadores del proyecto actual** para ejecutar automáticamente (ej. cada semana).
