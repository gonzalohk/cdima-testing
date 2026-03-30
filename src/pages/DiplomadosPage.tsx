import React, { useState, useEffect } from 'react';
import { Card, Dropdown, Select, Tabs } from 'antd';

import { useNavigate, useLocation } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import CreateDiplomadoModal from '../components/CreateDiplomadoModal';
import Notification from '../components/Notification';
import { HtmlModalHeader } from '../components/ModalShared';
import AgregarPersonaModal from '../components/AgregarPersonaModal';
import InfoPrimariaModal from '../components/InfoPrimariaModal';
import { exportDiplomadoGeneralPDF, exportDiplomadoGeneralWord, exportDiplomadoCentralizadorNotasPDF, exportDiplomadoCentralizadorNotasWord, exportDiplomadoEstudiantePDF } from '../services/reports/diplomados-reports.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';
import { 
  getCustomFieldValueSafe, 
  parseEstudianteData, 
  parseAsistenciaRecords,
  updateNotasWithAsistencia,
  calcularEdad,
  type AsistenciaRecord as AsistenciaRecordType
} from '../utils/asana-helpers';
import { 
  validateData, 
  GuardarAsistenciaSchema,
  AsistenciaRecordSchema
} from '../schemas/diplomado.schemas';

interface InfoPrimaria {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  domicilio: string;
  especialidad: string;
  documentoIdentidad: string;
  identidadCultural: string;
  tipo: 'Docente' | 'Estudiante';
}

interface AsistenciaEstudiante {
  gid: string;
  nombre: string;
  asistio: boolean;
  observaciones: string;
}

interface NotaEstudiante {
  gid: string;
  nombre: string;
  nota: number;
}




// ─── Document JSON helpers ──────────────────────────────────────────────────────
interface DocLink { nombre: string; url: string; fecha?: string; }
const _getFileType = (url: string): { icon: string; color: string; bg: string; label: string } => {
  const u = url.toLowerCase();
  if (u.includes('.pdf') || u.includes('/pdf')) return { icon: '📕', color: '#dc2626', bg: '#fef2f2', label: 'PDF' };
  if (u.match(/\.(doc|docx)/) || u.includes('document')) return { icon: '📘', color: '#1d4ed8', bg: '#eff6ff', label: 'Word' };
  if (u.match(/\.(xls|xlsx)/) || u.includes('spreadsheet')) return { icon: '📗', color: '#15803d', bg: '#f0fdf4', label: 'Excel' };
  if (u.match(/\.(ppt|pptx)/) || u.includes('presentation')) return { icon: '📙', color: '#d97706', bg: '#fffbeb', label: 'PPT' };
  if (u.match(/\.(jpg|jpeg|png|gif|svg|webp)/)) return { icon: '🖼️', color: '#7e22ce', bg: '#fdf4ff', label: 'Imagen' };
  if (u.match(/\.(mp4|mov|avi|webm)/)) return { icon: '🎬', color: '#0369a1', bg: '#f0f9ff', label: 'Video' };
  if (u.includes('/folders/')) return { icon: '📁', color: '#b45309', bg: '#fef3c7', label: 'Carpeta' };
  return { icon: '🔗', color: '#475569', bg: '#f1f5f9', label: 'Enlace' };
};
const _parseDocLinks = (notes: string | undefined | null): DocLink[] => {
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
const _buildDocNotes = (originalNotes: string | undefined | null, documentos: DocLink[]): string => {
  const base = (originalNotes ?? '').replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '').trim();
  return `${base}\n\n===DATOS_JSON===\n${JSON.stringify({ documentos }, null, 2)}\n===FIN_DATOS_JSON===`;
};

const DiplomadosPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [diplomadoToEdit, setDiplomadoToEdit] = useState<any>(null);
  const [selectedDiplomado, setSelectedDiplomado] = useState<AsanaSection | null>(null);
  const [diplomadosProjectGid, setDiplomadosProjectGid] = useState<string>('');
  const [activeDiplomadoTab, setActiveDiplomadoTab] = useState<string>('docentes');
  const [busquedaDocente, setBusquedaDocente] = useState<string>('');
  const [paginaDocentes, setPaginaDocentes] = useState<number>(1);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState<string>('');
  const [paginaEstudiantes, setPaginaEstudiantes] = useState<number>(1);
  const [busquedaCentralizador, setBusquedaCentralizador] = useState<string>('');
  const [busquedaAsistencia, setBusquedaAsistencia] = useState<string>('');
  const [selectedInfo, setSelectedInfo] = useState<InfoPrimaria | null>(null);
  
  // Estados para asistencia
  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [asistencias, setAsistencias] = useState<AsistenciaEstudiante[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);
  // Fecha en zona horaria de Bolivia (UTC-4)
  const [fechaAsistencia, setFechaAsistencia] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [asistenciasConError, setAsistenciasConError] = useState<Set<string>>(new Set());
  
  // Estados para registro de notas
  const [showRegistroNotasModal, setShowRegistroNotasModal] = useState(false);
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string>(ASANA_CUSTOM_FIELDS.MODULO_1);
  const [notasEstudiantes, setNotasEstudiantes] = useState<NotaEstudiante[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [notasConError, setNotasConError] = useState<Set<string>>(new Set());
  const [notasOriginales, setNotasOriginales] = useState<Record<string, number>>({});
  
  // Estados para modales individuales
  const [estudianteSeleccionadoNotas, setEstudianteSeleccionadoNotas] = useState<AsanaTask | null>(null);
  const [estudianteSeleccionadoAsistencia, setEstudianteSeleccionadoAsistencia] = useState<AsanaTask | null>(null);
  
  // Estados para los detalles del diplomado
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [docentes, setDocentes] = useState<AsanaTask[]>([]);
  const [estudiantes, setEstudiantes] = useState<AsanaTask[]>([]);
  const [documentos, setDocumentos] = useState<AsanaTask[]>([]);
  
  const [docentesTaskGid, setDocentesTaskGid] = useState<string>('');
  const [estudiantesTaskGid, setEstudiantesTaskGid] = useState<string>('');
  const [showAgregarDocenteModal, setShowAgregarDocenteModal] = useState(false);
  const [showAgregarEstudianteModal, setShowAgregarEstudianteModal] = useState(false);

  // Estados para documentos
  const [docModalSubtask, setDocModalSubtask] = useState<AsanaTask | null>(null);
  const [docNombre, setDocNombre] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docModalError, setDocModalError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) {
      navigate('/');
      return;
    }
    loadDiplomados();
  }, [navigate]);

  // Efecto para manejar diplomado seleccionado desde el menú
  useEffect(() => {
    if (location.state?.selectedDiplomado && diplomados.length > 0) {
      const diplomado = diplomados.find(d => d.gid === location.state.selectedDiplomado.gid);
      if (diplomado) {
        handleViewDetails(diplomado);
        // Limpiar el estado de navegación
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, diplomados]);

  const loadDiplomados = async () => {
    setLoading(true);
    setError('');
    try {
      // Obtener workspaces
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      
      if (!cdima) {
        throw new Error('No se encontró el workspace CDIMA');
      }

      // Obtener proyectos y buscar "Diplomados"
      const projects = await asanaService.getProjects(cdima.gid);
      const diplomadosProject = projects.find(p => 
        p.name.toLowerCase().includes('diplomado')
      );

      if (!diplomadosProject) {
        throw new Error('No se encontró el proyecto "Diplomados"');
      }

      setDiplomadosProjectGid(diplomadosProject.gid);

      // Obtener secciones del proyecto (cada sección es un diplomado)
      const sections = await asanaService.getSections(diplomadosProject.gid);
      setDiplomados(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar diplomados');
      console.error('Error loading diplomados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setEditMode(false);
    setDiplomadoToEdit(null);
    loadDiplomados();
    // Si hay un diplomado seleccionado, recargar sus detalles
    if (selectedDiplomado) {
      handleViewDetails(selectedDiplomado);
    }
  };

  const handleEditDiplomado = async () => {
    if (!selectedDiplomado) return;

    setLoadingDetails(true);
    try {
      // Obtener tareas de la sección
      const sectionTasks = await asanaService.getSectionTasks(selectedDiplomado.gid);

      // Buscar las tareas principales
      const tareaDocentes = sectionTasks.find(t => t.name === 'Docentes');
      const tareaEstudiantes = sectionTasks.find(t => t.name === 'Estudiantes');

      if (!tareaDocentes || !tareaEstudiantes) {
        throw new Error('No se encontraron las tareas de Docentes o Estudiantes');
      }

      // Obtener subtareas
      const subtasksDocentes = await asanaService.getSubtasks(tareaDocentes.gid);
      const subtasksEstudiantes = await asanaService.getSubtasks(tareaEstudiantes.gid);

      // Parsear datos de docentes
      const docentesData = subtasksDocentes.map(subtask => {
        const data = parseEstudianteData(subtask.notes);
        return {
          nombre: subtask.name,
          genero: data.genero,
          fechaNacimiento: data.fechaNacimiento || '',
          especialidad: data.especialidad || '',
          domicilio: data.domicilio || '',
          telefono: data.telefono || '',
          lugarNacimiento: data.lugarNacimiento || '',
          documentoIdentidad: data.documentoIdentidad || '',
          identidadCultural: data.identidadCultural || '',
          subtaskGid: subtask.gid,
          _parseError: data._parseError
        };
      });

      // Parsear datos de estudiantes
      const estudiantesData = subtasksEstudiantes.map(subtask => {
        const data = parseEstudianteData(subtask.notes);
        return {
          nombre: subtask.name,
          genero: data.genero,
          fechaNacimiento: data.fechaNacimiento || '',
          especialidad: data.especialidad || '',
          domicilio: data.domicilio || '',
          telefono: data.telefono || '',
          lugarNacimiento: data.lugarNacimiento || '',
          documentoIdentidad: data.documentoIdentidad || '',
          identidadCultural: data.identidadCultural || '',
          subtaskGid: subtask.gid,
          _parseError: data._parseError
        };
      });

      // Advertir si algún participante tiene datos corruptos
      const participantesConError = [...docentesData, ...estudiantesData].filter(p => p._parseError);
      if (participantesConError.length > 0) {
        const nombres = participantesConError.map(p => p.nombre).join(', ');
        const continuar = window.confirm(
          `⚠️ Advertencia: Los datos de los siguientes participantes no se pudieron leer correctamente:\n\n${nombres}\n\n` +
          `Esto puede ocurrir si la tarea fue editada manualmente en Asana.\n\n` +
          `Si continúas, los campos vacíos en el formulario sobreescribirán los datos actuales de esos participantes.\n\n` +
          `¿Deseas continuar de todas formas?`
        );
        if (!continuar) {
          setLoadingDetails(false);
          return;
        }
      }

      // Preparar datos para el modal
      setDiplomadoToEdit({
        gid: selectedDiplomado.gid,
        nombre: selectedDiplomado.name,
        docentes: docentesData,
        estudiantes: estudiantesData,
        docentesTaskGid: tareaDocentes.gid,
        estudiantesTaskGid: tareaEstudiantes.gid
      });

      setEditMode(true);
      setShowCreateModal(true);
    } catch (err) {
      console.error('Error loading diplomado for edit:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar diplomado para editar');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (diplomado: AsanaSection) => {
    setSelectedDiplomado(diplomado);
    setLoadingDetails(true);
    setDocentes([]);
    setEstudiantes([]);
    setDocumentos([]);

    try {
      // Obtener tareas de la sección
      const sectionTasks = await asanaService.getSectionTasks(diplomado.gid);

      // Buscar las tareas principales
      const tareaDocentes = sectionTasks.find(t => t.name === 'Docentes');
      const tareaEstudiantes = sectionTasks.find(t => t.name === 'Estudiantes');
      const tareaDocumentos = sectionTasks.find(t => t.name === 'Documentos');

      // Obtener subtareas de cada tarea
      if (tareaDocentes) {
        const subtasks = await asanaService.getSubtasks(tareaDocentes.gid);
        setDocentes(sortByApellidos(subtasks));
        setDocentesTaskGid(tareaDocentes.gid);
      }

      if (tareaEstudiantes) {
        const subtasks = await asanaService.getSubtasks(tareaEstudiantes.gid);
        setEstudiantes(sortByApellidos(subtasks));
        setEstudiantesTaskGid(tareaEstudiantes.gid);
      }

      if (tareaDocumentos) {
        const subtasks = await asanaService.getSubtasks(tareaDocumentos.gid);
        setDocumentos(subtasks);
      }
    } catch (err) {
      console.error('Error loading diplomado details:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar detalles del diplomado');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Función para ordenar personas por Apellido Paterno + Apellido Materno + Nombre
  const sortByApellidos = (tasks: AsanaTask[]): AsanaTask[] => {
    return [...tasks].sort((a, b) => {
      // Extraer apellidos del nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
      const parseNombre = (nombreCompleto: string) => {
        const partes = nombreCompleto.split(',').map(p => p.trim());
        return {
          nombre: partes[0] || '',
          apellidoPaterno: partes[1] || '',
          apellidoMaterno: partes[2] || ''
        };
      };
      
      const personaA = parseNombre(a.name);
      const personaB = parseNombre(b.name);
      
      // Ordenar primero por apellido paterno
      if (personaA.apellidoPaterno !== personaB.apellidoPaterno) {
        return personaA.apellidoPaterno.localeCompare(personaB.apellidoPaterno, 'es');
      }
      
      // Si son iguales, ordenar por apellido materno
      if (personaA.apellidoMaterno !== personaB.apellidoMaterno) {
        return personaA.apellidoMaterno.localeCompare(personaB.apellidoMaterno, 'es');
      }
      
      // Si ambos apellidos son iguales, ordenar por nombre
      return personaA.nombre.localeCompare(personaB.nombre, 'es');
    });
  };

  // Función helper para formatear nombres en formato "Apellido Paterno Apellido Materno Nombre" sin comas
  const formatearNombreCompleto = (nombreCompleto: string): string => {
    // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
    const partes = nombreCompleto.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    
    // Retornar en formato: Apellido Paterno Apellido Materno Nombre (SIN COMAS)
    return `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
  };

  const parseInfoPrimariaLegacy = (task: AsanaTask, tipo: 'Docente' | 'Estudiante'): InfoPrimaria => {
    // Usa la nueva función helper robusta
    const data = parseEstudianteData(task.notes);
    
    return {
      nombre: formatearNombreCompleto(task.name),
      genero: data.genero,
      fechaNacimiento: data.fechaNacimiento || '',
      domicilio: data.domicilio || '',
      especialidad: data.especialidad || '',
      telefono: data.telefono || '',
      lugarNacimiento: data.lugarNacimiento || '',
      documentoIdentidad: data.documentoIdentidad || '',
      identidadCultural: data.identidadCultural || '',
      tipo
    };
  };

  /* const handleDeleteDiplomado = async (sectionGid: string, diplomadoName: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el diplomado "${diplomadoName}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await asanaService.deleteSection(sectionGid);
      await loadDiplomados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar diplomado');
    } finally {
      setLoading(false);
    }
  }; */

  const handleShowInfo = (task: AsanaTask, tipo: 'Docente' | 'Estudiante') => {
    const info = parseInfoPrimariaLegacy(task, tipo);
    setSelectedInfo(info);
  };

  // === Funciones para Asistencia ===
  
  const handleAbrirAsistencia = () => {
    // Reiniciar la fecha a hoy en zona horaria de Bolivia cuando se abre el modal
    setFechaAsistencia(format(new Date(), 'yyyy-MM-dd'));
    
    // Inicializar asistencias con los estudiantes actuales
    const asistenciasIniciales: AsistenciaEstudiante[] = estudiantes.map(estudiante => ({
      gid: estudiante.gid,
      nombre: formatearNombreCompleto(estudiante.name),
      asistio: false,
      observaciones: ''
    }));
    setAsistencias(asistenciasIniciales);
    setAsistenciasConError(new Set()); // Limpiar errores previos
    setShowAsistenciaModal(true);
  };

  const handleCambiarAsistencia = (gid: string, campo: 'asistio' | 'observaciones', valor: boolean | string) => {
    setAsistencias(prev => prev.map(asist => 
      asist.gid === gid 
        ? { ...asist, [campo]: valor }
        : asist
    ));
  };

  const handleGuardarAsistencias = async (soloReintentar: boolean = false) => {
    setLoadingAsistencia(true);
    try {
      // Validar datos de entrada con Zod
      const validationResult = validateData(GuardarAsistenciaSchema, {
        fecha: fechaAsistencia,
        asistencias: asistencias
      });

      if (!validationResult.success) {
        alert(`❌ Error de validación: ${validationResult.error}`);
        setLoadingAsistencia(false);
        return;
      }

      // Confirmación previa al guardado masivo
      if (!soloReintentar) {
        const [year, month, day] = fechaAsistencia.split('-').map(Number);
        const fechaPreview = `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
        if (!window.confirm(`¿Guardar asistencias del ${fechaPreview} para ${asistencias.length} estudiantes?\n\nEsta acción modificará los registros en Asana.`)) {
          setLoadingAsistencia(false);
          return;
        }
      }

      // Formatear la fecha seleccionada
      // IMPORTANTE: Parsear en zona horaria local para evitar problemas con UTC
      // que pueden causar que domingo/lunes se conviertan al día anterior
      const [year, month, day] = fechaAsistencia.split('-').map(Number);
      const fechaLocal = new Date(year, month - 1, day); // month es 0-indexed en Date
      const fechaSeleccionada = format(fechaLocal, "dd/MM/yyyy", { locale: es });
      
      console.log(`📅 Guardando asistencias para la fecha: ${fechaSeleccionada}`);
      
      // Determinar qué estudiantes procesar
      const estudiantesProcesar = soloReintentar
        ? asistencias.filter(ast => asistenciasConError.has(ast.gid))
        : asistencias;
      
      if (estudiantesProcesar.length === 0) {
        alert('⚠️ No hay estudiantes para procesar');
        return;
      }
      
      // ✅ OPTIMIZACIÓN: Enviar en lotes de 12 para respetar el límite de Asana
      console.log(`🚀 Ejecutando actualización en lotes de 12 para ${estudiantesProcesar.length} estudiantes${soloReintentar ? ' (reintento)' : ''}...`);
      const startTime = performance.now();
      const BATCH_SIZE = 12;
      const notasActualizadasMap = new Map<string, string>();
      const buildPromise = async (asistencia: typeof estudiantesProcesar[0]) => {
        const estudiante = estudiantes.find(e => e.gid === asistencia.gid);
        if (!estudiante) {
          console.warn(`⚠️ No se encontró el estudiante con gid: ${asistencia.gid}`);
          return { success: false, gid: asistencia.gid, nombre: asistencia.nombre, error: 'Estudiante no encontrado' };
        }

        console.log(`👤 Preparando actualización: ${asistencia.nombre}`);
        
        try {
          // Parsear registros existentes
          const registrosExistentes = parseAsistenciaRecords(estudiante.notes);
          
          // Crear nuevo registro
          const nuevoRegistro: AsistenciaRecordType = {
            fecha: fechaSeleccionada,
            asistio: asistencia.asistio,
            observaciones: asistencia.observaciones || 'Ninguna'
          };

          // Validar el nuevo registro
          const recordValidation = validateData(AsistenciaRecordSchema, nuevoRegistro);
          if (!recordValidation.success) {
            console.warn(`⚠️ Registro inválido para ${asistencia.nombre}:`, recordValidation.error);
            return { success: false, gid: asistencia.gid, nombre: asistencia.nombre, error: recordValidation.error };
          }

          // Buscar si ya existe un registro para esta fecha
          const indiceExistente = registrosExistentes.findIndex(r => r.fecha === fechaSeleccionada);
          
          if (indiceExistente !== -1) {
            console.log(`♻️ Reemplazando registro existente para ${asistencia.nombre}`);
            registrosExistentes[indiceExistente] = nuevoRegistro;
          } else {
            console.log(`➕ Agregando nuevo registro para ${asistencia.nombre}`);
            registrosExistentes.unshift(nuevoRegistro);
          }
          
          // Usar helper para actualizar notas preservando datos de estudiante
          const nuevasNotas = updateNotasWithAsistencia(estudiante.notes || '', registrosExistentes);
          
          // Actualizar la tarea con las nuevas notas
          const resultado = await asanaService.updateTask(asistencia.gid, { notes: nuevasNotas });
          
          notasActualizadasMap.set(asistencia.gid, nuevasNotas);
          console.log(`✅ Asistencia guardada para ${asistencia.nombre}`);
          return { success: true, gid: asistencia.gid, nombre: asistencia.nombre, result: resultado };
        } catch (error) {
          console.error(`❌ Error al guardar asistencia de ${asistencia.nombre}:`, error);
          return { success: false, gid: asistencia.gid, nombre: asistencia.nombre, error };
        }
      };

      // ✅ Ejecutar en lotes de 12 para respetar el límite de Asana
      const allResults: Awaited<ReturnType<typeof buildPromise>>[] = [];
      for (let i = 0; i < estudiantesProcesar.length; i += BATCH_SIZE) {
        const chunk = estudiantesProcesar.slice(i, i + BATCH_SIZE);
        console.log(`  📦 Lote ${Math.floor(i / BATCH_SIZE) + 1}: enviando ${chunk.length} registros...`);
        const chunkResults = await Promise.all(chunk.map(buildPromise));
        allResults.push(...chunkResults);
      }
      const results = allResults;
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      // Verificar resultados
      const exitosos = results.filter(r => r.success);
      const fallidos = results.filter(r => !r.success);
      
      console.log(`\n📊 Resultado del batch:`);
      console.log(`   ✅ Exitosos: ${exitosos.length}`);
      console.log(`   ❌ Fallidos: ${fallidos.length}`);
      console.log(`   ⏱️ Tiempo: ${duration}s`);

      // Actualizar el set de errores con los GIDs que fallaron
      const nuevosErrores = new Set(fallidos.map(r => r.gid));
      setAsistenciasConError(nuevosErrores);

      if (fallidos.length > 0) {
        // ❌ HAY ERRORES - NO CERRAR EL MODAL
        const nombresFallidos = fallidos.map(r => r.nombre).join(', ');
        
        console.error('❌ Algunas asistencias no se guardaron:', nombresFallidos);
        
        // NO cerrar el modal, mostrar error con opción de reintentar
        const mensaje = `⚠️ ATENCIÓN: Las asistencias son críticas\n\n` +
          `✅ Guardadas exitosamente: ${exitosos.length}\n` +
          `❌ Fallaron: ${fallidos.length}\n\n` +
          `Estudiantes con error:\n${nombresFallidos}\n\n` +
          `Los estudiantes con error están marcados en ROJO.\n` +
          `Presiona "Reintentar Guardado" para intentar guardar solo los que fallaron.`;
        
        alert(mensaje);
        
        // Mantener el modal abierto para que puedan reintentar
      } else {
        // ✅ TODO EXITOSO - CERRAR EL MODAL
        alert(`✅ ¡Perfecto! Todas las ${exitosos.length} asistencias para ${fechaSeleccionada} fueron guardadas correctamente en ${duration}s`);
        
        // Actualizar notas en estado local con los datos recién guardados (evita re-fetch con datos stale)
        setEstudiantes(prev => prev.map(e =>
          notasActualizadasMap.has(e.gid) ? { ...e, notes: notasActualizadasMap.get(e.gid) } : e
        ));
        
        // Cerrar el modal solo cuando TODO sea exitoso
        setShowAsistenciaModal(false);
        setAsistenciasConError(new Set()); // Limpiar errores
      }

    } catch (err) {
      console.error('❌ Error crítico al guardar asistencias:', err);
      if (err instanceof Error) {
        alert(`❌ Error crítico al guardar las asistencias: ${err.message}\n\nEl modal permanecerá abierto para que puedas reintentar.`);
      } else {
        alert('❌ Error crítico al guardar las asistencias\n\nEl modal permanecerá abierto para que puedas reintentar.');
      }
      // NO cerrar el modal en caso de error crítico
    } finally {
      setLoadingAsistencia(false);
    }
  };

  // === Funciones para Registro de Notas ===
  
  const handleAbrirRegistroNotas = () => {
    // Resetear módulo seleccionado al primer módulo
    setModuloSeleccionado(ASANA_CUSTOM_FIELDS.MODULO_1);
    
    // Inicializar array de notas con los estudiantes
    const notasIniciales: NotaEstudiante[] = estudiantes.map(est => {
      // Obtener la nota actual del módulo 1 (por defecto)
      const notaActual = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
      return {
        gid: est.gid,
        nombre: formatearNombreCompleto(est.name),
        nota: notaActual
      };
    });
    
    setNotasEstudiantes(notasIniciales);
    setNotasOriginales(Object.fromEntries(notasIniciales.map(n => [n.gid, n.nota])));
    setNotasConError(new Set()); // Limpiar errores previos
    setShowRegistroNotasModal(true);
  };

  const handleCambiarModulo = (nuevoModulo: string) => {
    setModuloSeleccionado(nuevoModulo);
    
    // Actualizar las notas con los valores del nuevo módulo seleccionado
    const notasActualizadas = estudiantes.map(est => {
      const notaActual = getCustomFieldValueSafe(est, nuevoModulo, 0);
      return {
        gid: est.gid,
        nombre: formatearNombreCompleto(est.name),
        nota: notaActual
      };
    });
    
    setNotasEstudiantes(notasActualizadas);
    setNotasOriginales(Object.fromEntries(notasActualizadas.map(n => [n.gid, n.nota])));
  };

  const handleCambiarNota = (gid: string, nota: number) => {
    setNotasEstudiantes(prev => prev.map(est => 
      est.gid === gid 
        ? { ...est, nota }
        : est
    ));
  };

  const handleGuardarNotas = async (soloReintentar: boolean = false) => {
    setLoadingNotas(true);
    try {
      console.log(`📝 Guardando notas para ${moduloSeleccionado}...`);
      
      // Obtener el GID del campo personalizado del módulo seleccionado
      const estudianteConCampos = estudiantes.find(est => 
        est.custom_fields && est.custom_fields.length > 0
      );
      
      if (!estudianteConCampos || !estudianteConCampos.custom_fields) {
        throw new Error('No se encontraron campos personalizados en los estudiantes');
      }
      
      const campoModulo = estudianteConCampos.custom_fields.find(
        field => field.name === moduloSeleccionado
      );
      
      if (!campoModulo) {
        throw new Error(`No se encontró el campo personalizado "${moduloSeleccionado}"`);
      }
      
      console.log(`🔑 GID del campo ${moduloSeleccionado}: ${campoModulo.gid}`);
      
      // Determinar qué estudiantes procesar (solo modificados, o los que fallaron en reintento)
      const estudiantesProcesar = soloReintentar
        ? notasEstudiantes.filter(est => notasConError.has(est.gid))
        : notasEstudiantes.filter(est => est.nota !== (notasOriginales[est.gid] ?? -1));
      
      if (estudiantesProcesar.length === 0) {
        alert('⚠️ No hay notas modificadas para guardar');
        setLoadingNotas(false);
        return;
      }

      // Confirmación previa al guardado
      if (!soloReintentar) {
        if (!window.confirm(`¿Guardar ${estudiantesProcesar.length} nota${estudiantesProcesar.length !== 1 ? 's' : ''} modificada${estudiantesProcesar.length !== 1 ? 's' : ''} de ${moduloSeleccionado}?\n\nEsta acción modificará los registros en Asana.`)) {
          setLoadingNotas(false);
          return;
        }
      }
      
      // ✅ OPTIMIZACIÓN: Enviar en lotes de 12 para respetar el límite de Asana
      console.log(`🚀 Ejecutando actualización en lotes de 12 para ${estudiantesProcesar.length} estudiantes${soloReintentar ? ' (reintento)' : ''}...`);
      const startTime = performance.now();
      const BATCH_SIZE = 12;
      const buildPromise = async (notaEstudiante: typeof estudiantesProcesar[0]) => {
        const estudiante = estudiantes.find(e => e.gid === notaEstudiante.gid);
        if (!estudiante) {
          console.warn(`⚠️ No se encontró el estudiante con gid: ${notaEstudiante.gid}`);
          return { success: false, gid: notaEstudiante.gid, nombre: notaEstudiante.nombre, error: 'Estudiante no encontrado' };
        }

        console.log(`👤 Preparando actualización: ${notaEstudiante.nombre} - Nota: ${notaEstudiante.nota}`);
        
        // Actualizar el campo personalizado
        const custom_fields: { [key: string]: number } = {};
        custom_fields[campoModulo.gid] = notaEstudiante.nota;
        
        try {
          const resultado = await asanaService.updateTask(notaEstudiante.gid, {
            custom_fields
          });
          
          console.log(`✅ Nota guardada para ${notaEstudiante.nombre}`);
          return { success: true, gid: notaEstudiante.gid, nombre: notaEstudiante.nombre, result: resultado };
        } catch (error) {
          console.error(`❌ Error al guardar nota de ${notaEstudiante.nombre}:`, error);
          return { success: false, gid: notaEstudiante.gid, nombre: notaEstudiante.nombre, error };
        }
      };

      // ✅ Ejecutar en lotes de 12 para respetar el límite de Asana
      const allResults: Awaited<ReturnType<typeof buildPromise>>[] = [];
      for (let i = 0; i < estudiantesProcesar.length; i += BATCH_SIZE) {
        const chunk = estudiantesProcesar.slice(i, i + BATCH_SIZE);
        console.log(`  📦 Lote ${Math.floor(i / BATCH_SIZE) + 1}: enviando ${chunk.length} notas...`);
        const chunkResults = await Promise.all(chunk.map(buildPromise));
        allResults.push(...chunkResults);
      }
      const results = allResults;
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      // Verificar resultados
      const exitosos = results.filter(r => r.success);
      const fallidos = results.filter(r => !r.success);
      
      console.log(`\n📊 Resultado del batch:`);
      console.log(`   ✅ Exitosos: ${exitosos.length}`);
      console.log(`   ❌ Fallidos: ${fallidos.length}`);
      console.log(`   ⏱️ Tiempo: ${duration}s`);

      // Actualizar el set de errores con los GIDs que fallaron
      const nuevosErrores = new Set(fallidos.map(r => r.gid));
      setNotasConError(nuevosErrores);

      if (fallidos.length > 0) {
        // ❌ HAY ERRORES - NO CERRAR EL MODAL
        const nombresFallidos = fallidos.map(r => r.nombre).join(', ');
        
        console.error('❌ Algunos estudiantes no se guardaron:', nombresFallidos);
        
        // NO cerrar el modal, mostrar error con opción de reintentar
        const mensaje = `⚠️ ATENCIÓN: Los puntajes son críticos\n\n` +
          `✅ Guardados exitosamente: ${exitosos.length}\n` +
          `❌ Fallaron: ${fallidos.length}\n\n` +
          `Estudiantes con error:\n${nombresFallidos}\n\n` +
          `Los estudiantes con error están marcados en ROJO.\n` +
          `Presiona "Reintentar Guardado" para intentar guardar solo los que fallaron.`;
        
        alert(mensaje);
        
        // Mantener el modal abierto para que puedan reintentar
      } else {
        // ✅ TODO EXITOSO - CERRAR EL MODAL
        alert(`✅ ¡Perfecto! Todas las ${exitosos.length} notas de ${moduloSeleccionado} fueron guardadas correctamente en ${duration}s`);
        
        console.log('\n🔄 Recargando datos del diplomado...');
        
        // Recargar los detalles del diplomado para ver los cambios
        if (selectedDiplomado) {
          await handleViewDetails(selectedDiplomado);
        }
        
        // Cerrar el modal solo cuando TODO sea exitoso
        setShowRegistroNotasModal(false);
        setNotasConError(new Set()); // Limpiar errores
      }

    } catch (err) {
      console.error('❌ Error crítico al guardar notas:', err);
      if (err instanceof Error) {
        alert(`❌ Error crítico al guardar las notas: ${err.message}\n\nEl modal permanecerá abierto para que puedas reintentar.`);
      } else {
        alert('❌ Error crítico al guardar las notas\n\nEl modal permanecerá abierto para que puedas reintentar.');
      }
      // NO cerrar el modal en caso de error crítico
    } finally {
      setLoadingNotas(false);
    }
  };

  // === Función para extraer registros de asistencia ===
  
  const extraerAsistenciasEstudiantes = () => {
    interface AsistenciaEstudianteData {
      nombre: string;
      registros: { [fecha: string]: { asistio: boolean; observaciones: string } };
    }

    const asistenciasPorEstudiante: AsistenciaEstudianteData[] = [];
    const todasLasFechas = new Set<string>();

    estudiantes.forEach(estudiante => {
      // Usar el helper robusto para parsear asistencias
      const registrosArray = parseAsistenciaRecords(estudiante.notes);
      
      // Convertir array a objeto { fecha: { asistio, observaciones } }
      const registros: { [fecha: string]: { asistio: boolean; observaciones: string } } = {};
      
      registrosArray.forEach(record => {
        registros[record.fecha] = {
          asistio: record.asistio,
          observaciones: record.observaciones
        };
        todasLasFechas.add(record.fecha);
      });

      asistenciasPorEstudiante.push({
        nombre: formatearNombreCompleto(estudiante.name),
        registros
      });
    });

    // Ordenar fechas cronológicamente (menor a mayor, más antiguas primero)
    const fechasOrdenadas = Array.from(todasLasFechas).sort((a, b) => {
      const [diaA, mesA, añoA] = a.split('/').map(Number);
      const [diaB, mesB, añoB] = b.split('/').map(Number);
      const fechaA = new Date(añoA, mesA - 1, diaA);
      const fechaB = new Date(añoB, mesB - 1, diaB);
      return fechaA.getTime() - fechaB.getTime();
    });

    return { asistenciasPorEstudiante, fechasOrdenadas };
  };

  const handleExportDiplomadoGeneral = async () => {
    if (!selectedDiplomado) return;
    try {
      await exportDiplomadoGeneralPDF({
        diplomado: selectedDiplomado,
        docentes,
        estudiantes
      });
    } catch (error) {
      console.error('Error al exportar reporte:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    }
  };

  const handleExportDiplomadoGeneralWord = async () => {
    if (!selectedDiplomado) return;
    try {
      await exportDiplomadoGeneralWord({
        diplomado: selectedDiplomado,
        estudiantes
      });
    } catch (error) {
      console.error('Error al exportar documento WORD:', error);
      alert('Error al generar el documento WORD. Por favor, intenta de nuevo.');
    }
  };

  const handleExportCentralizadorNotas = async () => {
    if (!selectedDiplomado || estudiantes.length === 0) return;
    try {
      await exportDiplomadoCentralizadorNotasPDF({
        diplomado: selectedDiplomado,
        estudiantes
      });
    } catch (error) {
      console.error('Error al exportar centralizador:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    }
  };

  const handleExportCentralizadorNotasWord = async () => {
    if (!selectedDiplomado || estudiantes.length === 0) return;
    try {
      await exportDiplomadoCentralizadorNotasWord({
        diplomado: selectedDiplomado,
        estudiantes
      });
    } catch (error) {
      console.error('Error al exportar documento WORD:', error);
      alert('Error al generar el documento WORD. Por favor, intenta de nuevo.');
    }
  };

  const handleExportEstudianteReport = async (estudiante: AsanaTask) => {
    try {
      await exportDiplomadoEstudiantePDF({
        estudiante,
        diplomado: selectedDiplomado ?? undefined
      });
    } catch (error) {
      console.error('Error al exportar reporte de estudiante:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    }
  };

  // === Funciones para Documentos ===

  const handleOpenDocModal = (subtask: AsanaTask) => {
    setDocModalSubtask(subtask);
    setDocNombre('');
    setDocUrl('');
    setDocModalError('');
  };

  const handleCloseDocModal = () => {
    setDocModalSubtask(null);
    setDocNombre('');
    setDocUrl('');
    setDocModalError('');
  };

  const handleSaveDocumento = async () => {
    if (!docModalSubtask) return;
    if (!docNombre.trim()) { setDocModalError('El nombre del archivo es obligatorio'); return; }
    if (!docUrl.trim()) { setDocModalError('El enlace es obligatorio'); return; }
    try { new URL(docUrl.trim()); } catch { setDocModalError('El enlace ingresado no es válido'); return; }
    setSavingDoc(true);
    setDocModalError('');
    try {
      const existing = _parseDocLinks(docModalSubtask.notes);
      const fecha = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
      const updated = [...existing, { nombre: docNombre.trim(), url: docUrl.trim(), fecha }];
      const newNotes = _buildDocNotes(docModalSubtask.notes, updated);
      await asanaService.updateTask(docModalSubtask.gid, { notes: newNotes });
      setDocumentos(prev => prev.map(d => d.gid === docModalSubtask.gid ? { ...d, notes: newNotes } : d));
      setNotification({ message: 'Archivo agregado correctamente', type: 'success' });
      handleCloseDocModal();
    } catch (err) {
      setDocModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDocumento = async (subtask: AsanaTask, index: number) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      const existing = _parseDocLinks(subtask.notes);
      const updated = existing.filter((_, i) => i !== index);
      const newNotes = _buildDocNotes(subtask.notes, updated);
      await asanaService.updateTask(subtask.gid, { notes: newNotes });
      setDocumentos(prev => prev.map(d => d.gid === subtask.gid ? { ...d, notes: newNotes } : d));
      setNotification({ message: 'Archivo eliminado', type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Error al eliminar', type: 'error' });
    }
  };

  const handleDeleteAsistenciaDia = async (fecha: string) => {
    if (!confirm(`¿Eliminar los registros de asistencia del ${fecha} para TODOS los estudiantes?`)) return;
    try {
      const BATCH_SIZE = 12;
      const updates = estudiantes.map(est => async () => {
        const registros = parseAsistenciaRecords(est.notes);
        const actualizados = registros.filter(r => r.fecha !== fecha);
        const newNotes = updateNotasWithAsistencia(est.notes ?? '', actualizados);
        await asanaService.updateTask(est.gid, { notes: newNotes });
        return { gid: est.gid, newNotes };
      });
      const results: { gid: string; newNotes: string }[] = [];
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = await Promise.all(updates.slice(i, i + BATCH_SIZE).map(fn => fn()));
        results.push(...batch);
      }
      setEstudiantes(prev => prev.map(e => {
        const r = results.find(x => x.gid === e.gid);
        return r ? { ...e, notes: r.newNotes } : e;
      }));
      setNotification({ message: `Registros del ${fecha} eliminados para ${results.length} estudiante(s)`, type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Error al eliminar registros', type: 'error' });
    }
  };

  const handleDeleteAsistenciaRecord = async (estudiante: AsanaTask, fecha: string) => {
    if (!confirm(`¿Eliminar el registro de asistencia del ${fecha}?`)) return;
    try {
      const registros = parseAsistenciaRecords(estudiante.notes);
      const actualizados = registros.filter(r => r.fecha !== fecha);
      const newNotes = updateNotasWithAsistencia(estudiante.notes ?? '', actualizados);
      await asanaService.updateTask(estudiante.gid, { notes: newNotes });
      const updatedTask = { ...estudiante, notes: newNotes };
      setEstudiantes(prev => prev.map(e => e.gid === estudiante.gid ? updatedTask : e));
      setEstudianteSeleccionadoAsistencia(updatedTask);
      setNotification({ message: `Registro del ${fecha} eliminado`, type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Error al eliminar registro', type: 'error' });
    }
  };

  if (loading) {
    return <LoadingOverlay message="Cargando diplomados..." />;
  }

  return (
    <div className="planning-page">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      {/* Header fusionado con selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 0', marginBottom: '0', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🎓</span>
          <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.01em' }}>Diplomado en:</span>
          <style>{`
            .dip-inline-sel .ant-select-selector { border: none !important; border-bottom: 2px solid transparent !important; background: transparent !important; box-shadow: none !important; padding-left: 2px !important; transition: border-color 0.15s; }
            .dip-inline-sel:hover .ant-select-selector { border-bottom-color: #93c5fd !important; }
            .dip-inline-sel.ant-select-focused .ant-select-selector { border-bottom-color: #3b82f6 !important; box-shadow: none !important; }
            .dip-inline-sel .ant-select-selection-item { font-size: 1.2rem !important; font-weight: 700 !important; color: #1e3a5f !important; }
            .dip-inline-sel .ant-select-selection-placeholder { font-size: 1.1rem !important; color: #94a3b8 !important; }
            .dip-inline-sel .ant-select-arrow { color: #64748b !important; }
            .dip-inline-sel .ant-select-clear { background: transparent !important; }
          `}</style>
          <Select
            className="dip-inline-sel"
            size="large"
            value={selectedDiplomado?.gid || undefined}
            onChange={(value) => {
              if (!value) { setSelectedDiplomado(null); return; }
              const found = diplomados.find(d => d.gid === value);
              if (found) handleViewDetails(found);
            }}
            options={diplomados.map(d => ({ label: d.name, value: d.gid }))}
            placeholder={loading ? 'Cargando...' : 'Seleccionar diplomado...'}
            loading={loading}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ flex: 1, minWidth: 220, maxWidth: 560 }}
          />
          {diplomados.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {diplomados.length} disponibles
            </span>
          )}
        </div>
        <Dropdown
          menu={{ items: [
            { key: 'crear', label: '➕ Crear nuevo Diplomado', onClick: () => { setEditMode(false); setDiplomadoToEdit(null); setShowCreateModal(true); } },
            ...(selectedDiplomado ? [{ key: 'editar', label: '✏️ Editar Diplomado', onClick: handleEditDiplomado }] : []),
          ]}}
          trigger={['click']}
        >
          <button
            title="Configuración"
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '7px', color: '#64748b', cursor: 'pointer', fontSize: '1.05rem', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
          >⚙️</button>
        </Dropdown>
      </div>


      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}



      {/* Detalles del Diplomado Seleccionado */}
      {selectedDiplomado && (
        <>
        <div className="card" style={{ overflow: 'hidden', marginTop: '1.5rem' }}>
            <div style={{ 
              padding: '1.50rem',
              borderBottom: '2px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.5rem' }}>
                  🎓 {selectedDiplomado.name}
                </h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                  Detalles del diplomado
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(estudiantes.length > 0 || docentes.length > 0) && (
                  <Dropdown
                    menu={{ items: [
                      { key: 'pdf', label: '📄 Listado General PDF', onClick: handleExportDiplomadoGeneral },
                      { key: 'word', label: '📝 Listado General Word', onClick: handleExportDiplomadoGeneralWord },
                      ...(estudiantes.length > 0 ? [
                        { key: 'centralizador-pdf', label: '🗂 Centralizador PDF', onClick: handleExportCentralizadorNotas },
                        { key: 'centralizador-word', label: '📊 Centralizador Word', onClick: handleExportCentralizadorNotasWord },
                      ] : []),
                    ]}}
                    trigger={['click']}
                  >
                    <button
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '7px', color: '#475569', cursor: 'pointer', fontWeight: 500, lineHeight: 1.4 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                    >⋯ Reportes <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>▾</span></button>
                  </Dropdown>
                )}
                <button
                  onClick={() => setSelectedDiplomado(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '0.25rem',
                    lineHeight: 1
                  }}
                  title="Cerrar detalles"
                >
                  ✕
                </button>
              </div>
            </div>


            {/* ── Tabs ───────────────────────────────────────────── */}
            {loadingDetails ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}><p>Cargando detalles...</p></div>
            ) : (
              <Card className="section-tabs" bodyStyle={{ padding: 0 }} style={{ border: 'none', borderRadius: 0, boxShadow: 'none', marginTop: '0.75rem' }}>
                <Tabs type="card" activeKey={activeDiplomadoTab} onChange={setActiveDiplomadoTab} items={[
                  {
                    key: 'docentes',
                    label: `👨‍🏫 Docentes (${docentes.length})`,
                    children: (
                      <div>
                        {(() => {
                          const PAGE_SIZE = 20;
                          const filtered = docentes.filter(d => formatearNombreCompleto(d.name).toLowerCase().includes(busquedaDocente.toLowerCase()));
                          const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                          const page = Math.min(paginaDocentes, totalPages);
                          const offset = (page - 1) * PAGE_SIZE;
                          const paged = filtered.slice(offset, offset + PAGE_SIZE);
                          return (
                          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                            <style>{`
                              .doc-tbl-dip { table-layout: fixed; }
                              .doc-tbl-dip col.col-num  { width: 35px; }
                              .doc-tbl-dip col.col-id   { width: 350px; }
                              .doc-tbl-dip col.col-age  { width: 200px; }
                              .doc-tbl-dip col.col-ori  { width: 200px; }
                              .doc-tbl-dip col.col-act  { width: auto; }
                              .doc-tbl-dip tbody tr { transition: background 0.1s; }
                              .doc-tbl-dip tbody tr:nth-child(even) { background: #f9fafb; }
                              .doc-tbl-dip tbody tr:hover { background: #eff6ff !important; }
                              .doc-tbl-dip tbody tr .row-acts { opacity: 1; }
                              .doc-tbl-dip thead th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; border-bottom: 2px solid #e2e8f0; }
                              .doc-tbl-dip td { overflow: hidden; word-break: break-word; }
                            `}</style>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.25rem 0.65rem', background: 'white' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{docentes.length}</span>
                                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>docente{docentes.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <input type="text" placeholder="🔍 Buscar..." value={busquedaDocente} onChange={e => { setBusquedaDocente(e.target.value); setPaginaDocentes(1); }} style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.85rem', width: '200px', outline: 'none' }} />
                                <button
                                  onClick={() => setShowAgregarDocenteModal(true)}
                                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: '1.5px solid transparent', borderRadius: '7px', color: '#3b82f6', cursor: 'pointer', fontWeight: 500, lineHeight: 1.4 }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >＋ Inscribir Docente</button>
                              </div>
                            </div>
                            {docentes.length === 0 ? (
                              <p style={{ color: '#999', padding: '1.5rem', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>No hay docentes registrados todavía.</p>
                            ) : <>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="doc-tbl-dip" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <colgroup>
                                  <col className="col-num" />
                                  <col className="col-id" />
                                  <col className="col-age" />
                                  <col className="col-ori" />
                                  <col className="col-act" />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Identidad</th>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edad / Género</th>
                                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Origen y Contacto</th>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paged.map((docente, idx) => {
                                    const d = parseEstudianteData(docente.notes);
                                    const edad = calcularEdad(d.fechaNacimiento);
                                    return (
                                      <tr key={docente.gid}>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>{offset + idx + 1}</td>
                                        <td style={{ padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem', lineHeight: 1.35 }}>{formatearNombreCompleto(docente.name)}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>CI: {d.documentoIdentidad || '—'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.9rem', lineHeight: 1.35 }}>{edad}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{d.genero === 'No especificado' ? '—' : d.genero}</div>
                                        </td>
                                        <td style={{ padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.35 }}>{d.domicilio || d.lugarNacimiento || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                                          {d.telefono ? <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>📞 {d.telefono}</div> : null}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem' }}>
                                          <div className="row-acts" style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                                            <button onClick={() => handleShowInfo(docente, 'Docente')} title="Ver perfil" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: '0.25rem 0.3rem', borderRadius: '4px', color: '#64748b', lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background='none'}>👤</button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {totalPages > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.875rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                  <button onClick={() => setPaginaDocentes(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '0.2rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: page <= 1 ? '#f8fafc' : 'white', color: page <= 1 ? '#d1d5db' : '#374151', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '1rem', lineHeight: 1 }}>‹</button>
                                  <span style={{ fontSize: '0.78rem', color: '#6b7280', padding: '0 0.4rem' }}>{page} / {totalPages}</span>
                                  <button onClick={() => setPaginaDocentes(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '0.2rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: page >= totalPages ? '#f8fafc' : 'white', color: page >= totalPages ? '#d1d5db' : '#374151', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '1rem', lineHeight: 1 }}>›</button>
                                </div>
                              </div>
                            )}
                          </>}
                          </div>
                          );
                        })()
                        }
                      </div>
                    )
                  },
                  {
                    key: 'estudiantes',
                    label: `👨‍🎓 Estudiantes (${estudiantes.length})`,
                    children: (
                      <div>
                        {(() => {
                          const PAGE_SIZE = 20;
                          const filtered = estudiantes.filter(e => formatearNombreCompleto(e.name).toLowerCase().includes(busquedaEstudiante.toLowerCase()));
                          const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                          const page = Math.min(paginaEstudiantes, totalPages);
                          const offset = (page - 1) * PAGE_SIZE;
                          const paged = filtered.slice(offset, offset + PAGE_SIZE);
                          return (
                          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                            <style>{`
                              .est-tbl-dip { table-layout: fixed; }
                              .est-tbl-dip col.col-num  { width: 35px; }
                              .est-tbl-dip col.col-id   { width: 350px; }
                              .est-tbl-dip col.col-age  { width: 200px; }
                              .est-tbl-dip col.col-ori  { width: 200px; }
                              .est-tbl-dip col.col-act  { width: auto; }
                              .est-tbl-dip tbody tr { transition: background 0.1s; }
                              .est-tbl-dip tbody tr:nth-child(even) { background: #f9fafb; }
                              .est-tbl-dip tbody tr:hover { background: #eff6ff !important; }
                              .est-tbl-dip tbody tr .row-acts { opacity: 1; }
                              .est-tbl-dip thead th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; border-bottom: 2px solid #e2e8f0; }
                              .est-tbl-dip td { overflow: hidden; word-break: break-word; }
                            `}</style>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.25rem 0.65rem', background: 'white' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{estudiantes.length}</span>
                                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>estudiante{estudiantes.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <input type="text" placeholder="🔍 Buscar..." value={busquedaEstudiante} onChange={e => { setBusquedaEstudiante(e.target.value); setPaginaEstudiantes(1); }} style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.85rem', width: '200px', outline: 'none' }} />
                                <button
                                  onClick={() => setShowAgregarEstudianteModal(true)}
                                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: '1.5px solid transparent', borderRadius: '7px', color: '#3b82f6', cursor: 'pointer', fontWeight: 500, lineHeight: 1.4 }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >＋ Inscribir</button>
                              </div>
                            </div>
                            {estudiantes.length === 0 ? (
                              <p style={{ color: '#999', padding: '1.5rem', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>No hay estudiantes registrados todavía.</p>
                            ) : <>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="est-tbl-dip" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <colgroup>
                                  <col className="col-num" />
                                  <col className="col-id" />
                                  <col className="col-age" />
                                  <col className="col-ori" />
                                  <col className="col-act" />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Identidad</th>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edad / Género</th>
                                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Origen y Contacto</th>
                                    <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paged.map((estudiante, idx) => {
                                    const d = parseEstudianteData(estudiante.notes);
                                    const edad = calcularEdad(d.fechaNacimiento);
                                    return (
                                      <tr key={estudiante.gid}>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>{offset + idx + 1}</td>
                                        <td style={{ padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem', lineHeight: 1.35 }}>{formatearNombreCompleto(estudiante.name)}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>CI: {d.documentoIdentidad || '—'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.9rem', lineHeight: 1.35 }}>{edad}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{d.genero === 'No especificado' ? '—' : d.genero}</div>
                                        </td>
                                        <td style={{ padding: '0.7rem 0.75rem' }}>
                                          <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.35 }}>{d.domicilio || d.lugarNacimiento || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                                          {d.telefono ? <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>📞 {d.telefono}</div> : null}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem' }}>
                                          <div className="row-acts" style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                                            <button onClick={() => setEstudianteSeleccionadoNotas(estudiante)} title="Ver notas" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: '0.25rem 0.3rem', borderRadius: '4px', color: '#64748b', lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background='#e0e7ff'} onMouseLeave={e => e.currentTarget.style.background='none'}>📊</button>
                                            <button onClick={() => setEstudianteSeleccionadoAsistencia(estudiante)} title="Ver asistencia" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: '0.25rem 0.3rem', borderRadius: '4px', color: '#64748b', lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background='#dcfce7'} onMouseLeave={e => e.currentTarget.style.background='none'}>✓</button>
                                            <button onClick={() => handleShowInfo(estudiante, 'Estudiante')} title="Ver perfil" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: '0.25rem 0.3rem', borderRadius: '4px', color: '#64748b', lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background='none'}>👤</button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {totalPages > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.875rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                  <button onClick={() => setPaginaEstudiantes(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '0.2rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: page <= 1 ? '#f8fafc' : 'white', color: page <= 1 ? '#d1d5db' : '#374151', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '1rem', lineHeight: 1 }}>‹</button>
                                  <span style={{ fontSize: '0.78rem', color: '#6b7280', padding: '0 0.4rem' }}>{page} / {totalPages}</span>
                                  <button onClick={() => setPaginaEstudiantes(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '0.2rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: page >= totalPages ? '#f8fafc' : 'white', color: page >= totalPages ? '#d1d5db' : '#374151', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '1rem', lineHeight: 1 }}>›</button>
                                </div>
                              </div>
                            )}
                          </>}
                          </div>
                          );
                        })()
                        }
                      </div>
                    )
                  },
                  {
                    key: 'centralizador',
                    label: '📊 Centralizador',
                    children: (
                      <div>
                        {estudiantes.length === 0 ? (
                          <p style={{ color: '#999' }}>No hay estudiantes registrados todavía.</p>
                        ) : (() => {
                          const notasData = estudiantes.map(est => {
                            const m1 = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
                            const m2 = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
                            const m3 = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
                            const m4 = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
                            const m5 = getCustomFieldValueSafe(est, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
                            const total = Math.round((m1 + m2 + m3 + m4 + m5) / 5);
                            return { gid: est.gid, nombre: formatearNombreCompleto(est.name), m1, m2, m3, m4, m5, total };
                          });
                          const promG = notasData.length > 0 ? Math.round(notasData.reduce((s, e) => s + e.total, 0) / notasData.length) : 0;
                          const aprobados = notasData.filter(e => e.total >= 61).length;
                          const enRiesgo = notasData.filter(e => e.total > 0 && e.total < 61).length;
                          const pctAprobados = notasData.length > 0 ? Math.round((aprobados / notasData.length) * 100) : 0;
                          const colorNota = (n: number): string => { if (n === 0) return '#9ca3af'; if (n < 61) return '#dc2626'; if (n > 90) return '#16a34a'; return '#374151'; };
                          const calcProm = (vals: number[]) => notasData.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / notasData.length) : 0;
                          const filtrados = busquedaCentralizador ? notasData.filter(e => e.nombre.toLowerCase().includes(busquedaCentralizador.toLowerCase())) : notasData;
                          return (
                            <>
                              {/* KPI Cards */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Promedio General</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: promG >= 61 ? '#16a34a' : '#dc2626', lineHeight: 1.1 }}>{promG}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>de 100 puntos</div>
                                </div>
                                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #22c55e' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Aprobados</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a', lineHeight: 1.1 }}>{pctAprobados}%</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>{aprobados} de {notasData.length}</div>
                                </div>
                                <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>En Riesgo</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.1 }}>{enRiesgo}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>nota &lt; 61</div>
                                </div>
                                <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Total Estudiantes</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.1 }}>{notasData.length}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>inscritos</div>
                                </div>
                              </div>
                              {/* Export buttons + table */}
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.6rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                                  <input type="text" placeholder="🔍 Buscar estudiante..." value={busquedaCentralizador} onChange={e => setBusquedaCentralizador(e.target.value)} style={{ flex: 1, maxWidth: '280px', padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={handleAbrirRegistroNotas} className="button-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📝 Registrar Notas</button>
                                    <button onClick={handleExportCentralizadorNotas} className="button-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📄 Exportar Notas</button>
                                    <button onClick={handleExportCentralizadorNotasWord} className="button-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📄 Exportar Documento</button>
                                  </div>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                <table className="centralizador-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', width: '46px' }}>#</th>
                                      <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '200px', position: 'sticky', left: 0, zIndex: 2, background: '#f1f5f9' }}>Estudiante</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mód. 1</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mód. 2</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mód. 3</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mód. 4</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mód. 5</th>
                                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#1e3a5f', color: '#ffffff', minWidth: '80px', borderLeft: '3px solid #3b82f6', letterSpacing: '0.04em' }}>FINAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filtrados.map((est, index) => (
                                      <tr key={index}>
                                        <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>{index + 1}</td>
                                        <td className="col-name-s" style={{ padding: '0.7rem 0.75rem', fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem', position: 'sticky', left: 0, zIndex: 1 }}>{est.nombre}</td>
                                        {[est.m1, est.m2, est.m3, est.m4, est.m5].map((nota, i) => { const isRed = nota > 0 && nota < 61; const isGreen = nota > 90; return <td key={i} className={isRed || isGreen ? 'nota-semantica' : undefined} style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontWeight: isRed || isGreen ? 700 : 500, color: colorNota(nota), backgroundColor: isRed ? '#fef2f2' : isGreen ? '#f0fdf4' : undefined }}>{nota === 0 ? '–' : nota}</td>; })}
                                        <td className="nota-semantica" style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', backgroundColor: est.total >= 61 ? '#d1fae5' : '#fee2e2', color: est.total >= 61 ? '#065f46' : '#991b1b', borderLeft: '3px solid #3b82f6' }}>{est.total || '–'}</td>
                                      </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                                      <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}></td>
                                      <td className="col-name-s" style={{ padding: '0.6rem 0.75rem', textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: '#f1f5f9', color: '#374151', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Promedio General</td>
                                      {[calcProm(notasData.map(e=>e.m1)),calcProm(notasData.map(e=>e.m2)),calcProm(notasData.map(e=>e.m3)),calcProm(notasData.map(e=>e.m4)),calcProm(notasData.map(e=>e.m5))].map((v,i) => (
                                        <td key={i} style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: '#374151', fontWeight: 600 }}>{v}</td>
                                      ))}
                                      <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', backgroundColor: '#1e3a5f', color: '#ffffff', fontSize: '1rem', fontWeight: 800, borderLeft: '3px solid #3b82f6' }}>{calcProm(notasData.map(e=>e.total))}</td>
                                    </tr>
                                  </tbody>
                                </table>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  },
                  {
                    key: 'asistencia',
                    label: '✓ Asistencia',
                    children: (
                      <div>
                        {(() => {
                          const { asistenciasPorEstudiante, fechasOrdenadas } = extraerAsistenciasEstudiantes();
                          const MIN_SESIONES = 20;
                          const fechasMostradas: (string | null)[] = [
                            ...fechasOrdenadas,
                            ...Array(Math.max(0, MIN_SESIONES - fechasOrdenadas.length)).fill(null)
                          ];
                          const totalPresentes = asistenciasPorEstudiante.reduce((sum, est) => sum + fechasOrdenadas.filter(f => est.registros[f]?.asistio === true).length, 0);
                          const totalAusentes = asistenciasPorEstudiante.reduce((sum, est) => sum + fechasOrdenadas.filter(f => est.registros[f]?.asistio === false).length, 0);
                          const totalRegistrados = totalPresentes + totalAusentes;
                          const pctAsistencia = totalRegistrados > 0 ? Math.round((totalPresentes / totalRegistrados) * 100) : 0;
                          const sinAusenciasCount = asistenciasPorEstudiante.filter(est => !fechasOrdenadas.some(f => est.registros[f]?.asistio === false)).length;
                          const conAusenciasCount = asistenciasPorEstudiante.filter(est => fechasOrdenadas.some(f => est.registros[f]?.asistio === false)).length;
                          return (
                            <>
                              {/* KPI Cards */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Asistencia General</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: pctAsistencia >= 80 ? '#16a34a' : '#dc2626', lineHeight: 1.1 }}>{pctAsistencia}%</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>{totalPresentes} de {totalRegistrados} registros</div>
                                </div>
                                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #22c55e' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Sin Ausencias</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a', lineHeight: 1.1 }}>{sinAusenciasCount}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>asistencia perfecta</div>
                                </div>
                                <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Con Ausencias</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.1 }}>{conAusenciasCount}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>al menos 1 falta</div>
                                </div>
                                <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Sesiones</div>
                                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.1 }}>{fechasOrdenadas.length}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>fechas registradas</div>
                                </div>
                              </div>
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                <style>{`
                                  .asist-view-dip tbody tr { transition: background 0.1s; }
                                .asist-view-dip tbody tr:nth-child(even) { background: #f9fafb; }
                                .asist-view-dip tbody tr:hover { background: #eff6ff !important; }
                                .asist-view-dip thead th { background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
                                .asist-view-dip .col-num-s  { position: sticky; left: 0;     z-index: 2; background: white; }
                                .asist-view-dip .col-name-s { position: sticky; left: 46px;  z-index: 2; background: white; box-shadow: 2px 0 5px -1px rgba(0,0,0,0.08); }
                                .asist-view-dip tbody tr:nth-child(even) .col-num-s,
                                .asist-view-dip tbody tr:nth-child(even) .col-name-s { background: #f9fafb; }
                                .asist-view-dip tbody tr:hover .col-num-s,
                                .asist-view-dip tbody tr:hover .col-name-s { background: #eff6ff !important; }
                                .asist-view-dip thead .col-num-s,
                                .asist-view-dip thead .col-name-s { z-index: 3; background: #f1f5f9; }
                              `}</style>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input type="text" placeholder="🔍 Buscar estudiante..." value={busquedaAsistencia} onChange={e => setBusquedaAsistencia(e.target.value)} style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.85rem', width: '200px', outline: 'none' }} />
                                <button onClick={handleAbrirAsistencia} className="button-primary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>✓ Registrar Asistencia</button>
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                              <table className="asist-view-dip" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th className="col-num-s" style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', width: '46px' }}>#</th>
                                    <th className="col-name-s" style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '200px' }}>Estudiante</th>
                                    {fechasMostradas.map((fecha, idx) => fecha !== null ? (
                                      <th key={idx} style={{ textAlign: 'center', padding: '0.25rem 0.25rem 0.5rem', fontSize: '0.68rem', color: '#64748b', fontWeight: 600, width: '42px', minWidth: '42px', borderLeft: '1px solid #e5e7eb', verticalAlign: 'bottom' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                          <button
                                            onClick={() => handleDeleteAsistenciaDia(fecha)}
                                            title={`Eliminar asistencia del ${fecha} para todos`}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.7rem', padding: '1px 2px', borderRadius: '3px', lineHeight: 1 }}
                                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'none'; }}
                                          >🗑️</button>
                                          <span style={{ writingMode: 'vertical-lr' }}>{fecha}</span>
                                        </div>
                                      </th>
                                    ) : (
                                      <th key={idx} style={{ textAlign: 'center', padding: '0.25rem 0.25rem 0.5rem', width: '42px', minWidth: '42px', borderLeft: '1px dashed #e2e8f0', verticalAlign: 'bottom', background: '#f8fafc' }}>
                                        <span style={{ writingMode: 'vertical-lr', fontSize: '0.62rem', color: '#d1d5db', fontWeight: 500 }}>Ses. {idx + 1}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(busquedaAsistencia ? asistenciasPorEstudiante.filter(est => est.nombre.toLowerCase().includes(busquedaAsistencia.toLowerCase())) : asistenciasPorEstudiante).map((est, eIdx) => (
                                    <tr key={eIdx}>
                                      <td className="col-num-s" style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{eIdx + 1}</td>
                                      <td className="col-name-s" style={{ padding: '0.7rem 0.75rem', fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6' }}>{est.nombre}</td>
                                      {fechasMostradas.map((fecha, fIdx) => fecha !== null ? (() => {
                                        const reg = est.registros[fecha];
                                        const asistio = reg?.asistio;
                                        const obs = reg?.observaciones || '';
                                        return (
                                          <td key={fIdx} style={{ padding: '0.7rem 0.25rem', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', borderLeft: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', color: asistio === true ? '#16a34a' : asistio === false ? '#dc2626' : '#94a3b8', backgroundColor: asistio === true ? '#d1fae5' : asistio === false ? '#fee2e2' : undefined }} title={obs !== 'Ninguna' && obs ? `Observaciones: ${obs}` : ''}>
                                            {asistio === true ? 'Sí' : asistio === false ? 'No' : '–'}
                                          </td>
                                        );
                                      })() : (
                                        <td key={fIdx} style={{ padding: '0.7rem 0.25rem', borderLeft: '1px dashed #e2e8f0', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f8fafc' }} />
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
                            </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  },
                  {
                    key: 'documentos',
                    label: '📄 Documentos',
                    children: (
                      <div style={{ padding: '1.25rem' }}>
                        {documentos.length === 0 ? (
                          <p style={{ color: '#999' }}>No hay documentos registrados.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${documentos.length}, 1fr)`, gap: '1rem', alignItems: 'start' }}>
                            {documentos.map((documento, colIdx) => {
                              const docLinks = _parseDocLinks(documento.notes);
                              const colPalette = [
                                { bg: '#eff6ff', border: '#bfdbfe', header: '#1d4ed8', dot: '#3b82f6' },
                                { bg: '#f0fdf4', border: '#bbf7d0', header: '#15803d', dot: '#22c55e' },
                                { bg: '#fdf4ff', border: '#e9d5ff', header: '#7e22ce', dot: '#a855f7' },
                              ];
                              const col = colPalette[colIdx % colPalette.length];
                              return (
                                <div key={documento.gid} style={{ border: `1.5px solid ${col.border}`, borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
                                  {/* Column header */}
                                  <div style={{ padding: '0.75rem 1rem', background: col.bg, borderBottom: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.dot, flexShrink: 0, display: 'inline-block' }} />
                                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: col.header, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{documento.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: '#6b7280', background: 'white', border: `1px solid ${col.border}`, borderRadius: '999px', padding: '1px 8px', flexShrink: 0, fontWeight: 600 }}>{docLinks.length}</span>
                                  </div>
                                  {/* File list */}
                                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '60px' }}>
                                    {docLinks.length === 0 ? (
                                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '0.75rem 0' }}>Sin archivos</div>
                                    ) : (
                                      docLinks.map((doc, i) => {
                                        const ft = _getFileType(doc.url);
                                        const domain = (() => { try { return new URL(doc.url).hostname.replace('www.', ''); } catch { return ''; } })();
                                        return (
                                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.6rem', background: '#f8fafc', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                                            {/* File type badge */}
                                            <div title={ft.label} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '7px', background: ft.bg, border: `1px solid ${ft.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{ft.icon}</div>
                                            {/* Name + meta */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a202c', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }} title={doc.nombre}>{doc.nombre}</a>
                                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fecha ? `${doc.fecha}${domain ? ' • ' + domain : ''}` : domain}</span>
                                            </div>
                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
                                              <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Ver" style={{ color: '#94a3b8', fontSize: '1rem', padding: '3px 4px', borderRadius: '4px', lineHeight: 1, textDecoration: 'none', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#1d4ed8'; (e.currentTarget as HTMLAnchorElement).style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}>👁️</a>
                                              <button onClick={() => handleDeleteDocumento(documento, i)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.9rem', padding: '3px 4px', borderRadius: '4px', flexShrink: 0, lineHeight: 1 }} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}>🗑️</button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  {/* Add button */}
                                  <div style={{ padding: '0 0.75rem 0.75rem' }}>
                                    <button
                                      onClick={() => handleOpenDocModal(documento)}
                                      style={{ width: '100%', padding: '0.4rem 0', fontSize: '0.8rem', border: '1.5px dashed #cbd5e1', borderRadius: '7px', background: 'transparent', color: '#64748b', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.15s' }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = col.border; e.currentTarget.style.color = col.header; e.currentTarget.style.background = col.bg; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                                    >＋ Agregar archivo</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }
                ]} />
              </Card>
            )}
        </div>
        </>
      )}
      {false && selectedDiplomado && estudiantes.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ 
            padding: '1.5rem',
            borderBottom: '2px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.5rem' }}>
                📊 Centralizador de Notas
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                {selectedDiplomado?.name}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleExportCentralizadorNotas}
                className="button-secondary"
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                📄 Exportar Notas
              </button>
              <button
                onClick={handleExportCentralizadorNotasWord}
                className="button-secondary"
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                📄 Exportar Notas a Documento
              </button>
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2', color: '#4f4f4f' }}>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'center', 
                      borderRight: '1px solid #d1d1d1',
                      width: '50px',
                      fontWeight: 600
                    }}>
                      #
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderRight: '1px solid #d1d1d1',
                      minWidth: '200px',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f2f2f2',
                      zIndex: 2,
                      fontWeight: 600
                    }}>
                      Estudiante
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #d1d1d1', fontWeight: 600 }}>
                      Módulo 1
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #d1d1d1', fontWeight: 600 }}>
                      Módulo 2
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #d1d1d1', fontWeight: 600 }}>
                      Módulo 3
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #d1d1d1', fontWeight: 600 }}>
                      Módulo 4
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #d1d1d1', fontWeight: 600 }}>
                      Módulo 5
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'center', 
                      fontWeight: 700,
                      backgroundColor: '#d1d1d1',
                      color: '#0d47a1'
                    }}>
                      PROMEDIO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Calcular datos con formato de nombres correcto
                    const notasEstudiantes = estudiantes.map(estudiante => {
                      // Formatear nombre sin comas
                      const nombreFormateado = formatearNombreCompleto(estudiante.name);
                      
                      const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
                      const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
                      const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
                      const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
                      const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
                      const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;
                      
                      return {
                        nombreFormateado,
                        modulo1,
                        modulo2,
                        modulo3,
                        modulo4,
                        modulo5,
                        total: Math.round(total)
                      };
                    });

                    const calcularPromedioModulo = (moduloKey: string): number => {
                      if (notasEstudiantes.length === 0) return 0;
                      const suma = notasEstudiantes.reduce((acc: number, est: any) => acc + est[moduloKey], 0);
                      return Math.round(suma / notasEstudiantes.length);
                    };

                    return (
                      <>
                        {notasEstudiantes.map((estudiante, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                              borderBottom: '1px solid #dee2e6'
                            }}
                          >
                            <td style={{ 
                              padding: '0.875rem 1rem',
                              fontWeight: 'bold',
                              color: '#666',
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6'
                            }}>
                              {index + 1}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              fontWeight: 500,
                              borderRight: '1px solid #dee2e6',
                              position: 'sticky',
                              left: 0,
                              backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                              zIndex: 1
                            }}>
                              {estudiante.nombreFormateado}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo1 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo1}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo2 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo2}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo3 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo3}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo4 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo4}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo5 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo5}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '1rem',
                              backgroundColor: estudiante.total >= 51 ? '#d1fae5' : '#fee2e2',
                              color: estudiante.total >= 51 ? '#065f46' : '#991b1b'
                            }}>
                              {estudiante.total}
                            </td>
                          </tr>
                        ))}
                        {/* Fila de promedios generales */}
                        <tr style={{ 
                          backgroundColor: '#f2f2f2',
                          fontWeight: 700,
                          borderTop: '3px solid #b5b5b5'
                        }}>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            borderRight: '1px solid #a3a3a3'
                          }}>
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'left',
                            borderRight: '1px solid #a3a3a3',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#f2f2f2',
                            zIndex: 1
                          }}>
                            PROMEDIO GENERAL
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #a3a3a3' }}>
                            {calcularPromedioModulo('modulo1')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #a3a3a3' }}>
                            {calcularPromedioModulo('modulo2')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #a3a3a3' }}>
                            {calcularPromedioModulo('modulo3')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #a3a3a3' }}>
                            {calcularPromedioModulo('modulo4')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #a3a3a3' }}>
                            {calcularPromedioModulo('modulo5')}
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            backgroundColor: '#b5b5b5',
                            color: '#0d47a1',
                            fontSize: '1.1rem'
                          }}>
                            {calcularPromedioModulo('total')}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            <div style={{ 
              marginTop: '1.5rem',
              padding: '1rem', 
              backgroundColor: '#e8f5e9', 
              borderRadius: '6px',
              borderLeft: '4px solid #66bb6a'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#2e7d32' }}>
                <strong>📌 Información:</strong> Las calificaciones se obtienen de los campos personalizados 
                "Módulo 1" a "Módulo 5" de cada estudiante. El promedio se calcula automáticamente 
                sumando las 5 notas y dividiendo entre 5. Las notas ≥ 51 se muestran en verde (aprobado) 
                y las notas &lt; 51 en rojo (reprobado).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Panel de Asistencia */}
      {false && selectedDiplomado && estudiantes.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ 
            padding: '1.5rem',
            borderBottom: '2px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.5rem' }}>
                ✓ Registro de Asistencia
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                {selectedDiplomado?.name}
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {(() => {
              const { asistenciasPorEstudiante, fechasOrdenadas } = extraerAsistenciasEstudiantes();

              if (fechasOrdenadas.length === 0) {
                return (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem',
                    color: '#999',
                    fontStyle: 'italic'
                  }}>
                    <p>No hay registros de asistencia todavía.</p>
                    <p style={{ fontSize: '0.9rem' }}>
                      Utiliza el botón "✓ Asistencia" para registrar la asistencia de los estudiantes.
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          borderRight: '1px solid #c8e6c9',
                          width: '50px',
                          fontWeight: 600
                        }}>
                          #
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'left', 
                          borderRight: '1px solid #c8e6c9',
                          minWidth: '200px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: '#e8f5e9',
                          zIndex: 2,
                          fontWeight: 600
                        }}>
                          Estudiante
                        </th>
                        {fechasOrdenadas.map((fecha, index) => (
                          <th 
                            key={index} 
                            style={{ 
                              padding: '1rem', 
                              textAlign: 'center', 
                              borderRight: '1px solid #c8e6c9',
                              fontWeight: 600,
                              minWidth: '120px'
                            }}
                          >
                            {fecha}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {asistenciasPorEstudiante.map((estudiante, estudianteIndex) => (
                        <tr 
                          key={estudianteIndex}
                          style={{ 
                            backgroundColor: estudianteIndex % 2 === 0 ? '#f8f9fa' : 'white',
                            borderBottom: '1px solid #dee2e6'
                          }}
                        >
                          <td style={{ 
                            padding: '0.875rem 1rem',
                            fontWeight: 'bold',
                            color: '#666',
                            textAlign: 'center',
                            borderRight: '1px solid #dee2e6'
                          }}>
                            {estudianteIndex + 1}
                          </td>
                          <td style={{ 
                            padding: '0.875rem 1rem', 
                            fontWeight: 500,
                            borderRight: '1px solid #dee2e6',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: estudianteIndex % 2 === 0 ? '#f8f9fa' : 'white',
                            zIndex: 1
                          }}>
                            {estudiante.nombre}
                          </td>
                          {fechasOrdenadas.map((fecha, fechaIndex) => {
                            const registro = estudiante.registros[fecha];
                            const asistio = registro?.asistio;
                            const observaciones = registro?.observaciones || '';
                            
                            return (
                              <td 
                                key={fechaIndex}
                                style={{ 
                                  padding: '0.875rem 1rem', 
                                  textAlign: 'center',
                                  borderRight: '1px solid #dee2e6',
                                  fontWeight: 600,
                                  fontSize: '0.95rem',
                                  color: asistio === true ? '#27AE60' : asistio === false ? '#E74C3C' : '#999',
                                  backgroundColor: asistio === true ? '#d1fae5' : asistio === false ? '#fee2e2' : undefined
                                }}
                                title={observaciones !== 'Ninguna' && observaciones ? `Observaciones: ${observaciones}` : ''}
                              >
                                {asistio === true ? 'Sí' : asistio === false ? 'No' : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div style={{ 
              marginTop: '1.5rem',
              padding: '1rem', 
              backgroundColor: '#fff3e0', 
              borderRadius: '6px',
              borderLeft: '4px solid #ff9800'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#e65100' }}>
                <strong>📌 Información:</strong> Los registros de asistencia se obtienen de las notas de cada estudiante. 
                Pasa el cursor sobre las celdas para ver las observaciones registradas. 
                Las celdas con "Sí" aparecen en verde (asistió) y las celdas con "No" en rojo (no asistió).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Notas Individual */}
      {estudianteSeleccionadoNotas && (
        <div className="modal-overlay" onClick={() => setEstudianteSeleccionadoNotas(null)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '850px', 
              width: '96%',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0
            }}
          >
            <HtmlModalHeader icon="📊" title="Notas del Estudiante" subtitle={formatearNombreCompleto(estudianteSeleccionadoNotas.name)} onClose={() => setEstudianteSeleccionadoNotas(null)} />

            <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>

              {(() => {
                // Usar el helper robusto importado
                const modulo1 = getCustomFieldValueSafe(estudianteSeleccionadoNotas, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
                const modulo2 = getCustomFieldValueSafe(estudianteSeleccionadoNotas, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
                const modulo3 = getCustomFieldValueSafe(estudianteSeleccionadoNotas, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
                const modulo4 = getCustomFieldValueSafe(estudianteSeleccionadoNotas, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
                const modulo5 = getCustomFieldValueSafe(estudianteSeleccionadoNotas, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
                const promedio = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;

                return (
                  <div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                      <style>{`
                        .notas-tbl-dip tbody tr { transition: background 0.1s; }
                        .notas-tbl-dip tbody tr:nth-child(even) { background: #f9fafb; }
                        .notas-tbl-dip tbody tr:hover { background: #eff6ff !important; }
                        .notas-tbl-dip thead th { position: sticky; top: 0; z-index: 1; }
                      `}</style>
                      <table className="notas-tbl-dip" style={{ minWidth: '520px', width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '45%' }}>
                              Módulo
                            </th>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '20%' }}>
                              Nota
                            </th>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '35%' }}>
                              Estado
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { nombre: 'Módulo 1', nota: modulo1 },
                            { nombre: 'Módulo 2', nota: modulo2 },
                            { nombre: 'Módulo 3', nota: modulo3 },
                            { nombre: 'Módulo 4', nota: modulo4 },
                            { nombre: 'Módulo 5', nota: modulo5 }
                          ].map((modulo, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.6rem 0.65rem', fontWeight: 600, color: '#1e3a5f', fontSize: '0.875rem' }}>
                                {modulo.nombre}
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.65rem', 
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: modulo.nota === 0 ? '#9ca3af' : modulo.nota >= 51 ? '#16a34a' : '#dc2626',
                                backgroundColor: modulo.nota > 0 && modulo.nota < 51 ? '#fef2f2' : modulo.nota > 90 ? '#f0fdf4' : undefined
                              }}>
                                {modulo.nota === 0 ? '–' : modulo.nota}
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.65rem', 
                                textAlign: 'center',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                color: modulo.nota === 0 ? '#9ca3af' : modulo.nota >= 51 ? '#16a34a' : '#dc2626',
                                backgroundColor: modulo.nota > 0 && modulo.nota < 51 ? '#fef2f2' : modulo.nota > 90 ? '#f0fdf4' : undefined
                              }}>
                                {modulo.nota === 0 ? '–' : modulo.nota >= 51 ? '✓ Aprobado' : '✗ Reprobado'}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ 
                            background: promedio >= 51 ? '#f0fdf4' : '#fff1f2',
                            borderTop: '2px solid #e2e8f0'
                          }}>
                            <td style={{ padding: '0.75rem 0.65rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Promedio Final
                            </td>
                            <td style={{ 
                              padding: '0.75rem 0.65rem', 
                              textAlign: 'center',
                              fontSize: '1.15rem',
                              fontWeight: 800,
                              color: promedio >= 51 ? '#15803d' : '#be123c'
                            }}>
                              {Math.round(promedio)}
                            </td>
                            <td style={{ 
                              padding: '0.75rem 0.65rem', 
                              textAlign: 'center',
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: promedio >= 51 ? '#15803d' : '#be123c'
                            }}>
                              {promedio >= 51 ? '✓ Aprobado' : '✗ Reprobado'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: promedio >= 51 ? '#d1fae5' : '#fee2e2', 
                      borderRadius: '6px',
                      borderLeft: `4px solid ${promedio >= 51 ? '#27AE60' : '#E74C3C'}`,
                      wordWrap: 'break-word'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: promedio >= 51 ? '#065f46' : '#991b1b', lineHeight: '1.5' }}>
                        <strong>📌 Estado:</strong> {promedio >= 51 
                          ? 'El estudiante ha aprobado el diplomado.' 
                          : 'El estudiante no alcanzó el mínimo de 51 puntos.'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => handleExportEstudianteReport(estudianteSeleccionadoNotas)}
                className="button-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setEstudianteSeleccionadoNotas(null)}
                className="button-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asistencia Individual */}
      {estudianteSeleccionadoAsistencia && (
        <div className="modal-overlay" onClick={() => setEstudianteSeleccionadoAsistencia(null)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '700px', 
              width: '96%',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0
            }}
          >
            <HtmlModalHeader icon="✓" title="Asistencia del Estudiante" subtitle={formatearNombreCompleto(estudianteSeleccionadoAsistencia.name)} onClose={() => setEstudianteSeleccionadoAsistencia(null)} />

            <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>

              {(() => {
                // Usar el helper robusto para parsear asistencias
                const registros = parseAsistenciaRecords(estudianteSeleccionadoAsistencia.notes || '')
                  // Ordenar cronológicamente (menor a mayor, más antiguas primero)
                  .sort((a, b) => {
                    const [diaA, mesA, añoA] = a.fecha.split('/').map(Number);
                    const [diaB, mesB, añoB] = b.fecha.split('/').map(Number);
                    const fechaA = new Date(añoA, mesA - 1, diaA);
                    const fechaB = new Date(añoB, mesB - 1, diaB);
                    return fechaA.getTime() - fechaB.getTime();
                  });

                if (registros.length === 0) {
                  return (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem',
                      color: '#999',
                      fontStyle: 'italic'
                    }}>
                      <p>No hay registros de asistencia para este estudiante.</p>
                    </div>
                  );
                }

                // Calcular estadísticas
                const totalAsistencias = registros.filter(r => r.asistio).length;
                const totalFaltas = registros.filter(r => !r.asistio).length;
                const porcentajeAsistencia = ((totalAsistencias / registros.length) * 100).toFixed(1);

                return (
                  <div>
                    {/* Estadísticas */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(3, 1fr)', 
                      gap: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#f2f2f2', 
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                          Total Registros
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4f4f4f' }}>
                          {registros.length}
                        </div>
                      </div>
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#d1fae5', 
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                          Asistencias
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#27AE60' }}>
                          {totalAsistencias}
                        </div>
                      </div>
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#fee2e2', 
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                          Faltas
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#E74C3C' }}>
                          {totalFaltas}
                        </div>
                      </div>
                    </div>

                    {/* Porcentaje de asistencia */}
                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: parseFloat(porcentajeAsistencia) >= 80 ? '#d1fae5' : '#fff3e0',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${parseFloat(porcentajeAsistencia) >= 80 ? '#27AE60' : '#ff9800'}`,
                      marginBottom: '1.5rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        Porcentaje de Asistencia
                      </div>
                      <div style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 700, 
                        color: parseFloat(porcentajeAsistencia) >= 80 ? '#27AE60' : '#ff9800'
                      }}>
                        {porcentajeAsistencia}%
                      </div>
                      <div style={{ height: '10px', borderRadius: '5px', backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: '0.75rem' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, parseFloat(porcentajeAsistencia))}%`, backgroundColor: parseFloat(porcentajeAsistencia) >= 80 ? '#27AE60' : '#ff9800', borderRadius: '5px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>

                    {/* Tabla de registros */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <style>{`
                        .asist-tbl-dip tbody tr { transition: background 0.1s; }
                        .asist-tbl-dip tbody tr:nth-child(even) { background: #f9fafb; }
                        .asist-tbl-dip tbody tr:hover { background: #eff6ff !important; }
                        .asist-tbl-dip thead th { position: sticky; top: 0; z-index: 1; }
                      `}</style>
                      <table className="asist-tbl-dip" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>
                              Fecha
                            </th>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>
                              Asistió
                            </th>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>
                              Observaciones
                            </th>
                            <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '2.5rem' }}>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map((registro, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.6rem 0.65rem', fontWeight: 600, color: '#1e3a5f', fontSize: '0.875rem' }}>
                                {registro.fecha}
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.65rem', 
                                textAlign: 'center',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: registro.asistio ? '#16a34a' : '#dc2626'
                              }}>
                                {registro.asistio ? '✓ Sí' : '✗ No'}
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.65rem',
                                fontSize: '0.85rem',
                                color: registro.observaciones === 'Ninguna' ? '#9ca3af' : '#374151',
                                fontStyle: registro.observaciones === 'Ninguna' ? 'italic' : 'normal'
                              }}>
                                {registro.observaciones}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeleteAsistenciaRecord(estudianteSeleccionadoAsistencia, registro.fecha)}
                                  title={`Eliminar registro del ${registro.fecha}`}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px', lineHeight: 1 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                                >🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => handleExportEstudianteReport(estudianteSeleccionadoAsistencia)}
                className="button-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setEstudianteSeleccionadoAsistencia(null)}
                className="button-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación/Edición */}
      {showCreateModal && (
        <CreateDiplomadoModal
          projectGid={diplomadosProjectGid}
          onClose={() => {
            setShowCreateModal(false);
            setEditMode(false);
            setDiplomadoToEdit(null);
          }}
          onSuccess={handleCreateSuccess}
          editMode={editMode}
          diplomadoData={diplomadoToEdit}
        />
      )}

      {/* Modal para agregar docente individual */}
      {showAgregarDocenteModal && selectedDiplomado && docentesTaskGid && (
        <AgregarPersonaModal
          parentTaskGid={docentesTaskGid}
          tipo="Docente"
          parentName={selectedDiplomado.name}
          onClose={() => setShowAgregarDocenteModal(false)}
          onSuccess={() => {
            setShowAgregarDocenteModal(false);
            handleViewDetails(selectedDiplomado);
          }}
        />
      )}

      {/* Modal para agregar estudiante individual */}
      {showAgregarEstudianteModal && selectedDiplomado && estudiantesTaskGid && (
        <AgregarPersonaModal
          parentTaskGid={estudiantesTaskGid}
          tipo="Estudiante"
          parentName={selectedDiplomado.name}
          onClose={() => setShowAgregarEstudianteModal(false)}
          onSuccess={() => {
            setShowAgregarEstudianteModal(false);
            handleViewDetails(selectedDiplomado);
          }}
        />
      )}

      {/* Modal de Información Primaria */}
      {selectedInfo && (
        <InfoPrimariaModal
          nombre={selectedInfo.nombre}
          genero={selectedInfo.genero}
          telefono={selectedInfo.telefono}
          lugarNacimiento={selectedInfo.lugarNacimiento}
          fechaNacimiento={selectedInfo.fechaNacimiento}
          domicilio={selectedInfo.domicilio}
          especialidad={selectedInfo.especialidad}
          documentoIdentidad={selectedInfo.documentoIdentidad}
          identidadCultural={selectedInfo.identidadCultural}
          tipo={selectedInfo.tipo}
          onClose={() => setSelectedInfo(null)}
        />
      )}

      {/* Modal de Asistencia */}
      {/* Modal de Registro de Notas */}
      {showRegistroNotasModal && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '950px', 
              width: '96%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <HtmlModalHeader icon="📝" title="Registro de Notas por Módulo" subtitle={selectedDiplomado?.name} onClose={() => setShowRegistroNotasModal(false)} />

            <div className="modal-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Selector de Módulo - fijo */}
              <div style={{ flexShrink: 0, padding: '1.25rem 1.5rem 0.75rem', borderBottom: '1px solid #f0f4f8' }}>
              <div style={{ 
                padding: '0.75rem 1rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minWidth: '120px'
                  }}>
                    📚 Módulo:
                  </label>
                  <select
                    value={moduloSeleccionado}
                    onChange={(e) => handleCambiarModulo(e.target.value)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '7px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontWeight: '500',
                      minWidth: '150px'
                    }}
                  >
                    <option value={ASANA_CUSTOM_FIELDS.MODULO_1}>Módulo 1</option>
                    <option value={ASANA_CUSTOM_FIELDS.MODULO_2}>Módulo 2</option>
                    <option value={ASANA_CUSTOM_FIELDS.MODULO_3}>Módulo 3</option>
                    <option value={ASANA_CUSTOM_FIELDS.MODULO_4}>Módulo 4</option>
                    <option value={ASANA_CUSTOM_FIELDS.MODULO_5}>Módulo 5</option>
                  </select>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#424242' }}>
                  Selecciona el módulo al que deseas asignar notas. Las notas existentes se mostrarán al cambiar de módulo.
                </p>
              </div>
              </div>
              {/* Lista con scroll */}
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0.75rem 1.5rem 1.5rem' }}>
              {notasEstudiantes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem', fontStyle: 'italic', marginTop: '1rem' }}>
                  No hay estudiantes registrados en este diplomado
                </p>
              ) : (
                <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{notasEstudiantes.length} estudiante{notasEstudiantes.length !== 1 ? 's' : ''}</span>
                  </div>
                  <style>{`
                    .nota-tbl-mod tbody tr { transition: background 0.1s; }
                    .nota-tbl-mod tbody tr:nth-child(even) { background: #f9fafb; }
                    .nota-tbl-mod tbody tr:hover { background: #eff6ff !important; }
                    .nota-tbl-mod thead th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; border-bottom: 2px solid #e2e8f0; }
                  `}</style>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="nota-tbl-mod" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', width: '44px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Estudiante</th>
                          <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem', width: '140px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                            Nota — {moduloSeleccionado} (0-100)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {notasEstudiantes.map((nota, index) => {
                          const tieneError = notasConError.has(nota.gid);
                          const notaInvalida = nota.nota < 0 || nota.nota > 100;
                          return (
                            <tr
                              key={nota.gid}
                              style={{ backgroundColor: tieneError ? '#ffebee' : undefined }}
                            >
                              <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
                                {index + 1}
                              </td>
                              <td style={{
                                padding: '0.7rem 0.75rem',
                                borderLeft: tieneError ? '4px solid #f44336' : '4px solid transparent',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {tieneError && <span style={{ color: '#f44336', marginRight: '0.5rem' }}>⚠️</span>}
                                <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem' }}>{nota.nombre}</span>
                                {tieneError && (
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#f44336', marginTop: '0.25rem', fontWeight: 'normal' }}>
                                    Error al guardar - Reintentar
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.7rem 0.75rem' }}>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  value={nota.nota}
                                  onChange={(e) => {
                                    const valor = parseInt(e.target.value, 10);
                                    handleCambiarNota(nota.gid, isNaN(valor) ? 0 : valor);
                                  }}
                                  onBlur={() => {
                                    const clamped = Math.max(0, Math.min(100, nota.nota));
                                    if (nota.nota !== clamped) handleCambiarNota(nota.gid, clamped);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === '.' || e.key === ',') e.preventDefault();
                                  }}
                                  style={{
                                    width: '80px',
                                    padding: '0.45rem 0.5rem',
                                    border: tieneError
                                      ? '2px solid #f44336'
                                      : notaInvalida
                                      ? '1.5px solid #f59e0b'
                                      : '1.5px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    textAlign: 'center',
                                    backgroundColor: 'white',
                                    color: '#374151'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {notasEstudiantes.length > 0 && (
                <div style={{ 
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    <strong>💡 Nota:</strong> Las notas deben ser valores entre 0 y 100. Una nota de 51 o superior se considera aprobada.
                  </p>
                </div>
              )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {notasConError.size > 0 && (
                  <div style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ffebee',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#c62828',
                    fontWeight: 'bold'
                  }}>
                    ⚠️ {notasConError.size} estudiante{notasConError.size !== 1 ? 's' : ''} con error
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowRegistroNotasModal(false)}
                  className="button-secondary"
                  disabled={loadingNotas}
                >
                  Cancelar
                </button>
                
                {notasConError.size > 0 && (
                  <button
                    onClick={() => handleGuardarNotas(true)}
                    className="button-primary"
                    disabled={loadingNotas}
                    style={{
                      backgroundColor: '#ff9800',
                      borderColor: '#ff9800'
                    }}
                  >
                    {loadingNotas ? 'Reintentando...' : `🔄 Reintentar Guardado (${notasConError.size})`}
                  </button>
                )}
                
                <button
                  onClick={() => handleGuardarNotas(false)}
                  className="button-primary"
                  disabled={loadingNotas || notasEstudiantes.length === 0}
                >
                  {loadingNotas ? 'Guardando...' : '💾 Guardar Notas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar archivo a documento */}
      {docModalSubtask && (
        <div className="modal-overlay" onClick={handleCloseDocModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>📎 Agregar Archivo</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>{docModalSubtask.name}</p>
              </div>
              <button onClick={handleCloseDocModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666' }}>✕</button>
            </div>
            <div className="modal-body">
              {docModalError && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '6px', fontSize: '0.9rem' }}>{docModalError}</div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nombre del archivo *</label>
                <input className="form-input" type="text" value={docNombre} onChange={e => setDocNombre(e.target.value)} placeholder="Ej: Informe de actividades" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveDocumento()} />
              </div>
              <div>
                <label className="form-label">Enlace (URL) *</label>
                <input className="form-input" type="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && handleSaveDocumento()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="button-secondary" onClick={handleCloseDocModal} disabled={savingDoc}>Cancelar</button>
              <button className="button-primary" onClick={handleSaveDocumento} disabled={savingDoc}>{savingDoc ? 'Guardando...' : '💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asistencia */}
      {showAsistenciaModal && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '950px', 
              width: '96%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <HtmlModalHeader icon="✓" title="Registro de Asistencia" subtitle={selectedDiplomado?.name} onClose={() => setShowAsistenciaModal(false)} />

            <div className="modal-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Selector de Fecha - fijo */}
              <div style={{ flexShrink: 0, padding: '1.25rem 1.5rem 0.75rem', borderBottom: '1px solid #f0f4f8' }}>
              <div style={{ 
                padding: '0.75rem 1rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📅 Fecha de Asistencia:
                  </label>
                  <input
                    type="date"
                    value={fechaAsistencia}
                    onChange={(e) => setFechaAsistencia(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.9rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '7px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#424242' }}>
                  Selecciona la fecha para la cual deseas registrar asistencia. Si la fecha ya tiene un registro, se sobreescribirá.
                </p>
              </div>
              </div>
              {/* Lista con scroll */}
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0.75rem 1.5rem 1.5rem' }}>
              {asistencias.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem', fontStyle: 'italic', marginTop: '1rem' }}>
                  No hay estudiantes registrados en este diplomado
                </p>
              ) : (
                <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{asistencias.length} estudiante{asistencias.length !== 1 ? 's' : ''}</span>
                  </div>
                  <style>{`
                    .asist-tbl-mod tbody tr { transition: background 0.1s; }
                    .asist-tbl-mod tbody tr:nth-child(even) { background: #f9fafb; }
                    .asist-tbl-mod tbody tr:hover { background: #eff6ff !important; }
                    .asist-tbl-mod thead th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; border-bottom: 2px solid #e2e8f0; }
                  `}</style>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="asist-tbl-mod" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', width: '44px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', width: '35%', minWidth: '160px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Estudiante</th>
                          <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', width: '12%', minWidth: '80px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Asistió</th>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', width: 'calc(53% - 44px)', minWidth: '160px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asistencias.map((asistencia, index) => {
                          const tieneError = asistenciasConError.has(asistencia.gid);
                          return (
                            <tr
                              key={asistencia.gid}
                              style={{ backgroundColor: tieneError ? '#ffebee' : undefined }}
                            >
                              <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
                                {index + 1}
                              </td>
                              <td style={{
                                padding: '0.7rem 0.75rem',
                                borderLeft: tieneError ? '4px solid #f44336' : '4px solid transparent',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word'
                              }}>
                                {tieneError && <span style={{ color: '#f44336', marginRight: '0.5rem' }}>⚠️</span>}
                                <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.9rem' }}>{asistencia.nombre}</span>
                                {tieneError && (
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#f44336', marginTop: '0.25rem', fontWeight: 'normal' }}>
                                    Error al guardar - Reintentar
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.7rem 0.5rem' }}>
                                <input
                                  type="checkbox"
                                  checked={asistencia.asistio}
                                  onChange={(e) => handleCambiarAsistencia(asistencia.gid, 'asistio', e.target.checked)}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer',
                                    accentColor: tieneError ? '#f44336' : undefined
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.7rem 0.75rem' }}>
                                <input
                                  type="text"
                                  value={asistencia.observaciones}
                                  onChange={(e) => handleCambiarAsistencia(asistencia.gid, 'observaciones', e.target.value)}
                                  placeholder="Agregar observación..."
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem 0.6rem',
                                    border: tieneError ? '2px solid #f44336' : '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    backgroundColor: 'white'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {asistenciasConError.size > 0 && (
                  <div style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ffebee',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#c62828',
                    fontWeight: 'bold'
                  }}>
                    ⚠️ {asistenciasConError.size} estudiante{asistenciasConError.size !== 1 ? 's' : ''} con error
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowAsistenciaModal(false)}
                  className="button-secondary"
                  disabled={loadingAsistencia}
                >
                  Cancelar
                </button>
                
                {asistenciasConError.size > 0 && (
                  <button
                    onClick={() => handleGuardarAsistencias(true)}
                    className="button-primary"
                    disabled={loadingAsistencia}
                    style={{
                      backgroundColor: '#ff9800',
                      borderColor: '#ff9800'
                    }}
                  >
                    {loadingAsistencia ? 'Reintentando...' : `🔄 Reintentar Guardado (${asistenciasConError.size})`}
                  </button>
                )}
                
                <button
                  onClick={() => handleGuardarAsistencias(false)}
                  className="button-primary"
                  disabled={loadingAsistencia || asistencias.length === 0}
                >
                  {loadingAsistencia ? 'Guardando...' : '💾 Guardar Asistencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiplomadosPage;
