import React, { useState } from 'react';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';
import { serializeEstudianteData } from '../utils/asana-helpers';
import { HtmlModalHeader } from './ModalShared';

interface AgregarPersonaModalProps {
  parentTaskGid: string;
  tipo: 'Estudiante' | 'Docente';
  parentName: string;
  useCargoLabel?: boolean; // true = "Cargo", false/omit = "Especialidad"
  onClose: () => void;
  onSuccess: () => void;
}

const AgregarPersonaModal: React.FC<AgregarPersonaModalProps> = ({
  parentTaskGid,
  tipo,
  parentName,
  useCargoLabel = false,
  onClose,
  onSuccess,
}) => {
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [genero, setGenero] = useState('');
  const [documentoIdentidad, setDocumentoIdentidad] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [lugarNacimiento, setLugarNacimiento] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [identidadCultural, setIdentidadCultural] = useState('');
  const [telefono, setTelefono] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim() || !apellidoPaterno.trim() || !apellidoMaterno.trim()) {
      setError('Nombre, apellido paterno y apellido materno son obligatorios');
      return;
    }
    if (!genero.trim()) {
      setError('El género es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontró el workspace CDIMA');

      const notas = serializeEstudianteData({
        genero,
        fechaNacimiento: fechaNacimiento || '',
        especialidad: especialidad || '',
        domicilio: domicilio || '',
        telefono: telefono || '',
        lugarNacimiento: lugarNacimiento || '',
        documentoIdentidad: documentoIdentidad || '',
        identidadCultural: identidadCultural || '',
      });

      const nombreCompleto = `${nombre.trim()}, ${apellidoPaterno.trim()}, ${apellidoMaterno.trim()}`;
      await asanaService.createSubtask(parentTaskGid, cdima.gid, {
        name: nombreCompleto,
        notes: notas,
      });

      setNotification({ message: `${tipo} agregado exitosamente`, type: 'success' });
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al agregar ${tipo.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const labelEspecialidad = useCargoLabel ? 'Cargo' : 'Especialidad';
  const icon = tipo === 'Docente' ? '👨‍🏫' : '👨‍🎓';

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="modal-overlay">
        <div
          className="modal-content"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <HtmlModalHeader
            icon={icon}
            title={`Agregar ${tipo}`}
            subtitle={parentName}
            onClose={onClose}
          />

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Nombre <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Gonzalo"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Apellido Paterno <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={apellidoPaterno}
                    onChange={e => setApellidoPaterno(e.target.value)}
                    placeholder="Ej: Osco"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Apellido Materno <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={e => setApellidoMaterno(e.target.value)}
                    placeholder="Ej: Hernandez"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Género <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={genero}
                    onChange={e => setGenero(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Documento de Identidad
                  </label>
                  <input
                    type="text"
                    value={documentoIdentidad}
                    onChange={e => setDocumentoIdentidad(e.target.value)}
                    placeholder="Ej: 12345678 SC"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    maxLength={20}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    {labelEspecialidad}
                  </label>
                  <input
                    type="text"
                    value={especialidad}
                    onChange={e => setEspecialidad(e.target.value)}
                    placeholder={useCargoLabel ? 'Cargo del participante' : 'Especialidad del docente'}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Lugar de Nacimiento
                  </label>
                  <input
                    type="text"
                    value={lugarNacimiento}
                    onChange={e => setLugarNacimiento(e.target.value)}
                    placeholder="Ciudad, País"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={e => setFechaNacimiento(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Identidad Cultural
                  </label>
                  <input
                    type="text"
                    value={identidadCultural}
                    onChange={e => setIdentidadCultural(e.target.value)}
                    placeholder="Ej: Quechua, Aymara, Mestizo..."
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="Ej: 71234567"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                    maxLength={15}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Comunidad
                  </label>
                  <input
                    type="text"
                    value={domicilio}
                    onChange={e => setDomicilio(e.target.value)}
                    placeholder="Nombre de comunidad"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  />
                </div>

              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="button-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : `✓ Agregar ${tipo}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AgregarPersonaModal;
