import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { UserListItem, PointsTransaction } from '../../types';
import { fetchUsers, createUser, updateUser, deleteUser, CreateUserPayload, UpdateUserPayload, getUserPointsHistory, uploadAvatar } from '../../services/usersService';
import { ORG_STRUCTURE, getDivisionLabel, getGroupLabel } from '../../config/org-structure';
import { BadgesModal } from './BadgesModal';
import { formatDate } from '../../utils/dateFormatter';

const generatePassword = (): string => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [rand(upper), rand(lower), rand(digits)];
  for (let i = 3; i < 12; i++) base.push(rand(all));
  return base.sort(() => Math.random() - 0.5).join('');
};

const EMPTY_CREATE: CreateUserPayload = {
  phone: '', password: '', name: '', isAdmin: false, division: 'stores', group: '', position: '',
};

const toDisplay = (phone: string) => {
  const p = phone.startsWith('38') ? phone.slice(2) : phone;
  return `${p.slice(0,3)} ${p.slice(3,6)} ${p.slice(6,8)} ${p.slice(8,10)}`;
};

// ─── Модалка через Portal (рендериться в document.body) ───────────────────────
interface ModalProps { children: React.ReactNode }
const Modal: React.FC<ModalProps> = ({ children }) =>
  ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      {children}
    </div>,
    document.body
  );

