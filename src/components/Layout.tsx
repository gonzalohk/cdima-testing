import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { AsanaSection } from '../types/asana.types';
import logoCdima from '../assets/logocdima.png';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
        <div className="header-content">
          <img src={logoCdima} alt="Logo CDIMA" className="header-logo" />
          <div className="header-text">
            <h1>CDIMA Amta</h1>
            <p>Sistema de Gestión de Proyectos y Control Académico</p>
          </div>
        </div>
      </header>

      <div className="header-divider-line" aria-hidden="true"></div>
      
      <nav className="nav">
        <ul className="nav-links">
          <li>
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              🏠 Inicio
            </Link>
          </li>
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
              📚 Biblioteca de Recursos
            </Link>
          </li>
          <li>
            <Link 
              to="/planificacion" 
              className={`nav-link ${location.pathname === '/planificacion' ? 'active' : ''}`}
            >
              📅 Planificación
            </Link>
          </li>
          
          {/* Escuela de Formación con submenú */}
          <li 
            className="nav-item-submenu"
            onMouseLeave={() => setShowEscuelasSubmenu(false)}
          >
            <a 
              href="#"
              className={`nav-link ${location.pathname === '/escuelas' ? 'active' : ''}`}
              onClick={toggleEscuelasSubmenu}
              onMouseEnter={() => setShowEscuelasSubmenu(true)}
            >
              🏫 Escuela de Formación
              <span className="submenu-arrow">▼</span>
            </a>
            {showEscuelasSubmenu && escuelas.length > 0 && (
              <ul className="submenu" onMouseEnter={() => setShowEscuelasSubmenu(true)}>
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
          </li>

          {/* Diplomados con submenú */}
          <li 
            className="nav-item-submenu"
            onMouseLeave={() => setShowDiplomadosSubmenu(false)}
          >
            <a 
              href="#"
              className={`nav-link ${location.pathname === '/diplomados' ? 'active' : ''}`}
              onClick={toggleDiplomadosSubmenu}
              onMouseEnter={() => setShowDiplomadosSubmenu(true)}
            >
              🎓 Diplomados
              <span className="submenu-arrow">▼</span>
            </a>
            {showDiplomadosSubmenu && diplomados.length > 0 && (
              <ul className="submenu" onMouseEnter={() => setShowDiplomadosSubmenu(true)}>
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
          </li>

          <li>
            <Link 
              to="/produccion-alto-nivel" 
              className={`nav-link ${location.pathname === '/produccion-alto-nivel' ? 'active' : ''}`}
            >
              🚀 Produccion de Alto Nivel
            </Link>
          </li>

          <li>
            <Link 
              to="/investigacion-e-incidencia" 
              className={`nav-link ${location.pathname === '/investigacion-e-incidencia' ? 'active' : ''}`}
            >
              🔎 Investigacion e incidencia
            </Link>
          </li>
        </ul>
      </nav>
      
      <main className="main-content">
        <Outlet />
      </main>

      {location.pathname !== '/biblioteca' && (
        <>
          <div className="header-divider-line" aria-hidden="true"></div>
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} CDIMA. Todos los derechos reservados.</span>
          </footer>
        </>
      )}
    </div>
  );
};

export default Layout;
