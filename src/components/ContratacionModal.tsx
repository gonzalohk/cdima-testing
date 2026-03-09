import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

interface ContratacionModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}

const ContratacionModal: React.FC<ContratacionModalProps> = ({ task, onClose, onSuccess }) => {
  const [subarea, setSubarea] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!subarea.trim()) {
        throw new Error('El nombre del subárea es obligatorio');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `CONTRATACION - ${subarea.trim()}`;

      // Obtener workspaces
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      
      if (!cdima) {
        throw new Error('No se encontró el workspace CDIMA');
      }

      // Preparar las notas con la información
      const fechaGeneracion = new Date().toLocaleDateString('es-ES');
      const notes = `Solicitud de Contratación
Actividad: ${task.name}
• Subárea: ${subarea}
${descripcion ? `• Descripción: ${descripcion}` : ''}

---
Generado el: ${fechaGeneracion}`;

      // Crear la subtarea en Asana
      await asanaService.createSubtask(task.gid, cdima.gid, {
        name: subtaskName,
        notes: notes
      });

      // Mostrar notificación de éxito
      setNotification({
        message: '✓ Solicitud de contratación creada exitosamente',
        type: 'success'
      });

      // Esperar un momento antes de cerrar para que se vea la notificación
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud de contratación');
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
            <h2>👔 Solicitud de Contratación</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1565c0' }}>
                  <strong>📋 Actividad:</strong> {task.name}
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Nombre del Subárea <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={subarea}
                  onChange={(e) => setSubarea(e.target.value)}
                  placeholder="Ej: Coordinador de Proyectos"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  required
                  disabled={loading}
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  La subtarea se creará como: "CONTRATACION - {subarea || '[nombre]'}"
                </small>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Descripción (Opcional)
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción adicional sobre la contratación..."
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', resize: 'vertical' }}
                  disabled={loading}
                />
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#e65100' }}>
                  <strong>📌 Nota:</strong> La subtarea se creará en Asana. Podrá agregar documentos, 
                  establecer fechas y actualizar el campo "Estado de contratación" directamente en Asana.
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
                {loading ? 'Creando...' : 'Crear Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ContratacionModal;
