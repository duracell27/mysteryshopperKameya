import React, { useState } from 'react';
import { useAccess, AccessRule, LearningRule } from '../../context/AccessContext';
import { apiFetch } from '../../services/apiFetch';

// ─── Module access matrix ─────────────────────────────────────────────────────

const MODULE_ROW_LABELS: { division: string; position: string; label: string }[] = [
  { division: 'stores',   position: 'Початківець консультант', label: 'Магазини / Початківець консультант' },
  { division: 'stores',   position: 'Консультант',             label: 'Магазини / Консультант' },
  { division: 'stores',   position: 'Керівник',                label: 'Магазини / Керівник' },
  { division: 'office',   position: 'Співробітник',            label: 'Офіс / Співробітник' },
  { division: 'office',   position: 'Керівник',                label: 'Офіс / Керівник' },
  { division: 'security', position: 'Охоронець',               label: 'Охорона / Охоронець' },
  { division: 'security', position: 'Керівник',                label: 'Охорона / Керівник' },
];

type ModuleField = 'mysteryShop' | 'onboarding' | 'learning';

const MODULE_COLS: { key: ModuleField; label: string }[] = [
  { key: 'mysteryShop', label: 'Таємний покупець' },
  { key: 'onboarding',  label: 'Онбординг' },
  { key: 'learning',    label: 'Навчання' },
];

// ─── Learning section matrix ──────────────────────────────────────────────────

const LEARNING_ROW_LABELS: { division: string; group?: string; position?: string; label: string }[] = [
  { division: 'stores',   position: 'Початківець консультант', label: 'Магазини / Початківець' },
  { division: 'stores',   position: 'Консультант',             label: 'Магазини / Консультант' },
  { division: 'stores',   position: 'Керівник',                label: 'Магазини / Керівник' },
  { division: 'office',   group:    'marketing',               label: 'Офіс — Маркетинг' },
  { division: 'office',   group:    'other',                   label: 'Офіс — Інші відділи' },
  { division: 'security',                                       label: 'Охорона' },
];

type LearningField = 'general' | 'start' | 'consultant' | 'managers' | 'marketing';

const LEARNING_COLS: { key: LearningField; label: string }[] = [
  { key: 'general',    label: 'Заг. розвиток' },
  { key: 'start',      label: 'Старт роботи' },
  { key: 'consultant', label: 'Прод.-консульт.' },
  { key: 'managers',   label: 'Керівники' },
  { key: 'marketing',  label: 'Маркетинг' },
];

// ─── Toggle component ─────────────────────────────────────────────────────────

