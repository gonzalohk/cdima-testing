import React, { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Card,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { HtmlModalHeader } from '../components/ModalShared';
import ContratacionUpdateModal, { ContratacionJsonData } from '../components/ContratacionUpdateModal';
import {
  BellOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaTask } from '../types/asana.types';
import { useAuth } from '../context/AuthContext';

interface FundItem { id: number; descripcion: string; importeBolivianos: string; }
interface MaterialItem { id: number; detalle: string; cantidad: string; unidad: string; observaciones: string; }

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

function extractFechaSolicitud(notes: string | undefined): string {
  if (!notes) return '-';
  const match = notes.match(/Fecha de solicitud:\s*(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2})/);
  return match ? match[1] : '-';
}

interface SolicitudRow {
  key: string;
  task: AsanaTask;
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

const CHUNK = 4;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const canApprove = user?.role === 'administrador' || user?.role === 'director';
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvingGid, setApprovingGid] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<SolicitudRow | null>(null);
  const [observeModal, setObserveModal] = useState<SolicitudRow | null>(null);
  const [observeText, setObserveText] = useState('');
  const [observeSaving, setObserveSaving] = useState(false);

  const [contrataciones, setContrataciones] = useState<ContratacionRow[]>([]);
  const [atrasadas, setAtrasadas] = useState<AtrasadaRow[]>([]);
  const [updateContratacion, setUpdateContratacion] = useState<{ task: AsanaTask; data: ContratacionJsonData } | null>(null);
  const [expandedHistoriales, setExpandedHistoriales] = useState<Set<string>>(new Set());

  const loadSolicitudes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontró el workspace CDIMA');

      const projects = await asanaService.getProjects(cdima.gid);
      // Excluir proyectos cuyo nombre contenga "CDIMA"
      const filteredProjects = projects.filter(
        p => !p.name.toUpperCase().includes('CDIMA')
      );

      const allRows: SolicitudRow[] = [];
      const allContrataciones: ContratacionRow[] = [];
      const allAtrasadas: AtrasadaRow[] = [];
      const allStats: ProjectStats[] = [];
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

      // Procesar proyectos en chunks para no saturar la API
      for (let i = 0; i < filteredProjects.length; i += CHUNK) {
        const chunk = filteredProjects.slice(i, i + CHUNK);
        const chunkResults = await Promise.all(
          chunk.map(async project => {
            const rows: SolicitudRow[] = [];
            const contRows: ContratacionRow[] = [];
            const atrasadasRows: AtrasadaRow[] = [];
            let pendingReqs = 0;
            try {
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
              const atrasadasMap = new Map<string, number>();
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

              // Fetch subtasks of tasks que tienen subtareas
              for (let j = 0; j < parentTasks.length; j += CHUNK) {
                const taskChunk = parentTasks.slice(j, j + CHUNK);
                await Promise.all(
                  taskChunk.map(async parentTask => {
                    try {
                      const subtasks = await asanaService.getSubtasks(parentTask.gid);
                      // Populate sub-activities for overdue parent tasks
                      const atrasadaIdx = atrasadasMap.get(parentTask.gid);
                      if (atrasadaIdx !== undefined) {
                        atrasadasRows[atrasadaIdx].subActividades = subtasks.filter(
                          s => !s.name.startsWith('SFON') && !s.name.startsWith('SMAT') &&
                               !s.name.startsWith('DMAT') && !s.name.startsWith('CPER') &&
                               !s.name.startsWith('FUENTES DE VERIFICACION') && !s.name.startsWith('Resumen:')
                        );
                      }
                      for (const sub of subtasks) {
                        const prefix = getSolicitudPrefix(sub.name);
                        const jsonData = extractJsonData(sub.notes);
                        const isObserved = !!(jsonData?.observado);
                        if (prefix && !sub.completed && !isObserved) {
                          pendingReqs++;
                          rows.push({
                            key: sub.gid,
                            task: sub,
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
                    } catch {
                      // Ignorar errores de subtareas individuales
                    }
                  })
                );
                if (j + CHUNK < parentTasks.length) await delay(200);
              }

              // Build stats for this project
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
            } catch {
              // Ignorar errores de proyectos individuales
            }
            return { rows, contRows, atrasadasRows };
          })
        );
        chunkResults.forEach(r => {
          allRows.push(...r.rows);
          allContrataciones.push(...r.contRows);
          allAtrasadas.push(...r.atrasadasRows);
        });
        if (i + CHUNK < filteredProjects.length) await delay(300);
      }

      setSolicitudes(allRows);
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
  }, []);

  useEffect(() => {
    const token = asanaService.getToken();
    if (token) {
      loadSolicitudes();
    } else {
      setError('No se encontró el token de Asana. Verifica que VITE_ASANA_TOKEN esté definido en el archivo .env');
    }
  }, [loadSolicitudes]);

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
      setSolicitudes(prev => prev.filter(r => r.key !== row.key));
    } catch (err) {
      console.error('Error al aprobar:', err);
    } finally {
      setApprovingGid(null);
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
      setSolicitudes(prev => prev.filter(r => r.key !== observeModal.task.gid));
      setObserveModal(null);
      setObserveText('');
    } catch (err) {
      console.error('Error al guardar observación:', err);
    } finally {
      setObserveSaving(false);
    }
  };

  const handleDeleteHistorialEntry = async (task: AsanaTask, entryFecha: string, entryEstado: string) => {
    const data = extractJsonData(task.notes) as ContratacionJsonData | null;
    if (!data) return;
    const remaining = (data.historialEstados ?? []).filter(
      (e) => !(e.fecha === entryFecha && e.estado === entryEstado)
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

  const columns = [
    {
      title: 'Solicitud / Proyecto / Actividad',
      key: 'proyectoActividad',
      width: 200,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Tooltip title={row.task.name}>
              <Typography.Text strong style={{ fontSize: 12 }} ellipsis>{row.task.name}</Typography.Text>
            </Tooltip>
            <span style={{
              display: 'inline-block',
              alignSelf: 'flex-start',
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: tc.bg,
              color: tc.color,
              border: `1px solid ${tc.border}`,
              borderRadius: 4,
              padding: '1px 7px',
              lineHeight: '18px',
            }}>
              {row.tipo}
            </span>
            <Tooltip title={row.projectName}>
              <Typography.Text style={{ fontSize: 12 }} ellipsis>{row.projectName}</Typography.Text>
            </Tooltip>
            {row.sectionName && (
              <Typography.Text style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }} ellipsis>
                📅 {row.sectionName}
              </Typography.Text>
            )}
            <Tooltip title={row.parentTaskName}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{row.parentTaskName}</Typography.Text>
            </Tooltip>
            {solicitante ? (
              <Typography.Text style={{ fontSize: 11, color: '#6b7280' }} ellipsis>
                👤 {solicitante.nombre} · <span style={{ color: '#9ca3af' }}>{solicitante.email}</span>
              </Typography.Text>
            ) : (
              <Typography.Text style={{ fontSize: 11, color: '#d1d5db' }}>👤 Sin registro</Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 160,
      render: (v: string) => <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, row: SolicitudRow) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(row)} />
          </Tooltip>
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
        </Space>
      ),
    },
  ];

  const CONTRATACION_PASOS = [
    'Requerimiento de contratación',
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

      {/* Solicitudes pendientes */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
            <BellOutlined style={{ color: '#b45309', fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: 15 }}>
              Solicitudes Pendientes de Aprobación
            </Typography.Text>
            {!loading && (
              <Badge
                count={solicitudes.length}
                style={{ background: solicitudes.length > 0 ? '#b45309' : '#9ca3af' }}
              />
            )}
          </Space>
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
          <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
            <Table
              columns={columns}
              dataSource={solicitudes}
              size="middle"
              bordered
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} solicitudes` }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No hay solicitudes pendientes' }}
              rowClassName={(_, idx) => idx % 2 !== 0 ? 'ant-table-row-stripe' : ''}
            />
          </div>
        )}
      </Card>

      {/* ── Contrataciones Activas ──────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
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
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}><Spin /></div>
        ) : contrataciones.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>
            No hay contrataciones activas
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {contrataciones.map((row) => {
              type HistorialEntry = { estado: string; fecha: string; observaciones: string; archivos: { nombre: string; link: string }[]; usuario?: { nombre: string; email: string } };
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
                                <Popconfirm
                                  title="¿Eliminar esta actualización?"
                                  onConfirm={() => handleDeleteHistorialEntry(row.task, entry.fecha, entry.estado)}
                                  okText="Eliminar"
                                  cancelText="Cancelar"
                                  okButtonProps={{ danger: true }}
                                >
                                  <button
                                    style={{ background: 'none', border: '1px solid #f5c6cb', borderRadius: 4, padding: '0.15rem 0.35rem', cursor: 'pointer', color: '#c0392b', fontSize: '0.75rem', lineHeight: 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#fdecea')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                  >🗑️</button>
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
        )}
      </Card>

      {/* ── Actividades Atrasadas ───────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
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
        {loading ? (
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
        )}
      </Card>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      {(projectStats.length > 0 || loading) && (() => {
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
      {(projectStats.length > 0 || loading) && (
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
        ];

        return (
          <div className="modal-overlay" onClick={() => setDetailModal(null)} style={{ zIndex: 1001 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <HtmlModalHeader
                icon={icon}
                title={detailModal.tipo}
                subtitle={detailModal.task.name}
                onClose={() => setDetailModal(null)}
              />

              <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
                {/* Estado pill */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e', padding: '0.2rem 0.75rem', borderRadius: '999px', border: '1px solid #fcd34d' }}>⏳ En Proceso</span>
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
                        { title: '#', dataIndex: 'id', width: 36 },
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
                        { title: '#', dataIndex: 'id', width: 36 },
                        { title: 'Detalle', dataIndex: 'detalle' },
                        { title: 'Cantidad', dataIndex: 'cantidad', width: 80, align: 'center' as const },
                        { title: 'Unidad', dataIndex: 'unidad', width: 90 },
                        { title: 'Observaciones', dataIndex: 'observaciones' },
                      ]}
                    />
                  </>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa' }}>
                <button type="button" onClick={() => setDetailModal(null)} className="button-primary" style={{ width: '100%' }}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Observar */}
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
    </div>
  );
};

export default HomePage;
