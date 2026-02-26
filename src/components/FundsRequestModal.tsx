import React, { useState } from 'react';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';

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
  const [subArea, setSubArea] = useState('');
  const [lugar, setLugar] = useState('');
  const [fechaNecesaria, setFechaNecesaria] = useState('');
  const [fondos, setFondos] = useState<FundItem[]>([
    { id: 1, descripcion: '', importeBolivianos: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      if (!subArea.trim()) {
        throw new Error('La sub área es obligatoria');
      }
      if (!lugar.trim()) {
        throw new Error('El lugar es obligatorio');
      }
      if (!fechaNecesaria) {
        throw new Error('La fecha necesaria es obligatoria');
      }

      // Validar que haya al menos un fondo con descripción
      const fondosValidos = fondos.filter(f => f.descripcion.trim());
      if (fondosValidos.length === 0) {
        throw new Error('Debe agregar al menos un ítem de fondos');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `SOLICITUD DE FONDOS - ${task.name}`;

      // Construir las notas con toda la información
      const fechaSolicitud = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

      const notes = `SOLICITUD DE FONDOS

Actividad: ${task.name}

INFORMACIÓN GENERAL:
• Área: ${area}
• Sub Área: ${subArea}
• Lugar de entrega: ${lugar}
• Fecha necesaria: ${new Date(fechaNecesaria).toLocaleDateString('es-ES')}
• Fecha de solicitud: ${fechaSolicitud}

FONDOS SOLICITADOS:
${fondosTexto}

TOTAL: Bs. ${totalBolivianos.toFixed(2)}

---
Solicitud generada automáticamente desde el sistema de reportes CDIMA`;

      // Obtener el workspace del primer proyecto de la tarea
      const workspaceGid = task.projects?.[0]?.workspace?.gid;
      if (!workspaceGid) {
        throw new Error('No se pudo obtener el workspace de la tarea');
      }

      // Crear la subtarea
      await asanaService.createSubtask(task.gid, workspaceGid, {
        name: subtaskName,
        notes: notes,
        due_on: fechaNecesaria
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
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
              <strong>Actividad:</strong> {task.name}
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>Información General</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
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
              
              <div>
                <label className="form-label">Sub Área *</label>
                <input
                  type="text"
                  className="form-input"
                  value={subArea}
                  onChange={(e) => setSubArea(e.target.value)}
                  required
                  placeholder="Ej: Logística"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
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
              
              <div>
                <label className="form-label">Fecha Necesaria *</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaNecesaria}
                  onChange={(e) => setFechaNecesaria(e.target.value)}
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
  );
};

export default FundsRequestModal;