const Toggle: React.FC<{ on: boolean; busy: boolean; onToggle: () => void }> = ({ on, busy, onToggle }) => (
  <button
    onClick={onToggle}
    disabled={busy}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
      on ? 'bg-kameya-burgundy' : 'bg-slate-200'
    } ${busy ? 'opacity-50' : ''}`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
      on ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

// ─── AccessMatrixView ─────────────────────────────────────────────────────────

export const AccessMatrixView: React.FC = () => {
  const { matrix, learningMatrix, refreshMatrix } = useAccess();
  const [saving, setSaving] = useState<string | null>(null);

  if (!matrix || !learningMatrix) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-kameya-burgundy text-2xl" />
      </div>
    );
  }

  // ── Module matrix helpers ──
  const getModuleRule = (division: string, position: string): AccessRule | undefined =>
    matrix.find(r => r.division === division && r.position === position);

  const handleModuleToggle = async (division: string, position: string, field: ModuleField, value: boolean) => {
    const key = `mod-${division}-${position}-${field}`;
    setSaving(key);
    const updated: AccessRule[] = MODULE_ROW_LABELS.map(row => {
      const existing = getModuleRule(row.division, row.position);
      const modules  = existing?.modules ?? { mysteryShop: false, onboarding: false, learning: true };
      if (row.division === division && row.position === position) {
        return { division: row.division, position: row.position, modules: { ...modules, [field]: value } };
      }
      return { division: row.division, position: row.position, modules };
    });
    try {
      await apiFetch('/api/access-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated }),
      });
      await refreshMatrix();
    } catch (err) {
      console.error('Failed to save module access:', err);
      alert('Помилка збереження. Спробуйте ще раз.');
      await refreshMatrix();
    } finally {
      setSaving(null);
    }
  };

  // ── Learning matrix helpers ──
  const getLearningRule = (row: typeof LEARNING_ROW_LABELS[number]): LearningRule | undefined =>
    learningMatrix.find(r => {
      if (r.division !== row.division) return false;
      if (row.group === 'other') return r.group === 'other';
      if (row.group) return r.group === row.group;
      if (row.position) return r.position === row.position;
      return !r.group && !r.position;
    });

  const handleLearningToggle = async (
    row: typeof LEARNING_ROW_LABELS[number],
    field: LearningField,
    value: boolean,
  ) => {
    const key = `learn-${row.division}-${row.group ?? ''}-${row.position ?? ''}-${field}`;
    setSaving(key);
    const updated: LearningRule[] = LEARNING_ROW_LABELS.map(r => {
      const existing = getLearningRule(r);
      const sections = existing?.sections ?? { general: false, start: false, consultant: false, managers: false, marketing: false };
      const isTarget = r.division === row.division && r.group === row.group && r.position === row.position;
      return {
        division: r.division,
        ...(r.group     ? { group:    r.group    } : {}),
        ...(r.position  ? { position: r.position } : {}),
        sections: isTarget ? { ...sections, [field]: value } : sections,
      };
    });
    try {
      await apiFetch('/api/access-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningRules: updated }),
      });
      await refreshMatrix();
    } catch (err) {
      console.error('Failed to save learning access:', err);
      alert('Помилка збереження. Спробуйте ще раз.');
      await refreshMatrix();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Матриця доступів</h1>

      {/* Module access table */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Доступ до модулів</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 font-semibold text-slate-600 w-64">Підрозділ / Посада</th>
                {MODULE_COLS.map(col => (
                  <th key={col.key} className="px-6 py-4 font-semibold text-slate-600 text-center">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_ROW_LABELS.map((row, idx) => {
                const rule = getModuleRule(row.division, row.position);
                const showSep = idx > 0 && MODULE_ROW_LABELS[idx - 1].division !== row.division;
                return (
                  <React.Fragment key={row.label}>
                    {showSep && (
                      <tr aria-hidden="true">
                        <td colSpan={4} className="p-0">
                          <div className="h-0.5 bg-kameya-burgundy opacity-40" />
                        </td>
                      </tr>
                    )}
                    <tr className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                      <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                      {MODULE_COLS.map(col => {
                        const isOn = rule?.modules[col.key] ?? false;
                        const key  = `mod-${row.division}-${row.position}-${col.key}`;
                        return (
                          <td key={col.key} className="px-6 py-4 text-center">
                            <Toggle on={isOn} busy={saving === key} onToggle={() => handleModuleToggle(row.division, row.position, col.key, !isOn)} />
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Learning sections table */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Доступ до розділів навчання</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 font-semibold text-slate-600 w-52">Роль</th>
                {LEARNING_COLS.map(col => (
                  <th key={col.key} className="px-4 py-4 font-semibold text-slate-600 text-center">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEARNING_ROW_LABELS.map((row, idx) => {
                const rule = getLearningRule(row);
                const showSep = idx > 0 && LEARNING_ROW_LABELS[idx - 1].division !== row.division;
                return (
                  <React.Fragment key={row.label}>
                    {showSep && (
                      <tr aria-hidden="true">
                        <td colSpan={6} className="p-0">
                          <div className="h-0.5 bg-kameya-burgundy opacity-40" />
                        </td>
                      </tr>
                    )}
                    <tr className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                      <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                      {LEARNING_COLS.map(col => {
                        const isOn = rule?.sections[col.key] ?? false;
                        const key  = `learn-${row.division}-${row.group ?? ''}-${row.position ?? ''}-${col.key}`;
                        return (
                          <td key={col.key} className="px-4 py-4 text-center">
                            <Toggle on={isOn} busy={saving === key} onToggle={() => handleLearningToggle(row, col.key, !isOn)} />
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">Зміни застосовуються одразу. Адміни мають доступ до всього незалежно від матриці.</p>
    </div>
  );
};
