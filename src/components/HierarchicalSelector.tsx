import React from 'react';
import { Card, Col, Row, Select, Tooltip } from 'antd';
import { FolderOutlined, CalendarOutlined, ApartmentOutlined, RightOutlined } from '@ant-design/icons';
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

const CDIMA_BLUE = '#1565C0';

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
  const projectOptions = projects.map((project) => ({ label: project.name, value: project.gid }));
  const sectionOptions = [
    { label: 'Todos', value: '' },
    ...sections.map((section) => ({ label: section.name, value: section.gid })),
  ];
  const taskOptions = [
    { label: 'Todos', value: '' },
    ...filteredMainTasks.map((task) => ({ label: task.name, value: task.gid })),
  ];

  const step2Active = !!selectedProject;
  const step3Active = !!selectedProject;

  const getSectionPlaceholder = () => {
    if (!selectedProject) return 'Primero selecciona un proyecto';
    if (loading) return 'Cargando...';
    return 'Todos los años';
  };

  const getTaskPlaceholder = () => {
    if (!selectedProject) return 'Primero selecciona un proyecto';
    if (loading) return 'Cargando actividades...';
    if (filteredMainTasks.length === 0) return selectedSection ? 'No hay actividades para este año' : 'No hay actividades';
    return 'Selecciona una actividad';
  };

  const stepBadge = (step: 1 | 2 | 3, active: boolean) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      background: active ? CDIMA_BLUE : '#e0e0e0',
      color: active ? '#fff' : '#bdbdbd',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
      transition: 'background 0.3s',
    }}>{step}</span>
  );

  const stepLabel = (text: string, active: boolean) => (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.5px', color: active ? '#263238' : '#bdbdbd',
      transition: 'color 0.3s',
    }}>{text}</span>
  );

  const disabledColStyle = (active: boolean): React.CSSProperties => ({
    opacity: active ? 1 : 0.45,
    transition: 'opacity 0.3s',
  });

  return (
    <>
      <style>{`
        .hierarchical-selector .ant-select-focused .ant-select-selector,
        .hierarchical-selector .ant-select-open .ant-select-selector {
          border-color: ${CDIMA_BLUE} !important;
          box-shadow: 0 0 0 2px rgba(21, 101, 192, 0.15) !important;
        }
        .hierarchical-selector .project-select .ant-select-selector {
          border-left: 3px solid ${CDIMA_BLUE} !important;
          background: #f5f8ff !important;
        }
        .hierarchical-selector .ant-select-lg .ant-select-selector {
          border-radius: 8px !important;
        }
        .hierarchical-selector .ant-select-disabled .ant-select-selector {
          background: #f5f5f5 !important;
          cursor: not-allowed !important;
        }
        .hierarchical-selector .task-option-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <Card className="hierarchical-selector" style={{ marginBottom: '1.5rem' }} size="small">
        <Row gutter={0} align="middle" wrap={false} style={{ gap: 0 }}>

          {/* ── PASO 1: PROYECTO ── */}
          <Col flex="28%">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {stepBadge(1, true)}
              <FolderOutlined style={{ color: CDIMA_BLUE, fontSize: 13 }} />
              {stepLabel('Proyecto', true)}
            </div>
            <Select
              className="project-select"
              size="large"
              value={selectedProject || undefined}
              onChange={(value) => onProjectChange(value || '')}
              options={projectOptions}
              placeholder="Selecciona un proyecto"
              loading={loading}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>

          {/* Flecha 1→2 */}
          <Col flex="none" style={{ padding: '22px 10px 0' }}>
            <RightOutlined style={{ color: step2Active ? CDIMA_BLUE : '#d0d0d0', fontSize: 13, transition: 'color 0.3s' }} />
          </Col>

          {/* ── PASO 2: PERIODO ── */}
          <Col flex="16%" style={disabledColStyle(step2Active)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {stepBadge(2, step2Active)}
              <CalendarOutlined style={{ color: step2Active ? CDIMA_BLUE : '#bdbdbd', fontSize: 13, transition: 'color 0.3s' }} />
              {stepLabel(`Periodo${step2Active && sections.length > 0 ? ` (${sections.length})` : ''}`, step2Active)}
            </div>
            <Select
              size="large"
              value={selectedSection || undefined}
              onChange={(value) => onSectionChange(value ?? '')}
              options={sectionOptions}
              placeholder={getSectionPlaceholder()}
              disabled={!selectedProject || loading}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>

          {/* Flecha 2→3 */}
          <Col flex="none" style={{ padding: '22px 10px 0' }}>
            <RightOutlined style={{ color: step3Active ? CDIMA_BLUE : '#d0d0d0', fontSize: 13, transition: 'color 0.3s' }} />
          </Col>

          {/* ── PASO 3: ACTIVIDAD ── */}
          <Col flex="auto" style={disabledColStyle(step3Active)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {stepBadge(3, step3Active)}
              <ApartmentOutlined style={{ color: step3Active ? CDIMA_BLUE : '#bdbdbd', fontSize: 13, transition: 'color 0.3s' }} />
              {stepLabel(
                `Actividad Principal${step3Active && filteredMainTasks.length > 0
                  ? ` · ${filteredMainTasks.length}${selectedSection ? ` de ${mainTasks.length}` : ''}`
                  : ''}`,
                step3Active
              )}
            </div>
            <Select
              size="large"
              value={selectedMainTask || undefined}
              onChange={(value) => onMainTaskChange(value ?? '')}
              placeholder={getTaskPlaceholder()}
              disabled={!selectedProject || loading}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              optionRender={(option) => (
                <Tooltip title={option.label} placement="topLeft" mouseEnterDelay={0.5}>
                  <div className="task-option-label">{option.label}</div>
                </Tooltip>
              )}
              options={taskOptions}
            />
          </Col>

        </Row>
      </Card>
    </>
  );
};

export default HierarchicalSelector;
