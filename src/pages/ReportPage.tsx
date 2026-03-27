import React from 'react';
import { Alert, Card, Typography } from 'antd';
import { useReportPage } from '../hooks/useReportPage';
import HierarchicalSelector from '../components/HierarchicalSelector';
import TaskInfo from '../components/TaskInfo';
import StatisticsSection from '../components/StatisticsSection';
import SectionTabs from '../components/SectionTabs';
import LoadingOverlay from '../components/LoadingOverlay';
import GanttChart from '../components/GanttChart';
import { exportDistributionReportToPDF } from '../services/reports/report-reports.service';
import { exportDistributionReportToWord } from '../services/reports/report-word.service';

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
    handleExportWord,
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

  const handleExportMunicipiosWord = () => {
    exportDistributionReportToWord(
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

  const handleExportResponsablesWord = () => {
    exportDistributionReportToWord(
      statistics.byResponsable,
      'Distribución por Responsable',
      'Responsable',
      projectName
    );
  };

  return (
    <div className="planning-page">
      {/* Header */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div className="planning-header-left">
          <div className="planning-icon">📊</div>
          <div className="planning-info">
            <Typography.Title level={3} style={{ margin: 0 }}>Gestión de Proyectos</Typography.Title>
            <Typography.Text type="secondary">
              {selectedProject 
                ? `${projectName} · ${statistics.total} ${statistics.total === 1 ? 'actividad' : 'actividades'}`
                : 'Selecciona un proyecto para ver el reporte'}
            </Typography.Text>
          </div>
        </div>
      </Card>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: '1rem' }} />
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
            subtasksCount={subtasks.filter(t =>
              !t.name.startsWith('FUENTES DE VERIFICACION') &&
              !t.name.startsWith('SFON') &&
              !t.name.startsWith('SMAT') &&
              !t.name.startsWith('DMAT') &&
              !t.name.startsWith('CPER')
            ).length}
            subtasks={subtasks}
            statistics={statistics}
            projectName={projects.find(p => p.gid === selectedProject)?.name}
            onSubtaskDeleted={(gid) => setSubtasks(prev => prev.filter(t => t.gid !== gid))}
            onSubtaskCreated={() => loadTaskDetails(selectedMainTask)}
          />
          
          <SectionTabs
            // Subtasks
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
            onExportSubtasksPDF={handleExportPDF}
            onExportSubtasksWord={handleExportWord}
            onTaskUpdate={(updated) => setSubtasks(prev => prev.map(t => t.gid === updated.gid ? updated : t))}
            // Beneficiaries
            subtasks={subtasks}
            mainTask={selectedTask}
            projectName={projects.find(p => p.gid === selectedProject)?.name}
            // Distributions
            byMunicipio={statistics.byAssignee}
            byResponsable={statistics.byResponsable}
            onExportMunicipiosPDF={handleExportMunicipios}
            onExportMunicipiosWord={handleExportMunicipiosWord}
            onExportResponsablesPDF={handleExportResponsables}
            onExportResponsablesWord={handleExportResponsablesWord}
          />

          <GanttChart task={selectedTask} subtasks={subtasks} />
        </>
      )}


      {!selectedTask && !loading && selectedProject && (
        <>
          <Card style={{ marginBottom: '1.5rem' }}>
            <Typography.Title level={4}>Información del Proyecto</Typography.Title>
            <div className="task-info">
              <p><strong>Proyecto:</strong> {projects.find(p => p.gid === selectedProject)?.name}</p>
              <p><strong>Total de actividades:</strong> {statistics.total}</p>
            </div>
          </Card>

          <StatisticsSection statistics={statistics} />
          
          <SectionTabs
            // Subtasks
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
            onExportSubtasksPDF={handleExportPDF}
            onExportSubtasksWord={handleExportWord}
            onTaskUpdate={(updated) => setSubtasks(prev => prev.map(t => t.gid === updated.gid ? updated : t))}
            // Beneficiaries
            subtasks={filteredSubtasks}
            projectName={projects.find(p => p.gid === selectedProject)?.name}
            // Distributions
            byMunicipio={statistics.byAssignee}
            byResponsable={statistics.byResponsable}
            onExportMunicipiosPDF={handleExportMunicipios}
            onExportMunicipiosWord={handleExportMunicipiosWord}
            onExportResponsablesPDF={handleExportResponsables}
            onExportResponsablesWord={handleExportResponsablesWord}
          />
        </>
      )}

      {!selectedTask && !loading && selectedMainTask && !selectedProject && (
        <Card>
          <div className="empty-state">
            <p>Selecciona una actividad para ver su información</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReportPage;
