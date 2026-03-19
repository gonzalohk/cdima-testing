import React from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF, exportMaterialRequestToPDF, exportMaterialReturnToPDF } from '../services/pdf.service';

interface RequestsTableProps {
  subtasks: AsanaTask[];
  onDeleted?: (taskGid: string) => void;
}

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

const RequestsTable: React.FC<RequestsTableProps> = ({ subtasks, onDeleted }) => {
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

  // Parsear información de solicitud de fondos desde las notas
  const parseFundsRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    // Extraer fecha de inicio
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    
    // Extraer fecha de finalización
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    // Extraer fondos solicitados
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
    
    return {
      taskName,
      area,
      lugar,
      fechaInicio,
      fechaFinalizacion,
      fondos
    };
  };

  // Parsear información de solicitud de material desde las notas
  const parseMaterialRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    // Extraer fecha de inicio
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    
    // Extraer fecha de finalización
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    // Extraer materiales solicitados
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
    
    return {
      taskName,
      area,
      lugar,
      fechaInicio,
      fechaFinalizacion,
      materiales
    };
  };

  // Parsear información de solicitud de devolución desde las notas
  const parseMaterialReturn = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar de devolución
    const lugarMatch = notes.match(/•\s*Lugar de devolución:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    // Extraer materiales a devolver
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
    
    return {
      taskName,
      area,
      lugar,
      materiales
    };
  };

  // Manejar clic en botón eliminar
  const handleDelete = async (task: AsanaTask) => {
    const confirmed = window.confirm(`¿Eliminar la solicitud "${task.name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await asanaService.deleteTask(task.gid);
      onDeleted?.(task.gid);
    } catch (err) {
      alert('Error al eliminar la solicitud. Por favor, intenta de nuevo.');
      console.error('Error deleting task:', err);
    }
  };

  // Manejar clic en botón imprimir
  const handlePrint = (task: AsanaTask) => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    const fechaGeneracion = extractFechaSolicitud(task.notes);
    
    if (tipoSolicitud === 'Solicitud de Fondos') {
      const data = parseFundsRequest(task);
      exportFundsRequestToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Material') {
      const data = parseMaterialRequest(task);
      exportMaterialRequestToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Devolucion') {
      const data = parseMaterialReturn(task);
      exportMaterialReturnToPDF({
        ...data,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    }
  };

  // Filtrar solo solicitudes de Fondos y Devolución
  const solicitudes = subtasks.filter(task => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    return tipoSolicitud === 'Solicitud de Fondos' || tipoSolicitud === 'Solicitud de Devolucion';
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
              <th style={{ minWidth: '140px' }}>Estado</th>
              <th style={{ minWidth: '120px', textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((task) => {
              const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
              const fechaGeneracion = extractFechaSolicitud(task.notes);
              const esFinalizada = task.completed;

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
                      {tipoSolicitud === 'Solicitud de Devolucion' ? 'Devolución de Material' : tipoSolicitud}
                    </span>
                  </td>
                  <td>{fechaGeneracion}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        backgroundColor: esFinalizada ? '#e8f5e9' : '#fff3e0',
                        color: esFinalizada ? '#2e7d32' : '#f57c00',
                        border: `1px solid ${esFinalizada ? '#81c784' : '#ffb74d'}`,
                      }}
                    >
                      {esFinalizada ? '✓ Finalizada' : '⏸ Pendiente'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => handlePrint(task)}
                        className="button-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        🖨️ Imprimir
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        title="Eliminar solicitud"
                        style={{
                          background: 'none',
                          border: '1px solid #f5c6cb',
                          borderRadius: '6px',
                          padding: '0.45rem 0.6rem',
                          cursor: 'pointer',
                          color: '#c0392b',
                          fontSize: '1rem',
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
    </div>
  );
};

export default RequestsTable;
