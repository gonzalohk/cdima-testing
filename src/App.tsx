import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import ResourceLibraryPage from './pages/ResourceLibraryPage';
import PlanningPage from './pages/PlanningPage';
import DiplomadosPage from './pages/DiplomadosPage';
import EscuelasPage from './pages/EscuelasPage';
import ProduccionAltoNivelPage from './pages/ProduccionAltoNivelPage';
import InvestigacionIncidenciaPage from './pages/InvestigacionIncidenciaPage';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth, TECNICO_ALLOWED_PATHS } from './context/AuthContext';
import './App.css';

/** Redirects unauthenticated users to /login.
 *  For 'tecnico' role, also enforces allowed paths. */
const ProtectedRoute: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role === 'tecnico' && !TECNICO_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/report" replace />;
  }

  return <Outlet />;
};

/** Redirects already-authenticated users away from /login */
const PublicRoute: React.FC = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <Outlet />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public: login */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected: all app pages */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="biblioteca" element={<ResourceLibraryPage />} />
          <Route path="planificacion" element={<PlanningPage />} />
          <Route path="escuelas" element={<EscuelasPage />} />
          <Route path="diplomados" element={<DiplomadosPage />} />
          <Route path="produccion-alto-nivel" element={<ProduccionAltoNivelPage />} />
          <Route path="investigacion-e-incidencia" element={<InvestigacionIncidenciaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
