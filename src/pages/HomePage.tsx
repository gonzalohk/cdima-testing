import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaWorkspace } from '../types/asana.types';

const HomePage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = asanaService.getToken();
    if (token) {
      loadWorkspaces();
    } else {
      setError('No se encontró el token de Asana. Verifica que VITE_ASANA_TOKEN esté definido en el archivo .env');
    }
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await asanaService.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Inicio</h1>

      {loading && (
        <div className="card">
          <p style={{ color: '#666' }}>Conectando con Asana...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <div className="alert alert-error">{error}</div>
        </div>
      )}

      {workspaces.length > 0 && (
        <div className="card">
          <h2>Workspaces Disponibles</h2>
          <div className="alert alert-success">
            Conexión exitosa con Asana
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {workspaces.map((workspace) => (
              <li
                key={workspace.gid}
                style={{
                  padding: '0.75rem',
                  background: '#f8f9fa',
                  marginBottom: '0.5rem',
                  borderRadius: '6px',
                }}
              >
                <strong>{workspace.name}</strong>
                <br />
                <small style={{ color: '#6c757d' }}>ID: {workspace.gid}</small>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={() => navigate('/report')} className="button-success">
              Ir a Reportes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
