import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportMaterialRequestToPDF } from '../services/pdf.service';
import Notification from './Notification';

interface MaterialItem {
  id: number;
  detalle: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
}

interface MaterialRequestModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}

const MaterialRequestModal: React.FC<MaterialRequestModalProps> = ({ task, onClose, onSuccess }) => {
  const [area, setArea] = useState('');
  const [titulo, setTitulo] = useState(task.name);
  const [lugar, setLugar] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinalizacion, setFechaFinalizacion] = useState('');
  const [materiales, setMateriales] = useState<MaterialItem[]>([
    { id: 1, detalle: '', cantidad: '', unidad: '', observaciones: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const agregarMaterial = () => {
    const newId = Math.max(...materiales.map(m => m.id), 0) + 1;
    setMateriales([...materiales, { id: newId, detalle: '', cantidad: '', unidad: '', observaciones: '' }]);
  };

  const eliminarMaterial = (id: number) => {
    if (materiales.length > 1) {
      setMateriales(materiales.filter(m => m.id !== id));
    }
  };

  const actualizarMaterial = (id: number, campo: keyof MaterialItem, valor: string) => {
    setMateriales(materiales.map(m => 
      m.id === id ? { ...m, [campo]: valor } : m
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!area.trim()) {
        throw new Error('El área es obligatoria');
      }
      if (!lugar.trim()) {
        throw new Error('El lugar es obligatorio');
      }
      if (!fechaInicio) {
        throw new Error('La fecha de inicio es obligatoria');
      }
      if (!fechaFinalizacion) {
        throw new Error('La fecha de finalización es obligatoria');
      }
      if (new Date(fechaFinalizacion) < new Date(fechaInicio)) {
        throw new Error('La fecha de finalización debe ser posterior a la fecha de inicio');
      }

      // Validar que haya al menos un material con detalle
      const materialesValidos = materiales.filter(m => m.detalle.trim());
      if (materialesValidos.length === 0) {
        throw new Error('Debe agregar al menos un material');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `SMAT - ${titulo}`;

      // Construir las notas con toda la información
      const fechaSolicitud = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz'
      });

      const materialesTexto = materialesValidos.map((m, index) => 
        `${index + 1}. ${m.detalle}
   Cantidad: ${m.cantidad || '-'}
   Unidad: ${m.unidad || '-'}
   Observaciones: ${m.observaciones || '-'}`
      ).join('\n\n');

      const fechaInicioStr = new Date(fechaInicio).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });
      const fechaFinalizacionStr = new Date(fechaFinalizacion).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });

      const jsonData = {
        tipo: 'Solicitud de Material',
        titulo,
        area,
        lugar,
        fechaInicio: fechaInicioStr,
        fechaFinalizacion: fechaFinalizacionStr,
        fechaSolicitud,
        fechaAprobacion: '',
        materiales: materialesValidos.map(({ id, detalle, cantidad, unidad, observaciones }) => ({
          id, detalle,
          cantidad: cantidad || '-',
          unidad: unidad || '-',
          observaciones: observaciones || '-',
        })),
      };

      const notes = `SMAT

Actividad: ${titulo}

INFORMACIÓN GENERAL:
• Área: ${area}
• Lugar de entrega: ${lugar}
• Fecha de inicio: ${fechaInicioStr}
• Fecha de finalización: ${fechaFinalizacionStr}
• Fecha de solicitud: ${fechaSolicitud}

MATERIALES SOLICITADOS:
${materialesTexto}

---
Solicitud generada automáticamente desde el sistema de reportes CDIMA

===DATOS_JSON===
${JSON.stringify(jsonData, null, 2)}
===FIN_DATOS_JSON===`;

      // Obtener el workspace del primer proyecto de la tarea
      const workspaceGid = task.projects?.[0]?.workspace?.gid;
      if (!workspaceGid) {
        throw new Error('No se pudo obtener el workspace de la tarea');
      }

      // Buscar el campo personalizado "Tipo de Solicitud"
      const tipoSolicitudField = task.custom_fields?.find(
        field => field.name === 'Tipo de Solicitud'
      );
      
      // Preparar custom_fields si existe el campo
      const customFields: Record<string, string> = {};
      if (tipoSolicitudField?.gid) {
        // Buscar el enum_value para "Solicitud de Material"
        const solicitudMaterialValue = tipoSolicitudField.enum_options?.find(
          option => option.name === 'Solicitud de Material'
        );
        
        if (solicitudMaterialValue?.gid) {
          customFields[tipoSolicitudField.gid] = solicitudMaterialValue.gid;
        }
      }

      // Crear la subtarea
      await asanaService.createSubtask(task.gid, workspaceGid, {
        name: subtaskName,
        notes: notes,
        due_on: fechaFinalizacion,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
      });

      setNotification({ message: '¡Solicitud de material creada exitosamente!', type: 'success' });
      
      // Generar PDF automáticamente
      setTimeout(() => {
        exportMaterialRequestToPDF({
          taskName: titulo,
          area,
          lugar,
          fechaInicio,
          fechaFinalizacion,
          materiales: materialesValidos
        });
      }, 500);
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📦 Solicitud de Material</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}><strong>Título de la solicitud</strong></label>
              <input
                className="form-input"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>Información General</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Área *</label>
              <select
                className="form-input"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                required
              >
                <option value="">Seleccione un área</option>
                <option value="Erradicación de Violencia">Erradicación de Violencia</option>
                <option value="Empoderamiento Político">Empoderamiento Político</option>
                <option value="Empoderamiento Productivo">Empoderamiento Productivo</option>
                <option value="Administrativa y Financiera">Administrativa y Financiera</option>
                <option value="Comunicación">Comunicación</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Lugar del Evento *</label>
              <input
                type="text"
                className="form-input"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                required
                placeholder="Ej: Oficina principal"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Fecha de inicio *</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Fecha de finalización *</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaFinalizacion}
                  onChange={(e) => setFechaFinalizacion(e.target.value)}
                  required
                />
              </div>
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>Materiales Solicitados</h3>
            
            {materiales.map((material, index) => (
              <div key={material.id} style={{ 
                marginBottom: '1rem', 
                padding: '1rem', 
                border: '1px solid #dee2e6', 
                borderRadius: '4px',
                backgroundColor: '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Material {index + 1}</strong>
                  {materiales.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarMaterial(material.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc3545',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0 0.5rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.875rem' }}>Detalle *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={material.detalle}
                      onChange={(e) => actualizarMaterial(material.id, 'detalle', e.target.value)}
                      required
                      placeholder="Descripción del material"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label" style={{ fontSize: '0.875rem' }}>Cantidad</label>
                    <input
                      type="text"
                      className="form-input"
                      value={material.cantidad}
                      onChange={(e) => actualizarMaterial(material.id, 'cantidad', e.target.value)}
                      placeholder="Ej: 10"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label" style={{ fontSize: '0.875rem' }}>Unidad</label>
                    <input
                      type="text"
                      className="form-input"
                      value={material.unidad}
                      onChange={(e) => actualizarMaterial(material.id, 'unidad', e.target.value)}
                      placeholder="Ej: piezas"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="form-label" style={{ fontSize: '0.875rem' }}>Observaciones</label>
                  <textarea
                    className="form-input"
                    value={material.observaciones}
                    onChange={(e) => actualizarMaterial(material.id, 'observaciones', e.target.value)}
                    placeholder="Notas adicionales"
                    rows={2}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={agregarMaterial}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f8f9fa',
                border: '2px dashed #6c757d',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                color: '#6c757d',
                fontWeight: '500'
              }}
            >
              + Agregar otro material
            </button>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="button"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={loading}
            >
              {loading ? 'Creando solicitud...' : 'Crear Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default MaterialRequestModal;
