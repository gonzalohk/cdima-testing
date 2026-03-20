import React from 'react';
import { AsanaProject, AsanaTask, AsanaSection } from '../types/asana.types';

interface HierarchicalSelectorProps {
  projects: AsanaProject[];
  sections: AsanaSection[];
  mainTasks: AsanaTask[];
  filteredMainTasks: AsanaTask[];
  selectedProject: string;
  selectedSection: string;
  selectedMainTask: string;
  loading: boolean;
  onProjectChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onMainTaskChange: (value: string) => void;
}

const HierarchicalSelector: React.FC<HierarchicalSelectorProps> = ({
  projects,
  sections,
  mainTasks,
  filteredMainTasks,
  selectedProject,
  selectedSection,
  selectedMainTask,
  loading,
  onProjectChange,
  onSectionChange,
  onMainTaskChange,
}) => {
  return (
    <div className="card activity-selector-card">
      <div className="activity-selector-header">
        <h2>Selección de Actividad</h2>
        <p>Filtra por proyecto, año y actividad principal</p>
      </div>

      <div className="activity-selector-grid">
        <div className="activity-select-field">
          <label htmlFor="project">Proyecto</label>
          <div className="activity-select-wrap">
            <select
              id="project"
              className="activity-select"
              value={selectedProject}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona un proyecto</option>
              {projects.map((project) => (
                <option key={project.gid} value={project.gid}>
                  {project.name}
                </option>
              ))}
            </select>
            <span className="activity-select-chevron" aria-hidden="true">▾</span>
          </div>
        </div>

        <div className="activity-select-field">
          <label htmlFor="section">Año ({sections.length})</label>
          <div className="activity-select-wrap">
            <select
              id="section"
              className="activity-select"
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              disabled={!selectedProject || loading}
            >
              <option value="">Todos los años</option>
              {sections.map((section) => (
                <option key={section.gid} value={section.gid}>
                  {section.name}
                </option>
              ))}
            </select>
            <span className="activity-select-chevron" aria-hidden="true">▾</span>
          </div>
          {selectedSection && (
            <small className="activity-select-hint">
              Filtrando por: {sections.find((s) => s.gid === selectedSection)?.name}
            </small>
          )}
        </div>

        <div className="activity-select-field activity-select-field-wide">
          <label htmlFor="mainTask">
            Actividad Principal ({filteredMainTasks.length}
            {selectedSection ? ` de ${mainTasks.length} total` : ' total'})
          </label>
          <div className="activity-select-wrap">
            <select
              id="mainTask"
              className="activity-select"
              value={selectedMainTask}
              onChange={(e) => onMainTaskChange(e.target.value)}
              disabled={!selectedProject || loading}
            >
              <option value="">Selecciona una actividad</option>
              {filteredMainTasks.map((task) => (
                <option key={task.gid} value={task.gid}>
                  {task.name}
                </option>
              ))}
            </select>
            <span className="activity-select-chevron" aria-hidden="true">▾</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchicalSelector;