// ─── UsersView ─────────────────────────────────────────────────────────────────
export const UsersView: React.FC = () => {
  const [users, setUsers]           = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserPayload>(EMPTY_CREATE);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit
  const [editUser, setEditUser]     = useState<UserListItem | null>(null);
  const [editForm, setEditForm]     = useState<UpdateUserPayload & { division: string; group: string; position: string }>({
    name: '', phone: '', isAdmin: false, division: '', group: '', position: '', password: '',
  });
  const [isEditing, setIsEditing]   = useState(false);
  const [editError, setEditError]   = useState('');

  const [successMsg, setSuccessMsg] = useState('');

  // Badges
  const [badgesUser, setBadgesUser] = useState<UserListItem | null>(null);

  // Points history
  const [pointsUser, setPointsUser] = useState<UserListItem | null>(null);
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);

  const [search, setSearch] = useState('');

  // Sorting
  type SortKey = 'name' | 'isAdmin' | 'division' | 'points';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const q = search.toLowerCase().trim();
  const filteredUsers = q
    ? users.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        (u.position ?? '').toLowerCase().includes(q) ||
        getGroupLabel(u.division, u.group).toLowerCase().includes(q) ||
        getDivisionLabel(u.division).toLowerCase().includes(q)
      )
    : users;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortKey === 'name')     { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    if (sortKey === 'isAdmin')  { av = a.isAdmin ? 1 : 0; bv = b.isAdmin ? 1 : 0; }
    if (sortKey === 'division') { av = getDivisionLabel(a.division).toLowerCase(); bv = getDivisionLabel(b.division).toLowerCase(); }
    if (sortKey === 'points')   { av = a.points ?? 0; bv = b.points ?? 0; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const loadUsers = async () => {
    try {
      setUsers(await fetchUsers());
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── Створення ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      await createUser(createForm);
      showSuccess('Користувача створено та надіслано SMS з даними для входу');
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      loadUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Помилка');
    } finally { setIsCreating(false); }
  };

  // ── Редагування ──
  const openEdit = (u: UserListItem) => {
    setEditUser(u);
    setEditForm({
      name:     u.name,
      phone:    u.phone.startsWith('38') ? u.phone.slice(2) : u.phone,
      isAdmin:  u.isAdmin,
      division: u.division,
      group:    u.group,
      position: u.position,
      password: '',
    });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditError('');
    setIsEditing(true);
    try {
      const payload: UpdateUserPayload = {
        name:     editForm.name,
        phone:    editForm.phone || undefined,
        isAdmin:  editForm.isAdmin,
        division: editForm.division,
        group:    editForm.group,
        position: editForm.position,
        password: editForm.password || undefined,
      };
      const updated = await updateUser(editUser._id, payload);
      setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
      showSuccess('Дані користувача оновлено');
      setEditUser(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Помилка');
    } finally { setIsEditing(false); }
  };

  // ── Видалення ──
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Видалити користувача "${name || toDisplay(id)}"?`)) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch { alert('Помилка видалення'); }
  };

  // ── Історія балів ──
  const openPointsHistory = async (u: UserListItem) => {
    setPointsUser(u);
    setPointsLoading(true);
    try {
      const history = await getUserPointsHistory(u._id);
      setPointsHistory(history);
      const txSum = history.reduce((s, t) => s + t.pointsAwarded, 0);
      setUsers((prev) => prev.map((usr) => usr._id === u._id ? { ...usr, points: txSum } : usr));
      setPointsUser((prev) => prev ? { ...prev, points: txSum } : prev);
    } catch {
      setPointsHistory([]);
    } finally {
      setPointsLoading(false);
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    try {
      const { avatarUrl } = await uploadAvatar(userId, file);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, avatarUrl } : u));
      setEditUser(prev => prev && prev._id === userId ? { ...prev, avatarUrl } : prev);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Користувачі</h2>
          <p className="text-slate-500 mt-1">Управління обліковими записами</p>
        </div>
        <button
          onClick={() => { setCreateForm(EMPTY_CREATE); setCreateError(''); setShowCreate(true); }}
          className="flex items-center space-x-2 bg-kameya-burgundy text-white px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-md"
        >
          <i className="fas fa-user-plus"></i>
          <span>Створити</span>
        </button>
      </header>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm flex items-center space-x-2">
          <i className="fas fa-circle-check"></i>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Пошук */}
      <div className="relative">
        <i className="fas fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Пошук за ім'ям, телефоном, посадою або підрозділом..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
        />
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="fas fa-magnifying-glass text-4xl mb-3"></i>
            <p>{users.length === 0 ? 'Користувачів поки немає' : 'Нікого не знайдено'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {([
                    { key: 'name',     label: "Ім'я / Телефон" },
                    { key: 'isAdmin',  label: 'Роль' },
                    { key: 'division', label: 'Підрозділ / Група' },
                    { key: 'points',   label: 'Бали' },
                  ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs cursor-pointer select-none hover:text-slate-800 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <i className={`fas fa-sort${sortKey === key ? (sortDir === 'asc' ? '-up text-kameya-burgundy' : '-down text-kameya-burgundy') : ' text-slate-300'} text-xs`}></i>
                      </span>
                    </th>
                  ))}
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 overflow-hidden">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                            : (u.name || u.phone).charAt(0).toUpperCase()
                          }
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.name || '—'}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{toDisplay(u.phone)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        u.isAdmin ? 'bg-kameya-burgundy/10 text-kameya-burgundy' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.isAdmin ? 'Адмін' : 'Користувач'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.division === 'stores'   ? 'bg-green-100 text-green-800' :
                        u.division === 'office'   ? 'bg-blue-100 text-blue-800' :
                        u.division === 'security' ? 'bg-slate-700 text-slate-100' :
                                                    'bg-slate-100 text-slate-500'
                      }`}>
                        {u.division ? `${getDivisionLabel(u.division)} / ${getGroupLabel(u.division, u.group) || '—'}` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!u.isAdmin ? (
                        <button
                          onClick={() => openPointsHistory(u)}
                          className="flex items-center gap-1 text-sm font-semibold text-kameya-burgundy hover:opacity-75 transition-opacity"
                          title="Переглянути історію балів"
                        >
                          <i className="fas fa-star text-xs"></i>
                          {u.points ?? 0}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-3">
                        {!u.isAdmin && (
                          <button
                            onClick={() => setBadgesUser(u)}
                            className="text-slate-400 hover:text-amber-500 transition-colors"
                            title="Нагороди"
                          >
                            <i className="fas fa-medal" />
                          </button>
                        )}
                        <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-kameya-burgundy transition-colors" title="Редагувати">
                          <i className="fas fa-pen"></i>
                        </button>
                        <button onClick={() => handleDelete(u._id, u.name)} className="text-slate-300 hover:text-red-500 transition-colors" title="Видалити">
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Модалка СТВОРЕННЯ ── */}
      {showCreate && (
        <Modal>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Новий користувач</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <FormField label="Номер телефону">
                <input type="tel" placeholder="0508098182" value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls} required />
              </FormField>

              <FormField label="Пароль">
                <div className="flex gap-2">
                  <input type="text" placeholder="Пароль для входу" value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className={inputCls} required />
                  <button type="button" title="Згенерувати пароль"
                    onClick={() => setCreateForm((f) => ({ ...f, password: generatePassword() }))}
                    className="flex-shrink-0 px-3 py-3 bg-slate-100 hover:bg-kameya-burgundy/10 hover:text-kameya-burgundy border border-slate-200 rounded-xl text-slate-500 transition-all"
                  >
                    <i className="fas fa-wand-magic-sparkles"></i>
                  </button>
                </div>
              </FormField>

              <FormField label="ПІБ">
                <input type="text" placeholder="Іваненко Іван Іванович" value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} />
              </FormField>

              {/* Division */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Підрозділ</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={createForm.division}
                  onChange={e => setCreateForm(f => ({ ...f, division: e.target.value, group: '', position: '' }))}
                >
                  <option value="">— Оберіть підрозділ —</option>
                  {(Object.entries(ORG_STRUCTURE) as [string, { label: string }][]).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* Group */}
              {createForm.division && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Група</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.group}
                    onChange={e => setCreateForm(f => ({ ...f, group: e.target.value, position: '' }))}
                  >
                    <option value="">— Оберіть групу —</option>
                    {(Object.entries(ORG_STRUCTURE[createForm.division as keyof typeof ORG_STRUCTURE].groups) as [string, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Position */}
              {createForm.division && createForm.group && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Посада</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.position}
                    onChange={e => setCreateForm(f => ({ ...f, position: e.target.value }))}
                  >
                    <option value="">— Оберіть посаду —</option>
                    {[...ORG_STRUCTURE[createForm.division as keyof typeof ORG_STRUCTURE].positions].map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Admin flag */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-isAdmin"
                  checked={createForm.isAdmin}
                  onChange={e => setCreateForm(f => ({ ...f, isAdmin: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="create-isAdmin" className="text-sm font-medium text-slate-700">
                  Адміністратор
                </label>
              </div>

              {createError && <ErrorMsg text={createError} />}

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className={cancelBtn}>Скасувати</button>
                <button type="submit" disabled={isCreating} className={submitBtn}>
                  {isCreating ? <><i className="fas fa-spinner fa-spin"></i><span>Створення...</span></> : <><i className="fas fa-user-plus"></i><span>Створити</span></>}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ── Модалка РЕДАГУВАННЯ ── */}
      {editUser && (
        <Modal>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Редагування: {editUser.name || toDisplay(editUser.phone)}</h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500 overflow-hidden">
                  {editUser?.avatarUrl
                    ? <img src={editUser.avatarUrl} alt={editUser.name} className="w-full h-full object-cover" />
                    : (editUser?.name || editUser?.phone || '?').charAt(0).toUpperCase()
                  }
                </div>
                <label className="cursor-pointer text-xs text-kameya-burgundy hover:opacity-75 transition-opacity">
                  Змінити фото
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file && editUser) handleAvatarUpload(editUser._id, file);
                    }}
                  />
                </label>
              </div>
              <FormField label="ПІБ">
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} />
              </FormField>

              <FormField label="Номер телефону">
                <input type="tel" placeholder="0XXXXXXXXX" value={editForm.phone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls} />
              </FormField>

              {/* Division */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Підрозділ</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editForm.division}
                  onChange={e => setEditForm(f => ({ ...f, division: e.target.value, group: '', position: '' }))}
                >
                  <option value="">— Оберіть підрозділ —</option>
                  {(Object.entries(ORG_STRUCTURE) as [string, { label: string }][]).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* Group */}
              {editForm.division && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Група</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={editForm.group}
                    onChange={e => setEditForm(f => ({ ...f, group: e.target.value, position: '' }))}
                  >
                    <option value="">— Оберіть групу —</option>
                    {(Object.entries(ORG_STRUCTURE[editForm.division as keyof typeof ORG_STRUCTURE].groups) as [string, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Position */}
              {editForm.division && editForm.group && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Посада</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={editForm.position}
                    onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                  >
                    <option value="">— Оберіть посаду —</option>
                    {[...ORG_STRUCTURE[editForm.division as keyof typeof ORG_STRUCTURE].positions].map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Admin flag */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isAdmin"
                  checked={editForm.isAdmin ?? false}
                  onChange={e => setEditForm(f => ({ ...f, isAdmin: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="edit-isAdmin" className="text-sm font-medium text-slate-700">
                  Адміністратор
                </label>
              </div>

              <FormField label="Новий пароль (залиш порожнім щоб не змінювати)">
                <input type="text" placeholder="Новий пароль..." value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls} />
              </FormField>

              {editError && <ErrorMsg text={editError} />}

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setEditUser(null)} className={cancelBtn}>Скасувати</button>
                <button type="submit" disabled={isEditing} className={submitBtn}>
                  {isEditing ? <><i className="fas fa-spinner fa-spin"></i><span>Збереження...</span></> : <><i className="fas fa-floppy-disk"></i><span>Зберегти</span></>}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ── Модалка HISTORY БАЛІВ ── */}
      {badgesUser && (
        <BadgesModal
          user={badgesUser}
          onClose={() => setBadgesUser(null)}
        />
      )}

      {pointsUser && (
        <Modal>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Історія балів</h3>
                <p className="text-sm text-slate-500">{pointsUser.name || toDisplay(pointsUser.phone)}</p>
              </div>
              <button onClick={() => setPointsUser(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {pointsLoading ? (
                <div className="flex justify-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
                </div>
              ) : pointsHistory.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Транзакцій ще немає</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <span className="text-sm text-slate-500">Загальний баланс:</span>
                    <span className="font-bold text-kameya-burgundy text-lg">
                      <i className="fas fa-star text-xs mr-1"></i>
                      {pointsHistory.reduce((s, t) => s + t.pointsAwarded, 0)} балів
                    </span>
                  </div>
                  {pointsHistory.map((tx) => {
                    const reportId = typeof tx.reportId === 'object' ? tx.reportId : null;
                    const label = tx.reason === 'streak'
                        ? `🔥 Стрік ${tx.streakQuarters} кварт. ${tx.streakYear ?? tx.year}`
                        : tx.reason === 'reflection_penalty'
                          ? `Не вчасно заповнена рефлексія ${tx.quarter ?? ''} ${tx.year}`
                          : tx.reason === 'learning_plan_manual'
                            ? (tx.note ?? `За проходження плану навчання ${tx.quarter ?? ''} ${tx.year}`)
                            : tx.reason === 'reflection' || (tx.reason == null && tx.scorePercent === 0)
                              ? `Рефлексія ${tx.quarter ?? ''} ${tx.year}`
                              : `${tx.quarter ?? ''} ${tx.year} — ${Math.floor(tx.scorePercent)}%`;
                    return (
                      <div key={tx._id} className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{label}</p>
                          {reportId?.fileName && (
                            <p className="text-xs text-slate-500">{reportId.fileName}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                          tx.pointsAwarded > 0
                            ? 'bg-green-100 text-green-700'
                            : tx.pointsAwarded < 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-200 text-slate-500'
                        }`}>
                          {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : tx.pointsAwarded < 0 ? `${tx.pointsAwarded}` : '0'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Допоміжні компоненти ──────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all';
const cancelBtn = 'flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all';
const submitBtn = 'flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center space-x-2';

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
    {children}
  </div>
);

const ErrorMsg: React.FC<{ text: string }> = ({ text }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center space-x-2">
    <i className="fas fa-triangle-exclamation"></i>
    <span>{text}</span>
  </div>
);
