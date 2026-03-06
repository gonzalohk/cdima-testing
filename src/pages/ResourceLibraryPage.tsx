import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaTask, AsanaAttachment } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';

interface Link {
  id: string;
  label: string;
  viewUrl?: string;
  downloadUrl?: string;
}

interface Subtask {
  id: string;
  name: string;
  links: Link[];
}

interface Task {
  id: string;
  name: string;
  estado: string | null;
  links: Link[];
  subtasks: Subtask[];
}

interface Section {
  id: string;
  name: string;
  tipo: string;
  tipoColor: string;
  tasks: Task[];
}

// Mapeador de tipos de sección a colores
const getSectionTypeColor = (sectionName: string): { tipo: string; color: string } => {
  const nameLower = sectionName.toLowerCase();
  
  if (nameLower.includes('campaña') || nameLower.includes('comunicacional')) {
    return { tipo: 'Campaña Comuni.', color: '#C084FC' };
  }
  if (nameLower.includes('testimonio')) {
    return { tipo: 'Testimonios', color: '#6EE7B7' };
  }
  if (nameLower.includes('diseño') || nameLower.includes('material')) {
    return { tipo: 'Diseño de Materi.', color: '#FCD34D' };
  }
  if (nameLower.includes('módulo') || nameLower.includes('estudio')) {
    return { tipo: 'Módulos de Estu.', color: '#FCA5A5' };
  }
  if (nameLower.includes('archivo') || nameLower.includes('fotográfi')) {
    return { tipo: 'Archivo Fotográfi.', color: '#93C5FD' };
  }
  if (nameLower.includes('informe')) {
    return { tipo: 'Informes', color: '#FDA4AF' };
  }
  
  // Tipo por defecto
  return { tipo: 'Recursos', color: '#A8E6CF' };
};

// Convertir attachments de Asana a Links
const convertAttachmentsToLinks = (attachments?: AsanaAttachment[]): Link[] => {
  if (!attachments || attachments.length === 0) return [];
  
  const links = attachments
    .filter(att => att.view_url || att.download_url)
    .map(att => ({
      id: att.gid,
      label: att.name,
      viewUrl: att.view_url,
      downloadUrl: att.download_url
    }));
  
  // Log para debugging
  if (links.length > 0) {
    console.log('Converted links:', links.map(l => ({
      label: l.label,
      hasView: !!l.viewUrl,
      hasDownload: !!l.downloadUrl
    })));
  }
  
  return links;
};

// Convertir tarea de Asana a Task del componente
const convertAsanaTaskToTask = (asanaTask: AsanaTask): Task => {
  const links = convertAttachmentsToLinks(asanaTask.attachments);
  const subtasks: Subtask[] = asanaTask.subtasks
    ? asanaTask.subtasks.map(st => ({
        id: st.gid,
        name: st.name,
        links: convertAttachmentsToLinks(st.attachments)
      }))
    : [];

  return {
    id: asanaTask.gid,
    name: asanaTask.name,
    estado: asanaTask.completed ? 'Entregado' : null,
    links,
    subtasks
  };
};

