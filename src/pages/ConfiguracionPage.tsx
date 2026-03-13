import React, { useState } from 'react';
import exportService from '../services/export.service';
import config from '../config/env';

const ConfiguracionPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [stats, setStats] = useState<{ success: number; failed: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const workspaceGid = config.asanaWorkspaceId || '';

  const addProgressMessage = (message: string) => {
    setProgress(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleExportAll = async () => {
    if (!workspaceGid) {
      alert('No se ha configurado el ID del workspace CDIMA. Por favor, verifica la configuración.');
      return;
    }

    // Confirmar acción
    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas exportar TODOS los proyectos del workspace CDIMA?\n\n' +
      'Esto generará un archivo CSV por cada proyecto y puede tomar varios minutos.'
    );

    if (!confirmacion) {
      return;
    }

    // Limpiar estado previo
    setProgress([]);
    setStats(null);
    setErrors([]);
    setExporting(true);

    try {
      addProgressMessage('🚀 Iniciando exportación masiva de proyectos...');

      const result = await exportService.exportAllProjects(
        workspaceGid,
        // Callback de progreso
        (message: string) => {
          addProgressMessage(message);
        },
        // Callback cuando se completa un proyecto
        (projectName: string, index: number, total: number) => {
          addProgressMessage(`✓ Completado (${index}/${total}): ${projectName}`);
        }
      );

      // Actualizar estadísticas
      setStats({
        success: result.success,
        failed: result.failed,
        total: result.success + result.failed
      });

      setErrors(result.errors);

      if (result.failed === 0) {
        addProgressMessage('\n🎉 ¡Todos los proyectos se exportaron exitosamente!');
      } else {
        addProgressMessage(`\n⚠️ Se completó con ${result.failed} errores. Revisa los detalles abajo.`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addProgressMessage(`\n❌ Error fatal: ${errorMessage}`);
      setErrors([errorMessage]);
    } finally {
      setExporting(false);
      addProgressMessage('\n✓ Proceso finalizado');
    }
  };

  const handleClearLog = () => {
    setProgress([]);
    setStats(null);
    setErrors([]);
  };

  return (
    <div className="planning-page">
      {/* Header */}
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">⚙️</div>
          <div className="planning-info">
            <h1 className="planning-title">Configuración</h1>
            <p className="planning-subtitle">
              Exportación y gestión de proyectos Asana
            </p>
          </div>
        </div>
      </div>

      {/* Sección de Exportación */}
      <div className="card">
        <div style={{ 
          padding: '1.5rem',
          borderBottom: '2px solid #e0e0e0',
          backgroundColor: '#f8f9fa'
        }}>
          <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.5rem' }}>
            📤 Exportación de Proyectos
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
            Exporta todos los proyectos del workspace CDIMA a archivos CSV compatibles con Asana
          </p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Información del workspace */}
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '6px',
            borderLeft: '4px solid #2196f3',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#1565c0', marginBottom: '0.5rem' }}>
              <strong>📌 Workspace configurado:</strong>
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#424242', fontFamily: 'monospace' }}>
              {workspaceGid || 'No configurado'}
            </p>
          </div>

          {/* Botón de exportación */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={handleExportAll}
              disabled={exporting || !workspaceGid}
              className="button-primary"
              style={{
                fontSize: '1rem',
                padding: '1rem 2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                opacity: (exporting || !workspaceGid) ? 0.6 : 1,
                cursor: (exporting || !workspaceGid) ? 'not-allowed' : 'pointer'
              }}
            >
              {exporting ? (
                <>
                  <span className="spinner" style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></span>
                  Exportando proyectos...
                </>
              ) : (
                <>
                  📥 Exportar Todos los Proyectos
                </>
              )}
            </button>
          </div>

          {/* Información sobre la exportación */}
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fff3e0', 
            borderRadius: '6px',
            borderLeft: '4px solid #ff9800',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#e65100', marginBottom: '0.75rem' }}>
              <strong>ℹ️ Sobre la exportación:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#424242', lineHeight: '1.6' }}>
              <li>Se generará un archivo CSV por cada proyecto del workspace</li>
              <li>Cada CSV incluye: nombres, notas, asignados, fechas, campos personalizados, subtareas, etc.</li>
              <li>Los archivos son compatibles con la función de importación de Asana</li>
              <li>El proceso puede tardar varios minutos dependiendo del número de proyectos</li>
              <li>Los archivos se descargarán automáticamente a tu carpeta de Descargas</li>
            </ul>
          </div>

          {/* Estadísticas */}
          {stats && (
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
                  Total Proyectos
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1565c0' }}>
                  {stats.total}
                </div>
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#d1fae5',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                  Exitosos
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#27AE60' }}>
                  {stats.success}
                </div>
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#fee2e2',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                  Fallidos
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E74C3C' }}>
                  {stats.failed}
                </div>
              </div>
            </div>
          )}

          {/* Errores */}
          {errors.length > 0 && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              borderLeft: '4px solid #E74C3C',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                ❌ Errores encontrados:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.6' }}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Log de progreso */}
          {progress.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>
                  📋 Registro de Actividad
                </h3>
                <button
                  onClick={handleClearLog}
                  className="button-secondary"
                  disabled={exporting}
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1rem'
                  }}
                >
                  🗑️ Limpiar Log
                </button>
              </div>
              <div style={{
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                padding: '1rem',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                maxHeight: '400px',
                overflowY: 'auto',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {progress.map((msg, index) => (
                  <div key={index} style={{
                    color: msg.includes('✓') ? '#4ade80' :
                           msg.includes('✗') || msg.includes('❌') ? '#f87171' :
                           msg.includes('⚠️') ? '#fbbf24' :
                           msg.includes('🎉') ? '#60a5fa' :
                           '#d4d4d4'
                  }}>
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estilos para la animación del spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ConfiguracionPage;
