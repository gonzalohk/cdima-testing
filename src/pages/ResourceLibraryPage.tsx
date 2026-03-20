import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// Detectar tipo de archivo
const detectFileType = (url: string, label: string): string => {
  const urlLower = url.toLowerCase();
  const labelLower = label.toLowerCase();
  
  if (urlLower.includes('/folders/')) return 'folder';
  if (urlLower.includes('.pdf') || labelLower.includes('.pdf')) return 'pdf';
  if (urlLower.match(/\.(doc|docx)/) || labelLower.match(/\.(doc|docx)/)) return 'doc';
  if (urlLower.match(/\.(xls|xlsx)/) || labelLower.match(/\.(xls|xlsx)/) || urlLower.includes('spreadsheet')) return 'sheet';
  if (urlLower.match(/\.(ppt|pptx)/) || labelLower.match(/\.(ppt|pptx)/) || urlLower.includes('presentation')) return 'slide';
  if (urlLower.match(/\.(jpg|jpeg|png|gif|svg|webp)/) || labelLower.match(/\.(jpg|jpeg|png|gif|svg|webp)/)) return 'image';
  if (urlLower.match(/\.(mp4|mov|avi|webm)/) || labelLower.match(/\.(mp4|mov|avi|webm)/)) return 'video';
  if (urlLower.includes('document')) return 'doc';
  
  return 'other';
};

// Iconos por tipo de archivo
const getFileTypeIcon = (fileType: string): string => {
  const icons: { [key: string]: string } = {
    folder: '📁',
    pdf: '📄',
    doc: '📝',
    sheet: '📊',
    slide: '📽️',
    image: '🖼️',
    video: '🎥',
    other: '📎'
  };
  return icons[fileType] || icons.other;
};

const getFileTypeLabel = (fileType: string): string => {
  const labels: { [key: string]: string } = {
    folder: 'Carpeta',
    pdf: 'PDF',
    doc: 'Documento',
    sheet: 'Hoja',
    slide: 'Presentacion',
    image: 'Imagen',
    video: 'Video',
    other: 'Recurso',
  };

  return labels[fileType] || labels.other;
};

