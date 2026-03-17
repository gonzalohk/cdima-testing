import React, { useState, useEffect } from 'react';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';

interface DiplomadoDetailsModalProps {
  diplomado: AsanaSection;
  projectGid: string;
  onClose: () => void;
  onRefresh: () => void;
}

const DiplomadoDetailsModal: React.FC<DiplomadoDetailsModalProps> = ({
  diplomado,
  projectGid: _projectGid,
  onClose,
  onRefresh: _onRefresh
}) => {
  const [loading, setLoading] = useState(false);
  const [_tareas, setTareas] = useState<AsanaTask[]>([]);
  const [docentes, setDocentes] = useState<AsanaTask[]>([]);
  const [estudiantes, setEstudiantes] = useState<AsanaTask[]>([]);
  const [documentos, setDocumentos] = useState<AsanaTask[]>([]);

  useEffect(() => {
    loadDiplomadoDetails();
  }, [diplomado]);

  const loadDiplomadoDetails = async () => {
    setLoading(true);
    try {
      // Obtener tareas de la sección
      const sectionTasks = await asanaService.getSectionTasks(diplomado.gid);
      setTareas(sectionTasks);

      // Buscar las tareas principales
      const tareaDocentes = sectionTasks.find(t => t.name === 'Docentes');
      const tareaEstudiantes = sectionTasks.find(t => t.name === 'Estudiantes');
      const tareaDocumentos = sectionTasks.find(t => t.name === 'Documentos');

      // Obtener subtareas de cada tarea
      if (tareaDocentes) {
        const subtasks = await asanaService.getSubtasks(tareaDocentes.gid);
        setDocentes(subtasks);
      }

      if (tareaEstudiantes) {
        const subtasks = await asanaService.getSubtasks(tareaEstudiantes.gid);
        setEstudiantes(subtasks);
      }

      if (tareaDocumentos) {
        const subtasks = await asanaService.getSubtasks(tareaDocumentos.gid);
        setDocumentos(subtasks);
      }
    } catch (err) {
      console.error('Error loading diplomado details:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderSubtasksList = (subtasks: AsanaTask[], emptyMessage: string) => {
    if (loading) {
      return <p style={{ color: '#666', fontStyle: 'italic' }}>Cargando...</p>;
    }

    if (subtasks.length === 0) {
      return <p style={{ color: '#999', fontStyle: 'italic' }}>{emptyMessage}</p>;
    }

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {subtasks.map((subtask) => (
          <li 
            key={subtask.gid}
            style={{
              padding: '0.75rem',
              marginBottom: '0.5rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              borderLeft: '3px solid #626262',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ 
              color: subtask.completed ? '#4caf50' : '#999',
              fontSize: '1rem'
            }}>
              {subtask.completed ? '✓' : '○'}
            </span>
            <span style={{ 
              flex: 1,
              textDecoration: subtask.completed ? 'line-through' : 'none',
              color: subtask.completed ? '#666' : '#333'
            }}>
              {subtask.name}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
              🎓 {diplomado.name}
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Detalles del diplomado
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Docentes */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👨‍🏫</span>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Docentes ({docentes.length})
              </h3>
            </div>
            {renderSubtasksList(docentes, 'No hay docentes registrados')}
          </div>

          {/* Estudiantes */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👨‍🎓</span>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Estudiantes ({estudiantes.length})
              </h3>
            </div>
            {renderSubtasksList(estudiantes, 'No hay estudiantes registrados')}
          </div>

          {/* Documentos */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <span style={{ fontSize: '1.5rem' }}>📄</span>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Documentos ({documentos.length})
              </h3>
            </div>
            {renderSubtasksList(documentos, 'No hay documentos registrados')}
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fff3e0', 
            borderRadius: '6px',
            borderLeft: '4px solid #ff9800',
            marginTop: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#e65100' }}>
              <strong>📌 Nota:</strong> Para agregar más docentes, estudiantes o documentos, 
              vaya a Asana y agregue subtareas a las tareas correspondientes dentro de este diplomado.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="button-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiplomadoDetailsModal;
