import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Col, Divider, Empty, Input, Row, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  FolderOutlined, FileTextOutlined, FileExcelOutlined, FilePptOutlined, FileImageOutlined,
  VideoCameraOutlined, PaperClipOutlined, FilePdfOutlined, SearchOutlined,
  FolderOpenOutlined, LinkOutlined, DownloadOutlined, RightOutlined,
  DatabaseOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaTask, AsanaAttachment } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';

const { Text, Title } = Typography;

// ─── Interfaces ───────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const detectFileType = (url: string, label: string): string => {
  const u = url.toLowerCase();
  const l = label.toLowerCase();
  if (u.includes('/folders/')) return 'folder';
  if (u.includes('.pdf') || l.includes('.pdf')) return 'pdf';
  if (u.match(/\.(doc|docx)/) || l.match(/\.(doc|docx)/)) return 'doc';
  if (u.match(/\.(xls|xlsx)/) || l.match(/\.(xls|xlsx)/) || u.includes('spreadsheet')) return 'sheet';
  if (u.match(/\.(ppt|pptx)/) || l.match(/\.(ppt|pptx)/) || u.includes('presentation')) return 'slide';
  if (u.match(/\.(jpg|jpeg|png|gif|svg|webp)/) || l.match(/\.(jpg|jpeg|png|gif|svg|webp)/)) return 'image';
  if (u.match(/\.(mp4|mov|avi|webm)/) || l.match(/\.(mp4|mov|avi|webm)/)) return 'video';
  if (u.includes('document')) return 'doc';
  return 'other';
};

