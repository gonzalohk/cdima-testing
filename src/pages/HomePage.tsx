import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaWorkspace } from '../types/asana.types';

const HomePage: React.FC = () => {
  const [token, setToken] = useState('');
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  const [workspaces, setWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const savedToken = asanaService.getToken();
    if (savedToken) {
      setToken(savedToken);
      setIsTokenSaved(true);
      loadWorkspaces(savedToken);
    }
  }, []);

  const loadWorkspaces = async (tokenToUse: string) => {
    setLoading(true);
    setError('');
    try {
      asanaService.setToken(tokenToUse);
      const data = await asanaService.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setError('Por favor ingresa un token válido');
      return;
    }

    await loadWorkspaces(token);
    setIsTokenSaved(true);
  };

  const handleClearToken = () => {
    asanaService.clearToken();
    setToken('');
    setIsTokenSaved(false);
    setWorkspaces([]);
  };

  const handleGoToReports = () => {
    if (!token) {
      setError('Por favor configura tu token primero');
      return;
    }
    navigate('/report');
  };

  return (
    <div>
      <h1 className="page-title">Configuración de Asana</h1>

      <div className="card">
        <h2>Token de Acceso Personal</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Para obtener tu token de acceso personal de Asana:
          <br />
          1. Ve a{' '}
          <a 
            href="https://app.asana.com/0/my-apps" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#626262' }}
          >
            Asana Developer Console
          </a>
          <br />
          2. Haz clic en "Create new token"
          <br />
          3. Copia el token generado y pégalo aquí
        </p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="token">Token de Acceso</label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Ingresa tu token de acceso de Asana"
            disabled={isTokenSaved}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {!isTokenSaved ? (
            <button 
              onClick={handleSaveToken} 
              className="button-primary"
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Guardar Token'}
            </button>
          ) : (
            <>
              <button 
                onClick={handleClearToken} 
                className="button-secondary"
              >
                Cambiar Token
              </button>
              <button 
                onClick={handleGoToReports} 
                className="button-success"
              >
                Ir a Reportes
              </button>
            </>
          )}
        </div>
      </div>

      {isTokenSaved && workspaces.length > 0 && (
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
        </div>
      )}
    </div>
  );
};

export default HomePage;
