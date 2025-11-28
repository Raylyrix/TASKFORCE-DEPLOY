"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ArrowLeft, Mail, TrendingUp, Eye, MousePointerClick, XCircle, Users, Plus, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import FollowUpModal from "@/components/FollowUpModal";

export default function CampaignDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params?.id as string;
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => api.campaigns.get(campaignId),
    enabled: !!campaignId,
  });

  const { data: recipients, isLoading: recipientsLoading } = useQuery({
    queryKey: ["campaign-recipients", campaignId],
    queryFn: () => api.campaigns.getRecipients(campaignId),
    enabled: !!campaignId,
  });

  const { data: recipientActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["recipient-activity", campaignId, selectedRecipient],
    queryFn: () => api.campaigns.getRecipientActivity(campaignId, selectedRecipient!),
    enabled: !!campaignId && !!selectedRecipient,
  });

  const { data: followUpSequences } = useQuery({
    queryKey: ["follow-ups", campaignId],
    queryFn: () => api.followUps.list(campaignId),
    enabled: !!campaignId,
  });

  if (campaignLoading || recipientsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="text-center py-12">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h3>
          <button
            onClick={() => router.push("/campaigns")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Campaigns
          </button>
        </div>
      </Layout>
    );
  }

  const stats = campaign.summary || {
    total: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
  };

  const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : "0";
  const clickRate = stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : "0";

  const chartData = [
    { name: "Sent", value: stats.sent, color: "#6366f1" },
    { name: "Opened", value: stats.opened, color: "#10b981" },
    { name: "Clicked", value: stats.clicked, color: "#f59e0b" },
    { name: "Failed", value: stats.failed, color: "#ef4444" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push("/campaigns")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Campaigns
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-gray-600 mt-1">Campaign Analytics & Management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={<Mail className="w-6 h-6" />} label="Total Sent" value={stats.sent} />
          <StatCard
            icon={<Eye className="w-6 h-6" />}
            label="Opened"
            value={stats.opened}
            rate={`${openRate}%`}
          />
          <StatCard
            icon={<MousePointerClick className="w-6 h-6" />}
            label="Clicked"
            value={stats.clicked}
            rate={`${clickRate}%`}
          />
          <StatCard
            icon={<XCircle className="w-6 h-6" />}
            label="Failed"
            value={stats.failed}
            color="text-red-600"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Rate</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Open Rate</span>
                  <span className="text-sm font-medium text-gray-900">{openRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${openRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Click Rate</span>
                  <span className="text-sm font-medium text-gray-900">{clickRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${clickRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Follow-up Sequences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Follow-up Sequences ({followUpSequences?.sequences?.length || 0})
            </h2>
            <button
              onClick={() => {
                setShowFollowUpModal(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Sequence
            </button>
          </div>

          {followUpSequences && followUpSequences.sequences.length > 0 ? (
            <div className="space-y-3">
              {followUpSequences.sequences.map((sequence: any) => {
                const totalDelay = sequence.steps?.reduce(
                  (sum: number, step: any) => sum + (step.offsetConfig?.delayMs || 0),
                  0
                ) || 0;
                const totalDays = Math.round(totalDelay / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={sequence.id}
                    className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{sequence.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {sequence.steps?.length || 0} steps
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {totalDays} day{totalDays !== 1 ? "s" : ""} total
                      </div>
                    </div>
                    {sequence.steps && sequence.steps.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-500 mb-2">Steps:</div>
                        <div className="space-y-1">
                          {sequence.steps.map((step: any, index: number) => (
                            <div key={step.id} className="text-xs text-gray-600">
                              {index + 1}. {step.templateSubject || "(No subject)"} - {Math.round((step.offsetConfig?.delayMs || 0) / (1000 * 60 * 60))}h delay
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm">No follow-up sequences for this campaign</p>
              <p className="text-xs text-gray-400 mt-1">Create follow-ups from the campaign composer</p>
            </div>
          )}
        </div>

        {/* Recipients List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recipients ({recipients?.length || 0})
            </h2>
          </div>

          {recipients && recipients.length > 0 ? (
            <div className="space-y-2">
              {recipients.map((recipient) => (
                <div
                  key={recipient.email}
                  className={`p-4 rounded-lg border ${
                    selectedRecipient === recipient.email
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:bg-gray-50"
                  } cursor-pointer transition-colors`}
                  onClick={() =>
                    setSelectedRecipient(
                      selectedRecipient === recipient.email ? null : recipient.email,
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{recipient.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {recipient.sentAt && (
                          <span>Sent: {new Date(recipient.sentAt).toLocaleDateString()}</span>
                        )}
                        {recipient.openedAt && (
                          <span className="text-green-600">
                            Opened: {new Date(recipient.openedAt).toLocaleDateString()}
                          </span>
                        )}
                        {recipient.clickedAt && (
                          <span className="text-yellow-600">
                            Clicked: {new Date(recipient.clickedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recipient.status === "SENT"
                          ? "bg-green-100 text-green-700"
                          : recipient.status === "OPENED"
                            ? "bg-blue-100 text-blue-700"
                            : recipient.status === "CLICKED"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {recipient.status}
                    </span>
                  </div>

                  {selectedRecipient === recipient.email && recipientActivity && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Activity Timeline</h4>
                      <div className="space-y-2">
                        {recipientActivity.map((activity, index) => (
                          <div key={index} className="text-sm text-gray-600">
                            <span className="font-medium">{activity.type}:</span>{" "}
                            {new Date(activity.timestamp).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No recipients found</div>
          )}
        </div>
      </div>

      {/* Follow-up Modal */}
      {showFollowUpModal && (
        <FollowUpModal
          campaignId={campaignId}
          onClose={() => setShowFollowUpModal(false)}
          onSave={async (data) => {
            try {
              await api.followUps.create(campaignId, {
                name: data.name,
                steps: data.steps.map((step) => ({
                  delayMs: step.delayMs,
                  scheduledAt: step.scheduledAt,
                  subject: step.subject,
                  html: step.html,
                  sendAsReply: step.sendAsReply,
                  parentStepId: step.parentStepId,
                  isNested: step.isNested,
                })),
              });
              queryClient.invalidateQueries({ queryKey: ["follow-ups", campaignId] });
              setShowFollowUpModal(false);
            } catch (error: any) {
              alert(error?.message || "Failed to create follow-up sequence");
            }
          }}
        />
      )}
    </Layout>
  );
}

function StatCard({
  icon,
  label,
  value,
  rate,
  color = "text-gray-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  rate?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {rate && <p className="text-sm text-gray-500 mt-1">{rate}</p>}
        </div>
        <div className="p-3 rounded-lg bg-primary-50 text-primary-600">{icon}</div>
      </div>
    </div>
  );
}

