import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { UserListItem, STORES, EMPLOYEE_POSITIONS } from '../../types';
import { fetchUsers, createUser, updateUser, deleteUser, CreateUserPayload, UpdateUserPayload } from '../../services/usersService';

const EMPTY_CREATE: CreateUserPayload = {
  phone: '', password: '', name: '', role: 'EMPLOYEE', position: '', store: '',
};

// 380XXXXXXXXX → 050 809 81 82
const toDisplay = (phone: string) => {
  const p = phone.slice(2); // 0XXXXXXXXX
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
  const [editForm, setEditForm]     = useState<UpdateUserPayload & { position: string; store: string }>({ name: '', role: 'EMPLOYEE', position: '', store: '', password: '' });
  const [isEditing, setIsEditing]   = useState(false);
  const [editError, setEditError]   = useState('');

  const [successMsg, setSuccessMsg] = useState('');

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
    setEditForm({ name: u.name, role: u.role, position: u.position ?? '', store: u.store ?? '', password: '' });
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
        role:     editForm.role,
        position: editForm.role === 'EMPLOYEE' ? editForm.position : undefined,
        store:    editForm.role === 'EMPLOYEE' ? editForm.store    : undefined,
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

      {/* Таблиця */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="fas fa-users text-4xl mb-3"></i>
            <p>Користувачів поки немає</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Ім'я / Телефон</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Роль</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Посада</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Магазин</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{u.name || '—'}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{toDisplay(u.phone)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        u.role === 'ADMIN' ? 'bg-kameya-burgundy/10 text-kameya-burgundy' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {u.role === 'ADMIN' ? 'Адмін' : 'Працівник'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{u.role === 'ADMIN' ? 'Адміністратор' : (u.position || '—')}</td>
                    <td className="px-6 py-4 text-slate-600">{u.store || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-3">
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
              {/* Тип */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Тип аккаунту</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['EMPLOYEE', 'ADMIN'] as const).map((r) => (
                    <button key={r} type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, role: r, position: '', store: '' }))}
                      className={`py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                        createForm.role === r ? 'border-kameya-burgundy bg-kameya-burgundy/5 text-kameya-burgundy' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {r === 'EMPLOYEE' ? 'Працівник' : 'Адмін'}
                    </button>
                  ))}
                </div>
              </div>

              <FormField label="Номер телефону">
                <input type="tel" placeholder="0508098182" value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls} required />
              </FormField>

              <FormField label="Пароль">
                <input type="text" placeholder="Пароль для входу" value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls} required />
              </FormField>

              {createForm.role === 'EMPLOYEE' && (
                <>
                  <FormField label="ПІБ">
                    <input type="text" placeholder="Іваненко Іван Іванович" value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls} required />
                  </FormField>
                  <FormField label="Посада">
                    <select value={createForm.position}
                      onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))}
                      className={inputCls} required>
                      <option value="">Оберіть посаду</option>
                      {EMPLOYEE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Магазин">
                    <select value={createForm.store}
                      onChange={(e) => setCreateForm((f) => ({ ...f, store: e.target.value }))}
                      className={inputCls} required>
                      <option value="">Оберіть магазин</option>
                      {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                </>
              )}

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
              <FormField label="ПІБ">
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} />
              </FormField>

              <FormField label="Роль">
                <div className="grid grid-cols-2 gap-2">
                  {(['EMPLOYEE', 'ADMIN'] as const).map((r) => (
                    <button key={r} type="button"
                      onClick={() => setEditForm((f) => ({ ...f, role: r, position: '', store: '' }))}
                      className={`py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                        editForm.role === r ? 'border-kameya-burgundy bg-kameya-burgundy/5 text-kameya-burgundy' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {r === 'EMPLOYEE' ? 'Працівник' : 'Адмін'}
                    </button>
                  ))}
                </div>
              </FormField>

              {editForm.role === 'EMPLOYEE' && (
                <>
                  <FormField label="Посада">
                    <select value={editForm.position}
                      onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                      className={inputCls}>
                      <option value="">Оберіть посаду</option>
                      {EMPLOYEE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Магазин">
                    <select value={editForm.store}
                      onChange={(e) => setEditForm((f) => ({ ...f, store: e.target.value }))}
                      className={inputCls}>
                      <option value="">Оберіть магазин</option>
                      {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                </>
              )}

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
