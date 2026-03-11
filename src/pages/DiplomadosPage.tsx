import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import CreateDiplomadoModal from '../components/CreateDiplomadoModal';
import InfoPrimariaModal from '../components/InfoPrimariaModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoInicial from '../assets/logoinicial.png';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

const DiplomadosPage: React.FC = () => {
  const navigate = useNavigate();
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDiplomado, setSelectedDiplomado] = useState<AsanaSection | null>(null);
  const [diplomadosProjectGid, setDiplomadosProjectGid] = useState<string>('');
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [showAsistenciaPanel, setShowAsistenciaPanel] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<InfoPrimaria | null>(null);
  
  // Estados para asistencia
  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [asistencias, setAsistencias] = useState<AsistenciaEstudiante[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);
  const [fechaAsistencia, setFechaAsistencia] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
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
    loadDiplomados();
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
        setDocentes(subtasks);
      }

      if (tareaEstudiantes) {
        const subtasks = await asanaService.getSubtasks(tareaEstudiantes.gid);
        setEstudiantes(subtasks);
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

  const parseInfoPrimaria = (task: AsanaTask, tipo: 'Docente' | 'Estudiante'): InfoPrimaria => {
    const notas = task.notes || '';
    const info: InfoPrimaria = {
      nombre: task.name,
      genero: '',
      telefono: '',
      lugarNacimiento: '',
      documentoIdentidad: '',
      identidadCultural: '',
      tipo
    };

    // Parsear las notas para extraer la información
    const generoMatch = notas.match(/Género:\s*(.+)/i);
    const telefonoMatch = notas.match(/Teléfono:\s*(.+)/i);
    const lugarMatch = notas.match(/Lugar de Nacimiento:\s*(.+)/i);
    const documentoMatch = notas.match(/Documento de Identidad:\s*(.+)/i);
    const identidadMatch = notas.match(/Identidad Cultural:\s*(.+)/i);

    if (generoMatch) info.genero = generoMatch[1].trim();
    if (telefonoMatch) info.telefono = telefonoMatch[1].trim();
    if (lugarMatch) info.lugarNacimiento = lugarMatch[1].trim();
    if (documentoMatch) info.documentoIdentidad = documentoMatch[1].trim();
    if (identidadMatch) info.identidadCultural = identidadMatch[1].trim();

    return info;
  };

  const handleShowInfo = (task: AsanaTask, tipo: 'Docente' | 'Estudiante') => {
    const info = parseInfoPrimaria(task, tipo);
    setSelectedInfo(info);
  };

  // === Funciones para Asistencia ===
  
  const handleAbrirAsistencia = () => {
    // Reiniciar la fecha a hoy cuando se abre el modal
    setFechaAsistencia(format(new Date(), 'yyyy-MM-dd'));
    
    // Inicializar asistencias con los estudiantes actuales
    const asistenciasIniciales: AsistenciaEstudiante[] = estudiantes.map(estudiante => ({
      gid: estudiante.gid,
      nombre: estudiante.name,
      asistio: false,
      observaciones: ''
    }));
    setAsistencias(asistenciasIniciales);
    setShowAsistenciaModal(true);
  };

  const handleCambiarAsistencia = (gid: string, campo: 'asistio' | 'observaciones', valor: boolean | string) => {
    setAsistencias(prev => prev.map(asist => 
      asist.gid === gid 
        ? { ...asist, [campo]: valor }
        : asist
    ));
  };

  const handleGuardarAsistencias = async () => {
    setLoadingAsistencia(true);
    try {
      // Formatear la fecha seleccionada
      const fechaSeleccionada = format(new Date(fechaAsistencia), "dd/MM/yyyy", { locale: es });
      
      console.log('📅 Guardando asistencias para la fecha:', fechaSeleccionada);
      
      for (const asistencia of asistencias) {
        // Obtener las notas actuales del estudiante
        const estudiante = estudiantes.find(e => e.gid === asistencia.gid);
        if (!estudiante) {
          console.warn(`⚠️ No se encontró el estudiante con gid: ${asistencia.gid}`);
          continue;
        }

        console.log(`\n👤 Procesando: ${asistencia.nombre}`);
        const notasActuales = estudiante.notes || '';
        console.log('📝 Notas actuales:', notasActuales.substring(0, 100) + '...');
        
        // Crear el registro de asistencia del día
        const nuevoRegistro = `${fechaSeleccionada} - Asistió: ${asistencia.asistio ? 'Sí' : 'No'} - Observaciones: ${asistencia.observaciones || 'Ninguna'}`;
        console.log('🆕 Nuevo registro:', nuevoRegistro);
        
        let nuevasNotas = notasActuales;
        
        if (notasActuales.includes('=== REGISTRO DE ASISTENCIA ===')) {
          // Ya existe el bloque de asistencia
          const [parteAntes, parteDespues] = notasActuales.split('=== REGISTRO DE ASISTENCIA ===');
          const registrosExistentes = parteDespues.split('\n').filter(linea => linea.trim());
          
          console.log(`📋 Registros existentes: ${registrosExistentes.length}`);
          
          // Buscar si ya existe un registro para esta fecha
          const indiceExistente = registrosExistentes.findIndex(registro => 
            registro.startsWith(fechaSeleccionada)
          );
          
          if (indiceExistente !== -1) {
            console.log(`♻️ Reemplazando registro existente en índice ${indiceExistente}`);
            registrosExistentes[indiceExistente] = nuevoRegistro;
          } else {
            console.log('➕ Agregando nuevo registro al principio');
            registrosExistentes.unshift(nuevoRegistro);
          }
          
          // Reconstruir las notas
          nuevasNotas = `${parteAntes}=== REGISTRO DE ASISTENCIA ===\n${registrosExistentes.join('\n')}`;
        } else {
          console.log('🆕 Creando nuevo bloque de asistencia');
          nuevasNotas = `${notasActuales}\n\n=== REGISTRO DE ASISTENCIA ===\n${nuevoRegistro}`;
        }

        console.log('💾 Guardando en Asana...');
        console.log('📄 Nuevas notas (preview):', nuevasNotas.substring(0, 200) + '...');
        
        // Actualizar la tarea con las nuevas notas
        const resultado = await asanaService.updateTask(asistencia.gid, { notes: nuevasNotas });
        console.log('✅ Guardado exitoso para:', asistencia.nombre);
        console.log('📋 Respuesta de Asana:', resultado.gid);
      }

      console.log('\n🎉 Todas las asistencias guardadas. Recargando datos...');
      
      // Recargar los detalles del diplomado para ver los cambios
      if (selectedDiplomado) {
        await handleViewDetails(selectedDiplomado);
      }
      
      alert('✅ Asistencias guardadas correctamente');
      setShowAsistenciaModal(false);
    } catch (err) {
      console.error('❌ Error al guardar asistencias:', err);
      if (err instanceof Error) {
        alert(`❌ Error al guardar las asistencias: ${err.message}`);
      } else {
        alert('❌ Error al guardar las asistencias');
      }
    } finally {
      setLoadingAsistencia(false);
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
      const notas = estudiante.notes || '';
      const registros: { [fecha: string]: { asistio: boolean; observaciones: string } } = {};

      if (notas.includes('=== REGISTRO DE ASISTENCIA ===')) {
        const [, parteDespues] = notas.split('=== REGISTRO DE ASISTENCIA ===');
        const lineas = parteDespues.split('\n').filter(linea => linea.trim());

        lineas.forEach(linea => {
          // Formato: "11/03/2026 - Asistió: Sí - Observaciones: Ninguna"
          const matchFecha = linea.match(/^(\d{2}\/\d{2}\/\d{4})/);
          const matchAsistio = linea.match(/Asistió:\s*(Sí|No)/i);
          const matchObservaciones = linea.match(/Observaciones:\s*(.+)$/i);

          if (matchFecha) {
            const fecha = matchFecha[1];
            const asistio = matchAsistio ? matchAsistio[1].toLowerCase() === 'sí' : false;
            const observaciones = matchObservaciones ? matchObservaciones[1].trim() : '';

            registros[fecha] = { asistio, observaciones };
            todasLasFechas.add(fecha);
          }
        });
      }

      asistenciasPorEstudiante.push({
        nombre: estudiante.name,
        registros
      });
    });

    // Ordenar fechas (más recientes primero)
    const fechasOrdenadas = Array.from(todasLasFechas).sort((a, b) => {
      const [diaA, mesA, añoA] = a.split('/').map(Number);
      const [diaB, mesB, añoB] = b.split('/').map(Number);
      const fechaA = new Date(añoA, mesA - 1, diaA);
      const fechaB = new Date(añoB, mesB - 1, diaB);
      return fechaB.getTime() - fechaA.getTime();
    });

    return { asistenciasPorEstudiante, fechasOrdenadas };
  };

  const generarReporteDiplomado = () => {
    if (!selectedDiplomado) return;

    // Colores del proyecto (mismo esquema que PlanningPage)
    const colors = {
      navyBlue: [70, 100, 140],
      lightGray: [117, 117, 117],
      ultraLightGray: [249, 249, 249],
      white: [255, 255, 255]
    };

    const margins = {
      top: 20,
      bottom: 20,
      left: 20,
      right: 20
    };

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // ============ ENCABEZADO ============
    
    // Logo CDIMA (lado izquierdo)
    try {
      const logoWidth = 28;
      pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, logoWidth, 0);
    } catch (error) {
      console.error('Error al cargar logo:', error);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('CDIMA', margins.left, margins.top + 8);
    }
    
    // Título Principal (lado derecho)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
    pdf.text('REPORTE DE DIPLOMADO', pageWidth - margins.right, margins.top + 8, { align: 'right' });
    
    // Metadatos
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(45, 45, 45);
    
    let metaY = margins.top + 14;
    pdf.text(`DIPLOMADO: ${selectedDiplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
    
    metaY += 5;
    const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
    
    // Línea separadora
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

    let startY = metaY + 14;

    // ============ TABLA DE DOCENTES ============
    if (docentes.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('DOCENTES', margins.left, startY);
      
      startY += 8;

      const docentesData = docentes.map(docente => {
        const info = parseInfoPrimaria(docente, 'Docente');
        return [
          info.nombre,
          info.genero || 'N/A',
          info.telefono || 'N/A',
          info.lugarNacimiento || 'N/A',
          info.documentoIdentidad || 'N/A',
          info.identidadCultural || 'N/A'
        ];
      });

      autoTable(pdf, {
        head: [['Nombre', 'Genero', 'Telefono', 'Lugar de Nacimiento', 'Doc. Identidad', 'Identidad Cultural']],
        body: docentesData,
        startY: startY,
        margin: { left: margins.left, right: margins.right },
        theme: 'striped',
        headStyles: {
          fillColor: colors.navyBlue,
          textColor: colors.white,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          cellPadding: 5
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
          overflow: 'linebreak',
          valign: 'middle',
          textColor: [45, 45, 45],
          lineColor: [230, 230, 230],
          lineWidth: 0.1
        },
        bodyStyles: {
          fillColor: colors.white
        },
        alternateRowStyles: {
          fillColor: colors.ultraLightGray
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 35 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 30 }
        }
      });

      startY = (pdf as any).lastAutoTable.finalY + 12;
    }

    // ============ TABLA DE ESTUDIANTES ============
    if (estudiantes.length > 0) {
      // Verificar si necesitamos una nueva página
      if (startY > pageHeight - 80) {
        pdf.addPage();
        startY = margins.top + 10;
      }

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('ESTUDIANTES', margins.left, startY);
      
      startY += 8;

      const estudiantesData = estudiantes.map(estudiante => {
        const info = parseInfoPrimaria(estudiante, 'Estudiante');
        return [
          info.nombre,
          info.genero || 'N/A',
          info.telefono || 'N/A',
          info.lugarNacimiento || 'N/A',
          info.documentoIdentidad || 'N/A',
          info.identidadCultural || 'N/A'
        ];
      });

      autoTable(pdf, {
        head: [['Nombre', 'Genero', 'Telefono', 'Lugar de Nacimiento', 'Doc. Identidad', 'Identidad Cultural']],
        body: estudiantesData,
        startY: startY,
        margin: { left: margins.left, right: margins.right },
        theme: 'striped',
        headStyles: {
          fillColor: colors.navyBlue,
          textColor: colors.white,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          cellPadding: 5
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
          overflow: 'linebreak',
          valign: 'middle',
          textColor: [45, 45, 45],
          lineColor: [230, 230, 230],
          lineWidth: 0.1
        },
        bodyStyles: {
          fillColor: colors.white
        },
        alternateRowStyles: {
          fillColor: colors.ultraLightGray
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 35 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 30 }
        }
      });
    }

    // ============ PIE DE PÁGINA ============
    const finalY = (pdf as any).lastAutoTable?.finalY || startY;
    if (finalY < pageHeight - 30) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      const footerText = `Total Docentes: ${docentes.length} | Total Estudiantes: ${estudiantes.length}`;
      pdf.text(footerText, pageWidth / 2, pageHeight - margins.bottom + 5, { align: 'center' });
    }

    // Abrir en nuevo tab
    pdf.output('dataurlnewwindow');
  };

  const generarReporteCentralizadorNotas = () => {
    if (!selectedDiplomado || estudiantes.length === 0) return;

    // Colores del proyecto (mismo esquema que PlanningPage)
    const colors = {
      navyBlue: [70, 100, 140],
      lightGray: [117, 117, 117],
      ultraLightGray: [249, 249, 249],
      white: [255, 255, 255],
      forestGreen: [46, 125, 50],
      errorRed: [231, 76, 60]
    };

    const margins = {
      top: 20,
      bottom: 20,
      left: 20,
      right: 20
    };

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // ============ ENCABEZADO ============
    
    // Logo CDIMA (lado izquierdo)
    try {
      const logoWidth = 28;
      pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, logoWidth, 0);
    } catch (error) {
      console.error('Error al cargar logo:', error);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('CDIMA', margins.left, margins.top + 8);
    }
    
    // Título Principal (lado derecho)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
    pdf.text('CENTRALIZADOR DE NOTAS', pageWidth - margins.right, margins.top + 8, { align: 'right' });
    
    // Metadatos
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(45, 45, 45);
    
    let metaY = margins.top + 14;
    pdf.text(`DIPLOMADO: ${selectedDiplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
    
    metaY += 5;
    const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
    
    // Línea separadora
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

    let startY = metaY + 14;

    // ============ TABLA DE NOTAS ============
    // Calcular datos de estudiantes
    const getCustomFieldValue = (task: AsanaTask, fieldName: string): number => {
      if (!task.custom_fields) return 0;
      const field = task.custom_fields.find(f => f.name === fieldName);
      if (!field) return 0;
      if (field.number_value !== undefined && field.number_value !== null) {
        return field.number_value;
      }
      if (field.text_value) {
        const parsed = parseFloat(field.text_value);
        return isNaN(parsed) ? 0 : parsed;
      }
      if (field.display_value) {
        const parsed = parseFloat(field.display_value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const notasEstudiantes = estudiantes.map(estudiante => {
      const modulo1 = getCustomFieldValue(estudiante, 'Módulo 1');
      const modulo2 = getCustomFieldValue(estudiante, 'Módulo 2');
      const modulo3 = getCustomFieldValue(estudiante, 'Módulo 3');
      const modulo4 = getCustomFieldValue(estudiante, 'Módulo 4');
      const modulo5 = getCustomFieldValue(estudiante, 'Módulo 5');
      const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;
      
      return {
        nombre: estudiante.name,
        modulo1,
        modulo2,
        modulo3,
        modulo4,
        modulo5,
        total: parseFloat(total.toFixed(2))
      };
    });

    const calcularPromedioModulo = (moduloKey: string): number => {
      if (notasEstudiantes.length === 0) return 0;
      const suma = notasEstudiantes.reduce((acc: number, est: any) => acc + est[moduloKey], 0);
      return parseFloat((suma / notasEstudiantes.length).toFixed(2));
    };

    // Preparar datos para la tabla
    const tableBody = notasEstudiantes.map(est => [
      est.nombre,
      est.modulo1.toFixed(2),
      est.modulo2.toFixed(2),
      est.modulo3.toFixed(2),
      est.modulo4.toFixed(2),
      est.modulo5.toFixed(2),
      est.total.toFixed(2)
    ]);

    // Agregar fila de promedios
    tableBody.push([
      'PROMEDIO GENERAL',
      calcularPromedioModulo('modulo1').toFixed(2),
      calcularPromedioModulo('modulo2').toFixed(2),
      calcularPromedioModulo('modulo3').toFixed(2),
      calcularPromedioModulo('modulo4').toFixed(2),
      calcularPromedioModulo('modulo5').toFixed(2),
      calcularPromedioModulo('total').toFixed(2)
    ]);

    autoTable(pdf, {
      head: [['Estudiante', 'Modulo 1', 'Modulo 2', 'Modulo 3', 'Modulo 4', 'Modulo 5', 'Promedio']],
      body: tableBody,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'striped',
      headStyles: {
        fillColor: colors.navyBlue,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 5
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle',
        textColor: [45, 45, 45],
        lineColor: [230, 230, 230],
        lineWidth: 0.1
      },
      bodyStyles: {
        fillColor: colors.white
      },
      alternateRowStyles: {
        fillColor: colors.ultraLightGray
      },
      columnStyles: {
        0: { cellWidth: 45, halign: 'left' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      }
    });

    // ============ NOTA INFORMATIVA ============
    const finalY = (pdf as any).lastAutoTable.finalY + 8;
    if (finalY < pageHeight - 35) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      pdf.text('Nota: Las calificaciones >= 51 se consideran aprobadas y < 51 reprobadas.', margins.left, finalY);
      pdf.text(`Total de estudiantes: ${estudiantes.length}`, margins.left, finalY + 4);
    }

    // ============ PIE DE PÁGINA ============
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    const footerText = `Promedio General del Diplomado: ${calcularPromedioModulo('total').toFixed(2)}`;
    pdf.text(footerText, pageWidth / 2, pageHeight - margins.bottom + 5, { align: 'center' });

    // Abrir en nuevo tab
    pdf.output('dataurlnewwindow');
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
        <button
          className="button-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
        >
          + Crear Diplomado
        </button>
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
                      )}
                      <button
                        onClick={generarReporteDiplomado}
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
                              <td style={{ padding: '0.5rem' }}>{docente.name}</td>
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
                              <td style={{ padding: '0.5rem' }}>{estudiante.name}</td>
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
              onClick={generarReporteCentralizadorNotas}
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
                    const getCustomFieldValue = (task: AsanaTask, fieldName: string): number => {
                      if (!task.custom_fields) return 0;
                      const field = task.custom_fields.find(f => f.name === fieldName);
                      if (!field) return 0;
                      if (field.number_value !== undefined && field.number_value !== null) {
                        return field.number_value;
                      }
                      if (field.text_value) {
                        const parsed = parseFloat(field.text_value);
                        return isNaN(parsed) ? 0 : parsed;
                      }
                      if (field.display_value) {
                        const parsed = parseFloat(field.display_value);
                        return isNaN(parsed) ? 0 : parsed;
                      }
                      return 0;
                    };

                    const notasEstudiantes = estudiantes.map(estudiante => {
                      const modulo1 = getCustomFieldValue(estudiante, 'Módulo 1');
                      const modulo2 = getCustomFieldValue(estudiante, 'Módulo 2');
                      const modulo3 = getCustomFieldValue(estudiante, 'Módulo 3');
                      const modulo4 = getCustomFieldValue(estudiante, 'Módulo 4');
                      const modulo5 = getCustomFieldValue(estudiante, 'Módulo 5');
                      const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;
                      
                      return {
                        nombre: estudiante.name,
                        modulo1,
                        modulo2,
                        modulo3,
                        modulo4,
                        modulo5,
                        total: parseFloat(total.toFixed(2))
                      };
                    });

                    const calcularPromedioModulo = (moduloKey: string): number => {
                      if (notasEstudiantes.length === 0) return 0;
                      const suma = notasEstudiantes.reduce((acc: number, est: any) => acc + est[moduloKey], 0);
                      return parseFloat((suma / notasEstudiantes.length).toFixed(2));
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
                              {estudiante.nombre}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo1 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo1.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo2 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo2.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo3 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo3.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo4 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo4.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo5 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo5.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '1rem',
                              backgroundColor: estudiante.total >= 51 ? '#d1fae5' : '#fee2e2',
                              color: estudiante.total >= 51 ? '#065f46' : '#991b1b'
                            }}>
                              {estudiante.total.toFixed(2)}
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
                            {calcularPromedioModulo('modulo1').toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo2').toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo3').toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo4').toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo5').toFixed(2)}
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center',
                            backgroundColor: '#90caf9',
                            color: '#0d47a1',
                            fontSize: '1.1rem'
                          }}>
                            {calcularPromedioModulo('total').toFixed(2)}
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
              width: '90%'
            }}
          >
            <div className="modal-header">
              <h2>📊 Notas del Estudiante</h2>
              <button className="modal-close" onClick={() => setEstudianteSeleccionadoNotas(null)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1565c0', fontSize: '1.2rem' }}>
                {estudianteSeleccionadoNotas.name}
              </h3>

              {(() => {
                const getCustomFieldValue = (task: AsanaTask, fieldName: string): number => {
                  if (!task.custom_fields) return 0;
                  const field = task.custom_fields.find(f => f.name === fieldName);
                  if (!field) return 0;
                  if (field.number_value !== undefined && field.number_value !== null) {
                    return field.number_value;
                  }
                  if (field.text_value) {
                    const parsed = parseFloat(field.text_value);
                    return isNaN(parsed) ? 0 : parsed;
                  }
                  if (field.display_value) {
                    const parsed = parseFloat(field.display_value);
                    return isNaN(parsed) ? 0 : parsed;
                  }
                  return 0;
                };

                const modulo1 = getCustomFieldValue(estudianteSeleccionadoNotas, 'Módulo 1');
                const modulo2 = getCustomFieldValue(estudianteSeleccionadoNotas, 'Módulo 2');
                const modulo3 = getCustomFieldValue(estudianteSeleccionadoNotas, 'Módulo 3');
                const modulo4 = getCustomFieldValue(estudianteSeleccionadoNotas, 'Módulo 4');
                const modulo5 = getCustomFieldValue(estudianteSeleccionadoNotas, 'Módulo 5');
                const promedio = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;

                return (
                  <div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #90caf9', width: '40%' }}>
                            Módulo
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #90caf9', width: '20%' }}>
                            Nota
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #90caf9', width: '40%' }}>
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
                            <td style={{ padding: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {modulo.nombre}
                            </td>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '1.1rem',
                              color: modulo.nota >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {modulo.nota.toFixed(2)}
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
                            {promedio.toFixed(2)}
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
                {estudianteSeleccionadoAsistencia.name}
              </h3>

              {(() => {
                const notas = estudianteSeleccionadoAsistencia.notes || '';
                const registros: { fecha: string; asistio: boolean; observaciones: string }[] = [];

                if (notas.includes('=== REGISTRO DE ASISTENCIA ===')) {
                  const [, parteDespues] = notas.split('=== REGISTRO DE ASISTENCIA ===');
                  const lineas = parteDespues.split('\n').filter(linea => linea.trim());

                  lineas.forEach(linea => {
                    const matchFecha = linea.match(/^(\d{2}\/\d{2}\/\d{4})/);
                    const matchAsistio = linea.match(/Asistió:\s*(Sí|No)/i);
                    const matchObservaciones = linea.match(/Observaciones:\s*(.+)$/i);

                    if (matchFecha) {
                      registros.push({
                        fecha: matchFecha[1],
                        asistio: matchAsistio ? matchAsistio[1].toLowerCase() === 'sí' : false,
                        observaciones: matchObservaciones ? matchObservaciones[1].trim() : 'Ninguna'
                      });
                    }
                  });
                }

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

      {/* Modal de Creación */}
      {showCreateModal && (
        <CreateDiplomadoModal
          projectGid={diplomadosProjectGid}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
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
      {showAsistenciaModal && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '800px', 
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div className="modal-header">
              <h2>✓ Registro de Asistencia</h2>
              <button className="modal-close" onClick={() => setShowAsistenciaModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
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

              <div style={{ overflowX: 'auto' }}>
                <table className="table-container" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem', width: '40%' }}>Estudiante</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', width: '15%' }}>Asistió</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', width: '45%' }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.map((asistencia) => (
                      <tr key={asistencia.gid}>
                        <td style={{ padding: '0.75rem' }}>
                          {asistencia.nombre}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={asistencia.asistio}
                            onChange={(e) => handleCambiarAsistencia(asistencia.gid, 'asistio', e.target.checked)}
                            style={{ 
                              width: '20px', 
                              height: '20px',
                              cursor: 'pointer'
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
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.9rem'
                            }}
                          />
                        </td>
                      </tr>
                    ))}
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

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee' }}>
              <button
                onClick={() => setShowAsistenciaModal(false)}
                className="button-secondary"
                disabled={loadingAsistencia}
                style={{ marginRight: '1rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarAsistencias}
                className="button-primary"
                disabled={loadingAsistencia || asistencias.length === 0}
              >
                {loadingAsistencia ? 'Guardando...' : '💾 Guardar Asistencia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiplomadosPage;
