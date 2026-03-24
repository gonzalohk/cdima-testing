import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, Col, Empty, Input, Row, Space, Spin, Statistic, Tag, Tooltip, Typography, Collapse,
} from 'antd';
import {
  FolderOutlined, FileTextOutlined, FileExcelOutlined, FilePptOutlined, FileImageOutlined,
  VideoCameraOutlined, PaperClipOutlined, FilePdfOutlined, SearchOutlined,
  CheckCircleOutlined, FolderOpenOutlined, LinkOutlined, DownloadOutlined,
  AppstoreOutlined, DatabaseOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaTask, AsanaAttachment } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';

const { Text, Title } = Typography;
const { Panel } = Collapse;

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

// Icono Ant Design por tipo de archivo
const getAntIcon = (fileType: string): React.ReactNode => {
  const map: Record<string, React.ReactNode> = {
    folder: <FolderOutlined />,
    pdf: <FilePdfOutlined />,
    doc: <FileTextOutlined />,
    sheet: <FileExcelOutlined />,
    slide: <FilePptOutlined />,
    image: <FileImageOutlined />,
    video: <VideoCameraOutlined />,
    other: <PaperClipOutlined />,
  };
  return map[fileType] ?? map.other;
};

// Componente para enlace de archivo
const DriveLink: React.FC<{ link: Link; accentColor: string }> = ({ link, accentColor }) => {
  const fileType = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
  const fileLabel = getFileTypeLabel(fileType);
  const fileColors = getFileTypeColors(fileType);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      border: `1px solid ${fileColors.border}`, borderRadius: 8,
      padding: '8px 12px', background: '#fafafa',
    }}>
      <span style={{
        fontSize: 18, background: fileColors.bg, color: fileColors.text,
        borderRadius: 6, padding: '4px 7px', lineHeight: 1,
      }}>
        {getAntIcon(fileType)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text ellipsis style={{ display: 'block', fontSize: 13 }}>{link.label}</Text>
        <Tag color={fileColors.bg} style={{ color: fileColors.text, borderColor: fileColors.border, fontSize: 11, marginTop: 2 }}>
          {fileLabel}
        </Tag>
      </div>
      <Space size={4}>
        {link.viewUrl && (
          <Tooltip title="Abrir">
            <Button
              size="small" type="primary" icon={<LinkOutlined />}
              href={link.viewUrl} target="_blank"
              style={{ background: accentColor, borderColor: accentColor }}
            >
              Abrir
            </Button>
          </Tooltip>
        )}
        {link.downloadUrl && (
          <Tooltip title="Descargar">
            <Button
              size="small" icon={<DownloadOutlined />}
              href={link.downloadUrl} target="_blank"
              style={{ color: accentColor, borderColor: `${accentColor}88` }}
            >
              Descargar
            </Button>
          </Tooltip>
        )}
      </Space>
    </div>
  );
};

// Componente para subtarea
const SubtaskRow: React.FC<{ subtask: Subtask; accentColor: string }> = ({ subtask, accentColor }) => {
  const hasLinks = subtask.links.length > 0;

  return (
    <div style={{ borderLeft: `3px solid ${accentColor}44`, paddingLeft: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasLinks ? 8 : 0 }}>
        <FolderOpenOutlined style={{ color: accentColor }} />
        <Text strong style={{ fontSize: 13 }}>{subtask.name}</Text>
        {hasLinks && <Badge count={subtask.links.length} style={{ backgroundColor: accentColor }} />}
      </div>
      {hasLinks ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subtask.links.map(l => <DriveLink key={l.id} link={l} accentColor={accentColor} />)}
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>Sin recursos</Text>
      )}
    </div>
  );
};

