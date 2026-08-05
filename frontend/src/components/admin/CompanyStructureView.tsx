import React, { useEffect, useState } from 'react';
import { UserListItem } from '../../types';
import { fetchUsers } from '../../services/usersService';
import { ORG_STRUCTURE, getDivisionLabel, getGroupLabel } from '../../config/org-structure';

const DIVISION_ORDER = ['office', 'stores', 'security'] as const;
type Div = typeof DIVISION_ORDER[number];

// ─── UserCard ──────────────────────────────────────────────────────────────────
const UserCard: React.FC<{ user: UserListItem; isManager: boolean }> = ({ user, isManager }) => {
  const [imgError, setImgError] = useState(false);
  const initial = (user.name || user.phone).charAt(0).toUpperCase();

  return (
    <div
      className="bg-white rounded-2xl shadow-sm flex flex-col items-center text-center p-3 gap-2"
      style={{ width: isManager ? '118px' : '96px' }}
    >
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-kameya-burgundy/10 ${
          isManager ? 'w-20 h-20' : 'w-14 h-14'
        }`}
      >
        {user.avatarUrl && !imgError ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`font-bold text-kameya-burgundy ${isManager ? 'text-2xl' : 'text-lg'}`}>
            {initial}
          </span>
        )}
      </div>
      <div className="w-full overflow-hidden">
        <p className="text-xs font-semibold text-slate-800 leading-tight truncate">
          {user.name || user.phone}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{user.position}</p>
      </div>
    </div>
  );
};

// ─── helpers ───────────────────────────────────────────────────────────────────
type GroupedUsers = Record<string, Record<string, UserListItem[]>>;

function buildGrouped(users: UserListItem[]): GroupedUsers {
  const result: GroupedUsers = {};
  for (const div of DIVISION_ORDER) {
    result[div] = {};
    for (const groupKey of Object.keys(ORG_STRUCTURE[div].groups)) {
      result[div][groupKey] = [];
    }
  }
  for (const u of users) {
    if (u.division && u.group && result[u.division]?.[u.group]) {
      result[u.division][u.group].push(u);
    }
  }
  return result;
}

function sortGroup(users: UserListItem[]): UserListItem[] {
  return [...users].sort((a, b) => (a.position === 'Керівник' ? 0 : 1) - (b.position === 'Керівник' ? 0 : 1));
}

// ─── CompanyStructureView ──────────────────────────────────────────────────────
export const CompanyStructureView: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers()
      .then(data => { setUsers(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const grouped = buildGrouped(users);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-kameya-burgundy text-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Структура компанії</h1>

      {DIVISION_ORDER.map(div => {
        const divGroups = Object.entries(grouped[div]).filter(([, members]) => members.length > 0);
        if (!divGroups.length) return null;

        return (
          <section key={div}>
            <h2 className="text-base font-bold text-white bg-kameya-burgundy px-5 py-3 rounded-t-2xl tracking-wide">
              {getDivisionLabel(div)}
            </h2>
            <div className="rounded-b-2xl p-5 space-y-6" style={{ backgroundColor: '#fce9ef' }}>
              {divGroups.map(([groupKey, members]) => (
                <div key={groupKey}>
                  <p className="text-[11px] font-bold text-kameya-burgundy uppercase tracking-widest mb-3">
                    {getGroupLabel(div, groupKey)}
                  </p>
                  <div className="flex flex-wrap gap-3 items-end">
                    {sortGroup(members).map(u => (
                      <UserCard key={u._id} user={u} isManager={u.position === 'Керівник'} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
