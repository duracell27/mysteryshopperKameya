import React, { useEffect, useState } from 'react';
import { OnboardingTrainee, AdminDayPlan, UserListItem } from '../../types';
import {
  getAllTrainees, createTrainee, updateTraineeStartDate, deleteTrainee,
  getDayPlans, createDay, deleteDay, addTask, updateTask, deleteTask, setDayHoliday,
  analyzeTrainee,
} from '../../services/onboardingService';
import { fetchUsers } from '../../services/usersService';

type Tab = 'trainees' | 'dayplans';
type TaskType = 'theory' | 'practice' | 'meeting' | 'observation' | 'other';

const TYPE_LABELS: Record<TaskType, string> = {
  theory: 'Теорія', practice: 'Практика', meeting: 'Зустріч',
  observation: 'Спостереження', other: 'Інше',
};

export const AdminOnboardingView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('trainees');

  // ── Стажери ─────────────────────────────────────────────────────────────────
  const [trainees, setTrainees] = useState<OnboardingTrainee[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [traineesLoading, setTraineesLoading] = useState(true);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [showAddTrainee, setShowAddTrainee] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addStartDate, setAddStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [addLoading, setAddLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState<{ id: string; value: string } | null>(null);

  // ── Плани ────────────────────────────────────────────────────────────────────
  const [dayPlans, setDayPlans] = useState<AdminDayPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanDay, setSelectedPlanDay] = useState<number | null>(null);
  const [newDayNum, setNewDayNum] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', type: 'other' as TaskType });
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskData, setEditTaskData] = useState({ title: '', description: '', type: 'other' as TaskType });
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    Promise.all([getAllTrainees(), fetchUsers()])
      .then(([t, u]) => {
        setTrainees(t);
        setUsers(u);
        if (t.length > 0) setSelectedTraineeId(t[0].id);
      })
      .finally(() => setTraineesLoading(false));
  }, []);

  useEffect(() => {
    getDayPlans()
      .then((plans) => {
        setDayPlans(plans);
        if (plans.length > 0) setSelectedPlanDay(plans[0].day);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const selectedTrainee = trainees.find((t) => t.id === selectedTraineeId) ?? null;
  const selectedPlan = dayPlans.find((p) => p.day === selectedPlanDay) ?? null;

  const traineeUserIds = new Set(trainees.map((t) => t.userId));
  const availableUsers = users.filter((u) => !u.isAdmin && !traineeUserIds.has(u._id));

  const totalPlanTasks = dayPlans.reduce((sum, p) => sum + p.tasks.length, 0);

  const sortedTrainees = [...trainees].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    const now = new Date();
    const aFuture = new Date(a.startDate) > now;
    const bFuture = new Date(b.startDate) > now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const handleAddTrainee = async () => {
    if (!addUserId) return;
    setAddLoading(true);
    try {
      const created = await createTrainee(addUserId, addStartDate);
      setTrainees((prev) => [...prev, created]);
      setSelectedTraineeId(created.id);
      setShowAddTrainee(false);
      setAddUserId('');
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteTrainee = async (id: string) => {
    if (!confirm('Видалити профіль стажера? Прогрес буде втрачено.')) return;
    try {
      await deleteTrainee(id);
      setTrainees((prev) => prev.filter((t) => t.id !== id));
      setSelectedTraineeId(null);
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  const handleUpdateStartDate = async (id: string, date: string) => {
    try {
      const updated = await updateTraineeStartDate(id, date);
      setTrainees((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditStartDate(null);
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  const handleAnalyze = async (trainee: OnboardingTrainee) => {
    setAiLoading(true);
    try {
      await analyzeTrainee(trainee.id, trainee.name, trainee.days);
      const updated = await getAllTrainees();
      setTrainees(updated);
      const found = updated.find((t) => t.id === trainee.id);
      if (found && found.aiReports[0]) setOpenReportId(found.aiReports[0].id);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddDay = async () => {
    const n = Number(newDayNum);
    if (!n || n < 1 || n > 60) { setPlanError('Введіть число від 1 до 60'); return; }
    setPlanError('');
    try {
      const plan = await createDay(n);
      setDayPlans((prev) => [...prev, plan].sort((a, b) => a.day - b.day));
      setSelectedPlanDay(plan.day);
      setNewDayNum('');
    } catch (err: unknown) { setPlanError((err as Error).message); }
  };

  const handleDeleteDay = async (day: number) => {
    if (!confirm(`Видалити день ${day} з усіма задачами?`)) return;
    await deleteDay(day);
    setDayPlans((prev) => prev.filter((p) => p.day !== day));
    setSelectedPlanDay(null);
  };

  const handleToggleHoliday = async (day: number, current: boolean) => {
    try {
      const updated = await setDayHoliday(day, !current);
      setDayPlans((prev) => prev.map((p) => (p.day === day ? updated : p)));
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  const handleAddTask = async () => {
    if (!selectedPlanDay || !newTask.title.trim()) return;
    try {
      const updated = await addTask(selectedPlanDay, newTask);
      setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
      setNewTask({ title: '', description: '', type: 'other' });
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  const handleSaveTask = async (taskId: string) => {
    if (!selectedPlanDay) return;
    try {
      const updated = await updateTask(selectedPlanDay, taskId, editTaskData);
      setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
      setEditTaskId(null);
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedPlanDay) return;
    try {
      const updated = await deleteTask(selectedPlanDay, taskId);
      setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : 'невідома помилка'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Онбординг 14 днів</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {(['trainees', 'dayplans'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white shadow text-kameya-burgundy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'trainees' ? 'Стажери' : 'Управління планом'}
          </button>
        ))}
      </div>

      {/* ── Tab: Стажери ── */}
      {tab === 'trainees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Список */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-600">Список стажерів</span>
              <button
                onClick={() => setShowAddTrainee(true)}
                className="text-xs text-kameya-burgundy hover:underline font-medium"
              >
                + Додати
              </button>
            </div>

            {showAddTrainee && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                >
                  <option value="">Виберіть користувача</option>
                  {availableUsers.map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.position})</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={addStartDate}
                  onChange={(e) => setAddStartDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTrainee}
                    disabled={addLoading || !addUserId}
                    className="flex-1 bg-kameya-burgundy text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {addLoading ? 'Створення...' : 'Створити'}
                  </button>
                  <button
                    onClick={() => setShowAddTrainee(false)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            )}

            {traineesLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Завантаження...</div>
            ) : trainees.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">Стажерів ще немає</div>
            ) : (() => {
                const now = new Date();
                const upcoming = sortedTrainees.filter((t) => !t.isCompleted && new Date(t.startDate) > now);
                const active   = sortedTrainees.filter((t) => !t.isCompleted && new Date(t.startDate) <= now);
                const done     = sortedTrainees.filter((t) => t.isCompleted);

                const renderCard = (t: typeof sortedTrainees[0], isFuture: boolean) => {
                  const completedTasks = t.days.reduce((sum, d) => sum + d.tasks.filter((tk) => tk.completed).length, 0);
                  const progress = totalPlanTasks > 0 ? Math.round((completedTasks / totalPlanTasks) * 100) : 0;
                  const startStr = new Date(t.startDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
                  const endDate = t.endDate ? new Date(t.endDate) : new Date(new Date(t.startDate).getTime() + 14 * 24 * 60 * 60 * 1000);
                  const endStr = endDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTraineeId(t.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                        selectedTraineeId === t.id
                          ? 'border-kameya-burgundy bg-kameya-burgundy/5'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          t.isCompleted ? 'bg-green-100 text-green-700' :
                          isFuture ? 'bg-amber-100 text-amber-700' :
                          'bg-kameya-burgundy/10 text-kameya-burgundy'
                        }`}>
                          {t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                            <span className="text-[11px] text-slate-400 shrink-0">{progress}%</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {startStr} — {endStr}
                            {isFuture && (() => {
                              const days = Math.ceil((new Date(t.startDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              return <span className="ml-1.5 text-amber-600 font-medium">· через {days} {days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'}</span>;
                            })()}
                          </p>
                          <div className="mt-1.5 h-1 bg-slate-100 rounded-full">
                            <div
                              className={`h-full rounded-full transition-all ${t.isCompleted ? 'bg-green-500' : isFuture ? 'bg-amber-400' : 'bg-kameya-burgundy'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                };

                const SectionLabel = ({ label, count, color }: { label: string; count: number; color: string }) => (
                  <div className={`flex items-center gap-2 px-1 pt-1 pb-0.5`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                    <span className="text-[11px] text-slate-300 font-medium">{count}</span>
                  </div>
                );

                return (
                  <>
                    {upcoming.length > 0 && (
                      <>
                        <SectionLabel label="Очікують" count={upcoming.length} color="bg-amber-400" />
                        {upcoming.map((t) => renderCard(t, true))}
                      </>
                    )}
                    {active.length > 0 && (
                      <>
                        <SectionLabel label="Проходять" count={active.length} color="bg-kameya-burgundy" />
                        {active.map((t) => renderCard(t, false))}
                      </>
                    )}
                    {done.length > 0 && (
                      <>
                        <SectionLabel label="Завершили" count={done.length} color="bg-green-500" />
                        {done.map((t) => renderCard(t, false))}
                      </>
                    )}
                  </>
                );
              })()
            }
          </div>

          {/* Деталі стажера */}
          <div className="lg:col-span-2">
            {!selectedTrainee ? (
              <div className="text-center py-16 text-slate-400 text-sm">Оберіть стажера зліва</div>
            ) : (
              <div className="space-y-4">
                {/* Заголовок */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{selectedTrainee.name}</h3>
                      <p className="text-sm text-slate-400">{selectedTrainee.position}</p>
                      {editStartDate?.id === selectedTrainee.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="date"
                            value={editStartDate.value}
                            onChange={(e) => setEditStartDate({ id: selectedTrainee.id, value: e.target.value })}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-kameya-burgundy"
                          />
                          <button
                            onClick={() => handleUpdateStartDate(selectedTrainee.id, editStartDate.value)}
                            className="text-xs text-kameya-burgundy font-semibold"
                          >Зберегти</button>
                          <button onClick={() => setEditStartDate(null)} className="text-xs text-slate-400">Скасувати</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditStartDate({ id: selectedTrainee.id, value: new Date(selectedTrainee.startDate).toISOString().slice(0, 10) })}
                          className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-kameya-burgundy/10 hover:text-kameya-burgundy px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <i className="fas fa-calendar-alt text-[10px]" />
                          Початок: {new Date(selectedTrainee.startDate).toLocaleDateString('uk-UA')}
                          <i className="fas fa-pen text-[9px] opacity-60" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyze(selectedTrainee)}
                        disabled={aiLoading || !selectedTrainee.days.some((d) => d.reflection)}
                        className="text-xs bg-kameya-burgundy text-white rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                      >
                        {aiLoading ? 'Аналіз...' : 'AI аналіз'}
                      </button>
                      <button
                        onClick={() => handleDeleteTrainee(selectedTrainee.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-2"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI звіти */}
                {selectedTrainee.aiReports.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Звіти</p>
                    {selectedTrainee.aiReports.map((r) => (
                      <div key={r.id} className="bg-white rounded-xl border border-slate-200">
                        <button
                          onClick={() => setOpenReportId(openReportId === r.id ? null : r.id)}
                          className="w-full flex items-center justify-between p-4 text-left"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            Аналіз ({r.daysCount} рефлексій) —{' '}
                            {new Date(r.createdAt).toLocaleDateString('uk-UA')}
                          </span>
                          <i className={`fas fa-chevron-${openReportId === r.id ? 'up' : 'down'} text-slate-400 text-xs`} />
                        </button>
                        {openReportId === r.id && (
                          <div className="px-4 pb-4 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {r.analysis}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Дні і рефлексії */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Прогрес по днях</p>
                  {selectedTrainee.days.map((d) => (
                    <div
                      key={d.day}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedTraineeId(expandedTraineeId === `${selectedTrainee.id}-${d.day}` ? null : `${selectedTrainee.id}-${d.day}`)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            d.tasks.every((t) => t.completed) && d.tasks.length > 0
                              ? 'bg-green-100 text-green-700'
                              : d.isPreview ? 'bg-slate-100 text-slate-400' : 'bg-kameya-burgundy/10 text-kameya-burgundy'
                          }`}>{d.day}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              День {d.day}{d.isHoliday ? ' · Відпочинок' : ''}
                            </p>
                            <p className="text-xs text-slate-400">
                              {d.tasks.filter((t) => t.completed).length}/{d.tasks.length} задач
                              {d.reflection ? ' · Рефлексія ✓' : ''}
                            </p>
                          </div>
                        </div>
                        <i className={`fas fa-chevron-${expandedTraineeId === `${selectedTrainee.id}-${d.day}` ? 'up' : 'down'} text-slate-400 text-xs`} />
                      </button>

                      {expandedTraineeId === `${selectedTrainee.id}-${d.day}` && d.reflection && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-500">Рефлексія</p>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                              { label: 'Настрій', val: d.reflection.q1 },
                              { label: 'Матеріал', val: d.reflection.q2 },
                              { label: 'Комфорт', val: d.reflection.q3 },
                              { label: 'Лояльність', val: d.reflection.q5 },
                            ].map(({ label, val }) => (
                              <div key={label} className="bg-slate-50 rounded-lg p-2">
                                <p className="text-lg font-bold text-kameya-burgundy">{val}</p>
                                <p className="text-[10px] text-slate-400">{label}</p>
                              </div>
                            ))}
                          </div>
                          {d.reflection.q4 && (
                            <p className="text-xs text-slate-500 mt-2">
                              <span className="font-medium">Стресори:</span> {d.reflection.q4}
                            </p>
                          )}
                          {d.reflection.comments && (
                            <p className="text-xs text-slate-500 italic">"{d.reflection.comments}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Управління планом ── */}
      {tab === 'dayplans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Список днів */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-600 mb-1">Дні</p>
            {plansLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Завантаження...</div>
            ) : (
              <>
                {dayPlans.map((p) => (
                  <button
                    key={p.day}
                    onClick={() => setSelectedPlanDay(p.day)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      selectedPlanDay === p.day
                        ? 'border-kameya-burgundy bg-kameya-burgundy/5'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      День {p.day}
                      {p.isHoliday && <span className="ml-2 text-xs font-normal text-slate-400">· Відпочинок</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.tasks.length} задач</p>
                  </button>
                ))}

                {/* Додати день */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newDayNum}
                    onChange={(e) => setNewDayNum(e.target.value)}
                    placeholder="День №"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                  />
                  <button
                    onClick={handleAddDay}
                    disabled={!newDayNum}
                    className="px-3 py-2 bg-kameya-burgundy text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                {planError && <p className="text-xs text-red-500">{planError}</p>}
              </>
            )}
          </div>

          {/* Задачі дня */}
          <div className="lg:col-span-2">
            {!selectedPlan ? (
              <div className="text-center py-16 text-slate-400 text-sm">Оберіть день зліва</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800">День {selectedPlan.day}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleHoliday(selectedPlan.day, selectedPlan.isHoliday)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          selectedPlan.isHoliday
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <i className={`fas fa-umbrella-beach text-[10px] ${selectedPlan.isHoliday ? 'text-amber-500' : 'text-slate-400'}`} />
                        Вихідний
                      </button>
                      <button
                        onClick={() => handleDeleteDay(selectedPlan.day)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 bg-white hover:bg-red-50 hover:border-red-300 transition-all"
                      >
                        <i className="fas fa-trash text-[10px]" />
                        Видалити
                      </button>
                    </div>
                  </div>

                  {/* Задачі */}
                  <div className="space-y-2 mb-4">
                    {selectedPlan.tasks.map((task) => (
                      <div key={task._id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        {editTaskId === task._id ? (
                          <div className="space-y-2">
                            <input
                              value={editTaskData.title}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, title: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                              placeholder="Назва"
                            />
                            <input
                              value={editTaskData.description}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, description: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                              placeholder="Опис"
                            />
                            <select
                              value={editTaskData.type}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, type: e.target.value as TaskType }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                            >
                              {(Object.keys(TYPE_LABELS) as TaskType[]).map((k) => (
                                <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveTask(task._id)} className="flex-1 bg-kameya-burgundy text-white rounded-lg py-1.5 text-sm font-semibold">Зберегти</button>
                              <button onClick={() => setEditTaskId(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">Скасувати</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mr-2
                                ${task.type === 'theory' ? 'bg-violet-100 text-violet-700' :
                                  task.type === 'practice' ? 'bg-emerald-100 text-emerald-700' :
                                  task.type === 'meeting' ? 'bg-amber-100 text-amber-700' :
                                  task.type === 'observation' ? 'bg-sky-100 text-sky-700' :
                                  'bg-slate-100 text-slate-500'}`}>
                                {TYPE_LABELS[task.type]}
                              </span>
                              <span className="text-sm font-medium text-slate-800">{task.title}</span>
                              {task.description && (
                                <p className="text-xs text-slate-400 mt-1">{task.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEditTaskId(task._id); setEditTaskData({ title: task.title, description: task.description, type: task.type }); }}
                                className="text-slate-400 hover:text-kameya-burgundy p-1"
                              >
                                <i className="fas fa-pen text-xs" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task._id)}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                <i className="fas fa-trash text-xs" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedPlan.tasks.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-3">Задач ще немає</p>
                    )}
                  </div>

                  {/* Нова задача */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Нова задача</p>
                    <input
                      value={newTask.title}
                      onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                      placeholder="Назва задачі"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    />
                    <input
                      value={newTask.description}
                      onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                      placeholder="Опис (необов'язково)"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    />
                    <select
                      value={newTask.type}
                      onChange={(e) => setNewTask((t) => ({ ...t, type: e.target.value as TaskType }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    >
                      {(Object.keys(TYPE_LABELS) as TaskType[]).map((k) => (
                        <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTask.title.trim()}
                      className="w-full bg-kameya-burgundy text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Додати задачу
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
