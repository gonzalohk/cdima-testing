import React from 'react';
import { Card, Empty, Tabs } from 'antd';
import { AsanaTask, TaskStatistics } from '../types/asana.types';
import SubtasksTable from './SubtasksTable';
import BeneficiariesSummary from './BeneficiariesSummary';
import ResponsibleDistribution from './ResponsibleDistribution';

interface SectionTabsProps {
  // Subtasks table
  filteredSubtasks: AsanaTask[];
  uniqueLugares: string[];
  uniqueResponsables: string[];
  searchTerm: string;
  statusFilter: string;
  lugarFilter: string;
  responsableFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onLugarFilterChange: (value: string) => void;
  onResponsableFilterChange: (value: string) => void;
  onExportSubtasksPDF: () => void;
  onExportSubtasksWord?: () => void;
  onTaskUpdate?: (updatedTask: AsanaTask) => void;
  onParentTaskUpdate?: (updatedTask: AsanaTask) => void;
  // Beneficiaries
  subtasks: AsanaTask[];
  mainTask?: AsanaTask;
  projectName?: string;
  // Distribution
  byMunicipio: TaskStatistics['byAssignee'];
  byResponsable: TaskStatistics['byAssignee'];
  onExportMunicipiosPDF?: () => void;
  onExportMunicipiosWord?: () => void;
  onExportResponsablesPDF?: () => void;
  onExportResponsablesWord?: () => void;
}

const EmptyState: React.FC<{ description: string }> = ({ description }) => (
  <div style={{ padding: '3rem 1.5rem' }}>
    <Empty description={description} />
  </div>
);

const SectionTabs: React.FC<SectionTabsProps> = ({
  filteredSubtasks,
  uniqueLugares,
  uniqueResponsables,
  searchTerm,
  statusFilter,
  lugarFilter,
  responsableFilter,
  onSearchChange,
  onStatusFilterChange,
  onLugarFilterChange,
  onResponsableFilterChange,
  onExportSubtasksPDF,
  onExportSubtasksWord,
  onTaskUpdate,
  onParentTaskUpdate,
  subtasks,
  mainTask,
  projectName,
  byMunicipio,
  byResponsable,
  onExportMunicipiosPDF,
  onExportMunicipiosWord,
  onExportResponsablesPDF,
  onExportResponsablesWord,
}) => {
  const hasMunicipio = Object.keys(byMunicipio).length > 0;
  const hasResponsable = Object.keys(byResponsable).length > 0;

  const items = [
    {
      key: 'subactividades',
      label: 'Sub Actividades',
      children: (
        <SubtasksTable
          filteredSubtasks={filteredSubtasks}
          uniqueLugares={uniqueLugares}
          uniqueResponsables={uniqueResponsables}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          lugarFilter={lugarFilter}
          responsableFilter={responsableFilter}
          onSearchChange={onSearchChange}
          onStatusFilterChange={onStatusFilterChange}
          onLugarFilterChange={onLugarFilterChange}
          onResponsableFilterChange={onResponsableFilterChange}
          onExportPDF={onExportSubtasksPDF}
          onExportWord={onExportSubtasksWord}
          onTaskUpdate={onTaskUpdate}
          allSubtasks={subtasks}
          parentTask={mainTask}
          onParentTaskUpdate={onParentTaskUpdate}
        />
      ),
    },
    {
      key: 'beneficiarios',
      label: 'Resumen de Beneficiarios',
      children: (
        <BeneficiariesSummary
          subtasks={subtasks}
          mainTask={mainTask}
          projectName={projectName}
          showEmpty
        />
      ),
    },
    {
      key: 'municipio',
      label: 'Distribución por Municipio',
      children: hasMunicipio ? (
        <ResponsibleDistribution
          title="Distribución por Municipio"
          columnName="Municipio"
          byAssignee={byMunicipio}
          onExport={onExportMunicipiosPDF}
          onExportWord={onExportMunicipiosWord}
        />
      ) : (
        <EmptyState description="Sin datos de distribución por municipio" />
      ),
    },
    {
      key: 'responsable',
      label: 'Distribución por Responsable',
      children: hasResponsable ? (
        <ResponsibleDistribution
          title="Distribución por Responsable"
          columnName="Responsable"
          byAssignee={byResponsable}
          onExport={onExportResponsablesPDF}
          onExportWord={onExportResponsablesWord}
        />
      ) : (
        <EmptyState description="Sin datos de distribución por responsable" />
      ),
    },
  ];

  return (
    <Card className="section-tabs" bodyStyle={{ padding: 0 }}>
      <Tabs defaultActiveKey="subactividades" items={items} type="card" />
    </Card>
  );
};

export default SectionTabs;
