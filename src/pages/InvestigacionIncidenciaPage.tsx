import React from 'react';
import ProjectTasksListPage from './ProjectTasksListPage';

const InvestigacionIncidenciaPage: React.FC = () => {
  return (
    <ProjectTasksListPage
      title="Investigacion e incidencia"
      subtitle="Listado de tareas del proyecto SAIH investigacion"
      projectQuery="SAIH investigacion"
    />
  );
};

export default InvestigacionIncidenciaPage;