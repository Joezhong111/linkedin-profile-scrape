import React, { useEffect, useState } from 'react';
import { getQuota, setQuota, updatePassword, deleteUser } from '../services/admin';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface QuotaItem {
  user_id: string;
  email: string;
  monthly_limit: number;
  used_count: number;
  period_start: string;
  period_end: string;
}

export default function UserManager() {
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Password Reset
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadQuotas = async () => {
    try {
      setLoading(true);
      const data = await getQuota();
      setQuotas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load quotas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotas();
  }, []);

  const filteredQuotas = quotas.filter((q) =>
    (q.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (email: string, currentLimit: number) => {
    setEditingEmail(email);
    setEditValue(String(currentLimit));
  };

  const cancelEdit = () => {
    setEditingEmail(null);
    setEditValue('');
  };

  const saveEdit = async (email: string) => {
    try {
      setSaving(true);
      const newLimit = Number(editValue);
      if (!Number.isFinite(newLimit) || newLimit < 0) {
        alert('请输入有效的配额数值');
        return;
      }
      await setQuota(email, newLimit);
      await loadQuotas();
      setEditingEmail(null);
      setEditValue('');
    } catch (e: any) {
      alert(e?.message || '保存失败');
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
    } catch (e: any) {
      alert(e?.message || '密码重置失败');
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
      await loadQuotas();
    } catch (e: any) {
      alert(e?.message || '用户删除失败');
    } finally {
      setSaving(false);
    }
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    if (percentage >= 100) return 'text-red-600 bg-red-50';
    if (percentage >= 80) return 'text-orange-600 bg-orange-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getProgressColor = (used: number, limit: number) => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
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
              重置用户 <b>{quotas.find((q) => q.user_id === resettingUserId)?.email}</b>{' '}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            User Management & Quotas
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage users, passwords, and monthly scraping limits
          </p>
        </div>
        <button
          onClick={loadQuotas}
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
            placeholder="Search by user email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-300 font-medium">Total Users</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {filteredQuotas.length}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-100 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-300 font-medium">
            Healthy (&lt;50%)
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
            {
              filteredQuotas.filter(
                (q) => q.monthly_limit > 0 && q.used_count / q.monthly_limit < 0.5
              ).length
            }
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-100 dark:border-orange-800">
          <div className="text-sm text-orange-600 dark:text-orange-300 font-medium">
            Warning (80%+)
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
            {
              filteredQuotas.filter(
                (q) =>
                  q.monthly_limit > 0 &&
                  q.used_count / q.monthly_limit >= 0.8 &&
                  q.used_count / q.monthly_limit < 1
              ).length
            }
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 border border-red-100 dark:border-red-800">
          <div className="text-sm text-red-600 dark:text-red-300 font-medium">Over Limit</div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
            {
              filteredQuotas.filter((q) => q.monthly_limit > 0 && q.used_count >= q.monthly_limit)
                .length
            }
          </div>
        </div>
      </div>

      {/* Quota Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                User Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Monthly Limit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Monthly Usage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Period
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {filteredQuotas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400"
                >
                  No users found
                </td>
              </tr>
            ) : (
              filteredQuotas.map((quota) => {
                const percentage =
                  quota.monthly_limit > 0 ? (quota.used_count / quota.monthly_limit) * 100 : 0;
                const isEditing = editingEmail === quota.email;

                return (
                  <tr
                    key={quota.user_id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {quota.email}
                        </span>
                        <code className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                          {quota.user_id}
                        </code>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {quota.monthly_limit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getUsageColor(quota.used_count, quota.monthly_limit)}`}
                          >
                            {quota.used_count} used
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-32 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all ${getProgressColor(quota.used_count, quota.monthly_limit)}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                      <div className="flex flex-col">
                        <span>From: {formatDate(quota.period_start)}</span>
                        <span>To: {formatDate(quota.period_end)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(quota.email)}
                              disabled={saving}
                              className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                              title="Save"
                            >
                              <CheckIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="p-1 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Cancel"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(quota.email, quota.monthly_limit)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Edit Quota"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setResettingUserId(quota.user_id)}
                              className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <KeyIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(quota.user_id, quota.email)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-xs text-gray-500 dark:text-slate-400">
        Showing {filteredQuotas.length} of {quotas.length} users
      </div>
    </div>
  );
}
