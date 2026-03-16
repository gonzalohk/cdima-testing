import React from 'react';

interface InfoPrimariaModalProps {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  domicilio: string;
  especialidad: string;
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
        <div 
          className="modal-header"
          style={{ 
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            padding: '1rem 1.5rem'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#333' }}>
              📋 Información Primaria
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
              {tipo}: {nombre}
            </p>
          </div>
          <button 
            className="modal-close" 
            onClick={onClose}
            style={{ fontSize: '1.5rem', color: '#999' }}
          >
            &times;
          </button>
        </div>

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
                Domicilio
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#333',
                padding: '0.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px'
              }}>
                {domicilio || 'No especificado'}
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
