import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, Col, Collapse, Dropdown, Empty, Input, List, Modal, Popconfirm, Progress, Row, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { CalendarOutlined, CarryOutOutlined, CheckCircleFilled, CopyOutlined, DeleteOutlined, DeploymentUnitOutlined, DollarCircleOutlined, EnvironmentOutlined, FileSearchOutlined, FileTextOutlined, FileWordOutlined, HeartOutlined, InboxOutlined, LinkOutlined, MoreOutlined, PaperClipOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, TeamOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons';
import { AsanaTask, AsanaAttachment, TaskStatistics } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF, exportMaterialRequestToPDF, exportMaterialReturnToPDF } from '../services/pdf.service';
import { exportFichaActividadToPDF, exportFichaActividadToWord } from '../services/reports/ficha-activity-report.service';
import MaterialRequestModal from './MaterialRequestModal';
import FundsRequestModal from './FundsRequestModal';
import MaterialReturnModal from './MaterialReturnModal';
import VerificationSourcesModal, { FuentesJsonData, FuenteEntry } from './VerificationSourcesModal';
import ContratacionModal from './ContratacionModal';
import ContratacionUpdateModal, { ContratacionJsonData } from './ContratacionUpdateModal';
import { HtmlModalHeader } from './ModalShared';
import { useAuth, getSolicitanteByEmail, getCargoByEmail, getRoleByEmail } from '../context/AuthContext';

interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
  subtasks: AsanaTask[];
  statistics?: TaskStatistics;
  projectName?: string;
  onSubtaskDeleted?: (gid: string) => void;
  onSubtaskCreated?: () => void;
}

