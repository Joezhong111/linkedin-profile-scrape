import React, { useEffect, useState } from "react";
import { getQuota, setQuota } from "../services/admin";
import {
    MagnifyingGlassIcon,
    PencilIcon,
    CheckIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface QuotaItem {
    user_id: string;
    email: string;
    monthly_limit: number;
    used_count: number;
    period_start: string;
    period_end: string;
}

export default function QuotaManager() {
    const [loading, setLoading] = useState(true);
    const [quotas, setQuotas] = useState<QuotaItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [saving, setSaving] = useState(false);

    const loadQuotas = async () => {
        try {
            setLoading(true);
            const data = await getQuota();
            setQuotas(Array.isArray(data) ? data : []);
        } catch (e: any) {
            console.error("Failed to load quotas:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQuotas();
    }, []);

    const filteredQuotas = quotas.filter((q) =>
        (q.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const startEdit = (email: string, currentLimit: number) => {
        setEditingEmail(email);
        setEditValue(String(currentLimit));
    };

    const cancelEdit = () => {
        setEditingEmail(null);
        setEditValue("");
    };

    const saveEdit = async (email: string) => {
        try {
            setSaving(true);
            const newLimit = Number(editValue);
            if (!Number.isFinite(newLimit) || newLimit < 0) {
                alert("请输入有效的配额数值");
                return;
            }
            await setQuota(email, newLimit);
            await loadQuotas();
            setEditingEmail(null);
            setEditValue("");
        } catch (e: any) {
            alert(e?.message || "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const getUsageColor = (used: number, limit: number) => {
        const percentage = limit > 0 ? (used / limit) * 100 : 0;
        if (percentage >= 100) return "text-red-600 bg-red-50";
        if (percentage >= 80) return "text-orange-600 bg-orange-50";
        if (percentage >= 50) return "text-yellow-600 bg-yellow-50";
        return "text-green-600 bg-green-50";
    };

    const getProgressColor = (used: number, limit: number) => {
        const percentage = limit > 0 ? (used / limit) * 100 : 0;
        if (percentage >= 100) return "bg-red-500";
        if (percentage >= 80) return "bg-orange-500";
        if (percentage >= 50) return "bg-yellow-500";
        return "bg-green-500";
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="bg-white border rounded-xl p-6">
                <div className="text-center text-gray-500">Loading monthly quotas...</div>
            </div>
        );
    }

    return (
        <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Monthly Quota Management</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage monthly scraping limits and track periods
                    </p>
                </div>
                <button
                    onClick={loadQuotas}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by user email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="text-sm text-blue-600 font-medium">Total Users</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">{filteredQuotas.length}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="text-sm text-green-600 font-medium">Healthy (&lt;50%)</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                        {filteredQuotas.filter((q) => q.monthly_limit > 0 && (q.used_count / q.monthly_limit) < 0.5).length}
                    </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Warning (80%+)</div>
                    <div className="text-2xl font-bold text-orange-900 mt-1">
                        {filteredQuotas.filter((q) => q.monthly_limit > 0 && (q.used_count / q.monthly_limit) >= 0.8 && (q.used_count / q.monthly_limit) < 1).length}
                    </div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                    <div className="text-sm text-red-600 font-medium">Over Limit</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">
                        {filteredQuotas.filter((q) => q.monthly_limit > 0 && q.used_count >= q.monthly_limit).length}
                    </div>
                </div>
            </div>

            {/* Quota Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monthly Limit
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monthly Usage
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Period
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredQuotas.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                    No quotas found
                                </td>
                            </tr>
                        ) : (
                            filteredQuotas.map((quota) => {
                                const percentage = quota.monthly_limit > 0 ? (quota.used_count / quota.monthly_limit) * 100 : 0;
                                const isEditing = editingEmail === quota.email;

                                return (
                                    <tr key={quota.user_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{quota.email}</span>
                                                <code className="text-[10px] font-mono text-gray-400">{quota.user_id}</code>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-24 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-gray-900">{quota.monthly_limit}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getUsageColor(quota.used_count, quota.monthly_limit)}`}>
                                                        {quota.used_count} used
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="w-32 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all ${getProgressColor(quota.used_count, quota.monthly_limit)}`}
                                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            <div className="flex flex-col">
                                                <span>From: {formatDate(quota.period_start)}</span>
                                                <span>To: {formatDate(quota.period_end)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => saveEdit(quota.email)}
                                                        disabled={saving}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Save"
                                                    >
                                                        <CheckIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                        className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEdit(quota.email, quota.monthly_limit)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit Limit"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Info */}
            <div className="mt-4 text-xs text-gray-500">
                Showing {filteredQuotas.length} of {quotas.length} users • Updated: {quotas[0]?.day || "N/A"}
            </div>
        </div>
    );
}
