import React, { useState, useEffect } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { serializeEstudianteData, parseAsistenciaRecords, updateNotasWithAsistencia } from '../utils/asana-helpers';
import { validateData, EstudianteDataSchema } from '../schemas/diplomado.schemas';
import { HtmlModalHeader } from './ModalShared';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';

interface EscuelaEditData {
  gid: string;
  nombre: string;
  tipoEscuela?: string;
  estudiantes: Array<PersonaData & { subtaskGid: string }>;
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
  fechaNacimiento: string;
  cargo: string;
  domicilio: string;
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
  const [estudiantes, setEstudiantes] = useState<PersonaDataWithGid[]>([{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', fechaNacimiento: '', cargo: '', domicilio: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
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
      
      const estudiantesParseados = escuelaData.estudiantes.map(e => {
        const nombreParts = parseNombreCompleto(e.nombre);
        return { ...e, ...nombreParts };
      });

      setEstudiantes(estudiantesParseados.length > 0 ? estudiantesParseados : [{ nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', fechaNacimiento: '', cargo: '', domicilio: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
    }
  }, [editMode, escuelaData]);

  const handleAddEstudiante = () => {
    setEstudiantes([...estudiantes, { nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: '', fechaNacimiento: '', cargo: '', domicilio: '', telefono: '', lugarNacimiento: '', documentoIdentidad: '', identidadCultural: '' }]);
  };

  const handleRemoveEstudiante = (index: number) => {
    if (estudiantes.length <= 1) return;

    const estudiante = estudiantes[index];
    const nombre = [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim() || `Estudiante ${index + 1}`;

    const mensaje = estudiante.subtaskGid
      ? `⚠️ Esta acción eliminará permanentemente a "${nombre}" de Asana.\n\n¿Deseas continuar?`
      : `¿Deseas eliminar a "${nombre}" de la lista?`;

    if (!window.confirm(mensaje)) return;

    setEstudiantes(estudiantes.filter((_, i) => i !== index));
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

      const estudiantesValidos = editMode
        ? estudiantes.filter(e => e.nombre.trim() && e.apellidoPaterno.trim() && e.genero.trim())
        : [];

      if (editMode && estudiantesValidos.length === 0) {
        throw new Error('Debe agregar al menos un estudiante con nombre completo (nombre y apellido paterno) y género');
      }

      if (editMode) {
        const estudianteSinGenero = estudiantesValidos.find(e => !e.genero.trim());
        if (estudianteSinGenero) {
          throw new Error('El género es obligatorio para todos los estudiantes');
        }
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

        // 2. Actualizar tipo de escuela en las notas de la tarea Estudiantes
        if (tipoEscuela !== escuelaData.tipoEscuela) {
          const tareaEstudiantes = await asanaService.getTask(escuelaData.estudiantesTaskGid);
          const notasActualizadas = tareaEstudiantes.notes
            ? tareaEstudiantes.notes.replace(
                new RegExp(`${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}:.*`),
                `${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`
              )
            : `Lista de estudiantes de la escuela\n\n${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`;
          
          await asanaService.updateTask(escuelaData.estudiantesTaskGid, {
            notes: notasActualizadas
          });
        }

        // 3. Actualizar estudiantes
        const estudiantesOriginales = escuelaData.estudiantes;
        const estudiantesActuales = estudiantesValidos;

        // Actualizar o crear estudiantes en paralelo
        await Promise.all(estudiantesActuales.map(async (estudiante) => {
          const validationResult = validateData(EstudianteDataSchema, {
            genero: estudiante.genero,
            telefono: estudiante.telefono,
            lugarNacimiento: estudiante.lugarNacimiento,
            fechaNacimiento: estudiante.fechaNacimiento,
            domicilio: estudiante.domicilio,
            especialidad: estudiante.cargo,
            documentoIdentidad: estudiante.documentoIdentidad,
            identidadCultural: estudiante.identidadCultural
          });

          if (!validationResult.success) {
            const nombreCompleto = [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(' ');
            throw new Error(`Datos inválidos para estudiante ${nombreCompleto}: ${validationResult.error}`);
          }

          const notasEstudiante = serializeEstudianteData({
            genero: estudiante.genero,
            fechaNacimiento: estudiante.fechaNacimiento || '',
            especialidad: estudiante.cargo || '',
            domicilio: estudiante.domicilio || '',
            telefono: estudiante.telefono || '',
            lugarNacimiento: estudiante.lugarNacimiento || '',
            documentoIdentidad: estudiante.documentoIdentidad || '',
            identidadCultural: estudiante.identidadCultural || ''
          });

          if (estudiante.subtaskGid) {
            // Actualizar existente - PRESERVAR REGISTROS DE ASISTENCIA
            const nombreCompleto = [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(', ');
            
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
            const nombreCompleto = [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(', ');
            await asanaService.createSubtask(escuelaData.estudiantesTaskGid, cdima.gid, {
              name: nombreCompleto,
              notes: notasEstudiante
            });
          }
        }));

        // Eliminar estudiantes que ya no están en paralelo
        const gidasActualesEstudiantes = new Set(estudiantesActuales.map(e => e.subtaskGid).filter(Boolean));
        await Promise.all(estudiantesOriginales.map(async (original) => {
          if (original.subtaskGid && !gidasActualesEstudiantes.has(original.subtaskGid)) {
            await asanaService.deleteTask(original.subtaskGid);
          }
        }));

        setNotification({
          message: '¡Escuela actualizada exitosamente!',
          type: 'success'
        });
      } else {
        // MODO CREACIÓN
        // 0. Verificar duplicados antes de crear
        const seccionesExistentes = await asanaService.getSections(projectGid);
        const nombreNormalizado = nombreEscuela.trim().toLowerCase();
        const duplicado = seccionesExistentes.find(s => s.name.trim().toLowerCase() === nombreNormalizado);
        if (duplicado) {
          throw new Error(`Ya existe una escuela con el nombre "${duplicado.name}". Por favor usa un nombre diferente.`);
        }

        // 1. Crear la sección (escuela)
        const seccion = await asanaService.createSection(projectGid, nombreEscuela);

        // 2. Crear las tareas principales
        await asanaService.createTask({
          name: 'Estudiantes',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: `Lista de estudiantes de la escuela\n\n${ASANA_CUSTOM_FIELDS.TIPO_ESCUELA}: ${tipoEscuela}`
        });

        const tareaDocumentos = await asanaService.createTask({
          name: 'Documentos',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: 'Documentos relacionados a la escuela'
        });

        // 3. Crear subtareas de documentos
        const documentosTipo = ['Currícula', 'Informe', 'Otros'];
        for (const doc of documentosTipo) {
          await asanaService.createSubtask(tareaDocumentos.gid, cdima.gid, {
            name: doc
          });
        }

        setNotification({
          message: '¡Escuela creada exitosamente! Ahora puede agregar estudiantes individualmente.',
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
          <HtmlModalHeader icon="🏫" title={editMode ? 'Editar Escuela' : 'Crear Nueva Escuela'} onClose={onClose} />

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
                  maxLength={120}
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

              {/* Estudiantes - solo en modo edición */}
              {editMode && (
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
                          Apellido Materno <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={estudiante.apellidoMaterno}
                          onChange={(e) => handleEstudianteChange(index, 'apellidoMaterno', e.target.value)}
                          placeholder="Ej: Hernandez"
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
                          placeholder="Ej: 12345678 SC"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          required
                          maxLength={20}
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
                          Cargo
                        </label>
                        <input
                          type="text"
                          value={estudiante.cargo}
                          onChange={(e) => handleEstudianteChange(index, 'cargo', e.target.value)}
                          placeholder="Cargo del participante"
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
                          Fecha de Nacimiento
                        </label>
                        <input
                          type="date"
                          value={estudiante.fechaNacimiento}
                          onChange={(e) => handleEstudianteChange(index, 'fechaNacimiento', e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                        />
                      </div>

                      <div>
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

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={estudiante.telefono}
                          onChange={(e) => handleEstudianteChange(index, 'telefono', e.target.value)}
                          placeholder="Ej: 71234567"
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                          maxLength={15}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                          Comunidad
                        </label>
                        <input
                          type="text"
                          value={estudiante.domicilio}
                          onChange={(e) => handleEstudianteChange(index, 'domicilio', e.target.value)}
                          placeholder="Nombre de comunidad"
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
              )}

              <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4f4f4f', marginBottom: '0.5rem' }}>
                  <strong>ℹ️ Nota:</strong> {editMode
                    ? 'Se actualizarán los datos de la escuela y sus estudiantes.'
                    : 'Se crearán automáticamente las tareas "Estudiantes" y "Documentos". Podrás agregar estudiantes individualmente desde la vista de detalle.'}
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
