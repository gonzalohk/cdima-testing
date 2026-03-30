import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaSection } from '../types/asana.types';
import { useAuth } from '../context/AuthContext';
import logoCdima from '../assets/logocdima.png';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [escuelas, setEscuelas] = useState<AsanaSection[]>([]);
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [showEscuelasSubmenu, setShowEscuelasSubmenu] = useState(false);
  const [showDiplomadosSubmenu, setShowDiplomadosSubmenu] = useState(false);

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      const token = asanaService.getToken();
      if (!token) return;

      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) return;

      const projects = await asanaService.getProjects(cdima.gid);
      
      // Cargar Escuelas
      const escuelasProject = projects.find(p => 
        p.name.toLowerCase().includes('escuela')
      );
      if (escuelasProject) {
        const escuelasSections = await asanaService.getSections(escuelasProject.gid);
        setEscuelas(escuelasSections);
      }

      // Cargar Diplomados
      const diplomadosProject = projects.find(p => 
        p.name.toLowerCase().includes('diplomado')
      );
      if (diplomadosProject) {
        const diplomadosSections = await asanaService.getSections(diplomadosProject.gid);
        setDiplomados(diplomadosSections);
      }
    } catch (error) {
      console.error('Error loading menu data:', error);
    }
  };

  const handleEscuelaClick = (escuela: AsanaSection) => {
    navigate('/escuelas', { state: { selectedEscuela: escuela } });
    setShowEscuelasSubmenu(false);
  };

  const handleDiplomadoClick = (diplomado: AsanaSection) => {
    navigate('/diplomados', { state: { selectedDiplomado: diplomado } });
    setShowDiplomadosSubmenu(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleEscuelasSubmenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowEscuelasSubmenu(!showEscuelasSubmenu);
    setShowDiplomadosSubmenu(false);
  };

  const toggleDiplomadosSubmenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDiplomadosSubmenu(!showDiplomadosSubmenu);
    setShowEscuelasSubmenu(false);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Spacer izquierdo para centrado óptico */}
          <div style={{ flex: 1 }} />
          {/* Logo + título centrado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 'none' }}>
            <img src={logoCdima} alt="Logo CDIMA" className="header-logo" />
            <div className="header-text">
              <h1>CDIMA Amuyt'a</h1>
              <p>Sistema de Gestión de Proyectos y Control Académico</p>
            </div>
          </div>
          {/* User info + logout alineado a la derecha */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', color: 'white', fontSize: 13 }}>
            <UserOutlined />
            <span>{user?.name}</span>
            <Popconfirm
              title="¿Cerrar sesión?"
              description="Se cerrará tu sesión actual."
              onConfirm={handleLogout}
              okText="Salir"
              cancelText="Cancelar"
              placement="bottomRight"
            >
              <button
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 6,
                  color: 'white',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <LogoutOutlined />
                Salir
              </button>
            </Popconfirm>
          </div>
        </div>
      </header>

      <div className="header-divider-line" aria-hidden="true"></div>

      <div className="app-body">
        <nav className="sidebar">
          <ul className="nav-links">
            <li className="sidebar-group-label">Principal</li>
            <li>
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                🏠 Inicio
              </Link>
            </li>

            <li className="sidebar-group-label">Reportes</li>
            <li>
              <Link
                to="/report"
                className={`nav-link ${location.pathname === '/report' ? 'active' : ''}`}
              >
                📊 Proyectos
              </Link>
            </li>
            <li>
              <Link
                to="/biblioteca"
                className={`nav-link ${location.pathname === '/biblioteca' ? 'active' : ''}`}
              >
                📡 Comunicación
              </Link>
            </li>

            <li className="sidebar-group-label">Planificación</li>
            <li>
              <Link
                to="/planificacion"
                className={`nav-link ${location.pathname === '/planificacion' ? 'active' : ''}`}
              >
                📅 Planificación
              </Link>
            </li>

            {/* Académico — solo admin */}
            {isAdmin && <li className="sidebar-group-label">Académico</li>}

            {/* Escuela de Formación con submenú — solo admin */}
            {isAdmin && <li className="nav-item-submenu">
              <a
                href="#"
                className={`nav-link ${location.pathname === '/escuelas' ? 'active' : ''}`}
                onClick={toggleEscuelasSubmenu}
              >
                🏫 Escuela de Formación
                <span className="submenu-arrow" style={{ marginLeft: 'auto' }}>
                  {showEscuelasSubmenu ? '▲' : '▼'}
                </span>
              </a>
              {showEscuelasSubmenu && escuelas.length > 0 && (
                <ul className="submenu">
                  <li>
                    <Link
                      to="/escuelas"
                      className="submenu-link"
                      onClick={() => setShowEscuelasSubmenu(false)}
                    >
                      Ver todas
                    </Link>
                  </li>
                  {escuelas.map(escuela => (
                    <li key={escuela.gid}>
                      <button
                        className="submenu-link"
                        onClick={() => handleEscuelaClick(escuela)}
                      >
                        {escuela.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>}

            {/* Diplomados con submenú — solo admin */}
            {isAdmin && <li className="nav-item-submenu">
              <a
                href="#"
                className={`nav-link ${location.pathname === '/diplomados' ? 'active' : ''}`}
                onClick={toggleDiplomadosSubmenu}
              >
                🎓 Diplomados
                <span className="submenu-arrow" style={{ marginLeft: 'auto' }}>
                  {showDiplomadosSubmenu ? '▲' : '▼'}
                </span>
              </a>
              {showDiplomadosSubmenu && diplomados.length > 0 && (
                <ul className="submenu">
                  <li>
                    <Link
                      to="/diplomados"
                      className="submenu-link"
                      onClick={() => setShowDiplomadosSubmenu(false)}
                    >
                      Ver todos
                    </Link>
                  </li>
                  {diplomados.map(diplomado => (
                    <li key={diplomado.gid}>
                      <button
                        className="submenu-link"
                        onClick={() => handleDiplomadoClick(diplomado)}
                      >
                        {diplomado.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>}

            {/* Producción — solo admin */}
            {isAdmin && <li className="sidebar-group-label">Producción</li>}

            {isAdmin && (
            <li>
              <Link
                to="/produccion-alto-nivel"
                className={`nav-link ${location.pathname === '/produccion-alto-nivel' ? 'active' : ''}`}
              >
                🚀 Alto Nivel
              </Link>
            </li>
            )}

            {isAdmin && (
            <li>
              <Link
                to="/investigacion-e-incidencia"
                className={`nav-link ${location.pathname === '/investigacion-e-incidencia' ? 'active' : ''}`}
              >
                🔎 Investigación e incidencia
              </Link>
            </li>
            )}
          </ul>
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <div className="header-divider-line" aria-hidden="true"></div>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} CDIMA. Todos los derechos reservados.</span>
      </footer>

    </div>
  );
};

export default Layout;
