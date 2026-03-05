import React from 'react';
import { useReportPage } from '../hooks/useReportPage';
import HierarchicalSelector from '../components/HierarchicalSelector';
import TaskInfo from '../components/TaskInfo';
import StatisticsSection from '../components/StatisticsSection';
import ResponsibleDistribution from '../components/ResponsibleDistribution';
import SubtasksTable from '../components/SubtasksTable';
import RequestsTable from '../components/RequestsTable';
import BeneficiariesSummary from '../components/BeneficiariesSummary';
import LoadingOverlay from '../components/LoadingOverlay';
import { exportDistributionToPDF } from '../services/pdf.service';

const ReportPage: React.FC = () => {
  const {
    projects,
    sections,
    mainTasks,
    filteredMainTasks,
    subtasks,
    selectedTask,
    selectedProject,
    selectedSection,
    selectedMainTask,
    searchTerm,
    statusFilter,
    lugarFilter,
    loading,
    error,
    statistics,
    filteredSubtasks,
    uniqueLugares,
    handleProjectChange,
    handleSectionChange,
    handleMainTaskChange,
    handleExportPDF,
    setSearchTerm,
    setStatusFilter,
    setLugarFilter,
  } = useReportPage();

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Proyecto';

  const handleExportMunicipios = () => {
    exportDistributionToPDF(
      statistics.byAssignee,
      'Distribución por Municipio',
      'Municipio',
      projectName
    );
  };

  const handleExportResponsables = () => {
    exportDistributionToPDF(
      statistics.byResponsable,
      'Distribución por Responsable',
      'Responsable',
      projectName
    );
  };

  return (
    <div>
      <h1 className="page-title">Reporte de Actividades</h1>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <HierarchicalSelector
        projects={projects}
        sections={sections}
        mainTasks={mainTasks}
        filteredMainTasks={filteredMainTasks}
        selectedProject={selectedProject}
        selectedSection={selectedSection}
        selectedMainTask={selectedMainTask}
        loading={loading}
        onProjectChange={handleProjectChange}
        onSectionChange={handleSectionChange}
        onMainTaskChange={handleMainTaskChange}
      />

      {loading && <LoadingOverlay message="Cargando datos..." />}

      {selectedTask && (
        <>
          <TaskInfo task={selectedTask} subtasksCount={subtasks.length} subtasks={subtasks} />
          
          <StatisticsSection statistics={statistics} />
          
          <ResponsibleDistribution 
            title="Distribución por Municipio" 
            columnName="Municipio"
            byAssignee={statistics.byAssignee}
            onExport={handleExportMunicipios}
          />
          
          <ResponsibleDistribution 
            title="Distribución por Responsable" 
            columnName="Responsable"
            byAssignee={statistics.byResponsable}
            onExport={handleExportResponsables}
          />
          
          <BeneficiariesSummary 
            subtasks={subtasks} 
            mainTask={selectedTask}
            projectName={projects.find(p => p.gid === selectedProject)?.name}
          />
          
          <RequestsTable subtasks={subtasks} />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueLugares={uniqueLugares}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            lugarFilter={lugarFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onLugarFilterChange={setLugarFilter}
            onExportPDF={handleExportPDF}
          />
        </>
      )}


      {!selectedTask && !loading && selectedProject && (
        <>
          <div className="card">
            <h2>Información del Proyecto</h2>
            <div className="task-info">
              <p><strong>Proyecto:</strong> {projects.find(p => p.gid === selectedProject)?.name}</p>
              <p><strong>Total de actividades:</strong> {statistics.total}</p>
            </div>
          </div>

          <StatisticsSection statistics={statistics} />
          
          <ResponsibleDistribution 
            title="Distribución por Municipio" 
            columnName="Municipio"
            byAssignee={statistics.byAssignee}
            onExport={handleExportMunicipios}
          />
          
          <ResponsibleDistribution 
            title="Distribución por Responsable" 
            columnName="Responsable"
            byAssignee={statistics.byResponsable}
            onExport={handleExportResponsables}
          />
          
          <BeneficiariesSummary 
            subtasks={filteredSubtasks}
            projectName={projects.find(p => p.gid === selectedProject)?.name}
          />
          
          <RequestsTable subtasks={filteredSubtasks} />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueLugares={uniqueLugares}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            lugarFilter={lugarFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onLugarFilterChange={setLugarFilter}
            onExportPDF={handleExportPDF}
          />
        </>
      )}

      {!selectedTask && !loading && selectedMainTask && !selectedProject && (
        <div className="card">
          <div className="empty-state">
            <p>Selecciona una actividad para ver su información</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
