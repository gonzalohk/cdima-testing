import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF } from '../services/pdf.service';
import Notification from './Notification';

interface FundItem {
  id: number;
  descripcion: string;
  importeBolivianos: string;
}

interface FundsRequestModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}

const FundsRequestModal: React.FC<FundsRequestModalProps> = ({ task, onClose, onSuccess }) => {
  const [area, setArea] = useState('');
  const [titulo, setTitulo] = useState(task.name);
  const [lugar, setLugar] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinalizacion, setFechaFinalizacion] = useState('');
  const [fondos, setFondos] = useState<FundItem[]>([
    { id: 1, descripcion: '', importeBolivianos: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const agregarFondo = () => {
    const newId = Math.max(...fondos.map(f => f.id), 0) + 1;
    setFondos([...fondos, { id: newId, descripcion: '', importeBolivianos: '' }]);
  };

  const eliminarFondo = (id: number) => {
    if (fondos.length > 1) {
      setFondos(fondos.filter(f => f.id !== id));
    }
  };

  const actualizarFondo = (id: number, campo: keyof FundItem, valor: string) => {
    setFondos(fondos.map(f => 
      f.id === id ? { ...f, [campo]: valor } : f
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

      // Validar que haya al menos un fondo con descripción
      const fondosValidos = fondos.filter(f => f.descripcion.trim());
      if (fondosValidos.length === 0) {
        throw new Error('Debe agregar al menos un ítem de fondos');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `SOLICITUD DE FONDOS - ${titulo}`;

      // Construir las notas con toda la información
      const fechaSolicitud = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz'
      });

      // Calcular total
      const totalBolivianos = fondosValidos.reduce((sum, f) => {
        const importe = parseFloat(f.importeBolivianos) || 0;
        return sum + importe;
      }, 0);

      const fondosTexto = fondosValidos.map((f, index) => 
        `${index + 1}. ${f.descripcion}
   Importe: Bs. ${f.importeBolivianos || '0'}`
      ).join('\n\n');

      const fechaInicioStr = new Date(fechaInicio).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });
      const fechaFinalizacionStr = new Date(fechaFinalizacion).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });

      const jsonData = {
        tipo: 'Solicitud de Fondos',
        titulo,
        area,
        lugar,
        fechaInicio: fechaInicioStr,
        fechaFinalizacion: fechaFinalizacionStr,
        fechaSolicitud,
        fechaAprobacion: '',
        totalBolivianos: parseFloat(totalBolivianos.toFixed(2)),
        fondos: fondosValidos.map(({ id, descripcion, importeBolivianos }) => ({
          id, descripcion,
          importeBolivianos: importeBolivianos || '0',
        })),
      };

      const notes = `SOLICITUD DE FONDOS

Actividad: ${titulo}

INFORMACIÓN GENERAL:
• Área: ${area}
• Lugar de entrega: ${lugar}
• Fecha de inicio: ${fechaInicioStr}
• Fecha de finalización: ${fechaFinalizacionStr}
• Fecha de solicitud: ${fechaSolicitud}

FONDOS SOLICITADOS:
${fondosTexto}

TOTAL: Bs. ${totalBolivianos.toFixed(2)}

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
        // Buscar el enum_value para "Solicitud de Fondos"
        const solicitudFondosValue = tipoSolicitudField.enum_options?.find(
          option => option.name === 'Solicitud de Fondos'
        );
        
        if (solicitudFondosValue?.gid) {
          customFields[tipoSolicitudField.gid] = solicitudFondosValue.gid;
        }
      }

      // Crear la subtarea
      await asanaService.createSubtask(task.gid, workspaceGid, {
        name: subtaskName,
        notes: notes,
        due_on: fechaFinalizacion,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
      });

      setNotification({ message: '¡Solicitud de fondos creada exitosamente!', type: 'success' });
      
      // Generar PDF automáticamente
      setTimeout(() => {
        exportFundsRequestToPDF({
          taskName: titulo,
          area,
          lugar,
          fechaInicio,
          fechaFinalizacion,
          fondos: fondosValidos
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
          <h2>Solicitud de Fondos</h2>
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
              <label className="form-label">Lugar de Entrega *</label>
              <input
                type="text"
                className="form-input"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                required
                placeholder="Ej: Oficina Central"
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

            <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.1rem' }}>Fondos Solicitados</h3>
            
            {fondos.map((fondo, index) => (
              <div key={fondo.id} style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <strong>Ítem {index + 1}</strong>
                  {fondos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarFondo(fondo.id)}
                      className="button"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', color: '#dc3545' }}
                    >
                      ✕ Eliminar
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Descripción *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={fondo.descripcion}
                      onChange={(e) => actualizarFondo(fondo.id, 'descripcion', e.target.value)}
                      required
                      placeholder="Descripción del gasto"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">Importe (Bs.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={fondo.importeBolivianos}
                      onChange={(e) => actualizarFondo(fondo.id, 'importeBolivianos', e.target.value)}
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={agregarFondo}
              className="button"
              style={{ width: '100%', marginTop: '0.5rem', marginBottom: '1rem' }}
            >
              ➕ Agregar Ítem
            </button>

            {fondos.filter(f => f.importeBolivianos).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '4px', textAlign: 'right' }}>
                <strong>Total: Bs. {fondos.reduce((sum, f) => sum + (parseFloat(f.importeBolivianos) || 0), 0).toFixed(2)}</strong>
              </div>
            )}
          </div>

          <div className="modal-footer">
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

export default FundsRequestModal;
