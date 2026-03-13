import React, { useState, useEffect } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { serializeEstudianteData, parseAsistenciaRecords, updateNotasWithAsistencia } from '../utils/asana-helpers';
import { validateData, EstudianteDataSchema, DocenteDataSchema } from '../schemas/diplomado.schemas';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';

interface EscuelaEditData {
  gid: string;
  nombre: string;
  tipoEscuela?: string;
  docentes: Array<PersonaData & { subtaskGid: string }>;
  estudiantes: Array<PersonaData & { subtaskGid: string }>;
  docentesTaskGid: string;
  estudiantesTaskGid: string;
}

interface CreateEscuelaModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
  editMode?: boolean;
  escuelaData?: EscuelaEditData;
}

interface PersonaData {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  documentoIdentidad: string;
  identidadCultural: string;
}

interface PersonaDataWithGid extends PersonaData {
  subtaskGid?: string;
}

const CreateEscuelaModal: React.FC<CreateEscuelaModalProps> = ({
  projectGid,
  onClose,
  onSuccess,
  editMode = false,
  escuelaData
}) => {
  const [nombreEscuela, setNombreEscuela] = useState('');
  const [tipoEscuela, setTipoEscuela] = useState('');
  const [docentes, setDocentes] = useState<PersonaDataWithGid[]>([{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
  const [estudiantes, setEstudiantes] = useState<PersonaDataWithGid[]>([{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cargar datos cuando está en modo edición
  useEffect(() => {
    if (editMode && escuelaData) {
      setNombreEscuela(escuelaData.nombre);
      setTipoEscuela(escuelaData.tipoEscuela || '');
      
      // Parsear nombres que vienen en formato "Nombre, Apellido Paterno, Apellido Materno"
      const parseNombreCompleto = (nombreCompleto: string) => {
        const partes = nombreCompleto.split(',').map(p => p.trim());
        return {
          nombre: partes[0] || '',
          apellidoPaterno: partes[1] || '',
          apellidoMaterno: partes[2] || ''
        };
      };
      
      const docentesParseados = escuelaData.docentes.map(d => {
        const nombreParts = parseNombreCompleto(d.nombre);
        return { ...d, ...nombreParts };
      });
      
      const estudiantesParseados = escuelaData.estudiantes.map(e => {
        const nombreParts = parseNombreCompleto(e.nombre);
        return { ...e, ...nombreParts };
      });
      
      setDocentes(docentesParseados.length > 0 ? docentesParseados : [{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
      setEstudiantes(estudiantesParseados.length > 0 ? estudiantesParseados : [{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
    }
  }, [editMode, escuelaData]);

  const handleAddDocente = () => {
    setDocentes([...docentes, { nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
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
    setEstudiantes([...estudiantes, { nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
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
      if (!nombreEscuela.trim()) {
        throw new Error('El nombre de la escuela es obligatorio');
      }

      if (!tipoEscuela.trim()) {
        throw new Error('El tipo de escuela es obligatorio');
      }

      const docentesValidos = docentes.filter(d => d.nombre.trim() && d.apellidoPaterno.trim() && d.apellidoMaterno.trim() && d.genero.trim());
      const estudiantesValidos = estudiantes.filter(e => e.nombre.trim() && e.apellidoPaterno.trim() && e.apellidoMaterno.trim() && e.genero.trim());

      if (docentesValidos.length === 0) {
        throw new Error('Debe agregar al menos un docente con nombre completo (nombre, apellido paterno, apellido materno) y género');
      }

      if (estudiantesValidos.length === 0) {
        throw new Error('Debe agregar al menos un estudiante con nombre completo (nombre, apellido paterno, apellido materno) y género');
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

      // Obtener workspace
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      
      if (!cdima) {
        throw new Error('No se encontró el workspace CDIMA');
      }

      if (editMode && escuelaData) {
        // MODO EDICIÓN
        // 1. Actualizar nombre de la escuela (sección)
        if (nombreEscuela !== escuelaData.nombre) {
          await asanaService.updateSection(escuelaData.gid, nombreEscuela);
        }

        // 2. Actualizar tipo de escuela en las notas de la tarea Docentes
        if (tipoEscuela !== escuelaData.tipoEscuela) {
          const tareaDocentes = await asanaService.getTask(escuelaData.docentesTaskGid);
          const notasActualizadas = tareaDocentes.notes
            ? tareaDocentes.notes.replace(
                new RegExp(`${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}:.*`),
                `${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`
              )
            : `Lista de docentes de la escuela\n\n${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`;
          
          await asanaService.updateTask(escuelaData.docentesTaskGid, {
            notes: notasActualizadas
          });
        }

        // 3. Actualizar docentes
        const docentesOriginales = escuelaData.docentes;
        const docentesActuales = docentesValidos;

        // Actualizar o crear docentes
        for (const docente of docentesActuales) {
          const validationResult = validateData(DocenteDataSchema, {
            genero: docente.genero,
            telefono: docente.telefono,
            especialidad: '',
            experiencia: ''
          });

          if (!validationResult.success) {
            const nombreCompleto = `${docente.nombre} ${docente.apellidoPaterno} ${docente.apellidoMaterno}`;
            console.warn(`Validación falló para docente ${nombreCompleto}:`, validationResult.error);
          }

          const notasDocente = serializeEstudianteData({
            genero: docente.genero,
            telefono: docente.telefono || '',
            lugarNacimiento: docente.lugarNacimiento || '',
            documentoIdentidad: docente.documentoIdentidad || '',
            identidadCultural: docente.identidadCultural || ''
          });

          if (docente.subtaskGid) {
            // Actualizar existente - PRESERVAR REGISTROS DE ASISTENCIA
            const nombreCompleto = `${docente.nombre}, ${docente.apellidoPaterno}, ${docente.apellidoMaterno}`;
            
            // Obtener la tarea actual para preservar los registros de asistencia
            const tareaActual = await asanaService.getTask(docente.subtaskGid);
            const registrosAsistenciaExistentes = parseAsistenciaRecords(tareaActual.notes);
            
            // Combinar nueva información primaria con registros de asistencia existentes
            const notasActualizadas = registrosAsistenciaExistentes.length > 0
              ? updateNotasWithAsistencia(notasDocente, registrosAsistenciaExistentes)
              : notasDocente;
            
            await asanaService.updateTask(docente.subtaskGid, {
              name: nombreCompleto,
              notes: notasActualizadas
            });
          } else {
            // Crear nuevo
            const nombreCompleto = `${docente.nombre}, ${docente.apellidoPaterno}, ${docente.apellidoMaterno}`;
            await asanaService.createSubtask(escuelaData.docentesTaskGid, cdima.gid, {
              name: nombreCompleto,
              notes: notasDocente
            });
          }
        }

        // Eliminar docentes que ya no están
        const gidasActuales = new Set(docentesActuales.map(d => d.subtaskGid).filter(Boolean));
        for (const original of docentesOriginales) {
          if (original.subtaskGid && !gidasActuales.has(original.subtaskGid)) {
            await asanaService.deleteTask(original.subtaskGid);
          }
        }

        // 4. Actualizar estudiantes
        const estudiantesOriginales = escuelaData.estudiantes;
        const estudiantesActuales = estudiantesValidos;

        // Actualizar o crear estudiantes
        for (const estudiante of estudiantesActuales) {
          const validationResult = validateData(EstudianteDataSchema, {
            genero: estudiante.genero,
            telefono: estudiante.telefono,
            lugarNacimiento: estudiante.lugarNacimiento,
            documentoIdentidad: estudiante.documentoIdentidad,
            identidadCultural: estudiante.identidadCultural
          });

          if (!validationResult.success) {
            const nombreCompleto = `${estudiante.nombre} ${estudiante.apellidoPaterno} ${estudiante.apellidoMaterno}`;
            console.warn(`Validación falló para estudiante ${nombreCompleto}:`, validationResult.error);
          }

          const notasEstudiante = serializeEstudianteData({
            genero: estudiante.genero,
            telefono: estudiante.telefono || '',
            lugarNacimiento: estudiante.lugarNacimiento || '',
            documentoIdentidad: estudiante.documentoIdentidad || '',
            identidadCultural: estudiante.identidadCultural || ''
          });

          if (estudiante.subtaskGid) {
            // Actualizar existente - PRESERVAR REGISTROS DE ASISTENCIA
            const nombreCompleto = `${estudiante.nombre}, ${estudiante.apellidoPaterno}, ${estudiante.apellidoMaterno}`;
            
            // Obtener la tarea actual para preservar los registros de asistencia
            const tareaActual = await asanaService.getTask(estudiante.subtaskGid);
            const registrosAsistenciaExistentes = parseAsistenciaRecords(tareaActual.notes);
            
            // Combinar nueva información primaria con registros de asistencia existentes
            const notasActualizadas = registrosAsistenciaExistentes.length > 0
              ? updateNotasWithAsistencia(notasEstudiante, registrosAsistenciaExistentes)
              : notasEstudiante;
            
            await asanaService.updateTask(estudiante.subtaskGid, {
              name: nombreCompleto,
              notes: notasActualizadas
            });
          } else {
            // Crear nuevo
            const nombreCompleto = `${estudiante.nombre}, ${estudiante.apellidoPaterno}, ${estudiante.apellidoMaterno}`;
            await asanaService.createSubtask(escuelaData.estudiantesTaskGid, cdima.gid, {
              name: nombreCompleto,
              notes: notasEstudiante
            });
          }
        }

        // Eliminar estudiantes que ya no están
        const gidasActualesEstudiantes = new Set(estudiantesActuales.map(e => e.subtaskGid).filter(Boolean));
        for (const original of estudiantesOriginales) {
          if (original.subtaskGid && !gidasActualesEstudiantes.has(original.subtaskGid)) {
            await asanaService.deleteTask(original.subtaskGid);
          }
        }

        setNotification({
          message: '¡Escuela actualizada exitosamente!',
          type: 'success'
        });
      } else {
        // MODO CREACIÓN
        // 1. Crear la sección (escuela)
        const seccion = await asanaService.createSection(projectGid, nombreEscuela);

        // 2. Crear las tres tareas principales
        const notasDocentes = `Lista de docentes de la escuela\n\n${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`;
        
        const tareaDocentes = await asanaService.createTask({
          name: 'Docentes',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: notasDocentes
        });

        const tareaEstudiantes = await asanaService.createTask({
          name: 'Estudiantes',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: 'Lista de estudiantes de la escuela'
        });

        const tareaDocumentos = await asanaService.createTask({
          name: 'Documentos',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: 'Documentos relacionados a la escuela'
        });

        // 3. Crear subtareas de docentes
        for (const docente of docentesValidos) {
          // Validar datos del docente
          const validationResult = validateData(DocenteDataSchema, {
            genero: docente.genero,
            telefono: docente.telefono,
            especialidad: '',
            experiencia: ''
          });

          if (!validationResult.success) {
            const nombreCompleto = `${docente.nombre} ${docente.apellidoPaterno} ${docente.apellidoMaterno}`;
            console.warn(`Validación falló para docente ${nombreCompleto}:`, validationResult.error);
          }

          // Usar el nuevo formato JSON estructurado
          const notasDocente = serializeEstudianteData({
            genero: docente.genero,
            telefono: docente.telefono || '',
            lugarNacimiento: docente.lugarNacimiento || '',
            documentoIdentidad: docente.documentoIdentidad || '',
            identidadCultural: docente.identidadCultural || ''
          });

          const nombreCompleto = `${docente.nombre}, ${docente.apellidoPaterno}, ${docente.apellidoMaterno}`;
          await asanaService.createSubtask(tareaDocentes.gid, cdima.gid, {
            name: nombreCompleto,
            notes: notasDocente
          });
        }

        // 4. Crear subtareas de estudiantes
        for (const estudiante of estudiantesValidos) {
          // Validar datos del estudiante
          const validationResult = validateData(EstudianteDataSchema, {
            genero: estudiante.genero,
            telefono: estudiante.telefono,
            lugarNacimiento: estudiante.lugarNacimiento,
            documentoIdentidad: estudiante.documentoIdentidad,
            identidadCultural: estudiante.identidadCultural
          });

          if (!validationResult.success) {
            const nombreCompleto = `${estudiante.nombre} ${estudiante.apellidoPaterno} ${estudiante.apellidoMaterno}`;
            console.warn(`Validación falló para estudiante ${nombreCompleto}:`, validationResult.error);
          }

          // Usar el nuevo formato JSON estructurado
          const notasEstudiante = serializeEstudianteData({
            genero: estudiante.genero,
            telefono: estudiante.telefono || '',
            lugarNacimiento: estudiante.lugarNacimiento || '',
            documentoIdentidad: estudiante.documentoIdentidad || '',
            identidadCultural: estudiante.identidadCultural || ''
          });

          const nombreCompleto = `${estudiante.nombre}, ${estudiante.apellidoPaterno}, ${estudiante.apellidoMaterno}`;
          await asanaService.createSubtask(tareaEstudiantes.gid, cdima.gid, {
            name: nombreCompleto,
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
          message: '¡Escuela creada exitosamente!',
          type: 'success'
        });
      }

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la escuela');
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
      <div className="modal-overlay">
        <div 
          className="modal-content" 
          onClick={(e) => e.stopPropagation()} 
          style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div className="modal-header">
            <h2>{editMode ? 'Editar Escuela' : 'Crear Nueva Escuela'}</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Nombre de la Escuela */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Nombre de la Escuela <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={nombreEscuela}
                  onChange={(e) => setNombreEscuela(e.target.value)}
                  placeholder="Ej: Escuela de Liderazgo Comunitario"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                />
              </div>

              {/* Tipo de Escuela */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Tipo de Escuela <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={tipoEscuela}
                  onChange={(e) => setTipoEscuela(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="Liderazgo Social">Liderazgo Social</option>
                  <option value="Liderazgo de Gestión">Liderazgo de Gestión</option>
                </select>
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
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Nombre <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={docente.nombre}
                          onChange={(e) => handleDocenteChange(index, 'nombre', e.target.value)}
                          placeholder="Ej: Gonzalo"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Apellido Paterno <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={docente.apellidoPaterno}
                          onChange={(e) => handleDocenteChange(index, 'apellidoPaterno', e.target.value)}
                          placeholder="Ej: Osco"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Apellido Materno <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={docente.apellidoMaterno}
                          onChange={(e) => handleDocenteChange(index, 'apellidoMaterno', e.target.value)}
                          placeholder="Ej: Hernandez"
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
                          Documento de Identidad <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={docente.documentoIdentidad}
                          onChange={(e) => handleDocenteChange(index, 'documentoIdentidad', e.target.value)}
                          placeholder="CI, DNI, Pasaporte"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Identidad Cultural
                        </label>
                        <input
                          type="text"
                          value={docente.identidadCultural}
                          onChange={(e) => handleDocenteChange(index, 'identidadCultural', e.target.value)}
                          placeholder="Ej: Quechua, Aymara, Guaraní, Mestizo, etc."
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
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Nombre <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.nombre}
                          onChange={(e) => handleEstudianteChange(index, 'nombre', e.target.value)}
                          placeholder="Ej: Gonzalo"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Apellido Paterno <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.apellidoPaterno}
                          onChange={(e) => handleEstudianteChange(index, 'apellidoPaterno', e.target.value)}
                          placeholder="Ej: Osco"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Apellido Materno <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.apellidoMaterno}
                          onChange={(e) => handleEstudianteChange(index, 'apellidoMaterno', e.target.value)}
                          placeholder="Ej: Hernandez"
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
                          Documento de Identidad <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.documentoIdentidad}
                          onChange={(e) => handleEstudianteChange(index, 'documentoIdentidad', e.target.value)}
                          placeholder="CI, DNI, Pasaporte"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                        />
                      </div>
                      
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Identidad Cultural
                        </label>
                        <input
                          type="text"
                          value={estudiante.identidadCultural}
                          onChange={(e) => handleEstudianteChange(index, 'identidadCultural', e.target.value)}
                          placeholder="Ej: Quechua, Aymara, Guaraní, Mestizo, etc."
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
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1565c0', marginBottom: '0.5rem' }}>
                  <strong>ℹ️ Nota:</strong> Se crearán automáticamente las tareas "Docentes", "Estudiantes" y "Documentos" 
                  con las subtareas correspondientes. Los documentos incluirán: Currícula, Informe y Otros.
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#1976d2' }}>
                  📝 El nombre completo se guardará en formato: <strong>Nombre, Apellido Paterno, Apellido Materno</strong>
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
                {loading ? (editMode ? 'Guardando...' : 'Creando...') : (editMode ? 'Guardar Cambios' : 'Crear Escuela')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateEscuelaModal;
