"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TrendingUp, Plus, Clock, Mail, CheckCircle, XCircle, ExternalLink } from "lucide-react";

export default function FollowUpsPage() {
  const router = useRouter();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.campaigns.list(),
  });

  const { data: followUpData } = useQuery({
    queryKey: ["follow-ups", selectedCampaignId],
    queryFn: () => api.followUps.list(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const allSequences = followUpData?.sequences || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Follow-up Sequences</h1>
            <p className="text-gray-600 mt-1">Automate your follow-up email sequences</p>
          </div>
          <button
            onClick={() => router.push("/follow-ups/new")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Sequence
          </button>
        </div>

        {/* Campaign Selector */}
        {campaigns && campaigns.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Campaign
            </label>
            <select
              value={selectedCampaignId || ""}
              onChange={(e) => setSelectedCampaignId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Follow-up Sequences */}
        {selectedCampaignId && allSequences && allSequences.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSequences.map((sequence: any) => {
              const totalDelay = sequence.steps?.reduce(
                (sum: number, step: any) => sum + (step.offsetConfig?.delayMs || 0),
                0
              ) || 0;
              const totalDays = Math.round(totalDelay / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={sequence.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{sequence.name}</h3>
                    <button
                      onClick={() => router.push(`/campaigns/${selectedCampaignId}`)}
                      className="p-1 rounded-lg hover:bg-gray-100"
                      title="View Campaign"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {sequence.steps?.length || 0} steps
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {totalDays} day{totalDays !== 1 ? "s" : ""} total delay
                    </div>
                  </div>
                  {sequence.steps && sequence.steps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
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
        ) : selectedCampaignId ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No follow-up sequences</h3>
            <p className="text-gray-600 mb-6">
              This campaign doesn't have any follow-up sequences yet. Create one from the campaign detail page.
            </p>
            <button
              onClick={() => router.push(`/campaigns/${selectedCampaignId}`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              View Campaign
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Campaign</h3>
            <p className="text-gray-600 mb-6">
              Follow-up sequences are created for specific campaigns. Select a campaign above to view its sequences.
            </p>
            {campaigns && campaigns.length === 0 && (
              <button
                onClick={() => router.push("/campaigns/new")}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create Your First Campaign
              </button>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-primary-900 mb-2">
            Automate Your Follow-ups
          </h3>
          <p className="text-primary-800 mb-4">
            Follow-up sequences allow you to automatically send a series of emails to recipients
            who haven't responded. Set up triggers, delays, and personalized messages to maximize
            your engagement rates.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-primary-900 mb-1">Smart Timing</h4>
                <p className="text-sm text-primary-700">
                  Automatically schedule follow-ups based on recipient behavior
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-primary-900 mb-1">Personalized Messages</h4>
                <p className="text-sm text-primary-700">
                  Use merge fields to personalize each follow-up email
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-primary-900 mb-1">Auto-Stop</h4>
                <p className="text-sm text-primary-700">
                  Sequences automatically stop when recipients respond or book a meeting
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

