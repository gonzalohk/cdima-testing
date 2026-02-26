import React from 'react';
import { useReportPage } from '../hooks/useReportPage';
import HierarchicalSelector from '../components/HierarchicalSelector';
import TaskInfo from '../components/TaskInfo';
import StatisticsSection from '../components/StatisticsSection';
import SubtasksTable from '../components/SubtasksTable';

const ReportPage: React.FC = () => {
  const {
    workspaces,
    projects,
    sections,
    mainTasks,
    filteredMainTasks,
    subtasks,
    selectedTask,
    selectedWorkspace,
    selectedProject,
    selectedSection,
    selectedMainTask,
    searchTerm,
    statusFilter,
    assigneeFilter,
    lugarFilter,
    loading,
    error,
    statistics,
    filteredSubtasks,
    uniqueAssignees,
    uniqueLugares,
    handleWorkspaceChange,
    handleProjectChange,
    handleSectionChange,
    handleMainTaskChange,
    handleExportPDF,
    setSearchTerm,
    setStatusFilter,
    setAssigneeFilter,
    setLugarFilter,
  } = useReportPage();

  return (
    <div>
      <h1 className="page-title">Reporte de Actividades</h1>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <HierarchicalSelector
        workspaces={workspaces}
        projects={projects}
        sections={sections}
        mainTasks={mainTasks}
        filteredMainTasks={filteredMainTasks}
        selectedWorkspace={selectedWorkspace}
        selectedProject={selectedProject}
        selectedSection={selectedSection}
        selectedMainTask={selectedMainTask}
        loading={loading}
        onWorkspaceChange={handleWorkspaceChange}
        onProjectChange={handleProjectChange}
        onSectionChange={handleSectionChange}
        onMainTaskChange={handleMainTaskChange}
      />

      {loading && <div className="loading">Cargando...</div>}

      {selectedTask && (
        <>
          <TaskInfo task={selectedTask} subtasksCount={subtasks.length} />
          
          <StatisticsSection statistics={statistics} />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueAssignees={uniqueAssignees}
            uniqueLugares={uniqueLugares}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            assigneeFilter={assigneeFilter}
            lugarFilter={lugarFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onAssigneeFilterChange={setAssigneeFilter}
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
              <p><strong>Total de tareas:</strong> {statistics.total}</p>
            </div>
          </div>

          <StatisticsSection statistics={statistics} />
          
          <SubtasksTable
            filteredSubtasks={filteredSubtasks}
            uniqueAssignees={uniqueAssignees}
            uniqueLugares={uniqueLugares}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            assigneeFilter={assigneeFilter}
            lugarFilter={lugarFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onAssigneeFilterChange={setAssigneeFilter}
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
