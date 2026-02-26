import React from 'react';
import { AsanaTask } from '../types/asana.types';

interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount }) => {
  // Función auxiliar para obtener el valor de un campo personalizado
  const getCustomFieldValue = (fieldName: string): string => {
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

  return (
    <div className="card">
      <h2>Información de la Actividad</h2>
      <div className="task-info">
        <h3 style={{ marginTop: 0, color: '#333' }}>{task.name}</h3>
        
        <div className="task-info-grid">
          <div className="info-item">
            <span className="info-label">Estado</span>
            <span className="info-value">
              <span
                className={`status-badge ${
                  getCustomFieldValue('Estado') === 'EJECUTADO' ? 'status-completed' : 'status-pending'
                }`}
              >
                {getCustomFieldValue('Estado') === 'EJECUTADO' ? 'Completada' : getCustomFieldValue('Estado') === 'EN PROCESO' ? 'En Proceso' : 'Pendiente'}
              </span>
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Responsable</span>
            <span className="info-value">
              {task.assignee?.name || 'Sin asignar'}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Fecha de Vencimiento</span>
            <span className="info-value">
              {task.due_on || 'Sin fecha'}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Subtareas</span>
            <span className="info-value">{subtasksCount}</span>
          </div>

          {task.custom_fields && task.custom_fields.length > 0 && (
            <>
              <div className="info-item">
                <span className="info-label">Lugar</span>
                <span className="info-value">{getCustomFieldValue('Lugar')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Estado de Actividad</span>
                <span className="info-value">{getCustomFieldValue('Estado')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Mujeres</span>
                <span className="info-value">{getCustomFieldValue('Mujeres ')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Hombres</span>
                <span className="info-value">{getCustomFieldValue('Hombres')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Población Meta</span>
                <span className="info-value">{getCustomFieldValue('Población Meta')}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Responsable de Actividad</span>
                <span className="info-value">{getCustomFieldValue('Responsable de Actividad')}</span>
              </div>
            </>
          )}
        </div>

        {task.notes && (
          <div style={{ marginTop: '1rem' }}>
            <span className="info-label">Notas / Descripción</span>
            <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', color: '#495057' }}>
              {task.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskInfo;
