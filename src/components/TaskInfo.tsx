import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import MaterialRequestModal from './MaterialRequestModal';
import FundsRequestModal from './FundsRequestModal';

interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
  subtasks: AsanaTask[];
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount, subtasks }) => {
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);

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
          </div>
        </div>

        {/* Nombre de la actividad destacado */}
        <div className="activity-header">
          <h3 className="activity-title">{task.name}</h3>
        </div>

        {/* Sección: Información General */}
        <div className="info-section">
          <h4 className="section-title">📋 Información General</h4>
          <div className="info-grid-section">
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
              <span className="info-value">
                {task.due_on || 'Sin fecha'}
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">Sub Actividades</span>
              <span className="info-value info-value-highlight">{subtasksCount}</span>
            </div>
          </div>
        </div>

        {task.custom_fields && task.custom_fields.length > 0 && (
          <>
            {/* Sección: Ubicación y Responsabilidad */}
            <div className="info-section">
              <h4 className="section-title">📍 Ubicación y Responsabilidad</h4>
              <div className="info-grid-section">
                <div className="info-item">
                  <span className="info-label">Lugar</span>
                  <span className="info-value">{getMainTaskFieldValue('Lugar')}</span>
                </div>

                <div className="info-item">
                  <span className="info-label">Responsable de Actividad</span>
                  <span className="info-value">{getMainTaskFieldValue('Responsable de Actividad')}</span>
                </div>
              </div>
            </div>

            {/* Sección: Impacto - Beneficiarios */}
            <div className="info-section info-section-highlighted">
              <h4 className="section-title">👥 Impacto: Beneficiarios</h4>
              <div className="info-grid-beneficiaries">
                <div className="info-item-beneficiary">
                  <span className="info-label">Mujeres</span>
                  <span className="info-value-large">{aggregatedValues.mujeres}</span>
                </div>

                <div className="info-item-beneficiary">
                  <span className="info-label">Hombres</span>
                  <span className="info-value-large">{aggregatedValues.hombres}</span>
                </div>

                <div className="info-item-beneficiary info-item-total">
                  <span className="info-label">Total</span>
                  <span className="info-value-large">{aggregatedValues.total}</span>
                </div>

                <div className="info-item-beneficiary">
                  <span className="info-label">Población Meta</span>
                  <span className="info-value-large">{aggregatedValues.poblacionMeta}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sección: Descripción/Notas */}
        {task.notes && (
          <div className="info-section">
            <h4 className="section-title">📝 Descripción</h4>
            <div className="notes-content">
              {task.notes}
            </div>
          </div>
        )}
      </div>

      {showMaterialModal && (
        <MaterialRequestModal
          task={task}
          onClose={() => setShowMaterialModal(false)}
          onSuccess={() => {
            setShowMaterialModal(false);
            // El padre debería manejar el refresh de las subtareas
            window.location.reload(); // Solución temporal, idealmente pasaríamos un callback
          }}
        />
      )}

      {showFundsModal && (
        <FundsRequestModal
          task={task}
          onClose={() => setShowFundsModal(false)}
          onSuccess={() => {
            setShowFundsModal(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
};

export default TaskInfo;
