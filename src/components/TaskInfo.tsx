import React, { useState, useEffect } from 'react';
import { AsanaTask, AsanaAttachment } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF, exportMaterialRequestToPDF, exportMaterialReturnToPDF } from '../services/pdf.service';
import MaterialRequestModal from './MaterialRequestModal';
import FundsRequestModal from './FundsRequestModal';
import MaterialReturnModal from './MaterialReturnModal';
import VerificationSourcesModal, { FuentesJsonData } from './VerificationSourcesModal';
import ContratacionModal from './ContratacionModal';
import ContratacionUpdateModal, { ContratacionJsonData } from './ContratacionUpdateModal';

interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
  subtasks: AsanaTask[];
  onSubtaskDeleted?: (gid: string) => void;
  onSubtaskCreated?: () => void;
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount, subtasks, onSubtaskDeleted, onSubtaskCreated }) => {
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showContratacionModal, setShowContratacionModal] = useState(false);
  const [updateContratacion, setUpdateContratacion] = useState<{ task: AsanaTask; data: ContratacionJsonData } | null>(null);
  const [verificationAttachments, setVerificationAttachments] = useState<AsanaAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [observeTarget, setObserveTarget] = useState<AsanaTask | null>(null);
  const [observeMotivo, setObserveMotivo] = useState('');
  const [observeLoading, setObserveLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AsanaTask | null>(null);

  // Buscar la subtarea "FUENTES DE VERIFICACION"
  const verificationSubtask = subtasks.find(
    subtask => subtask.name.startsWith('FUENTES DE VERIFICACION')
  );

  // Parsear JSON de fuentes de verificación desde las notas de la subtarea
  const parseFuentesJson = (subtask?: AsanaTask): FuentesJsonData | undefined => {
    if (!subtask?.notes) return undefined;
    try {
      const parsed = JSON.parse(subtask.notes);
      if (parsed.tipo === 'FUENTES_VERIFICACION') return parsed as FuentesJsonData;
    } catch {
      // notas en formato antiguo (texto plano)
    }
    return undefined;
  };

  const fuentesData = parseFuentesJson(verificationSubtask);

  // Cargar attachments solo si no hay JSON (compatibilidad con subtareas antiguas)
  useEffect(() => {
    const loadVerificationAttachments = async () => {
      if (verificationSubtask && !fuentesData) {
        setLoadingAttachments(true);
        try {
          const attachments = await asanaService.getTaskAttachments(verificationSubtask.gid);
          setVerificationAttachments(attachments);
        } catch (error) {
          console.error('Error al cargar attachments:', error);
          setVerificationAttachments([]);
        } finally {
          setLoadingAttachments(false);
        }
      } else {
        setVerificationAttachments([]);
      }
    };

    loadVerificationAttachments();
  }, [verificationSubtask?.gid]);

  // Estados para expandir/colapsar secciones (por defecto colapsadas)
  const [showFuentesVerificacion, setShowFuentesVerificacion] = useState(false);
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [showContrataciones, setShowContrataciones] = useState(false);
  const [expandedHistoriales, setExpandedHistoriales] = useState<Set<string>>(new Set());

  // Función auxiliar para obtener el valor de un campo personalizado de una tarea específica
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para multi_enum, concatenar los valores
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    // Para number
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    // Para text
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Función auxiliar para obtener el valor de un campo personalizado de la tarea principal
  const getMainTaskFieldValue = (fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para multi_enum, concatenar los valores
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    // Para number
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    // Para text
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Interfaces para solicitudes
  interface FundItem {
    id: number;
    descripcion: string;
    importeBolivianos: string;
  }

  interface MaterialItem {
    id: number;
    detalle: string;
    cantidad: string;
    unidad: string;
    observaciones: string;
  }

  // Extraer datos JSON embebidos en las notas
  const extractJsonData = (notes: string | undefined): Record<string, unknown> | null => {
    if (!notes) return null;
    const match = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  };

  // Extraer la fecha de aprobacion de las notas
  const extractFechaAprobacion = (notes: string | undefined): string => {
    const data = extractJsonData(notes);
    if (data?.fechaAprobacion) return data.fechaAprobacion as string;
    return '';
  };

  // Extraer estado de observación de las notas
  const extractObservacion = (notes: string | undefined): { observado: boolean; motivo: string; fecha: string } => {
    const data = extractJsonData(notes);
    return {
      observado: !!(data?.observado),
      motivo: (data?.motivoObservacion as string) ?? '',
      fecha: (data?.fechaObservacion as string) ?? '',
    };
  };

  // Aprobar solicitud: marcar como completada y guardar fechaAprobacion en JSON
  const handleApproveRequest = async (solicitud: AsanaTask) => {
    const confirmed = window.confirm(`¿Aprobar la solicitud "${solicitud.name}"? Se marcará como EJECUTADA.`);
    if (!confirmed) return;
    try {
      const fechaAprobacion = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
      const data = extractJsonData(solicitud.notes) ?? {};
      const updatedData = { ...data, fechaAprobacion };
      const notasBase = (solicitud.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(solicitud.gid, { completed: true, notes: newNotes });
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al aprobar la solicitud.');
      console.error(err);
    }
  };

  // Marcar solicitud como observada/rechazada
  const handleObserveRequest = (solicitud: AsanaTask) => {
    const obs = extractObservacion(solicitud.notes);
    setObserveMotivo(obs.motivo);
    setObserveTarget(solicitud);
  };

  const submitObservacion = async () => {
    if (!observeTarget) return;
    if (!observeMotivo.trim()) return;
    setObserveLoading(true);
    try {
      const fechaObservacion = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
      const data = extractJsonData(observeTarget.notes) ?? {};
      const updatedData = { ...data, observado: true, motivoObservacion: observeMotivo.trim(), fechaObservacion };
      const notasBase = (observeTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(observeTarget.gid, { notes: newNotes });
      setObserveTarget(null);
      setObserveMotivo('');
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al observar la solicitud.');
      console.error(err);
    } finally {
      setObserveLoading(false);
    }
  };

  // Extraer la fecha de generación de las notas
  const extractFechaSolicitud = (notes: string | undefined): string => {
    const data = extractJsonData(notes);
    if (data?.fechaSolicitud) return data.fechaSolicitud as string;
    return '-';
  };

  // Parsear información de solicitud de fondos
  const parseFundsRequest = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaInicio: (data?.fechaInicio as string) ?? '',
      fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
      fondos: (data?.fondos as FundItem[]) ?? [],
    };
  };

  // Parsear información de solicitud de material
  const parseMaterialRequest = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaInicio: (data?.fechaInicio as string) ?? '',
      fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
      materiales: (data?.materiales as MaterialItem[]) ?? [],
    };
  };

  // Parsear información de solicitud de devolución
  const parseMaterialReturn = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaDevolucion: (data?.fechaDevolucion as string) ?? '-',
      materiales: (data?.materiales as MaterialItem[]) ?? [],
    };
  };

  // Manejar eliminación de solicitudes
  const handleDeleteRequest = async (solicitud: AsanaTask) => {
    const confirmed = window.confirm(`¿Eliminar la solicitud "${solicitud.name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await asanaService.deleteTask(solicitud.gid);
      onSubtaskDeleted?.(solicitud.gid);
    } catch (err) {
      alert('Error al eliminar la solicitud. Por favor, intenta de nuevo.');
      console.error('Error deleting task:', err);
    }
  };

  // Manejar impresión de solicitudes
  const handlePrintRequest = (taskItem: AsanaTask) => {
    const tipoSolicitud = getCustomFieldValue(taskItem, 'Tipo de Solicitud');
    const fechaGeneracion = extractFechaSolicitud(taskItem.notes);
    
    if (tipoSolicitud === 'Solicitud de Fondos') {
      const data = parseFundsRequest(taskItem);
      exportFundsRequestToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Material') {
      const data = parseMaterialRequest(taskItem);
      exportMaterialRequestToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Devolucion') {
      const data = parseMaterialReturn(taskItem);
      exportMaterialReturnToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    }
  };

  // Filtrar solicitudes de las subtareas (solo Fondos y Devolución)
  const solicitudes = subtasks.filter(taskItem => {
    const tipoSolicitud = getCustomFieldValue(taskItem, 'Tipo de Solicitud');
    return tipoSolicitud === 'Solicitud de Fondos' ||tipoSolicitud === 'Solicitud de Material' || tipoSolicitud === 'Solicitud de Devolucion';
  });

  // Filtrar contrataciones de las subtareas
  const contrataciones = subtasks.filter(taskItem => {
    return taskItem.name.startsWith('CPER - ');
  });

  // Eliminar una entrada del historial de una contratación
  const handleDeleteHistorialEntry = async (contratacion: AsanaTask, entryFecha: string, entryEstado: string) => {
    const confirmed = window.confirm(`¿Eliminar la actualización "${entryEstado}" (${entryFecha})? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    const data = extractJsonData(contratacion.notes) as ContratacionJsonData | null;
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
    const notasBase = (contratacion.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
    const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updated, null, 2)}\n===FIN_DATOS_JSON===`;
    try {
      await asanaService.updateTask(contratacion.gid, { notes: newNotes });
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al eliminar la entrada del historial.');
      console.error(err);
    }
  };

  // Calcular valores agregados de las subtareas (excluyendo FUENTES DE VERIFICACION)
  const calculateAggregatedValues = () => {
    let totalMujeres = 0;
    let totalHombres = 0;
    let totalPoblacionMeta = 0;

    subtasks
      .filter(subtask => !subtask.name.startsWith('FUENTES DE VERIFICACION'))
      .forEach(subtask => {
        const mujeres = getCustomFieldValue(subtask, 'Mujeres ');
        const hombres = getCustomFieldValue(subtask, 'Hombres');
        const poblacion = getCustomFieldValue(subtask, 'Población Meta');

        totalMujeres += mujeres !== '-' ? parseInt(mujeres) || 0 : 0;
        totalHombres += hombres !== '-' ? parseInt(hombres) || 0 : 0;
        totalPoblacionMeta += poblacion !== '-' ? parseInt(poblacion) || 0 : 0;
      });

    const total = totalMujeres + totalHombres;

    return {
      mujeres: totalMujeres > 0 ? totalMujeres.toString() : '-',
      hombres: totalHombres > 0 ? totalHombres.toString() : '-',
      total: total > 0 ? total.toString() : '-',
      poblacionMeta: totalPoblacionMeta > 0 ? totalPoblacionMeta.toString() : '-'
    };
  };

  const aggregatedValues = calculateAggregatedValues();

  return (
    <>
      {/* Modal de detalle de solicitud */}
      {detailTarget && (() => {
        const tipoDetalle = getCustomFieldValue(detailTarget, 'Tipo de Solicitud');
        const obsDetalle = extractObservacion(detailTarget.notes);
        const fechaSolicitudDetalle = extractFechaSolicitud(detailTarget.notes);
        const fechaAprobacionDetalle = extractFechaAprobacion(detailTarget.notes);
        const isFondos = tipoDetalle === 'Solicitud de Fondos';
        const isMaterial = tipoDetalle === 'Solicitud de Material';
        const isDevolucion = tipoDetalle === 'Solicitud de Devolucion';
        const fondosData = isFondos ? parseFundsRequest(detailTarget) : null;
        const materialData = isMaterial ? parseMaterialRequest(detailTarget) : null;
        const devolucionData = isDevolucion ? parseMaterialReturn(detailTarget) : null;
        const total = fondosData ? fondosData.fondos.reduce((acc, f) => acc + (parseFloat(f.importeBolivianos) || 0), 0) : 0;
        return (
          <div className="modal-overlay" onClick={() => setDetailTarget(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>
                  {isFondos ? '💰 Solicitud de Fondos' : isDevolucion ? '🔄 Devolución de Material' : '📋 Solicitud de Material'}
                </h2>
                <button className="modal-close" onClick={() => setDetailTarget(null)}>&times;</button>
              </div>
              <div className="modal-body">
                {/* Info general */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título</span>
                    <p style={{ margin: '0.15rem 0 0', fontWeight: 600, fontSize: '0.95rem' }}>{detailTarget.name}</p>
                  </div>
                  {(fondosData || materialData || devolucionData) && [
                    { label: 'Área', value: (fondosData || materialData || devolucionData)?.area },
                    { label: 'Lugar', value: (fondosData || materialData || devolucionData)?.lugar },
                    !isDevolucion && { label: 'Fecha inicio', value: (fondosData || materialData)?.fechaInicio },
                    !isDevolucion && { label: 'Fecha fin', value: (fondosData || materialData)?.fechaFinalizacion },
                    isDevolucion && { label: 'Fecha devolución', value: devolucionData?.fechaDevolucion },
                    { label: 'Fecha solicitud', value: fechaSolicitudDetalle },
                    fechaAprobacionDetalle && { label: 'Fecha aprobación', value: fechaAprobacionDetalle },
                  ].filter(Boolean).map((item, i) => item && (
                    <div key={i}>
                      <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                      <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{item.value || '—'}</p>
                    </div>
                  ))}
                  {obsDetalle.observado && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#fdecea', borderRadius: '6px', padding: '0.6rem 0.75rem', border: '1px solid #f5c6cb' }}>
                      <span style={{ fontSize: '0.72rem', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>⚠ Observación</span>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: '#c0392b' }}>{obsDetalle.motivo}</p>
                      {obsDetalle.fecha && <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#999' }}>{obsDetalle.fecha}</p>}
                    </div>
                  )}
                </div>

                {/* Tabla de ítems */}
                {isFondos && fondosData && fondosData.fondos.length > 0 && (
                  <>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#555' }}>Detalle de fondos</h4>
                    <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '0' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ backgroundColor: '#e9ecef' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>#</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Importe (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fondosData.fondos.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '0.4rem 0.75rem', color: '#888' }}>{i + 1}</td>
                            <td style={{ padding: '0.4rem 0.75rem' }}>{f.descripcion}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{parseFloat(f.importeBolivianos).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total:</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Bs. {total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </>
                )}

                {(isMaterial || isDevolucion) && (materialData || devolucionData) && (
                  (() => {
                    const items = (materialData?.materiales || devolucionData?.materiales) ?? [];
                    return items.length > 0 ? (
                      <>  
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#555' }}>Detalle de materiales</h4>
                        <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ backgroundColor: '#e9ecef' }}>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>#</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Detalle</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Cant.</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Unidad</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Obs.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((m, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ padding: '0.4rem 0.75rem', color: '#888' }}>{i + 1}</td>
                                <td style={{ padding: '0.4rem 0.75rem' }}>{m.detalle}</td>
                                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.cantidad}</td>
                                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.unidad}</td>
                                <td style={{ padding: '0.4rem 0.75rem', color: '#888', fontSize: '0.78rem' }}>{m.observaciones || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </>
                    ) : null;
                  })()
                )}
              </div>
              <div className="modal-footer">
                <button className="button-secondary" onClick={() => setDetailTarget(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de observación */}
      {observeTarget && (
        <div className="modal-overlay" onClick={() => { setObserveTarget(null); setObserveMotivo(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>⚠️ {extractObservacion(observeTarget.notes).observado ? 'Actualizar observación' : 'Observar solicitud'}</h2>
              <button className="modal-close" onClick={() => { setObserveTarget(null); setObserveMotivo(''); }}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#555' }}>
                <strong>{observeTarget.name}</strong>
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Motivo de observación *</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Describa el motivo por el que se observa esta solicitud..."
                  value={observeMotivo}
                  onChange={e => setObserveMotivo(e.target.value)}
                  autoFocus
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="button-secondary"
                onClick={() => { setObserveTarget(null); setObserveMotivo(''); }}
                disabled={observeLoading}
              >
                Cancelar
              </button>
              <button
                className="button-primary"
                onClick={submitObservacion}
                disabled={observeLoading || !observeMotivo.trim()}
                style={{ backgroundColor: '#c0392b', borderColor: '#c0392b' }}
              >
                {observeLoading ? 'Guardando...' : '⚠️ Guardar observación'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Información de la Actividad</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowMaterialModal(true)}
              className="button-primary"
              style={{ fontSize: '0.9rem' }}
            >
              📋 Solicitud de Material
            </button>
            <button
              onClick={() => setShowFundsModal(true)}
              className="button-primary"
              style={{ fontSize: '0.9rem' }}
            >
              💰 Solicitud de Fondos
            </button>
            <button
              onClick={() => setShowReturnModal(true)}
              className="button-primary"
              style={{ fontSize: '0.9rem' }}
            >
              🔄 Devolución de Material
            </button>
            <button
              onClick={() => setShowContratacionModal(true)}
              className="button-primary"
              style={{ fontSize: '0.9rem' }}
            >
              👔 Solicitar Contratación
            </button>
          </div>
        </div>

        {/* Nombre de la actividad */}
        <div className="activity-header-compact">
          <h3 className="activity-title-compact">{task.name}</h3>
        </div>

        {/* Grid compacto con toda la información */}
        <div className="info-grid-compact">
          <div className="info-item">
            <span className="info-label">Estado</span>
            <span className="info-value">
              <span
                className={`status-badge ${
                  getMainTaskFieldValue('Estado') === 'EJECUTADO' ? 'status-completed' : 'status-pending'
                }`}
              >
                {getMainTaskFieldValue('Estado') === 'EJECUTADO' ? 'Completada' : getMainTaskFieldValue('Estado') === 'EN PROCESO' ? 'En Proceso' : 'Pendiente'}
              </span>
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Fecha de Vencimiento</span>
            <span className="info-value">{task.due_on || 'Sin fecha'}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Sub Actividades</span>
            <span className="info-value info-value-highlight">{subtasksCount}</span>
          </div>

          {task.custom_fields && task.custom_fields.length > 0 && (
            <>
              <div className="info-item">
                <span className="info-label">Lugar</span>
                <span className="info-value">{getMainTaskFieldValue('Lugar')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Responsable de Actividad</span>
                <span className="info-value">{getMainTaskFieldValue('Responsable de Actividad')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">👥 Mujeres</span>
                <span className="info-value-beneficiary">{aggregatedValues.mujeres}</span>
              </div>

              <div className="info-item">
                <span className="info-label">👥 Hombres</span>
                <span className="info-value-beneficiary">{aggregatedValues.hombres}</span>
              </div>

              <div className="info-item">
                <span className="info-label">👥 Total Beneficiarios</span>
                <span className="info-value-beneficiary">{aggregatedValues.total}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Población Meta</span>
                <span className="info-value-beneficiary">{aggregatedValues.poblacionMeta}</span>
              </div>
            </>
          )}
        </div>

        {/* Notas en la parte inferior */}
        {task.notes && (
          <div className="notes-content-compact">
            <strong>📝 Resultados:</strong> {task.notes}
          </div>
        )}

        {/* Fuentes de Verificación */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: showFuentesVerificacion ? '1rem' : 0,
              cursor: 'pointer'
            }}
            onClick={() => setShowFuentesVerificacion(!showFuentesVerificacion)}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', transition: 'transform 0.2s', display: 'inline-block', transform: showFuentesVerificacion ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              📂 Fuentes de Verificación
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVerificationModal(true);
              }}
              className="button-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              title={verificationSubtask ? 'Agregar nueva fuente de verificación' : 'Crear subactividad de fuentes de verificación'}
            >
              {verificationSubtask ? '+ Agregar Fuente' : '+ Crear Subactividad'}
            </button>
          </div>

          {showFuentesVerificacion && (verificationSubtask ? (
            <div>
              {/* Modo nuevo: entradas JSON */}
              {fuentesData ? (
                fuentesData.entradas.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {fuentesData.entradas.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.6rem 0.875rem',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ flex: 1, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📎 {entry.nombre}
                        </span>
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            color: '#555',
                            border: '1px solid #ccc',
                            textDecoration: 'none',
                            flexShrink: 0,
                          }}
                        >
                          Ver
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
                    No hay fuentes registradas. Use el botón "Agregar Fuente".
                  </p>
                )
              ) : (
                /* Modo legado: attachments de Asana */
                <div>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#666' }}>
                    {loadingAttachments ? (
                      'Cargando recursos...'
                    ) : verificationAttachments.length > 0 ? (
                      `${verificationAttachments.length} ${verificationAttachments.length === 1 ? 'recurso adjunto' : 'recursos adjuntos'}`
                    ) : (
                      'No hay recursos adjuntos.'
                    )}
                  </p>
                  {verificationAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {verificationAttachments.map((attachment) => (
                        <a
                          key={attachment.gid}
                          href={attachment.view_url || attachment.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="button-secondary"
                          style={{
                            fontSize: '0.85rem',
                            padding: '0.5rem 1rem',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#fff',
                            border: '1px solid #626262',
                            color: '#626262',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#626262';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff';
                            e.currentTarget.style.color = '#626262';
                          }}
                          title={attachment.name}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {attachment.name}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4f4f4f' }}>
                <strong>ℹ️ Info:</strong> Cree la subtarea "FUENTES DE VERIFICACION" para poder adjuntar documentos, imágenes y enlaces de Google Drive.
              </p>
            </div>
          ))}
        </div>

        {/* Solicitudes */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 
            style={{ 
              margin: showSolicitudes ? '0 0 1rem' : 0, 
              fontSize: '1rem', 
              fontWeight: 600, 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
            onClick={() => setShowSolicitudes(!showSolicitudes)}
          >
            <span style={{ fontSize: '0.9rem', transition: 'transform 0.2s', display: 'inline-block', transform: showSolicitudes ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            📋 Solicitudes {solicitudes.length > 0 && `(${solicitudes.length})`}
          </h3>

          {showSolicitudes && (solicitudes.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e9ecef', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Nombre</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Tipo</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Fecha Solicitud</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Fecha Aprobación</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[...solicitudes].sort((a, b) => {
                    const statusOrder = (t: AsanaTask) => {
                      if (t.completed) return 1;
                      const obs = extractObservacion(t.notes);
                      if (obs.observado) return 2;
                      return 0;
                    };
                    return statusOrder(a) - statusOrder(b);
                  }).map((solicitud) => {
                    const tipoSolicitud = getCustomFieldValue(solicitud, 'Tipo de Solicitud');
                    const fechaGeneracion = extractFechaSolicitud(solicitud.notes);
                    const fechaAprobacion = extractFechaAprobacion(solicitud.notes);
                    const esFinalizada = solicitud.completed;
                    const observacion = extractObservacion(solicitud.notes);

                    return (
                      <tr key={solicitud.gid} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: observacion.observado ? '#fff5f5' : esFinalizada ? '#f0faf0' : undefined }}>
                        <td style={{ padding: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{solicitud.name}</div>
                          {observacion.observado && (
                            <div style={{ fontSize: '0.75rem', color: '#c0392b', marginTop: '0.25rem', fontStyle: 'italic', whiteSpace: 'normal' }}>
                              ⚠ {observacion.motivo}
                              {observacion.fecha && <span style={{ color: '#999', marginLeft: '0.4rem' }}>({observacion.fecha})</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: 
                                tipoSolicitud === 'Solicitud de Fondos' ? '#f2f2f2' : 
                                tipoSolicitud === 'Solicitud de Devolucion' ? '#f3e5f5' : 
                                '#fff3e0',
                              color: 
                                tipoSolicitud === 'Solicitud de Fondos' ? '#5a5a5a' : 
                                tipoSolicitud === 'Solicitud de Devolucion' ? '#7b1fa2' : 
                                '#f57c00',
                              border: `1px solid ${
                                tipoSolicitud === 'Solicitud de Fondos' ? '#b5b5b5' : 
                                tipoSolicitud === 'Solicitud de Devolucion' ? '#ce93d8' : 
                                '#ffb74d'
                              }`,
                            }}
                          >
                            {tipoSolicitud === 'Solicitud de Fondos' ? '💰 Fondos' : 
                             tipoSolicitud === 'Solicitud de Devolucion' ? '🔄 Dev. Material' : 
                             '📋 Material'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#666' }}>{fechaGeneracion}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: fechaAprobacion ? '#2e7d32' : '#bbb' }}>{fechaAprobacion || '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: esFinalizada ? '#e8f5e9' : observacion.observado ? '#fdecea' : '#fff3e0',
                              color: esFinalizada ? '#2e7d32' : observacion.observado ? '#c0392b' : '#f57c00',
                              border: `1px solid ${esFinalizada ? '#81c784' : observacion.observado ? '#f5c6cb' : '#ffb74d'}`,
                            }}
                          >
                            {esFinalizada ? '✓ Aprobada' : observacion.observado ? '⚠ Observada' : '⏸ Pendiente'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            {!esFinalizada && !observacion.observado && (
                              <button
                                onClick={() => handleApproveRequest(solicitud)}
                                className="button-primary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}
                              >
                                ✅ Aprobar
                              </button>
                            )}
                            {!esFinalizada && (
                              <button
                                onClick={() => handleObserveRequest(solicitud)}
                                title={observacion.observado ? 'Actualizar observación' : 'Observar solicitud'}
                                style={{
                                  background: observacion.observado ? '#fdecea' : 'none',
                                  border: '1px solid #f5c6cb',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.6rem',
                                  cursor: 'pointer',
                                  color: '#c0392b',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#fdecea')}
                                onMouseLeave={e => (e.currentTarget.style.background = observacion.observado ? '#fdecea' : 'none')}
                              >
                                ⚠️
                              </button>
                            )}
                            <button
                              onClick={() => setDetailTarget(solicitud)}
                              title="Ver detalle"
                              style={{
                                background: 'none',
                                border: '1px solid #b3c6e0',
                                borderRadius: '6px',
                                padding: '0.35rem 0.55rem',
                                cursor: 'pointer',
                                color: '#1a5fa8',
                                fontSize: '0.9rem',
                                lineHeight: 1,
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#e8f0fb')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              📓
                            </button>
                            <button
                              onClick={() => handlePrintRequest(solicitud)}
                              className="button-primary"
                              title="Imprimir"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer', lineHeight: 1 }}
                            >
                              🖨️
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(solicitud)}
                              title="Eliminar solicitud"
                              style={{
                                background: 'none',
                                border: '1px solid #f5c6cb',
                                borderRadius: '6px',
                                padding: '0.35rem 0.5rem',
                                cursor: 'pointer',
                                color: '#c0392b',
                                fontSize: '0.9rem',
                                lineHeight: 1,
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#fdecea')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4f4f4f' }}>
                <strong>ℹ️ Info:</strong> No hay solicitudes generadas para esta actividad. Use los botones superiores para crear solicitudes de material, fondos o devolución.
              </p>
            </div>
          ))}
        </div>

        {/* Contrataciones */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 
            style={{ 
              margin: showContrataciones ? '0 0 1rem' : 0, 
              fontSize: '1rem', 
              fontWeight: 600, 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
            onClick={() => setShowContrataciones(!showContrataciones)}
          >
            <span style={{ fontSize: '0.9rem', transition: 'transform 0.2s', display: 'inline-block', transform: showContrataciones ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            👔 Contrataciones {contrataciones.length > 0 && `(${contrataciones.length})`}
          </h3>

          {showContrataciones && (contrataciones.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contrataciones.map((contratacion) => {
                const nombreContratacion = contratacion.name.replace('CPER - ', '');
                const contratacionData = extractJsonData(contratacion.notes) as ContratacionJsonData | null;
                const descripcionContratacion = contratacionData?.descripcion as string | null;
                const estadoContratacion = (contratacionData?.estadoActual as string) || getCustomFieldValue(contratacion, 'Estado de Contratación');

                // Definir los pasos del stepper
                const pasos = [
                  'Requerimiento de contratación',
                  'Elaboración de TDRs',
                  'Lanzamiento de convocatoria',
                  'Selección del consultor',
                  'Informe final del consultor'
                ];

                // Determinar el índice del paso actual (basado en el estado)
                const pasoActualIndex = estadoContratacion 
                  ? pasos.findIndex(paso => paso.toLowerCase() === estadoContratacion.toLowerCase())
                  : -1;

                return (
                  <div 
                    key={contratacion.gid}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6'
                    }}
                  >
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: descripcionContratacion ? '0.35rem' : '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>
                          {nombreContratacion}
                        </h4>
                        <button
                          onClick={() => setUpdateContratacion({
                            task: contratacion,
                            data: contratacionData ?? {
                              tipo: 'Contratacion',
                              actividad: task.name,
                              subarea: nombreContratacion,
                              descripcion: null,
                              fechaGeneracion: '',
                              estadoActual: '',
                              historialEstados: [],
                            },
                          })}
                          className="button-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}
                        >
                          ✏️ Actualizar estado
                        </button>
                      </div>
                      {descripcionContratacion && (
                        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#666' }}>
                          {descripcionContratacion}
                        </p>
                      )}

                      {/* Progress Stepper */}
                      <div style={{ position: 'relative', paddingTop: '0.5rem' }}>
                        {/* Línea de fondo */}
                        <div style={{
                          position: 'absolute',
                          top: '23px',
                          left: '20px',
                          right: '20px',
                          height: '2px',
                          backgroundColor: '#e0e0e0',
                          zIndex: 0
                        }} />
                        
                        {/* Línea de progreso */}
                        {pasoActualIndex >= 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '23px',
                            left: '20px',
                            width: `${(pasoActualIndex / (pasos.length - 1)) * 100}%`,
                            height: '2px',
                            backgroundColor: '#4caf50',
                            zIndex: 1,
                            transition: 'width 0.3s ease'
                          }} />
                        )}
                        
                        {/* Pasos */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          position: 'relative',
                          zIndex: 2
                        }}>
                          {pasos.map((paso, index) => {
                            const isCompleted = pasoActualIndex >= 0 && index < pasoActualIndex;
                            const isCurrent = index === pasoActualIndex;

                            return (
                              <div 
                                key={index}
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center',
                                  flex: 1,
                                  maxWidth: '120px'
                                }}
                              >
                                {/* Círculo del paso */}
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: 
                                    isCompleted ? '#4caf50' :
                                    isCurrent ? '#626262' :
                                    '#e0e0e0',
                                  border: `2px solid ${
                                    isCompleted ? '#4caf50' :
                                    isCurrent ? '#626262' :
                                    '#e0e0e0'
                                  }`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isCompleted || isCurrent ? '#fff' : '#999',
                                  fontWeight: '600',
                                  fontSize: '0.75rem',
                                  transition: 'all 0.3s ease',
                                  boxShadow: isCurrent ? '0 2px 8px rgba(33, 150, 243, 0.3)' : 'none'
                                }}>
                                  {isCompleted ? '✓' : index + 1}
                                </div>
                                
                                {/* Texto del paso */}
                                <div style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.65rem',
                                  textAlign: 'center',
                                  color: isCurrent ? '#626262' : isCompleted ? '#4caf50' : '#999',
                                  fontWeight: isCurrent ? '600' : '400',
                                  lineHeight: '1.2',
                                  maxWidth: '100px'
                                }}>
                                  {paso}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Mensaje de estado actual */}
                      {pasoActualIndex >= 0 && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#f2f2f2',
                          borderRadius: '4px',
                          borderLeft: '3px solid #626262'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#4f4f4f' }}>
                            <strong>Estado actual:</strong> {pasos[pasoActualIndex]}
                          </p>
                        </div>
                      )}
                      
                      {pasoActualIndex < 0 && estadoContratacion && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#fff3e0',
                          borderRadius: '4px',
                          borderLeft: '3px solid #ff9800'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#e65100' }}>
                            <strong>Estado:</strong> {estadoContratacion} (no reconocido en el flujo)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Historial de actualizaciones */}
                    {(() => {
                      type HistorialEntry = { estado: string; fecha: string; observaciones: string; archivos: { nombre: string; link: string }[] };
                      const parseFecha = (f: string) => {
                        const clean = f.replace(',', '').trim();
                        const [datePart, timePart = '00:00'] = clean.split(/\s+/);
                        const [d, m, y] = datePart.split('/');
                        return new Date(`${y}-${m}-${d}T${timePart}`).getTime();
                      };
                      const historial = ([...(contratacionData?.historialEstados as HistorialEntry[] ?? [])])
                        .sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
                      const historialKey = contratacion.gid;
                      const historialExpanded = expandedHistoriales.has(historialKey);
                      const toggleHistorial = () => setExpandedHistoriales(prev => {
                        const next = new Set(prev);
                        next.has(historialKey) ? next.delete(historialKey) : next.add(historialKey);
                        return next;
                      });
                      return (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: historial.length > 0 ? 'pointer' : 'default', marginBottom: historialExpanded ? '0.5rem' : 0 }}
                            onClick={() => historial.length > 0 && toggleHistorial()}
                          >
                            {historial.length > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#888', transition: 'transform 0.2s', display: 'inline-block', transform: historialExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            )}
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                              📋 Historial de actualizaciones {historial.length > 0 ? `(${historial.length})` : ''}
                            </p>
                          </div>
                          {historialExpanded && historial.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {historial.map((entry, i) => (
                                <div key={i} style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', borderLeft: '3px solid #626262', fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (entry.observaciones || entry.archivos?.length > 0) ? '0.35rem' : 0 }}>
                                    <span style={{ fontWeight: 600, color: '#333' }}>{entry.estado}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ fontSize: '0.72rem', color: '#999' }}>👤 Administrador del sistema</span>
                                      <span style={{ fontSize: '0.72rem', color: '#ccc' }}>·</span>
                                      <span style={{ fontSize: '0.72rem', color: '#888' }}>{entry.fecha}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteHistorialEntry(contratacion, entry.fecha, entry.estado); }}
                                        title="Eliminar esta actualización"
                                        style={{ background: 'none', border: '1px solid #f5c6cb', borderRadius: '4px', padding: '0.15rem 0.35rem', cursor: 'pointer', color: '#c0392b', fontSize: '0.75rem', lineHeight: 1 }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#fdecea')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                      >🗑️</button>
                                    </div>
                                  </div>
                                  {entry.observaciones && (
                                    <p style={{ margin: '0 0 0.25rem', color: '#555', lineHeight: '1.4' }}>{entry.observaciones}</p>
                                  )}
                                  {entry.archivos?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                      {entry.archivos.map((archivo, j) => (
                                        <a
                                          key={j}
                                          href={archivo.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ fontSize: '0.72rem', color: '#1a73e8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
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
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>Sin actualizaciones aún.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4f4f4f' }}>
                <strong>ℹ️ Info:</strong> No hay contrataciones registradas para esta actividad. Use el botón "Solicitar Contratación" para crear una nueva.
              </p>
            </div>
          ))}
        </div>
      </div>

      {showMaterialModal && (
        <MaterialRequestModal
          task={task}
          onClose={() => setShowMaterialModal(false)}
          onSuccess={() => {
            setShowMaterialModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {showFundsModal && (
        <FundsRequestModal
          task={task}
          onClose={() => setShowFundsModal(false)}
          onSuccess={() => {
            setShowFundsModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {showReturnModal && (
        <MaterialReturnModal
          task={task}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {showVerificationModal && (
        <VerificationSourcesModal
          task={task}
          verificationSubtask={verificationSubtask}
          currentData={fuentesData}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => {
            setShowVerificationModal(false);
            window.location.reload();
          }}
        />
      )}

      {showContratacionModal && (
        <ContratacionModal
          task={task}
          onClose={() => setShowContratacionModal(false)}
          onSuccess={() => {
            setShowContratacionModal(false);
            window.location.reload();
          }}
        />
      )}

      {updateContratacion && (
        <ContratacionUpdateModal
          contratacion={updateContratacion.task}
          currentData={updateContratacion.data}
          onClose={() => setUpdateContratacion(null)}
          onSuccess={() => {
            setUpdateContratacion(null);
            onSubtaskCreated?.();
          }}
        />
      )}
    </>
  );
};

export default TaskInfo;
