import React, { useState, useEffect } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { HtmlModalHeader } from './ModalShared';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';

interface EscuelaEditData {
  gid: string;
  nombre: string;
  area?: string;
  numeroModulos?: number;
  resumenTaskGid?: string;
}

interface CreateEscuelaModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
  editMode?: boolean;
  escuelaData?: EscuelaEditData;
}

const CreateEscuelaModal: React.FC<CreateEscuelaModalProps> = ({
  projectGid,
  onClose,
  onSuccess,
  editMode = false,
  escuelaData
}) => {
  const [nombreEscuela, setNombreEscuela] = useState('');
  const [areaEscuela, setAreaEscuela] = useState('');
  const [numeroModulos, setNumeroModulos] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cargar datos cuando está en modo edición
  useEffect(() => {
    if (editMode && escuelaData) {
      setNombreEscuela(escuelaData.nombre);
      if (escuelaData.area) setAreaEscuela(escuelaData.area);
      if (escuelaData.numeroModulos !== undefined) setNumeroModulos(escuelaData.numeroModulos);
    }
  }, [editMode, escuelaData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!nombreEscuela.trim()) {
        throw new Error('El nombre de la escuela es obligatorio');
      }

      if (!areaEscuela.trim()) {
        throw new Error('El área es obligatoria');
      }

      if (numeroModulos < 5 || numeroModulos > 10) {
        throw new Error('El número de módulos debe estar entre 5 y 10');
      }

      if (editMode && escuelaData) {
        // MODO EDICIÓN - solo nombre, área y número de módulos
        if (nombreEscuela !== escuelaData.nombre) {
          await asanaService.updateSection(escuelaData.gid, nombreEscuela);
        }

        if (escuelaData.resumenTaskGid) {
          const resumenTaskFull = await asanaService.getTask(escuelaData.resumenTaskGid);
          const customFieldsUpdate: { [gid: string]: string | number | null } = {};
          const areaField = resumenTaskFull.custom_fields?.find((f: any) => f.name === ASANA_CUSTOM_FIELDS.AREA_ESCUELA);
          if (areaField) {
            if (areaField.type === 'enum' && areaField.enum_options) {
              const opt = areaField.enum_options.find((o: any) => o.name === areaEscuela);
              if (opt) customFieldsUpdate[areaField.gid] = opt.gid;
            } else {
              customFieldsUpdate[areaField.gid] = areaEscuela;
            }
          }
          const modulosField = resumenTaskFull.custom_fields?.find((f: any) => f.name === ASANA_CUSTOM_FIELDS.NUMERO_MODULOS);
          if (modulosField) {
            customFieldsUpdate[modulosField.gid] = numeroModulos;
          }
          if (Object.keys(customFieldsUpdate).length > 0) {
            await asanaService.updateTask(escuelaData.resumenTaskGid, { custom_fields: customFieldsUpdate });
          }
        }

        setNotification({
          message: '¡Escuela actualizada exitosamente!',
          type: 'success'
        });
      } else {
        // MODO CREACIÓN
        const workspaces = await asanaService.getWorkspaces();
        const cdima = workspaces.find(ws => ws.name === 'CDIMA');
        if (!cdima) throw new Error('No se encontró el workspace CDIMA');
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
          notes: 'Lista de estudiantes de la escuela'
        });

        const tareaDocumentos = await asanaService.createTask({
          name: 'Documentos',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: 'Documentos relacionados a la escuela'
        });

        // 3. Crear tarea Resumen con área y número de módulos en custom fields
        const resumenNotes = `Resumen de la escuela\n===RESUMEN_JSON===\n${JSON.stringify({ numeroModulos })}\n===FIN_RESUMEN_JSON===`;
        const resumenTask = await asanaService.createTask({
          name: `Resumen: ${nombreEscuela.trim()}`,
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: resumenNotes
        });
        // Obtener la tarea recién creada para acceder a los GIDs de sus custom fields
        const resumenTaskFull = await asanaService.getTask(resumenTask.gid);
        const customFieldsUpdate: { [gid: string]: string | number | null } = {};
        const areaField = resumenTaskFull.custom_fields?.find(f => f.name === ASANA_CUSTOM_FIELDS.AREA_ESCUELA);
        if (areaField) {
          if (areaField.type === 'enum' && areaField.enum_options) {
            const opt = areaField.enum_options.find(o => o.name === areaEscuela);
            if (opt) customFieldsUpdate[areaField.gid] = opt.gid;
          } else {
            customFieldsUpdate[areaField.gid] = areaEscuela;
          }
        }
        const modulosField = resumenTaskFull.custom_fields?.find(f => f.name === ASANA_CUSTOM_FIELDS.NUMERO_MODULOS);
        if (modulosField) {
          customFieldsUpdate[modulosField.gid] = numeroModulos;
        }
        if (Object.keys(customFieldsUpdate).length > 0) {
          await asanaService.updateTask(resumenTask.gid, { custom_fields: customFieldsUpdate });
        }

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

              {/* Área */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Área <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={areaEscuela}
                  onChange={(e) => setAreaEscuela(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="Empoderamiento político">Empoderamiento político</option>
                  <option value="Erradicación de violencia">Erradicación de violencia</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* Número de módulos */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Número de módulos <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  value={numeroModulos}
                  onChange={(e) => setNumeroModulos(Math.min(10, Math.max(5, parseInt(e.target.value) || 5)))}
                  min={5}
                  max={10}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                />
                <span style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>Mínimo 5, máximo 10</span>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4f4f4f', marginBottom: '0.5rem' }}>
                  <strong>ℹ️ Nota:</strong> {editMode
                    ? 'Se actualizará el nombre, área y número de módulos de la escuela.'
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
