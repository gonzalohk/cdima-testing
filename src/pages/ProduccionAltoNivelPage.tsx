import React from 'react';
import ProjectTasksListPage from './ProjectTasksListPage';

const ProduccionAltoNivelPage: React.FC = () => {
  return (
    <ProjectTasksListPage
      title="Produccion de Alto Nivel"
      subtitle="Listado de tareas del proyecto SAIH alto nivel"
      projectQuery="SAIH alto nivel"
    />
  );
};

export default ProduccionAltoNivelPage;