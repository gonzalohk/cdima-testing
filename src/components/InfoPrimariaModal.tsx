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
        style={{ maxWidth: '450px', padding: 0 }}
      >
        <HtmlModalHeader icon="📋" title="Información Primaria" subtitle={`${tipo}: ${nombre}`} onClose={onClose} />

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Documento de Identidad
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {documentoIdentidad || 'No especificado'}
              </p>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Género
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {genero || 'No especificado'}
              </p>
            </div>

            {cargo !== undefined ? (
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: '#666', 
                  textTransform: 'uppercase',
                  marginBottom: '0.25rem',
                  letterSpacing: '0.5px'
                }}>
                  Cargo
                </label>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.95rem', 
                  color: '#333',
                  padding: '0.5rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  {cargo || 'No especificado'}
                </p>
              </div>
            ) : especialidad !== undefined ? (
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: '#666', 
                  textTransform: 'uppercase',
                  marginBottom: '0.25rem',
                  letterSpacing: '0.5px'
                }}>
                  Especialidad
                </label>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.95rem', 
                  color: '#333',
                  padding: '0.5rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  {especialidad || 'No especificado'}
                </p>
              </div>
            ) : null}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Lugar de Nacimiento
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {lugarNacimiento || 'No especificado'}
              </p>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Fecha de Nacimiento
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {fechaNacimiento || 'No especificado'}
              </p>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Identidad Cultural
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {identidadCultural || 'No especificado'}
              </p>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                Teléfono
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {telefono || 'No especificado'}
              </p>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#666', 
                textTransform: 'uppercase',
                marginBottom: '0.25rem',
                letterSpacing: '0.5px'
              }}>
                {comunidad !== undefined ? 'Comunidad' : 'Domicilio'}
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {(comunidad ?? domicilio) || 'No especificado'}
              </p>
            </div>
          </div>
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
