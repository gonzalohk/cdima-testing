import React from 'react';
import { AsanaTask } from '../types/asana.types';

interface RequestsTableProps {
  subtasks: AsanaTask[];
}

const RequestsTable: React.FC<RequestsTableProps> = ({ subtasks }) => {
  // Función auxiliar para obtener el valor de un campo personalizado
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    return '-';
  };

  // Extraer la fecha de generación de las notas
  const extractFechaSolicitud = (notes: string | undefined): string => {
    if (!notes) return '-';
    
    // Buscar el patrón "Fecha de solicitud: DD/MM/YYYY, HH:MM"
    const regex = /Fecha de solicitud:\s*(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2})/;
    const match = notes.match(regex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return '-';
  };

  // Filtrar solo las subtareas que tienen "Tipo de Solicitud"
  const solicitudes = subtasks.filter(task => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    return tipoSolicitud !== '-';
  });

  if (solicitudes.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem' }}>Solicitudes ({solicitudes.length})</h2>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '300px' }}>Nombre de la Solicitud</th>
              <th style={{ minWidth: '180px' }}>Tipo de Solicitud</th>
              <th style={{ minWidth: '160px' }}>Fecha de Generación</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((task) => {
              const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
              const fechaGeneracion = extractFechaSolicitud(task.notes);

              return (
                <tr key={task.gid}>
                  <td>{task.name}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        backgroundColor: tipoSolicitud === 'Solicitud de Fondos' ? '#e3f2fd' : '#fff3e0',
                        color: tipoSolicitud === 'Solicitud de Fondos' ? '#1976d2' : '#f57c00',
                        border: `1px solid ${tipoSolicitud === 'Solicitud de Fondos' ? '#90caf9' : '#ffb74d'}`,
                      }}
                    >
                      {tipoSolicitud}
                    </span>
                  </td>
                  <td>{fechaGeneracion}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RequestsTable;