const FILE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  folder: { bg: '#fdf0eb', border: '#d4886a', text: '#a84020' },
  pdf:    { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322' },
  doc:    { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
  sheet:  { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' },
  slide:  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08' },
  image:  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab' },
  video:  { bg: '#fff0f6', border: '#ffadd2', text: '#c41d7f' },
  other:  { bg: '#f5f5f5', border: '#d9d9d9', text: '#595959' },
};

const FILE_LABELS: Record<string, string> = {
  folder: 'Carpeta', pdf: 'PDF', doc: 'Documento', sheet: 'Hoja de cálculo',
  slide: 'Presentación', image: 'Imagen', video: 'Video', other: 'Recurso',
};

const getFileTypeColors = (type: string) => FILE_COLORS[type] ?? FILE_COLORS.other;
const getFileTypeLabel  = (type: string) => FILE_LABELS[type] ?? FILE_LABELS.other;

const getAntIcon = (fileType: string): React.ReactNode => ({
  folder: <FolderOutlined />,
  pdf:    <FilePdfOutlined />,
  doc:    <FileTextOutlined />,
  sheet:  <FileExcelOutlined />,
  slide:  <FilePptOutlined />,
  image:  <FileImageOutlined />,
  video:  <VideoCameraOutlined />,
  other:  <PaperClipOutlined />,
}[fileType] ?? <PaperClipOutlined />);

const getDominantFileType = (links: Link[]): string => {
  if (!links.length) return 'other';
  const counts = links.reduce<Record<string, number>>((acc, l) => {
    const t = detectFileType(l.viewUrl || l.downloadUrl || '', l.label);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
};

const getSectionTypeColor = (sectionName: string): { tipo: string; color: string } => {
  const n = sectionName.toLowerCase();
  if (n.includes('campaña') || n.includes('comunicacional')) return { tipo: 'Campaña',     color: '#722ed1' };
  if (n.includes('testimonio'))                              return { tipo: 'Testimonios',  color: '#08979c' };
  if (n.includes('diseño') || n.includes('material'))       return { tipo: 'Materiales',   color: '#d46b08' };
  if (n.includes('módulo') || n.includes('estudio'))        return { tipo: 'Módulos',      color: '#cf1322' };
  if (n.includes('archivo') || n.includes('fotográfi'))     return { tipo: 'Fotografía',   color: '#0958d9' };
  if (n.includes('informe'))                                 return { tipo: 'Informes',     color: '#c41d7f' };
  return { tipo: 'Material Comunicacional', color: '#389e0d' };
};

// Colores de la Wiphala (bandera del pueblo andino) — experimental
const WIPHALA_COLORS = [
  '#C8161D', // rojo
  '#D46200', // naranja
  '#B8860B', // dorado
  '#007A3D', // verde
  '#003DA5', // azul
  '#3B0CBD', // índigo
  '#7B2FBE', // violeta
];

const convertAttachmentsToLinks = (attachments?: AsanaAttachment[]): Link[] =>
  (attachments ?? [])
    .filter(a => a.view_url || a.download_url)
    .map(a => ({ id: a.gid, label: a.name, viewUrl: a.view_url, downloadUrl: a.download_url }));

// Separa un código técnico del nombre legible: "2025-SAIH-1-1 BANNERS" → { code, label }
const parseTaskName = (name: string): { code: string | null; label: string } => {
  const m = name.match(/^(\d{4}[-–][\w.-]+(?:[-–][\w.-]+)*)\s+(.+)$/);
  return m ? { code: m[1], label: m[2] } : { code: null, label: name };
};

const convertAsanaTaskToTask = (t: AsanaTask): Task => ({
  id: t.gid,
  name: t.name,
  estado: t.completed ? 'Entregado' : null,
  links: convertAttachmentsToLinks(t.attachments),
  subtasks: (t.subtasks ?? []).map(st => ({
    id: st.gid, name: st.name, links: convertAttachmentsToLinks(st.attachments),
  })),
});

// ─── DriveLink: Avatar + texto + botón ghost ───────────────────────────────
const DriveLink: React.FC<{ link: Link }> = ({ link }) => {
  const fileType = detectFileType(link.viewUrl || link.downloadUrl || '', link.label);
  const colors   = getFileTypeColors(fileType);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      {fileType === 'folder' ? (
        <span style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FolderOutlined style={{ fontSize: 22, color: colors.text }} />
        </span>
      ) : (
        <Avatar
          size={30}
          icon={getAntIcon(fileType)}
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text ellipsis={{ tooltip: link.label }} style={{ fontSize: 13, display: 'block', lineHeight: 1.3 }}>
          {link.label}
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{getFileTypeLabel(fileType)}</Text>
      </div>
      <Space size={2}>
        {link.viewUrl && (
          <Button type="link" size="small" icon={<LinkOutlined />} href={link.viewUrl} target="_blank"
            style={{ padding: '0 6px', fontSize: 12, color: '#a84020' }}>
            Abrir
          </Button>
        )}
        {link.downloadUrl && (
          <Tooltip title="Descargar">
            <Button type="text" size="small" icon={<DownloadOutlined />} href={link.downloadUrl} target="_blank"
              style={{ color: '#8c8c8c', padding: '0 4px' }} />
          </Tooltip>
        )}
      </Space>
    </div>
  );
};

// ─── SubtaskRow: expandible dentro de TaskRow ─────────────────────────────
const SubtaskRow: React.FC<{ subtask: Subtask; accentColor: string }> = ({ subtask, accentColor }) => {
  const [expanded, setExpanded] = useState(false);
  const hasLinks = subtask.links.length > 0;
  return (
    <div style={{ marginBottom: 2 }}>
      <div
        onClick={() => hasLinks && setExpanded(x => !x)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: hasLinks ? 'pointer' : 'default' }}
      >
        <RightOutlined style={{
          fontSize: 10, color: accentColor,
          transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s',
        }} />
        <FolderOpenOutlined style={{ color: accentColor, fontSize: 13 }} />
        <Text style={{ fontSize: 13, flex: 1 }}>{subtask.name}</Text>
        {hasLinks && <Badge count={subtask.links.length} style={{ background: accentColor, fontSize: 10 }} />}
      </div>
      {expanded && hasLinks && (
        <div style={{ paddingLeft: 28, borderLeft: `2px solid ${accentColor}30`, marginLeft: 12, paddingBottom: 6 }}>
          {subtask.links.map(l => <DriveLink key={l.id} link={l} />)}
        </div>
      )}
    </div>
  );
};

// ─── TaskRow: fila expandible sin card anidada ────────────────────────────
const TaskRow: React.FC<{ task: Task; accentColor: string }> = ({ task, accentColor }) => {
  const [expanded, setExpanded] = useState(false);
  const allLinks   = [...task.links, ...task.subtasks.flatMap(st => st.links)];
  const domType    = getDominantFileType(allLinks);
  const colors     = getFileTypeColors(domType);
  const hasContent = task.links.length > 0 || task.subtasks.length > 0;
  const { code, label } = parseTaskName(task.name);

  return (
    <div
      style={{ borderBottom: '1px solid #f0f0f0', background: expanded ? '#f5f7ff' : 'transparent', transition: 'background .2s' }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.background = '#fafbff'; }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div
        onClick={() => hasContent && setExpanded(x => !x)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: hasContent ? 'pointer' : 'default', userSelect: 'none' }}
      >
        <Avatar
          size={38}
          icon={getAntIcon(domType)}
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span>
            {code && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.2, marginBottom: 1 }}>{code}</Text>
            )}
            <Text strong style={{ fontSize: 14, color: task.estado ? '#aaa' : '#1a1a1a', textDecoration: task.estado ? 'line-through' : 'none' }}>
              {label}
            </Text>
            {task.estado && <Tag color="success" style={{ marginLeft: 6, fontSize: 11 }}>{task.estado}</Tag>}
          </span>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 1 }}>
            {allLinks.length > 0
              ? `${allLinks.length} ${allLinks.length === 1 ? 'recurso' : 'recursos'}${task.subtasks.length > 0 ? ` · ${task.subtasks.length} subcarpetas` : ''}`
              : 'Sin recursos adjuntos'}
          </Text>
        </div>
        {hasContent && (
          <RightOutlined style={{ color: '#bbb', fontSize: 13, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        )}
      </div>

      {expanded && (
        <div style={{ paddingLeft: 50, paddingBottom: 12 }}>
          {task.links.length > 0 && (
            <div style={{ marginBottom: task.subtasks.length > 0 ? 8 : 0 }}>
              {task.links.map(l => <DriveLink key={l.id} link={l} />)}
            </div>
          )}
          {task.subtasks.length > 0 && (
            <>
              {task.links.length > 0 && <Divider dashed style={{ margin: '6px 0' }} />}
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                <FolderOutlined style={{ marginRight: 4 }} />Subcarpetas
              </Text>
              {task.subtasks.map(st => <SubtaskRow key={st.id} subtask={st} accentColor={accentColor} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
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
  const loadedSectionIds    = useRef<Set<string>>(new Set());

  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) { navigate('/'); return; }
    loadWorkspaces();
  }, [navigate]);

  const loadWorkspaces = async () => {
    setLoading(true); setError('');
    try {
      const data = await asanaService.getWorkspaces();
      const cdima = data.find(ws => ws.name === 'CDIMA');
      if (cdima) await loadProjects(cdima.gid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
    } finally { setLoading(false); }
  };

  const loadProjects = async (workspaceGid: string) => {
    setLoading(true); setError('');
    try {
      const data = await asanaService.getProjects(workspaceGid);
      setProjects(data);
      const comunicacion = data.find(p =>
        p.name.toLowerCase().includes('comunicación') || p.name.toLowerCase().includes('comunicacion')
      );
      if (comunicacion) { setSelectedProject(comunicacion.gid); await loadResourceLibrary(comunicacion.gid); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
    } finally { setLoading(false); }
  };

  const loadSectionAttachments = useCallback(async (sectionId: string) => {
    if (loadedSectionIds.current.has(sectionId)) return;
    const rawTasks = rawTasksBySectionId.current.get(sectionId);
    if (!rawTasks?.length) { loadedSectionIds.current.add(sectionId); return; }
    setSectionLoading(true);
    try {
      const withAtt = await asanaService.getSectionTasksWithAttachments(rawTasks);
      loadedSectionIds.current.add(sectionId);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, tasks: withAtt.map(convertAsanaTaskToTask) } : s));
    } catch (err) {
      console.error('Error cargando adjuntos:', err);
    } finally { setSectionLoading(false); }
  }, []);

  const loadResourceLibrary = async (projectGid: string) => {
    setLoading(true); setError('');
    rawTasksBySectionId.current.clear();
    loadedSectionIds.current.clear();
    try {
      const { sections: asanaSections, tasksBySection } = await asanaService.getProjectSectionsAndTasks(projectGid);
      const converted: Section[] = asanaSections
        .map(s => {
          const sectionTasks = tasksBySection.get(s.gid) || [];
          rawTasksBySectionId.current.set(s.gid, sectionTasks);
          const { tipo, color } = getSectionTypeColor(s.name);
          return {
            id: s.gid, name: s.name, tipo, tipoColor: color,
            tasks: sectionTasks.map(t => ({ id: t.gid, name: t.name, estado: t.completed ? 'Entregado' : null, links: [], subtasks: [] })),
          };
        })
        .filter(s => s.tasks.length > 0);
      setSections(converted);
      if (converted.length > 0) { setActiveSection(converted[0].id); await loadSectionAttachments(converted[0].id); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar biblioteca');
    } finally { setLoading(false); }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  const filteredTasks = useMemo(() => {
    if (!currentSection) return [];
    if (!search) return currentSection.tasks;
    const q = search.toLowerCase();
    return currentSection.tasks.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.links.some(l => l.label.toLowerCase().includes(q)) ||
      t.subtasks.some(st => st.name.toLowerCase().includes(q) || st.links.some(l => l.label.toLowerCase().includes(q)))
    );
  }, [currentSection, search]);

  const sectionResourceCount = currentSection
    ? currentSection.tasks.reduce((acc, t) => acc + t.links.length + t.subtasks.reduce((a, st) => a + st.links.length, 0), 0)
    : 0;

  const totalRecursos = sections.reduce((acc, s) =>
    acc + s.tasks.reduce((a, t) => a + t.links.length + t.subtasks.reduce((b, st) => b + st.links.length, 0), 0), 0);

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Proyecto';

  if (loading) return <LoadingOverlay message="Cargando biblioteca de recursos..." />;
  if (error)   return <div style={{ padding: '2rem' }}><Empty description={error} /></div>;
  if (!sections.length) return (
    <div style={{ padding: '2rem' }}>
      <Empty description={`No se encontraron secciones con recursos en "${projectName}".`} />
    </div>
  );

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        padding: '1.25rem 1.75rem',
        background: 'white', borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <Space align="center">
          <span style={{ fontSize: 32 }}>📡</span>
          <div>
            <Title level={4} style={{ margin: 0 }}>{projectName}</Title>
            <Space size={16} style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <DatabaseOutlined style={{ marginRight: 4 }} />{totalRecursos} recursos
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <AppstoreOutlined style={{ marginRight: 4 }} />{sections.length} secciones
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <UnorderedListOutlined style={{ marginRight: 4 }} />
                {sections.reduce((acc, s) => acc + s.tasks.length, 0)} carpetas
              </Text>
            </Space>
          </div>
        </Space>
        <Input
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar tarea o recurso..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ width: 320, borderRadius: 8 }}
        />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <Row gutter={20} align="top">

        {/* Sidebar */}
        <Col xs={24} md={6} lg={5}>
          <div style={{
            position: 'sticky', top: 16,
            background: '#fafafa', borderRadius: 10,
            border: '1px solid #f0f0f0', overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #f0f0f0' }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#8c8c8c', letterSpacing: 1, textTransform: 'uppercase' }}>
                Secciones
              </Text>
            </div>
            <div style={{ padding: '6px 8px' }}>
              {sections.map((s, idx) => {
                const isActive = s.id === activeSection;
                const wipColor = WIPHALA_COLORS[idx % WIPHALA_COLORS.length];
                const rCount = s.tasks.reduce((acc, t) =>
                  acc + t.links.length + t.subtasks.reduce((a, st) => a + st.links.length, 0), 0);
                return (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSection(s.id); setSearch(''); loadSectionAttachments(s.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: 7, cursor: 'pointer', marginBottom: 3,
                      background: isActive ? wipColor : `${wipColor}22`,
                      borderLeft: `${isActive ? 6 : 4}px solid ${wipColor}`,
                      boxShadow: isActive ? `inset 0 0 0 1px rgba(255,255,255,0.3), 0 2px 6px ${wipColor}55` : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {s.tipo !== 'Material Comunicacional' && (
                        <Tag style={{
                          fontSize: 10, padding: '0 5px', marginBottom: 2, display: 'inline-block',
                          background: isActive ? 'rgba(255,255,255,0.25)' : `${wipColor}30`,
                          borderColor: isActive ? 'rgba(255,255,255,0.4)' : `${wipColor}66`,
                          color: isActive ? '#fff' : wipColor,
                        }}>
                          {s.tipo}
                        </Tag>
                      )}
                      <Text
                        style={{
                          fontSize: 13, display: 'block', lineHeight: 1.3,
                          color: isActive ? '#fff' : '#1a1a1a',
                          fontWeight: isActive ? 700 : 500,
                          textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                        }}
                        ellipsis={{ tooltip: s.name }}
                      >
                        {s.name}
                      </Text>
                    </div>
                    {rCount > 0 && (
                      <Badge count={rCount} overflowCount={99}
                        style={{
                          background: isActive ? 'rgba(255,255,255,0.35)' : wipColor,
                          color: isActive ? wipColor : '#fff',
                          fontSize: 10, marginLeft: 6, flexShrink: 0,
                          boxShadow: 'none',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Col>

        {/* Panel principal */}
        <Col xs={24} md={18} lg={19}>
          {currentSection && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{
                padding: '14px 20px',
                background: `${currentSection.tipoColor}08`,
                borderBottom: `2px solid ${currentSection.tipoColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              }}>
                <Space>
                  <Tag style={{
                    background: `${currentSection.tipoColor}18`, color: currentSection.tipoColor,
                    borderColor: `${currentSection.tipoColor}55`, fontWeight: 600,
                  }}>
                    {currentSection.tipo}
                  </Tag>
                  <Text strong style={{ fontSize: 15 }}>{currentSection.name}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {sectionResourceCount} recursos · {filteredTasks.length} carpetas
                </Text>
              </div>

              {/* Lista de tareas */}
              <div style={{ padding: '0 20px' }}>
                {sectionLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <Spin tip="Cargando recursos..." />
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <Empty
                    description={search ? `Sin resultados para "${search}"` : 'No hay tareas en esta sección'}
                    style={{ padding: '2rem 0' }}
                  />
                ) : (
                  filteredTasks.map(task => (
                    <TaskRow key={task.id} task={task} accentColor={currentSection.tipoColor} />
                  ))
                )}
              </div>
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ResourceLibraryPage;
