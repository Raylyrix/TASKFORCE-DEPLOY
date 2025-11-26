"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Send,
  Eye,
  MousePointerClick,
  User,
  Search,
} from "lucide-react";

export default function CustomerViewPage() {
  const params = useParams();
  const router = useRouter();
  const email = params.email as string;

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer-view", email],
    queryFn: () => api.customerView.get(email),
    enabled: !!email,
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !customer) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contact Not Found</h1>
          <p className="text-gray-600">Unable to load contact information.</p>
        </div>
      </Layout>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email_sent":
        return <Send className="w-4 h-4 text-blue-500" />;
      case "email_opened":
        return <Eye className="w-4 h-4 text-green-500" />;
      case "email_clicked":
        return <MousePointerClick className="w-4 h-4 text-purple-500" />;
      case "meeting_booked":
        return <Calendar className="w-4 h-4 text-indigo-500" />;
      case "meeting_cancelled":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "campaign_participated":
        return <Mail className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "email_sent":
        return "bg-blue-50 border-blue-200";
      case "email_opened":
        return "bg-green-50 border-green-200";
      case "email_clicked":
        return "bg-purple-50 border-purple-200";
      case "meeting_booked":
        return "bg-indigo-50 border-indigo-200";
      case "meeting_cancelled":
        return "bg-red-50 border-red-200";
      case "campaign_participated":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {customer.name || customer.email}
            </h1>
            <p className="text-gray-600 mt-1">{customer.email}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Emails Sent</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{customer.totalEmailsSent}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-gray-600">Meetings</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{customer.totalMeetings}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-600">Engagement</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{customer.engagementScore}</div>
            <div className="text-xs text-gray-500 mt-1">Score (0-100)</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-gray-600">Campaigns</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{customer.totalCampaigns}</div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h2>

          {customer.activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customer.activities.map((activity, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${getActivityColor(activity.type)}`}
                >
                  <div className="mt-1">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


