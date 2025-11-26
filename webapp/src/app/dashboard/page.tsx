"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Mail, Calendar, TrendingUp, Users, CheckCircle, Clock, XCircle, Eye, MousePointerClick } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.campaigns.list(),
  });

  const { data: meetingTypes, isLoading: meetingTypesLoading, error: meetingTypesError } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  const { data: bookingsData } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.bookings.list({ limit: 100 }),
  });

  // Calculate statistics - ensure campaigns is always an array
  const campaignsArray = Array.isArray(campaigns) ? campaigns : [];
  const stats = campaignsArray.reduce(
    (acc, campaign) => {
      // This is simplified - in real app, fetch full campaign details
      return {
        total: acc.total + 1,
        active: campaign.status === "RUNNING" ? acc.active + 1 : acc.active,
        paused: campaign.status === "PAUSED" ? acc.paused + 1 : acc.paused,
        completed: campaign.status === "COMPLETED" ? acc.completed + 1 : acc.completed,
      };
    },
    { total: 0, active: 0, paused: 0, completed: 0 },
  );

  const meetingTypesArray = Array.isArray(meetingTypes) ? meetingTypes : [];
  const totalBookings = bookingsData?.total || meetingTypesArray.reduce((sum, mt) => sum + (mt.bookingStats?.total || 0), 0);
  
  // Fetch real campaign metrics from campaign details
  const { data: campaignDetails } = useQuery({
    queryKey: ["campaign-details-for-dashboard", campaignsArray.map(c => c.id).join(",")],
    queryFn: async () => {
      if (campaignsArray.length === 0) return [];
      const details = await Promise.all(
        campaignsArray.map(campaign => 
          api.campaigns.get(campaign.id).catch(() => null)
        )
      );
      return details.filter(Boolean);
    },
    enabled: campaignsArray.length > 0,
  });

  // Calculate campaign metrics from real data
  const campaignMetrics = campaignDetails && campaignDetails.length > 0
    ? campaignDetails.reduce(
        (acc, campaign: any) => {
          const summary = campaign.summary || { sent: 0, opened: 0, clicked: 0 };
          return {
            totalSent: acc.totalSent + (summary.sent || 0),
            totalOpened: acc.totalOpened + (summary.opened || 0),
            totalClicked: acc.totalClicked + (summary.clicked || 0),
          };
        },
        { totalSent: 0, totalOpened: 0, totalClicked: 0 },
      )
    : { totalSent: 0, totalOpened: 0, totalClicked: 0 };

  const openRate = campaignMetrics.totalSent > 0 
    ? ((campaignMetrics.totalOpened / campaignMetrics.totalSent) * 100).toFixed(1)
    : "0";
  const clickRate = campaignMetrics.totalSent > 0
    ? ((campaignMetrics.totalClicked / campaignMetrics.totalSent) * 100).toFixed(1)
    : "0";

  // Fetch real daily tracking analytics
  const { data: dailyAnalytics } = useQuery({
    queryKey: ["daily-analytics"],
    queryFn: () => api.tracking.getDailyAnalytics(7),
  });

  // Generate time-series data from real bookings, campaigns, and tracking events
  const chartTimeSeriesData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateKey = date.toISOString().split('T')[0];
    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    // Count campaigns created on this day
    const campaignsOnDay = campaignsArray.filter(c => {
      const createdDate = new Date(c.createdAt).toISOString().split('T')[0];
      return createdDate === dateKey;
    }).length;
    
    // Count bookings on this day
    const bookingsOnDay = bookingsData?.bookings?.filter(b => {
      const bookingDate = new Date(b.startTime).toISOString().split('T')[0];
      return bookingDate === dateKey;
    }).length || 0;
    
    // Get opens/clicks from daily analytics (real tracking data)
    const dayAnalytics = dailyAnalytics?.dailyData?.find(d => d.dateKey === dateKey);
    const opensOnDay = dayAnalytics?.opens || 0;
    const clicksOnDay = dayAnalytics?.clicks || 0;
    
    return {
      date: dateStr,
      campaigns: campaignsOnDay,
      bookings: bookingsOnDay,
      opens: opensOnDay,
      clicks: clicksOnDay,
    };
  });

  const campaignChartData = [
    { name: "Active", value: stats.active, color: "#10b981" },
    { name: "Paused", value: stats.paused, color: "#f59e0b" },
    { name: "Completed", value: stats.completed, color: "#6366f1" },
  ].filter((item) => item.value > 0);

  if (campaignsLoading || meetingTypesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  // Log for debugging
  if (campaignsError) {
    console.error("Campaigns error:", campaignsError);
  }
  if (meetingTypesError) {
    console.error("Meeting types error:", meetingTypesError);
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your campaigns and activities</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<Mail className="w-6 h-6" />}
            label="Total Campaigns"
            value={stats.total}
            color="bg-blue-500"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Active Campaigns"
            value={stats.active}
            color="bg-green-500"
          />
          <StatCard
            icon={<Calendar className="w-6 h-6" />}
            label="Total Bookings"
            value={totalBookings}
            color="bg-purple-500"
          />
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Meeting Types"
            value={meetingTypes?.length || 0}
            color="bg-pink-500"
          />
        </div>

        {/* Engagement Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Open Rate</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{openRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {campaignMetrics.totalOpened} of {campaignMetrics.totalSent} emails opened
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-600">Click Rate</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{clickRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {campaignMetrics.totalClicked} of {campaignMetrics.totalSent} emails clicked
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Upcoming Bookings</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {bookingsData?.bookings.filter(
                (b) => b.status !== "CANCELLED" && new Date(b.startTime) > new Date()
              ).length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Scheduled meetings</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartTimeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="campaigns" stroke="#6366f1" name="Campaigns" />
                <Line type="monotone" dataKey="bookings" stroke="#8b5cf6" name="Bookings" />
                <Line type="monotone" dataKey="opens" stroke="#10b981" name="Opens" />
                <Line type="monotone" dataKey="clicks" stroke="#f59e0b" name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Campaign Status Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Status</h2>
            {campaignChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={campaignChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {campaignChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No campaigns yet
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {campaignsArray.length > 0 ? (
                campaignsArray.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {campaign.status === "RUNNING" ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : campaign.status === "PAUSED" ? (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.status === "RUNNING"
                          ? "bg-green-100 text-green-700"
                          : campaign.status === "PAUSED"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-lg text-white`}>{icon}</div>
      </div>
    </div>
  );
}

