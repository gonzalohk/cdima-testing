import React, { useState, useEffect } from 'react';
import { Alert, Button, Modal, Select, Space, Spin, Typography } from 'antd';
import {
  DollarOutlined,
  FolderOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaProject, AsanaSection, AsanaTask } from '../types/asana.types';

const { Text } = Typography;

export type SolicitudType = 'material' | 'fondos' | 'devolucion';

interface NuevaSolicitudModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (task: AsanaTask, type: SolicitudType, meta?: { projectName?: string; sectionName?: string }) => void;
  /** Área restringida para técnicos, p.ej. "Erradicación de Violencia" o "Empoderamiento Político" */
  tecnicoArea?: string | null;
}

const TYPE_OPTIONS: { value: SolicitudType; label: string; icon: React.ReactNode }[] = [
  { value: 'material',   label: 'Solicitud de Material',  icon: <InboxOutlined /> },
  { value: 'fondos',     label: 'Solicitud de Fondos',    icon: <DollarOutlined /> },
  { value: 'devolucion', label: 'Devolución de Material', icon: <ReloadOutlined /> },
];

const NuevaSolicitudModal: React.FC<NuevaSolicitudModalProps> = ({ open, onClose, onConfirm, tecnicoArea }) => {
  const [projects, setProjects]               = useState<AsanaProject[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [sections, setSections]               = useState<AsanaSection[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [tasks, setTasks]                     = useState<{ gid: string; name: string }[]>([]);
  const [selectedTask, setSelectedTask]       = useState('');
  const [solType, setSolType]                 = useState<SolicitudType | ''>('');

  const [loadingProjects,  setLoadingProjects]  = useState(false);
  const [loadingSections,  setLoadingSections]  = useState(false);
  const [loadingTasks,     setLoadingTasks]     = useState(false);
  const [loadingConfirm,   setLoadingConfirm]   = useState(false);
  const [error, setError] = useState('');

  // ── Load projects when modal opens ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSelectedProject('');
    setSelectedSection('');
    setSelectedTask('');
    setSolType('');
    setSections([]);
    setTasks([]);
    setError('');

    setLoadingProjects(true);
    (async () => {
      try {
        const wss  = await asanaService.getWorkspaces();
        const cdima = wss.find(ws => ws.name === 'CDIMA');
        if (!cdima) throw new Error('Workspace CDIMA no encontrado');
        const all = await asanaService.getProjects(cdima.gid);
        let candidates = all.filter(p => !p.name.toUpperCase().includes('CDIMA'));

        // Para técnicos: filtrar solo proyectos del área restringida
        if (tecnicoArea) {
          const areaLower = tecnicoArea.toLowerCase();
          const checked = await Promise.all(
            candidates.map(async p => {
              try {
                const resumen = await asanaService.getProjectResumenTask(p.gid);
                const areaField = resumen?.custom_fields?.find(
                  f => f.name.toLowerCase().replace(/á/g, 'a') === 'area'
                );
                const areaVal = (areaField?.enum_value?.name ?? areaField?.display_value ?? '').toLowerCase();
                return areaVal.includes(areaLower) ? p : null;
              } catch {
                return null;
              }
            })
          );
          candidates = checked.filter((p): p is AsanaProject => p !== null);
        }

        setProjects(candidates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [open]);

  // ── Load sections when project changes ────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) { setSections([]); setSelectedSection(''); setTasks([]); setSelectedTask(''); return; }
    setLoadingSections(true);
    setSelectedSection('');
    setTasks([]);
    setSelectedTask('');
    asanaService
      .getSections(selectedProject)
      .then(setSections)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar secciones'))
      .finally(() => setLoadingSections(false));
  }, [selectedProject]);

  // ── Load tasks when section changes ───────────────────────────────────────
  useEffect(() => {
    if (!selectedSection) { setTasks([]); setSelectedTask(''); return; }
    setLoadingTasks(true);
    setSelectedTask('');
    asanaService
      .getSectionTasks(selectedSection)
      .then(ts => {
        setTasks(
          ts
            .filter(t =>
              !t.name.startsWith('FUENTES DE VERIFICACION') &&
              !t.name.startsWith('Resumen:') &&
              !t.name.startsWith('SFON') &&
              !t.name.startsWith('SMAT') &&
              !t.name.startsWith('DMAT') &&
              !t.name.startsWith('CPER')
            )
            .map(t => ({ gid: t.gid, name: t.name }))
        );
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar actividades'))
      .finally(() => setLoadingTasks(false));
  }, [selectedSection]);

  const canConfirm = !!selectedTask && !!solType;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoadingConfirm(true);
    setError('');
    try {
      const fullTask = await asanaService.getTask(selectedTask);
      const projectName = projects.find(p => p.gid === selectedProject)?.name;
      const sectionName = sections.find(s => s.gid === selectedSection)?.name;
      onConfirm(fullTask, solType as SolicitudType, { projectName, sectionName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la actividad');
    } finally {
      setLoadingConfirm(false);
    }
  };

  const handleClose = () => {
    if (loadingConfirm) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Space>
          <span style={{ fontSize: 20 }}>📋</span>
          <Text strong>Nueva Solicitud</Text>
        </Space>
      }
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} disabled={loadingConfirm}>
            Cancelar
          </Button>
          <Button
            type="primary"
            disabled={!canConfirm}
            loading={loadingConfirm}
            onClick={handleConfirm}
          >
            Continuar
          </Button>
        </Space>
      }
      destroyOnClose
      width={500}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>

        {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />}

        {/* ── Proyecto ──────────────────────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%', background: '#1565C0', color: '#fff',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>1</span>
            <Text strong style={{ fontSize: 13 }}>Proyecto</Text>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder={loadingProjects ? 'Cargando proyectos...' : 'Selecciona un proyecto'}
            disabled={loadingProjects}
            loading={loadingProjects}
            value={selectedProject || undefined}
            onChange={v => setSelectedProject(v)}
            options={projects.map(p => ({ label: p.name, value: p.gid }))}
            suffixIcon={loadingProjects ? <Spin size="small" /> : <FolderOutlined />}
            showSearch
            filterOption={(input, opt) =>
              String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        {/* ── Sección ───────────────────────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: selectedProject ? '#1565C0' : '#e0e0e0',
              color: selectedProject ? '#fff' : '#bdbdbd',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              transition: 'background .3s',
            }}>2</span>
            <Text strong style={{ fontSize: 13, color: selectedProject ? '#263238' : '#bdbdbd', transition: 'color .3s' }}>
              Sección / Año
            </Text>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder={
              !selectedProject ? 'Primero selecciona un proyecto' :
              loadingSections   ? 'Cargando secciones...' :
              sections.length === 0 ? 'Sin secciones' :
              'Selecciona una sección'
            }
            disabled={!selectedProject || loadingSections}
            loading={loadingSections}
            value={selectedSection || undefined}
            onChange={v => setSelectedSection(v)}
            options={sections.map(s => ({ label: s.name, value: s.gid }))}
            showSearch
            filterOption={(input, opt) =>
              String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        {/* ── Actividad ─────────────────────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: selectedSection ? '#1565C0' : '#e0e0e0',
              color: selectedSection ? '#fff' : '#bdbdbd',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              transition: 'background .3s',
            }}>3</span>
            <Text strong style={{ fontSize: 13, color: selectedSection ? '#263238' : '#bdbdbd', transition: 'color .3s' }}>
              Actividad
            </Text>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder={
              !selectedSection  ? 'Primero selecciona una sección' :
              loadingTasks      ? 'Cargando actividades...' :
              tasks.length === 0 ? 'Sin actividades en esta sección' :
              'Selecciona una actividad'
            }
            disabled={!selectedSection || loadingTasks}
            loading={loadingTasks}
            value={selectedTask || undefined}
            onChange={v => setSelectedTask(v)}
            options={tasks.map(t => ({ label: t.name, value: t.gid }))}
            showSearch
            filterOption={(input, opt) =>
              String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        {/* ── Tipo de solicitud ─────────────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: selectedTask ? '#b45309' : '#e0e0e0',
              color: selectedTask ? '#fff' : '#bdbdbd',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              transition: 'background .3s',
            }}>4</span>
            <Text strong style={{ fontSize: 13, color: selectedTask ? '#263238' : '#bdbdbd', transition: 'color .3s' }}>
              Tipo de solicitud
            </Text>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder={!selectedTask ? 'Primero selecciona una actividad' : 'Selecciona el tipo'}
            disabled={!selectedTask}
            value={solType || undefined}
            onChange={v => setSolType(v)}
            options={TYPE_OPTIONS.map(t => ({
              label: (
                <Space>
                  {t.icon}
                  <span>{t.label}</span>
                </Space>
              ),
              value: t.value,
            }))}
          />
        </div>

      </div>
    </Modal>
  );
};

export default NuevaSolicitudModal;
