import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>CDIMA - Reportes de Asana</h1>
            <p>Sistema de generación de reportes</p>
          </div>
        </div>
      </header>
      
      <nav className="nav">
        <ul className="nav-links">
          <li>
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Configuración
            </Link>
          </li>
          <li>
            <Link 
              to="/report" 
              className={`nav-link ${location.pathname === '/report' ? 'active' : ''}`}
            >
              Reportes
            </Link>
          </li>
        </ul>
      </nav>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
