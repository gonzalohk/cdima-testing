import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import ResourceLibraryPage from './pages/ResourceLibraryPage';
import PlanningPage from './pages/PlanningPage';
import DiplomadosPage from './pages/DiplomadosPage';
import EscuelasPage from './pages/EscuelasPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="biblioteca" element={<ResourceLibraryPage />} />
            <Route path="planificacion" element={<PlanningPage />} />
            <Route path="escuelas" element={<EscuelasPage />} />
            <Route path="diplomados" element={<DiplomadosPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
