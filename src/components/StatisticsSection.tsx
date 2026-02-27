import React from 'react';
import { TaskStatistics } from '../types/asana.types';

interface StatisticsSectionProps {
  statistics: TaskStatistics;
}

const StatisticsSection: React.FC<StatisticsSectionProps> = ({ statistics }) => {
  return (
    <div className="card">
      <h2>Estadísticas</h2>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Progreso General</h3>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${statistics.completionPercentage}%` }}
          >
            {statistics.completionPercentage > 10 &&
              `${statistics.completionPercentage.toFixed(1)}%`}
          </div>
        </div>
      </div>

      <div className="statistics-grid">
        <div className="stat-card success">
          <div className="stat-value">{statistics.total}</div>
          <div className="stat-label">Total de Sub Actividades</div>
        </div>

        <div className="stat-card success">
          <div className="stat-value">{statistics.completed}</div>
          <div className="stat-label">Completadas</div>
        </div>

        <div className="stat-card success">
          <div className="stat-value">{statistics.pending}</div>
          <div className="stat-label">Pendientes</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {statistics.completionPercentage.toFixed(1)}%
          </div>
          <div className="stat-label">Progreso</div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsSection;
