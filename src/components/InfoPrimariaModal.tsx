import React from 'react';
import { HtmlModalHeader } from './ModalShared';

interface InfoPrimariaModalProps {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  domicilio: string;
  especialidad?: string;
  cargo?: string;
  comunidad?: string;
  documentoIdentidad: string;
  identidadCultural: string;
  tipo: 'Docente' | 'Estudiante';
  onClose: () => void;
}

const InfoPrimariaModal: React.FC<InfoPrimariaModalProps> = ({
  nombre,
  genero,
  telefono,
  lugarNacimiento,
  fechaNacimiento,
  domicilio,
  especialidad,
  cargo,
  comunidad,
  documentoIdentidad,
  identidadCultural,
  tipo,
  onClose
}) => {
  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ zIndex: 1001 }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', padding: 0 }}
      >
        <HtmlModalHeader icon="📋" title="Información Primaria" subtitle={`${tipo}: ${nombre}`} onClose={onClose} />

        <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
          {/* Avatar + nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ width: '62px', height: '62px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#1e3a5f', flexShrink: 0 }}>
              {nombre.split(' ').filter((w: string) => w.length > 0).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a5f', wordBreak: 'break-word', lineHeight: 1.3 }}>{nombre}</div>
              <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: tipo === 'Docente' ? '#dbeafe' : '#d1fae5', color: tipo === 'Docente' ? '#1e40af' : '#065f46', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>{tipo}</span>
            </div>
          </div>

          {/* Campos – 2 columnas */}
          {(() => {
            const fields: { icon: string; label: string; value?: string }[] = [
              { icon: '📑', label: 'Doc. Identidad', value: documentoIdentidad },
              { icon: '👤', label: 'Género', value: genero },
            ];
            if (cargo !== undefined) fields.push({ icon: '💼', label: 'Cargo', value: cargo });
            else if (especialidad !== undefined) fields.push({ icon: '🎓', label: 'Especialidad', value: especialidad });
            fields.push(
              { icon: '🎂', label: 'Fecha Nacimiento', value: fechaNacimiento },
              { icon: '📍', label: 'Lugar Nacimiento', value: lugarNacimiento },
              { icon: '📞', label: 'Teléfono', value: telefono },
              { icon: '🌿', label: 'Identidad Cultural', value: identidadCultural },
              { icon: comunidad !== undefined ? '🏘️' : '🏠', label: comunidad !== undefined ? 'Comunidad' : 'Domicilio', value: comunidad ?? domicilio },
            );
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                {fields.map((field, i) => (
                  <div key={i}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: '0.2rem', letterSpacing: '0.5px' }}>
                      {field.icon} {field.label}
                    </label>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', padding: '0.4rem 0.6rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                      {field.value || '–'}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div 
          className="modal-footer"
          style={{ 
            borderTop: '1px solid #e0e0e0',
            padding: '1rem 1.5rem',
            backgroundColor: '#fafafa'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="button-primary"
            style={{ width: '100%' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoPrimariaModal;
