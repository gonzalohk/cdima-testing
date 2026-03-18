import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

const ESTADOS = [
  'Requerimiento de contratación',
  'Elaboración de TDRs',
  'Lanzamiento de convocatoria',
  'Selección del consultor',
  'Informe final del consultor',
];

interface ArchivoAdjunto {
  id: number;
  nombre: string;
  link: string;
}

export interface HistorialEstado {
  estado: string;
  fecha: string;
  observaciones: string;
  archivos: { nombre: string; link: string }[];
}

export interface ContratacionJsonData {
  tipo: string;
  actividad: string;
  subarea: string;
  descripcion: string | null;
  fechaGeneracion: string;
  estadoActual: string;
  historialEstados: HistorialEstado[];
}

interface ContratacionUpdateModalProps {
  contratacion: AsanaTask;
  currentData: ContratacionJsonData;
  onClose: () => void;
  onSuccess: () => void;
}

const ContratacionUpdateModal: React.FC<ContratacionUpdateModalProps> = ({
  contratacion,
  currentData,
  onClose,
  onSuccess,
}) => {
  const [estado, setEstado] = useState(currentData.estadoActual || ESTADOS[0]);
  const [observaciones, setObservaciones] = useState('');
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const agregarArchivo = () => {
    const newId = Math.max(...archivos.map(a => a.id), 0) + 1;
    setArchivos([...archivos, { id: newId, nombre: '', link: '' }]);
  };

  const eliminarArchivo = (id: number) => {
    setArchivos(archivos.filter(a => a.id !== id));
  };

  const actualizarArchivo = (id: number, campo: 'nombre' | 'link', valor: string) => {
    setArchivos(archivos.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const archivosValidos = archivos.filter(a => a.nombre.trim() || a.link.trim());
      for (const archivo of archivosValidos) {
        if (!archivo.nombre.trim()) throw new Error('Cada archivo debe tener un nombre');
        if (!archivo.link.trim()) throw new Error('Cada archivo debe tener un enlace');
        if (!archivo.link.startsWith('http')) throw new Error(`El enlace "${archivo.nombre}" no parece una URL válida`);
      }

      const fecha = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz',
      });

      const nuevoRegistro: HistorialEstado = {
        estado,
        fecha,
        observaciones: observaciones.trim(),
        archivos: archivosValidos.map(({ nombre, link }) => ({ nombre: nombre.trim(), link: link.trim() })),
      };

      const allHistorial = [...(currentData.historialEstados ?? []), nuevoRegistro];

      const updatedData: ContratacionJsonData = {
        ...currentData,
        estadoActual: estado,
        historialEstados: allHistorial,
      };

      const notasBase = (contratacion.notes ?? '')
        .replace(/\n*===DATOS_JSON===[\s\S]*?===FIN_DATOS_JSON===/, '')
        .trimEnd();

      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;

      await asanaService.updateTask(contratacion.gid, { notes: newNotes });

      setNotification({ message: '✓ Estado actualizado exitosamente', type: 'success' });
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado');
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
          style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div className="modal-header">
            <h2>📋 Actualizar Estado — {currentData.subarea}</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">

              {/* Estado */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Estado <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  disabled={loading}
                >
                  {ESTADOS.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Observaciones <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span>
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas u observaciones sobre este cambio de estado..."
                  rows={3}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', resize: 'vertical' }}
                  disabled={loading}
                  maxLength={1000}
                />
              </div>

              {/* Archivos adjuntos */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600 }}>
                    Archivos (Google Drive) <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={agregarArchivo}
                    className="button-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    disabled={loading}
                  >
                    + Agregar archivo
                  </button>
                </div>

                {archivos.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: '#999', margin: 0 }}>
                    Sin archivos. Use el botón para agregar enlaces de Google Drive.
                  </p>
                )}

                {archivos.map((archivo) => (
                  <div
                    key={archivo.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr auto',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Nombre del archivo"
                      value={archivo.nombre}
                      onChange={(e) => actualizarArchivo(archivo.id, 'nombre', e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                      disabled={loading}
                      maxLength={200}
                    />
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={archivo.link}
                      onChange={(e) => actualizarArchivo(archivo.id, 'link', e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarArchivo(archivo.id)}
                      style={{
                        background: 'none',
                        border: '1px solid #f5c6cb',
                        borderRadius: '6px',
                        padding: '0.4rem 0.6rem',
                        cursor: 'pointer',
                        color: '#c0392b',
                        fontSize: '0.9rem',
                      }}
                      disabled={loading}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              {/* Historial previo */}
              {currentData.historialEstados && currentData.historialEstados.length > 0 && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                  <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem', color: '#495057' }}>
                    📅 Historial de actualizaciones
                  </p>
                  {[...currentData.historialEstados].reverse().map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.6rem 0.75rem',
                        marginBottom: '0.5rem',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: h.observaciones || h.archivos?.length ? '0.35rem' : 0 }}>
                        <strong>{h.estado}</strong>
                        <span style={{ color: '#999' }}>{h.fecha}</span>
                      </div>
                      {h.observaciones && (
                        <p style={{ margin: '0 0 0.25rem', color: '#555' }}>{h.observaciones}</p>
                      )}
                      {h.archivos && h.archivos.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {h.archivos.map((a, j) => (
                            <a
                              key={j}
                              href={a.link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                backgroundColor: '#fff',
                                border: '1px solid #626262',
                                color: '#626262',
                                borderRadius: '4px',
                                textDecoration: 'none',
                              }}
                            >
                              📎 {a.nombre}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="button-secondary" disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="button-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar actualización'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ContratacionUpdateModal;
