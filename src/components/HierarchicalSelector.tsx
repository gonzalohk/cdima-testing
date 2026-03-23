import React from 'react';
import { Card, Col, Form, Row, Select } from 'antd';
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
  const projectOptions = projects.map((project) => ({ label: project.name, value: project.gid }));
  const sectionOptions = sections.map((section) => ({ label: section.name, value: section.gid }));
  const taskOptions = filteredMainTasks.map((task) => ({ label: task.name, value: task.gid }));

  return (
    <Card style={{ marginBottom: '1.5rem' }} size="small">
      <Form layout="vertical" style={{ marginBottom: -8 }}>
        <Row gutter={16} wrap={false}>
          <Col flex="30%">
            <Form.Item label="Proyecto" style={{ marginBottom: 12 }}>
              <Select
                value={selectedProject || undefined}
                onChange={(value) => onProjectChange(value || '')}
                options={projectOptions}
                placeholder="Selecciona un proyecto"
                loading={loading}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>

          <Col flex="20%">
            <Form.Item label={`Año (${sections.length})`} style={{ marginBottom: 8 }}>
              <Select
                value={selectedSection || undefined}
                onChange={(value) => onSectionChange(value || '')}
                options={sectionOptions}
                placeholder="Todos los años"
                disabled={!selectedProject || loading}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>

          <Col flex="50%">
            <Form.Item
              label={`Actividad Principal (${filteredMainTasks.length}${selectedSection ? ` de ${mainTasks.length} total` : ' total'})`}
              style={{ marginBottom: 0 }}
            >
              <Select
                value={selectedMainTask || undefined}
                onChange={(value) => onMainTaskChange(value || '')}
                options={taskOptions}
                placeholder="Selecciona una actividad"
                disabled={!selectedProject || loading}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default HierarchicalSelector;
