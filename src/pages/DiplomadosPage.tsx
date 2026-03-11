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

const DiplomadosPage: React.FC = () => {
  const navigate = useNavigate();
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDiplomado, setSelectedDiplomado] = useState<AsanaSection | null>(null);
  const [diplomadosProjectGid, setDiplomadosProjectGid] = useState<string>('');
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<InfoPrimaria | null>(null);
  
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
                  {/* Botón Ver Listado */}
                  {(estudiantes.length > 0 || docentes.length > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
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
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: '80px' }}>Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estudiantes.map((estudiante) => (
                            <tr key={estudiante.gid}>
                              <td style={{ padding: '0.5rem' }}>{estudiante.name}</td>
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

              {/* Botón Centralizador de Notas - Esquina inferior derecha */}
              {estudiantes.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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
    </div>
  );
};

export default DiplomadosPage;
