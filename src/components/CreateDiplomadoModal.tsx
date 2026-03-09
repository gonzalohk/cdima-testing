import React, { useState } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

interface CreateDiplomadoModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateDiplomadoModal: React.FC<CreateDiplomadoModalProps> = ({
  projectGid,
  onClose,
  onSuccess
}) => {
  const [nombreDiplomado, setNombreDiplomado] = useState('');
  const [docentes, setDocentes] = useState<string[]>(['']);
  const [estudiantes, setEstudiantes] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleAddDocente = () => {
    setDocentes([...docentes, '']);
  };

  const handleRemoveDocente = (index: number) => {
    if (docentes.length > 1) {
      setDocentes(docentes.filter((_, i) => i !== index));
    }
  };

  const handleDocenteChange = (index: number, value: string) => {
    const newDocentes = [...docentes];
    newDocentes[index] = value;
    setDocentes(newDocentes);
  };

  const handleAddEstudiante = () => {
    setEstudiantes([...estudiantes, '']);
  };

  const handleRemoveEstudiante = (index: number) => {
    if (estudiantes.length > 1) {
      setEstudiantes(estudiantes.filter((_, i) => i !== index));
    }
  };

  const handleEstudianteChange = (index: number, value: string) => {
    const newEstudiantes = [...estudiantes];
    newEstudiantes[index] = value;
    setEstudiantes(newEstudiantes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!nombreDiplomado.trim()) {
        throw new Error('El nombre del diplomado es obligatorio');
      }

      const docentesValidos = docentes.filter(d => d.trim());
      const estudiantesValidos = estudiantes.filter(e => e.trim());

      if (docentesValidos.length === 0) {
        throw new Error('Debe agregar al menos un docente');
      }

      if (estudiantesValidos.length === 0) {
        throw new Error('Debe agregar al menos un estudiante');
      }

      // 1. Crear la sección (diplomado)
      const seccion = await asanaService.createSection(projectGid, nombreDiplomado);

      // Obtener workspace
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      
      if (!cdima) {
        throw new Error('No se encontró el workspace CDIMA');
      }

      // 2. Crear las tres tareas principales
      const tareaDocentes = await asanaService.createTask({
        name: 'Docentes',
        projectGid: projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Lista de docentes del diplomado'
      });

      const tareaEstudiantes = await asanaService.createTask({
        name: 'Estudiantes',
        projectGid: projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Lista de estudiantes del diplomado'
      });

      const tareaDocumentos = await asanaService.createTask({
        name: 'Documentos',
        projectGid: projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Documentos relacionados al diplomado'
      });

      // 3. Crear subtareas de docentes
      for (const docente of docentesValidos) {
        await asanaService.createSubtask(tareaDocentes.gid, cdima.gid, {
          name: docente
        });
      }

      // 4. Crear subtareas de estudiantes
      for (const estudiante of estudiantesValidos) {
        await asanaService.createSubtask(tareaEstudiantes.gid, cdima.gid, {
          name: estudiante
        });
      }

      // 5. Crear subtareas de documentos
      const documentosTipo = ['Currícula', 'Informe', 'Otros'];
      for (const doc of documentosTipo) {
        await asanaService.createSubtask(tareaDocumentos.gid, cdima.gid, {
          name: doc
        });
      }

      setNotification({
        message: '¡Diplomado creado exitosamente!',
        type: 'success'
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el diplomado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className="modal-content" 
          onClick={(e) => e.stopPropagation()} 
          style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div className="modal-header">
            <h2>Crear Nuevo Diplomado</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Nombre del Diplomado */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Nombre del Diplomado <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={nombreDiplomado}
                  onChange={(e) => setNombreDiplomado(e.target.value)}
                  placeholder="Ej: Diplomado en Inteligencia Artificial"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                />
              </div>

              {/* Docentes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Docentes <span style={{ color: 'red' }}>*</span>
                </label>
                {docentes.map((docente, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={docente}
                      onChange={(e) => handleDocenteChange(index, e.target.value)}
                      placeholder={`Nombre del docente ${index + 1}`}
                      style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDocente(index)}
                      disabled={docentes.length === 1}
                      className="button-secondary"
                      style={{ padding: '0.75rem', minWidth: '40px' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddDocente}
                  className="button-secondary"
                  style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
                >
                  + Agregar Docente
                </button>
              </div>

              {/* Estudiantes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Estudiantes <span style={{ color: 'red' }}>*</span>
                </label>
                {estudiantes.map((estudiante, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={estudiante}
                      onChange={(e) => handleEstudianteChange(index, e.target.value)}
                      placeholder={`Nombre del estudiante ${index + 1}`}
                      style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEstudiante(index)}
                      disabled={estudiantes.length === 1}
                      className="button-secondary"
                      style={{ padding: '0.75rem', minWidth: '40px' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddEstudiante}
                  className="button-secondary"
                  style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
                >
                  + Agregar Estudiante
                </button>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1565c0' }}>
                  <strong>ℹ️ Nota:</strong> Se crearán automáticamente las tareas "Docentes", "Estudiantes" y "Documentos" 
                  con las subtareas correspondientes. Los documentos incluirán: Currícula, Informe y Otros.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="button-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={loading}
              >
                {loading ? 'Creando...' : 'Crear Diplomado'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateDiplomadoModal;
