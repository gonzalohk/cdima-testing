import React from 'react';
import { TaskStatistics } from '../types/asana.types';

interface ResponsibleDistributionProps {
  title: string;
  columnName: string;
  byAssignee: TaskStatistics['byAssignee'];
  onExport?: () => void;
}

const ResponsibleDistribution: React.FC<ResponsibleDistributionProps> = ({ title, columnName, byAssignee, onExport }) => {
  if (Object.keys(byAssignee).length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {onExport && (
          <button onClick={onExport} className="btn-export">
            🖨️
          </button>
        )}
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{columnName}</th>
              <th>Total</th>
              <th>Completadas</th>
              <th>Pendientes</th>
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
                    <td className="text-success">{stats.completed}</td>
                    <td className="text-warning">{stats.pending}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="mini-progress-bar">
                          <div
                            className="mini-progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.85rem', minWidth: '45px' }}>
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
    </div>
  );
};

export default ResponsibleDistribution;
