import React from 'react';
import { useReportPage } from '../hooks/useReportPage';
import HierarchicalSelector from '../components/HierarchicalSelector';
import TaskInfo from '../components/TaskInfo';
import StatisticsSection from '../components/StatisticsSection';
import ResponsibleDistribution from '../components/ResponsibleDistribution';
import SubtasksTable from '../components/SubtasksTable';
// import RequestsTable from '../components/RequestsTable';
import RequestsTable from '../components/RequestsTable';
import BeneficiariesSummary from '../components/BeneficiariesSummary';
import LoadingOverlay from '../components/LoadingOverlay';
import { exportDistributionReportToPDF } from '../services/reports/report-reports.service';

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
    responsableFilter,
    loading,
    error,
    statistics,
    filteredSubtasks,
    uniqueLugares,
    uniqueResponsables,
    handleProjectChange,
    handleSectionChange,
    handleMainTaskChange,
    handleExportPDF,
    setSearchTerm,
    setStatusFilter,
    setLugarFilter,
    setResponsableFilter,
    setSubtasks,
    loadTaskDetails,
  } = useReportPage();

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Proyecto';

  const handleExportMunicipios = () => {
    exportDistributionReportToPDF(
      statistics.byAssignee,
      'Distribución por Municipio',
      'Municipio',
      projectName
    );
  };

  const handleExportResponsables = () => {
    exportDistributionReportToPDF(
      statistics.byResponsable,
      'Distribución por Responsable',
      'Responsable',
      projectName
    );
  };

  return (
    <div className="planning-page">
      {/* Header */}
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">📊</div>
          <div className="planning-info">
            <h1 className="planning-title">Reporte de Actividades</h1>
            <p className="planning-subtitle">
              {selectedProject 
                ? `${projectName} · ${statistics.total} ${statistics.total === 1 ? 'actividad' : 'actividades'}`
                : 'Selecciona un proyecto para ver el reporte'}
            </p>
          </div>
        </div>
      </div>

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
          <TaskInfo
            task={selectedTask}
            subtasksCount={subtasks.filter(t => !t.name.startsWith('FUENTES DE VERIFICACION')).length}
            subtasks={subtasks}
            onSubtaskDeleted={(gid) => setSubtasks(prev => prev.filter(t => t.gid !== gid))}
            onSubtaskCreated={() => loadTaskDetails(selectedMainTask)}
          />
          
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
          
          {/* <RequestsTable subtasks={subtasks} /> */}
          <RequestsTable
            subtasks={subtasks}
            onDeleted={(gid) => setSubtasks(prev => prev.filter(t => t.gid !== gid))}
          />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueLugares={uniqueLugares}
            uniqueResponsables={uniqueResponsables}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            lugarFilter={lugarFilter}
            responsableFilter={responsableFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onLugarFilterChange={setLugarFilter}
            onResponsableFilterChange={setResponsableFilter}
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
          
          {/* <RequestsTable subtasks={filteredSubtasks} /> */}
          <RequestsTable
            subtasks={filteredSubtasks}
            onDeleted={(gid) => setSubtasks(prev => prev.filter(t => t.gid !== gid))}
          />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueLugares={uniqueLugares}
            uniqueResponsables={uniqueResponsables}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            lugarFilter={lugarFilter}
            responsableFilter={responsableFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onLugarFilterChange={setLugarFilter}
            onResponsableFilterChange={setResponsableFilter}
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
