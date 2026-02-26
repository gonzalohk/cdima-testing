import React from 'react';
import { AsanaTask } from '../types/asana.types';

interface BeneficiariesSummaryProps {
  subtasks: AsanaTask[];
}

const BeneficiariesSummary: React.FC<BeneficiariesSummaryProps> = ({ subtasks }) => {
  // Función auxiliar para obtener el valor de un campo personalizado
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    if (field.display_value) return field.display_value;
    
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Clasificar subtareas según tengan o no replicantes
  const tasksWithoutReplicantes: AsanaTask[] = [];
  const tasksWithReplicantes: AsanaTask[] = [];

  subtasks.forEach(task => {
    const mujeres = getCustomFieldValue(task, 'Mujeres ');
    const hombres = getCustomFieldValue(task, 'Hombres');
    const poblacionMeta = getCustomFieldValue(task, 'Población Meta');
    const replicantes = getCustomFieldValue(task, 'Replicantes');

    // Solo considerar tareas que tengan al menos uno de los campos de beneficiarios
    const hasBeneficiaries = (mujeres !== '-' && parseInt(mujeres) > 0) || 
                            (hombres !== '-' && parseInt(hombres) > 0) ||
                            (poblacionMeta !== '-' && parseInt(poblacionMeta) > 0);

    if (hasBeneficiaries) {
      if (replicantes === '-' || !replicantes) {
        tasksWithoutReplicantes.push(task);
      } else {
        tasksWithReplicantes.push(task);
      }
    }
  });

  // Calcular totales para tareas sin replicantes
  const totalsWithoutReplicantes = tasksWithoutReplicantes.reduce((acc, task) => {
    const mujeres = getCustomFieldValue(task, 'Mujeres ');
    const hombres = getCustomFieldValue(task, 'Hombres');
    
    acc.mujeres += mujeres !== '-' ? parseInt(mujeres) || 0 : 0;
    acc.hombres += hombres !== '-' ? parseInt(hombres) || 0 : 0;
    
    return acc;
  }, { mujeres: 0, hombres: 0 });

  // Calcular totales para tareas con replicantes
  const totalsWithReplicantes = tasksWithReplicantes.reduce((acc, task) => {
    const mujeres = getCustomFieldValue(task, 'Mujeres ');
    const hombres = getCustomFieldValue(task, 'Hombres');
    
    acc.mujeres += mujeres !== '-' ? parseInt(mujeres) || 0 : 0;
    acc.hombres += hombres !== '-' ? parseInt(hombres) || 0 : 0;
    
    return acc;
  }, { mujeres: 0, hombres: 0 });

  const totalWithoutReplicantes = totalsWithoutReplicantes.mujeres + totalsWithoutReplicantes.hombres;
  const totalWithReplicantes = totalsWithReplicantes.mujeres + totalsWithReplicantes.hombres;

  if (tasksWithoutReplicantes.length === 0 && tasksWithReplicantes.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2>Resumen de Beneficiarios</h2>
      
      {tasksWithoutReplicantes.length > 0 && (
        <>
          <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            Beneficiarios Directos (sin replicantes)
          </h3>
          <div className="table-container" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>Nombre</th>
                  <th style={{ minWidth: '120px' }}>Lugar</th>
                  <th style={{ minWidth: '80px' }}>Mujeres</th>
                  <th style={{ minWidth: '80px' }}>Hombres</th>
                  <th style={{ minWidth: '80px' }}>Total</th>
                  <th style={{ minWidth: '100px' }}>Población Meta</th>
                </tr>
              </thead>
              <tbody>
                {tasksWithoutReplicantes.map((task) => {
                  const mujeres = getCustomFieldValue(task, 'Mujeres ');
                  const hombres = getCustomFieldValue(task, 'Hombres');
                  
                  const mujeresNum = mujeres !== '-' ? parseInt(mujeres) : 0;
                  const hombresNum = hombres !== '-' ? parseInt(hombres) : 0;
                  const total = mujeresNum + hombresNum;
                  
                  return (
                    <tr key={task.gid}>
                      <td>{task.name}</td>
                      <td>{getCustomFieldValue(task, 'Lugar')}</td>
                      <td>{mujeres}</td>
                      <td>{hombres}</td>
                      <td>{total > 0 ? total : '-'}</td>
                      <td>{getCustomFieldValue(task, 'Población Meta')}</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                  <td colSpan={2}>TOTAL</td>
                  <td>{totalsWithoutReplicantes.mujeres}</td>
                  <td>{totalsWithoutReplicantes.hombres}</td>
                  <td>{totalWithoutReplicantes}</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {tasksWithReplicantes.length > 0 && (
        <>
          <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            Beneficiarios Indirectos (con replicantes)
          </h3>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>Nombre</th>
                  <th style={{ minWidth: '120px' }}>Lugar</th>
                  <th style={{ minWidth: '80px' }}>Mujeres</th>
                  <th style={{ minWidth: '80px' }}>Hombres</th>
                  <th style={{ minWidth: '80px' }}>Total</th>
                  <th style={{ minWidth: '100px' }}>Replicantes</th>
                </tr>
              </thead>
              <tbody>
                {tasksWithReplicantes.map((task) => {
                  const mujeres = getCustomFieldValue(task, 'Mujeres ');
                  const hombres = getCustomFieldValue(task, 'Hombres');
                  
                  const mujeresNum = mujeres !== '-' ? parseInt(mujeres) : 0;
                  const hombresNum = hombres !== '-' ? parseInt(hombres) : 0;
                  const total = mujeresNum + hombresNum;
                  
                  return (
                    <tr key={task.gid}>
                      <td>{task.name}</td>
                      <td>{getCustomFieldValue(task, 'Lugar')}</td>
                      <td>{mujeres}</td>
                      <td>{hombres}</td>
                      <td>{total > 0 ? total : '-'}</td>
                      <td>{getCustomFieldValue(task, 'Replicantes')}</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                  <td colSpan={2}>TOTAL</td>
                  <td>{totalsWithReplicantes.mujeres}</td>
                  <td>{totalsWithReplicantes.hombres}</td>
                  <td>{totalWithReplicantes}</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default BeneficiariesSummary;
