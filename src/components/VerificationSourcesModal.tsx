import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

interface VerificationSourcesModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}

const VerificationSourcesModal: React.FC<VerificationSourcesModalProps> = ({ task, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Construir el nombre de la subtarea
      const subtaskName = `FUENTES DE VERIFICACION - ${task.name}`;

      // Construir las notas
      const fechaCreacion = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz'
      });

      const notes = `FUENTES DE VERIFICACIÓN

Actividad: ${task.name}

INFORMACIÓN:
• Fecha de creación: ${fechaCreacion}
• Para agregar recursos, adjunte archivos o enlaces de Google Drive a esta subtarea

INSTRUCCIONES:
1. Haga clic en esta subtarea en Asana
2. Use el botón de adjuntar archivos (+) para agregar:
   - Documentos PDF
   - Imágenes
   - Enlaces de Google Drive
   - Cualquier otro archivo relevante

Los recursos adjuntos aparecerán automáticamente en el reporte con botones de visualización.

---
Subtarea generada automáticamente desde el sistema de reportes CDIMA`;

      // Obtener el workspace del primer proyecto de la tarea
      const workspaceGid = task.projects?.[0]?.workspace?.gid;
      if (!workspaceGid) {
        throw new Error('No se pudo obtener el workspace de la tarea');
      }

      // Crear la subtarea
      await asanaService.createSubtask(task.gid, workspaceGid, {
        name: subtaskName,
        notes: notes,
        due_on: task.due_on
      });

      setNotification({ 
        message: '¡Subtarea "FUENTES DE VERIFICACION" creada exitosamente! Ahora puede adjuntar recursos en Asana.', 
        type: 'success' 
      });
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la subtarea');
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
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
          <div className="modal-header">
            <h2>Crear Fuentes de Verificación</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <strong>Actividad:</strong> {task.name}
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px', marginBottom: '1rem' }}>
                <h4 style={{ marginTop: 0, color: '#1976d2' }}>ℹ️ Información</h4>
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                  Se creará una subtarea llamada <strong>"FUENTES DE VERIFICACION"</strong> donde podrá adjuntar:
                </p>
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  <li>Documentos PDF</li>
                  <li>Imágenes y fotografías</li>
                  <li>Enlaces de Google Drive</li>
                  <li>Cualquier archivo relevante</li>
                </ul>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#555' }}>
                  Los recursos adjuntos aparecerán automáticamente en esta sección con botones "VER" para acceder a ellos.
                </p>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', borderLeft: '4px solid #ff9800' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  <strong>📌 Nota:</strong> Después de crear la subtarea, debe ir a Asana para adjuntar los archivos o enlaces.
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
                {loading ? 'Creando...' : 'Crear Subtarea'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default VerificationSourcesModal;
