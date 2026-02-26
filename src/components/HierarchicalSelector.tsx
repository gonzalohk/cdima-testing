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
    <div className="card">
      <h2>Selección de Actividad</h2>
      
      <div className="form-group">
        <label htmlFor="project">Proyecto</label>
        <select
          id="project"
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
      </div>

      <div className="form-group">
        <label htmlFor="section">Año ({sections.length})</label>
        <select
          id="section"
          value={selectedSection}
          onChange={(e) => onSectionChange(e.target.value)}
          disabled={!selectedProject || loading}
        >
          <option value="">Todas los años</option>
          {sections.map((section) => (
            <option key={section.gid} value={section.gid}>
              {section.name}
            </option>
          ))}
        </select>
        {selectedSection && (
          <small className="form-hint">
            Filtrando por: {sections.find((s) => s.gid === selectedSection)?.name}
          </small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="mainTask">
          Actividad Principal ({filteredMainTasks.length}
          {selectedSection ? ` de ${mainTasks.length} total` : ' total'})
        </label>
        <select
          id="mainTask"
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
      </div>
    </div>
  );
};

export default HierarchicalSelector;
