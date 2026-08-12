import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Badge,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Popover,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { HtmlModalHeader } from '../components/ModalShared';
import ContratacionUpdateModal, { ContratacionJsonData } from '../components/ContratacionUpdateModal';
import NuevaSolicitudModal, { SolicitudType } from '../components/NuevaSolicitudModal';
import MaterialRequestModal from '../components/MaterialRequestModal';
import FundsRequestModal from '../components/FundsRequestModal';
import MaterialReturnModal from '../components/MaterialReturnModal';
import {
  BellOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DollarOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaTask } from '../types/asana.types';
import { useAuth, getSolicitanteByEmail, getCargoByEmail, getAprobadorEmails, getRoleByEmail } from '../context/AuthContext';
import { notificationsService } from '../services/notifications.service';
import { AppNotification } from '../types/notification.types';
import {
  exportFundsRequestToPDF,
  exportMaterialRequestToPDF,
  exportMaterialRequestDetailToPDF,
  exportMaterialReturnToPDF,
} from '../services/pdf.service';

interface FundItem { id: number; descripcion: string; importeBolivianos: string; }
interface MaterialItem { id: number; detalle: string; cantidad: string; unidad: string; observaciones: string; almacen?: string; }

function parseFundsRequest(task: AsanaTask) {
  const data = extractJsonData(task.notes);
  if (data) {
    return {
      taskName: (data.titulo as string) ?? task.name,
      area: (data.area as string) ?? '',
      lugar: (data.lugar as string) ?? '',
      fechaInicio: (data.fechaInicio as string) ?? '',
      fechaFinalizacion: (data.fechaFinalizacion as string) ?? '',
      fondos: ((data.fondos as Record<string, unknown>[]) ?? []).map((f, idx) => ({
        id: (f.id as number) ?? idx + 1,
        descripcion: (f.descripcion as string) ?? '',
        importeBolivianos: f.importeBolivianos != null ? String(f.importeBolivianos) : '0',
      })),
      total: data.totalBolivianos != null ? String(data.totalBolivianos) : (data.total as string) ?? '',
    };
  }
  // Fallback: parseo desde texto libre (formato antiguo)
  const notes = task.notes || '';
  const activityMatch = notes.match(/Actividad:\s*(.+)/);
  const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
  const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
  const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  const fondos: FundItem[] = [];
  const fondosSection = notes.match(/FONDOS SOLICITADOS:\s*([\s\S]+?)(?=\n\nTOTAL:|\n\n---)/);
  if (fondosSection) {
    fondosSection[1].split(/\n\n(?=\d+\.)/).forEach((item, idx) => {
      const descMatch = item.match(/\d+\.\s*(.+)/);
      const importeMatch = item.match(/Importe:\s*Bs\.\s*([\d.]+)/);
      if (descMatch) fondos.push({ id: idx + 1, descripcion: descMatch[1].trim(), importeBolivianos: importeMatch ? importeMatch[1] : '0' });
    });
  }
  const totalMatch = notes.match(/TOTAL:\s*Bs\.\s*([\d.]+)/);
  return {
    taskName: activityMatch ? activityMatch[1].trim() : task.name,
    area: areaMatch ? areaMatch[1].trim() : '',
    lugar: lugarMatch ? lugarMatch[1].trim() : '',
    fechaInicio: fechaInicioMatch ? fechaInicioMatch[1] : '',
    fechaFinalizacion: fechaFinMatch ? fechaFinMatch[1] : '',
    fondos,
    total: totalMatch ? totalMatch[1] : '',
  };
}

function parseMaterialRequest(task: AsanaTask) {
  const data = extractJsonData(task.notes);
  if (data) {
    return {
      taskName: (data.titulo as string) ?? task.name,
      area: (data.area as string) ?? '',
      lugar: (data.lugar as string) ?? '',
      fechaInicio: (data.fechaInicio as string) ?? '',
      fechaFinalizacion: (data.fechaFinalizacion as string) ?? '',
      materiales: (data.materiales as MaterialItem[]) ?? [],
    };
  }
  // Fallback: parseo desde texto libre (formato antiguo)
  const notes = task.notes || '';
  const activityMatch = notes.match(/Actividad:\s*(.+)/);
  const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
  const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
  const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  const materiales: MaterialItem[] = [];
  const sec = notes.match(/MATERIALES SOLICITADOS:\s*([\s\S]+?)(?=\n\n---)/);
  if (sec) {
    sec[1].split(/\n\n(?=\d+\.)/).forEach((item, idx) => {
      const d = item.match(/\d+\.\s*(.+)/);
      if (d) materiales.push({
        id: idx + 1,
        detalle: d[1].trim(),
        cantidad: (item.match(/Cantidad:\s*(.+)/) || [])[1]?.trim() || '-',
        unidad: (item.match(/Unidad:\s*(.+)/) || [])[1]?.trim() || '-',
        observaciones: (item.match(/Observaciones:\s*(.+)/) || [])[1]?.trim() || '-',
      });
    });
  }
  return {
    taskName: activityMatch ? activityMatch[1].trim() : task.name,
    area: areaMatch ? areaMatch[1].trim() : '',
    lugar: lugarMatch ? lugarMatch[1].trim() : '',
    fechaInicio: fechaInicioMatch ? fechaInicioMatch[1] : '',
    fechaFinalizacion: fechaFinMatch ? fechaFinMatch[1] : '',
    materiales,
  };
}

function parseMaterialReturn(task: AsanaTask) {
  const data = extractJsonData(task.notes);
  if (data) {
    return {
      taskName: (data.titulo as string) ?? task.name,
      area: (data.area as string) ?? '',
      lugar: (data.lugar as string) ?? '',
      fechaDevolucion: (data.fechaDevolucion as string) ?? '-',
      materiales: (data.materiales as MaterialItem[]) ?? [],
    };
  }
  // Fallback: parseo desde texto libre (formato antiguo)
  const notes = task.notes || '';
  const activityMatch = notes.match(/Actividad:\s*(.+)/);
  const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
  const lugarMatch = notes.match(/•\s*Lugar de devolución:\s*(.+)/);
  const fechaDevolucionMatch = notes.match(/•\s*Fecha de devolución:\s*(.+)/);
  const materiales: MaterialItem[] = [];
  const sec = notes.match(/MATERIALES A DEVOLVER:\s*([\s\S]+?)(?=\n\n---)/);
  if (sec) {
    sec[1].split(/\n\n(?=\d+\.)/).forEach((item, idx) => {
      const d = item.match(/\d+\.\s*(.+)/);
      if (d) materiales.push({
        id: idx + 1,
        detalle: d[1].trim(),
        cantidad: (item.match(/Cantidad:\s*(.+)/) || [])[1]?.trim() || '-',
        unidad: (item.match(/Unidad:\s*(.+)/) || [])[1]?.trim() || '-',
        observaciones: (item.match(/Observaciones:\s*(.+)/) || [])[1]?.trim() || '-',
      });
    });
  }
  return {
    taskName: activityMatch ? activityMatch[1].trim() : task.name,
    area: areaMatch ? areaMatch[1].trim() : '',
    lugar: lugarMatch ? lugarMatch[1].trim() : '',
    fechaDevolucion: fechaDevolucionMatch ? fechaDevolucionMatch[1].trim() : '-',
    materiales,
  };
}

const SOLICITUD_PREFIXES = ['SFON', 'SMAT', 'DMAT'] as const;

const ALMACEN_OPCIONES = ['ENTREGADO', 'NO AUTORIZADO', 'NO EXISTENTE'] as const;

function almacenColor(v: string): string {
  if (v === 'ENTREGADO') return 'green';
  if (v === 'NO AUTORIZADO') return 'red';
  if (v === 'NO EXISTENTE') return 'orange';
  return 'default';
}

function getSolicitudPrefix(name: string): 'SFON' | 'SMAT' | 'DMAT' | null {
  const upper = name.trim().toUpperCase();
  for (const p of SOLICITUD_PREFIXES) {
    if (upper.startsWith(p)) return p;
  }
  return null;
}

function getTipoFromPrefix(prefix: 'SFON' | 'SMAT' | 'DMAT'): string {
  if (prefix === 'SFON') return 'Solicitud de Fondos';
  if (prefix === 'SMAT') return 'Solicitud de Material';
  return 'Devolución de Material';
}

// Convierte fechas DD/MM/YYYY a YYYY-MM-DD para inputs type="date" (deja pasar ISO)
function toDateInput(val?: string): string {
  if (!val || val === '-') return '';
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return val;
}

function extractFechaSolicitud(notes: string | undefined): string {
  if (!notes) return '-';
  const match = notes.match(/Fecha de solicitud:\s*(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2})/);
  return match ? match[1] : '-';
}

