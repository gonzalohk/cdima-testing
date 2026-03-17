import React, { useState, useEffect } from 'react';
import { AsanaTask, AsanaAttachment } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF, exportMaterialRequestToPDF, exportMaterialReturnToPDF } from '../services/pdf.service';
import MaterialRequestModal from './MaterialRequestModal';
import FundsRequestModal from './FundsRequestModal';
import MaterialReturnModal from './MaterialReturnModal';
import VerificationSourcesModal from './VerificationSourcesModal';
import ContratacionModal from './ContratacionModal';

interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
  subtasks: AsanaTask[];
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount, subtasks }) => {
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showContratacionModal, setShowContratacionModal] = useState(false);
  const [verificationAttachments, setVerificationAttachments] = useState<AsanaAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [contratacionesAttachments, setContratacionesAttachments] = useState<Map<string, AsanaAttachment[]>>(new Map());
  
  // Estados para expandir/colapsar secciones (por defecto colapsadas)
  const [showFuentesVerificacion, setShowFuentesVerificacion] = useState(false);
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [showContrataciones, setShowContrataciones] = useState(false);

  // Buscar la subtarea "FUENTES DE VERIFICACION"
  const verificationSubtask = subtasks.find(
    subtask => subtask.name.startsWith('FUENTES DE VERIFICACION')
  );

  // Cargar attachments de la subtarea de verificación
  useEffect(() => {
    const loadVerificationAttachments = async () => {
      if (verificationSubtask) {
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
  }, [verificationSubtask]);

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

  // Extraer la fecha de generación de las notas
  const extractFechaSolicitud = (notes: string | undefined): string => {
    if (!notes) return '-';
    const regex = /Fecha de solicitud:\s*(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2})/;
    const match = notes.match(regex);
    return match && match[1] ? match[1] : '-';
  };

  // Parsear información de solicitud de fondos
  const parseFundsRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    const fondos: FundItem[] = [];
    const fondosSection = notes.match(/FONDOS SOLICITADOS:\s*([\s\S]+?)(?=\n\nTOTAL:|\n\n---)/);
    
    if (fondosSection) {
      const fondosText = fondosSection[1];
      const fondosItems = fondosText.split(/\n\n(?=\d+\.)/);
      
      fondosItems.forEach((item, index) => {
        const descMatch = item.match(/\d+\.\s*(.+)/);
        const importeMatch = item.match(/Importe:\s*Bs\.\s*([\d.]+)/);
        
        if (descMatch) {
          fondos.push({
            id: index + 1,
            descripcion: descMatch[1].trim(),
            importeBolivianos: importeMatch ? importeMatch[1] : '0'
          });
        }
      });
    }
    
    return { taskName, area, lugar, fechaInicio, fechaFinalizacion, fondos };
  };

  // Parsear información de solicitud de material
  const parseMaterialRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    const materiales: MaterialItem[] = [];
    const materialesSection = notes.match(/MATERIALES SOLICITADOS:\s*([\s\S]+?)(?=\n\n---)/);
    
    if (materialesSection) {
      const materialesText = materialesSection[1];
      const materialesItems = materialesText.split(/\n\n(?=\d+\.)/);
      
      materialesItems.forEach((item, index) => {
        const detalleMatch = item.match(/\d+\.\s*(.+)/);
        const cantidadMatch = item.match(/Cantidad:\s*(.+)/);
        const unidadMatch = item.match(/Unidad:\s*(.+)/);
        const observacionesMatch = item.match(/Observaciones:\s*(.+)/);
        
        if (detalleMatch) {
          materiales.push({
            id: index + 1,
            detalle: detalleMatch[1].trim(),
            cantidad: cantidadMatch ? cantidadMatch[1].trim() : '-',
            unidad: unidadMatch ? unidadMatch[1].trim() : '-',
            observaciones: observacionesMatch ? observacionesMatch[1].trim() : '-'
          });
        }
      });
    }
    
    return { taskName, area, lugar, fechaInicio, fechaFinalizacion, materiales };
  };

  // Parsear información de solicitud de devolución
  const parseMaterialReturn = (task: AsanaTask) => {
    const notes = task.notes || '';
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    const lugarMatch = notes.match(/•\s*Lugar de devolución:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    const materiales: MaterialItem[] = [];
    const materialesSection = notes.match(/MATERIALES A DEVOLVER:\s*([\s\S]+?)(?=\n\n---)/);
    
    if (materialesSection) {
      const materialesText = materialesSection[1];
      const materialesItems = materialesText.split(/\n\n(?=\d+\.)/);
      
      materialesItems.forEach((item, index) => {
        const detalleMatch = item.match(/\d+\.\s*(.+)/);
        const cantidadMatch = item.match(/Cantidad:\s*(.+)/);
        const unidadMatch = item.match(/Unidad:\s*(.+)/);
        const observacionesMatch = item.match(/Observaciones:\s*(.+)/);
        
        if (detalleMatch) {
          materiales.push({
            id: index + 1,
            detalle: detalleMatch[1].trim(),
            cantidad: cantidadMatch ? cantidadMatch[1].trim() : '-',
            unidad: unidadMatch ? unidadMatch[1].trim() : '-',
            observaciones: observacionesMatch ? observacionesMatch[1].trim() : '-'
          });
        }
      });
    }
    
    return { taskName, area, lugar, materiales };
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

  // Filtrar solicitudes de las subtareas
  const solicitudes = subtasks.filter(taskItem => {
    const tipoSolicitud = getCustomFieldValue(taskItem, 'Tipo de Solicitud');
    return tipoSolicitud !== '-';
  });

  // Filtrar contrataciones de las subtareas
  const contrataciones = subtasks.filter(taskItem => {
    return taskItem.name.startsWith('CONTRATACION - ');
  });

  // Cargar attachments de las contrataciones
  useEffect(() => {
    const loadContratacionesAttachments = async () => {
      if (contrataciones.length > 0) {
        const newAttachments = new Map<string, AsanaAttachment[]>();
        
        for (const contratacion of contrataciones) {
          try {
            const attachments = await asanaService.getTaskAttachments(contratacion.gid);
            newAttachments.set(contratacion.gid, attachments);
          } catch (error) {
            console.error(`Error al cargar attachments de contratación ${contratacion.gid}:`, error);
            newAttachments.set(contratacion.gid, []);
          }
        }
        
        setContratacionesAttachments(newAttachments);
      }
    };

    loadContratacionesAttachments();
  }, [contrataciones.length]);

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
              🔄 Solicitud de Devolución
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
              disabled={!!verificationSubtask}
              title={verificationSubtask ? 'La subtactividad ya existe' : 'Crear subtactividad de fuentes de verificación'}
            >
              {verificationSubtask ? '✓ Subtactividad Creada' : '+ Crear Subactividad'}
            </button>
          </div>

          {showFuentesVerificacion && (verificationSubtask ? (
            <div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#666' }}>
                {loadingAttachments ? (
                  'Cargando recursos...'
                ) : verificationAttachments.length > 0 ? (
                  `${verificationAttachments.length} ${verificationAttachments.length === 1 ? 'recurso adjunto' : 'recursos adjuntos'}`
                ) : (
                  'No hay recursos adjuntos. Agregue archivos en Asana.'
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

              {!loadingAttachments && verificationAttachments.length === 0 && (
                <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', borderLeft: '4px solid #ff9800' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#e65100' }}>
                    <strong>📌 Instrucción:</strong> Vaya a Asana y adjunte archivos a la subtarea "{verificationSubtask.name}" para que aparezcan aquí.
                  </p>
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
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Fecha</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((solicitud) => {
                    const tipoSolicitud = getCustomFieldValue(solicitud, 'Tipo de Solicitud');
                    const fechaGeneracion = extractFechaSolicitud(solicitud.notes);
                    const esFinalizada = solicitud.completed;

                    return (
                      <tr key={solicitud.gid} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {solicitud.name}
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
                             tipoSolicitud === 'Solicitud de Devolucion' ? '🔄 Devolución' : 
                             '📋 Material'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#666' }}>{fechaGeneracion}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: esFinalizada ? '#e8f5e9' : '#fff3e0',
                              color: esFinalizada ? '#2e7d32' : '#f57c00',
                              border: `1px solid ${esFinalizada ? '#81c784' : '#ffb74d'}`,
                            }}
                          >
                            {esFinalizada ? '✓ Finalizada' : '⏸ Pendiente'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handlePrintRequest(solicitud)}
                            className="button-primary"
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            🖨️ Imprimir
                          </button>
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
                const estadoContratacion = getCustomFieldValue(contratacion, 'Estado de Contratación');
                const attachments = contratacionesAttachments.get(contratacion.gid) || [];
                const nombreContratacion = contratacion.name.replace('CONTRATACION - ', '');

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
                      <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>
                        {nombreContratacion}
                      </h4>
                      
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

                    {attachments.length > 0 ? (
                      <div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#666', fontWeight: 500 }}>
                          📎 Archivos adjuntos ({attachments.length})
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {attachments.map((attachment) => (
                            <a
                              key={attachment.gid}
                              href={attachment.view_url || attachment.download_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                backgroundColor: '#fff',
                                border: '1px solid #626262',
                                color: '#626262',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title={attachment.name}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#626262';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
                                e.currentTarget.style.color = '#626262';
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {attachment.name}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                          Sin archivos adjuntos. Agregue documentos en Asana.
                        </p>
                      </div>
                    )}
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
          }}
        />
      )}

      {showFundsModal && (
        <FundsRequestModal
          task={task}
          onClose={() => setShowFundsModal(false)}
          onSuccess={() => {
            setShowFundsModal(false);
          }}
        />
      )}

      {showReturnModal && (
        <MaterialReturnModal
          task={task}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
          }}
        />
      )}

      {showVerificationModal && (
        <VerificationSourcesModal
          task={task}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => {
            setShowVerificationModal(false);
            // Recargar la página o actualizar las subtareas para mostrar la nueva subtarea
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
            // Recargar la página para mostrar la nueva contratación
            window.location.reload();
          }}
        />
      )}
    </>
  );
};

export default TaskInfo;
