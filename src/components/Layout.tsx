import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { asanaService } from '../services/asana.service';
import { AsanaSection, AsanaTask } from '../types/asana.types';
import { useAuth } from '../context/AuthContext';
import { ROLE_PAGES, ROLE_ESCUELA_AREA } from '../context/permissions';
import logoCdima from '../assets/logocdima.png';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const _pages = user?.role ? (ROLE_PAGES[user.role as keyof typeof ROLE_PAGES] ?? []) : [];
  const canSeeInicio = _pages.includes('/');
  const canSeeEscuelas = _pages.includes('/escuelas');
  const canSeeDiplomados = _pages.includes('/diplomados');
  const canSeeProduccion = _pages.includes('/produccion-alto-nivel');
  const canSeeInvestigacion = _pages.includes('/investigacion-e-incidencia');
  const canSeePublicaciones = _pages.includes('/publicaciones');
  const canSeeAcademico = canSeeEscuelas || canSeeDiplomados || canSeeProduccion;
  const [escuelas, setEscuelas] = useState<AsanaSection[]>([]);
  const [diplomados, setDiplomados] = useState<AsanaSection[]>([]);
  const [cursos, setCursos] = useState<AsanaSection[]>([]);
  const [pubMenus, setPubMenus] = useState<AsanaTask[]>([]);
  const [showEscuelasSubmenu, setShowEscuelasSubmenu] = useState(false);
  const [showDiplomadosSubmenu, setShowDiplomadosSubmenu] = useState(false);
  const [showCursosSubmenu, setShowCursosSubmenu] = useState(false);

  useEffect(() => {
    loadMenuData();
    const onRefresh = () => loadMenuData();
    window.addEventListener('publicaciones:refresh', onRefresh);
    return () => window.removeEventListener('publicaciones:refresh', onRefresh);
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
        const areaRequerida = user?.role ? ROLE_ESCUELA_AREA[user.role] : undefined;
        if (areaRequerida !== undefined) {
          const sectionsWithArea = await Promise.all(
            escuelasSections.map(async (section) => {
              try {
                const sectionTasks = await asanaService.getSectionTasks(section.gid);
                const tareaResumen = sectionTasks.find((t: any) => t.name.startsWith('Resumen:'));
                if (!tareaResumen) return { section, area: null };
                const tareaResumenFull = await asanaService.getTask(tareaResumen.gid);
                const areaField = tareaResumenFull.custom_fields?.find((f: any) => f.name === 'Area');
                const area = areaField?.display_value ?? areaField?.enum_value?.name ?? null;
                return { section, area };
              } catch {
                return { section, area: null };
              }
            })
          );
          setEscuelas(sectionsWithArea.filter(({ area }) => area === areaRequerida).map(({ section }) => section));
        } else {
          setEscuelas(escuelasSections);
        }
      }

      // Cargar Diplomados
      const diplomadosProject = projects.find(p => 
        p.name.toLowerCase().includes('diplomado')
      );
      if (diplomadosProject) {
        const diplomadosSections = await asanaService.getSections(diplomadosProject.gid);
        setDiplomados(diplomadosSections);
      }

      // Cargar Cursos de Alto Nivel
      if (canSeeProduccion) {
        const cursosProject = projects.find(p => p.name.toLowerCase().includes('curso alto nivel'));
        if (cursosProject) {
          const cursosSections = await asanaService.getSections(cursosProject.gid);
          setCursos(cursosSections);
        }
      }

      // Cargar menús de Publicaciones
      if (canSeePublicaciones) {
        const pubProject = projects.find(p => p.name === 'Publicaciones CDIMA');
        if (pubProject) {
          const allTasks = await asanaService.getProjectTasks(pubProject.gid);
          setPubMenus(allTasks.filter((t: AsanaTask) => !t.name.startsWith('Resumen:')));
        }
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

  const handleCursoClick = (curso: AsanaSection) => {
    navigate('/produccion-alto-nivel', { state: { selectedCurso: curso } });
    setShowCursosSubmenu(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleEscuelasSubmenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowEscuelasSubmenu(!showEscuelasSubmenu);
    setShowDiplomadosSubmenu(false);
    setShowCursosSubmenu(false);
  };

  const toggleDiplomadosSubmenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDiplomadosSubmenu(!showDiplomadosSubmenu);
    setShowEscuelasSubmenu(false);
    setShowCursosSubmenu(false);
  };

  const toggleCursosSubmenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowCursosSubmenu(!showCursosSubmenu);
    setShowEscuelasSubmenu(false);
    setShowDiplomadosSubmenu(false);
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
            {canSeeInicio && <li className="sidebar-group-label">Principal</li>}
            {canSeeInicio && (
            <li>
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                🏠 Inicio
              </Link>
            </li>
            )}

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

            {/* Académico — visible según rol */}
            {canSeeAcademico && <li className="sidebar-group-label">Académico</li>}

            {/* Escuela de Formación con submenú */}
            {canSeeEscuelas && <li className="nav-item-submenu">
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
              {showEscuelasSubmenu && (
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
                  {escuelas.length === 0 && (
                    <li style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Sin escuelas aún
                    </li>
                  )}
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

            {/* Diplomados con submenú */}
            {canSeeDiplomados && <li className="nav-item-submenu">
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

            {/* Curso de Alto Nivel con submenú */}
            {canSeeProduccion && <li className="nav-item-submenu">
              <a
                href="#"
                className={`nav-link ${location.pathname === '/produccion-alto-nivel' ? 'active' : ''}`}
                onClick={toggleCursosSubmenu}
              >
                🚀 Curso de Alto Nivel
                <span className="submenu-arrow" style={{ marginLeft: 'auto' }}>
                  {showCursosSubmenu ? '▲' : '▼'}
                </span>
              </a>
              {showCursosSubmenu && (
                <ul className="submenu">
                  <li>
                    <Link
                      to="/produccion-alto-nivel"
                      className="submenu-link"
                      onClick={() => setShowCursosSubmenu(false)}
                    >
                      Ver todos
                    </Link>
                  </li>
                  {cursos.length === 0 && (
                    <li style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Sin cursos aún
                    </li>
                  )}
                  {cursos.map(curso => (
                    <li key={curso.gid}>
                      <button
                        className="submenu-link"
                        onClick={() => handleCursoClick(curso)}
                      >
                        {curso.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>}


            {canSeePublicaciones && <li className="sidebar-group-label">Publicaciones</li>}

            {canSeePublicaciones && pubMenus.map(menu => (
              <li key={menu.gid}>
                <Link
                  to={`/publicaciones?tab=${menu.gid}`}
                  className={`nav-link ${location.pathname === '/publicaciones' && new URLSearchParams(location.search).get('tab') === menu.gid ? 'active' : ''}`}
                >
                  📄 {menu.name}
                </Link>
              </li>
            ))}

            {canSeePublicaciones && user?.role === 'director' && (
              <li>
                <Link
                  to="/publicaciones?newMenu=1"
                  className="nav-link"
                  style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}
                >
                  + Agregar menú
                </Link>
              </li>
            )}

            <li className="sidebar-group-label">Ayuda</li>
            <li>
              <a
                href="/manual-administrador.html"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                📖 Manual de usuario
              </a>
            </li>
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