// ── Archivado de solicitudes ────────────────────────────────────────────────
// Una solicitud está archivada si su JSON tiene `archivado === true`.
function isArchivada(task: AsanaTask): boolean {
  return extractJsonData(task.notes)?.archivado === true;
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Clave de mes estable (YYYY-MM) a partir de una fecha "DD/MM/YYYY, HH:mm".
function mesKeyFromFecha(fecha: string | undefined): string {
  if (!fecha || fecha === '-') return 'sin-fecha';
  const datePart = fecha.split(',')[0].trim();
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 'sin-fecha';
  return `${m[3]}-${m[2].padStart(2, '0')}`;
}

// Etiqueta legible en español a partir de la clave de mes.
function mesLabelFromKey(key: string): string {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MESES_ES[idx] ?? ''} ${y}`.trim();
}

interface SolicitudRow {
  key: string;
  task: AsanaTask;
  parentTaskGid: string;
  projectName: string;
  parentTaskName: string;
  sectionName: string;
  tipo: string;
  fecha: string;
}

interface ProjectStats {
  gid: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueSoon: number;
  pendingRequests: number;
}

interface ContratacionRow {
  key: string;
  task: AsanaTask;
  projectName: string;
  parentTaskName: string;
  sectionName: string;
}

interface AtrasadaRow {
  key: string;
  task: AsanaTask;
  projectName: string;
  sectionName: string;
  daysLate: number;
  subActividades: AsanaTask[];
}

interface HistorialEntry {
  estado: string;
  fecha: string;
  observaciones: string;
  archivos: { nombre: string; link: string }[];
  usuario?: { nombre: string; email: string };
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PROJECT_PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#6366f1','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
];

function getProjectColor(gid: string): string {
  let h = 0;
  for (const c of gid) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return PROJECT_PALETTE[Math.abs(h) % PROJECT_PALETTE.length];
}

const DonutChart: React.FC<{ pct: number; color: string; size?: number }> = ({ pct, color, size = 72 }) => {
  const r = (size - 14) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={9} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.21, fontWeight: 700, fill: '#1a2332', fontFamily: 'inherit' }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
};

function extractJsonData(notes: string | undefined): Record<string, unknown> | null {
  if (!notes) return null;
  const match = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// Agrupa filas aprobadas por su SMAT (una SMAT y sus SFON hijas forman un grupo)
// y empaqueta los grupos en páginas sin partir ninguno entre páginas distintas.
// Cada grupo (una SMAT sola, o una SMAT junto a su SFON) cuenta como una sola fila.
function buildGroupedPages(rows: SolicitudRow[], groupsPerPage = 10): SolicitudRow[][] {
  const groups: SolicitudRow[][] = [];
  const indexByKey = new Map<string, number>();
  for (const row of rows) {
    const isNested = row.parentTaskName.includes(' › ');
    const key = isNested ? row.parentTaskGid : row.task.gid;
    let gi = indexByKey.get(key);
    if (gi === undefined) {
      gi = groups.length;
      indexByKey.set(key, gi);
      groups.push([]);
    }
    groups[gi].push(row);
  }
  const pages: SolicitudRow[][] = [];
  let page: SolicitudRow[] = [];
  let groupsInPage = 0;
  for (const g of groups) {
    if (groupsInPage >= groupsPerPage) {
      pages.push(page);
      page = [];
      groupsInPage = 0;
    }
    page.push(...g);
    groupsInPage++;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

// Coincidencia de búsqueda: revisa actividad, proyecto, tipo, fecha y solicitante.
function matchSolicitud(row: SolicitudRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const data = extractJsonData(row.task.notes);
  const solicitante = data?.usuario as { nombre?: string; email?: string } | undefined;
  return [
    row.task.name,
    row.projectName,
    row.parentTaskName,
    row.sectionName,
    row.tipo,
    row.fecha,
    solicitante?.nombre,
    solicitante?.email,
  ].filter(Boolean).join(' ').toLowerCase().includes(t);
}



const HomePage: React.FC = () => {
  const { user } = useAuth();
  const canApprove = user?.role === 'administrador' || user?.role === 'director';
  const isTecnico = user?.role === 'tecnico ev' || user?.role === 'tecnico ep' || user?.role === 'comunicacion';
  const isRolTecnico = user?.role === 'tecnico ev' || user?.role === 'tecnico ep';
  const tecnicoArea = user?.role === 'tecnico ev' ? 'Erradicación de Violencia' : user?.role === 'tecnico ep' ? 'Empoderamiento Político' : null;
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState<SolicitudRow[]>([]);
  const [solicitudesObservadas, setSolicitudesObservadas] = useState<SolicitudRow[]>([]);
  const [solicitudesArchivadas, setSolicitudesArchivadas] = useState<SolicitudRow[]>([]);
  const [solTab, setSolTab] = useState('pendientes');
  const [searchPendientes, setSearchPendientes] = useState('');
  const [searchAprobadas, setSearchAprobadas] = useState('');
  const [searchObservadas, setSearchObservadas] = useState('');
  const [searchArchivadas, setSearchArchivadas] = useState('');
  const [mesesExpandidos, setMesesExpandidos] = useState<string[]>([]);
  const [archivandoKey, setArchivandoKey] = useState<string | null>(null);
  const [desarchivandoKey, setDesarchivandoKey] = useState<string | null>(null);
  const [aprobadasPage, setAprobadasPage] = useState(1);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvingGid, setApprovingGid] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<SolicitudRow | null>(null);
  const [observeModal, setObserveModal] = useState<SolicitudRow | null>(null);
  const [observeText, setObserveText] = useState('');
  const [observeSaving, setObserveSaving] = useState(false);
  const [informeModal, setInformeModal] = useState<SolicitudRow | null>(null);
  const [informeNombre, setInformeNombre] = useState('');
  const [informeUrl, setInformeUrl] = useState('');
  const [informeSaving, setInformeSaving] = useState(false);
  const [informeFinalModal, setInformeFinalModal] = useState<SolicitudRow | null>(null);
  const [informeFinalNombre, setInformeFinalNombre] = useState('');
  const [informeFinalUrl, setInformeFinalUrl] = useState('');
  const [informeFinalSaving, setInformeFinalSaving] = useState(false);

  const [contrataciones, setContrataciones] = useState<ContratacionRow[]>([]);
  const [contratacionesExpanded, setContratacionesExpanded] = useState(false);
  const [atrasadasExpanded, setAtrasadasExpanded] = useState(false);
  const [atrasadas, setAtrasadas] = useState<AtrasadaRow[]>([]);
  const [updateContratacion, setUpdateContratacion] = useState<{ task: AsanaTask; data: ContratacionJsonData } | null>(null);
  const [expandedHistoriales, setExpandedHistoriales] = useState<Set<string>>(new Set());
  const [almacenSaving, setAlmacenSaving] = useState<number | null>(null);

  // ── Editar entrada del historial de una contratación ────────────────────
  const [editHistorial, setEditHistorial] = useState<{ task: AsanaTask; entry: HistorialEntry } | null>(null);
  const [editHistorialObservaciones, setEditHistorialObservaciones] = useState('');
  const [editHistorialArchivos, setEditHistorialArchivos] = useState<{ id: number; nombre: string; link: string }[]>([]);
  const [editHistorialSaving, setEditHistorialSaving] = useState(false);

  // ── Crear SFON desde SMAT aprobada ──────────────────────────────────────
  const [sfonFromSmat, setSfonFromSmat] = useState<{ task: AsanaTask; projectName: string; parentTaskName: string; initialData?: { titulo?: string; area?: string; lugar?: string; fechaInicio?: string; fechaFinalizacion?: string } } | null>(null);
  const [loadingSfonGid, setLoadingSfonGid] = useState<string | null>(null);

  // ── Duplicar solicitud observada (crear nueva con datos prellenados) ────
  const [loadingDupGid, setLoadingDupGid] = useState<string | null>(null);
  const [duplicarSol, setDuplicarSol] = useState<{ task: AsanaTask; tipo: SolicitudType; data: Record<string, unknown> } | null>(null);

  // ── Nueva Solicitud desde HomePage ──────────────────────────────────────
  const [showNuevaSolModal, setShowNuevaSolModal] = useState(false);
  const [nuevaSolTask, setNuevaSolTask]           = useState<AsanaTask | null>(null);
  const [nuevaSolType, setNuevaSolType]           = useState<SolicitudType | ''>('');
  const [nuevaSolMeta, setNuevaSolMeta]           = useState<{ projectName?: string; sectionName?: string }>({});

  // ── Notificaciones (protegidas por bandera, desactivadas por defecto) ────
  const notifsEnabled = notificationsService.isEnabled();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!notifsEnabled || !user?.email) return;
    const list = await notificationsService.list(user.email);
    setNotifications(list);
  }, [notifsEnabled, user?.email]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  useEffect(() => {
    if (!notifsEnabled) return;
    loadNotifications();
    const id = setInterval(loadNotifications, 30_000); // refresco cada 30s
    // Refresco inmediato al volver a la pestaña / enfocar la ventana
    const onFocus = () => loadNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [notifsEnabled, loadNotifications]);

  // Marca todas las no leídas como leídas al abrir la campana.
  const handleNotifOpenChange = async (open: boolean) => {
    setNotifOpen(open);
    if (!open) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await Promise.all(unread.map(n => notificationsService.markRead(n.gid)));
  };

  const handleNotifClick = (_n: AppNotification) => {
    setNotifOpen(false);
    setSolTab('pendientes');
  };

  // Notifica a los aprobadores que se creó una nueva solicitud.
  const notifySolicitudCreada = (opts: {
    tipo: SolicitudType;
    titulo?: string;
    projectName?: string;
    sectionName?: string;
    taskName?: string;
    sourceTaskGid: string;
  }) => {
    if (!notifsEnabled) return;
    const { tipo, titulo, projectName, sectionName, taskName, sourceTaskGid } = opts;
    const tipoLabel =
      tipo === 'material' ? 'Solicitud de Material'
      : tipo === 'fondos' ? 'Solicitud de Fondos'
      : 'Devolución de Material';
    const tituloTxt = (titulo ?? '').trim();
    // Jerarquía: Proyecto › Sección › Tarea › Subtarea (la solicitud)
    const jerarquia = [projectName, sectionName, taskName, tituloTxt]
      .map(s => (s ?? '').trim())
      .filter(Boolean)
      .join(' › ');
    notificationsService.notify({
      type: 'solicitud_creada',
      title: tituloTxt ? `Nueva ${tipoLabel}: ${tituloTxt}` : `Nueva ${tipoLabel}`,
      description: jerarquia,
      sourceTaskGid,
      targetEmails: getAprobadorEmails(),
    });
  };

  const handleNuevaSolConfirm = (task: AsanaTask, type: SolicitudType, meta?: { projectName?: string; sectionName?: string }) => {
    setShowNuevaSolModal(false);
    setNuevaSolTask(task);
    setNuevaSolType(type);
    setNuevaSolMeta(meta ?? {});
  };

  const handleNuevaSolClose = () => {
    setNuevaSolTask(null);
    setNuevaSolType('');
    setNuevaSolMeta({});
  };

  const handleNuevaSolSuccess = (titulo?: string) => {
    if (notifsEnabled && nuevaSolTask && nuevaSolType) {
      notifySolicitudCreada({
        tipo: nuevaSolType,
        titulo,
        projectName: nuevaSolMeta.projectName ?? nuevaSolTask.projects?.[0]?.name,
        sectionName: nuevaSolMeta.sectionName,
        taskName: nuevaSolTask.name,
        sourceTaskGid: nuevaSolTask.gid,
      });
    }
    setNuevaSolTask(null);
    setNuevaSolType('');
    setNuevaSolMeta({});
    loadSolicitudes();
    loadNotifications();
  };

  const handleCrearSfonDesdeSmat = async (row: SolicitudRow) => {
    setLoadingSfonGid(row.task.gid);
    try {
      const fullTask = await asanaService.getTask(row.task.gid);
      const smatData = extractJsonData(fullTask.notes);
      // Las fechas en el JSON del SMAT están en DD/MM/YYYY; los inputs type="date" necesitan YYYY-MM-DD
      const parseDdMmYyyy = (val: string | undefined): string | undefined => {
        if (!val) return undefined;
        const parts = val.split('/');
        if (parts.length !== 3) return undefined;
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      };
      const smatMateriales = smatData?.materiales as { id: number; detalle: string }[] | undefined;
      const initialData = smatData ? {
        titulo: (smatData.titulo as string) || undefined,
        area: (smatData.area as string) || undefined,
        lugar: (smatData.lugar as string) || undefined,
        fechaInicio: parseDdMmYyyy(smatData.fechaInicio as string | undefined),
        fechaFinalizacion: parseDdMmYyyy(smatData.fechaFinalizacion as string | undefined),
        fondos: smatMateriales && smatMateriales.length > 0
          ? smatMateriales.map((m, idx) => ({ id: m.id ?? idx + 1, descripcion: m.detalle ?? '' }))
          : undefined,
      } : undefined;
      setSfonFromSmat({ task: fullTask, projectName: row.projectName, parentTaskName: row.parentTaskName, initialData });
      setDetailModal(null);
    } catch (err) {
      console.error('Error al cargar la tarea SMAT:', err);
    } finally {
      setLoadingSfonGid(null);
    }
  };

  const handleDuplicarSolicitud = async (row: SolicitudRow) => {
    setLoadingDupGid(row.task.gid);
    try {
      const data = extractJsonData(row.task.notes) ?? {};
      const parentTask = await asanaService.getTask(row.parentTaskGid);
      let tipo: SolicitudType;
      if (row.tipo === 'Solicitud de Fondos') tipo = 'fondos';
      else if (row.tipo === 'Solicitud de Material') tipo = 'material';
      else tipo = 'devolucion';
      setDuplicarSol({ task: parentTask, tipo, data });
      setDetailModal(null);
    } catch (err) {
      console.error('Error al duplicar la solicitud observada:', err);
    } finally {
      setLoadingDupGid(null);
    }
  };

  const loadSolicitudes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontró el workspace CDIMA');

      const projects = await asanaService.getProjects(cdima.gid);
      // Excluir proyectos cuyo nombre contenga "CDIMA" y el proyecto de NOTIFICACIONES
      const filteredProjects = projects.filter(
        p => !p.name.toUpperCase().includes('CDIMA') && p.name.toUpperCase() !== 'NOTIFICACIONES'
      );

      const allRows: SolicitudRow[] = [];
      const allContrataciones: ContratacionRow[] = [];
      const allAtrasadas: AtrasadaRow[] = [];
      const allStats: ProjectStats[] = [];
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

      const allApproved: SolicitudRow[] = [];
      const allObserved: SolicitudRow[] = [];

      // Procesar todos los proyectos en paralelo (sin chunks ni delays)
      const projectResults = await Promise.all(
        filteredProjects.map(async project => {
          const rows: SolicitudRow[] = [];
          const approvedRows: SolicitudRow[] = [];
          const observedRows: SolicitudRow[] = [];
          const contRows: ContratacionRow[] = [];
          const atrasadasRows: AtrasadaRow[] = [];
          let pendingReqs = 0;
          try {
            // For técnico roles, check project area before fetching all tasks
            if (isTecnico && tecnicoArea) {
              const resumenTask = await asanaService.getProjectResumenTask(project.gid);
              const areaField = resumenTask?.custom_fields?.find(
                f => f.name.toLowerCase().replace(/á/g, 'a') === 'area'
              );
              const areaVal = (areaField?.enum_value?.name ?? areaField?.display_value ?? '').toLowerCase();
              if (!areaVal.includes(tecnicoArea.toLowerCase())) {
                return { rows: [], approvedRows: [], observedRows: [], contRows: [], atrasadasRows: [] };
              }
            }
            const tasks = await asanaService.getProjectTasks(project.gid);
            const topLevel = tasks.filter(t => !t.parent && !t.name.startsWith('Resumen:'));
            const parentTasks = topLevel.filter(t => t.num_subtasks && t.num_subtasks > 0);

            // "Completado" = campo personalizado "Estado" con valor "EJECUTADO"
            const isEjecutado = (t: AsanaTask) => {
              const estadoField = t.custom_fields?.find(f => f.name === 'Estado');
              if (!estadoField) return t.completed;
              const val = (estadoField.enum_value?.name ?? estadoField.display_value ?? '').toUpperCase();
              return val === 'EJECUTADO';
            };

            // Collect overdue top-level activities and build a lookup map
            // Excluir el proyecto "Administración" del conteo de atrasadas
            const isAdministracion = project.name
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .toLowerCase().includes('administracion');
            const atrasadasMap = new Map<string, number>();
            if (!isTecnico && !isAdministracion) {
              topLevel
                .filter(t => !isEjecutado(t) && t.due_on && t.due_on < today)
                .forEach(t => {
                  const idx = atrasadasRows.length;
                  atrasadasMap.set(t.gid, idx);
                  atrasadasRows.push({
                    key: t.gid,
                    task: t,
                    projectName: project.name,
                    sectionName: t.memberships?.[0]?.section?.name ?? '',
                    daysLate: Math.floor((new Date(today).getTime() - new Date(t.due_on!).getTime()) / 86400000),
                    subActividades: [],
                  });
                });
            }

            // Fetch all subtasks in parallel (sin chunks ni delays)
            await Promise.all(
              parentTasks.map(async parentTask => {
                try {
                  const subtasks = await asanaService.getSubtasks(parentTask.gid);
                  // Populate sub-activities for overdue parent tasks
                  if (!isTecnico) {
                    const atrasadaIdx = atrasadasMap.get(parentTask.gid);
                    if (atrasadaIdx !== undefined) {
                      atrasadasRows[atrasadaIdx].subActividades = subtasks.filter(
                        s => !s.name.startsWith('SFON') && !s.name.startsWith('SMAT') &&
                             !s.name.startsWith('DMAT') && !s.name.startsWith('CPER') &&
                             !s.name.startsWith('FUENTES DE VERIFICACION') && !s.name.startsWith('Resumen:')
                      );
                    }
                  }
                  for (const sub of subtasks) {
                    const prefix = getSolicitudPrefix(sub.name);
                    const jsonData = extractJsonData(sub.notes);
                    const isApproved = !!(jsonData?.fechaAprobacion);
                    const isObserved = !!(jsonData?.motivoObservacion && jsonData?.fechaObservacion);
                    if (prefix && !isApproved && !isObserved) {
                      pendingReqs++;
                      rows.push({
                        key: sub.gid,
                        task: sub,
                        parentTaskGid: parentTask.gid,
                        projectName: project.name,
                        parentTaskName: parentTask.name,
                        sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                        tipo: getTipoFromPrefix(prefix),
                        fecha: extractFechaSolicitud(sub.notes),
                      });
                    } else if (prefix && isApproved) {
                      approvedRows.push({
                        key: sub.gid,
                        task: sub,
                        parentTaskGid: parentTask.gid,
                        projectName: project.name,
                        parentTaskName: parentTask.name,
                        sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                        tipo: getTipoFromPrefix(prefix),
                        fecha: extractFechaSolicitud(sub.notes),
                      });
                    } else if (prefix && isObserved) {
                      observedRows.push({
                        key: sub.gid,
                        task: sub,
                        parentTaskGid: parentTask.gid,
                        projectName: project.name,
                        parentTaskName: parentTask.name,
                        sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                        tipo: getTipoFromPrefix(prefix),
                        fecha: extractFechaSolicitud(sub.notes),
                      });
                    }
                    // Collect CPER contrataciones
                    if (sub.name.trim().toUpperCase().startsWith('CPER') && !sub.completed && !isEjecutado(sub)) {
                      contRows.push({
                        key: sub.gid,
                        task: sub,
                        projectName: project.name,
                        parentTaskName: parentTask.name,
                        sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                      });
                    }
                  }

                  // Fetch nested SFONs inside approved SMAT subtasks
                  const smatAprobadas = subtasks.filter(s => {
                    if (getSolicitudPrefix(s.name) !== 'SMAT') return false;
                    const d = extractJsonData(s.notes);
                    return !!(d?.fechaAprobacion);
                  });
                  await Promise.all(
                    smatAprobadas.map(async smat => {
                      try {
                        const subSubs = await asanaService.getSubtasks(smat.gid);
                        for (const ssub of subSubs) {
                          const subPrefix = getSolicitudPrefix(ssub.name);
                          if (!subPrefix) continue;
                          const subJsonData = extractJsonData(ssub.notes);
                          const subIsApproved = !!(subJsonData?.fechaAprobacion);
                          const subIsObserved = !!(subJsonData?.motivoObservacion && subJsonData?.fechaObservacion);
                          const nestedParentName = `${parentTask.name} › ${smat.name}`;
                          if (!subIsApproved && !subIsObserved) {
                            pendingReqs++;
                            rows.push({
                              key: ssub.gid, task: ssub,
                              parentTaskGid: smat.gid,
                              projectName: project.name,
                              parentTaskName: nestedParentName,
                              sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                              tipo: getTipoFromPrefix(subPrefix),
                              fecha: extractFechaSolicitud(ssub.notes),
                            });
                          } else if (subIsApproved) {
                            approvedRows.push({
                              key: ssub.gid, task: ssub,
                              parentTaskGid: smat.gid,
                              projectName: project.name,
                              parentTaskName: nestedParentName,
                              sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                              tipo: getTipoFromPrefix(subPrefix),
                              fecha: extractFechaSolicitud(ssub.notes),
                            });
                          } else if (subIsObserved) {
                            observedRows.push({
                              key: ssub.gid, task: ssub,
                              parentTaskGid: smat.gid,
                              projectName: project.name,
                              parentTaskName: nestedParentName,
                              sectionName: parentTask.memberships?.[0]?.section?.name ?? '',
                              tipo: getTipoFromPrefix(subPrefix),
                              fecha: extractFechaSolicitud(ssub.notes),
                            });
                          }
                        }
                      } catch {
                        // ignorar errores de sub-subtareas
                      }
                    })
                  );
                } catch {
                  // Ignorar errores de subtareas individuales
                }
              })
            );

            // Build stats for this project
            if (!isTecnico && !isAdministracion) {
              const completed = topLevel.filter(isEjecutado).length;
              const overdue = topLevel.filter(t => !isEjecutado(t) && t.due_on && t.due_on < today).length;
              const dueSoon = topLevel.filter(t => !isEjecutado(t) && t.due_on && t.due_on >= today && t.due_on <= nextWeek).length;
              allStats.push({
                gid: project.gid,
                name: project.name,
                color: getProjectColor(project.gid),
                totalTasks: topLevel.length,
                completedTasks: completed,
                overdueTasks: overdue,
                dueSoon,
                pendingRequests: pendingReqs,
              });
            }
          } catch {
            // Ignorar errores de proyectos individuales
          }
          return { rows, approvedRows, observedRows, contRows, atrasadasRows };
        })
      );
      projectResults.forEach(r => {
        allRows.push(...r.rows);
        allApproved.push(...r.approvedRows);
        allObserved.push(...r.observedRows);
        allContrataciones.push(...r.contRows);
        allAtrasadas.push(...r.atrasadasRows);
      });

      const parseFechaSol = (f: string) => {
        if (f === '-') return 0;
        const [datePart, timePart = '00:00'] = f.split(', ');
        const [d, m, y] = datePart.split('/');
        return new Date(`${y}-${m}-${d}T${timePart}`).getTime();
      };
      const parseFechaRespuesta = (row: SolicitudRow) => {
        const data = extractJsonData(row.task.notes);
        const f = (data?.fechaAprobacion as string) || (data?.fechaObservacion as string) || '-';
        return parseFechaSol(f);
      };
      const filterByOwner = (rows: SolicitudRow[]) => {
        if (user?.role !== 'comunicacion') return rows;
        return rows.filter(r => {
          const solicitante = (extractJsonData(r.task.notes)?.usuario as { email?: string } | undefined)?.email;
          return solicitante === user.email;
        });
      };

      setSolicitudes(filterByOwner([...allRows].sort((a, b) => parseFechaSol(b.fecha) - parseFechaSol(a.fecha))));

      // Agrupar aprobadas: cada SMAT va seguida inmediatamente de sus SFONs anidados
      const nestedApproved = allApproved.filter(r => r.parentTaskName.includes(' › '));
      const standaloneApproved = allApproved.filter(r => !r.parentTaskName.includes(' › '));
      // SMAT que ya tienen una Solicitud de Fondos asociada (en cualquier estado)
      const smatConSfon = new Set<string>();
      [...allApproved, ...allRows, ...allObserved].forEach(r => {
        if (r.tipo === 'Solicitud de Fondos') smatConSfon.add(r.parentTaskGid);
      });
      // Orden: las SMAT ya con SFON (finalizadas) van al final; dentro de cada
      // grupo se ordena por fecha de respuesta (desc)
      standaloneApproved.sort((a, b) => {
        const aFin = a.tipo === 'Solicitud de Material' && smatConSfon.has(a.task.gid);
        const bFin = b.tipo === 'Solicitud de Material' && smatConSfon.has(b.task.gid);
        if (aFin !== bFin) return aFin ? 1 : -1;
        return parseFechaRespuesta(b) - parseFechaRespuesta(a);
      });
      const groupedApproved: SolicitudRow[] = [];
      for (const row of standaloneApproved) {
        groupedApproved.push(row);
        if (row.tipo === 'Solicitud de Material') {
          const children = nestedApproved.filter(n => n.parentTaskName.endsWith(` › ${row.task.name}`));
          children.sort((a, b) => parseFechaSol(a.fecha) - parseFechaSol(b.fecha));
          groupedApproved.push(...children);
        }
      }
      const usedKeys = new Set(groupedApproved.map(r => r.key));
      nestedApproved.filter(n => !usedKeys.has(n.key)).forEach(n => groupedApproved.push(n));
      // Separar archivadas de aprobadas activas (una vez archivadas dejan de contar como aprobadas)
      const archivadasRows = groupedApproved.filter(r => isArchivada(r.task));
      const aprobadasActivas = groupedApproved.filter(r => !isArchivada(r.task));
      setSolicitudesAprobadas(filterByOwner(aprobadasActivas));
      setSolicitudesArchivadas(filterByOwner(archivadasRows));
      setSolicitudesObservadas(filterByOwner([...allObserved].sort((a, b) => parseFechaRespuesta(b) - parseFechaRespuesta(a))));
      setContrataciones(allContrataciones);
      setAtrasadas(allAtrasadas.sort((a, b) => b.daysLate - a.daysLate));
      setProjectStats(allStats.sort((a, b) => {
        const pctA = a.totalTasks ? a.completedTasks / a.totalTasks : 0;
        const pctB = b.totalTasks ? b.completedTasks / b.totalTasks : 0;
        return pctB - pctA;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [isTecnico, tecnicoArea]);

  useEffect(() => {
    const token = asanaService.getToken();
    if (token) {
      loadSolicitudes();
    } else {
      setError('No se encontró el token de Asana. Verifica que VITE_ASANA_TOKEN esté definido en el archivo .env');
    }
  }, [loadSolicitudes]);

  // Inserta una fila aprobada respetando la agrupación SMAT → SFON
  const insertApprovedRow = (prev: SolicitudRow[], newRow: SolicitudRow): SolicitudRow[] => {
    const isNested = newRow.parentTaskName.includes(' › ');
    if (isNested) {
      const smatName = newRow.parentTaskName.split(' › ').pop()!;
      const parentIdx = prev.findIndex(r => r.tipo === 'Solicitud de Material' && r.task.name === smatName);
      if (parentIdx !== -1) {
        const result = [...prev];
        let insertIdx = parentIdx + 1;
        while (insertIdx < result.length && result[insertIdx].parentTaskName.endsWith(` › ${smatName}`)) insertIdx++;
        result.splice(insertIdx, 0, newRow);
        return result;
      }
      return [...prev, newRow];
    }
    // No anidada: insertar al inicio (más reciente primero)
    return [newRow, ...prev];
  };

  const handleApprove = async (row: SolicitudRow) => {
    setApprovingGid(row.task.gid);
    try {
      const fechaAprobacion = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
      const data = extractJsonData(row.task.notes) ?? {};
      const updatedData = { ...data, fechaAprobacion };
      const notasBase = (row.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(row.task.gid, { completed: true, notes: newNotes });
      const updatedRow: SolicitudRow = { ...row, task: { ...row.task, notes: newNotes } };
      setSolicitudes(prev => prev.filter(r => r.key !== row.key));
      setSolicitudesAprobadas(prev => insertApprovedRow(prev, updatedRow));
      if (notifsEnabled) {
        const solEmail = (data.usuario as { email?: string } | undefined)?.email;
        if (solEmail) {
          notificationsService.notify({
            type: 'solicitud_aprobada',
            title: 'Solicitud aprobada',
            description: `${row.tipo} · ${row.projectName} › ${row.parentTaskName}`,
            sourceTaskGid: row.task.gid,
            targetEmails: [solEmail],
          });
        }
        loadNotifications();
      }
    } catch (err) {
      console.error('Error al aprobar:', err);
    } finally {
      setApprovingGid(null);
    }
  };

  // ── Archivar / Desarchivar ─────────────────────────────────────────────
  // Reescribe el bloque JSON de una tarea fijando/limpiando el estado de archivado,
  // preservando el texto legible. Devuelve las notas actualizadas.
  const writeArchivadoFlag = async (task: AsanaTask, archivado: boolean): Promise<string> => {
    const data = extractJsonData(task.notes) ?? {};
    const updatedData: Record<string, unknown> = { ...data, archivado };
    if (archivado) {
      updatedData.fechaArchivado = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
    } else {
      delete updatedData.fechaArchivado;
    }
    const notasBase = (task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
    const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
    const updated = await asanaService.updateTask(task.gid, { notes: newNotes });
    return updated.notes ?? newNotes;
  };

  // Solo se archiva una SMAT aprobada cuya SFON anidada también está aprobada (ciclo completo).
  const puedeArchivar = (row: SolicitudRow): boolean => {
    if (!canApprove) return false;
    if (row.tipo !== 'Solicitud de Material') return false;
    if (!extractJsonData(row.task.notes)?.fechaAprobacion) return false;
    return solicitudesAprobadas.some(
      r => r.tipo === 'Solicitud de Fondos' &&
           r.parentTaskGid === row.task.gid &&
           !!(extractJsonData(r.task.notes)?.fechaAprobacion)
    );
  };

  const handleArchivar = async (row: SolicitudRow) => {
    setArchivandoKey(row.key);
    try {
      const sfonChild = solicitudesAprobadas.find(
        r => r.tipo === 'Solicitud de Fondos' && r.parentTaskGid === row.task.gid
      );
      const smatNotes = await writeArchivadoFlag(row.task, true);
      const updatedSmat: SolicitudRow = { ...row, task: { ...row.task, notes: smatNotes } };
      let updatedSfon: SolicitudRow | null = null;
      if (sfonChild) {
        const sfonNotes = await writeArchivadoFlag(sfonChild.task, true);
        updatedSfon = { ...sfonChild, task: { ...sfonChild.task, notes: sfonNotes } };
      }
      const removeKeys = new Set([row.key, sfonChild?.key].filter(Boolean) as string[]);
      setSolicitudesAprobadas(prev => prev.filter(r => !removeKeys.has(r.key)));
      setSolicitudesArchivadas(prev => [updatedSmat, ...(updatedSfon ? [updatedSfon] : []), ...prev]);
    } catch (err) {
      alert('Error al archivar la solicitud.');
      console.error(err);
    } finally {
      setArchivandoKey(null);
    }
  };

  const handleDesarchivar = async (row: SolicitudRow) => {
    setDesarchivandoKey(row.key);
    try {
      const sfonChild = solicitudesArchivadas.find(
        r => r.tipo === 'Solicitud de Fondos' && r.parentTaskGid === row.task.gid
      );
      const smatNotes = await writeArchivadoFlag(row.task, false);
      const updatedSmat: SolicitudRow = { ...row, task: { ...row.task, notes: smatNotes } };
      let updatedSfon: SolicitudRow | null = null;
      if (sfonChild) {
        const sfonNotes = await writeArchivadoFlag(sfonChild.task, false);
        updatedSfon = { ...sfonChild, task: { ...sfonChild.task, notes: sfonNotes } };
      }
      const removeKeys = new Set([row.key, sfonChild?.key].filter(Boolean) as string[]);
      setSolicitudesArchivadas(prev => prev.filter(r => !removeKeys.has(r.key)));
      setSolicitudesAprobadas(prev => {
        let next = insertApprovedRow(prev, updatedSmat);
        if (updatedSfon) next = insertApprovedRow(next, updatedSfon);
        return next;
      });
    } catch (err) {
      alert('Error al desarchivar la solicitud.');
      console.error(err);
    } finally {
      setDesarchivandoKey(null);
    }
  };

  const handleObserveSubmit = async () => {
    if (!observeModal || !observeText.trim()) return;
    setObserveSaving(true);
    try {
      const fechaObservacion = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
      const data = extractJsonData(observeModal.task.notes) ?? {};
      const updatedData = { ...data, observado: true, motivoObservacion: observeText.trim(), fechaObservacion };
      const notasBase = (observeModal.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(observeModal.task.gid, { notes: newNotes });
      const updatedRow: SolicitudRow = { ...observeModal, task: { ...observeModal.task, notes: newNotes } };
      setSolicitudes(prev => prev.filter(r => r.key !== observeModal.task.gid));
      setSolicitudesObservadas(prev => [updatedRow, ...prev]);
      if (notifsEnabled) {
        const solEmail = (data.usuario as { email?: string } | undefined)?.email;
        if (solEmail) {
          notificationsService.notify({
            type: 'solicitud_observada',
            title: 'Solicitud observada',
            description: `${observeModal.tipo} · ${observeModal.projectName} › ${observeModal.parentTaskName}`,
            sourceTaskGid: observeModal.task.gid,
            targetEmails: [solEmail],
          });
        }
        loadNotifications();
      }
      setObserveModal(null);
      setObserveText('');
    } catch (err) {
      console.error('Error al guardar observación:', err);
    } finally {
      setObserveSaving(false);
    }
  };

  const handleDeleteHistorialEntry = async (task: AsanaTask, entry: HistorialEntry) => {
    if (!puedeEditarHistorial(entry)) { alert('No tienes permiso para eliminar esta actualización.'); return; }
    const data = extractJsonData(task.notes) as ContratacionJsonData | null;
    if (!data) return;
    const remaining = (data.historialEstados ?? []).filter(
      (e) => !(e.fecha === entry.fecha && e.estado === entry.estado)
    );
    const latest = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    const updated: ContratacionJsonData = {
      ...data,
      estadoActual: latest ? latest.estado : '',
      historialEstados: remaining,
    };
    const notasBase = (task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
    const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updated, null, 2)}\n===FIN_DATOS_JSON===`;
    try {
      await asanaService.updateTask(task.gid, { notes: newNotes });
      setContrataciones(prev => prev.map(row =>
        row.key === task.gid ? { ...row, task: { ...row.task, notes: newNotes } } : row
      ));
    } catch (err) {
      console.error('Error al eliminar entrada del historial:', err);
    }
  };

  // ── Editar entrada del historial (observaciones y archivos) ─────────────
  // El director puede editar cualquier entrada; el resto solo las creadas/editadas
  // por un usuario de su mismo rol.
  const puedeEditarHistorial = (entry: HistorialEntry): boolean => {
    if (!user) return false;
    if (user.role === 'director') return true;
    const entryRole = getRoleByEmail(entry.usuario?.email);
    return entryRole === user.role;
  };

  const openEditHistorial = (task: AsanaTask, entry: HistorialEntry) => {
    setEditHistorial({ task, entry });
    setEditHistorialObservaciones(entry.observaciones || '');
    setEditHistorialArchivos(entry.archivos.map((a, idx) => ({ id: idx + 1, nombre: a.nombre, link: a.link })));
  };

  const agregarEditHistorialArchivo = () => {
    const newId = Math.max(...editHistorialArchivos.map(a => a.id), 0) + 1;
    setEditHistorialArchivos(prev => [...prev, { id: newId, nombre: '', link: '' }]);
  };

  const eliminarEditHistorialArchivo = (id: number) => {
    setEditHistorialArchivos(prev => prev.filter(a => a.id !== id));
  };

  const actualizarEditHistorialArchivo = (id: number, campo: 'nombre' | 'link', valor: string) => {
    setEditHistorialArchivos(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  };

  const handleSaveEditHistorial = async () => {
    if (!editHistorial) return;
    if (!puedeEditarHistorial(editHistorial.entry)) { alert('No tienes permiso para editar esta actualización.'); return; }
    const archivosValidos = editHistorialArchivos.filter(a => a.nombre.trim() || a.link.trim());
    for (const a of archivosValidos) {
      if (!a.nombre.trim()) { alert('Cada archivo debe tener un nombre.'); return; }
      if (!a.link.trim() || !/^https?:\/\//i.test(a.link.trim())) { alert(`El enlace de "${a.nombre}" debe comenzar con http:// o https://`); return; }
    }
    setEditHistorialSaving(true);
    try {
      const { task, entry } = editHistorial;
      const data = extractJsonData(task.notes) as ContratacionJsonData | null;
      if (!data) return;
      const historialEstados = (data.historialEstados ?? []).map(e =>
        (e.fecha === entry.fecha && e.estado === entry.estado)
          ? { ...e, observaciones: editHistorialObservaciones.trim(), archivos: archivosValidos.map(({ nombre, link }) => ({ nombre: nombre.trim(), link: link.trim() })) }
          : e
      );
      const updated: ContratacionJsonData = { ...data, historialEstados };
      const notasBase = (task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updated, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(task.gid, { notes: newNotes });
      setContrataciones(prev => prev.map(row =>
        row.key === task.gid ? { ...row, task: { ...row.task, notes: newNotes } } : row
      ));
      setEditHistorial(null);
    } catch (err) {
      alert('Error al guardar los cambios del historial.');
      console.error(err);
    } finally {
      setEditHistorialSaving(false);
    }
  };

  const handleSaveAlmacen = async (row: SolicitudRow, materialId: number, value: string) => {
    setAlmacenSaving(materialId);
    try {
      const data = extractJsonData(row.task.notes) ?? {};
      const materiales = ((data.materiales as MaterialItem[]) ?? []).map(m =>
        m.id === materialId ? { ...m, almacen: value } : m
      );
      const updatedData = { ...data, materiales };
      const notasBase = (row.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      const updated = await asanaService.updateTask(row.task.gid, { notes: newNotes });
      const finalNotes = updated.notes ?? newNotes;
      const updateRow = (prev: SolicitudRow[]) =>
        prev.map(r => r.key === row.key ? { ...r, task: { ...r.task, notes: finalNotes } } : r);
      setSolicitudes(updateRow);
      setSolicitudesAprobadas(updateRow);
      setSolicitudesObservadas(updateRow);
      setDetailModal(prev => prev && prev.key === row.key ? { ...prev, task: { ...prev.task, notes: finalNotes } } : prev);
    } catch (err) {
      alert('Error al guardar el estado de almacén.');
      console.error(err);
    } finally {
      setAlmacenSaving(null);
    }
  };

  const handleSaveInforme = async () => {
    if (!informeModal) return;
    const trimmedUrl = informeUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      alert('El enlace debe comenzar con http:// o https://');
      return;
    }
    setInformeSaving(true);
    try {
      const data = extractJsonData(informeModal.task.notes) ?? {};
      const updatedData = { ...data, informe: { nombre: informeNombre.trim(), url: trimmedUrl } };
      const notasBase = (informeModal.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      const updated = await asanaService.updateTask(informeModal.task.gid, { notes: newNotes });
      const updateRow = (prev: SolicitudRow[]) =>
        prev.map(r => r.key === informeModal.key ? { ...r, task: { ...r.task, notes: updated.notes ?? newNotes } } : r);
      setSolicitudes(updateRow);
      setSolicitudesAprobadas(updateRow);
      setSolicitudesObservadas(updateRow);
      setInformeModal(null);
    } catch (err) {
      alert('Error al guardar el informe.');
      console.error(err);
    } finally {
      setInformeSaving(false);
    }
  };

  const handleDeleteInforme = async () => {
    if (!informeModal) return;
    setInformeSaving(true);
    try {
      const data = extractJsonData(informeModal.task.notes) ?? {};
      const { informe: _removed, ...rest } = data as Record<string, unknown> & { informe?: unknown };
      const notasBase = (informeModal.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(rest, null, 2)}\n===FIN_DATOS_JSON===`;
      const updated = await asanaService.updateTask(informeModal.task.gid, { notes: newNotes });
      const updateRow = (prev: SolicitudRow[]) =>
        prev.map(r => r.key === informeModal.key ? { ...r, task: { ...r.task, notes: updated.notes ?? newNotes } } : r);
      setSolicitudes(updateRow);
      setSolicitudesAprobadas(updateRow);
      setSolicitudesObservadas(updateRow);
      setInformeModal(null);
    } catch (err) {
      alert('Error al eliminar el informe.');
      console.error(err);
    } finally {
      setInformeSaving(false);
    }
  };

  const handleSaveInformeFinal = async () => {
    if (!informeFinalModal) return;
    const trimmedUrl = informeFinalUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      alert('El enlace debe comenzar con http:// o https://');
      return;
    }
    setInformeFinalSaving(true);
    try {
      const data = extractJsonData(informeFinalModal.task.notes) ?? {};
      const updatedData = { ...data, informe_final: { nombre: informeFinalNombre.trim(), url: trimmedUrl } };
      const notasBase = (informeFinalModal.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      const updated = await asanaService.updateTask(informeFinalModal.task.gid, { notes: newNotes });
      const updateRow = (prev: SolicitudRow[]) =>
        prev.map(r => r.key === informeFinalModal.key ? { ...r, task: { ...r.task, notes: updated.notes ?? newNotes } } : r);
      setSolicitudes(updateRow);
      setSolicitudesAprobadas(updateRow);
      setSolicitudesObservadas(updateRow);
      setInformeFinalModal(null);
    } catch (err) {
      alert('Error al guardar el informe final.');
      console.error(err);
    } finally {
      setInformeFinalSaving(false);
    }
  };

  const handleDeleteInformeFinal = async () => {
    if (!informeFinalModal) return;
    setInformeFinalSaving(true);
    try {
      const data = extractJsonData(informeFinalModal.task.notes) ?? {};
      const { informe_final: _removed, ...rest } = data as Record<string, unknown> & { informe_final?: unknown };
      const notasBase = (informeFinalModal.task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(rest, null, 2)}\n===FIN_DATOS_JSON===`;
      const updated = await asanaService.updateTask(informeFinalModal.task.gid, { notes: newNotes });
      const updateRow = (prev: SolicitudRow[]) =>
        prev.map(r => r.key === informeFinalModal.key ? { ...r, task: { ...r.task, notes: updated.notes ?? newNotes } } : r);
      setSolicitudes(updateRow);
      setSolicitudesAprobadas(updateRow);
      setSolicitudesObservadas(updateRow);
      setInformeFinalModal(null);
    } catch (err) {
      alert('Error al eliminar el informe final.');
      console.error(err);
    } finally {
      setInformeFinalSaving(false);
    }
  };

  const handleDeleteSolicitud = async (row: SolicitudRow) => {
    try {
      await asanaService.deleteTask(row.task.gid);
      setSolicitudes(prev => prev.filter(r => r.key !== row.key));
      setSolicitudesAprobadas(prev => prev.filter(r => r.key !== row.key));
      setSolicitudesObservadas(prev => prev.filter(r => r.key !== row.key));
    } catch (err) {
      console.error('Error al eliminar solicitud:', err);
    }
  };

  const handlePrintSolicitud = (row: SolicitudRow) => {
    const data = extractJsonData(row.task.notes);
    const fechaGeneracion = extractFechaSolicitud(row.task.notes);
    const fechaGeneracionOpt = fechaGeneracion !== '-' ? fechaGeneracion : undefined;
    if (row.tipo === 'Solicitud de Fondos') {
      exportFundsRequestToPDF({
        taskName: (data?.titulo as string) ?? row.task.name,
        area: (data?.area as string) ?? '',
        lugar: (data?.lugar as string) ?? '',
        fechaInicio: (data?.fechaInicio as string) ?? '',
        fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
        fondos: (data?.fondos as { id: number; descripcion: string; importeBolivianos: string }[]) ?? [],
        projectName: row.projectName,
        parentTaskName: row.parentTaskName,
        fechaGeneracion: fechaGeneracionOpt,
        aprobado: !!data?.fechaAprobacion,
        observado: !!data?.observado,
        solicitante: (data?.solicitante as string) || getSolicitanteByEmail((data?.usuario as { email?: string } | undefined)?.email),
        cargo: (data?.cargo as string) || getCargoByEmail((data?.usuario as { email?: string } | undefined)?.email),
      });
    } else if (row.tipo === 'Solicitud de Material') {
      exportMaterialRequestToPDF({
        taskName: (data?.titulo as string) ?? row.task.name,
        area: (data?.area as string) ?? '',
        lugar: (data?.lugar as string) ?? '',
        fechaInicio: (data?.fechaInicio as string) ?? '',
        fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
        materiales: (data?.materiales as MaterialItem[]) ?? [],
        projectName: row.projectName,
        parentTaskName: row.parentTaskName,
        fechaGeneracion: fechaGeneracionOpt,
        aprobado: !!data?.fechaAprobacion,
        observado: !!data?.observado,
        solicitante: (data?.solicitante as string) || getSolicitanteByEmail((data?.usuario as { email?: string } | undefined)?.email),
        cargo: (data?.cargo as string) || getCargoByEmail((data?.usuario as { email?: string } | undefined)?.email),
      });
    } else if (row.tipo === 'Devolución de Material') {
      exportMaterialReturnToPDF({
        taskName: (data?.titulo as string) ?? row.task.name,
        area: (data?.area as string) ?? '',
        lugar: (data?.lugar as string) ?? '',
        fechaDevolucion: (data?.fechaDevolucion as string) ?? '-',
        materiales: (data?.materiales as { id: number; detalle: string; cantidad: string; unidad: string; observaciones: string }[]) ?? [],
        projectName: row.projectName,
        parentTaskName: row.parentTaskName,
        fechaGeneracion: fechaGeneracionOpt,
        aprobado: !!data?.fechaAprobacion,
        observado: !!data?.observado,
        solicitante: (data?.solicitante as string) || getSolicitanteByEmail((data?.usuario as { email?: string } | undefined)?.email),
        cargo: (data?.cargo as string) || getCargoByEmail((data?.usuario as { email?: string } | undefined)?.email),
      });
    }
  };

  // Reporte con el detalle completo de una Solicitud de Material, incluyendo el estado de almacén.
  const handlePrintDetalleSolicitudMaterial = (row: SolicitudRow) => {
    const data = extractJsonData(row.task.notes);
    const fechaGeneracion = extractFechaSolicitud(row.task.notes);
    const fechaGeneracionOpt = fechaGeneracion !== '-' ? fechaGeneracion : undefined;
    const fechaSolicitud = extractFechaSolicitud(row.task.notes);
    exportMaterialRequestDetailToPDF({
      taskName: (data?.titulo as string) ?? row.task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaInicio: (data?.fechaInicio as string) ?? '',
      fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
      materiales: (data?.materiales as MaterialItem[]) ?? [],
      projectName: row.projectName,
      parentTaskName: row.parentTaskName,
      fechaGeneracion: fechaGeneracionOpt,
      fechaSolicitud: fechaSolicitud !== '-' ? fechaSolicitud : undefined,
      fechaRespuesta: (data?.fechaAprobacion as string) || (data?.fechaObservacion as string) || undefined,
      motivoObservacion: (data?.motivoObservacion as string) || undefined,
      aprobado: !!data?.fechaAprobacion,
      observado: !!(data?.motivoObservacion && data?.fechaObservacion),
      solicitante: (data?.solicitante as string) || getSolicitanteByEmail((data?.usuario as { email?: string } | undefined)?.email),
      cargo: (data?.cargo as string) || getCargoByEmail((data?.usuario as { email?: string } | undefined)?.email),
    });
  };

  // Columna info reutilizable
  const colSolicitudInfo = {
    title: 'Solicitud / Proyecto / Actividad',
    key: 'proyectoActividad',
    width: 360,
    render: (_: unknown, row: SolicitudRow) => {
      const jsonData = extractJsonData(row.task.notes);
      const solicitante = jsonData?.usuario as { nombre: string; email: string } | undefined;
      const tipoColorMap: Record<string, { bg: string; color: string; border: string }> = {
        'Solicitud de Fondos':    { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
        'Solicitud de Material':  { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
        'Devolución de Material': { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
      };
      const tc = tipoColorMap[row.tipo] ?? { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, wordBreak: 'break-word', whiteSpace: 'normal' }}>
          <Typography.Text strong style={{ fontSize: 12 }}>{row.task.name}</Typography.Text>
          <span style={{
            display: 'inline-block', alignSelf: 'flex-start', fontSize: 11, fontWeight: 600,
            backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
            borderRadius: 4, padding: '1px 7px', lineHeight: '18px',
          }}>{row.tipo}</span>
          <Typography.Text style={{ fontSize: 12 }}>{row.projectName}</Typography.Text>
          {row.sectionName && (
            <Typography.Text style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
              📅 {row.sectionName}
            </Typography.Text>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.parentTaskName}</Typography.Text>
          {solicitante ? (
            <Typography.Text style={{ fontSize: 11, color: '#6b7280' }}>
              👤 {solicitante.nombre} · <span style={{ color: '#9ca3af' }}>{solicitante.email}</span>
            </Typography.Text>
          ) : (
            <Typography.Text style={{ fontSize: 11, color: '#d1d5db' }}>👤 Sin registro</Typography.Text>
          )}
        </div>
      );
    },
  };

  const colFechaSolicitud = {
    title: 'Fecha Solicitud',
    dataIndex: 'fecha',
    key: 'fecha',
    width: 160,
    render: (v: string) => <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>,
  };

  const colAccionesPendientes = {
    title: 'Acciones',
    key: 'acciones',
    width: 220,
    fixed: 'right' as const,
    render: (_: unknown, row: SolicitudRow) => (
      <Space size={4}>
        <Tooltip title="Ver detalle">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(row)} />
        </Tooltip>
        <Tooltip title="Imprimir PDF">
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintSolicitud(row)} />
        </Tooltip>
        {(() => {
          const solicitanteEmail = (extractJsonData(row.task.notes)?.usuario as { email?: string } | undefined)?.email;
          const isComunicacion = user?.role === 'comunicacion';
          const isOwner = isComunicacion && solicitanteEmail === user?.email;
          const canDelPending = user?.role === 'director' || user?.role === 'administrador' || (isTecnico && !isComunicacion) || isOwner;
          const delTooltip = canDelPending ? 'Eliminar solicitud' : isComunicacion ? 'Solo puedes eliminar tus propias solicitudes' : 'Solo el director puede eliminar';
          return (
            <Popconfirm
              title="¿Eliminar solicitud?"
              description="Esta acción no se puede deshacer."
              onConfirm={() => handleDeleteSolicitud(row)}
              okText="Eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              disabled={!canDelPending}
            >
              <Tooltip title={delTooltip}>
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  disabled={!canDelPending}
                />
              </Tooltip>
            </Popconfirm>
          );
        })()}
        {!isTecnico && (
          <Tooltip title={canApprove ? 'Agregar observación' : 'Sin permiso para observar'}>
            <Button
              size="small"
              icon={<CommentOutlined />}
              style={canApprove ? { color: '#b45309', borderColor: '#d97706' } : undefined}
              disabled={!canApprove}
              onClick={() => { setObserveModal(row); setObserveText(''); }}
            >
              Observar
            </Button>
          </Tooltip>
        )}
        {!isTecnico && (
          <Popconfirm
            title="¿Aprobar solicitud?"
            description="Se marcará esta solicitud como aprobada."
            onConfirm={() => handleApprove(row)}
            okText="Aprobar"
            cancelText="Cancelar"
            okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
            disabled={!canApprove}
          >
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              style={canApprove ? { color: '#16a34a', borderColor: '#16a34a' } : undefined}
              disabled={!canApprove}
              loading={approvingGid === row.task.gid}
            >
              Aprobar
            </Button>
          </Popconfirm>
        )}
      </Space>
    ),
  };

  // Una SMAT solo puede tener una SFON asociada (relación 1 a 1)
  const smatTieneSfon = (smatGid: string): boolean =>
    [...solicitudes, ...solicitudesAprobadas, ...solicitudesObservadas].some(
      r => r.tipo === 'Solicitud de Fondos' && r.parentTaskGid === smatGid
    );

  const colAccionesHistorico = {
    title: 'Acciones',
    key: 'acciones',
    width: 140,
    fixed: 'right' as const,
    render: (_: unknown, row: SolicitudRow) => {
      const jd = extractJsonData(row.task.notes);
      const esObservada = !!(jd?.motivoObservacion && jd?.fechaObservacion);
      return (
      <Space size={4}>
        <Tooltip title="Ver detalle">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(row)} />
        </Tooltip>
        <Tooltip title="Imprimir PDF">
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintSolicitud(row)} />
        </Tooltip>
        {esObservada && (
          <Tooltip title="Crear nueva solicitud con estos datos">
            <Button
              size="small"
              icon={<CopyOutlined />}
              loading={loadingDupGid === row.task.gid}
              style={{ color: '#0369a1', borderColor: '#7dd3fc' }}
              onClick={() => handleDuplicarSolicitud(row)}
            />
          </Tooltip>
        )}
        {row.tipo === 'Solicitud de Material' && !!(extractJsonData(row.task.notes)?.fechaAprobacion) && (() => {
          const yaTieneSfon = smatTieneSfon(row.task.gid);
          return (
            <Tooltip title={yaTieneSfon
              ? 'Ya existe una Solicitud de Fondos para este material'
              : 'Agregar Solicitud de Fondos'}>
              <span>
                <Button
                  size="small"
                  icon={<DollarOutlined />}
                  loading={loadingSfonGid === row.task.gid}
                  disabled={yaTieneSfon}
                  style={yaTieneSfon ? undefined : { color: '#1d4ed8', borderColor: '#93c5fd' }}
                  onClick={() => handleCrearSfonDesdeSmat(row)}
                />
              </span>
            </Tooltip>
          );
        })()}
        {puedeArchivar(row) && (
          <Popconfirm
            title="¿Archivar solicitud?"
            description="Se moverá a la pestaña Archivadas."
            onConfirm={() => handleArchivar(row)}
            okText="Archivar"
            cancelText="Cancelar"
          >
            <Tooltip title="Archivar solicitud">
              <Button
                size="small"
                icon={<InboxOutlined />}
                loading={archivandoKey === row.key}
                style={{ color: '#b45309', borderColor: '#fcd34d' }}
              />
            </Tooltip>
          </Popconfirm>
        )}
        <Popconfirm
          title="¿Eliminar solicitud?"
          description="Esta acción no se puede deshacer."
          onConfirm={() => handleDeleteSolicitud(row)}
          okText="Eliminar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          disabled={user?.role !== 'director'}
        >
          <Tooltip title={user?.role === 'director' ? 'Eliminar solicitud' : 'Solo el director puede eliminar'}>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              disabled={user?.role !== 'director'}
            />
          </Tooltip>
        </Popconfirm>
      </Space>
      );
    },
  };

  const colFechaRespuesta = {
    title: 'Fecha Respuesta',
    key: 'fechaRespuesta',
    width: 160,
    render: (_: unknown, row: SolicitudRow) => {
      const data = extractJsonData(row.task.notes);
      const fecha = (data?.fechaAprobacion as string) || (data?.fechaObservacion as string) || '-';
      return <Typography.Text style={{ fontSize: 12 }}>{fecha}</Typography.Text>;
    },
  };

  const colMotivoObservacion = {
    title: 'Motivo observación',
    key: 'motivo',
    width: 200,
    render: (_: unknown, row: SolicitudRow) => {
      const data = extractJsonData(row.task.notes);
      const motivo = (data?.motivoObservacion as string) || '-';
      return <Typography.Text style={{ fontSize: 12, color: '#b45309' }}>{motivo}</Typography.Text>;
    },
  };

  const colInforme = {
    title: 'Planificación',
    key: 'informe',
    width: 90,
    render: (_: unknown, row: SolicitudRow) => {
      const data = extractJsonData(row.task.notes);
      const informe = data?.informe as { nombre?: string; url?: string } | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {informe?.url ? (
            <a href={informe.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#2563eb', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              title={informe.nombre || informe.url}>
              <LinkOutlined style={{ marginRight: 3 }} />{informe.nombre || 'Ver'}
            </a>
          ) : null}
          <Tooltip title="Agregar / editar planificación">
            <button
              onClick={() => {
                const d = extractJsonData(row.task.notes);
                const inf = d?.informe as { nombre?: string; url?: string } | undefined;
                setInformeNombre(inf?.nombre ?? '');
                setInformeUrl(inf?.url ?? '');
                setInformeModal(row);
              }}
              style={{
                background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                cursor: 'pointer', padding: '2px 6px', color: '#6b7280', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <LinkOutlined />{informe?.url ? '✎' : '+'}
            </button>
          </Tooltip>
        </div>
      );
    },
  };

  const colInformeFinal = {
    title: 'Informe',
    key: 'informe_final',
    width: 90,
    render: (_: unknown, row: SolicitudRow) => {
      const data = extractJsonData(row.task.notes);
      const informeFinal = data?.informe_final as { nombre?: string; url?: string } | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {informeFinal?.url ? (
            <a href={informeFinal.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#2563eb', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              title={informeFinal.nombre || informeFinal.url}>
              <LinkOutlined style={{ marginRight: 3 }} />{informeFinal.nombre || 'Ver'}
            </a>
          ) : null}
          <Tooltip title="Agregar / editar informe">
            <button
              onClick={() => {
                const d = extractJsonData(row.task.notes);
                const inf = d?.informe_final as { nombre?: string; url?: string } | undefined;
                setInformeFinalNombre(inf?.nombre ?? '');
                setInformeFinalUrl(inf?.url ?? '');
                setInformeFinalModal(row);
              }}
              style={{
                background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                cursor: 'pointer', padding: '2px 6px', color: '#6b7280', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <LinkOutlined />{informeFinal?.url ? '✎' : '+'}
            </button>
          </Tooltip>
        </div>
      );
    },
  };

  // Columna info con jerarquía para tab Aprobadas
  const colSolicitudInfoAprobadas = {
    title: 'Solicitud / Proyecto / Actividad',
    key: 'proyectoActividad',
    width: 380,
    render: (_: unknown, row: SolicitudRow) => {
      const isNested = row.parentTaskName.includes(' › ');
      const jsonData = extractJsonData(row.task.notes);
      const solicitante = jsonData?.usuario as { nombre: string; email: string } | undefined;
      const tipoColorMap: Record<string, { bg: string; color: string; border: string }> = {
        'Solicitud de Fondos':    { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
        'Solicitud de Material':  { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
        'Devolución de Material': { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
      };
      const tc = tipoColorMap[row.tipo] ?? { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
      const parts = isNested ? row.parentTaskName.split(' › ') : [];
      const smatName = isNested ? parts[parts.length - 1] : null;
      const activityName = isNested ? parts.slice(0, -1).join(' › ') : row.parentTaskName;
      return (
        <div style={{ display: 'flex', gap: isNested ? 0 : 0 }}>
          {isNested && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 8, flexShrink: 0 }}>
              <div style={{ width: 2, flex: 1, background: '#c7d2fe', borderRadius: 1, minHeight: 8 }} />
              <div style={{ fontSize: 14, color: '#6366f1', lineHeight: 1 }}>└</div>
            </div>
          )}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            wordBreak: 'break-word', whiteSpace: 'normal',
            ...(isNested ? { borderLeft: '2px solid #c7d2fe', paddingLeft: 8, background: '#f5f3ff', borderRadius: '0 6px 6px 0', padding: '4px 8px' } : {}),
          }}>
            <Typography.Text strong style={{ fontSize: 12 }}>{row.task.name}</Typography.Text>
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start', fontSize: 11, fontWeight: 600,
              backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
              borderRadius: 4, padding: '1px 7px', lineHeight: '18px',
            }}>{row.tipo}</span>
            <Typography.Text style={{ fontSize: 12 }}>{row.projectName}</Typography.Text>
            {row.sectionName && (
              <Typography.Text style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>📅 {row.sectionName}</Typography.Text>
            )}
            {isNested ? (
              <>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{activityName}</Typography.Text>
                <Typography.Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>📦 {smatName}</Typography.Text>
              </>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.parentTaskName}</Typography.Text>
            )}
            {solicitante ? (
              <Typography.Text style={{ fontSize: 11, color: '#6b7280' }}>👤 {solicitante.nombre} · <span style={{ color: '#9ca3af' }}>{solicitante.email}</span></Typography.Text>
            ) : (
              <Typography.Text style={{ fontSize: 11, color: '#d1d5db' }}>👤 Sin registro</Typography.Text>
            )}
          </div>
        </div>
      );
    },
  };

  const columns = [colSolicitudInfo, colFechaSolicitud, colInforme, colInformeFinal, colAccionesPendientes];
  const columnsAprobadas = [colSolicitudInfoAprobadas, colFechaSolicitud, colFechaRespuesta, colInforme, colInformeFinal, colAccionesHistorico];
  const columnsObservadas = [colSolicitudInfo, colFechaSolicitud, colFechaRespuesta, colInforme, colInformeFinal, colMotivoObservacion, colAccionesHistorico];

  const CONTRATACION_PASOS = [
    'Elaboración de TDRs',
    'Lanzamiento de convocatoria',
    'Selección del consultor',
    'Informe final del consultor',
  ];



  const subIsEjecutado = (t: AsanaTask) => {
    const estadoField = t.custom_fields?.find(f => f.name === 'Estado');
    if (!estadoField) return t.completed;
    const val = (estadoField.enum_value?.name ?? estadoField.display_value ?? '').toUpperCase();
    return val === 'EJECUTADO';
  };

  const atrasadasColumns = [
    {
      title: 'Actividad / Proyecto / Responsable',
      key: 'info',
      width: '35%',
      render: (_: unknown, row: AtrasadaRow) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Tooltip title={row.task.name}>
            <Typography.Text strong style={{ fontSize: 12 }} ellipsis>{row.task.name}</Typography.Text>
          </Tooltip>
          <Tooltip title={row.projectName}>
            <Typography.Text style={{ fontSize: 12 }} ellipsis>{row.projectName}</Typography.Text>
          </Tooltip>
          {row.sectionName && (
            <Typography.Text style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }} ellipsis>
              📅 {row.sectionName}
            </Typography.Text>
          )}
          {row.task.assignee ? (
            <Typography.Text style={{ fontSize: 11, color: '#6b7280' }} ellipsis>
              👤 {row.task.assignee.name}
            </Typography.Text>
          ) : (
            <Typography.Text style={{ fontSize: 11, color: '#d1d5db' }}>👤 Sin responsable</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Sub-actividades',
      key: 'subactividades',
      width: '40%',
      render: (_: unknown, row: AtrasadaRow) => {
        if (row.subActividades.length === 0) {
          return <Typography.Text style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sin sub-actividades</Typography.Text>;
        }
        const ejecutadas = row.subActividades.filter(subIsEjecutado).length;
        const total = row.subActividades.length;
        const pct = total ? Math.round((ejecutadas / total) * 100) : 0;
        return (
          <div>
            <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{ejecutadas}/{total} ejecutadas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {row.subActividades.map(sub => {
                const done = subIsEjecutado(sub);
                return (
                  <div key={sub.gid} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{done ? '✅' : '⏳'}</span>
                    <Typography.Text
                      style={{ fontSize: 11, color: done ? '#9ca3af' : '#374151', textDecoration: done ? 'line-through' : 'none' }}
                      ellipsis
                    >
                      {sub.name}
                    </Typography.Text>
                  </div>
                );
              })}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Fecha vencimiento',
      key: 'due',
      width: '15%',
      render: (_: unknown, row: AtrasadaRow) => (
        <Typography.Text style={{ fontSize: 12, color: '#ef4444' }}>{row.task.due_on}</Typography.Text>
      ),
    },
    {
      title: 'Días de retraso',
      key: 'dias',
      width: '10%',
      align: 'center' as const,
      render: (_: unknown, row: AtrasadaRow) => (
        <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{row.daysLate}</span>
      ),
    },
  ];

  // ── Filtros de búsqueda por pestaña ──────────────────────────────
  const filteredPendientes = useMemo(
    () => solicitudes.filter(r => matchSolicitud(r, searchPendientes)),
    [solicitudes, searchPendientes]
  );

  // Aprobadas: filtra por grupo (si la SMAT o su SFON coincide, se conserva el grupo completo)
  const filteredAprobadas = useMemo(() => {
    const term = searchAprobadas.trim();
    if (!term) return solicitudesAprobadas;
    const groups = new Map<string, SolicitudRow[]>();
    const order: string[] = [];
    for (const row of solicitudesAprobadas) {
      const isNested = row.parentTaskName.includes(' › ');
      const key = isNested ? row.parentTaskGid : row.task.gid;
      if (!groups.has(key)) { groups.set(key, []); order.push(key); }
      groups.get(key)!.push(row);
    }
    const result: SolicitudRow[] = [];
    for (const key of order) {
      const g = groups.get(key)!;
      if (g.some(r => matchSolicitud(r, term))) result.push(...g);
    }
    return result;
  }, [solicitudesAprobadas, searchAprobadas]);

  const filteredObservadas = useMemo(
    () => solicitudesObservadas.filter(r => matchSolicitud(r, searchObservadas)),
    [solicitudesObservadas, searchObservadas]
  );

  // Archivadas: filtro de búsqueda reutilizando matchSolicitud
  const filteredArchivadas = useMemo(
    () => solicitudesArchivadas.filter(r => matchSolicitud(r, searchArchivadas)),
    [solicitudesArchivadas, searchArchivadas]
  );

  // Agrupación de archivadas por mes según la fecha de aprobación de la SMAT del grupo.
  const seccionesArchivadasPorMes = useMemo(() => {
    const fechaAprobDeGrupo = (row: SolicitudRow): string | undefined => {
      if (!row.parentTaskName.includes(' › ')) {
        return extractJsonData(row.task.notes)?.fechaAprobacion as string | undefined;
      }
      const parent = solicitudesArchivadas.find(r => r.task.gid === row.parentTaskGid);
      return extractJsonData((parent ?? row).task.notes)?.fechaAprobacion as string | undefined;
    };
    const buckets = new Map<string, SolicitudRow[]>();
    const order: string[] = [];
    for (const row of filteredArchivadas) {
      const key = mesKeyFromFecha(fechaAprobDeGrupo(row));
      if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
      buckets.get(key)!.push(row);
    }
    order.sort((a, b) => {
      if (a === 'sin-fecha') return 1;
      if (b === 'sin-fecha') return -1;
      return a < b ? 1 : a > b ? -1 : 0; // descendente (más reciente primero)
    });
    return order.map(key => {
      const rows = buckets.get(key)!;
      const conteo = rows.filter(r => !r.parentTaskName.includes(' › ')).length || rows.length;
      return { clave: key, etiqueta: mesLabelFromKey(key), solicitudes: rows, conteo };
    });
  }, [filteredArchivadas, solicitudesArchivadas]);

  // Páginas de aprobadas agrupadas: una SMAT y sus SFON hijas nunca se separan
  const aprobadasPages = useMemo(() => buildGroupedPages(filteredAprobadas), [filteredAprobadas]);
  const aprobadasSafePage = Math.min(aprobadasPage, aprobadasPages.length);
  const currentAprobadasRows = aprobadasPages[aprobadasSafePage - 1] ?? [];

  // Índice de grupo por fila: una SMAT y sus SFON anidadas comparten grupo,
  // de modo que podamos alternar el tono de color por solicitud completa.
  const aprobadasGroupIndex = useMemo(() => {
    const map = new Map<string, number>();
    let g = -1;
    for (const row of currentAprobadasRows) {
      const isNested = row.parentTaskName.includes(' › ');
      if (!isNested) g++;
      else if (g < 0) g = 0;
      map.set(row.key, g);
    }
    return map;
  }, [currentAprobadasRows]);

  // Número de registro por grupo para Aprobadas: una SMAT y sus SFON anidadas
  // comparten un único número (cuentan como un solo registro), continuo en toda la lista.
  const aprobadasRowNumber = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const row of filteredAprobadas) {
      const isNested = row.parentTaskName.includes(' › ');
      if (!isNested) n++;
      else if (n === 0) n = 1;
      map.set(row.key, n);
    }
    return map;
  }, [filteredAprobadas]);

  // Índice de grupo para observadas: misma lógica que aprobadas para
  // alternar el tono y diferenciar cada solicitud.
  const observadasGroupIndex = useMemo(() => {
    const map = new Map<string, number>();
    let g = -1;
    for (const row of filteredObservadas) {
      const isNested = row.parentTaskName.includes(' › ');
      if (!isNested) g++;
      else if (g < 0) g = 0;
      map.set(row.key, g);
    }
    return map;
  }, [filteredObservadas]);

  // Columnas de numeración (posición continua dentro de cada listado)
  const colIndexPendientes = {
    title: '#',
    key: 'num',
    width: 48,
    align: 'center' as const,
    render: (_: unknown, row: SolicitudRow) => (
      <Typography.Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
        {filteredPendientes.findIndex(r => r.key === row.key) + 1}
      </Typography.Text>
    ),
  };
  const colIndexAprobadas = {
    title: '#',
    key: 'num',
    width: 48,
    align: 'center' as const,
    render: (_: unknown, row: SolicitudRow) => {
      const isNested = row.parentTaskName.includes(' › ');
      if (isNested) return null;
      return (
        <Typography.Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
          {aprobadasRowNumber.get(row.key)}
        </Typography.Text>
      );
    },
  };
  const colIndexObservadas = {
    title: '#',
    key: 'num',
    width: 48,
    align: 'center' as const,
    render: (_: unknown, row: SolicitudRow) => (
      <Typography.Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
        {filteredObservadas.findIndex(r => r.key === row.key) + 1}
      </Typography.Text>
    ),
  };

  const colIndexArchivadas = {
    title: '#',
    key: 'num',
    width: 48,
    align: 'center' as const,
    render: (_: unknown, row: SolicitudRow, index: number) => {
      if (row.parentTaskName.includes(' › ')) return null;
      return (
        <Typography.Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
          {index + 1}
        </Typography.Text>
      );
    },
  };

  const colAccionesArchivadas = {
    title: 'Acciones',
    key: 'acciones',
    width: 140,
    fixed: 'right' as const,
    render: (_: unknown, row: SolicitudRow) => {
      const isNested = row.parentTaskName.includes(' › ');
      return (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(row)} />
          </Tooltip>
          <Tooltip title="Imprimir PDF">
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintSolicitud(row)} />
          </Tooltip>
          {canApprove && !isNested && (
            <Popconfirm
              title="¿Desarchivar solicitud?"
              description="Volverá a la pestaña Aprobadas."
              onConfirm={() => handleDesarchivar(row)}
              okText="Desarchivar"
              cancelText="Cancelar"
            >
              <Tooltip title="Desarchivar (volver a Aprobadas)">
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  loading={desarchivandoKey === row.key}
                  style={{ color: '#0369a1', borderColor: '#7dd3fc' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      );
    },
  };

  const columnsArchivadas = [colIndexArchivadas, colSolicitudInfoAprobadas, colFechaSolicitud, colFechaRespuesta, colInforme, colInformeFinal, colAccionesArchivadas];

  return (
    <div style={{padding: '2rem', backgroundColor: '#f2f2f2'}}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.75rem',
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏠</span>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>Inicio</Typography.Title>
            <Typography.Text type="secondary">
              Solicitudes pendientes de aprobación
            </Typography.Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {notifsEnabled && (
            <Popover
              open={notifOpen}
              onOpenChange={handleNotifOpenChange}
              trigger="click"
              placement="bottomRight"
              title="Notificaciones"
              content={
                <div style={{ width: 340, maxHeight: 400, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <Empty description="Sin notificaciones" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <List
                      size="small"
                      dataSource={notifications}
                      renderItem={(n) => (
                        <List.Item
                          onClick={() => handleNotifClick(n)}
                          style={{
                            cursor: 'pointer',
                            background: n.read ? 'transparent' : '#eff6ff',
                            borderRadius: 6,
                            padding: '8px 10px',
                          }}
                        >
                          <List.Item.Meta
                            title={
                              <Typography.Text strong={!n.read} style={{ fontSize: 13 }}>
                                {n.title}
                              </Typography.Text>
                            }
                            description={
                              <Typography.Text style={{ fontSize: 12, color: '#6b7280' }}>
                                {n.description}
                              </Typography.Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              }
            >
              <Badge count={unreadCount} size="small">
                <Button icon={<BellOutlined />} />
              </Badge>
            </Popover>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={loadSolicitudes}
            loading={loading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="alert alert-error">{error}</div>
        </div>
      )}

      {/* Solicitudes */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
            <BellOutlined style={{ color: '#b45309', fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: 15 }}>
              Solicitudes
            </Typography.Text>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowNuevaSolModal(true)}
            style={{ background: '#b45309', borderColor: '#b45309' }}
          >
            Nueva Solicitud
          </Button>
        }
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#6b7280' }}>
              Cargando solicitudes desde todos los proyectos...
            </div>
          </div>
        ) : (
          <Tabs
            activeKey={solTab}
            onChange={setSolTab}
            style={{ padding: '0 1.25rem' }}
            tabBarExtraContent={{
              right: (
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Buscar por actividad, proyecto, solicitante..."
                  value={solTab === 'aprobadas' ? searchAprobadas : solTab === 'observadas' ? searchObservadas : solTab === 'archivadas' ? searchArchivadas : searchPendientes}
                  onChange={e => {
                    const v = e.target.value;
                    if (solTab === 'aprobadas') { setSearchAprobadas(v); setAprobadasPage(1); }
                    else if (solTab === 'observadas') setSearchObservadas(v);
                    else if (solTab === 'archivadas') setSearchArchivadas(v);
                    else setSearchPendientes(v);
                  }}
                  style={{ width: 300 }}
                />
              ),
            }}
            items={[
              {
                key: 'pendientes',
                label: (
                  <Space size={6}>
                    <span>⏳ Pendientes</span>
                    <Badge count={solicitudes.length} style={{ background: solicitudes.length > 0 ? '#b45309' : '#9ca3af' }} />
                  </Space>
                ),
                children: (
                  <Table
                    columns={[colIndexPendientes, ...columns]}
                    dataSource={filteredPendientes}
                    size="middle"
                    bordered
                    pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} solicitudes` }}
                    locale={{ emptyText: 'No hay solicitudes pendientes' }}
                    rowClassName={(_, idx) => idx % 2 !== 0 ? 'ant-table-row-stripe' : ''}
                  />
                ),
              },
              {
                key: 'aprobadas',
                label: (
                  <Space size={6}>
                    <span>✅ Aprobadas</span>
                    <Badge count={solicitudesAprobadas.length} style={{ background: solicitudesAprobadas.length > 0 ? '#16a34a' : '#9ca3af' }} />
                  </Space>
                ),
                children: (
                  <>
                    <Table
                      columns={[colIndexAprobadas, ...columnsAprobadas]}
                      dataSource={currentAprobadasRows}
                      size="middle"
                      bordered
                      pagination={false}
                      locale={{ emptyText: 'No hay solicitudes aprobadas' }}
                      rowClassName={(row: SolicitudRow) => {
                        const g = aprobadasGroupIndex.get(row.key) ?? 0;
                        const isNested = row.parentTaskName.includes(' › ');
                        const classes = [g % 2 === 0 ? 'ant-table-row-aprobada' : 'ant-table-row-aprobada-alt'];
                        if (!isNested) classes.push('ant-table-row-aprobada-start');
                        return classes.join(' ');
                      }}
                    />
                    {filteredAprobadas.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {filteredAprobadas.length} solicitudes
                        </Typography.Text>
                        {aprobadasPages.length > 1 && (
                          <Pagination
                            current={aprobadasSafePage}
                            total={aprobadasPages.length}
                            pageSize={1}
                            showSizeChanger={false}
                            onChange={setAprobadasPage}
                          />
                        )}
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: 'observadas',
                label: (
                  <Space size={6}>
                    <span>💬 Observadas</span>
                    <Badge count={solicitudesObservadas.length} style={{ background: solicitudesObservadas.length > 0 ? '#6366f1' : '#9ca3af' }} />
                  </Space>
                ),
                children: (
                  <Table
                    columns={[colIndexObservadas, ...columnsObservadas]}
                    dataSource={filteredObservadas}
                    size="middle"
                    bordered
                    pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} solicitudes` }}
                    locale={{ emptyText: 'No hay solicitudes observadas' }}
                    rowClassName={(row: SolicitudRow) => {
                      const g = observadasGroupIndex.get(row.key) ?? 0;
                      const isNested = row.parentTaskName.includes(' › ');
                      const classes = [g % 2 === 0 ? 'ant-table-row-observada' : 'ant-table-row-observada-alt'];
                      if (!isNested) classes.push('ant-table-row-observada-start');
                      return classes.join(' ');
                    }}
                  />
                ),
              },
              {
                key: 'archivadas',
                label: (
                  <Space size={6}>
                    <span>🗄️ Archivadas</span>
                    <Badge count={solicitudesArchivadas.length} style={{ background: solicitudesArchivadas.length > 0 ? '#64748b' : '#9ca3af' }} />
                  </Space>
                ),
                children: (
                  seccionesArchivadasPorMes.length === 0 ? (
                    <div style={{ padding: '2rem' }}>
                      <Empty description="No hay solicitudes archivadas" />
                    </div>
                  ) : (
                    <Collapse
                      activeKey={mesesExpandidos}
                      onChange={keys => setMesesExpandidos(Array.isArray(keys) ? keys : [keys])}
                      style={{ margin: '0.5rem 0 1rem', background: 'transparent' }}
                      items={seccionesArchivadasPorMes.map(sec => ({
                        key: sec.clave,
                        label: (
                          <Space size={8}>
                            <Typography.Text strong>{sec.etiqueta}</Typography.Text>
                            <Badge count={sec.conteo} style={{ background: '#64748b' }} />
                          </Space>
                        ),
                        children: (
                          <Table
                            columns={columnsArchivadas}
                            dataSource={sec.solicitudes}
                            size="middle"
                            bordered
                            pagination={false}
                            locale={{ emptyText: 'No hay solicitudes archivadas' }}
                          />
                        ),
                      }))}
                    />
                  )
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* ── Contrataciones Activas ──────────────────────────────────────── */}
      {!isRolTecnico && (
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setContratacionesExpanded(v => !v)}
          >
            <span
              style={{
                fontSize: 12,
                color: '#888',
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: contratacionesExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >▶</span>
            <span style={{ fontSize: 16 }}>📋</span>
            <Typography.Text strong style={{ fontSize: 15 }}>Contrataciones Activas</Typography.Text>
            {!loading && (
              <Badge
                count={contrataciones.length}
                style={{ background: contrataciones.length > 0 ? '#6366f1' : '#9ca3af' }}
              />
            )}
          </Space>
        }
      >
        {contratacionesExpanded && (loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}><Spin /></div>
        ) : contrataciones.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>
            No hay contrataciones activas
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {contrataciones.map((row) => {
              const contratacionData = extractJsonData(row.task.notes) as ContratacionJsonData | null;
              const estadoActual = (contratacionData?.estadoActual as string) || '';
              const pasoActualIndex = estadoActual
                ? CONTRATACION_PASOS.findIndex(p => p.toLowerCase() === estadoActual.toLowerCase())
                : -1;
              const parseFechaHist = (f: string) => {
                const clean = f.replace(',', '').trim();
                const [datePart, timePart = '00:00'] = clean.split(/\s+/);
                const [d, m, y] = datePart.split('/');
                return new Date(`${y}-${m}-${d}T${timePart}`).getTime();
              };
              const historial = ([...(contratacionData?.historialEstados as HistorialEntry[] ?? [])])
                .sort((a, b) => parseFechaHist(b.fecha) - parseFechaHist(a.fecha));
              const historialExpanded = expandedHistoriales.has(row.key);
              const toggleHistorial = () => setExpandedHistoriales(prev => {
                const next = new Set(prev);
                next.has(row.key) ? next.delete(row.key) : next.add(row.key);
                return next;
              });
              return (
                <div key={row.key} style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: 8, border: '1px solid #dee2e6' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Typography.Text strong style={{ fontSize: 13 }}>{row.task.name.replace(/^CPER\s*-?\s*/i, '')}</Typography.Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>📁 {row.projectName}</span>
                        {row.sectionName && <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>📅 {row.sectionName}</span>}
                        {row.parentTaskName && <span style={{ fontSize: 11, color: '#9ca3af' }}>📌 {row.parentTaskName}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setUpdateContratacion({
                        task: row.task,
                        data: contratacionData ?? {
                          tipo: 'Contratacion',
                          actividad: row.parentTaskName,
                          subarea: row.task.name.replace(/^CPER\s*-?\s*/i, ''),
                          descripcion: null,
                          fechaGeneracion: '',
                          estadoActual: '',
                          historialEstados: [],
                        },
                      })}
                      className="button-secondary"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}
                    >
                      ✏️ Actualizar estado
                    </button>
                  </div>

                  {/* Stepper */}
                  <div style={{ position: 'relative', paddingTop: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'absolute', top: 27, left: 20, right: 20, height: 2, backgroundColor: '#e0e0e0', zIndex: 0 }} />
                    {pasoActualIndex >= 0 && (
                      <div style={{
                        position: 'absolute', top: 27, left: 20,
                        width: `${(pasoActualIndex / (CONTRATACION_PASOS.length - 1)) * 100}%`,
                        height: 2, backgroundColor: '#4caf50', zIndex: 1, transition: 'width 0.3s ease',
                      }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                      {CONTRATACION_PASOS.map((paso, index) => {
                        const isCompleted = pasoActualIndex >= 0 && index < pasoActualIndex;
                        const isCurrent = index === pasoActualIndex;
                        return (
                          <Tooltip key={index} title={paso}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: '50%',
                                backgroundColor: isCompleted ? '#4caf50' : isCurrent ? '#626262' : '#e0e0e0',
                                border: `2px solid ${isCompleted ? '#4caf50' : isCurrent ? '#626262' : '#e0e0e0'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isCompleted || isCurrent ? '#fff' : '#999',
                                fontWeight: 600, fontSize: '0.72rem',
                                boxShadow: isCurrent ? '0 2px 8px rgba(33,150,243,0.3)' : 'none',
                              }}>
                                {isCompleted ? '✓' : index + 1}
                              </div>
                              <div style={{
                                marginTop: '0.4rem', fontSize: '0.6rem', textAlign: 'center',
                                color: isCurrent ? '#626262' : isCompleted ? '#4caf50' : '#999',
                                fontWeight: isCurrent ? 700 : 400, lineHeight: 1.2, maxWidth: 90,
                              }}>
                                {paso}
                              </div>
                            </div>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                  {pasoActualIndex >= 0 && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.4rem 0.65rem', backgroundColor: '#f2f2f2', borderRadius: 4, borderLeft: '3px solid #626262' }}>
                      <span style={{ fontSize: '0.75rem', color: '#4f4f4f' }}><strong>Estado actual:</strong> {CONTRATACION_PASOS[pasoActualIndex]}</span>
                    </div>
                  )}
                  {!estadoActual && (
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Sin estado registrado</div>
                  )}

                  {/* Historial */}
                  <div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: historial.length > 0 ? 'pointer' : 'default', marginBottom: historialExpanded ? '0.5rem' : 0 }}
                      onClick={() => historial.length > 0 && toggleHistorial()}
                    >
                      {historial.length > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#888', display: 'inline-block', transition: 'transform 0.2s', transform: historialExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                      )}
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                        📋 Historial de actualizaciones{historial.length > 0 ? ` (${historial.length})` : ''}
                      </span>
                    </div>
                    {historialExpanded && historial.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {historial.map((entry, i) => (
                          <div key={i} style={{ backgroundColor: '#f8f9fa', borderRadius: 4, borderLeft: '3px solid #626262', fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (entry.observaciones || entry.archivos?.length > 0) ? '0.35rem' : 0 }}>
                              <span style={{ fontWeight: 600, color: '#333' }}>{entry.estado}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 8 }}>
                                {entry.usuario ? (
                                  <span style={{ fontSize: '0.72rem', color: '#555' }}>👤 {entry.usuario.nombre} · <span style={{ color: '#9ca3af' }}>{entry.usuario.email}</span></span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#999' }}>👤 Sin registro</span>
                                )}
                                <span style={{ fontSize: '0.72rem', color: '#ccc' }}>·</span>
                                <span style={{ fontSize: '0.72rem', color: '#888' }}>{entry.fecha}</span>
                                {puedeEditarHistorial(entry) && (
                                  <Tooltip title="Editar observaciones y archivos">
                                    <button
                                      onClick={() => openEditHistorial(row.task, entry)}
                                      style={{ background: 'none', border: '1px solid #bfdbfe', borderRadius: 4, padding: '0.15rem 0.35rem', cursor: 'pointer', color: '#1d4ed8', fontSize: '0.75rem', lineHeight: 1 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >✏️</button>
                                  </Tooltip>
                                )}
                                <Popconfirm
                                  title="¿Eliminar esta actualización?"
                                  onConfirm={() => handleDeleteHistorialEntry(row.task, entry)}
                                  okText="Eliminar"
                                  cancelText="Cancelar"
                                  okButtonProps={{ danger: true }}
                                  disabled={!puedeEditarHistorial(entry)}
                                >
                                  <Tooltip title={puedeEditarHistorial(entry) ? 'Eliminar' : 'Solo puedes eliminar actualizaciones de tu mismo rol'}>
                                    <button
                                      disabled={!puedeEditarHistorial(entry)}
                                      style={{
                                        background: 'none', border: '1px solid #f5c6cb', borderRadius: 4, padding: '0.15rem 0.35rem',
                                        cursor: puedeEditarHistorial(entry) ? 'pointer' : 'not-allowed',
                                        color: '#c0392b', fontSize: '0.75rem', lineHeight: 1,
                                        opacity: puedeEditarHistorial(entry) ? 1 : 0.4,
                                      }}
                                      onMouseEnter={e => puedeEditarHistorial(entry) && (e.currentTarget.style.background = '#fdecea')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >🗑️</button>
                                  </Tooltip>
                                </Popconfirm>
                              </div>
                            </div>
                            {entry.observaciones && (
                              <p style={{ margin: '0 0 0.25rem', color: '#555', lineHeight: '1.4' }}>{entry.observaciones}</p>
                            )}
                            {entry.archivos?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {entry.archivos.map((archivo, j) => (
                                  <a key={j} href={archivo.link} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '0.72rem', color: '#1a73e8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                    📎 {archivo.nombre}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {historial.length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>Sin actualizaciones aún.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
      )}

      {/* ── Actividades Atrasadas ───────────────────────────────────────── */}
      {!isTecnico && <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setAtrasadasExpanded(v => !v)}
          >
            <span
              style={{
                fontSize: 12,
                color: '#888',
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: atrasadasExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >▶</span>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <Typography.Text strong style={{ fontSize: 15 }}>Actividades Atrasadas</Typography.Text>
            {!loading && (
              <Badge
                count={atrasadas.length}
                style={{ background: atrasadas.length > 0 ? '#ef4444' : '#9ca3af' }}
              />
            )}
          </Space>
        }
      >
        {atrasadasExpanded && (loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}><Spin /></div>
        ) : (
          <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
            <Table
              columns={atrasadasColumns}
              dataSource={atrasadas}
              size="middle"
              bordered
              tableLayout="fixed"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} actividades` }}
              locale={{ emptyText: 'No hay actividades atrasadas' }}
              rowClassName={(_, idx) => idx % 2 !== 0 ? 'ant-table-row-stripe' : ''}
            />
          </div>
        ))}
      </Card>}

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      {!isTecnico && (projectStats.length > 0 || loading) && (() => {
        const totalTasks = projectStats.reduce((s, p) => s + p.totalTasks, 0);
        const totalCompleted = projectStats.reduce((s, p) => s + p.completedTasks, 0);
        const totalOverdue = projectStats.reduce((s, p) => s + p.overdueTasks, 0);
        const globalPct = totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : 0;
        const kpis = [
          { icon: '🗂️', label: 'Proyectos', value: projectStats.length, sub: 'activos', color: '#3b82f6', bg: '#eff6ff' },
          { icon: '✅', label: 'Avance global', value: `${globalPct}%`, sub: `${totalCompleted}/${totalTasks} actividades`, color: '#10b981', bg: '#ecfdf5' },
          { icon: '⚠️', label: 'Vencidas', value: totalOverdue, sub: 'actividades atrasadas', color: '#ef4444', bg: '#fef2f2' },
          { icon: '🔔', label: 'Solicitudes', value: solicitudes.length, sub: 'pendientes aprobación', color: '#f59e0b', bg: '#fffbeb' },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `4px solid ${k.color}` }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {k.icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a2332', lineHeight: 1.1 }}>{loading ? '…' : k.value}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 1 }}>{k.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{k.sub}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Project Progress Grid ────────────────────────────────────────── */}
      {!isTecnico && (projectStats.length > 0 || loading) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <Typography.Text strong style={{ fontSize: 15 }}>Avance por Proyecto</Typography.Text>
          </div>
          {loading && projectStats.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, padding: '2rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', color: '#9ca3af', fontSize: '0.9rem' }}>
              Calculando estadísticas...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {projectStats.map(proj => {
                const pct = proj.totalTasks ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
                const remaining = proj.totalTasks - proj.completedTasks;
                return (
                  <div key={proj.gid} style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderTop: `3px solid ${proj.color}`, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Donut */}
                    <div style={{ flexShrink: 0, paddingTop: 4 }}>
                      <DonutChart pct={pct} color={proj.color} size={76} />
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a2332', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={proj.name}>
                        {proj.name}
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Completadas</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>{proj.completedTasks}/{proj.totalTasks}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${proj.color}cc, ${proj.color})`, borderRadius: 99, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                      {/* Badges row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {remaining > 0 && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#f0fdf4', color: '#15803d', padding: '2px 7px', borderRadius: 99, border: '1px solid #bbf7d0' }}>
                            📝 {remaining} pendiente{remaining !== 1 ? 's' : ''}
                          </span>
                        )}
                        {proj.overdueTasks > 0 && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#fef2f2', color: '#dc2626', padding: '2px 7px', borderRadius: 99, border: '1px solid #fecaca' }}>
                            ⚠️ {proj.overdueTasks} vencida{proj.overdueTasks !== 1 ? 's' : ''}
                          </span>
                        )}
                        {proj.dueSoon > 0 && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#fffbeb', color: '#d97706', padding: '2px 7px', borderRadius: 99, border: '1px solid #fde68a' }}>
                            📅 {proj.dueSoon} próxima{proj.dueSoon !== 1 ? 's' : ''}
                          </span>
                        )}
                        {proj.pendingRequests > 0 && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 99, border: '1px solid #bfdbfe' }}>
                            🔔 {proj.pendingRequests} solicitud{proj.pendingRequests !== 1 ? 'es' : ''}
                          </span>
                        )}
                        {proj.totalTasks === 0 && (
                          <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontStyle: 'italic' }}>Sin actividades registradas</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Ver Detalle */}
      {detailModal && (() => {
        const isFondos = detailModal.tipo === 'Solicitud de Fondos';
        const isDevolucion = detailModal.tipo === 'Devolución de Material';
        const icon = isFondos ? '💰' : isDevolucion ? '↩️' : '📦';

        let parsed: { area: string; lugar: string; fechaInicio?: string; fechaFinalizacion?: string; fechaDevolucion?: string; taskName: string; fondos?: FundItem[]; total?: string; materiales?: MaterialItem[] };
        if (isFondos) {
          parsed = parseFundsRequest(detailModal.task);
        } else if (isDevolucion) {
          parsed = parseMaterialReturn(detailModal.task);
        } else {
          parsed = parseMaterialRequest(detailModal.task);
        }

        const fondos = parsed.fondos;
        const total = parsed.total;
        const materiales = parsed.materiales;

        const detailJsonData = extractJsonData(detailModal.task.notes);
        const isDetailApproved = !!(detailJsonData?.fechaAprobacion);
        const isDetailObserved = !!(detailJsonData?.motivoObservacion && detailJsonData?.fechaObservacion);
        const estadoPill = isDetailApproved
          ? { icon: '✅', label: 'Aprobado', bg: '#dcfce7', color: '#15803d', border: '#86efac' }
          : isDetailObserved
          ? { icon: '💬', label: 'Observado', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' }
          : { icon: '⏳', label: 'En Proceso', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };

        const fieldStyle: React.CSSProperties = { margin: 0, fontSize: '0.9rem', color: '#374151', padding: '0.4rem 0.6rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' };
        const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.2rem', letterSpacing: '0.5px' };

        const fields: { icon: string; label: string; value?: string }[] = [
          { icon: '📁', label: 'Proyecto', value: detailModal.projectName },
          { icon: '📌', label: 'Actividad', value: detailModal.parentTaskName },
          { icon: '🗓️', label: 'Fecha solicitud', value: detailModal.fecha },
          ...(parsed.area ? [{ icon: '🏢', label: 'Área', value: parsed.area }] : []),
          ...(parsed.lugar ? [{ icon: '📍', label: 'Lugar', value: parsed.lugar }] : []),
          ...(parsed.fechaInicio ? [{ icon: '▶️', label: 'Inicio', value: parsed.fechaInicio }] : []),
          ...(parsed.fechaFinalizacion ? [{ icon: '⏹️', label: 'Finalización', value: parsed.fechaFinalizacion }] : []),
          ...(parsed.fechaDevolucion ? [{ icon: '📅', label: 'Fecha devolución', value: parsed.fechaDevolucion }] : []),
          ...(isDetailApproved ? [{ icon: '✅', label: 'Fecha aprobación', value: detailJsonData?.fechaAprobacion as string }] : []),
          ...(isDetailObserved ? [{ icon: '💬', label: 'Fecha observación', value: detailJsonData?.fechaObservacion as string }] : []),
        ];

        return (
          <div className="modal-overlay" onClick={() => setDetailModal(null)} style={{ zIndex: 1001 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: (!isFondos && !isDevolucion && isDetailApproved) ? '880px' : '680px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <HtmlModalHeader
                icon={icon}
                title={detailModal.tipo}
                subtitle={detailModal.task.name}
                onClose={() => setDetailModal(null)}
              />

              <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
                {/* Estado pill */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, backgroundColor: estadoPill.bg, color: estadoPill.color, padding: '0.2rem 0.75rem', borderRadius: '999px', border: `1px solid ${estadoPill.border}` }}>{estadoPill.icon} {estadoPill.label}</span>
                </div>

                {/* Info fields grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.5rem' }}>
                  {fields.map((f, i) => (
                    <div key={i}>
                      <label style={labelStyle}>{f.icon} {f.label}</label>
                      <p style={fieldStyle}>{f.value || '–'}</p>
                    </div>
                  ))}
                </div>

                {/* Motivo observación */}
                {isDetailObserved && !!(detailJsonData?.motivoObservacion) && (
                  <div style={{ marginBottom: '1.25rem', padding: '0.6rem 0.85rem', backgroundColor: '#fffbeb', borderRadius: 6, border: '1px solid #fcd34d', borderLeft: '3px solid #b45309' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>💬 Motivo de observación</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f' }}>{detailJsonData.motivoObservacion as string}</p>
                  </div>
                )}

                {/* Fondos */}
                {isFondos && fondos && fondos.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>💵 Fondos Solicitados</div>
                    <Table
                      size="small"
                      bordered
                      pagination={false}
                      dataSource={fondos.map(f => ({ ...f, key: f.id }))}
                      columns={[
                        { title: '#', key: 'idx', width: 36, render: (_: unknown, __: unknown, index: number) => index + 1 },
                        { title: 'Descripción', dataIndex: 'descripcion' },
                        { title: 'Importe (Bs.)', dataIndex: 'importeBolivianos', width: 120, align: 'right' as const,
                          render: (v: string) => <Typography.Text strong style={{ color: '#1a5c2a' }}>Bs. {v}</Typography.Text> },
                      ]}
                      summary={() => total ? (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}>
                            <Typography.Text strong>Total</Typography.Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right">
                            <Typography.Text strong>Bs. {total}</Typography.Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      ) : null}
                    />
                  </>
                )}

                {/* Materiales */}
                {!isFondos && materiales && materiales.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                      {isDevolucion ? '↩️ Materiales a Devolver' : '📦 Materiales Solicitados'}
                    </div>
                    <Table
                      size="small"
                      bordered
                      pagination={false}
                      dataSource={materiales.map(m => ({ ...m, key: m.id }))}
                      columns={[
                        { title: '#', key: 'idx', width: 36, render: (_: unknown, __: unknown, index: number) => index + 1 },
                        { title: 'Detalle', dataIndex: 'detalle' },
                        { title: 'Cantidad', dataIndex: 'cantidad', width: 80, align: 'center' as const },
                        { title: 'Unidad', dataIndex: 'unidad', width: 90 },
                        { title: 'Observaciones', dataIndex: 'observaciones' },
                        ...(!isDevolucion && isDetailApproved ? [{
                          title: 'Almacén',
                          key: 'almacen',
                          width: 160,
                          render: (_: unknown, m: MaterialItem) => {
                            const current = m.almacen || '';
                            if (canApprove) {
                              return (
                                <Select
                                  size="small"
                                  style={{ width: '100%' }}
                                  placeholder="Seleccionar"
                                  value={current || undefined}
                                  loading={almacenSaving === m.id}
                                  allowClear
                                  onChange={(val) => handleSaveAlmacen(detailModal, m.id, val ?? '')}
                                  options={ALMACEN_OPCIONES.map(o => ({ value: o, label: o }))}
                                />
                              );
                            }
                            return current
                              ? <Tag color={almacenColor(current)}>{current}</Tag>
                              : <Typography.Text type="secondary" style={{ fontSize: 12 }}>–</Typography.Text>;
                          },
                        }] : []),
                      ]}
                    />
                  </>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {detailModal.tipo === 'Solicitud de Material' && (
                    <Button
                      icon={<PrinterOutlined />}
                      onClick={() => handlePrintDetalleSolicitudMaterial(detailModal)}
                    >
                      Detalle del Solicitud de Material
                    </Button>
                  )}
                  {detailModal.tipo === 'Solicitud de Material' && isDetailApproved && (
                    <Button
                      icon={<DollarOutlined />}
                      loading={loadingSfonGid === detailModal.task.gid}
                      style={{ color: '#1d4ed8', borderColor: '#93c5fd' }}
                      onClick={() => handleCrearSfonDesdeSmat(detailModal)}
                    >
                      Agregar Solicitud de Fondos
                    </Button>
                  )}
                </div>
                <button type="button" onClick={() => setDetailModal(null)} className="button-primary">Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Observar */}
      {informeModal && (
        <div className="modal-overlay" onClick={() => setInformeModal(null)} style={{ zIndex: 1002 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: 0 }}>
            <HtmlModalHeader
              icon="🔗"
              title="Planificación / Documento"
              subtitle={informeModal.task.name}
              onClose={() => setInformeModal(null)}
            />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Nombre del documento</label>
                <input
                  type="text"
                  value={informeNombre}
                  onChange={e => setInformeNombre(e.target.value)}
                  placeholder="Ej: Planificación de actividad abril 2026"
                  disabled={informeSaving}
                  autoFocus
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>🔗 Enlace (URL)</label>
                <input
                  type="url"
                  value={informeUrl}
                  onChange={e => setInformeUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={informeSaving}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => {
                  const d = extractJsonData(informeModal.task.notes);
                  const hasInforme = !!(d?.informe as { url?: string } | undefined)?.url;
                  return hasInforme ? (
                    <Popconfirm
                      title="¿Borrar planificación?"
                      description="Se eliminará el enlace guardado."
                      onConfirm={handleDeleteInforme}
                      okText="Borrar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        type="button"
                        disabled={informeSaving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626' }}
                      >🗑️ Borrar planificación</button>
                    </Popconfirm>
                  ) : null;
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setInformeModal(null)}
                  disabled={informeSaving}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleSaveInforme}
                  disabled={informeSaving}
                  className="button-primary"
                  style={{ padding: '0.5rem 1.25rem', opacity: informeSaving ? 0.6 : 1 }}
                >{informeSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {informeFinalModal && (
        <div className="modal-overlay" onClick={() => setInformeFinalModal(null)} style={{ zIndex: 1002 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: 0 }}>
            <HtmlModalHeader
              icon="🔗"
              title="Informe / Documento"
              subtitle={informeFinalModal.task.name}
              onClose={() => setInformeFinalModal(null)}
            />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Nombre del documento</label>
                <input
                  type="text"
                  value={informeFinalNombre}
                  onChange={e => setInformeFinalNombre(e.target.value)}
                  placeholder="Ej: Informe de actividad abril 2026"
                  disabled={informeFinalSaving}
                  autoFocus
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>🔗 Enlace (URL)</label>
                <input
                  type="url"
                  value={informeFinalUrl}
                  onChange={e => setInformeFinalUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={informeFinalSaving}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => {
                  const d = extractJsonData(informeFinalModal.task.notes);
                  const hasInformeFinal = !!(d?.informe_final as { url?: string } | undefined)?.url;
                  return hasInformeFinal ? (
                    <Popconfirm
                      title="¿Borrar informe?"
                      description="Se eliminará el enlace guardado."
                      onConfirm={handleDeleteInformeFinal}
                      okText="Borrar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        type="button"
                        disabled={informeFinalSaving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626' }}
                      >🗑️ Borrar informe</button>
                    </Popconfirm>
                  ) : null;
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setInformeFinalModal(null)}
                  disabled={informeFinalSaving}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleSaveInformeFinal}
                  disabled={informeFinalSaving}
                  className="button-primary"
                  style={{ padding: '0.5rem 1.25rem', opacity: informeFinalSaving ? 0.6 : 1 }}
                >{informeFinalSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {observeModal && (        <div className="modal-overlay" onClick={() => { setObserveModal(null); setObserveText(''); }} style={{ zIndex: 1001 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: 0 }}>
            <HtmlModalHeader
              icon="💬"
              title="Observar Solicitud"
              subtitle={observeModal.task.name}
              onClose={() => { setObserveModal(null); setObserveText(''); }}
            />

            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: '0.4rem', letterSpacing: '0.5px' }}>✏️ Observación</label>
              <textarea
                rows={4}
                placeholder="Escribe la observación sobre esta solicitud..."
                value={observeText}
                onChange={e => setObserveText(e.target.value)}
                maxLength={500}
                style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>{observeText.length}/500</div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setObserveModal(null); setObserveText(''); }}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
              >Cancelar</button>
              <button
                type="button"
                onClick={handleObserveSubmit}
                disabled={!observeText.trim() || observeSaving}
                className="button-primary"
                style={{ padding: '0.5rem 1.25rem', opacity: (!observeText.trim() || observeSaving) ? 0.6 : 1 }}
              >{observeSaving ? 'Guardando...' : 'Guardar observación'}</button>
            </div>
          </div>
        </div>
      )}

      <NuevaSolicitudModal
        open={showNuevaSolModal}
        onClose={() => setShowNuevaSolModal(false)}
        onConfirm={handleNuevaSolConfirm}
        tecnicoArea={tecnicoArea}
      />

      {nuevaSolTask && nuevaSolType === 'material' && (
        <MaterialRequestModal
          task={nuevaSolTask}
          projectName={nuevaSolTask.projects?.[0]?.name}
          onClose={handleNuevaSolClose}
          onSuccess={handleNuevaSolSuccess}
        />
      )}

      {nuevaSolTask && nuevaSolType === 'fondos' && (
        <FundsRequestModal
          task={nuevaSolTask}
          projectName={nuevaSolTask.projects?.[0]?.name}
          onClose={handleNuevaSolClose}
          onSuccess={handleNuevaSolSuccess}
        />
      )}

      {nuevaSolTask && nuevaSolType === 'devolucion' && (
        <MaterialReturnModal
          task={nuevaSolTask}
          projectName={nuevaSolTask.projects?.[0]?.name}
          onClose={handleNuevaSolClose}
          onSuccess={handleNuevaSolSuccess}
        />
      )}

      {sfonFromSmat && (
        <FundsRequestModal
          task={sfonFromSmat.task}
          projectName={sfonFromSmat.projectName}
          parentTaskName={sfonFromSmat.parentTaskName}
          initialData={sfonFromSmat.initialData}
          onClose={() => setSfonFromSmat(null)}
          onSuccess={(titulo) => {
            notifySolicitudCreada({ tipo: 'fondos', titulo, projectName: sfonFromSmat.projectName, taskName: sfonFromSmat.parentTaskName, sourceTaskGid: sfonFromSmat.task.gid });
            setSfonFromSmat(null);
            loadSolicitudes();
          }}
        />
      )}

      {duplicarSol?.tipo === 'material' && (
        <MaterialRequestModal
          task={duplicarSol.task}
          projectName={duplicarSol.task.projects?.[0]?.name}
          initialData={{
            titulo: duplicarSol.data.titulo as string | undefined,
            area: duplicarSol.data.area as string | undefined,
            lugar: duplicarSol.data.lugar as string | undefined,
            fechaInicio: toDateInput(duplicarSol.data.fechaInicio as string | undefined),
            fechaFinalizacion: toDateInput(duplicarSol.data.fechaFinalizacion as string | undefined),
            materiales: duplicarSol.data.materiales as MaterialItem[] | undefined,
          }}
          onClose={() => setDuplicarSol(null)}
          onSuccess={(titulo) => {
            notifySolicitudCreada({ tipo: 'material', titulo, projectName: duplicarSol.task.projects?.[0]?.name, taskName: duplicarSol.task.name, sourceTaskGid: duplicarSol.task.gid });
            setDuplicarSol(null);
            loadSolicitudes();
          }}
        />
      )}

      {duplicarSol?.tipo === 'fondos' && (
        <FundsRequestModal
          task={duplicarSol.task}
          projectName={duplicarSol.task.projects?.[0]?.name}
          initialData={{
            titulo: duplicarSol.data.titulo as string | undefined,
            area: duplicarSol.data.area as string | undefined,
            lugar: duplicarSol.data.lugar as string | undefined,
            fechaInicio: toDateInput(duplicarSol.data.fechaInicio as string | undefined),
            fechaFinalizacion: toDateInput(duplicarSol.data.fechaFinalizacion as string | undefined),
            fondos: ((duplicarSol.data.fondos as { id: number; descripcion: string; importeBolivianos?: string }[] | undefined) ?? [])
              .map((f, idx) => ({ id: f.id ?? idx + 1, descripcion: f.descripcion ?? '', importeBolivianos: String(f.importeBolivianos ?? '') })),
          }}
          onClose={() => setDuplicarSol(null)}
          onSuccess={(titulo) => {
            notifySolicitudCreada({ tipo: 'fondos', titulo, projectName: duplicarSol.task.projects?.[0]?.name, taskName: duplicarSol.task.name, sourceTaskGid: duplicarSol.task.gid });
            setDuplicarSol(null);
            loadSolicitudes();
          }}
        />
      )}

      {duplicarSol?.tipo === 'devolucion' && (
        <MaterialReturnModal
          task={duplicarSol.task}
          projectName={duplicarSol.task.projects?.[0]?.name}
          initialData={{
            titulo: duplicarSol.data.titulo as string | undefined,
            area: duplicarSol.data.area as string | undefined,
            lugar: duplicarSol.data.lugar as string | undefined,
            fechaDevolucion: toDateInput(duplicarSol.data.fechaDevolucion as string | undefined),
            materiales: duplicarSol.data.materiales as MaterialItem[] | undefined,
          }}
          onClose={() => setDuplicarSol(null)}
          onSuccess={(titulo) => {
            notifySolicitudCreada({ tipo: 'devolucion', titulo, projectName: duplicarSol.task.projects?.[0]?.name, taskName: duplicarSol.task.name, sourceTaskGid: duplicarSol.task.gid });
            setDuplicarSol(null);
            loadSolicitudes();
          }}
        />
      )}

      {updateContratacion && (
        <ContratacionUpdateModal
          contratacion={updateContratacion.task}
          currentData={updateContratacion.data}
          onClose={() => setUpdateContratacion(null)}
          onSuccess={async () => {
            try {
              const updated = await asanaService.getTask(updateContratacion.task.gid);
              setContrataciones(prev => prev.map(row =>
                row.key === updated.gid ? { ...row, task: updated } : row
              ));
            } catch (err) {
              console.error('Error al recargar contratación:', err);
            }
            setUpdateContratacion(null);
          }}
        />
      )}

      {editHistorial && (
        <Modal
          open
          title={`Editar actualización — ${editHistorial.entry.estado}`}
          onCancel={() => setEditHistorial(null)}
          width={620}
          okText="Guardar cambios"
          cancelText="Cancelar"
          confirmLoading={editHistorialSaving}
          onOk={handleSaveEditHistorial}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Observaciones</label>
            <Input.TextArea
              value={editHistorialObservaciones}
              onChange={e => setEditHistorialObservaciones(e.target.value)}
              placeholder="Notas u observaciones sobre este cambio de estado..."
              rows={3}
              maxLength={1000}
              showCount
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Archivos (Google Drive)</label>
            {editHistorialArchivos.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
                Sin archivos. Use el botón para agregar enlaces de Google Drive.
              </Typography.Text>
            )}
            <Space direction="vertical" style={{ width: '100%' }}>
              {editHistorialArchivos.map(archivo => (
                <Space key={archivo.id} style={{ width: '100%' }} align="start">
                  <Input
                    placeholder="Nombre del archivo"
                    value={archivo.nombre}
                    onChange={e => actualizarEditHistorialArchivo(archivo.id, 'nombre', e.target.value)}
                    style={{ width: 180 }}
                    maxLength={200}
                  />
                  <Input
                    placeholder="https://drive.google.com/..."
                    value={archivo.link}
                    onChange={e => actualizarEditHistorialArchivo(archivo.id, 'link', e.target.value)}
                    style={{ width: 260 }}
                  />
                  <Button danger icon={<DeleteOutlined />} onClick={() => eliminarEditHistorialArchivo(archivo.id)} />
                </Space>
              ))}
              <Button icon={<PlusOutlined />} onClick={agregarEditHistorialArchivo} size="small">
                Agregar archivo
              </Button>
            </Space>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HomePage;
