"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Play, Pause, Square, Eye, Trash2, Mail, CheckCircle, Clock, XCircle } from "lucide-react";

export default function CampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.campaigns.list(),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.schedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const handleAction = async (campaignId: string, action: "pause" | "resume" | "cancel") => {
    if (action === "pause") {
      pauseMutation.mutate(campaignId);
    } else if (action === "resume") {
      resumeMutation.mutate(campaignId);
    } else if (action === "cancel") {
      if (confirm("Are you sure you want to cancel this campaign?")) {
        cancelMutation.mutate(campaignId);
      }
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-600 mt-1">Manage your email campaigns</p>
          </div>
          <button
            onClick={() => router.push("/campaigns/new")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Mail className="w-5 h-5" />
            New Campaign
          </button>
        </div>

        {/* Campaigns List */}
        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onAction={handleAction}
                isLoading={
                  pauseMutation.isPending ||
                  resumeMutation.isPending ||
                  cancelMutation.isPending
                }
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-6">Create your first email campaign to get started</p>
            <button
              onClick={() => router.push("/campaigns/new")}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Campaign
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function CampaignCard({
  campaign,
  onAction,
  isLoading,
}: {
  campaign: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
  onAction: (id: string, action: "pause" | "resume" | "cancel") => void;
  isLoading: boolean;
}) {
  const router = useRouter();

  const getStatusIcon = () => {
    switch (campaign.status) {
      case "RUNNING":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "PAUSED":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "COMPLETED":
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
      case "CANCELLED":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (campaign.status) {
      case "RUNNING":
        return "bg-green-100 text-green-700";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-700";
      case "COMPLETED":
        return "bg-gray-100 text-gray-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getStatusIcon()}
            <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
            >
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Created {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/campaigns/${campaign.id}`)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="View Details"
          >
            <Eye className="w-5 h-5 text-gray-600" />
          </button>

          {campaign.status === "RUNNING" && (
            <button
              onClick={() => onAction(campaign.id, "pause")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
              title="Pause Campaign"
            >
              <Pause className="w-5 h-5 text-yellow-600" />
            </button>
          )}

          {campaign.status === "PAUSED" && (
            <button
              onClick={() => onAction(campaign.id, "resume")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              title="Resume Campaign"
            >
              <Play className="w-5 h-5 text-green-600" />
            </button>
          )}

          {(campaign.status === "RUNNING" || campaign.status === "PAUSED") && (
            <button
              onClick={() => onAction(campaign.id, "cancel")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Cancel Campaign"
            >
              <Square className="w-5 h-5 text-red-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