interface HistorialEntry {
  estado: string;
  fecha: string;
  observaciones: string;
  archivos: { nombre: string; link: string }[];
  usuario?: { nombre: string; email: string };
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount, subtasks, statistics, projectName = 'Proyecto', onSubtaskDeleted, onSubtaskCreated }) => {
  const { user } = useAuth();
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [duplicarTarget, setDuplicarTarget] = useState<{ tipo: 'material' | 'fondos' | 'devolucion'; record: AsanaTask } | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showContratacionModal, setShowContratacionModal] = useState(false);
  const [updateContratacion, setUpdateContratacion] = useState<{ task: AsanaTask; data: ContratacionJsonData } | null>(null);
  const [eliminarContratacionTarget, setEliminarContratacionTarget] = useState<AsanaTask | null>(null);
  const [eliminarContratacionTexto, setEliminarContratacionTexto] = useState('');
  const [eliminandoContratacion, setEliminandoContratacion] = useState(false);
  const [editHistorial, setEditHistorial] = useState<{ task: AsanaTask; entry: HistorialEntry } | null>(null);
  const [editHistorialObservaciones, setEditHistorialObservaciones] = useState('');
  const [editHistorialArchivos, setEditHistorialArchivos] = useState<{ id: number; nombre: string; link: string }[]>([]);
  const [editHistorialSaving, setEditHistorialSaving] = useState(false);
  const [verificationAttachments, setVerificationAttachments] = useState<AsanaAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [observeTarget, setObserveTarget] = useState<AsanaTask | null>(null);
  const [observeMotivo, setObserveMotivo] = useState('');
  const [observeLoading, setObserveLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AsanaTask | null>(null);
  const [informeTarget, setInformeTarget] = useState<AsanaTask | null>(null);
  const [informeNombre, setInformeNombre] = useState('');
  const [informeUrl, setInformeUrl] = useState('');
  const [informeSaving, setInformeSaving] = useState(false);
  const [informeFinalTarget, setInformeFinalTarget] = useState<AsanaTask | null>(null);
  const [informeFinalNombre, setInformeFinalNombre] = useState('');
  const [informeFinalUrl, setInformeFinalUrl] = useState('');
  const [informeFinalSaving, setInformeFinalSaving] = useState(false);

  // Buscar la subtarea "FUENTES DE VERIFICACION"
  const verificationSubtask = subtasks.find(
    subtask => subtask.name.startsWith('FUENTES DE VERIFICACION')
  );

  // Parsear JSON de fuentes de verificación desde las notas de la subtarea
  const parseFuentesJson = (subtask?: AsanaTask): FuentesJsonData | undefined => {
    if (!subtask?.notes) return undefined;
    try {
      const parsed = JSON.parse(subtask.notes);
      if (parsed.tipo === 'FUENTES_VERIFICACION') return parsed as FuentesJsonData;
    } catch {
      // notas en formato antiguo (texto plano)
    }
    return undefined;
  };

  const fuentesData = parseFuentesJson(verificationSubtask);

  // Cargar attachments solo si no hay JSON (compatibilidad con subtareas antiguas)
  useEffect(() => {
    const loadVerificationAttachments = async () => {
      if (verificationSubtask && !fuentesData) {
        setLoadingAttachments(true);
        try {
          const attachments = await asanaService.getTaskAttachments(verificationSubtask.gid);
          setVerificationAttachments(attachments);
        } catch (error) {
          console.error('Error al cargar attachments:', error);
          setVerificationAttachments([]);
        } finally {
          setLoadingAttachments(false);
        }
      } else {
        setVerificationAttachments([]);
      }
    };

    loadVerificationAttachments();
  }, [verificationSubtask?.gid]);

  // Estados para expandir/colapsar secciones (por defecto colapsadas)
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [showContrataciones, setShowContrataciones] = useState(false);
  const [expandedHistoriales, setExpandedHistoriales] = useState<Set<string>>(new Set());

  // Función auxiliar para obtener el valor de un campo personalizado de una tarea específica
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para multi_enum, concatenar los valores
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    // Para number
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    // Para text
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Función auxiliar para obtener el valor de un campo personalizado de la tarea principal
  const getMainTaskFieldValue = (fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para multi_enum, concatenar los valores
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    // Para number
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    // Para text
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Interfaces para solicitudes
  interface FundItem {
    id: number;
    descripcion: string;
    importeBolivianos: string;
  }

  interface MaterialItem {
    id: number;
    detalle: string;
    cantidad: string;
    unidad: string;
    observaciones: string;
  }

  // Extraer datos JSON embebidos en las notas
  const extractJsonData = (notes: string | undefined): Record<string, unknown> | null => {
    if (!notes) return null;
    const match = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  };

  // Extraer la fecha de aprobacion de las notas
  const extractFechaAprobacion = (notes: string | undefined): string => {
    const data = extractJsonData(notes);
    if (data?.fechaAprobacion) return data.fechaAprobacion as string;
    return '';
  };

  // Extraer estado de observación de las notas
  const extractObservacion = (notes: string | undefined): { observado: boolean; motivo: string; fecha: string } => {
    const data = extractJsonData(notes);
    const motivo = (data?.motivoObservacion as string) ?? '';
    const fecha = (data?.fechaObservacion as string) ?? '';
    return {
      observado: !!(motivo && fecha),
      motivo,
      fecha,
    };
  };

  const submitObservacion = async () => {
    if (!observeTarget) return;
    if (!observeMotivo.trim()) return;
    setObserveLoading(true);
    try {
      const fechaObservacion = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });
      const data = extractJsonData(observeTarget.notes) ?? {};
      const updatedData = { ...data, observado: true, motivoObservacion: observeMotivo.trim(), fechaObservacion };
      const notasBase = (observeTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(observeTarget.gid, { notes: newNotes });
      setObserveTarget(null);
      setObserveMotivo('');
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al observar la solicitud.');
      console.error(err);
    } finally {
      setObserveLoading(false);
    }
  };

  // Extraer la fecha de generación de las notas
  const extractFechaSolicitud = (notes: string | undefined): string => {
    const data = extractJsonData(notes);
    if (data?.fechaSolicitud) return data.fechaSolicitud as string;
    return '-';
  };

  // Parsear información de solicitud de fondos
  const parseFundsRequest = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaInicio: (data?.fechaInicio as string) ?? '',
      fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
      fondos: (data?.fondos as FundItem[]) ?? [],
    };
  };

  // Parsear información de solicitud de material
  const parseMaterialRequest = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaInicio: (data?.fechaInicio as string) ?? '',
      fechaFinalizacion: (data?.fechaFinalizacion as string) ?? '',
      materiales: (data?.materiales as MaterialItem[]) ?? [],
    };
  };

  // Parsear información de solicitud de devolución
  const parseMaterialReturn = (task: AsanaTask) => {
    const data = extractJsonData(task.notes);
    return {
      taskName: (data?.titulo as string) ?? task.name,
      area: (data?.area as string) ?? '',
      lugar: (data?.lugar as string) ?? '',
      fechaDevolucion: (data?.fechaDevolucion as string) ?? '-',
      materiales: (data?.materiales as MaterialItem[]) ?? [],
    };
  };

  // Manejar eliminación de solicitudes
  const handleDeleteFuente = async (entry: FuenteEntry) => {
    if (!verificationSubtask || !fuentesData) return;
    try {
      const updatedData: FuentesJsonData = {
        ...fuentesData,
        entradas: fuentesData.entradas.filter(e => e.id !== entry.id),
      };
      await asanaService.updateTask(verificationSubtask.gid, {
        notes: JSON.stringify(updatedData, null, 2),
      });
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al eliminar la fuente de verificación.');
      console.error(err);
    }
  };

  const handleSaveInforme = async () => {
    if (!informeTarget) return;
    const trimmedUrl = informeUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      alert('El enlace debe comenzar con http:// o https://');
      return;
    }
    setInformeSaving(true);
    try {
      const data = extractJsonData(informeTarget.notes) ?? {};
      const updatedData = { ...data, informe: { nombre: informeNombre.trim(), url: trimmedUrl } };
      const notasBase = (informeTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(informeTarget.gid, { notes: newNotes });
      setInformeTarget(null);
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al guardar el informe.');
      console.error(err);
    } finally {
      setInformeSaving(false);
    }
  };

  const handleDeleteInforme = async () => {
    if (!informeTarget) return;
    setInformeSaving(true);
    try {
      const data = extractJsonData(informeTarget.notes) ?? {};
      const { informe: _removed, ...rest } = data as Record<string, unknown> & { informe?: unknown };
      const notasBase = (informeTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(rest, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(informeTarget.gid, { notes: newNotes });
      setInformeTarget(null);
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al eliminar el informe.');
      console.error(err);
    } finally {
      setInformeSaving(false);
    }
  };

  const handleSaveInformeFinal = async () => {
    if (!informeFinalTarget) return;
    const trimmedUrl = informeFinalUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      alert('El enlace debe comenzar con http:// o https://');
      return;
    }
    setInformeFinalSaving(true);
    try {
      const data = extractJsonData(informeFinalTarget.notes) ?? {};
      const updatedData = { ...data, informe_final: { nombre: informeFinalNombre.trim(), url: trimmedUrl } };
      const notasBase = (informeFinalTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(informeFinalTarget.gid, { notes: newNotes });
      setInformeFinalTarget(null);
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al guardar el informe final.');
      console.error(err);
    } finally {
      setInformeFinalSaving(false);
    }
  };

  const handleDeleteInformeFinal = async () => {
    if (!informeFinalTarget) return;
    setInformeFinalSaving(true);
    try {
      const data = extractJsonData(informeFinalTarget.notes) ?? {};
      const { informe_final: _removed, ...rest } = data as Record<string, unknown> & { informe_final?: unknown };
      const notasBase = (informeFinalTarget.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(rest, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(informeFinalTarget.gid, { notes: newNotes });
      setInformeFinalTarget(null);
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al eliminar el informe final.');
      console.error(err);
    } finally {
      setInformeFinalSaving(false);
    }
  };

  const handleDeleteRequest = async (solicitud: AsanaTask) => {
    const data = extractJsonData(solicitud.notes);
    const creatorEmail = (data?.usuario as { email?: string } | undefined)?.email;
    const isAdminOrDirector = user?.role === 'director' || user?.role === 'administrador';
    const isCreator = !!user?.email && user.email === creatorEmail;
    const isObservada = extractObservacion(solicitud.notes).observado;
    const isAprobada = !!extractFechaAprobacion(solicitud.notes);

    if (!isAdminOrDirector && !isCreator) {
      alert('No tienes permiso para eliminar esta solicitud.');
      return;
    }
    if (!isAdminOrDirector && isCreator && (isObservada || isAprobada)) {
      alert('No puedes eliminar una solicitud que ya fue aprobada u observada.');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar la solicitud "${solicitud.name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await asanaService.deleteTask(solicitud.gid);
      onSubtaskDeleted?.(solicitud.gid);
    } catch (err) {
      alert('Error al eliminar la solicitud. Por favor, intenta de nuevo.');
      console.error('Error deleting task:', err);
    }
  };

  // Manejar impresión de solicitudes
  const handlePrintRequest = (taskItem: AsanaTask) => {
    const tipoSolicitud = getCustomFieldValue(taskItem, 'Tipo de Solicitud');
    const fechaGeneracion = extractFechaSolicitud(taskItem.notes);
    const aprobado = !!extractFechaAprobacion(taskItem.notes);
    const observado = !!extractJsonData(taskItem.notes)?.observado;
    const solicitante = (extractJsonData(taskItem.notes)?.solicitante as string | undefined)
      || getSolicitanteByEmail((extractJsonData(taskItem.notes)?.usuario as { email?: string } | undefined)?.email);
    const cargo = (extractJsonData(taskItem.notes)?.cargo as string | undefined)
      || getCargoByEmail((extractJsonData(taskItem.notes)?.usuario as { email?: string } | undefined)?.email);

    if (tipoSolicitud === 'Solicitud de Fondos') {
      const data = parseFundsRequest(taskItem);
      exportFundsRequestToPDF({
        ...data,
        projectName,
        parentTaskName: task.name,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined,
        aprobado,
        observado,
        solicitante,
        cargo
      });
    } else if (tipoSolicitud === 'Solicitud de Material') {
      const data = parseMaterialRequest(taskItem);
      exportMaterialRequestToPDF({
        ...data,
        projectName,
        parentTaskName: task.name,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined,
        aprobado,
        observado,
        solicitante,
        cargo
      });
    } else if (tipoSolicitud === 'Solicitud de Devolucion') {
      const data = parseMaterialReturn(taskItem);
      exportMaterialReturnToPDF({
        ...data,
        projectName,
        parentTaskName: task.name,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined,
        aprobado,
        observado,
        solicitante,
        cargo
      });
    }
  };

  // Convierte fechas DD/MM/YYYY a YYYY-MM-DD para inputs type="date" (deja pasar ISO)
  const toDateInput = (val?: string): string => {
    if (!val || val === '-') return '';
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return val;
  };

  // Duplicar una solicitud observada: abre el form de creación con los datos prellenados
  const handleDuplicarRequest = (record: AsanaTask) => {
    const tipoSolicitud = getCustomFieldValue(record, 'Tipo de Solicitud');
    let tipo: 'material' | 'fondos' | 'devolucion';
    if (tipoSolicitud === 'Solicitud de Fondos') tipo = 'fondos';
    else if (tipoSolicitud === 'Solicitud de Material') tipo = 'material';
    else tipo = 'devolucion';
    setDuplicarTarget({ tipo, record });
  };

  // Filtrar solicitudes de las subtareas (solo Fondos y Devolución)
  const solicitudes = subtasks.filter(taskItem => {
    const tipoSolicitud = getCustomFieldValue(taskItem, 'Tipo de Solicitud');
    return tipoSolicitud === 'Solicitud de Fondos' ||tipoSolicitud === 'Solicitud de Material' || tipoSolicitud === 'Solicitud de Devolucion';
  });

  // Filtrar contrataciones de las subtareas
  const contrataciones = subtasks.filter(taskItem => {
    return taskItem.name.startsWith('CPER - ');
  });

  // El director puede editar/eliminar cualquier entrada; el resto solo las
  // creadas por un usuario de su mismo rol (igual que en la pantalla de Inicio).
  const puedeEditarHistorial = (entry: HistorialEntry): boolean => {
    if (!user) return false;
    if (user.role === 'director') return true;
    const entryRole = getRoleByEmail(entry.usuario?.email);
    return entryRole === user.role;
  };

  // Eliminar una entrada del historial de una contratación
  const handleDeleteHistorialEntry = async (contratacion: AsanaTask, entry: HistorialEntry) => {
    if (!puedeEditarHistorial(entry)) { alert('No tienes permiso para eliminar esta actualización.'); return; }
    const confirmed = window.confirm(`¿Eliminar la actualización "${entry.estado}" (${entry.fecha})? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    const data = extractJsonData(contratacion.notes) as ContratacionJsonData | null;
    if (!data) return;
    const remaining = (data.historialEstados ?? []).filter(
      (e) => !(e.fecha === entry.fecha && e.estado === entry.estado)
    );
    const latest = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    const updated: ContratacionJsonData = {
      ...data,
      estadoActual: latest ? latest.estado : '',
      historialEstados: remaining,
    };
    const notasBase = (contratacion.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
    const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updated, null, 2)}\n===FIN_DATOS_JSON===`;
    try {
      await asanaService.updateTask(contratacion.gid, { notes: newNotes });
      onSubtaskCreated?.();
    } catch (err) {
      alert('Error al eliminar la entrada del historial.');
      console.error(err);
    }
  };

  // Abrir modal para editar observaciones/archivos de una entrada del historial
  const openEditHistorial = (contratacionTask: AsanaTask, entry: HistorialEntry) => {
    setEditHistorial({ task: contratacionTask, entry });
    setEditHistorialObservaciones(entry.observaciones || '');
    setEditHistorialArchivos(entry.archivos.map((a, idx) => ({ id: idx + 1, nombre: a.nombre, link: a.link })));
  };

  const agregarEditHistorialArchivo = () => {
    const newId = Math.max(...editHistorialArchivos.map(a => a.id), 0) + 1;
    setEditHistorialArchivos(prev => [...prev, { id: newId, nombre: '', link: '' }]);
  };

  const eliminarEditHistorialArchivo = (id: number) => {
    setEditHistorialArchivos(prev => prev.filter(a => a.id !== id));
  };

  const actualizarEditHistorialArchivo = (id: number, campo: 'nombre' | 'link', valor: string) => {
    setEditHistorialArchivos(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  };

  const handleSaveEditHistorial = async () => {
    if (!editHistorial) return;
    if (!puedeEditarHistorial(editHistorial.entry)) { alert('No tienes permiso para editar esta actualización.'); return; }
    const archivosValidos = editHistorialArchivos.filter(a => a.nombre.trim() || a.link.trim());
    for (const a of archivosValidos) {
      if (!a.nombre.trim()) { alert('Cada archivo debe tener un nombre.'); return; }
      if (!a.link.trim() || !/^https?:\/\//i.test(a.link.trim())) { alert(`El enlace de "${a.nombre}" debe comenzar con http:// o https://`); return; }
    }
    setEditHistorialSaving(true);
    try {
      const { task: contratacionTask, entry } = editHistorial;
      const data = extractJsonData(contratacionTask.notes) as ContratacionJsonData | null;
      if (!data) return;
      const historialEstados = (data.historialEstados ?? []).map(e =>
        (e.fecha === entry.fecha && e.estado === entry.estado)
          ? { ...e, observaciones: editHistorialObservaciones.trim(), archivos: archivosValidos.map(({ nombre, link }) => ({ nombre: nombre.trim(), link: link.trim() })) }
          : e
      );
      const updated: ContratacionJsonData = { ...data, historialEstados };
      const notasBase = (contratacionTask.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updated, null, 2)}\n===FIN_DATOS_JSON===`;
      await asanaService.updateTask(contratacionTask.gid, { notes: newNotes });
      onSubtaskCreated?.();
      setEditHistorial(null);
    } catch (err) {
      alert('Error al guardar los cambios del historial.');
      console.error(err);
    } finally {
      setEditHistorialSaving(false);
    }
  };

  // Eliminar una contratación (requiere escribir "eliminar" para confirmar)
  const handleEliminarContratacion = async () => {
    if (!eliminarContratacionTarget) return;
    if (eliminarContratacionTexto.toLowerCase() !== 'eliminar') return;
    setEliminandoContratacion(true);
    try {
      await asanaService.deleteTask(eliminarContratacionTarget.gid);
      onSubtaskDeleted?.(eliminarContratacionTarget.gid);
      setEliminarContratacionTarget(null);
      setEliminarContratacionTexto('');
    } catch (err) {
      alert('Error al eliminar la contratación. Por favor, intenta de nuevo.');
      console.error(err);
    } finally {
      setEliminandoContratacion(false);
    }
  };

  // Calcular valores agregados de las subtareas (excluyendo FUENTES DE VERIFICACION)
  const calculateAggregatedValues = () => {
    let totalMujeres = 0;
    let totalHombres = 0;
    let totalPoblacionMeta = 0;
    let totalReplicantes = 0;

    subtasks
      .filter(subtask => !subtask.name.startsWith('FUENTES DE VERIFICACION') && !subtask.name.startsWith('Resumen:'))
      .forEach(subtask => {
        const mujeres = getCustomFieldValue(subtask, 'Mujeres ');
        const hombres = getCustomFieldValue(subtask, 'Hombres');
        const poblacion = getCustomFieldValue(subtask, 'Población Meta');
        const replicantes = getCustomFieldValue(subtask, 'Replicantes');

        totalMujeres += mujeres !== '-' ? parseInt(mujeres) || 0 : 0;
        totalHombres += hombres !== '-' ? parseInt(hombres) || 0 : 0;
        totalPoblacionMeta += poblacion !== '-' ? parseInt(poblacion) || 0 : 0;
        totalReplicantes += replicantes !== '-' ? parseInt(replicantes) || 0 : 0;
      });

    const total = totalMujeres + totalHombres;

    return {
      mujeres: totalMujeres > 0 ? totalMujeres.toString() : '-',
      hombres: totalHombres > 0 ? totalHombres.toString() : '-',
      total: total > 0 ? total.toString() : '-',
      poblacionMeta: totalPoblacionMeta > 0 ? totalPoblacionMeta.toString() : '-',
      replicantes: totalReplicantes > 0 ? totalReplicantes.toString() : '-',
    };
  };

  const aggregatedValues = calculateAggregatedValues();
  const estadoActividad = getMainTaskFieldValue('Estado');
  const estadoNormalizado = estadoActividad.toUpperCase();
  const estadoLabel =
    estadoNormalizado === 'EJECUTADO'
      ? 'Completada'
      : estadoNormalizado === 'EN PROCESO'
        ? 'En proceso'
        : 'Pendiente';
  const estadoClass =
    estadoNormalizado === 'EJECUTADO'
      ? 'success'
      : estadoNormalizado === 'EN PROCESO'
        ? 'processing'
        : 'default';
  const notasActividad = (task.notes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();

  // Extraer código de actividad del nombre (ej. "R1.A3 Nombre..." → code="R1.A3", displayName="Nombre...")
  const codeMatch = task.name.match(/^([A-Z][0-9]+(?:\.[A-Z][0-9]+)+)\s+([\s\S]*)/);
  const taskCode = codeMatch ? codeMatch[1] : null;
  const taskDisplayName = codeMatch ? codeMatch[2] : task.name;
  const resultado = getMainTaskFieldValue('Resultado');
  const fechaInicio = getMainTaskFieldValue('Fecha inicio');
  const fechaFin = getMainTaskFieldValue('Fecha fin');

  const statsFromSubtasks = (() => {
    const relevantSubtasks = subtasks.filter(t =>
      !t.name.startsWith('FUENTES DE VERIFICACION') &&
      !t.name.startsWith('SFON') &&
      !t.name.startsWith('SMAT') &&
      !t.name.startsWith('DMAT') &&
      !t.name.startsWith('CPER') &&
      !t.name.startsWith('Resumen:')
    );
    const total = relevantSubtasks.length;
    const completed = relevantSubtasks.filter(t => t.completed).length;
    const pending = Math.max(total - completed, 0);
    const completionPercentage = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, pending, completionPercentage };
  })();

  const generalStatistics = {
    total: statistics?.total ?? statsFromSubtasks.total,
    completed: statistics?.completed ?? statsFromSubtasks.completed,
    pending: statistics?.pending ?? statsFromSubtasks.pending,
    completionPercentage: statistics?.completionPercentage ?? statsFromSubtasks.completionPercentage,
  };

  const actionMenuItems: MenuProps['items'] = [
    {
      key: 'material',
      icon: <InboxOutlined />,
      label: 'Solicitud de Material',
    },
    {
      key: 'fondos',
      icon: <DollarCircleOutlined />,
      label: 'Solicitud de Fondos',
    },
    {
      key: 'devolucion',
      icon: <ReloadOutlined />,
      label: 'Devolución de Material',
    },
    {
      key: 'contratacion',
      icon: <CarryOutOutlined />,
      label: 'Solicitar Contratación',
    },
  ];

  const handleActionMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'material') setShowMaterialModal(true);
    if (key === 'fondos') setShowFundsModal(true);
    if (key === 'devolucion') setShowReturnModal(true);
    if (key === 'contratacion') setShowContratacionModal(true);
  };

  const buildFichaData = () => ({
    task,
    subtasks,
    aggregatedValues,
    generalStatistics,
    projectName,
    seccion: task.memberships?.[0]?.section?.name,
    fuentesEntradas: fuentesData?.entradas ?? [],
  });

  const handleExportFichaPDF = () => exportFichaActividadToPDF(buildFichaData());
  const handleExportFichaWord = () => exportFichaActividadToWord(buildFichaData());

  return (
    <>
      {/* Modal de detalle de solicitud */}
      {detailTarget && (() => {
        const tipoDetalle = getCustomFieldValue(detailTarget, 'Tipo de Solicitud');
        const obsDetalle = extractObservacion(detailTarget.notes);
        const fechaSolicitudDetalle = extractFechaSolicitud(detailTarget.notes);
        const fechaAprobacionDetalle = extractFechaAprobacion(detailTarget.notes);
        const isFondos = tipoDetalle === 'Solicitud de Fondos';
        const isMaterial = tipoDetalle === 'Solicitud de Material';
        const isDevolucion = tipoDetalle === 'Solicitud de Devolucion';
        const fondosData = isFondos ? parseFundsRequest(detailTarget) : null;
        const materialData = isMaterial ? parseMaterialRequest(detailTarget) : null;
        const devolucionData = isDevolucion ? parseMaterialReturn(detailTarget) : null;
        const total = fondosData ? fondosData.fondos.reduce((acc, f) => acc + (parseFloat(f.importeBolivianos) || 0), 0) : 0;
        const detailIcon = isFondos ? '💰' : isDevolucion ? '↩️' : '📦';
        const detailTitle = isFondos ? 'Solicitud de Fondos' : isDevolucion ? 'Devolución de Material' : 'Solicitud de Material';
        return (
          <div className="modal-overlay" onClick={() => setDetailTarget(null)} style={{ zIndex: 1001 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <HtmlModalHeader icon={detailIcon} title={detailTitle} subtitle={detailTarget.name} onClose={() => setDetailTarget(null)} />
              <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
                {/* Info general */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título</span>
                    <p style={{ margin: '0.15rem 0 0', fontWeight: 600, fontSize: '0.95rem' }}>{detailTarget.name}</p>
                  </div>
                  {(fondosData || materialData || devolucionData) && [
                    { label: 'Área', value: (fondosData || materialData || devolucionData)?.area },
                    { label: 'Lugar', value: (fondosData || materialData || devolucionData)?.lugar },
                    !isDevolucion && { label: 'Fecha inicio', value: (fondosData || materialData)?.fechaInicio },
                    !isDevolucion && { label: 'Fecha fin', value: (fondosData || materialData)?.fechaFinalizacion },
                    isDevolucion && { label: 'Fecha devolución', value: devolucionData?.fechaDevolucion },
                    { label: 'Fecha solicitud', value: fechaSolicitudDetalle },
                    fechaAprobacionDetalle && { label: 'Fecha aprobación', value: fechaAprobacionDetalle },
                  ].filter(Boolean).map((item, i) => item && (
                    <div key={i}>
                      <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                      <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{item.value || '—'}</p>
                    </div>
                  ))}
                  {obsDetalle.observado && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#fdecea', borderRadius: '6px', padding: '0.6rem 0.75rem', border: '1px solid #f5c6cb' }}>
                      <span style={{ fontSize: '0.72rem', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>⚠ Observación</span>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: '#c0392b' }}>{obsDetalle.motivo}</p>
                      {obsDetalle.fecha && <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#999' }}>{obsDetalle.fecha}</p>}
                    </div>
                  )}
                </div>

                {/* Tabla de ítems */}
                {isFondos && fondosData && fondosData.fondos.length > 0 && (
                  <>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#555' }}>Detalle de fondos</h4>
                    <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '0' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ backgroundColor: '#e9ecef' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>#</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Importe (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fondosData.fondos.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '0.4rem 0.75rem', color: '#888' }}>{i + 1}</td>
                            <td style={{ padding: '0.4rem 0.75rem' }}>{f.descripcion}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{parseFloat(f.importeBolivianos).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total:</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Bs. {total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </>
                )}

                {(isMaterial || isDevolucion) && (materialData || devolucionData) && (
                  (() => {
                    const items = (materialData?.materiales || devolucionData?.materiales) ?? [];
                    return items.length > 0 ? (
                      <>  
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#555' }}>Detalle de materiales</h4>
                        <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ backgroundColor: '#e9ecef' }}>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>#</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Detalle</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Cant.</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Unidad</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Obs.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((m, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ padding: '0.4rem 0.75rem', color: '#888' }}>{i + 1}</td>
                                <td style={{ padding: '0.4rem 0.75rem' }}>{m.detalle}</td>
                                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.cantidad}</td>
                                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.unidad}</td>
                                <td style={{ padding: '0.4rem 0.75rem', color: '#888', fontSize: '0.78rem' }}>{m.observaciones || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </>
                    ) : null;
                  })()
                )}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa' }}>
                <button type="button" className="button-primary" onClick={() => setDetailTarget(null)} style={{ width: '100%' }}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de informe */}
      {informeTarget && (
        <div className="modal-overlay" onClick={() => setInformeTarget(null)} style={{ zIndex: 1002 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: 0 }}>
            <HtmlModalHeader
              icon="🔗"
              title="Planificación / Documento"
              subtitle={informeTarget.name}
              onClose={() => setInformeTarget(null)}
            />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Nombre del documento</label>
                <input
                  type="text"
                  value={informeNombre}
                  onChange={e => setInformeNombre(e.target.value)}
                  placeholder="Ej: Planificación de actividad abril 2026"
                  disabled={informeSaving}
                  autoFocus
                  style={{ width: '100%', padding:  '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>🔗 Enlace (URL)</label>
                <input
                  type="url"
                  value={informeUrl}
                  onChange={e => setInformeUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={informeSaving}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => {
                  const d = extractJsonData(informeTarget.notes);
                  const hasInforme = !!(d?.informe as { url?: string } | undefined)?.url;
                  return hasInforme ? (
                    <Popconfirm
                      title="¿Borrar planificación?"
                      description="Se eliminará el enlace guardado."
                      onConfirm={handleDeleteInforme}
                      okText="Borrar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        type="button"
                        disabled={informeSaving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626' }}
                      >🗑️ Borrar planificación</button>
                    </Popconfirm>
                  ) : null;
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setInformeTarget(null)}
                  disabled={informeSaving}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleSaveInforme}
                  disabled={informeSaving}
                  className="button-primary"
                  style={{ padding: '0.5rem 1.25rem', opacity: informeSaving ? 0.6 : 1 }}
                >{informeSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de informe final */}
      {informeFinalTarget && (
        <div className="modal-overlay" onClick={() => setInformeFinalTarget(null)} style={{ zIndex: 1002 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: 0 }}>
            <HtmlModalHeader
              icon="🔗"
              title="Informe / Documento"
              subtitle={informeFinalTarget.name}
              onClose={() => setInformeFinalTarget(null)}
            />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Nombre del documento</label>
                <input
                  type="text"
                  value={informeFinalNombre}
                  onChange={e => setInformeFinalNombre(e.target.value)}
                  placeholder="Ej: Informe de actividad abril 2026"
                  disabled={informeFinalSaving}
                  autoFocus
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>🔗 Enlace (URL)</label>
                <input
                  type="url"
                  value={informeFinalUrl}
                  onChange={e => setInformeFinalUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={informeFinalSaving}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => {
                  const d = extractJsonData(informeFinalTarget.notes);
                  const hasInformeFinal = !!(d?.informe_final as { url?: string } | undefined)?.url;
                  return hasInformeFinal ? (
                    <Popconfirm
                      title="¿Borrar informe?"
                      description="Se eliminará el enlace guardado."
                      onConfirm={handleDeleteInformeFinal}
                      okText="Borrar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        type="button"
                        disabled={informeFinalSaving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626' }}
                      >🗑️ Borrar informe</button>
                    </Popconfirm>
                  ) : null;
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setInformeFinalTarget(null)}
                  disabled={informeFinalSaving}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleSaveInformeFinal}
                  disabled={informeFinalSaving}
                  className="button-primary"
                  style={{ padding: '0.5rem 1.25rem', opacity: informeFinalSaving ? 0.6 : 1 }}
                >{informeFinalSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de observación */}
      {observeTarget && (
        <div className="modal-overlay" onClick={() => { setObserveTarget(null); setObserveMotivo(''); }} style={{ zIndex: 1001 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: 0 }}>
            <HtmlModalHeader
              icon="💬"
              title={extractObservacion(observeTarget.notes).observado ? 'Actualizar observación' : 'Observar solicitud'}
              subtitle={observeTarget.name}
              onClose={() => { setObserveTarget(null); setObserveMotivo(''); }}
            />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Motivo de observación *</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Describa el motivo por el que se observa esta solicitud..."
                  value={observeMotivo}
                  onChange={e => setObserveMotivo(e.target.value)}
                  autoFocus
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                style={{ border: '1px solid #d9d9d9', background: '#fff', padding: '0.5rem 1.25rem', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => { setObserveTarget(null); setObserveMotivo(''); }}
                disabled={observeLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={submitObservacion}
                disabled={observeLoading || !observeMotivo.trim()}
                style={{ backgroundColor: '#c0392b', borderColor: '#c0392b' }}
              >
                {observeLoading ? 'Guardando...' : '⚠️ Guardar observación'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <Card className="task-ficha-pro" bodyStyle={{ padding: 0 }}>

          {/* ── Franja Wiphala ── */}
          <div className="task-ficha-pro__wiphala-stripe">
            {['#D32F2F','#E65100','#F9A825','#388E3C','#1565C0','#6A1B9A','#880E4F'].map(c => (
              <div key={c} style={{ background: c, flex: 1 }} />
            ))}
          </div>

          {/* ── Cabecera: estado + acciones ── */}
          <div className="task-ficha-pro__header">
            <div className="task-ficha-pro__header-main">
              <div className="task-ficha-pro__title-row">
                <Tag className={`task-ficha-pro__status-tag task-ficha-pro__status-tag--${estadoClass}`}>
                  {estadoLabel}
                </Tag>
                {(task.start_on || task.due_on) && (
                  <Typography.Text className="task-ficha-pro__due-date">
                    <CalendarOutlined style={{ marginRight: 4, fontSize: 11 }} />
                    {task.start_on && task.due_on
                      ? `${task.start_on} → ${task.due_on}`
                      : task.start_on
                        ? `Inicio: ${task.start_on}`
                        : `Vence: ${task.due_on}`}
                  </Typography.Text>
                )}
              </div>
            </div>
            <div className="task-ficha-pro__actions">
              <Space size={8}>
                <Tooltip title="Exportar a Word">
                  <Button className="task-ficha-pro__actions-trigger" icon={<FileWordOutlined />} onClick={handleExportFichaWord} />
                </Tooltip>
                <Tooltip title="Exportar a PDF">
                  <Button className="task-ficha-pro__actions-trigger" icon={<PrinterOutlined />} onClick={handleExportFichaPDF} />
                </Tooltip>
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  menu={{ items: actionMenuItems, onClick: handleActionMenuClick }}
                >
                  <Button className="task-ficha-pro__actions-trigger" icon={<MoreOutlined />}>
                    Acciones
                  </Button>
                </Dropdown>
              </Space>
            </div>
          </div>

          {/* ── Cuerpo 2 columnas ── */}
          <div className="task-ficha-pro__body">
            <Row gutter={0}>

              {/* Columna izquierda: narrativa (65%) */}
              <Col xs={24} md={16} className="task-ficha-pro__main-col">
                {taskCode && (
                  <Typography.Text className="task-ficha-pro__code">{taskCode}</Typography.Text>
                )}
                <Typography.Title level={3} className="task-ficha-pro__main-title">
                  {taskDisplayName}
                </Typography.Title>

                {resultado !== '-' && (
                  <div className="task-ficha-pro__resultado-box">
                    <Typography.Text className="task-ficha-pro__label">Resultado</Typography.Text>
                    <Typography.Text className="task-ficha-pro__value">{resultado}</Typography.Text>
                  </div>
                )}

                <div className="task-ficha-pro__meta-item">
                  <UserOutlined className="task-ficha-pro__meta-icon" />
                  <div>
                    <Typography.Text className="task-ficha-pro__label">Responsable de Actividad</Typography.Text>
                    <Typography.Text className="task-ficha-pro__value task-ficha-pro__value-lg">
                      {getMainTaskFieldValue('Responsable de Actividad')}
                    </Typography.Text>
                  </div>
                </div>

                {notasActividad && (
                  <div className="task-ficha-pro__results-box" style={{ marginTop: '1rem' }}>
                    <Typography.Text className="task-ficha-pro__results-title">Descripción</Typography.Text>
                    <Typography.Paragraph className="task-ficha-pro__results-text">
                      {notasActividad}
                    </Typography.Paragraph>
                  </div>
                )}

                {/* ── Estadísticas de sub-actividades ── */}
                <div className="task-ficha-pro__general-stats" style={{ marginTop: '1rem' }}>
                  <Typography.Text className="task-ficha-pro__stats-heading">Estadísticas</Typography.Text>
                  <Typography.Text className="task-ficha-pro__general-progress-label">Progreso General</Typography.Text>
                  <div className="task-ficha-pro__general-progress-row">
                    <Progress
                      percent={Number(generalStatistics.completionPercentage.toFixed(1))}
                      showInfo={false}
                      strokeColor={{ '0%': '#f97316', '50%': '#facc15', '100%': '#22c55e' }}
                      trailColor="#e5e7eb"
                      strokeWidth={10}
                    />
                    <Typography.Text className="task-ficha-pro__general-progress-value">
                      {generalStatistics.completionPercentage.toFixed(1)}%
                      {generalStatistics.completionPercentage >= 100 && (
                        <CheckCircleFilled style={{ marginLeft: '6px', color: '#f59e0b', fontSize: '1rem', verticalAlign: 'middle' }} />
                      )}
                    </Typography.Text>
                  </div>
                  <Row gutter={[10, 10]} className="task-ficha-pro__general-stats-grid">
                    <Col xs={12} lg={6}>
                      <div className="task-ficha-pro__general-stat-item">
                        <span className="task-ficha-pro__general-stat-value">{generalStatistics.total}</span>
                        <span className="task-ficha-pro__general-stat-label">Total Sub Actividades</span>
                      </div>
                    </Col>
                    <Col xs={12} lg={6}>
                      <div className="task-ficha-pro__general-stat-item">
                        <span className="task-ficha-pro__general-stat-value">{generalStatistics.completed}</span>
                        <span className="task-ficha-pro__general-stat-label">Ejecutadas</span>
                      </div>
                    </Col>
                    <Col xs={12} lg={6}>
                      <div className="task-ficha-pro__general-stat-item">
                        <span className="task-ficha-pro__general-stat-value">{generalStatistics.pending}</span>
                        <span className="task-ficha-pro__general-stat-label">En Proceso</span>
                      </div>
                    </Col>
                    <Col xs={12} lg={6}>
                      <div className={`task-ficha-pro__general-stat-item task-ficha-pro__general-stat-item--${estadoClass}`}>
                        <span className="task-ficha-pro__general-stat-value">{generalStatistics.completionPercentage.toFixed(1)}%</span>
                        <span className="task-ficha-pro__general-stat-label">Progreso</span>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Fuentes de Verificación */}
                <div className="task-ficha-pro__results-box task-ficha-pro__fuentes-section">
                  <div className="task-ficha-pro__fuentes-header">
                    <Typography.Text className="task-ficha-pro__results-title">
                      <LinkOutlined style={{ marginRight: 5, color: '#1565C0' }} />
                      Fuentes de Verificación
                    </Typography.Text>
                    <Button
                      size="small"
                      type="dashed"
                      onClick={() => setShowVerificationModal(true)}
                      title={verificationSubtask ? 'Agregar nueva fuente de verificación' : 'Crear subactividad de fuentes de verificación'}
                    >
                      {verificationSubtask ? '+ Agregar Fuente' : '+ Crear Subactividad'}
                    </Button>
                  </div>

                  {verificationSubtask ? (
                    <div>
                      {fuentesData ? (
                        fuentesData.entradas.length > 0 ? (
                          <List
                            size="small"
                            dataSource={fuentesData.entradas}
                            renderItem={(entry) => (
                              <List.Item
                                className="task-ficha-pro__fuente-item"
                                actions={[
                                  <a
                                    key="ver"
                                    href={entry.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="task-ficha-pro__fuente-link"
                                  >
                                    Ver
                                  </a>,
                                  <Popconfirm
                                    key="del"
                                    title="¿Eliminar esta fuente?"
                                    onConfirm={() => handleDeleteFuente(entry)}
                                    okText="Sí"
                                    cancelText="No"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Tooltip title="Eliminar fuente">
                                      <Button size="small" danger icon={<DeleteOutlined />} />
                                    </Tooltip>
                                  </Popconfirm>
                                ]}
                              >
                                <List.Item.Meta
                                  avatar={<PaperClipOutlined className="task-ficha-pro__fuente-icon" />}
                                  title={<span className="task-ficha-pro__fuente-name">{entry.nombre}</span>}
                                />
                              </List.Item>
                            )}
                          />
                        ) : (
                          <p className="task-ficha-pro__fuentes-empty">
                            No hay fuentes registradas. Use el botón "Agregar Fuente".
                          </p>
                        )
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
                            {loadingAttachments ? (
                              'Cargando recursos...'
                            ) : verificationAttachments.length > 0 ? (
                              `${verificationAttachments.length} ${verificationAttachments.length === 1 ? 'recurso adjunto' : 'recursos adjuntos'}`
                            ) : (
                              'No hay recursos adjuntos.'
                            )}
                          </p>
                          {verificationAttachments.length > 0 && (
                            <div className="task-ficha-pro__fuentes-attachments">
                              {verificationAttachments.map((attachment) => (
                                <a
                                  key={attachment.gid}
                                  href={attachment.view_url || attachment.download_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="task-ficha-pro__fuente-chip"
                                  title={attachment.name}
                                >
                                  <PaperClipOutlined />
                                  <span>{attachment.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="task-ficha-pro__results-box" style={{ background: '#f8fafc' }}>
                      <Typography.Text style={{ fontSize: '0.85rem', color: '#4f4f4f' }}>
                        <strong>ℹ️ Info:</strong> Cree la subtarea "FUENTES DE VERIFICACION" para poder adjuntar documentos, imágenes y enlaces de Google Drive.
                      </Typography.Text>
                    </div>
                  )}
                </div>
              </Col>

              {/* Columna derecha: impacto + metadatos (35%) */}
              <Col xs={24} md={8} className="task-ficha-pro__sidebar-col">
                <Typography.Text className="task-ficha-pro__stats-heading">Impacto</Typography.Text>
                <div className="task-ficha-pro__kpi-grid">
                  <Card className="task-ficha-pro__metric task-ficha-pro__metric-total" size="small">
                    <Statistic
                      title="Total Beneficiarios"
                      value={aggregatedValues.total === '-' ? 0 : Number(aggregatedValues.total)}
                      prefix={<TeamOutlined />}
                    />
                  </Card>
                  <Card className="task-ficha-pro__metric task-ficha-pro__metric-mujeres" size="small">
                    <Statistic
                      title="Mujeres"
                      value={aggregatedValues.mujeres === '-' ? 0 : Number(aggregatedValues.mujeres)}
                      prefix={<HeartOutlined />}
                    />
                  </Card>
                  <Card className="task-ficha-pro__metric task-ficha-pro__metric-hombres" size="small">
                    <Statistic
                      title="Hombres"
                      value={aggregatedValues.hombres === '-' ? 0 : Number(aggregatedValues.hombres)}
                      prefix={<UserOutlined />}
                    />
                  </Card>
                  {aggregatedValues.replicantes !== '-' && (
                    <Card className="task-ficha-pro__metric task-ficha-pro__metric-replicantes" size="small">
                      <Statistic
                        title="Replicantes"
                        value={Number(aggregatedValues.replicantes)}
                        prefix={<TeamOutlined />}
                      />
                    </Card>
                  )}
                </div>

                <div className="task-ficha-pro__sidebar-meta">
                  {/* Sub actividades */}
                  <div className="task-ficha-pro__meta-item">
                    <DeploymentUnitOutlined className="task-ficha-pro__meta-icon" />
                    <div>
                      <Typography.Text className="task-ficha-pro__label">Sub Actividades: </Typography.Text>
                      <Typography.Text className="task-ficha-pro__value task-ficha-pro__value-lg">{subtasksCount}</Typography.Text>
                    </div>
                  </div>

                  {/* Población meta */}
                  {aggregatedValues.poblacionMeta !== '-' && (
                    <div className="task-ficha-pro__meta-item">
                      <FileSearchOutlined className="task-ficha-pro__meta-icon" />
                      <div>
                        <Typography.Text className="task-ficha-pro__label">Población Meta: </Typography.Text>
                        <Typography.Text className="task-ficha-pro__value task-ficha-pro__value-lg">{aggregatedValues.poblacionMeta}</Typography.Text>
                      </div>
                    </div>
                  )}

                  {/* Lugar */}
                  {getMainTaskFieldValue('Lugar') !== '-' && (
                    <div className="task-ficha-pro__meta-item">
                      <EnvironmentOutlined className="task-ficha-pro__meta-icon" />
                      <div>
                        <Typography.Text className="task-ficha-pro__label">Lugar: </Typography.Text>
                        <Typography.Text className="task-ficha-pro__value">{getMainTaskFieldValue('Lugar')}</Typography.Text>
                      </div>
                    </div>
                  )}

                  {/* Cronograma */}
                  {(task.start_on || task.due_on || fechaInicio !== '-' || fechaFin !== '-') && (
                    <div className="task-ficha-pro__meta-item">
                      <CalendarOutlined className="task-ficha-pro__meta-icon" />
                      <div>
                        <Typography.Text className="task-ficha-pro__label">Cronograma: </Typography.Text>
                        <Typography.Text className="task-ficha-pro__value">
                          {task.start_on || (fechaInicio !== '-' ? fechaInicio : '—')}
                          {' → '}
                          {task.due_on || (fechaFin !== '-' ? fechaFin : '—')}
                        </Typography.Text>
                      </div>
                    </div>
                  )}
                </div>
              </Col>

            </Row>
          </div>

        </Card>

        {/* Solicitudes */}
        <Collapse
          className="task-ficha-pro__collapse"
          activeKey={showSolicitudes ? ['sol'] : []}
          onChange={(keys) => setShowSolicitudes((keys as string[]).length > 0)}
          style={{ marginTop: '1.5rem' }}
          items={[{
            key: 'sol',
            label: (
              <Space align="center">
                <span style={{ fontWeight: 600, color: '#333' }}>📋 Solicitudes</span>
                <Badge count={solicitudes.length} showZero={false} color="#4f46e5" />
              </Space>
            ),
            children: (solicitudes.length > 0 ? (
            <Table
              size="small"
              rowKey="gid"
              pagination={false}
              rowClassName={(record) => {
                const obs = extractObservacion(record.notes);
                const isAprobada = !!extractFechaAprobacion(record.notes);
                if (obs.observado) return 'ant-table-row--observed';
                if (isAprobada) return 'ant-table-row--completed';
                return '';
              }}
              dataSource={[...solicitudes].sort((a, b) => {
                const statusOrder = (t: AsanaTask) => {
                  if (extractFechaAprobacion(t.notes)) return 1;
                  const obs = extractObservacion(t.notes);
                  if (obs.observado) return 2;
                  return 0;
                };
                return statusOrder(a) - statusOrder(b);
              })}
              columns={[
                {
                  title: 'Solicitud',
                  key: 'nombre',
                  render: (_: unknown, record: AsanaTask) => {
                    const obs = extractObservacion(record.notes);
                    const tipo = getCustomFieldValue(record, 'Tipo de Solicitud');
                    const data = extractJsonData(record.notes);
                    const solicitante = data?.usuario as { nombre: string; email: string } | undefined;
                    const tipoColorMap: Record<string, { bg: string; color: string; border: string }> = {
                      'Solicitud de Fondos':    { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
                      'Solicitud de Material':  { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
                      'Solicitud de Devolucion': { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
                    };
                    const tc = tipoColorMap[tipo] ?? { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
                    return (
                      <div>
                        <Typography.Text ellipsis style={{ maxWidth: 300, display: 'block', fontWeight: 500 }}>{record.name}</Typography.Text>
                        {tipo && (
                          <span style={{
                            display: 'inline-block',
                            alignSelf: 'flex-start',
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: tc.bg,
                            color: tc.color,
                            border: `1px solid ${tc.border}`,
                            borderRadius: 4,
                            padding: '1px 7px',
                            lineHeight: '18px',
                            marginTop: '0.15rem',
                          }}>
                            {tipo}
                          </span>
                        )}
                        {solicitante ? (
                          <Typography.Text style={{ fontSize: '0.72rem', color: '#6b7280', display: 'block', marginTop: '0.1rem' }}>
                            👤 {solicitante.nombre} · <span style={{ color: '#9ca3af' }}>{solicitante.email}</span>
                          </Typography.Text>
                        ) : (
                          <Typography.Text style={{ fontSize: '0.72rem', color: '#bbb', display: 'block', marginTop: '0.1rem' }}>👤 Sin registro</Typography.Text>
                        )}
                        {obs.observado && (
                          <Typography.Text type="danger" style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', whiteSpace: 'normal', marginTop: '0.2rem' }}>
                            <WarningOutlined style={{ marginRight: 4 }} />
                            {obs.motivo}
                            {obs.fecha && <span style={{ color: '#999', marginLeft: '0.4rem' }}>({obs.fecha})</span>}
                          </Typography.Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Fecha Solicitud',
                  key: 'fechaSolicitud',
                  render: (_: unknown, record: AsanaTask) => (
                    <Typography.Text type="secondary" style={{ fontSize: '0.8rem' }}>
                      {extractFechaSolicitud(record.notes)}
                    </Typography.Text>
                  ),
                },
                {
                  title: 'Fecha Respuesta',
                  key: 'fechaAprobacion',
                  render: (_: unknown, record: AsanaTask) => {
                    const fechaAprobacion = extractFechaAprobacion(record.notes);
                    const fecha = fechaAprobacion || extractObservacion(record.notes).fecha;
                    return (
                      <Typography.Text style={{ fontSize: '0.8rem', color: fecha ? '#2e7d32' : '#bbb' }}>
                        {fecha || '—'}
                      </Typography.Text>
                    );
                  },
                },
                {
                  title: 'Estado',
                  key: 'estado',
                  align: 'center' as const,
                  render: (_: unknown, record: AsanaTask) => {
                    const obs = extractObservacion(record.notes);
                    const isAprobada = !!extractFechaAprobacion(record.notes);
                    if (isAprobada) return <Tag color="success">Aprobada</Tag>;
                    if (obs.observado) return <Tag color="error">Observada</Tag>;
                    return <Tag color="warning">Pendiente</Tag>;
                  },
                },
                {
                  title: 'Planificación',
                  key: 'informe',
                  width: 90,
                  align: 'center' as const,
                  render: (_: unknown, record: AsanaTask) => {
                    const data = extractJsonData(record.notes);
                    const informe = data?.informe as { nombre?: string; url?: string } | undefined;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {informe?.url ? (
                          <a href={informe.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#2563eb', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                            title={informe.nombre || informe.url}>
                            <LinkOutlined style={{ marginRight: 3 }} />{informe.nombre || 'Ver'}
                          </a>
                        ) : null}
                        <Tooltip title="Agregar / editar planificación">
                          <button
                            onClick={() => {
                              const d = extractJsonData(record.notes);
                              const inf = d?.informe as { nombre?: string; url?: string } | undefined;
                              setInformeNombre(inf?.nombre ?? '');
                              setInformeUrl(inf?.url ?? '');
                              setInformeTarget(record);
                            }}
                            style={{
                              background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                              cursor: 'pointer', padding: '2px 6px', color: '#6b7280', fontSize: 11,
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}
                          >
                            <LinkOutlined />{informe?.url ? '✎' : '+'}
                          </button>
                        </Tooltip>
                      </div>
                    );
                  },
                },
                {
                  title: 'Informe',
                  key: 'informe_final',
                  width: 90,
                  align: 'center' as const,
                  render: (_: unknown, record: AsanaTask) => {
                    const data = extractJsonData(record.notes);
                    const informeFinal = data?.informe_final as { nombre?: string; url?: string } | undefined;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {informeFinal?.url ? (
                          <a href={informeFinal.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#2563eb', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                            title={informeFinal.nombre || informeFinal.url}>
                            <LinkOutlined style={{ marginRight: 3 }} />{informeFinal.nombre || 'Ver'}
                          </a>
                        ) : null}
                        <Tooltip title="Agregar / editar informe">
                          <button
                            onClick={() => {
                              const d = extractJsonData(record.notes);
                              const inf = d?.informe_final as { nombre?: string; url?: string } | undefined;
                              setInformeFinalNombre(inf?.nombre ?? '');
                              setInformeFinalUrl(inf?.url ?? '');
                              setInformeFinalTarget(record);
                            }}
                            style={{
                              background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                              cursor: 'pointer', padding: '2px 6px', color: '#6b7280', fontSize: 11,
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}
                          >
                            <LinkOutlined />{informeFinal?.url ? '✎' : '+'}
                          </button>
                        </Tooltip>
                      </div>
                    );
                  },
                },
                {
                  title: 'Acciones',
                  key: 'acciones',
                  align: 'center' as const,
                  render: (_: unknown, record: AsanaTask) => {
                    return (
                      <Space size={4}>
                        <Tooltip title="Ver detalle">
                          <Button
                            size="small"
                            icon={<FileTextOutlined />}
                            onClick={() => setDetailTarget(record)}
                          />
                        </Tooltip>
                        <Tooltip title="Imprimir">
                          <Button
                            size="small"
                            icon={<PrinterOutlined />}
                            onClick={() => handlePrintRequest(record)}
                          />
                        </Tooltip>
                        {extractObservacion(record.notes).observado && (
                          <Tooltip title="Crear nueva solicitud con estos datos">
                            <Button
                              size="small"
                              icon={<CopyOutlined />}
                              style={{ color: '#0369a1', borderColor: '#7dd3fc' }}
                              onClick={() => handleDuplicarRequest(record)}
                            />
                          </Tooltip>
                        )}
                        <Popconfirm
                          title="¿Eliminar esta solicitud?"
                          onConfirm={() => handleDeleteRequest(record)}
                          okText="Sí"
                          cancelText="No"
                          okButtonProps={{ danger: true }}
                          disabled={(() => {
                            const data = extractJsonData(record.notes);
                            const creatorEmail = (data?.usuario as { email?: string } | undefined)?.email;
                            const isAdminOrDirector = user?.role === 'director' || user?.role === 'administrador';
                            const isCreator = !!user?.email && user.email === creatorEmail;
                            const isObservada = extractObservacion(record.notes).observado;
                            const isAprobada = !!extractFechaAprobacion(record.notes);
                            if (isAdminOrDirector) return false;
                            if (isCreator && !isObservada && !isAprobada) return false;
                            return true;
                          })()}
                        >
                          <Tooltip title={(() => {
                            const data = extractJsonData(record.notes);
                            const creatorEmail = (data?.usuario as { email?: string } | undefined)?.email;
                            const isAdminOrDirector = user?.role === 'director' || user?.role === 'administrador';
                            const isCreator = !!user?.email && user.email === creatorEmail;
                            const isObservada = extractObservacion(record.notes).observado;
                            const isAprobada = !!extractFechaAprobacion(record.notes);
                            if (!isAdminOrDirector && !isCreator) return 'Sin permiso para eliminar';
                            if (!isAdminOrDirector && isCreator && (isObservada || isAprobada)) return 'No se puede eliminar una solicitud aprobada u observada';
                            return 'Eliminar';
                          })()}>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              disabled={(() => {
                                const data = extractJsonData(record.notes);
                                const creatorEmail = (data?.usuario as { email?: string } | undefined)?.email;
                                const isAdminOrDirector = user?.role === 'director' || user?.role === 'administrador';
                                const isCreator = !!user?.email && user.email === creatorEmail;
                                const isObservada = extractObservacion(record.notes).observado;
                                const isAprobada = !!extractFechaAprobacion(record.notes);
                                if (isAdminOrDirector) return false;
                                if (isCreator && !isObservada && !isAprobada) return false;
                                return true;
                              })()}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    );
                  },
                },
              ]}
            />
          ) : (
            <Empty description="No hay solicitudes para esta actividad. Use el menú de acciones para crear solicitudes de material, fondos o devolución." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )),
          }]}
        />

        {/* Contrataciones */}
        <Collapse
          className="task-ficha-pro__collapse"
          activeKey={showContrataciones ? ['con'] : []}
          onChange={(keys) => setShowContrataciones((keys as string[]).length > 0)}
          style={{ marginTop: '1.5rem' }}
          items={[{
            key: 'con',
            label: (
              <Space align="center">
                <span style={{ fontWeight: 600, color: '#333' }}>👔 Contrataciones</span>
                <Badge count={contrataciones.length} showZero={false} color="#0ea5e9" />
              </Space>
            ),
            children: (contrataciones.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contrataciones.map((contratacion) => {
                const nombreContratacion = contratacion.name.replace('CPER - ', '');
                const contratacionData = extractJsonData(contratacion.notes) as ContratacionJsonData | null;
                const descripcionContratacion = contratacionData?.descripcion as string | null;
                const estadoContratacion = (contratacionData?.estadoActual as string) || getCustomFieldValue(contratacion, 'Estado de Contratación');

                // Definir los pasos del stepper
                const pasos = [
                  'Requerimiento de contratación',
                  'Elaboración de TDRs',
                  'Lanzamiento de convocatoria',
                  'Selección del consultor',
                  'Informe final del consultor'
                ];

                // Determinar el índice del paso actual (basado en el estado)
                const pasoActualIndex = estadoContratacion 
                  ? pasos.findIndex(paso => paso.toLowerCase() === estadoContratacion.toLowerCase())
                  : -1;

                return (
                  <div 
                    key={contratacion.gid}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6'
                    }}
                  >
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: descripcionContratacion ? '0.35rem' : '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>
                          {nombreContratacion}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            onClick={() => setUpdateContratacion({
                              task: contratacion,
                              data: contratacionData ?? {
                                tipo: 'Contratacion',
                                actividad: task.name,
                                subarea: nombreContratacion,
                                descripcion: null,
                                fechaGeneracion: '',
                                estadoActual: '',
                                historialEstados: [],
                              },
                            })}
                            className="button-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}
                          >
                            ✏️ Actualizar estado
                          </button>
                          <button
                            onClick={() => { setEliminarContratacionTarget(contratacion); setEliminarContratacionTexto(''); }}
                            className="button-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap', color: '#dc2626', borderColor: '#fca5a5' }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                      {descripcionContratacion && (
                        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#666' }}>
                          {descripcionContratacion}
                        </p>
                      )}

                      {/* Progress Stepper */}
                      <div style={{ position: 'relative', paddingTop: '0.5rem' }}>
                        {/* Línea de fondo */}
                        <div style={{
                          position: 'absolute',
                          top: '23px',
                          left: '20px',
                          right: '20px',
                          height: '2px',
                          backgroundColor: '#e0e0e0',
                          zIndex: 0
                        }} />
                        
                        {/* Línea de progreso */}
                        {pasoActualIndex >= 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '23px',
                            left: '20px',
                            width: `${(pasoActualIndex / (pasos.length - 1)) * 100}%`,
                            height: '2px',
                            backgroundColor: '#4caf50',
                            zIndex: 1,
                            transition: 'width 0.3s ease'
                          }} />
                        )}
                        
                        {/* Pasos */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          position: 'relative',
                          zIndex: 2
                        }}>
                          {pasos.map((paso, index) => {
                            const isCompleted = pasoActualIndex >= 0 && index < pasoActualIndex;
                            const isCurrent = index === pasoActualIndex;

                            return (
                              <div 
                                key={index}
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center',
                                  flex: 1,
                                  maxWidth: '120px'
                                }}
                              >
                                {/* Círculo del paso */}
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: 
                                    isCompleted ? '#4caf50' :
                                    isCurrent ? '#626262' :
                                    '#e0e0e0',
                                  border: `2px solid ${
                                    isCompleted ? '#4caf50' :
                                    isCurrent ? '#626262' :
                                    '#e0e0e0'
                                  }`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isCompleted || isCurrent ? '#fff' : '#999',
                                  fontWeight: '600',
                                  fontSize: '0.75rem',
                                  transition: 'all 0.3s ease',
                                  boxShadow: isCurrent ? '0 2px 8px rgba(33, 150, 243, 0.3)' : 'none'
                                }}>
                                  {isCompleted ? '✓' : index + 1}
                                </div>
                                
                                {/* Texto del paso */}
                                <div style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.65rem',
                                  textAlign: 'center',
                                  color: isCurrent ? '#626262' : isCompleted ? '#4caf50' : '#999',
                                  fontWeight: isCurrent ? '600' : '400',
                                  lineHeight: '1.2',
                                  maxWidth: '100px'
                                }}>
                                  {paso}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Mensaje de estado actual */}
                      {pasoActualIndex >= 0 && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#f2f2f2',
                          borderRadius: '4px',
                          borderLeft: '3px solid #626262'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#4f4f4f' }}>
                            <strong>Estado actual:</strong> {pasos[pasoActualIndex]}
                          </p>
                        </div>
                      )}
                      
                      {pasoActualIndex < 0 && estadoContratacion && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#fff3e0',
                          borderRadius: '4px',
                          borderLeft: '3px solid #ff9800'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#e65100' }}>
                            <strong>Estado:</strong> {estadoContratacion} (no reconocido en el flujo)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Historial de actualizaciones */}
                    {(() => {
                      const parseFecha = (f: string) => {
                        const clean = f.replace(',', '').trim();
                        const [datePart, timePart = '00:00'] = clean.split(/\s+/);
                        const [d, m, y] = datePart.split('/');
                        return new Date(`${y}-${m}-${d}T${timePart}`).getTime();
                      };
                      const historial = ([...(contratacionData?.historialEstados as HistorialEntry[] ?? [])])
                        .sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
                      const historialKey = contratacion.gid;
                      const historialExpanded = expandedHistoriales.has(historialKey);
                      const toggleHistorial = () => setExpandedHistoriales(prev => {
                        const next = new Set(prev);
                        next.has(historialKey) ? next.delete(historialKey) : next.add(historialKey);
                        return next;
                      });
                      return (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: historial.length > 0 ? 'pointer' : 'default', marginBottom: historialExpanded ? '0.5rem' : 0 }}
                            onClick={() => historial.length > 0 && toggleHistorial()}
                          >
                            {historial.length > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#888', transition: 'transform 0.2s', display: 'inline-block', transform: historialExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            )}
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                              📋 Historial de actualizaciones {historial.length > 0 ? `(${historial.length})` : ''}
                            </p>
                          </div>
                          {historialExpanded && historial.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {historial.map((entry, i) => {
                                const canEditEntry = puedeEditarHistorial(entry);
                                return (
                                <div key={i} style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', borderLeft: '3px solid #626262', fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (entry.observaciones || entry.archivos?.length > 0) ? '0.35rem' : 0 }}>
                                    <span style={{ fontWeight: 600, color: '#333' }}>{entry.estado}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {entry.usuario ? (
                                        <span style={{ fontSize: '0.72rem', color: '#555' }}>👤 {entry.usuario.nombre} · <span style={{ color: '#9ca3af' }}>{entry.usuario.email}</span></span>
                                      ) : (
                                        <span style={{ fontSize: '0.72rem', color: '#999' }}>👤 Sin registro</span>
                                      )}
                                      <span style={{ fontSize: '0.72rem', color: '#ccc' }}>·</span>
                                      <span style={{ fontSize: '0.72rem', color: '#888' }}>{entry.fecha}</span>
                                      {canEditEntry && (
                                        <Tooltip title="Editar observaciones y archivos">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openEditHistorial(contratacion, entry); }}
                                            style={{ background: 'none', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.15rem 0.35rem', cursor: 'pointer', color: '#1d4ed8', fontSize: '0.75rem', lineHeight: 1 }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                          >✏️</button>
                                        </Tooltip>
                                      )}
                                      <Tooltip title={canEditEntry ? 'Eliminar' : 'Solo puedes eliminar actualizaciones de tu mismo rol'}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (canEditEntry) handleDeleteHistorialEntry(contratacion, entry); }}
                                          disabled={!canEditEntry}
                                          title="Eliminar esta actualización"
                                          style={{
                                            background: 'none', border: '1px solid #f5c6cb', borderRadius: '4px', padding: '0.15rem 0.35rem',
                                            cursor: canEditEntry ? 'pointer' : 'not-allowed',
                                            color: '#c0392b', fontSize: '0.75rem', lineHeight: 1,
                                            opacity: canEditEntry ? 1 : 0.4,
                                          }}
                                          onMouseEnter={e => canEditEntry && (e.currentTarget.style.background = '#fdecea')}
                                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                        >🗑️</button>
                                      </Tooltip>
                                    </div>
                                  </div>
                                  {entry.observaciones && (
                                    <p style={{ margin: '0 0 0.25rem', color: '#555', lineHeight: '1.4' }}>{entry.observaciones}</p>
                                  )}
                                  {entry.archivos?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                      {entry.archivos.map((archivo, j) => (
                                        <a
                                          key={j}
                                          href={archivo.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ fontSize: '0.72rem', color: '#1a73e8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
                                          📎 {archivo.nombre}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          )}
                          {historial.length === 0 && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>Sin actualizaciones aún.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="No hay contrataciones para esta actividad. Use el menú de acciones para registrar una contratación." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )),
          }]}
        />
      </div>

      {showMaterialModal && (
        <MaterialRequestModal
          task={task}
          projectName={projectName}
          onClose={() => setShowMaterialModal(false)}
          onSuccess={() => {
            setShowMaterialModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {showFundsModal && (
        <FundsRequestModal
          task={task}
          projectName={projectName}
          onClose={() => setShowFundsModal(false)}
          onSuccess={() => {
            setShowFundsModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {showReturnModal && (
        <MaterialReturnModal
          task={task}
          projectName={projectName}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            onSubtaskCreated?.();
          }}
        />
      )}

      {duplicarTarget?.tipo === 'material' && (() => {
        const d = parseMaterialRequest(duplicarTarget.record);
        return (
          <MaterialRequestModal
            task={task}
            projectName={projectName}
            initialData={{
              titulo: d.taskName,
              area: d.area,
              lugar: d.lugar,
              fechaInicio: toDateInput(d.fechaInicio),
              fechaFinalizacion: toDateInput(d.fechaFinalizacion),
              materiales: d.materiales,
            }}
            onClose={() => setDuplicarTarget(null)}
            onSuccess={() => { setDuplicarTarget(null); onSubtaskCreated?.(); }}
          />
        );
      })()}

      {duplicarTarget?.tipo === 'fondos' && (() => {
        const d = parseFundsRequest(duplicarTarget.record);
        return (
          <FundsRequestModal
            task={task}
            projectName={projectName}
            initialData={{
              titulo: d.taskName,
              area: d.area,
              lugar: d.lugar,
              fechaInicio: toDateInput(d.fechaInicio),
              fechaFinalizacion: toDateInput(d.fechaFinalizacion),
              fondos: d.fondos.map(f => ({ id: f.id, descripcion: f.descripcion, importeBolivianos: f.importeBolivianos })),
            }}
            onClose={() => setDuplicarTarget(null)}
            onSuccess={() => { setDuplicarTarget(null); onSubtaskCreated?.(); }}
          />
        );
      })()}

      {duplicarTarget?.tipo === 'devolucion' && (() => {
        const d = parseMaterialReturn(duplicarTarget.record);
        return (
          <MaterialReturnModal
            task={task}
            projectName={projectName}
            initialData={{
              titulo: d.taskName,
              area: d.area,
              lugar: d.lugar,
              fechaDevolucion: toDateInput(d.fechaDevolucion),
              materiales: d.materiales,
            }}
            onClose={() => setDuplicarTarget(null)}
            onSuccess={() => { setDuplicarTarget(null); onSubtaskCreated?.(); }}
          />
        );
      })()}

      {showVerificationModal && (
        <VerificationSourcesModal
          task={task}
          verificationSubtask={verificationSubtask}
          currentData={fuentesData}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => {
            setShowVerificationModal(false);
            window.location.reload();
          }}
        />
      )}

      {showContratacionModal && (
        <ContratacionModal
          task={task}
          onClose={() => setShowContratacionModal(false)}
          onSuccess={() => {
            setShowContratacionModal(false);
            window.location.reload();
          }}
        />
      )}

      {updateContratacion && (
        <ContratacionUpdateModal
          contratacion={updateContratacion.task}
          currentData={updateContratacion.data}
          onClose={() => setUpdateContratacion(null)}
          onSuccess={() => {
            setUpdateContratacion(null);
            onSubtaskCreated?.();
          }}
        />
      )}

      {eliminarContratacionTarget && (
        <div className="modal-overlay" onClick={() => { if (!eliminandoContratacion) { setEliminarContratacionTarget(null); setEliminarContratacionTexto(''); } }} style={{ zIndex: 1002 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fff5f5' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🗑️ Eliminar contratación
              </h2>
              <button
                onClick={() => { setEliminarContratacionTarget(null); setEliminarContratacionTexto(''); }}
                disabled={eliminandoContratacion}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6b7280', lineHeight: 1 }}
              >×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#374151' }}>
                Estás a punto de eliminar <strong>{eliminarContratacionTarget.name.replace('CPER - ', '')}</strong>.
              </p>
              <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Esta acción es <strong>irreversible</strong> y eliminará permanentemente la contratación y su historial en Asana.
              </p>
              <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
                Para confirmar, escribe <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>eliminar</span> en el campo de abajo:
              </p>
              <input
                type="text"
                value={eliminarContratacionTexto}
                onChange={e => setEliminarContratacionTexto(e.target.value)}
                placeholder="eliminar"
                autoFocus
                disabled={eliminandoContratacion}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: `1px solid ${eliminarContratacionTexto.toLowerCase() === 'eliminar' ? '#dc2626' : '#d1d5db'}`, borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && eliminarContratacionTexto.toLowerCase() === 'eliminar') handleEliminarContratacion(); }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  onClick={() => { setEliminarContratacionTarget(null); setEliminarContratacionTexto(''); }}
                  disabled={eliminandoContratacion}
                  style={{ padding: '0.5rem 1.25rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminarContratacion}
                  disabled={eliminandoContratacion || eliminarContratacionTexto.toLowerCase() !== 'eliminar'}
                  style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', background: eliminarContratacionTexto.toLowerCase() === 'eliminar' ? '#dc2626' : '#fca5a5', color: 'white', cursor: eliminarContratacionTexto.toLowerCase() === 'eliminar' ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {eliminandoContratacion ? 'Eliminando...' : '🗑️ Eliminar definitivamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editHistorial && (
        <Modal
          open
          title={`Editar actualización — ${editHistorial.entry.estado}`}
          onCancel={() => setEditHistorial(null)}
          width={620}
          okText="Guardar cambios"
          cancelText="Cancelar"
          confirmLoading={editHistorialSaving}
          onOk={handleSaveEditHistorial}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Observaciones</label>
            <Input.TextArea
              value={editHistorialObservaciones}
              onChange={e => setEditHistorialObservaciones(e.target.value)}
              placeholder="Notas u observaciones sobre este cambio de estado..."
              rows={3}
              maxLength={1000}
              showCount
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Archivos (Google Drive)</label>
            {editHistorialArchivos.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
                Sin archivos. Use el botón para agregar enlaces de Google Drive.
              </Typography.Text>
            )}
            <Space direction="vertical" style={{ width: '100%' }}>
              {editHistorialArchivos.map(archivo => (
                <Space key={archivo.id} style={{ width: '100%' }} align="start">
                  <Input
                    placeholder="Nombre del archivo"
                    value={archivo.nombre}
                    onChange={e => actualizarEditHistorialArchivo(archivo.id, 'nombre', e.target.value)}
                    style={{ width: 180 }}
                    maxLength={200}
                  />
                  <Input
                    placeholder="https://drive.google.com/..."
                    value={archivo.link}
                    onChange={e => actualizarEditHistorialArchivo(archivo.id, 'link', e.target.value)}
                    style={{ width: 260 }}
                  />
                  <Button danger icon={<DeleteOutlined />} onClick={() => eliminarEditHistorialArchivo(archivo.id)} />
                </Space>
              ))}
              <Button icon={<PlusOutlined />} onClick={agregarEditHistorialArchivo} size="small">
                Agregar archivo
              </Button>
            </Space>
          </div>
        </Modal>
      )}
    </>
  );
};

export default TaskInfo;
