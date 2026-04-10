import React, { useState } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { HtmlModalHeader } from './ModalShared';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';

interface CreateCursoAltoNivelModalProps {
  projectGid: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCursoAltoNivelModal: React.FC<CreateCursoAltoNivelModalProps> = ({
  projectGid,
  onClose,
  onSuccess
}) => {
  const [nombreCurso, setNombreCurso] = useState('');
  const [numeroModulos, setNumeroModulos] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!nombreCurso.trim()) {
        throw new Error('El nombre del curso es obligatorio');
      }

      if (numeroModulos < 1 || numeroModulos > 10) {
        throw new Error('El número de módulos debe estar entre 1 y 10');
      }

      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontró el workspace CDIMA');

      // Verificar duplicados
      const seccionesExistentes = await asanaService.getSections(projectGid);
      const nombreNormalizado = nombreCurso.trim().toLowerCase();
      const duplicado = seccionesExistentes.find(s => s.name.trim().toLowerCase() === nombreNormalizado);
      if (duplicado) {
        throw new Error(`Ya existe un curso con el nombre "${duplicado.name}". Por favor usa un nombre diferente.`);
      }

      // 1. Crear la sección (curso)
      const seccion = await asanaService.createSection(projectGid, nombreCurso.trim());

      // 2. Crear tareas principales
      await asanaService.createTask({
        name: 'Docentes',
        projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Lista de docentes del curso'
      });

      await asanaService.createTask({
        name: 'Estudiantes',
        projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Lista de estudiantes del curso'
      });

      const tareaDocumentos = await asanaService.createTask({
        name: 'Documentos',
        projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: 'Documentos relacionados al curso'
      });

      // 3. Crear subtareas de documentos
      for (const doc of ['Currícula', 'Informe', 'Otros']) {
        await asanaService.createSubtask(tareaDocumentos.gid, cdima.gid, { name: doc });
      }

      // 4. Crear tarea Resumen con número de módulos
      const resumenNotes = `Resumen del curso\n===RESUMEN_JSON===\n${JSON.stringify({ numeroModulos })}\n===FIN_RESUMEN_JSON===`;
      const resumenTask = await asanaService.createTask({
        name: `Resumen: ${nombreCurso.trim()}`,
        projectGid,
        workspaceGid: cdima.gid,
        sectionGid: seccion.gid,
        notes: resumenNotes
      });

      // Escribir el custom field Número de módulos
      const resumenTaskFull = await asanaService.getTask(resumenTask.gid);
      const modulosField = resumenTaskFull.custom_fields?.find((f: any) => f.name === ASANA_CUSTOM_FIELDS.NUMERO_MODULOS);
      if (modulosField) {
        await asanaService.updateTask(resumenTask.gid, {
          custom_fields: { [modulosField.gid]: numeroModulos }
        });
      }

      setNotification({
        message: '¡Curso creado exitosamente! Ahora puede agregar docentes y estudiantes individualmente.',
        type: 'success'
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el curso');
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
          style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <HtmlModalHeader icon="🎓" title="Crear nuevo Curso de Alto Nivel" onClose={onClose} />

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">

              {/* Nombre del Curso */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Nombre del Curso <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={nombreCurso}
                  onChange={(e) => setNombreCurso(e.target.value)}
                  placeholder="Ej: Curso de Alto Nivel en Gestión Pública"
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
                  onChange={(e) => setNumeroModulos(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={10}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                />
                <span style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  Mínimo 1, máximo 10 (por defecto: 5)
                </span>
              </div>

            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1rem 1.5rem' }}>
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
                {loading ? 'Creando...' : 'Crear Curso'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateCursoAltoNivelModal;
