import React, { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Card,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { HtmlModalHeader } from '../components/ModalShared';
import {
  BellOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaTask } from '../types/asana.types';

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

function getTipoColor(tipo: string): string {
  if (tipo.includes('Fondos')) return 'blue';
  if (tipo.includes('Devolución') || tipo.includes('Devolucion')) return 'purple';
  return 'orange';
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
  tipo: string;
  fecha: string;
}

function extractJsonData(notes: string | undefined): Record<string, unknown> | null {
  if (!notes) return null;
  const match = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

const CHUNK = 4;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const HomePage: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvingGid, setApprovingGid] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<SolicitudRow | null>(null);
  const [observeModal, setObserveModal] = useState<SolicitudRow | null>(null);
  const [observeText, setObserveText] = useState('');
  const [observeSaving, setObserveSaving] = useState(false);

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

      // Procesar proyectos en chunks para no saturar la API
      for (let i = 0; i < filteredProjects.length; i += CHUNK) {
        const chunk = filteredProjects.slice(i, i + CHUNK);
        const chunkResults = await Promise.all(
          chunk.map(async project => {
            const rows: SolicitudRow[] = [];
            try {
              const tasks = await asanaService.getProjectTasks(project.gid);
              const parentTasks = tasks.filter(t => !t.parent && t.num_subtasks && t.num_subtasks > 0);

              // Fetch subtasks of tasks que tienen subtareas
              for (let j = 0; j < parentTasks.length; j += CHUNK) {
                const taskChunk = parentTasks.slice(j, j + CHUNK);
                await Promise.all(
                  taskChunk.map(async parentTask => {
                    try {
                      const subtasks = await asanaService.getSubtasks(parentTask.gid);
                      for (const sub of subtasks) {
                        const prefix = getSolicitudPrefix(sub.name);
                        const jsonData = extractJsonData(sub.notes);
                        const isObserved = !!(jsonData?.observado);
                        if (prefix && !sub.completed && !isObserved) {
                          rows.push({
                            key: sub.gid,
                            task: sub,
                            projectName: project.name,
                            parentTaskName: parentTask.name,
                            tipo: getTipoFromPrefix(prefix),
                            fecha: extractFechaSolicitud(sub.notes),
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
            } catch {
              // Ignorar errores de proyectos individuales
            }
            return rows;
          })
        );
        chunkResults.forEach(r => allRows.push(...r));
        if (i + CHUNK < filteredProjects.length) await delay(300);
      }

      setSolicitudes(allRows);
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

  const columns = [
    {
      title: 'Solicitud / Proyecto / Actividad',
      key: 'proyectoActividad',
      width: 280,
      render: (_: unknown, row: SolicitudRow) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Tooltip title={row.task.name}>
            <Typography.Text strong style={{ fontSize: 12 }} ellipsis>{row.task.name}</Typography.Text>
          </Tooltip>
          <Tooltip title={row.projectName}>
            <Typography.Text style={{ fontSize: 12 }} ellipsis>{row.projectName}</Typography.Text>
          </Tooltip>
          <Tooltip title={row.parentTaskName}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{row.parentTaskName}</Typography.Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 180,
      render: (tipo: string) => <Tag color={getTipoColor(tipo)}>{tipo}</Tag>,
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
          <Tooltip title="Agregar observación">
            <Button
              size="small"
              icon={<CommentOutlined />}
              style={{ color: '#b45309', borderColor: '#d97706' }}
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
          >
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#16a34a', borderColor: '#16a34a' }}
              loading={approvingGid === row.task.gid}
            >
              Aprobar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
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
            <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>
            <Typography.Text type="secondary">
              Solicitudes pendientes de aprobación
            </Typography.Text>
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadSolicitudes}
          loading={loading}
        >
          Actualizar
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="alert alert-error">{error}</div>
        </div>
      )}

      {/* Solicitudes pendientes */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
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
      {observeModal && (
        <div className="modal-overlay" onClick={() => { setObserveModal(null); setObserveText(''); }} style={{ zIndex: 1001 }}>
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
    </div>
  );
};

export default HomePage;
