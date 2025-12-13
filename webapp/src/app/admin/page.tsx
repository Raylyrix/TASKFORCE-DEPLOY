"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  Mail,
  TrendingUp,
  Database,
  Trash2,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Activity,
  PieChart,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

import { api } from "@/lib/api";

async function checkIsAdmin(): Promise<boolean> {
  try {
    const result = await api.admin.checkIsAdmin();
    return result.isAdmin;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [deleteConfig, setDeleteConfig] = useState({
    completedCampaigns: 365,
    draftCampaigns: 180,
    sentMessages: 365,
    trackingEvents: 365,
    calendarCache: 30,
    emailDrafts: 180,
    oldBookings: 730,
  });

  // Check admin status
  useEffect(() => {
    checkIsAdmin().then((admin) => {
      setIsAdmin(admin);
      if (!admin) {
        router.push("/dashboard");
      }
    });
  }, [router]);

  // Fetch metrics
  const {
    data: metrics,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-metrics", selectedPeriod],
    queryFn: () => api.admin.getMetrics(selectedPeriod),
    enabled: isAdmin === true,
    refetchInterval: 120000, // Refresh every 2 minutes (reduced from 30s to prevent overload)
  });

  // Fetch user stats
  const {
    data: userStats,
    isLoading: userStatsLoading,
  } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: () => api.admin.getUserStats(),
    enabled: isAdmin === true,
    refetchInterval: 300000, // Refresh every 5 minutes (reduced from 1min to prevent overload)
  });

  // Fetch failed scheduled emails
  const {
    data: failedEmails,
    isLoading: failedEmailsLoading,
    refetch: refetchFailedEmails,
  } = useQuery({
    queryKey: ["admin-failed-emails"],
    queryFn: () => api.admin.getFailedScheduledEmails(),
    enabled: isAdmin === true,
    refetchInterval: 120000, // Refresh every 2 minutes (reduced from 30s to prevent overload)
  });

  // Restart single email mutation
  const restartEmailMutation = useMutation({
    mutationFn: (id: string) => api.admin.restartScheduledEmail(id),
    onSuccess: () => {
      refetchFailedEmails();
      alert("Email restarted successfully!");
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Restart all failed emails mutation
  const restartAllMutation = useMutation({
    mutationFn: () => api.admin.restartAllFailedEmails(),
    onSuccess: (data) => {
      refetchFailedEmails();
      alert(`Successfully restarted ${data.count} failed emails!`);
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Delete data mutation
  const deleteMutation = useMutation({
    mutationFn: (config: Record<string, number>) => api.admin.deleteData(config),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      alert(
        `Data deleted successfully!\n\n` +
          `Deleted: ${data.result.totalDeleted} records\n` +
          `Size before: ${data.result.sizeBefore.toFixed(2)} MB\n` +
          `Size after: ${data.result.sizeAfter.toFixed(2)} MB\n` +
          `Space saved: ${(data.result.sizeBefore - data.result.sizeAfter).toFixed(2)} MB\n\n` +
          `Active campaigns verified: ${data.safetyCheck.verified ? "✓" : "✗"}`
      );
      setShowDeleteConfirm(false);
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  if (isAdmin === null) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Checking admin access...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isAdmin === false) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">System metrics and data management</p>
          </div>
          <div className="flex gap-3">
            {/* Time Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="180d">Last 6 months</option>
              <option value="365d">Last year</option>
            </select>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && !metrics ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : metrics ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                icon={<Users className="w-6 h-6" />}
                label="Total Users"
                value={metrics.overview.totalUsers.toLocaleString()}
                color="text-blue-600"
                subtitle={metrics.overview.newUsers ? `+${metrics.overview.newUsers} in period` : undefined}
              />
              <MetricCard
                icon={<Mail className="w-6 h-6" />}
                label="Total Campaigns"
                value={metrics.overview.totalCampaigns.toLocaleString()}
                color="text-green-600"
              />
              <MetricCard
                icon={<Activity className="w-6 h-6" />}
                label="Active Campaigns"
                value={metrics.overview.activeCampaigns.toLocaleString()}
                color="text-orange-600"
              />
              <MetricCard
                icon={<Database className="w-6 h-6" />}
                label="Database Size"
                value={`${metrics.overview.databaseSizeMB.toFixed(1)} MB`}
                color="text-purple-600"
                subtitle={`${metrics.overview.totalRows.toLocaleString()} rows`}
              />
            </div>

            {/* Campaign Status Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Campaign Status Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: "Running", value: metrics.campaignStatus.running },
                      { name: "Scheduled", value: metrics.campaignStatus.scheduled },
                      { name: "Paused", value: metrics.campaignStatus.paused },
                      { name: "Completed", value: metrics.campaignStatus.completed },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: "Running", value: metrics.campaignStatus.running },
                      { name: "Scheduled", value: metrics.campaignStatus.scheduled },
                      { name: "Paused", value: metrics.campaignStatus.paused },
                      { name: "Completed", value: metrics.campaignStatus.completed },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Activity Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Campaigns */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Daily Campaigns (Last 30 Days)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics.charts.dailyCampaigns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Campaigns"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Daily Messages */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Daily Messages (Last 30 Days)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.charts.dailyMessages}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#10b981" name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Message Status & Bounce Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Message Status Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Message Status Breakdown
                </h2>
                <div className="space-y-3">
                  {Object.entries(metrics.messageStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700 capitalize">{status.toLowerCase()}</span>
                      <span className={`font-semibold ${
                        status === 'SENT' ? 'text-green-600' :
                        status === 'FAILED' || status === 'BOUNCED' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {Object.keys(metrics.messageStatus).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No message data available</p>
                  )}
                </div>
              </div>

              {/* Bounce Statistics */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Bounce Statistics
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-700">Total Bounces</span>
                    <span className="font-semibold text-red-600">
                      {metrics.bounceStatistics?.total?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">Hard Bounces</span>
                    <span className="font-semibold text-orange-600">
                      {metrics.bounceStatistics?.hard?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">Soft Bounces</span>
                    <span className="font-semibold text-yellow-600">
                      {metrics.bounceStatistics?.soft?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Bounce Rate</span>
                    <span className="font-semibold text-blue-600">
                      {metrics.bounceStatistics?.bounceRate?.toFixed(2) || '0.00'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Status & Bounce Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Message Status Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Message Status Breakdown
                </h2>
                <div className="space-y-3">
                  {Object.entries(metrics.messageStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700 capitalize">{status.toLowerCase()}</span>
                      <span className={`font-semibold ${
                        status === 'SENT' ? 'text-green-600' :
                        status === 'FAILED' || status === 'BOUNCED' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {Object.keys(metrics.messageStatus).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No message data available</p>
                  )}
                </div>
              </div>

              {/* Bounce Statistics */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Bounce Statistics
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-700">Total Bounces</span>
                    <span className="font-semibold text-red-600">
                      {metrics.bounceStatistics?.total?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">Hard Bounces</span>
                    <span className="font-semibold text-orange-600">
                      {metrics.bounceStatistics?.hard?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">Soft Bounces</span>
                    <span className="font-semibold text-yellow-600">
                      {metrics.bounceStatistics?.soft?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Bounce Rate</span>
                    <span className="font-semibold text-blue-600">
                      {metrics.bounceStatistics?.bounceRate?.toFixed(2) || '0.00'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity & Top Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity (24h)</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Messages Sent</span>
                    <span className="font-semibold text-blue-600">
                      {metrics.recentActivity.messagesLast24h.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-700">Tracking Events</span>
                    <span className="font-semibold text-green-600">
                      {metrics.recentActivity.trackingEventsLast24h.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">Campaigns Created</span>
                    <span className="font-semibold text-orange-600">
                      {metrics.recentActivity.campaignsCreatedLast24h.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Users */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Users by Campaigns</h2>
                <div className="space-y-3">
                  {metrics.topUsers.slice(0, 5).map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.displayName || user.email}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-700">{user.campaignCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* User Email Statistics */}
            {userStats && !userStatsLoading && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Email Statistics
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaigns</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emails Sent</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userStats.users.slice(0, 20).map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{user.email}</p>
                              {user.displayName && (
                                <p className="text-sm text-gray-500">{user.displayName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{user.totalCampaigns}</td>
                          <td className="px-4 py-3 text-green-600 font-semibold">{user.totalEmailsSent.toLocaleString()}</td>
                          <td className="px-4 py-3 text-red-600">{user.totalEmailsFailed}</td>
                          <td className="px-4 py-3 text-blue-600">{user.totalScheduledEmails}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {userStats.users.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No users found</p>
                  )}
                </div>
              </div>
            )}

            {/* Failed Scheduled Emails */}
            {failedEmails && !failedEmailsLoading && failedEmails.count > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Failed Scheduled Emails ({failedEmails.count})
                  </h2>
                  <button
                    onClick={() => restartAllMutation.mutate()}
                    disabled={restartAllMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${restartAllMutation.isPending ? "animate-spin" : ""}`} />
                    Restart All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {failedEmails.failedEmails.map((email) => (
                        <tr key={email.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">{email.to}</td>
                          <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{email.subject}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(email.scheduledAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate" title={email.error || ""}>
                            {email.error || "Unknown error"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{email.user.email}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => restartEmailMutation.mutate(email.id)}
                              disabled={restartEmailMutation.isPending}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Restart
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Database Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(metrics.databaseBreakdown).map(([table, data]) => (
                  <div key={table} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">{table}</p>
                    <p className="text-sm text-gray-600">
                      {data.rows.toLocaleString()} rows • {data.sizeMB.toFixed(2)} MB
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete Data Section */}
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    Data Management
                  </h2>
                  <p className="text-sm text-gray-600">
                    Safely delete old data. Active campaigns, follow-ups, and replies are NEVER affected.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {metrics.overview.activeCampaigns} Active Campaigns Protected
                  </span>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900 mb-1">Safety Guarantee</p>
                        <p className="text-sm text-yellow-700">
                          This will only delete:
                          <br />• Old COMPLETED campaigns ({deleteConfig.completedCampaigns}+ days)
                          <br />• Old DRAFT campaigns ({deleteConfig.draftCampaigns}+ days)
                          <br />• Old messages from COMPLETED campaigns ({deleteConfig.sentMessages}+ days)
                          <br />• Old tracking events ({deleteConfig.trackingEvents}+ days)
                          <br />
                          <br />
                          <strong>It will NEVER delete:</strong>
                          <br />• Running campaigns
                          <br />• Scheduled campaigns
                          <br />• Paused campaigns
                          <br />• Campaigns with future follow-ups
                          <br />• Follow-ups
                          <br />• Replies
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Completed Campaigns (days)
                      </label>
                      <input
                        type="number"
                        value={deleteConfig.completedCampaigns}
                        onChange={(e) =>
                          setDeleteConfig({
                            ...deleteConfig,
                            completedCampaigns: parseInt(e.target.value) || 90,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Draft Campaigns (days)
                      </label>
                      <input
                        type="number"
                        value={deleteConfig.draftCampaigns}
                        onChange={(e) =>
                          setDeleteConfig({
                            ...deleteConfig,
                            draftCampaigns: parseInt(e.target.value) || 30,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sent Messages (days)
                      </label>
                      <input
                        type="number"
                        value={deleteConfig.sentMessages}
                        onChange={(e) =>
                          setDeleteConfig({
                            ...deleteConfig,
                            sentMessages: parseInt(e.target.value) || 90,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Events (days)
                      </label>
                      <input
                        type="number"
                        value={deleteConfig.trackingEvents}
                        onChange={(e) =>
                          setDeleteConfig({
                            ...deleteConfig,
                            trackingEvents: parseInt(e.target.value) || 90,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteMutation.isPending}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Old Data
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-medium text-red-900 mb-2">Confirm Deletion</p>
                    <p className="text-sm text-red-700 mb-4">
                      Are you sure you want to delete old data? This action cannot be undone.
                      Active campaigns will NOT be affected.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          deleteMutation.mutate(deleteConfig);
                        }}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <div className={`${color}`}>{icon}</div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

