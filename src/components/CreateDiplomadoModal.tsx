import React, { useState } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

interface CreateDiplomadoModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PersonaData {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  documentoIdentidad: string;
}

const CreateDiplomadoModal: React.FC<CreateDiplomadoModalProps> = ({
  projectGid,
  onClose,
  onSuccess
}) => {
  const [nombreDiplomado, setNombreDiplomado] = useState('');
  const [docentes, setDocentes] = useState<PersonaData[]>([{ nombre: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '' }]);
  const [estudiantes, setEstudiantes] = useState<PersonaData[]>([{ nombre: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleAddDocente = () => {
    setDocentes([...docentes, { nombre: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '' }]);
  };

  const handleRemoveDocente = (index: number) => {
    if (docentes.length > 1) {
      setDocentes(docentes.filter((_, i) => i !== index));
    }
  };

  const handleDocenteChange = (index: number, field: keyof PersonaData, value: string) => {
    const newDocentes = [...docentes];
    newDocentes[index][field] = value;
    setDocentes(newDocentes);
  };

  const handleAddEstudiante = () => {
    setEstudiantes([...estudiantes, { nombre: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '' }]);
  };

  const handleRemoveEstudiante = (index: number) => {
    if (estudiantes.length > 1) {
      setEstudiantes(estudiantes.filter((_, i) => i !== index));
    }
  };

  const handleEstudianteChange = (index: number, field: keyof PersonaData, value: string) => {
    const newEstudiantes = [...estudiantes];
    newEstudiantes[index][field] = value;
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

      const docentesValidos = docentes.filter(d => d.nombre.trim() && d.genero.trim());
      const estudiantesValidos = estudiantes.filter(e => e.nombre.trim() && e.genero.trim());

      if (docentesValidos.length === 0) {
        throw new Error('Debe agregar al menos un docente con nombre y género');
      }

      if (estudiantesValidos.length === 0) {
        throw new Error('Debe agregar al menos un estudiante con nombre y género');
      }

      // Validar que todos los docentes y estudiantes válidos tengan género
      const docenteSinGenero = docentesValidos.find(d => !d.genero.trim());
      if (docenteSinGenero) {
        throw new Error('El género es obligatorio para todos los docentes');
      }

      const estudianteSinGenero = estudiantesValidos.find(e => !e.genero.trim());
      if (estudianteSinGenero) {
        throw new Error('El género es obligatorio para todos los estudiantes');
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
        const notasDocente = `INFORMACIÓN PRIMARIA:
Género: ${docente.genero}
Teléfono: ${docente.telefono || 'No especificado'}
Lugar de Nacimiento: ${docente.lugarNacimiento || 'No especificado'}
Documento de Identidad: ${docente.documentoIdentidad || 'No especificado'}`;

        await asanaService.createSubtask(tareaDocentes.gid, cdima.gid, {
          name: docente.nombre,
          notes: notasDocente
        });
      }

      // 4. Crear subtareas de estudiantes
      for (const estudiante of estudiantesValidos) {
        const notasEstudiante = `INFORMACIÓN PRIMARIA:
Género: ${estudiante.genero}
Teléfono: ${estudiante.telefono || 'No especificado'}
Lugar de Nacimiento: ${estudiante.lugarNacimiento || 'No especificado'}
Documento de Identidad: ${estudiante.documentoIdentidad || 'No especificado'}`;

        await asanaService.createSubtask(tareaEstudiantes.gid, cdima.gid, {
          name: estudiante.nombre,
          notes: notasEstudiante
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
                  <div key={index} style={{ 
                    padding: '1rem', 
                    marginBottom: '1rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#666' }}>
                        Docente {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocente(index)}
                        disabled={docentes.length === 1}
                        className="button-secondary"
                        style={{ marginLeft: 'auto', padding: '0.5rem', minWidth: '35px', fontSize: '0.9rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Nombre <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={docente.nombre}
                          onChange={(e) => handleDocenteChange(index, 'nombre', e.target.value)}
                          placeholder="Nombre completo"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Género <span style={{ color: 'red' }}>*</span>
                        </label>
                        <select
                          value={docente.genero}
                          onChange={(e) => handleDocenteChange(index, 'genero', e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        >
                          <option value="">Seleccione...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={docente.telefono}
                          onChange={(e) => handleDocenteChange(index, 'telefono', e.target.value)}
                          placeholder="Número de teléfono"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Lugar de Nacimiento
                        </label>
                        <input
                          type="text"
                          value={docente.lugarNacimiento}
                          onChange={(e) => handleDocenteChange(index, 'lugarNacimiento', e.target.value)}
                          placeholder="Ciudad, País"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Documento de Identidad
                        </label>
                        <input
                          type="text"
                          value={docente.documentoIdentidad}
                          onChange={(e) => handleDocenteChange(index, 'documentoIdentidad', e.target.value)}
                          placeholder="CI, DNI, Pasaporte"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddDocente}
                  className="button-secondary"
                  style={{ fontSize: '0.9rem' }}
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
                  <div key={index} style={{ 
                    padding: '1rem', 
                    marginBottom: '1rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#666' }}>
                        Estudiante {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEstudiante(index)}
                        disabled={estudiantes.length === 1}
                        className="button-secondary"
                        style={{ marginLeft: 'auto', padding: '0.5rem', minWidth: '35px', fontSize: '0.9rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Nombre <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.nombre}
                          onChange={(e) => handleEstudianteChange(index, 'nombre', e.target.value)}
                          placeholder="Nombre completo"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Género <span style={{ color: 'red' }}>*</span>
                        </label>
                        <select
                          value={estudiante.genero}
                          onChange={(e) => handleEstudianteChange(index, 'genero', e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        >
                          <option value="">Seleccione...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={estudiante.telefono}
                          onChange={(e) => handleEstudianteChange(index, 'telefono', e.target.value)}
                          placeholder="Número de teléfono"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Lugar de Nacimiento
                        </label>
                        <input
                          type="text"
                          value={estudiante.lugarNacimiento}
                          onChange={(e) => handleEstudianteChange(index, 'lugarNacimiento', e.target.value)}
                          placeholder="Ciudad, País"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Documento de Identidad
                        </label>
                        <input
                          type="text"
                          value={estudiante.documentoIdentidad}
                          onChange={(e) => handleEstudianteChange(index, 'documentoIdentidad', e.target.value)}
                          placeholder="CI, DNI, Pasaporte"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddEstudiante}
                  className="button-secondary"
                  style={{ fontSize: '0.9rem' }}
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