// Componente para fila de tarea
const TaskRow: React.FC<{ task: Task; accentColor: string }> = ({ task, accentColor }) => {
  const hasSubtasks = task.subtasks.length > 0;
  const hasLinks = task.links.length > 0;
  const allLinks = [...task.links, ...task.subtasks.flatMap(st => st.links)];
  const typeCounts = allLinks.reduce<Record<string, number>>((acc, link) => {
    const type = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const titleNode = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {task.estado
        ? <CheckCircleOutlined style={{ color: accentColor }} />
        : <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid #ccc` }} />}
      <Text strong style={{ fontSize: 14, color: task.estado ? '#999' : '#222', textDecoration: task.estado ? 'line-through' : 'none' }}>
        {task.name}
      </Text>
      {task.estado && <Tag color="success" style={{ marginLeft: 4 }}>{task.estado}</Tag>}
    </div>
  );

  return (
    <Card
      size="small"
      style={{ marginBottom: 10, borderRadius: 8, border: `1px solid ${accentColor}33` }}
      styles={{ header: { borderBottom: `1px solid ${accentColor}22`, background: `${accentColor}08` } }}
      title={titleNode}
      extra={
        allLinks.length > 0 && (
          <Space size={4} wrap>
            {Object.entries(typeCounts).map(([type, count]) => {
              const colors = getFileTypeColors(type);
              return (
                <Tag key={type} style={{ background: colors.bg, borderColor: colors.border, color: colors.text, fontSize: 11 }}>
                  {getFileTypeIcon(type)} {getFileTypeLabel(type)} ({count})
                </Tag>
              );
            })}
          </Space>
        )
      }
    >
      {hasLinks && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: hasSubtasks ? 12 : 0 }}>
          {task.links.map(l => <DriveLink key={l.id} link={l} accentColor={accentColor} />)}
        </div>
      )}

      {!hasLinks && !hasSubtasks && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <PaperClipOutlined style={{ marginRight: 4 }} />Sin recursos adjuntos
        </Text>
      )}

      {hasSubtasks && (
        <Collapse ghost size="small">
          <Panel
            key="subtasks"
            header={
              <Space>
                <FolderOutlined style={{ color: accentColor }} />
                <Text style={{ fontSize: 13 }}>
                  {task.subtasks.length} {task.subtasks.length === 1 ? 'Sub Carpeta' : 'Sub Carpetas'}
                </Text>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {task.subtasks.map(st => <SubtaskRow key={st.id} subtask={st} accentColor={accentColor} />)}
            </div>
          </Panel>
        </Collapse>
      )}
    </Card>
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
  const totalLinks = section.tasks.reduce((acc, t) =>
    acc + t.links.length + t.subtasks.reduce((a, st) => a + st.links.length, 0), 0);

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${isActive ? section.tipoColor : '#e8e8e8'}`,
        background: isActive ? `${section.tipoColor}10` : '#fff',
        marginBottom: 6,
        transition: 'border-color .2s, background .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Tag style={{
          background: `${section.tipoColor}18`, color: section.tipoColor,
          borderColor: `${section.tipoColor}44`, fontSize: 11,
        }}>
          {getFileTypeIcon(dominantSectionType)} {section.tipo}
        </Tag>
        {totalLinks > 0 && (
          <Badge count={totalLinks} overflowCount={99} style={{ backgroundColor: section.tipoColor, fontSize: 10 }} />
        )}
      </div>
      <Text strong={isActive} style={{ fontSize: 13, color: isActive ? section.tipoColor : '#333', display: 'block', lineHeight: '1.4' }}>
        {section.name}
      </Text>
    </div>
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
      <div style={{ padding: '2rem' }}>
        <Card>
          <Empty description={error} />
        </Card>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <Card>
          <Empty
            description={
              <>
                <Text>No se encontraron secciones con recursos en el proyecto "{projectName}".</Text><br />
                <Text type="secondary" style={{ fontSize: 13 }}>Verifica que el proyecto "Comunicación CDIMA" tenga secciones y tareas con archivos adjuntos.</Text>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <Card styles={{ body: { padding: '16px 20px' } }}>
        <Row align="middle" justify="space-between" gutter={[16, 12]}>
          <Col>
            <Space align="center">
              <span style={{ fontSize: 28 }}>📡</span>
              <div>
                <Title level={4} style={{ margin: 0 }}>{projectName}</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {sections.length} {sections.length === 1 ? 'sección' : 'secciones'} · Portal de recursos técnicos
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Buscar tarea o recurso..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Estadísticas */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Total de Recursos"
              value={totalRecursos}
              prefix={<DatabaseOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Categorías"
              value={sections.length}
              prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Carpetas de Recursos"
              value={totalTareas}
              prefix={<UnorderedListOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Body: sidebar + main */}
      <Row gutter={16} align="top">
        {/* Sidebar */}
        <Col xs={24} md={6}>
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>SECCIONES</Text>}
            styles={{ body: { padding: '8px 12px' } }}
            style={{ borderRadius: 8, position: 'sticky', top: 16 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sections.map(s => (
                <SectionCard
                  key={s.id}
                  section={s}
                  isActive={s.id === activeSection}
                  onClick={() => { setActiveSection(s.id); setSearch(''); loadSectionAttachments(s.id); }}
                />
              ))}
            </div>
          </Card>
        </Col>

        {/* Main panel */}
        <Col xs={24} md={18}>
          {currentSection && (
            <Card
              style={{ borderRadius: 8 }}
              styles={{ header: { borderBottom: `2px solid ${currentSection.tipoColor}33`, background: `${currentSection.tipoColor}08` } }}
              title={
                <Space>
                  <Tag style={{ background: `${currentSection.tipoColor}18`, color: currentSection.tipoColor, borderColor: `${currentSection.tipoColor}44` }}>
                    {currentSection.tipo}
                  </Tag>
                  <Text strong style={{ fontSize: 15 }}>{currentSection.name}</Text>
                </Space>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <strong>{totalLinks}</strong> recursos disponibles
                </Text>
              }
            >
              {sectionLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Spin tip="Cargando recursos..." />
                </div>
              ) : filteredTasks.length === 0 ? (
                <Empty
                  description={search ? `No se encontraron resultados para "${search}"` : 'No hay tareas en esta sección'}
                  style={{ padding: '2rem 0' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {filteredTasks.map(task => (
                    <TaskRow key={task.id} task={task} accentColor={currentSection.tipoColor} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ResourceLibraryPage;
