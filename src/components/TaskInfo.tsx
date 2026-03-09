import React, { useState, useEffect } from 'react';
import { AsanaTask, AsanaAttachment } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import MaterialRequestModal from './MaterialRequestModal';
import FundsRequestModal from './FundsRequestModal';
import MaterialReturnModal from './MaterialReturnModal';
import VerificationSourcesModal from './VerificationSourcesModal';

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
  const [verificationAttachments, setVerificationAttachments] = useState<AsanaAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

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

  // Verificar si existe una subtarea de SOLICITUD DE MATERIAL completada
  const hasMaterialRequestCompleted = () => {
    return subtasks.some(subtask => {
      const isMaterialRequest = subtask.name.startsWith('SOLICITUD DE MATERIAL');
      if (!isMaterialRequest) return false;
      
      // Verificar si está completada usando el campo Estado
      const estadoField = subtask.custom_fields?.find(f => f.name === 'Estado');
      const isCompleted = estadoField?.enum_value?.name === 'EJECUTADO';
      
      return isCompleted;
    });
  };

  const isFundsButtonEnabled = hasMaterialRequestCompleted();

  // Calcular valores agregados de las subtareas
  const calculateAggregatedValues = () => {
    let totalMujeres = 0;
    let totalHombres = 0;
    let totalPoblacionMeta = 0;

    subtasks.forEach(subtask => {
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              disabled={!isFundsButtonEnabled}
              title={!isFundsButtonEnabled ? 'Debe completar una solicitud de material primero' : ''}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#333' }}>
              📂 Fuentes de Verificación
            </h3>
            <button
              onClick={() => setShowVerificationModal(true)}
              className="button-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              disabled={!!verificationSubtask}
              title={verificationSubtask ? 'La subtarea ya existe' : 'Crear subtarea de fuentes de verificación'}
            >
              {verificationSubtask ? '✓ Subtarea Creada' : '+ Crear Subtarea'}
            </button>
          </div>

          {verificationSubtask ? (
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
                        border: '1px solid #2196F3',
                        color: '#2196F3',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2196F3';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.color = '#2196F3';
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
            <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1565c0' }}>
                <strong>ℹ️ Info:</strong> Cree la subtarea "FUENTES DE VERIFICACION" para poder adjuntar documentos, imágenes y enlaces de Google Drive.
              </p>
            </div>
          )}
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
    </>
  );
};

export default TaskInfo;
