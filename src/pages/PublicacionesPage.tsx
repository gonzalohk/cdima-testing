import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaTask } from '../types/asana.types';
import { useAuth } from '../context/AuthContext';

const PROJECT_QUERY = 'Publicaciones CDIMA';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Publicacion {
  task: AsanaTask;
  subtasks: AsanaTask[];
}

// ─────────────────────────────────────────────────────────────
// Helpers — custom field "url" stores JSON { enlaces: [...] }
// ─────────────────────────────────────────────────────────────
function parseLinks(task: AsanaTask): { nombre: string; url: string }[] {
  const field = task.custom_fields?.find(f => f.name.toLowerCase() === 'url');
  if (!field?.text_value) return [];
  try {
    const d = JSON.parse(field.text_value);
    return Array.isArray(d.enlaces) ? d.enlaces : [];
  } catch {
    return [];
  }
}

function getUrlFieldGid(task: AsanaTask): string | null {
  return task.custom_fields?.find(f => f.name.toLowerCase() === 'url')?.gid ?? null;
}

// ─────────────────────────────────────────────────────────────
// Color palette — one entry per menu, cycles like FILE_COLORS
// ─────────────────────────────────────────────────────────────
const PUB_PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: '#fdf0eb', border: '#d4886a', text: '#a84020' }, // naranja
  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' }, // azul
  { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' }, // verde
  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08' }, // ámbar
  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab' }, // violeta
  { bg: '#fff0f6', border: '#ffadd2', text: '#c41d7f' }, // rosa
  { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322' }, // rojo
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const PublicacionesPage: React.FC = () => {
  const { user } = useAuth();
  const isDirector = user?.role === 'director';
  const [searchParams, setSearchParams] = useSearchParams();
  const didAutoOpen = useRef(false);

  // project metadata
  const [projectGid, setProjectGid] = useState<string | null>(null);
  const [workspaceGid, setWorkspaceGid] = useState<string | null>(null);
  const [sectionGid, setSectionGid] = useState<string | null>(null);

  // data
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [selectedPub, setSelectedPub] = useState<Publicacion | null>(null);

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // modal: create/edit menu (task)
  const [menuModal, setMenuModal] = useState<{ open: boolean; editing: AsanaTask | null }>({ open: false, editing: null });
  const [menuForm] = Form.useForm();
  const [menuSaving, setMenuSaving] = useState(false);

  // modal: create/edit subtask
  const [subModal, setSubModal] = useState<{ open: boolean; editing: AsanaTask | null }>({ open: false, editing: null });
  const [subForm] = Form.useForm();
  const [subSaving, setSubSaving] = useState(false);

  // modal: links on subtask
  const [linkModal, setLinkModal] = useState<AsanaTask | null>(null);
  const [linkNombre, setLinkNombre] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Only fetch workspace/project if not already known
      let pgid = projectGid;
      let wgid = workspaceGid;
      let sgid = sectionGid;

      if (!pgid || !wgid) {
        const workspaces = await asanaService.getWorkspaces();
        const cdima = workspaces.find(ws => ws.name === 'CDIMA');
        if (!cdima) throw new Error('Workspace CDIMA no encontrado');

        const projects = await asanaService.getProjects(cdima.gid);
        const pub = projects.find(p => p.name === PROJECT_QUERY);
        if (!pub) throw new Error(`Proyecto "${PROJECT_QUERY}" no encontrado`);

        pgid = pub.gid;
        wgid = cdima.gid;
        setProjectGid(pgid);
        setWorkspaceGid(wgid);
      }

      if (!sgid) {
        const sections = await asanaService.getSections(pgid);
        const pubSection = sections.find(s => s.name.toLowerCase().includes('publicacion')) ?? sections[0];
        sgid = pubSection?.gid ?? null;
        setSectionGid(sgid);
      }

      // Get all tasks in project (top-level menus)
      const allTasks = await asanaService.getProjectTasks(pgid);
      const menuTasks = allTasks.filter(t => !t.parent && !t.name.startsWith('Resumen:'));

      // Fetch subtasks for each menu in parallel
      const pubs: Publicacion[] = await Promise.all(
        menuTasks.map(async task => {
          if (!task.num_subtasks) return { task, subtasks: [] };
          try {
            const subs = await asanaService.getSubtasks(task.gid);
            return { task, subtasks: subs };
          } catch {
            return { task, subtasks: [] };
          }
        })
      );

      setPublicaciones(pubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar publicaciones');
    } finally {
      setLoading(false);
    }
  }, [projectGid, workspaceGid, sectionGid]);

  // Sync selectedPub with URL tab param (no re-fetch needed)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    setSelectedPub(prev => {
      if (publicaciones.length === 0) return prev;
      if (tabParam) return publicaciones.find(p => p.task.gid === tabParam) ?? publicaciones[0] ?? null;
      if (!prev) return publicaciones[0] ?? null;
      const updated = publicaciones.find(p => p.task.gid === prev.task.gid);
      return updated ?? publicaciones[0] ?? null;
    });
  }, [searchParams, publicaciones]);

  useEffect(() => { load(); }, [load]);

  // Auto-open create modal when ?newMenu=1 (only once per navigation, after load completes)
  useEffect(() => {
    if (searchParams.get('newMenu') !== '1') {
      didAutoOpen.current = false;
      return;
    }
    if (isDirector && !loading && !didAutoOpen.current) {
      didAutoOpen.current = true;
      menuForm.resetFields();
      setMenuModal({ open: true, editing: null });
    }
  }, [searchParams, isDirector, loading, menuForm]);

  // ── Menu CRUD ─────────────────────────────────────────────
  const openCreateMenu = () => {
    menuForm.resetFields();
    setMenuModal({ open: true, editing: null });
  };
  const openEditMenu = (task: AsanaTask, e: React.MouseEvent) => {
    e.stopPropagation();
    menuForm.setFieldsValue({ name: task.name, notes: task.notes ?? '' });
    setMenuModal({ open: true, editing: task });
  };

  const handleMenuSave = async () => {
    const values = await menuForm.validateFields();
    if (!projectGid || !workspaceGid) return;
    setMenuSaving(true);
    try {
      if (menuModal.editing) {
        await asanaService.updateTask(menuModal.editing.gid, { name: values.name, notes: values.notes ?? '' });
      } else {
        const newTask = await asanaService.createTask({
          name: values.name,
          notes: values.notes ?? '',
          projectGid,
          workspaceGid,
          sectionGid: sectionGid ?? undefined,
        });
        setMenuModal({ open: false, editing: null });
        await load();
        window.dispatchEvent(new CustomEvent('publicaciones:refresh'));
        setSearchParams({ tab: newTask.gid });
        return;
      }
      setMenuModal({ open: false, editing: null });
      await load();
      window.dispatchEvent(new CustomEvent('publicaciones:refresh'));
    } catch (err) {
      console.error(err);
    } finally {
      setMenuSaving(false);
    }
  };

  const handleDeleteMenu = async (pub: Publicacion) => {
    try {
      // Delete all subtasks first
      for (const sub of pub.subtasks) {
        await asanaService.deleteTask(sub.gid);
      }
      await asanaService.deleteTask(pub.task.gid);
      if (selectedPub?.task.gid === pub.task.gid) setSelectedPub(null);
      await load();
      window.dispatchEvent(new CustomEvent('publicaciones:refresh'));
    } catch (err) {
      console.error(err);
    }
  };

  // ── Subtask CRUD ─────────────────────────────────────────
  const openCreateSub = () => {
    subForm.resetFields();
    setSubModal({ open: true, editing: null });
  };
  const openEditSub = (task: AsanaTask, e: React.MouseEvent) => {
    e.stopPropagation();
    subForm.setFieldsValue({ name: task.name, notes: task.notes ?? '' });
    setSubModal({ open: true, editing: task });
  };

  const handleSubSave = async () => {
    if (!selectedPub || !workspaceGid) return;
    const values = await subForm.validateFields();
    setSubSaving(true);
    try {
      if (subModal.editing) {
        await asanaService.updateTask(subModal.editing.gid, { name: values.name, notes: values.notes ?? '' });
      } else {
        await asanaService.createSubtask(selectedPub.task.gid, workspaceGid, {
          name: values.name,
          notes: values.notes ?? '',
        });
      }
      setSubModal({ open: false, editing: null });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSubSaving(false);
    }
  };

  const handleDeleteSub = async (sub: AsanaTask) => {
    try {
      await asanaService.deleteTask(sub.gid);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Links on subtask ──────────────────────────────────────
  const openLinkModal = (sub: AsanaTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkNombre('');
    setLinkUrl('');
    setLinkModal(sub);
  };

  const handleAddLink = async () => {
    if (!linkModal) return;
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      alert('El enlace debe comenzar con http:// o https://');
      return;
    }
    const fieldGid = getUrlFieldGid(linkModal);
    if (!fieldGid) {
      alert('Esta subtarea no tiene el campo "url" disponible. Verifica la configuración del proyecto en Asana.');
      return;
    }
    setLinkSaving(true);
    try {
      const existing = parseLinks(linkModal);
      const updated = [...existing, { nombre: linkNombre.trim() || trimmedUrl, url: trimmedUrl }];
      await asanaService.updateTask(linkModal.gid, {
        custom_fields: { [fieldGid]: JSON.stringify({ enlaces: updated }) },
      });
      setLinkModal(null);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteLink = async (sub: AsanaTask, idx: number) => {
    const fieldGid = getUrlFieldGid(sub);
    if (!fieldGid) return;
    const existing = parseLinks(sub);
    const updated = existing.filter((_, i) => i !== idx);
    try {
      await asanaService.updateTask(sub.gid, {
        custom_fields: { [fieldGid]: JSON.stringify({ enlaces: updated }) },
      });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Render helpers ─────────────────────────────────────────
  const renderSubtasks = (pub: Publicacion, color: typeof PUB_PALETTE[0]) => (
    <div style={{ marginTop: '1.25rem' }}>
      {isDirector && (
        <div style={{ marginBottom: '1.25rem' }}>
          <Button
            icon={<PlusOutlined />}
            style={{ borderColor: color.border, color: color.text }}
            onClick={openCreateSub}
          >
            Agregar elemento
          </Button>
        </div>
      )}
      {pub.subtasks.length === 0 ? (
        <Empty description="Sin elementos en este menú" styles={{ image: { height: 56 } }} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {pub.subtasks.map(sub => {
            const enlaces = parseLinks(sub);
            const subDesc = (sub.notes ?? '').trim();
            return (
              <div key={sub.gid} style={{
                background: 'white',
                border: `1px solid ${color.border}`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{
                  background: color.bg,
                  padding: '0.75rem 1rem 0.625rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  borderBottom: `1px solid ${color.border}40`,
                }}>
                  <Typography.Text strong style={{ fontSize: 14, color: color.text, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                    {sub.name}
                  </Typography.Text>
                  {isDirector && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <Tooltip title="Agregar enlace">
                        <Button
                          size="small" type="text"
                          icon={<LinkOutlined style={{ color: color.text, fontSize: 13 }} />}
                          style={{ padding: '0 4px', height: 22 }}
                          onClick={e => openLinkModal(sub, e)}
                        />
                      </Tooltip>
                      <Tooltip title="Editar">
                        <Button
                          size="small" type="text"
                          icon={<EditOutlined style={{ color: color.text, fontSize: 13 }} />}
                          style={{ padding: '0 4px', height: 22 }}
                          onClick={e => openEditSub(sub, e)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="¿Eliminar este elemento?"
                        onConfirm={() => handleDeleteSub(sub)}
                        okText="Eliminar" cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="Eliminar">
                          <Button
                            size="small" type="text"
                            icon={<DeleteOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />}
                            style={{ padding: '0 4px', height: 22 }}
                            onClick={e => e.stopPropagation()}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {subDesc && (
                    <Typography.Paragraph style={{ fontSize: 12, color: '#595959', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {subDesc}
                    </Typography.Paragraph>
                  )}

                  {enlaces.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: subDesc ? 4 : 0 }}>
                      {enlaces.map((enlace, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 0', borderBottom: idx < enlaces.length - 1 ? '1px dashed #f0f0f0' : 'none' }}>
                          <a
                            href={enlace.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: color.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}
                          >
                            <LinkOutlined style={{ fontSize: 11, flexShrink: 0, color: color.border }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enlace.nombre}</span>
                          </a>
                          {isDirector && (
                            <Popconfirm
                              title="¿Eliminar este enlace?"
                              onConfirm={() => handleDeleteLink(sub, idx)}
                              okText="Eliminar" cancelText="Cancelar"
                              okButtonProps={{ danger: true }}
                            >
                              <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#bbb', fontSize: 12, lineHeight: 1, flexShrink: 0 }}
                                onClick={e => e.stopPropagation()}
                              >✕</button>
                            </Popconfirm>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {enlaces.length === 0 && !subDesc && (
                    <span style={{ fontSize: 11, color: '#d1d5db', fontStyle: 'italic' }}>Sin descripción ni enlaces</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#6b7280' }}>Cargando publicaciones...</div>
        </div>
      ) : publicaciones.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '4rem 2rem', textAlign: 'center' }}>
          <Empty
            description={isDirector ? 'No hay menús aún. Crea el primero.' : 'No hay publicaciones disponibles.'}
            styles={{ image: { height: 64 } }}
          >
            {isDirector && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateMenu}
                style={{ background: '#6366f1', borderColor: '#6366f1' }}>
                Nuevo menú
              </Button>
            )}
          </Empty>
        </div>
      ) : !selectedPub ? (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '4rem 2rem', textAlign: 'center' }}>
          <Empty description="Selecciona un menú del panel lateral" styles={{ image: { height: 64 } }} />
        </div>
      ) : (
        (() => {
          const pubColorIdx = publicaciones.findIndex(p => p.task.gid === selectedPub.task.gid);
          const pubColor = PUB_PALETTE[Math.max(0, pubColorIdx) % PUB_PALETTE.length];
          return (
        <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '1.5rem 1.75rem' }}>
          {/* Título de sección */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pubColor.bg, borderRadius: 8, fontSize: 18, flexShrink: 0 }}>📄</span>
              <div>
                <Typography.Title level={3} style={{ margin: 0, color: '#1a1a1a' }}>
                  {selectedPub.task.name}
                </Typography.Title>
                {(() => {
                  const desc = (selectedPub.task.notes ?? '').replace(/\n*===DATOS_JSON===[\/\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
                  return desc ? <Typography.Text type="secondary" style={{ fontSize: 13 }}>{desc}</Typography.Text> : null;
                })()}
              </div>
            </div>
            {isDirector && (
              <div style={{ display: 'flex', gap: 4 }}>
                <Tooltip title="Editar menú">
                  <Button type="text" size="small" icon={<EditOutlined />} style={{ color: pubColor.text }} onClick={e => openEditMenu(selectedPub.task, e)} />
                </Tooltip>
                <Popconfirm
                  title="¿Eliminar este menú?"
                  description="Se eliminarán también todos sus elementos."
                  onConfirm={() => handleDeleteMenu(selectedPub)}
                  okText="Eliminar" cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ff4d4f' }} />
                </Popconfirm>
              </div>
            )}
          </div>
          {renderSubtasks(selectedPub, pubColor)}
        </div>
          );
        })()
      )}

      {/* ── Modal: crear/editar menú ── */}
      <Modal
        open={menuModal.open}
        title={menuModal.editing ? '✏️ Editar menú' : '📢 Nuevo menú'}
        onCancel={() => setMenuModal({ open: false, editing: null })}
        onOk={handleMenuSave}
        confirmLoading={menuSaving}
        okText={menuModal.editing ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={menuForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'El nombre es obligatorio' }]}>
            <Input placeholder="Ej: Convenios institucionales" />
          </Form.Item>
          <Form.Item name="notes" label="Descripción (opcional)">
            <Input.TextArea rows={3} placeholder="Descripción breve de esta sección de publicaciones..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: crear/editar elemento (subtarea) ── */}
      <Modal
        open={subModal.open}
        title={subModal.editing ? '✏️ Editar elemento' : '➕ Nuevo elemento'}
        onCancel={() => setSubModal({ open: false, editing: null })}
        onOk={handleSubSave}
        confirmLoading={subSaving}
        okText={subModal.editing ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={subForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Título" rules={[{ required: true, message: 'El título es obligatorio' }]}>
            <Input placeholder="Ej: Convenio con Universidad Mayor de San Simón" />
          </Form.Item>
          <Form.Item name="notes" label="Descripción (opcional)">
            <Input.TextArea rows={4} placeholder="Detalles, contexto, fecha, etc." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: agregar enlace ── */}
      <Modal
        open={!!linkModal}
        title="🔗 Agregar enlace"
        onCancel={() => setLinkModal(null)}
        onOk={handleAddLink}
        confirmLoading={linkSaving}
        okText="Agregar"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              Nombre del enlace
            </label>
            <Input
              value={linkNombre}
              onChange={e => setLinkNombre(e.target.value)}
              placeholder="Ej: Ver documento completo"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              URL <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              type="url"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PublicacionesPage;
