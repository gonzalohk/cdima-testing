import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { HtmlModalHeader } from './ModalShared';

export interface FuenteEntry {
  id: number;
  nombre: string;
  link: string;
  fechaAgregado: string;
}

export interface FuentesJsonData {
  tipo: string;
  actividad: string;
  fechaCreacion: string;
  entradas: FuenteEntry[];
}

interface VerificationSourcesModalProps {
  task: AsanaTask;
  verificationSubtask?: AsanaTask;
  currentData?: FuentesJsonData;
  onClose: () => void;
  onSuccess: () => void;
}

const VerificationSourcesModal: React.FC<VerificationSourcesModalProps> = ({
  task,
  verificationSubtask,
  currentData,
  onClose,
  onSuccess,
}) => {
  const [nombre, setNombre] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fechaActual = () =>
    new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/La_Paz',
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre del archivo es requerido'); return; }
    if (!link.trim()) { setError('El enlace es requerido'); return; }
    try { new URL(link.trim()); } catch { setError('El enlace no es una URL válida (debe comenzar con https://)'); return; }

    setLoading(true);
    setError('');

    try {
      const nuevaEntrada: FuenteEntry = {
        id: Date.now(),
        nombre: nombre.trim(),
        link: link.trim(),
        fechaAgregado: fechaActual(),
      };

      if (verificationSubtask) {
        // Actualizar subtarea existente
        const existingEntradas = currentData?.entradas || [];
        const updatedData: FuentesJsonData = {
          tipo: 'FUENTES_VERIFICACION',
          actividad: task.name,
          fechaCreacion: currentData?.fechaCreacion || fechaActual(),
          entradas: [...existingEntradas, nuevaEntrada],
        };
        await asanaService.updateTask(verificationSubtask.gid, {
          notes: JSON.stringify(updatedData, null, 2),
        });
        setNotification({ message: '¡Fuente de verificación agregada exitosamente!', type: 'success' });
      } else {
        // Crear nueva subtarea
        const subtaskName = `FUENTES DE VERIFICACION - ${task.name}`;
        const jsonData: FuentesJsonData = {
          tipo: 'FUENTES_VERIFICACION',
          actividad: task.name,
          fechaCreacion: fechaActual(),
          entradas: [nuevaEntrada],
        };
        const workspaceGid = task.projects?.[0]?.workspace?.gid;
        if (!workspaceGid) throw new Error('No se pudo obtener el workspace de la tarea');
        await asanaService.createSubtask(task.gid, workspaceGid, {
          name: subtaskName,
          notes: JSON.stringify(jsonData, null, 2),
          due_on: task.due_on,
        });
        setNotification({ message: '¡Fuente de verificación creada exitosamente!', type: 'success' });
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la fuente de verificación');
    } finally {
      setLoading(false);
    }
  };

  const existingEntradas = currentData?.entradas || [];

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
          <HtmlModalHeader icon="📂" title="Fuentes de Verificación" subtitle={task.name} onClose={onClose} />

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="modal-body">   
            <div>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#444' }}>
                {verificationSubtask ? 'Agregar nueva fuente' : 'Registrar primera fuente'}
              </h4>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nombre del archivo / documento</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Informe mensual marzo 2026"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Enlace (URL)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '1rem', lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
                    }}>🔗</span>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      disabled={loading}
                      style={{ paddingLeft: '2.1rem', textOverflow: 'ellipsis' }}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={onClose} className="button-secondary" disabled={loading}>
                    Cancelar
                  </button>
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? 'Guardando...' : verificationSubtask ? '+ Agregar Fuente' : 'Crear y Registrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VerificationSourcesModal;
