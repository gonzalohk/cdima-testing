import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import CreateDiplomadoModal from '../components/CreateDiplomadoModal';
import InfoPrimariaModal from '../components/InfoPrimariaModal';

interface InfoPrimaria {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  documentoIdentidad: string;
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

  const handleDeleteDiplomado = async (sectionGid: string, diplomadoName: string) => {
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
  };

  const parseInfoPrimaria = (task: AsanaTask, tipo: 'Docente' | 'Estudiante'): InfoPrimaria => {
    const notas = task.notes || '';
    const info: InfoPrimaria = {
      nombre: task.name,
      genero: '',
      telefono: '',
      lugarNacimiento: '',
      documentoIdentidad: '',
      tipo
    };

    // Parsear las notas para extraer la información
    const generoMatch = notas.match(/Género:\s*(.+)/i);
    const telefonoMatch = notas.match(/Teléfono:\s*(.+)/i);
    const lugarMatch = notas.match(/Lugar de Nacimiento:\s*(.+)/i);
    const documentoMatch = notas.match(/Documento de Identidad:\s*(.+)/i);

    if (generoMatch) info.genero = generoMatch[1].trim();
    if (telefonoMatch) info.telefono = telefonoMatch[1].trim();
    if (lugarMatch) info.lugarNacimiento = lugarMatch[1].trim();
    if (documentoMatch) info.documentoIdentidad = documentoMatch[1].trim();

    return info;
  };

  const handleShowInfo = (task: AsanaTask, tipo: 'Docente' | 'Estudiante') => {
    const info = parseInfoPrimaria(task, tipo);
    setSelectedInfo(info);
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
                          <button
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
                          </button>
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
                  {/* Primera fila: Docentes y Documentos */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    {/* Docentes */}
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        marginBottom: '1rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '2px solid #e0e0e0'
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>👨‍🏫</span>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                          Docentes ({docentes.length})
                        </h3>
                      </div>
                      {docentes.length === 0 ? (
                        <p style={{ color: '#999', fontStyle: 'italic' }}>No hay docentes registrados</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {docentes.map((docente) => (
                            <li 
                              key={docente.gid}
                              style={{
                                padding: '0.75rem',
                                marginBottom: '0.5rem',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '6px',
                                borderLeft: '3px solid #2196F3',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{ 
                                color: docente.completed ? '#4caf50' : '#999',
                                fontSize: '1rem'
                              }}>
                                {docente.completed ? '✓' : '○'}
                              </span>
                              <span style={{ 
                                flex: 1,
                                textDecoration: docente.completed ? 'line-through' : 'none',
                                color: docente.completed ? '#666' : '#333'
                              }}>
                                {docente.name}
                              </span>
                              <button
                                onClick={() => handleShowInfo(docente, 'Docente')}
                                style={{
                                  background: 'none',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  color: '#666',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  transition: 'all 0.2s'
                                }}
                                title="Ver información primaria"
                                onMouseOver={(e) => {
                                  e.currentTarget.style.borderColor = '#2196F3';
                                  e.currentTarget.style.color = '#2196F3';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.borderColor = '#ddd';
                                  e.currentTarget.style.color = '#666';
                                }}
                              >
                                <span style={{ fontSize: '0.85rem' }}>ℹ️</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Info</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Documentos */}
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        marginBottom: '1rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '2px solid #e0e0e0'
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>📄</span>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                          Documentos ({documentos.length})
                        </h3>
                      </div>
                      {documentos.length === 0 ? (
                        <p style={{ color: '#999', fontStyle: 'italic' }}>No hay documentos registrados</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {documentos.map((documento) => (
                            <li 
                              key={documento.gid}
                              style={{
                                padding: '0.75rem',
                                marginBottom: '0.5rem',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '6px',
                                borderLeft: '3px solid #2196F3',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{ 
                                color: documento.completed ? '#4caf50' : '#999',
                                fontSize: '1rem'
                              }}>
                                {documento.completed ? '✓' : '○'}
                              </span>
                              <span style={{ 
                                flex: 1,
                                textDecoration: documento.completed ? 'line-through' : 'none',
                                color: documento.completed ? '#666' : '#333'
                              }}>
                                {documento.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Segunda fila: Estudiantes (ocupa todo el ancho) */}
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>👨‍🎓</span>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                        Estudiantes ({estudiantes.length})
                      </h3>
                    </div>
                    {estudiantes.length === 0 ? (
                      <p style={{ color: '#999', fontStyle: 'italic' }}>No hay estudiantes registrados</p>
                    ) : (
                      <ul style={{ 
                        listStyle: 'none', 
                        padding: 0, 
                        margin: 0,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '0.5rem'
                      }}>
                        {estudiantes.map((estudiante) => (
                          <li 
                            key={estudiante.gid}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '6px',
                              borderLeft: '3px solid #2196F3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            <span style={{ 
                              color: estudiante.completed ? '#4caf50' : '#999',
                              fontSize: '1rem'
                            }}>
                              {estudiante.completed ? '✓' : '○'}
                            </span>
                            <span style={{ 
                              flex: 1,
                              textDecoration: estudiante.completed ? 'line-through' : 'none',
                              color: estudiante.completed ? '#666' : '#333'
                            }}>
                              {estudiante.name}
                            </span>
                            <button
                              onClick={() => handleShowInfo(estudiante, 'Estudiante')}
                              style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                transition: 'all 0.2s'
                              }}
                              title="Ver información primaria"
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#2196F3';
                                e.currentTarget.style.color = '#2196F3';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#ddd';
                                e.currentTarget.style.color = '#666';
                              }}
                            >
                              <span style={{ fontSize: '0.85rem' }}>ℹ️</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Info</span>
                            </button>
                          </li>
                        ))}
                      </ul>
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
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 6
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #bbdefb', fontWeight: 600 }}>
                      Módulo 7
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
                      const modulo6 = getCustomFieldValue(estudiante, 'Módulo 6');
                      const modulo7 = getCustomFieldValue(estudiante, 'Módulo 7');
                      const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5 + modulo6 + modulo7) / 7;
                      
                      return {
                        nombre: estudiante.name,
                        modulo1,
                        modulo2,
                        modulo3,
                        modulo4,
                        modulo5,
                        modulo6,
                        modulo7,
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
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo6 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo6.toFixed(2)}
                            </td>
                            <td style={{ 
                              padding: '0.875rem 1rem', 
                              textAlign: 'center',
                              borderRight: '1px solid #dee2e6',
                              fontWeight: 500,
                              color: estudiante.modulo7 >= 51 ? '#27AE60' : '#E74C3C'
                            }}>
                              {estudiante.modulo7.toFixed(2)}
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
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo6').toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid #64b5f6' }}>
                            {calcularPromedioModulo('modulo7').toFixed(2)}
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
                "Módulo 1" a "Módulo 7" de cada estudiante. El promedio se calcula automáticamente 
                sumando las 7 notas y dividiendo entre 7. Las notas ≥ 51 se muestran en verde (aprobado) 
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
          tipo={selectedInfo.tipo}
          onClose={() => setSelectedInfo(null)}
        />
      )}
    </div>
  );
};

export default DiplomadosPage;
