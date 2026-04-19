import React, { useState, useEffect } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { HtmlModalHeader } from './ModalShared';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';

interface DiplomadoEditData {
  gid: string;
  nombre: string;
  numeroModulos?: number;
  resumenTaskGid?: string;
}

interface CreateDiplomadoModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
  editMode?: boolean;
  diplomadoData?: DiplomadoEditData;
}

const CreateDiplomadoModal: React.FC<CreateDiplomadoModalProps> = ({
  projectGid,
  onClose,
  onSuccess,
  editMode = false,
  diplomadoData
}) => {
  const [nombreDiplomado, setNombreDiplomado] = useState('');
  const [numeroModulos, setNumeroModulos] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cargar datos cuando está en modo edición
  useEffect(() => {
    if (editMode && diplomadoData) {
      setNombreDiplomado(diplomadoData.nombre);
      if (diplomadoData.numeroModulos !== undefined) setNumeroModulos(diplomadoData.numeroModulos);
    }
  }, [editMode, diplomadoData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!nombreDiplomado.trim()) {
        throw new Error('El nombre del diplomado es obligatorio');
      }

      if (editMode && diplomadoData) {
        // MODO EDICIÓN - solo nombre y número de módulos
        if (nombreDiplomado !== diplomadoData.nombre) {
          await asanaService.updateSection(diplomadoData.gid, nombreDiplomado);
        }

        if (diplomadoData.resumenTaskGid) {
          const resumenTaskFull = await asanaService.getTask(diplomadoData.resumenTaskGid);
          const modulosField = resumenTaskFull.custom_fields?.find((f: any) => f.name === ASANA_CUSTOM_FIELDS.NUMERO_MODULOS);
          if (modulosField) {
            await asanaService.updateTask(diplomadoData.resumenTaskGid, {
              custom_fields: { [modulosField.gid]: numeroModulos }
            });
          }
        }

        setNotification({
          message: '¡Diplomado actualizado exitosamente!',
          type: 'success'
        });
      } else {
        // MODO CREACIÓN
        const workspaces = await asanaService.getWorkspaces();
        const cdima = workspaces.find(ws => ws.name === 'CDIMA');
        if (!cdima) throw new Error('No se encontró el workspace CDIMA');
        // 0. Verificar duplicados antes de crear
        const seccionesExistentes = await asanaService.getSections(projectGid);
        const nombreNormalizado = nombreDiplomado.trim().toLowerCase();
        const duplicado = seccionesExistentes.find(s => s.name.trim().toLowerCase() === nombreNormalizado);
        if (duplicado) {
          throw new Error(`Ya existe un diplomado con el nombre "${duplicado.name}". Por favor usa un nombre diferente.`);
        }

        if (numeroModulos < 5 || numeroModulos > 5) {
          throw new Error('El número de módulos debe ser 5');
        }

        // 1. Crear la sección (diplomado)
        const seccion = await asanaService.createSection(projectGid, nombreDiplomado);

        // 2. Crear las tres tareas principales
        await asanaService.createTask({
          name: 'Docentes',
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: 'Lista de docentes del diplomado'
        });

        await asanaService.createTask({
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

        // 3. Crear subtareas de documentos
        const documentosTipo = ['Currícula', 'Informe', 'Otros'];
        for (const doc of documentosTipo) {
          await asanaService.createSubtask(tareaDocumentos.gid, cdima.gid, {
            name: doc
          });
        }

        // 4. Crear tarea Resumen con número de módulos en custom fields
        const resumenNotes = `Resumen del curso\n===RESUMEN_JSON===\n${JSON.stringify({ numeroModulos })}\n===FIN_RESUMEN_JSON===`;
        const resumenTask = await asanaService.createTask({
          name: `Resumen: ${nombreDiplomado.trim()}`,
          projectGid: projectGid,
          workspaceGid: cdima.gid,
          sectionGid: seccion.gid,
          notes: resumenNotes
        });
        const resumenTaskFull = await asanaService.getTask(resumenTask.gid);
        const modulosField = resumenTaskFull.custom_fields?.find((f: any) => f.name === ASANA_CUSTOM_FIELDS.NUMERO_MODULOS);
        if (modulosField) {
          await asanaService.updateTask(resumenTask.gid, {
            custom_fields: { [modulosField.gid]: numeroModulos }
          });
        }

        setNotification({
          message: '¡Diplomado creado exitosamente! Ahora puede agregar docentes y estudiantes individualmente.',
          type: 'success'
        });
      }

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
      <div className="modal-overlay">
        <div 
          className="modal-content" 
          onClick={(e) => e.stopPropagation()} 
          style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <HtmlModalHeader icon="🎓" title={editMode ? 'Editar Diplomado' : 'Crear Nuevo Diplomado'} onClose={onClose} />

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
                  maxLength={120}
                />
              </div>

              {/* Número de módulos */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Número de módulos <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  value={numeroModulos}
                  onChange={(e) => setNumeroModulos(Math.min(5, Math.max(5, parseInt(e.target.value) || 5)))}
                  min={5}
                  max={5}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                />
                <span style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>Mínimo 5, máximo 5 (por defecto: 5)</span>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#f2f2f2', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4f4f4f', marginBottom: '0.5rem' }}>
                  <strong>ℹ️ Nota:</strong> {editMode
                    ? 'Se actualizará el nombre y número de módulos del diplomado.'
                    : 'Se crearán automáticamente las tareas "Docentes", "Estudiantes" y "Documentos". Podrás agregar participantes individualmente desde la vista de detalle.'}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#5a5a5a' }}>
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
                {loading ? (editMode ? 'Guardando...' : 'Creando...') : (editMode ? 'Guardar Cambios' : 'Crear Diplomado')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateDiplomadoModal;