// Componente para enlaces de Google Drive
const DriveLink: React.FC<{ link: Link; accentColor: string }> = ({ link, accentColor }) => {
  return (
    <div className="drive-link-container">
      <div className="drive-link-info">
        <svg className="drive-link-file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="drive-link-label">{link.label}</span>
      </div>
      <div className="drive-link-actions">
        {link.viewUrl && (
          <a
            href={link.viewUrl}
            target="_blank"
            rel="noreferrer"
            className="drive-link-btn drive-link-view"
            title="Ver en Drive"
            style={{ '--accent-color': accentColor } as React.CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Ver</span>
          </a>
        )}
        {link.downloadUrl && (
          <a
            href={link.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="drive-link-btn drive-link-download"
            title="Descargar"
            style={{ '--accent-color': accentColor } as React.CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Descargar</span>
          </a>
        )}
      </div>
    </div>
  );
};

// Componente para fila de subtarea
const SubtaskRow: React.FC<{ subtask: Subtask; accentColor: string }> = ({ subtask, accentColor }) => {
  const hasLinks = subtask.links.length > 0;
  return (
    <div className="subtask-row">
      <div className="subtask-name">
        <span>{subtask.name}</span>
      </div>
      <div className="subtask-links">
        {hasLinks
          ? subtask.links.map(l => <DriveLink key={l.id} link={l} accentColor={accentColor} />)
          : <span className="no-resources">Sin recursos</span>
        }
      </div>
    </div>
  );
};

// Componente para fila de tarea
const TaskRow: React.FC<{ task: Task; accentColor: string }> = ({ task, accentColor }) => {
  const [expanded, setExpanded] = useState(false);
  const hasSubtasks = task.subtasks.length > 0;
  const hasLinks = task.links.length > 0;

  return (
    <div className="task-row">
      {/* Header */}
      <div className="task-header">
        <div className="task-header-title">
          <div
            className="task-status-circle"
            style={{
              borderColor: task.estado ? accentColor : '#aaa',
              backgroundColor: task.estado ? `${accentColor}20` : 'transparent',
            }}
          >
            {task.estado && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <span className={`task-name ${task.estado ? 'completed' : ''}`}>
            {task.name}
          </span>
        </div>
        {task.estado && (
          <span className="task-estado-badge" style={{ backgroundColor: `${accentColor}20`, color: accentColor, borderColor: `${accentColor}40` }}>
            {task.estado}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="task-content">
        {/* Links de la tarea */}
        {hasLinks && (
          <div className="task-links-section">
            <span className="task-links-label">📎 Recursos</span>
            <div className="task-links-grid">
              {task.links.map(l => <DriveLink key={l.id} link={l} accentColor={accentColor} />)}
            </div>
          </div>
        )}

        {/* Sin recursos */}
        {!hasLinks && !hasSubtasks && (
          <div className="no-resources">Sin recursos adjuntos</div>
        )}

        {/* Subtareas */}
        {hasSubtasks && (
          <div className="task-subtasks-section">
            <div
              className="task-subtasks-header"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="task-subtasks-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                {task.subtasks.length} {task.subtasks.length === 1 ? 'Subtarea' : 'Subtareas'}
              </span>
              <div className="task-expand-btn">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>

            {expanded && (
              <div className="task-subtasks-list">
                {task.subtasks.map(st => (
                  <SubtaskRow key={st.id} subtask={st} accentColor={accentColor} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para tarjeta de sección en sidebar
const SectionCard: React.FC<{
  section: Section;
  isActive: boolean;
  onClick: () => void;
}> = ({ section, isActive, onClick }) => {
  const totalLinks = section.tasks.reduce((acc, t) => {
    return acc + t.links.length + t.subtasks.reduce((a, st) => a + st.links.length, 0);
  }, 0);

  return (
    <button
      onClick={onClick}
      className={`section-card ${isActive ? 'active' : ''}`}
      style={{
        borderColor: isActive ? section.tipoColor : '#dee2e6',
        backgroundColor: isActive ? `${section.tipoColor}10` : '#fff',
      }}
    >
      <div className="section-card-header">
        <span className="section-tipo-badge" style={{ backgroundColor: `${section.tipoColor}20`, color: section.tipoColor, borderColor: `${section.tipoColor}40` }}>
          {section.tipo}
        </span>
        {totalLinks > 0 && (
          <span className="section-resource-count">
            {totalLinks} {totalLinks === 1 ? 'recurso' : 'recursos'}
          </span>
        )}
      </div>
      <div className={`section-name ${isActive ? 'active' : ''}`}>
        {section.name}
      </div>
    </button>
  );
};

// Componente principal
const ResourceLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verificar token al cargar
  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) {
      navigate('/');
      return;
    }
    loadWorkspaces();
  }, [navigate]);

  const loadWorkspaces = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await asanaService.getWorkspaces();
      
      // Auto-seleccionar "CDIMA"
      const cdima = data.find(ws => ws.name === 'CDIMA');
      if (cdima) {
        await loadProjects(cdima.gid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (workspaceGid: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await asanaService.getProjects(workspaceGid);
      setProjects(data);
      
      // Auto-seleccionar "Area Comunicacion"
      const comunicacion = data.find(p => p.name.toLowerCase().includes('comunicacion'));
      if (comunicacion) {
        setSelectedProject(comunicacion.gid);
        await loadResourceLibrary(comunicacion.gid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const loadResourceLibrary = async (projectGid: string) => {
    setLoading(true);
    setError('');
    try {
      const { sections: asanaSections, tasksBySection } = await asanaService.getProjectResourceLibrary(projectGid);
      
      // Convertir secciones de Asana al formato del componente
      const convertedSections: Section[] = asanaSections
        .map(asanaSection => {
          const sectionTasks = tasksBySection.get(asanaSection.gid) || [];
          const { tipo, color } = getSectionTypeColor(asanaSection.name);
          
          return {
            id: asanaSection.gid,
            name: asanaSection.name,
            tipo,
            tipoColor: color,
            tasks: sectionTasks.map(convertAsanaTaskToTask)
          };
        })
        .filter(section => section.tasks.length > 0); // Solo secciones con tareas
      
      setSections(convertedSections);
      if (convertedSections.length > 0) {
        setActiveSection(convertedSections[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar biblioteca de recursos');
    } finally {
      setLoading(false);
    }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  const filteredTasks = useMemo(() => {
    if (!currentSection) return [];
    if (!search) return currentSection.tasks;
    
    const q = search.toLowerCase();
    return currentSection.tasks.filter(t => {
      return t.name.toLowerCase().includes(q) ||
        t.links.some(l => l.label.toLowerCase().includes(q)) ||
        t.subtasks.some(st => st.name.toLowerCase().includes(q) || st.links.some(l => l.label.toLowerCase().includes(q)));
    });
  }, [currentSection, search]);

  const totalLinks = currentSection ? currentSection.tasks.reduce((acc, t) =>
    acc + t.links.length + t.subtasks.reduce((a, st) => a + st.links.length, 0), 0) : 0;

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Proyecto';

  if (loading) {
    return <LoadingOverlay message="Cargando biblioteca de recursos..." />;
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Biblioteca de Recursos</h1>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div>
        <h1 className="page-title">Biblioteca de Recursos</h1>
        <div className="card">
          <p>No se encontraron secciones con recursos en el proyecto "{projectName}".</p>
          <p style={{ marginTop: '1rem', color: '#666' }}>
            Verifica que el proyecto "Area Comunicacion" tenga secciones y tareas con archivos adjuntos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-library">
      {/* Top bar */}
      <div className="rl-topbar">
        <div className="rl-topbar-left">
          <div className="rl-project-icon">📚</div>
          <div className="rl-project-info">
            <h1 className="rl-project-name">{projectName}</h1>
            <p className="rl-project-subtitle">
              {sections.length} {sections.length === 1 ? 'sección' : 'secciones'} · Portal de recursos técnicos
            </p>
          </div>
        </div>

        <div className="rl-search-container">
          <span className="rl-search-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar tarea o recurso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rl-search-input"
          />
        </div>
      </div>

      {/* Body: sidebar + main */}
      <div className="rl-layout">
        {/* Sidebar: sections */}
        <aside className="rl-sidebar">
          <div className="rl-sidebar-label">SECCIONES</div>
          <div className="rl-sections-list">
            {sections.map(s => (
              <SectionCard
                key={s.id}
                section={s}
                isActive={s.id === activeSection}
                onClick={() => { setActiveSection(s.id); setSearch(''); }}
              />
            ))}
          </div>
        </aside>

        {/* Main: tasks */}
        <main className="rl-main-panel">
          {currentSection && (
            <>
              {/* Section header */}
              <div className="rl-panel-header">
                <div className="rl-panel-header-top">
                  <span className="rl-panel-tipo-badge" style={{ backgroundColor: `${currentSection.tipoColor}20`, color: currentSection.tipoColor, borderColor: `${currentSection.tipoColor}40` }}>
                    {currentSection.tipo}
                  </span>
                  <span className="rl-panel-resource-count">
                    {totalLinks} recursos disponibles
                  </span>
                </div>
                <h2 className="rl-panel-title">{currentSection.name}</h2>
              </div>

              {/* Task list */}
              <div className="rl-tasks-list">
                {filteredTasks.length === 0 ? (
                  <div className="rl-empty-state">
                    <div className="rl-empty-icon">🔍</div>
                    <div className="rl-empty-text">
                      {search ? `No se encontraron resultados para "${search}"` : 'No hay tareas en esta sección'}
                    </div>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <TaskRow key={task.id} task={task} accentColor={currentSection.tipoColor} />
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ResourceLibraryPage;
