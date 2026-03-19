import React from 'react';
import { AsanaTask } from '../types/asana.types';

interface SubtasksTableProps {
  filteredSubtasks: AsanaTask[];
  uniqueLugares: string[];
  uniqueResponsables: string[];
  searchTerm: string;
  statusFilter: string;
  lugarFilter: string;
  responsableFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onLugarFilterChange: (value: string) => void;
  onResponsableFilterChange: (value: string) => void;
  onExportPDF: () => void;
  onExportWord?: () => void;
}

const SubtasksTable: React.FC<SubtasksTableProps> = ({
  filteredSubtasks,
  uniqueLugares,
  uniqueResponsables,
  searchTerm,
  statusFilter,
  lugarFilter,
  responsableFilter,
  onSearchChange,
  onStatusFilterChange,
  onLugarFilterChange,
  onResponsableFilterChange,
  onExportPDF,
  onExportWord,
}) => {
  // Función auxiliar para obtener el valor de un campo personalizado
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

  // Filtrar las subtareas que NO tienen "Tipo de Solicitud" y que NO son FUENTES DE VERIFICACION
  const subtasksWithoutRequests = filteredSubtasks.filter(task => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    const isFuentesVerificacion = task.name.startsWith('FUENTES DE VERIFICACION');
    return tipoSolicitud === '-' && !isFuentesVerificacion;
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Sub Actividades ({subtasksWithoutRequests.length})</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onExportWord && (
            <button onClick={onExportWord} className="btn-export" title="Exportar a Word">📄</button>
          )}
          <button onClick={onExportPDF} className="btn-export" title="Exportar a PDF">🖨️</button>
        </div>
      </div>

      <div className="search-filter">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Todos los estados</option>
          <option value="completed">Completadas</option>
          <option value="pending">Pendientes</option>
        </select>

        <select
          value={lugarFilter}
          onChange={(e) => onLugarFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Todos los lugares</option>
          {uniqueLugares.map((lugar) => (
            <option key={lugar} value={lugar}>
              {lugar}
            </option>
          ))}
        </select>

        <select
          value={responsableFilter}
          onChange={(e) => onResponsableFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Todos los responsables</option>
          {uniqueResponsables.map((responsable) => (
            <option key={responsable} value={responsable}>
              {responsable}
            </option>
          ))}
        </select>
      </div>

      {subtasksWithoutRequests.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron sub actividades</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: '200px' }}>Nombre</th>
                <th style={{ minWidth: '300px' }}>Descripción</th>
                <th style={{ minWidth: '120px' }}>Vencimiento</th>
                <th style={{ minWidth: '120px' }}>Lugar</th>
                <th style={{ minWidth: '100px' }}>Estado</th>
                <th style={{ minWidth: '100px' }}>Población Meta</th>
                <th style={{ minWidth: '150px' }}>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {subtasksWithoutRequests.map((task) => {
                return (
                  <tr key={task.gid}>
                    <td>{task.name}</td>
                    <td style={{ 
                      maxWidth: '400px', 
                      whiteSpace: 'normal', 
                      wordWrap: 'break-word',
                      fontSize: '0.9rem',
                      color: '#555'
                    }}>
                      {task.notes || '-'}
                    </td>
                    <td>{task.due_on || 'Sin fecha'}</td>
                    <td>{getCustomFieldValue(task, 'Lugar')}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          getCustomFieldValue(task, 'Estado') === 'EJECUTADO' ? 'status-completed' : 'status-pending'
                        }`}
                      >
                        {getCustomFieldValue(task, 'Estado') === 'EJECUTADO' ? 'Completada' : getCustomFieldValue(task, 'Estado') === 'EN PROCESO' ? 'En Proceso' : 'Pendiente'}
                      </span>
                    </td>
                    <td>{getCustomFieldValue(task, 'Población Meta')}</td>
                    <td>{getCustomFieldValue(task, 'Responsable de Actividad')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubtasksTable;
