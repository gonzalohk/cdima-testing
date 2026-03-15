import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import CreateDiplomadoModal from '../components/CreateDiplomadoModal';
import InfoPrimariaModal from '../components/InfoPrimariaModal';
import { exportDiplomadoGeneralPDF, exportDiplomadoCentralizadorNotasPDF, exportDiplomadoEstudiantePDF } from '../services/reports/diplomados-reports.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ASANA_CUSTOM_FIELDS } from '../constants/asana-fields';
import { 
  getCustomFieldValueSafe, 
  parseEstudianteData, 
  parseAsistenciaRecords,
  updateNotasWithAsistencia,
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

const DiplomadosPage: React.FC = () => {
  const navigate = useNavigate();
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [diplomadoToEdit, setDiplomadoToEdit] = useState<any>(null);
  const [selectedDiplomado, setSelectedDiplomado] = useState<AsanaSection | null>(null);
  const [diplomadosProjectGid, setDiplomadosProjectGid] = useState<string>('');
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [showAsistenciaPanel, setShowAsistenciaPanel] = useState(false);
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
  
  // Estados para modales individuales
  const [estudianteSeleccionadoNotas, setEstudianteSeleccionadoNotas] = useState<AsanaTask | null>(null);
  const [estudianteSeleccionadoAsistencia, setEstudianteSeleccionadoAsistencia] = useState<AsanaTask | null>(null);
  
  // Estados para los detalles del diplomado
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [docentes, setDocentes] = useState<AsanaTask[]>([]);
  const [estudiantes, setEstudiantes] = useState<AsanaTask[]>([]);
  const [documentos, setDocumentos] = useState<AsanaTask[]>([]);

  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) {
      navigate('/');
      return;
    }
    loadDiplomados();
  }, [navigate]);

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
          telefono: data.telefono || '',
          lugarNacimiento: data.lugarNacimiento || '',
          documentoIdentidad: data.documentoIdentidad || '',
          identidadCultural: data.identidadCultural || '',
          subtaskGid: subtask.gid
        };
      });

      // Parsear datos de estudiantes
      const estudiantesData = subtasksEstudiantes.map(subtask => {
        const data = parseEstudianteData(subtask.notes);
        return {
          nombre: subtask.name,
          genero: data.genero,
          telefono: data.telefono || '',
          lugarNacimiento: data.lugarNacimiento || '',
          documentoIdentidad: data.documentoIdentidad || '',
          identidadCultural: data.identidadCultural || '',
          subtaskGid: subtask.gid
        };
      });

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
      }

      if (tareaEstudiantes) {
        const subtasks = await asanaService.getSubtasks(tareaEstudiantes.gid);
        setEstudiantes(sortByApellidos(subtasks));
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
      
      // ✅ OPTIMIZACIÓN: Crear array de promesas para ejecución paralela (BATCH)
      console.log(`🚀 Ejecutando actualización en batch de ${estudiantesProcesar.length} estudiantes${soloReintentar ? ' (reintento)' : ''}...`);
      const startTime = performance.now();
      
      const updatePromises = estudiantesProcesar.map(async (asistencia) => {
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
          
          console.log(`✅ Asistencia guardada para ${asistencia.nombre}`);
          return { success: true, gid: asistencia.gid, nombre: asistencia.nombre, result: resultado };
        } catch (error) {
          console.error(`❌ Error al guardar asistencia de ${asistencia.nombre}:`, error);
          return { success: false, gid: asistencia.gid, nombre: asistencia.nombre, error };
        }
      });

      // ✅ Ejecutar todas las actualizaciones en paralelo (BATCH)
      const results = await Promise.all(updatePromises);
      
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
        
        console.log('\n🔄 Recargando datos del diplomado...');
        
        // Recargar los detalles del diplomado para ver los cambios
        if (selectedDiplomado) {
          await handleViewDetails(selectedDiplomado);
        }
        
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
      
      // Determinar qué estudiantes procesar
      const estudiantesProcesar = soloReintentar
        ? notasEstudiantes.filter(est => notasConError.has(est.gid))
        : notasEstudiantes;
      
      if (estudiantesProcesar.length === 0) {
        alert('⚠️ No hay estudiantes para procesar');
        return;
      }
      
      // ✅ OPTIMIZACIÓN: Crear array de promesas para ejecución paralela (BATCH)
      console.log(`🚀 Ejecutando actualización en batch de ${estudiantesProcesar.length} estudiantes${soloReintentar ? ' (reintento)' : ''}...`);
      const startTime = performance.now();
      
      const updatePromises = estudiantesProcesar.map(async (notaEstudiante) => {
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
      });

      // ✅ Ejecutar todas las actualizaciones en paralelo (BATCH)
      const results = await Promise.all(updatePromises);
      
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

  if (loading) {
    return <LoadingOverlay message="Cargando diplomados..." />;
  }

  return (
    <div className="planning-page">
      {/* Header */}
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">🎓</div>
          <div className="planning-info">
            <h1 className="planning-title">Gestión de Diplomados</h1>
            <p className="planning-subtitle">
              {diplomados.length} {diplomados.length === 1 ? 'diplomado registrado' : 'diplomados registrados'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="button-secondary"
            onClick={handleEditDiplomado}
            disabled={!selectedDiplomado}
            style={{ 
              fontSize: '1rem', 
              padding: '0.75rem 1.5rem',
              opacity: !selectedDiplomado ? 0.5 : 1,
              cursor: !selectedDiplomado ? 'not-allowed' : 'pointer'
            }}
          >
            ✏️ Editar Diplomado
          </button>
          <button
            className="button-primary"
            onClick={() => {
              setEditMode(false);
              setDiplomadoToEdit(null);
              setShowCreateModal(true);
            }}
            style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
          >
            + Crear Diplomado
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {/* Lista de Diplomados */}
      <div className="card">
          {diplomados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                No hay diplomados registrados
              </p>
              <p style={{ fontSize: '0.9rem' }}>
                Haga clic en "Crear Diplomado" para agregar uno nuevo
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: '250px' }}>Nombre del Diplomado</th>
                    <th style={{ minWidth: '180px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {diplomados.map((diplomado) => (
                    <tr 
                      key={diplomado.gid}
                      style={{
                        backgroundColor: selectedDiplomado?.gid === diplomado.gid ? '#e3f2fd' : undefined
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🎓</span>
                          <span style={{ fontWeight: 500 }}>{diplomado.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewDetails(diplomado)}
                            className="button-primary"
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                          >
                            👁️ Ver Detalles
                          </button>
                          {/* <button
                            onClick={() => handleDeleteDiplomado(diplomado.gid, diplomado.name)}
                            className="button-secondary"
                            style={{ 
                              fontSize: '0.875rem', 
                              padding: '0.5rem 1rem',
                              backgroundColor: '#fee',
                              color: '#c00',
                              border: '1px solid #fcc'
                            }}
                          >
                            🗑️ Eliminar
                          </button> */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Detalles del Diplomado Seleccionado */}
      {selectedDiplomado && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
            <div style={{ 
              padding: '1.5rem',
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

            <div style={{ padding: '1.5rem' }}>
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  <p>Cargando detalles...</p>
                </div>
              ) : (
                <>
                  {/* Botones Ver Listado y Asistencia */}
                  {(estudiantes.length > 0 || docentes.length > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                      {estudiantes.length > 0 && (
                        <>
                          <button
                            onClick={handleAbrirRegistroNotas}
                            className="button-secondary"
                            style={{ 
                              fontSize: '0.9rem', 
                              padding: '0.75rem 1.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            📝 Registrar Notas
                          </button>
                          <button
                            onClick={handleAbrirAsistencia}
                            className="button-secondary"
                            style={{ 
                              fontSize: '0.9rem', 
                              padding: '0.75rem 1.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            ✓ Asistencia
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleExportDiplomadoGeneral}
                        className="button-secondary"
                        style={{ 
                          fontSize: '0.9rem', 
                          padding: '0.75rem 1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        📄 Ver Listado
                      </button>
                    </div>
                  )}

                  {/* Docentes */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>👨‍🏫 Docentes ({docentes.length})</h3>
                    {docentes.length === 0 ? (
                      <p style={{ color: '#999' }}>No hay docentes registrados</p>
                    ) : (
                      <table className="table-container" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Nombre</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: '80px' }}>Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docentes.map((docente) => (
                            <tr key={docente.gid}>
                              <td style={{ padding: '0.5rem' }}>{formatearNombreCompleto(docente.name)}</td>
                              <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                <button
                                  onClick={() => handleShowInfo(docente, 'Docente')}
                                  className="button-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                >
                                  ℹ️ Info
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Estudiantes */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>👨‍🎓 Estudiantes ({estudiantes.length})</h3>
                    {estudiantes.length === 0 ? (
                      <p style={{ color: '#999' }}>No hay estudiantes registrados</p>
                    ) : (
                      <table className="table-container" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Nombre</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: '100px' }}>Notas</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: '110px' }}>Asistencia</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: '80px' }}>Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estudiantes.map((estudiante) => (
                            <tr key={estudiante.gid}>
                              <td style={{ padding: '0.5rem' }}>{formatearNombreCompleto(estudiante.name)}</td>
                              <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                <button
                                  onClick={() => setEstudianteSeleccionadoNotas(estudiante)}
                                  className="button-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                >
                                  📊 Ver Notas
                                </button>
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                <button
                                  onClick={() => setEstudianteSeleccionadoAsistencia(estudiante)}
                                  className="button-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                >
                                  ✓ Ver Asistencia
                                </button>
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                <button
                                  onClick={() => handleShowInfo(estudiante, 'Estudiante')}
                                  className="button-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                >
                                  ℹ️ Info
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Documentos */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>📄 Documentos ({documentos.length})</h3>
                    {documentos.length === 0 ? (
                      <p style={{ color: '#999' }}>No hay documentos registrados</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {documentos.map((documento) => (
                          <div 
                            key={documento.gid} 
                            style={{ 
                              width: '100%',
                              padding: '1rem 1.25rem', 
                              backgroundColor: '#f8f9fa',
                              borderRadius: '8px',
                              borderLeft: '4px solid #2196F3',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateX(4px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateX(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>📄</span>
                              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#333', flex: 1 }}>
                                {documento.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#fff3e0', 
                borderRadius: '6px',
                borderLeft: '4px solid #ff9800',
                marginTop: '1.5rem'
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#e65100' }}>
                  <strong>📌 Nota:</strong> Para agregar más docentes, estudiantes o documentos, 
                  vaya a Asana y agregue subtareas a las tareas correspondientes dentro de este diplomado.
                </p>
              </div>

              {/* Botones Centralizador de Notas y Asistencia */}
              {estudiantes.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowAsistenciaPanel(!showAsistenciaPanel)}
                    className="button-primary"
                    style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.75rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    ✓ {showAsistenciaPanel ? 'Ocultar' : 'Mostrar'} Asistencia
                  </button>
                  <button
                    onClick={() => setShowNotasModal(!showNotasModal)}
                    className="button-primary"
                    style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.75rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    📊 {showNotasModal ? 'Ocultar' : 'Mostrar'} Centralizador de Notas
                  </button>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Panel de Centralizador de Notas */}
      {showNotasModal && selectedDiplomado && estudiantes.length > 0 && (
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
                {selectedDiplomado.name}
              </p>
            </div>
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
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderRight: '1px solid #bbdefb',
                      minWidth: '200px',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#e3f2fd',
                      zIndex: 2,
                      fontWeight: 600
                    }}>
                      Estudiante
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 1
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 2
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 3
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 4
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 5
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'center', 
                      fontWeight: 700,
                      backgroundColor: '#bbdefb',
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
                          backgroundColor: '#e3f2fd',
                          fontWeight: 700,
                          borderTop: '3px solid #90caf9'
                        }}>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'left',
                            borderRight: '1px solid #64b5f6',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#e3f2fd',
                            zIndex: 1
                          }}>
                            PROMEDIO GENERAL
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo1')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo2')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo3')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo4')}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo5')}
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            backgroundColor: '#90caf9',
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
      {showAsistenciaPanel && selectedDiplomado && estudiantes.length > 0 && (
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
                {selectedDiplomado.name}
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
              width: '90%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>📊 Notas del Estudiante</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => handleExportEstudianteReport(estudianteSeleccionadoNotas)}
                  className="button-secondary"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  🖨️ Imprimir
                </button>
                <button className="modal-close" onClick={() => setEstudianteSeleccionadoNotas(null)}>
                  ×
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1}}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1565c0', fontSize: '1.2rem', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                {formatearNombreCompleto(estudianteSeleccionadoNotas.name)}
              </h3>

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
                    <table style={{ minWidth: '600px',width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #90caf9', width: '45%' }}>
                            Módulo
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #90caf9', width: '20%' }}>
                            Nota
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #90caf9', width: '35%' }}>
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
                          <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                              {modulo.nombre}
                            </td>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '1.1rem',
                              color: modulo.nota >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {modulo.nota}
                            </td>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 600
                            }}>
                              {modulo.nota >= 51 ? (
                                <span style={{ color: '#27AE60' }}>✓ Aprobado</span>
                              ) : (
                                <span style={{ color: '#E74C3C' }}>✗ Reprobado</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ 
                          backgroundColor: '#e3f2fd',
                          fontWeight: 700,
                          borderTop: '3px solid #90caf9'
                        }}>
                          <td style={{ padding: '1rem', fontSize: '1.05rem' }}>
                            PROMEDIO FINAL
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            fontSize: '1.3rem',
                            color: promedio >= 51 ? '#27AE60' : '#E74C3C'
                          }}>
                            {Math.round(promedio)}
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            fontSize: '1.05rem'
                          }}>
                            {promedio >= 51 ? (
                              <span style={{ color: '#27AE60' }}>✓ Aprobado</span>
                            ) : (
                              <span style={{ color: '#E74C3C' }}>✗ Reprobado</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>

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

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee' }}>
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
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div className="modal-header">
              <h2>✓ Asistencia del Estudiante</h2>
              <button className="modal-close" onClick={() => setEstudianteSeleccionadoAsistencia(null)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#2e7d32' }}>
                {formatearNombreCompleto(estudianteSeleccionadoAsistencia.name)}
              </h3>

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
                        backgroundColor: '#e3f2fd', 
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                          Total Registros
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1565c0' }}>
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
                    </div>

                    {/* Tabla de registros */}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #c8e6c9' }}>
                            Fecha
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #c8e6c9' }}>
                            Asistió
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #c8e6c9' }}>
                            Observaciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((registro, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                              {registro.fecha}
                            </td>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '1rem',
                              color: registro.asistio ? '#27AE60' : '#E74C3C'
                            }}>
                              {registro.asistio ? '✓ Sí' : '✗ No'}
                            </td>
                            <td style={{ 
                              padding: '0.75rem',
                              color: registro.observaciones === 'Ninguna' ? '#999' : '#333',
                              fontStyle: registro.observaciones === 'Ninguna' ? 'italic' : 'normal'
                            }}>
                              {registro.observaciones}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee' }}>
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

      {/* Modal de Información Primaria */}
      {selectedInfo && (
        <InfoPrimariaModal
          nombre={selectedInfo.nombre}
          genero={selectedInfo.genero}
          telefono={selectedInfo.telefono}
          lugarNacimiento={selectedInfo.lugarNacimiento}
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
              maxWidth: '1400px', 
              width: '90%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header">
              <h2>📝 Registro de Notas por Módulo</h2>
              <button className="modal-close" onClick={() => setShowRegistroNotasModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
              {/* Selector de Módulo */}
              <div style={{ 
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#e8f5e9',
                borderRadius: '6px',
                borderLeft: '4px solid #4caf50'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 'bold', 
                    color: '#2e7d32',
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
                      border: '2px solid #4caf50',
                      borderRadius: '4px',
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

              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="table-container" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e8f5e9' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', width: '65%', color: '#2e7d32' }}>Estudiante</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', width: '35%', color: '#2e7d32' }}>
                        Nota para {moduloSeleccionado} (0-100)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasEstudiantes.map((nota) => {
                      const tieneError = notasConError.has(nota.gid);
                      return (
                        <tr 
                          key={nota.gid} 
                          style={{ 
                            borderBottom: '1px solid #e0e0e0',
                            backgroundColor: tieneError ? '#ffebee' : 'transparent'
                          }}
                        >
                          <td style={{ 
                            padding: '0.75rem', 
                            fontWeight: 500,
                            borderLeft: tieneError ? '4px solid #f44336' : '4px solid transparent',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {tieneError && <span style={{ color: '#f44336', marginRight: '0.5rem' }}>⚠️</span>}
                            {nota.nombre}
                            {tieneError && (
                              <span style={{ 
                                display: 'block',
                                fontSize: '0.75rem',
                                color: '#f44336',
                                marginTop: '0.25rem',
                                fontWeight: 'normal'
                              }}>
                                Error al guardar - Reintentar
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={nota.nota}
                              onChange={(e) => {
                                const valor = parseInt(e.target.value) || 0;
                                const valorLimitado = Math.max(0, Math.min(100, valor));
                                handleCambiarNota(nota.gid, valorLimitado);
                              }}
                              style={{
                                width: '100px',
                                padding: '0.5rem',
                                border: tieneError ? '2px solid #f44336' : '2px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '1rem',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                color: nota.nota >= 51 ? '#27AE60' : '#E74C3C',
                                backgroundColor: tieneError ? '#fff' : 'white'
                              }}
                            />
                            <span style={{ 
                              marginLeft: '0.5rem',
                              fontSize: '0.9rem',
                              color: nota.nota >= 51 ? '#27AE60' : '#E74C3C',
                              fontWeight: 'bold'
                            }}>
                              {nota.nota >= 51 ? '✓' : '✗'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {notasEstudiantes.length === 0 && (
                <p style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '2rem',
                  fontStyle: 'italic'
                }}>
                  No hay estudiantes registrados en este diplomado
                </p>
              )}

              {notasEstudiantes.length > 0 && (
                <div style={{ 
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#fff3e0',
                  borderRadius: '6px',
                  borderLeft: '4px solid #ff9800'
                }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#e65100' }}>
                    <strong>💡 Nota:</strong> Las notas deben ser valores entre 0 y 100. Una nota de 51 o superior se considera aprobada.
                  </p>
                </div>
              )}
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

      {/* Modal de Asistencia */}
      {showAsistenciaModal && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '1100px', 
              width: '95%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header">
              <h2>✓ Registro de Asistencia</h2>
              <button className="modal-close" onClick={() => setShowAsistenciaModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
              {/* Selector de Fecha */}
              <div style={{ 
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#e3f2fd',
                borderRadius: '6px',
                borderLeft: '4px solid #2196f3'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 'bold', 
                    color: '#1565c0',
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
                      border: '2px solid #2196f3',
                      borderRadius: '4px',
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

              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="table-container" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem', width: '35%', minWidth: '180px' }}>Estudiante</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', width: '15%', minWidth: '100px' }}>Asistió</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', width: '50%', minWidth: '200px' }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.map((asistencia) => {
                      const tieneError = asistenciasConError.has(asistencia.gid);
                      return (
                        <tr 
                          key={asistencia.gid}
                          style={{ 
                            backgroundColor: tieneError ? '#ffebee' : 'transparent'
                          }}
                        >
                          <td style={{ 
                            padding: '0.75rem',
                            borderLeft: tieneError ? '4px solid #f44336' : '4px solid transparent',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            maxWidth: '300px'
                          }}>
                            {tieneError && <span style={{ color: '#f44336', marginRight: '0.5rem' }}>⚠️</span>}
                            {asistencia.nombre}
                            {tieneError && (
                              <span style={{ 
                                display: 'block',
                                fontSize: '0.75rem',
                                color: '#f44336',
                                marginTop: '0.25rem',
                                fontWeight: 'normal'
                              }}>
                                Error al guardar - Reintentar
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={asistencia.asistio}
                              onChange={(e) => handleCambiarAsistencia(asistencia.gid, 'asistio', e.target.checked)}
                              style={{ 
                                width: '20px', 
                                height: '20px',
                                cursor: 'pointer',
                                accentColor: tieneError ? '#f44336' : undefined
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <input
                              type="text"
                              value={asistencia.observaciones}
                              onChange={(e) => handleCambiarAsistencia(asistencia.gid, 'observaciones', e.target.value)}
                              placeholder="Agregar observación..."
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: tieneError ? '2px solid #f44336' : '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                backgroundColor: tieneError ? '#fff' : 'white'
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {asistencias.length === 0 && (
                <p style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '2rem',
                  fontStyle: 'italic'
                }}>
                  No hay estudiantes registrados en este diplomado
                </p>
              )}
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
