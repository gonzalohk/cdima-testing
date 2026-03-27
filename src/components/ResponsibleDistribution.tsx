import React from 'react';
import { Button, Card, Empty, Space, Tooltip, Typography } from 'antd';
import { FileWordOutlined, PrinterOutlined } from '@ant-design/icons';
import { TaskStatistics } from '../types/asana.types';

interface ResponsibleDistributionProps {
  title: string;
  columnName: string;
  byAssignee: TaskStatistics['byAssignee'];
  onExport?: () => void;
  onExportWord?: () => void;
  showEmpty?: boolean;
}

const ResponsibleDistribution: React.FC<ResponsibleDistributionProps> = ({ title, columnName, byAssignee, onExport, onExportWord, showEmpty = false }) => {
  if (Object.keys(byAssignee).length === 0) {
    if (!showEmpty) return null;
    return (
      <Card className="section-card" bodyStyle={{ padding: '3rem 1.5rem' }} style={{ marginBottom: 0 }}>
        <Empty description={`Sin datos de ${title.toLowerCase()}`} />
      </Card>
    );
  }

  return (
    <Card className="section-card" bodyStyle={{ padding: 0 }} style={{ marginBottom: '1.5rem' }}>
      <div className="section-card__header">
        <Typography.Title level={4} className="section-card__title">{title}</Typography.Title>
        <Space size={8}>
          {onExportWord && (
            <Tooltip title="Exportar a Word">
              <Button className="task-ficha-pro__actions-trigger" onClick={onExportWord} icon={<FileWordOutlined />} />
            </Tooltip>
          )}
          {onExport && (
            <Tooltip title="Exportar a PDF">
              <Button className="task-ficha-pro__actions-trigger" onClick={onExport} icon={<PrinterOutlined />} />
            </Tooltip>
          )}
        </Space>
      </div>

      <div className="section-card__table-wrap">
        <table className="section-card__table">
          <thead>
            <tr>
              <th>{columnName}</th>
              <th>Total</th>
              <th>Ejecutadas</th>
              <th>En Proceso</th>
              <th>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byAssignee)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([name, stats]) => {
                const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                return (
                  <tr key={name}>
                    <td><strong>{name}</strong></td>
                    <td>{stats.total}</td>
                    <td className="section-card__cell--success">{stats.completed}</td>
                    <td className="section-card__cell--warning">{stats.pending}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="section-card__progress-bar">
                          <div className="section-card__progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', minWidth: '40px', color: '#374151' }}>
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ResponsibleDistribution;
