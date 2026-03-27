import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import Notification from '../components/Notification';

interface Documento {
  nombre: string;
  url: string;
}

const TITLE = 'Investigacion e incidencia';
const SUBTITLE = 'Listado de tareas del proyecto SAIH investigacion';
const PROJECT_QUERY = 'SAIH investigacion';

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const matchesProject = (projectName: string, query: string): boolean => {
  const name = normalize(projectName);
  const q = normalize(query);
  if (name.includes(q)) return true;
  return q.split(' ').filter(Boolean).every(word => name.includes(word));
};

const parseDocumentos = (notes: string | undefined | null): Documento[] => {
  if (!notes) return [];
  const match = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    return Array.isArray(data.documentos) ? data.documentos : [];
  } catch {
    return [];
  }
};

const buildNotes = (originalNotes: string | undefined | null, documentos: Documento[]): string => {
  const base = (originalNotes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
  return `${base}\n\n===DATOS_JSON===\n${JSON.stringify({ documentos }, null, 2)}\n===FIN_DATOS_JSON===`;
};

const InvestigacionIncidenciaPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [project, setProject] = useState<AsanaProject | null>(null);
  const [tasks, setTasks] = useState<AsanaTask[]>([]);

  // Modal agregar documento
  const [modalTask, setModalTask] = useState<AsanaTask | null>(null);
  const [docNombre, setDocNombre] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Notificación
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) { navigate('/'); return; }
    void loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontro el workspace CDIMA');

      const projects = await asanaService.getProjects(cdima.gid);
      const selectedProject = projects.find(p => matchesProject(p.name, PROJECT_QUERY));
      if (!selectedProject) throw new Error(`No se encontro el proyecto '${PROJECT_QUERY}'`);

      setProject(selectedProject);
      const projectTasks = await asanaService.getTasksByProject(selectedProject.gid, true);
      setTasks(projectTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tareas del proyecto');
      setTasks([]);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [tasks]);

  const completedCount = tasks.filter(t => t.completed).length;

  const openModal = (task: AsanaTask) => {
    setModalTask(task);
    setDocNombre('');
    setDocUrl('');
    setModalError('');
  };

  const closeModal = () => {
    setModalTask(null);
    setDocNombre('');
    setDocUrl('');
    setModalError('');
  };

  const handleSaveDocument = async () => {
    if (!modalTask) return;
    if (!docNombre.trim()) { setModalError('El nombre del documento es obligatorio'); return; }
    if (!docUrl.trim()) { setModalError('La URL del documento es obligatoria'); return; }
    try { new URL(docUrl.trim()); } catch { setModalError('La URL ingresada no es válida'); return; }

    setSaving(true);
    setModalError('');
    try {
      const existingDocs = parseDocumentos(modalTask.notes);
      const updatedDocs = [...existingDocs, { nombre: docNombre.trim(), url: docUrl.trim() }];
      const newNotes = buildNotes(modalTask.notes, updatedDocs);

      await asanaService.updateTask(modalTask.gid, { notes: newNotes });

      setTasks(prev => prev.map(t => t.gid === modalTask.gid ? { ...t, notes: newNotes } : t));
      setNotification({ message: 'Documento agregado correctamente', type: 'success' });
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar el documento');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (task: AsanaTask, docIndex: number) => {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      const existingDocs = parseDocumentos(task.notes);
      const updatedDocs = existingDocs.filter((_, i) => i !== docIndex);
      const newNotes = buildNotes(task.notes, updatedDocs);

      await asanaService.updateTask(task.gid, { notes: newNotes });
      setTasks(prev => prev.map(t => t.gid === task.gid ? { ...t, notes: newNotes } : t));
      setNotification({ message: 'Documento eliminado', type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Error al eliminar', type: 'error' });
    }
  };

  if (loading) return <LoadingOverlay message={`Cargando tareas de ${PROJECT_QUERY}...`} />;

  return (
    <div className="planning-page">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">🗂️</div>
          <div className="planning-info">
            <h1 className="planning-title">{TITLE}</h1>
            <p className="planning-subtitle">{SUBTITLE}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{project?.name || PROJECT_QUERY}</h2>
          <p style={{ margin: '0.4rem 0 0 0', color: '#666' }}>
            Tareas: {tasks.length} | Ejecutadas: {completedCount} | En Proceso: {tasks.length - completedCount}
          </p>
        </div>

        {sortedTasks.length === 0 ? (
          <p style={{ color: '#777' }}>No hay tareas para mostrar.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                  <th>Tarea</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Estado</th>
                  <th style={{ width: '115px', textAlign: 'center' }}>Fecha</th>
                  <th style={{ width: '300px' }}>Documentos</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task, index) => {
                  const docs = parseDocumentos(task.notes);
                  return (
                    <tr key={task.gid}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>{task.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '5px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: task.completed ? '#e8f5e9' : '#fff8e1',
                          color: task.completed ? '#2e7d32' : '#f57f17',
                        }}>
                          {task.completed ? '✓ Ejecutada' : '⏳ En Proceso'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#555' }}>
                        {task.due_on || 'Sin fecha'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {docs.length === 0 ? (
                            <span style={{ color: '#bbb', fontSize: '0.82rem', fontStyle: 'italic' }}>
                              Sin documentos
                            </span>
                          ) : (
                            docs.map((doc, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#1565c0',
                                    fontSize: '0.85rem',
                                    textDecoration: 'none',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={doc.url}
                                >
                                  📄 {doc.nombre}
                                </a>
                                <button
                                  onClick={() => handleDeleteDocument(task, i)}
                                  title="Eliminar documento"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#e53935',
                                    fontSize: '0.85rem',
                                    padding: '0 2px',
                                    flexShrink: 0,
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ))
                          )}
                          <button
                            onClick={() => openModal(task)}
                            title="Agregar documento"
                            style={{
                              marginTop: docs.length > 0 ? '4px' : '0',
                              padding: '3px 8px',
                              fontSize: '0.8rem',
                              border: '1px dashed #90caf9',
                              borderRadius: '4px',
                              background: 'transparent',
                              color: '#1976d2',
                              cursor: 'pointer',
                              alignSelf: 'flex-start',
                            }}
                          >
                            + Agregar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Agregar Documento */}
      {modalTask && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>📄 Agregar Documento</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                  {modalTask.name}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {modalError && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: '#ffebee',
                  color: '#c62828',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                }}>
                  {modalError}
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nombre del documento *</label>
                <input
                  className="form-input"
                  type="text"
                  value={docNombre}
                  onChange={(e) => setDocNombre(e.target.value)}
                  placeholder="Ej: Informe de investigación Q1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveDocument()}
                />
              </div>
              <div>
                <label className="form-label">URL del documento *</label>
                <input
                  className="form-input"
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveDocument()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="button-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button className="button-primary" onClick={handleSaveDocument} disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigacionIncidenciaPage;
