import React, { useState } from 'react';
import { HtmlModalHeader } from './ModalShared';
import { asanaService } from '../services/asana.service';
import { serializeEstudianteData } from '../utils/asana-helpers';

/** DD/MM/YYYY or DD-MM-YYYY → yyyy-MM-dd (empty string if unparseable) */
const dmyToIso = (dmy: string): string => {
  const m = dmy.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

/** yyyy-MM-dd → DD/MM/YYYY (empty string if unparseable) */
const isoToDmy = (iso: string): string => {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

interface InfoPrimariaModalProps {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  domicilio: string;
  especialidad?: string;
  cargo?: string;
  comunidad?: string;
  documentoIdentidad: string;
  identidadCultural: string;
  tipo: 'Docente' | 'Estudiante';
  // Edit mode support
  taskGid?: string;
  rawTaskName?: string;
  rawNotes?: string;
  onSave?: (taskGid: string, newName: string, newNotes: string) => void;
  onClose: () => void;
}

const InfoPrimariaModal: React.FC<InfoPrimariaModalProps> = ({
  nombre,
  genero,
  telefono,
  lugarNacimiento,
  fechaNacimiento,
  domicilio,
  especialidad,
  cargo,
  comunidad,
  documentoIdentidad,
  identidadCultural,
  tipo,
  taskGid,
  rawTaskName,
  rawNotes,
  onSave,
  onClose
}) => {
  const canEdit = !!taskGid && !!onSave;
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Parse raw task name "Nombre, ApellidoPaterno, ApellidoMaterno" into parts
  const parseRawName = (raw: string) => {
    const parts = raw.split(',').map(p => p.trim());
    return { nombre: parts[0] || '', apellidoPaterno: parts[1] || '', apellidoMaterno: parts[2] || '' };
  };
  const initParts = rawTaskName ? parseRawName(rawTaskName) : { nombre: '', apellidoPaterno: '', apellidoMaterno: '' };

  const [fNombre, setFNombre] = useState(initParts.nombre);
  const [fApellidoPaterno, setFApellidoPaterno] = useState(initParts.apellidoPaterno);
  const [fApellidoMaterno, setFApellidoMaterno] = useState(initParts.apellidoMaterno);
  const [fGenero, setFGenero] = useState(genero);
  const [fDocIdentidad, setFDocIdentidad] = useState(documentoIdentidad);
  const [fEspecialidad, setFEspecialidad] = useState(especialidad ?? cargo ?? '');
  // Stored as yyyy-MM-dd for <input type="date">, saved back as DD/MM/YYYY
  const [fFechaNacimiento, setFFechaNacimiento] = useState(dmyToIso(fechaNacimiento));
  const [fLugarNacimiento, setFLugarNacimiento] = useState(lugarNacimiento);
  const [fTelefono, setFTelefono] = useState(telefono);
  const [fIdentidadCultural, setFIdentidadCultural] = useState(identidadCultural);
  const [fDomicilio, setFDomicilio] = useState(comunidad ?? domicilio);

  const labelEspec = cargo !== undefined ? 'Cargo' : 'Especialidad';
  const labelDomicilio = comunidad !== undefined ? 'Comunidad' : 'Domicilio';
  const iconDomicilio = comunidad !== undefined ? '🏘️' : '🏠';

  const handleSave = async () => {
    if (!taskGid || !onSave) return;
    if (!fNombre.trim() || !fApellidoPaterno.trim()) {
      setSaveError('Nombre y apellido paterno son obligatorios');
      return;
    }
    // Validate birth date
    if (fFechaNacimiento) {
      const d = new Date(fFechaNacimiento);
      if (isNaN(d.getTime())) {
        setSaveError('La fecha de nacimiento no es válida');
        return;
      }
      if (d > new Date()) {
        setSaveError('La fecha de nacimiento no puede ser en el futuro');
        return;
      }
    }
    setSaving(true);
    setSaveError('');
    try {
      const newName = [fNombre.trim(), fApellidoPaterno.trim(), fApellidoMaterno.trim()].filter(Boolean).join(', ');
      const newDataBlock = serializeEstudianteData({
        genero: fGenero,
        fechaNacimiento: isoToDmy(fFechaNacimiento),
        especialidad: fEspecialidad,
        domicilio: fDomicilio,
        telefono: fTelefono,
        lugarNacimiento: fLugarNacimiento,
        documentoIdentidad: fDocIdentidad,
        identidadCultural: fIdentidadCultural,
      });
      // Replace the DATOS ESTUDIANTE block preserving attendance and document sections
      const withoutOldBlock = (rawNotes ?? '')
        .replace(/=== DATOS ESTUDIANTE ===\s*```json[\s\S]*?```/m, '')
        .trim();
      const newNotes = withoutOldBlock ? `${newDataBlock}\n\n${withoutOldBlock}` : newDataBlock;
      await asanaService.updateTask(taskGid, { name: newName, notes: newNotes });
      onSave(taskGid, newName, newNotes);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    border: '1px solid #d1d5db', borderRadius: '5px', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', marginBottom: '0.2rem', letterSpacing: '0.5px',
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ zIndex: 1001 }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', padding: 0 }}
      >
        <HtmlModalHeader icon="📋" title="Información Primaria" subtitle={`${tipo}: ${nombre}`} onClose={onClose} />

        <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
          {!editMode ? (
            /* ── VIEW MODE ── */
            <>
              {/* Avatar + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ width: '62px', height: '62px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#1e3a5f', flexShrink: 0 }}>
                  {nombre.split(' ').filter((w: string) => w.length > 0).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a5f', wordBreak: 'break-word', lineHeight: 1.3 }}>{nombre}</div>
                  <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: tipo === 'Docente' ? '#dbeafe' : '#d1fae5', color: tipo === 'Docente' ? '#1e40af' : '#065f46', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>{tipo}</span>
                </div>
              </div>

              {/* Campos – 2 columnas */}
              {(() => {
                const fields: { icon: string; label: string; value?: string }[] = [
                  { icon: '📑', label: 'Doc. Identidad', value: documentoIdentidad },
                  { icon: '👤', label: 'Género', value: genero },
                ];
                if (cargo !== undefined) fields.push({ icon: '💼', label: 'Cargo', value: cargo });
                else if (especialidad !== undefined) fields.push({ icon: '🎓', label: 'Especialidad', value: especialidad });
                fields.push(
                  { icon: '🎂', label: 'Fecha Nacimiento', value: fechaNacimiento },
                  { icon: '📍', label: 'Lugar Nacimiento', value: lugarNacimiento },
                  { icon: '📞', label: 'Teléfono', value: telefono },
                  { icon: '🌿', label: 'Identidad Cultural', value: identidadCultural },
                  { icon: iconDomicilio, label: labelDomicilio, value: comunidad ?? domicilio },
                );
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    {fields.map((field, i) => (
                      <div key={i}>
                        <label style={labelStyle}>
                          {field.icon} {field.label}
                        </label>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', padding: '0.4rem 0.6rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                          {field.value || '–'}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          ) : (
            /* ── EDIT MODE ── */
            <div>
              {saveError && (
                <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {saveError}
                </div>
              )}

              {/* Name fields */}
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  👤 Nombre completo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={labelStyle}>Nombre *</label>
                    <input value={fNombre} onChange={e => setFNombre(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ap. Paterno *</label>
                    <input value={fApellidoPaterno} onChange={e => setFApellidoPaterno(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ap. Materno</label>
                    <input value={fApellidoMaterno} onChange={e => setFApellidoMaterno(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Other fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {([
                  { label: 'Doc. Identidad', icon: '📑', value: fDocIdentidad, setter: setFDocIdentidad },
                  { label: labelEspec, icon: labelEspec === 'Cargo' ? '💼' : '🎓', value: fEspecialidad, setter: setFEspecialidad },
                  { label: 'Lugar Nacimiento', icon: '📍', value: fLugarNacimiento, setter: setFLugarNacimiento },
                  { label: 'Teléfono', icon: '📞', value: fTelefono, setter: setFTelefono },
                  { label: 'Identidad Cultural', icon: '🌿', value: fIdentidadCultural, setter: setFIdentidadCultural },
                  { label: labelDomicilio, icon: iconDomicilio, value: fDomicilio, setter: setFDomicilio },
                ] as { label: string; icon: string; value: string; setter: (v: string) => void }[]).map((f, i) => (
                  <div key={i}>
                    <label style={labelStyle}>{f.icon} {f.label}</label>
                    <input
                      value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ))}

                {/* Género – dropdown */}
                <div>
                  <label style={labelStyle}>👤 Género</label>
                  <select
                    value={fGenero}
                    onChange={e => setFGenero(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">– Seleccionar –</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Fecha Nacimiento – native date picker */}
                <div>
                  <label style={labelStyle}>🎂 Fecha Nacimiento</label>
                  <input
                    type="date"
                    value={fFechaNacimiento}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setFFechaNacimiento(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'light' }}
                  />
                  {fFechaNacimiento && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
                      {isoToDmy(fFechaNacimiento)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div 
          className="modal-footer"
          style={{ 
            borderTop: '1px solid #e0e0e0',
            padding: '1rem 1.5rem',
            backgroundColor: '#fafafa'
          }}
        >
          {!editMode ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="btn-export-ghost"
                  style={{ flex: 1 }}
                >
                  ✏️ Editar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="button-primary"
                style={{ flex: canEdit ? 1 : undefined, width: canEdit ? undefined : '100%' }}
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setEditMode(false); setSaveError(''); }}
                className="btn-export-ghost"
                style={{ flex: 1 }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="button-primary"
                style={{ flex: 1 }}
                disabled={saving}
              >
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoPrimariaModal;

