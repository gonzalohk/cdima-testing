import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';

interface ProjectTasksListPageProps {
  title: string;
  subtitle: string;
  projectQuery: string;
}

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const matchesProject = (projectName: string, query: string): boolean => {
  const name = normalize(projectName);
  const q = normalize(query);
  if (name.includes(q)) return true;

  const words = q.split(' ').filter(Boolean);
  return words.every(word => name.includes(word));
};

const ProjectTasksListPage: React.FC<ProjectTasksListPageProps> = ({
  title,
  subtitle,
  projectQuery,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [project, setProject] = useState<AsanaProject | null>(null);
  const [tasks, setTasks] = useState<AsanaTask[]>([]);

  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) {
      navigate('/');
      return;
    }

    void loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');

      if (!cdima) {
        throw new Error('No se encontro el workspace CDIMA');
      }

      const projects = await asanaService.getProjects(cdima.gid);
      const selectedProject = projects.find(p => matchesProject(p.name, projectQuery));

      if (!selectedProject) {
        throw new Error(`No se encontro el proyecto '${projectQuery}'`);
      }

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
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'es');
    });
  }, [tasks]);

  const completedCount = tasks.filter(task => task.completed).length;

  if (loading) {
    return <LoadingOverlay message={`Cargando tareas de ${projectQuery}...`} />;
  }

  return (
    <div className="planning-page">
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">🗂️</div>
          <div className="planning-info">
            <h1 className="planning-title">{title}</h1>
            <p className="planning-subtitle">{subtitle}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{project?.name || projectQuery}</h2>
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
                  <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                  <th>Tarea</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Estado</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task, index) => (
                  <tr key={task.gid}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td>{task.name}</td>
                    <td style={{ textAlign: 'center' }}>{task.completed ? 'Ejecutada' : 'En Proceso'}</td>
                    <td style={{ textAlign: 'center' }}>{task.due_on || 'Sin fecha'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTasksListPage;