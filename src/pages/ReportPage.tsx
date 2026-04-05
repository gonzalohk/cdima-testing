import React, { useState } from 'react';
import { Alert, Button, Card, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { HtmlModalHeader } from '../components/ModalShared';
import { asanaService } from '../services/asana.service';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const canApprove = user?.role === 'administrador' || user?.role === 'director';

  const [createProjectModal, setCreateProjectModal] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectDesc, setCreateProjectDesc] = useState('');
  const [createProjectArea, setCreateProjectArea] = useState('');
  const [createProjectSaving, setCreateProjectSaving] = useState(false);
  const [createProjectError, setCreateProjectError] = useState('');
  const [createProjectStep, setCreateProjectStep] = useState('');

  const handleOpenCreateProject = () => {
    setCreateProjectName('');
    setCreateProjectDesc('');
    setCreateProjectArea('');
    setCreateProjectError('');
    setCreateProjectStep('');
    setCreateProjectModal(true);
  };

  const handleCreateProject = async () => {
    if (!createProjectName.trim() || !createProjectArea) return;
    setCreateProjectSaving(true);
    setCreateProjectError('');
    try {
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      if (!cdima) throw new Error('No se encontró el workspace CDIMA');

      setCreateProjectStep('Buscando plantilla...');
      const templates = await asanaService.getProjectTemplates(cdima.gid);
      const template = templates.find(t => t.name === 'Plantilla Proyecto') ?? templates[0];
      if (!template) throw new Error('No se encontró ninguna plantilla de proyecto en Asana');

      setCreateProjectStep('Creando proyecto desde plantilla...');
      const jobGid = await asanaService.instantiateProjectTemplate(template.gid, createProjectName.trim(), cdima.gid);

      setCreateProjectStep('Esperando confirmación de Asana...');
      const job = await asanaService.pollJob(jobGid);
      if (!job.new_project?.gid) throw new Error('No se pudo obtener el GID del nuevo proyecto');
      const projectGid = job.new_project.gid;

      setCreateProjectStep('Creando tarea de resumen...');
      const task = await asanaService.createTask({
        name: `Resumen: ${createProjectName.trim()}`,
        projectGid,
        workspaceGid: cdima.gid,
        notes: createProjectDesc.trim(),
      });

      setCreateProjectStep('Configurando campo Área...');
      const fullTask = await asanaService.getTask(task.gid);
      const areaField = fullTask.custom_fields?.find(
        f => f.name.toLowerCase().replace(/á/g, 'a') === 'area'
      );
      if (areaField && areaField.enum_options) {
        const option = areaField.enum_options.find(o => o.name === createProjectArea);
        if (option) {
          await asanaService.updateTask(task.gid, { custom_fields: { [areaField.gid]: option.gid } });
        }
      }

      setCreateProjectModal(false);
    } catch (err) {
      setCreateProjectError(err instanceof Error ? err.message : 'Error al crear el proyecto');
    } finally {
      setCreateProjectSaving(false);
      setCreateProjectStep('');
    }
  };

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
    setSelectedTask,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          {canApprove && (
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={handleOpenCreateProject}
              style={{ background: '#1e3a5f', borderColor: '#1e3a5f' }}
            >
              Crear Proyecto
            </Button>
          )}
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
              !t.name.startsWith('CPER') &&
              !t.name.startsWith('Resumen:')
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
            onParentTaskUpdate={(updated) => setSelectedTask(updated)}
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
            onParentTaskUpdate={(updated) => setSelectedTask(updated)}
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
      {/* Modal: Crear Proyecto */}
      {createProjectModal && (
        <div className="modal-overlay" onClick={() => { if (!createProjectSaving) setCreateProjectModal(false); }} style={{ zIndex: 1001 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: 0 }}>
            <HtmlModalHeader
              icon="🗂️"
              title="Crear nuevo proyecto"
              subtitle="Se usará la plantilla configurada en Asana"
              onClose={() => { if (!createProjectSaving) setCreateProjectModal(false); }}
            />

            <div className="modal-body" style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: '0.35rem', letterSpacing: '0.5px' }}>📝 Nombre del proyecto *</label>
                <input
                  type="text"
                  placeholder="Nombre del nuevo proyecto"
                  value={createProjectName}
                  onChange={e => setCreateProjectName(e.target.value)}
                  disabled={createProjectSaving}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: '0.35rem', letterSpacing: '0.5px' }}>🏢 Área *</label>
                <select
                  value={createProjectArea}
                  onChange={e => setCreateProjectArea(e.target.value)}
                  disabled={createProjectSaving}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: 'white', color: createProjectArea ? '#111' : '#9ca3af' }}
                >
                  <option value="" disabled>Seleccionar área...</option>
                  <option value="Empoderamiento Productivo">Empoderamiento Productivo</option>
                  <option value="Empoderamiento Político">Empoderamiento Político</option>
                  <option value="Erradicación de Violencia">Erradicación de Violencia</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: '0.35rem', letterSpacing: '0.5px' }}>📄 Descripción / Resumen</label>
                <textarea
                  rows={4}
                  placeholder="Descripción del proyecto (se añadirá a la tarea de resumen)"
                  value={createProjectDesc}
                  onChange={e => setCreateProjectDesc(e.target.value)}
                  disabled={createProjectSaving}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.92rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              {createProjectSaving && createProjectStep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#6b7280', background: '#f8fafc', borderRadius: '7px', padding: '0.6rem 0.75rem', border: '1px solid #e5e7eb' }}>
                  <span>⏳</span>
                  {createProjectStep}
                </div>
              )}

              {createProjectError && (
                <div style={{ fontSize: '0.85rem', color: '#dc2626', background: '#fef2f2', borderRadius: '7px', padding: '0.6rem 0.75rem', border: '1px solid #fecaca' }}>
                  ⚠️ {createProjectError}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCreateProjectModal(false)}
                disabled={createProjectSaving}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', cursor: createProjectSaving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', color: '#374151', opacity: createProjectSaving ? 0.5 : 1 }}
              >Cancelar</button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!createProjectName.trim() || !createProjectArea || createProjectSaving}
                className="button-primary"
                style={{ padding: '0.5rem 1.25rem', opacity: (!createProjectName.trim() || !createProjectArea || createProjectSaving) ? 0.6 : 1 }}
              >{createProjectSaving ? 'Creando...' : '🗂️ Crear Proyecto'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