const getFileTypeColors = (fileType: string): { bg: string; border: string; text: string } => {
  const colorMap: { [key: string]: { bg: string; border: string; text: string } } = {
    folder: { bg: '#fff5d9', border: '#f5c76e', text: '#8a5a00' },
    pdf: { bg: '#ffe8e8', border: '#ffb5b5', text: '#a01717' },
    doc: { bg: '#e8f0ff', border: '#b9cdff', text: '#1d4ed8' },
    sheet: { bg: '#e8f8ef', border: '#b8e5cb', text: '#0f7a3b' },
    slide: { bg: '#fff2e8', border: '#ffc9a6', text: '#b45309' },
    image: { bg: '#f4eaff', border: '#dcc4ff', text: '#7e22ce' },
    video: { bg: '#ffeaf5', border: '#ffc3e1', text: '#be185d' },
    other: { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' },
  };

  return colorMap[fileType] || colorMap.other;
};

const getDominantFileType = (links: Link[]): string => {
  if (links.length === 0) return 'other';

  const counters = links.reduce<Record<string, number>>((acc, link) => {
    const type = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counters).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
};

// Mapeador de tipos de sección a colores con gradientes
const getSectionTypeColor = (sectionName: string): { tipo: string; color: string; gradient: string } => {
  const nameLower = sectionName.toLowerCase();
  
  if (nameLower.includes('campaña') || nameLower.includes('comunicacional')) {
    return { 
      tipo: 'Campaña Comuni.', 
      color: '#C084FC',
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 100%)'
    };
  }
  if (nameLower.includes('testimonio')) {
    return { 
      tipo: 'Testimonios', 
      color: '#6EE7B7',
      gradient: 'linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)'
    };
  }
  if (nameLower.includes('diseño') || nameLower.includes('material')) {
    return { 
      tipo: 'Diseño de Materi.', 
      color: '#FCD34D',
      gradient: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
    };
  }
  if (nameLower.includes('módulo') || nameLower.includes('estudio')) {
    return { 
      tipo: 'Módulos de Estu.', 
      color: '#FCA5A5',
      gradient: 'linear-gradient(135deg, #FCA5A5 0%, #EF4444 100%)'
    };
  }
  if (nameLower.includes('archivo') || nameLower.includes('fotográfi')) {
    return { 
      tipo: 'Archivo Fotográfi.', 
      color: '#93C5FD',
      gradient: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)'
    };
  }
  if (nameLower.includes('informe')) {
    return { 
      tipo: 'Informes', 
      color: '#FDA4AF',
      gradient: 'linear-gradient(135deg, #FDA4AF 0%, #F43F5E 100%)'
    };
  }
  
  // Tipo por defecto
  return { 
    tipo: 'Recursos', 
    color: '#A8E6CF',
    gradient: 'linear-gradient(135deg, #A8E6CF 0%, #34D399 100%)'
  };
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

// Componente para enlaces de Google Drive mejorado
const DriveLink: React.FC<{ link: Link; accentColor: string }> = ({ link, accentColor }) => {
  const fileType = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
  const fileIcon = getFileTypeIcon(fileType);
  const fileLabel = getFileTypeLabel(fileType);
  const fileColors = getFileTypeColors(fileType);

  return (
    <div className="drive-link-container" style={{ borderColor: fileColors.border }}>
      <div className="drive-link-info">
        <span className="drive-link-icon-bubble" style={{ background: fileColors.bg, color: fileColors.text }}>
          {fileIcon}
        </span>
        <div className="drive-link-meta">
          <span className="drive-link-label">{link.label}</span>
          <span className="drive-link-type-pill" style={{ backgroundColor: fileColors.bg, borderColor: fileColors.border, color: fileColors.text }}>
            {fileLabel}
          </span>
        </div>
      </div>
      <div className="drive-link-actions">
          {link.viewUrl && (
            <a
              href={link.viewUrl}
              target="_blank"
              rel="noreferrer"
              className="drive-link-btn"
              title="Abrir"
              style={{ backgroundColor: accentColor, color: 'white', borderColor: accentColor }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span>Abrir</span>
            </a>
          )}
          {link.downloadUrl && (
            <a
              href={link.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="drive-link-btn drive-link-btn-soft"
              title="Descargar"
              style={{ color: accentColor, borderColor: `${accentColor}66` }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const subtaskDominantType = getDominantFileType(subtask.links);
  const subtaskTypeColors = getFileTypeColors(subtaskDominantType);

  return (
    <div className="subtask-row">
      <div className="subtask-name" style={{ borderLeftColor: hasLinks ? subtaskTypeColors.border : `${accentColor}44` }}>
        <span className="subtask-folder-icon">📁</span>
        <span>{subtask.name}</span>
        {hasLinks && (
          <span className="subtask-count-pill" style={{ backgroundColor: subtaskTypeColors.bg, color: subtaskTypeColors.text }}>
            {subtask.links.length}
          </span>
        )}
      </div>
      <div className="subtask-links">
        {hasLinks
          ? <div className="subtask-links-grid">{subtask.links.map(l => <DriveLink key={l.id} link={l} accentColor={accentColor} />)}</div>
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
  const allLinks = [...task.links, ...task.subtasks.flatMap(st => st.links)];
  const dominantType = getDominantFileType(allLinks);
  const dominantTypeLabel = getFileTypeLabel(dominantType);
  const dominantTypeIcon = getFileTypeIcon(dominantType);
  const typeCounts = allLinks.reduce<Record<string, number>>((acc, link) => {
    const type = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="task-row">
      {/* Header */}
      <div className="task-header" style={{ borderBottomColor: `${accentColor}33` }}>
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
          {allLinks.length > 0 && (
            <span className="task-main-type" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}44`, color: accentColor }}>
              {dominantTypeIcon} {dominantTypeLabel}
            </span>
          )}
        </div>
        <div className="task-header-right">
          {task.estado && (
            <span className="task-estado-badge" style={{ backgroundColor: `${accentColor}20`, color: accentColor, borderColor: `${accentColor}40` }}>
              {task.estado}
            </span>
          )}
          <div className="task-metrics">
            <span>📎 {task.links.length}</span>
            <span>🗂️ {task.subtasks.length}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="task-content">
        {allLinks.length > 0 && (
          <div className="task-type-chips">
            {Object.entries(typeCounts).map(([type, count]) => {
              const colors = getFileTypeColors(type);
              return (
                <span
                  key={type}
                  className="task-type-chip"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                >
                  {getFileTypeIcon(type)} {getFileTypeLabel(type)} ({count})
                </span>
              );
            })}
          </div>
        )}

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
          <div className="no-resources-card">
            <span style={{ fontSize: '1.35rem' }}>🗃️</span>
            <span className="no-resources">Sin recursos adjuntos</span>
          </div>
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
                {task.subtasks.length} {task.subtasks.length === 1 ? 'Sub Carpeta' : 'Sub Carpetas'}
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
  const allLinks = section.tasks.flatMap(task => [...task.links, ...task.subtasks.flatMap(st => st.links)]);
  const dominantSectionType = getDominantFileType(allLinks);
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
          {getFileTypeIcon(dominantSectionType)} {section.tipo}
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
  const [sectionLoading, setSectionLoading] = useState(false);
  const rawTasksBySectionId = useRef<Map<string, AsanaTask[]>>(new Map());
  const loadedSectionIds = useRef<Set<string>>(new Set());

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
      
      // Auto-seleccionar "Comunicación CDIMA"
      const comunicacion = data.find(p => p.name.toLowerCase().includes('comunicación') || p.name.toLowerCase().includes('comunicacion'));
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

  const loadSectionAttachments = useCallback(async (sectionId: string) => {
    if (loadedSectionIds.current.has(sectionId)) return;
    const rawTasks = rawTasksBySectionId.current.get(sectionId);
    if (!rawTasks || rawTasks.length === 0) {
      loadedSectionIds.current.add(sectionId);
      return;
    }
    setSectionLoading(true);
    try {
      const tasksWithAttachments = await asanaService.getSectionTasksWithAttachments(rawTasks);
      loadedSectionIds.current.add(sectionId);
      setSections(prev =>
        prev.map(s =>
          s.id === sectionId
            ? { ...s, tasks: tasksWithAttachments.map(convertAsanaTaskToTask) }
            : s
        )
      );
    } catch (err) {
      console.error('Error cargando adjuntos para sección:', err);
    } finally {
      setSectionLoading(false);
    }
  }, []);

  const loadResourceLibrary = async (projectGid: string) => {
    setLoading(true);
    setError('');
    rawTasksBySectionId.current.clear();
    loadedSectionIds.current.clear();
    try {
      const { sections: asanaSections, tasksBySection } = await asanaService.getProjectSectionsAndTasks(projectGid);

      const convertedSections: Section[] = asanaSections
        .map(asanaSection => {
          const sectionTasks = tasksBySection.get(asanaSection.gid) || [];
          rawTasksBySectionId.current.set(asanaSection.gid, sectionTasks);
          const { tipo, color } = getSectionTypeColor(asanaSection.name);

          return {
            id: asanaSection.gid,
            name: asanaSection.name,
            tipo,
            tipoColor: color,
            tasks: sectionTasks.map(t => ({
              id: t.gid,
              name: t.name,
              estado: t.completed ? 'Entregado' : null,
              links: [],
              subtasks: []
            }))
          };
        })
        .filter(section => section.tasks.length > 0);

      setSections(convertedSections);
      if (convertedSections.length > 0) {
        const firstId = convertedSections[0].id;
        setActiveSection(firstId);
        await loadSectionAttachments(firstId);
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

  // Calcular estadísticas generales
  const totalRecursos = sections.reduce((acc, section) => 
    acc + section.tasks.reduce((a, t) => 
      a + t.links.length + t.subtasks.reduce((b, st) => b + st.links.length, 0), 0), 0);
  
  const totalTareas = sections.reduce((acc, section) => acc + section.tasks.length, 0);

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Proyecto';

  if (loading) {
    return <LoadingOverlay message="Cargando biblioteca de recursos..." />;
  }

  if (error) {
    return (
      <div className="planning-page">
        <h1 className="page-title">Biblioteca de Recursos</h1>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="planning-page">
        <h1 className="page-title">Biblioteca de Recursos</h1>
        <div className="card">
          <p>No se encontraron secciones con recursos en el proyecto "{projectName}".</p>
          <p style={{ marginTop: '1rem', color: '#666' }}>
            Verifica que el proyecto "Comunicación CDIMA" tenga secciones y tareas con archivos adjuntos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="planning-page resource-library">
      {/* Header */}
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">📚</div>
          <div className="planning-info">
            <h1 className="planning-title">{projectName}</h1>
            <p className="planning-subtitle">
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

      {/* Estadísticas */}
      <div className="rl-stats-grid">
        <div className="rl-stat-card rl-stat-card-blue">
          <div className="rl-stat-card-header">📦 Recursos</div>
          <div className="rl-stat-value">
            {totalRecursos}
          </div>
          <div className="rl-stat-label">
            Total de Recursos
          </div>
        </div>

        <div className="rl-stat-card rl-stat-card-green">
          <div className="rl-stat-card-header">🧩 Secciones</div>
          <div className="rl-stat-value">
            {sections.length}
          </div>
          <div className="rl-stat-label">
            Categorías
          </div>
        </div>

        <div className="rl-stat-card rl-stat-card-amber">
          <div className="rl-stat-card-header">📚 Carpetas</div>
          <div className="rl-stat-value">
            {totalTareas}
          </div>
          <div className="rl-stat-label">
            Carpetas de Recursos
          </div>
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
                onClick={() => { setActiveSection(s.id); setSearch(''); loadSectionAttachments(s.id); }}
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
                    <span className="rl-panel-resource-count-number">{totalLinks}</span> recursos disponibles
                  </span>
                </div>
                <h2 className="rl-panel-title">{currentSection.name}</h2>
              </div>

              {/* Task list */}
              <div className="rl-tasks-list">
                {sectionLoading ? (
                  <div className="rl-empty-state">
                    <div className="rl-empty-text" style={{ color: '#6b7280' }}>Cargando recursos...</div>
                  </div>
                ) : filteredTasks.length === 0 ? (
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
