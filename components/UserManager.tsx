import { useEffect, useState } from 'react';
import {
  listUsers,
  updatePassword,
  updateRole,
  deleteUser,
  type AdminRole,
  type AdminUser,
} from '../services/admin';
import { MagnifyingGlassIcon, KeyIcon, TrashIcon } from '@heroicons/react/24/outline';

interface UserManagerProps {
  refreshKey?: number;
}

export default function UserManager({ refreshKey = 0 }: UserManagerProps) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Password Reset
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setUsers(await listUsers());
    } catch (e: unknown) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [refreshKey]);

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      (user.email || '').toLowerCase().includes(term) ||
      (user.full_name || '').toLowerCase().includes(term)
    );
  });

  const handleRoleChange = async (user: AdminUser, role: AdminRole) => {
    try {
      setSaving(true);
      await updateRole(user.user_id, role);
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '角色更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUserId) return;
    if (!newPassword) {
      alert('请输入新密码');
      return;
    }
    try {
      setSaving(true);
      await updatePassword(resettingUserId, newPassword);
      alert('密码已重置');
      setResettingUserId(null);
      setNewPassword('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '密码重置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user_id: string, email: string) => {
    if (!confirm(`确定要彻底删除用户 ${email} 吗？此操作不可逆，将清除该用户的所有任务和数据。`)) {
      return;
    }
    try {
      setSaving(true);
      await deleteUser(user_id);
      alert('用户已删除');
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '用户删除失败');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
        <div className="text-center text-gray-500 dark:text-slate-400">
          Loading user management...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 relative">
      {/* Password Reset Modal Overlay */}
      {resettingUserId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">重置用户密码</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              重置用户 <b>{users.find((u) => u.user_id === resettingUserId)?.email}</b>{' '}
              的登录密码。
            </p>
            <input
              type="password"
              placeholder="输入新密码"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setResettingUserId(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                确定重置
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage users, roles, passwords, and credentials visibility
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by user email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-300 font-medium">Total Users</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {filteredUsers.length}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-100 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-300 font-medium">Admins</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
            {filteredUsers.filter((user) => user.role === 'admin').length}
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-100 dark:border-orange-800">
          <div className="text-sm text-orange-600 dark:text-orange-300 font-medium">
            Credentials Configured
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
            {filteredUsers.filter((user) => user.has_credential).length}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Credential
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400"
                >
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.user_id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.email}
                      </span>
                      {user.full_name && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {user.full_name}
                        </span>
                      )}
                      <code className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                        {user.user_id}
                      </code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as AdminRole)}
                      disabled={saving}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          user.has_credential
                            ? 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300'
                            : 'text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {user.has_credential ? 'Configured' : 'Not configured'}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                        Active provider: {user.active_provider ?? 'none'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setResettingUserId(user.user_id)}
                        className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.user_id, user.email)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-xs text-gray-500 dark:text-slate-400">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}
