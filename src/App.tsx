import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import ResourceLibraryPage from './pages/ResourceLibraryPage';
import PlanningPage from './pages/PlanningPage';
import DiplomadosPage from './pages/DiplomadosPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="biblioteca" element={<ResourceLibraryPage />} />
          <Route path="planificacion" element={<PlanningPage />} />
          <Route path="diplomados" element={<DiplomadosPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
