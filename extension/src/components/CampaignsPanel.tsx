import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import { useExtensionStore } from "../shared/store";
import type { CampaignMetrics } from "../shared/types";
import { Button } from "./Button";
import { Card } from "./Card";
import { RecipientActivityTimeline, type TimelineEvent } from "./RecipientActivityTimeline";

type CampaignSummaryResponse = {
  campaign: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
  metrics: CampaignMetrics;
};

type Recipient = {
  id: string;
  email: string;
  status: string;
  lastSentAt: string | null;
  createdAt: string;
};

type RecipientsResponse = {
  recipients: Recipient[];
};

type ActivityResponse = {
  recipient: Recipient;
  timeline: TimelineEvent[];
};

export const CampaignsPanel = () => {
  const campaigns = useExtensionStore((state) => state.campaigns);
  const setCampaignMetrics = useExtensionStore((state) => state.setCampaignMetrics);
  const storedMetrics = useExtensionStore((state) => state.campaignMetrics);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState<string | null>(null);

  const fetchMetricsMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await apiClient.request<CampaignSummaryResponse>(
        `/api/campaigns/${campaignId}`,
        {
          method: "GET",
        },
      );
      setCampaignMetrics(campaignId, response.metrics);
      return response.metrics;
    },
  });

  const handleSelectCampaign = async (campaignId: string) => {
    setActiveCampaignId(campaignId);
    await fetchMetricsMutation.mutateAsync(campaignId);
  };

  const activeMetrics = activeCampaignId ? storedMetrics[activeCampaignId] : undefined;

  const recipientsQuery = useQuery({
    queryKey: ["campaign-recipients", activeCampaignId],
    queryFn: async () => {
      if (!activeCampaignId) return null;
      return await apiClient.request<RecipientsResponse>(
        `/api/campaigns/${activeCampaignId}/recipients`,
      );
    },
    enabled: Boolean(activeCampaignId),
  });

  const activityQuery = useQuery({
    queryKey: ["recipient-activity", activeCampaignId, selectedRecipientEmail],
    queryFn: async () => {
      if (!activeCampaignId || !selectedRecipientEmail) return null;
      const encodedEmail = encodeURIComponent(selectedRecipientEmail);
      return await apiClient.request<ActivityResponse>(
        `/api/campaigns/${activeCampaignId}/recipients/${encodedEmail}/activity`,
      );
    },
    enabled: Boolean(activeCampaignId && selectedRecipientEmail),
  });

  const handleSelectRecipient = (email: string) => {
    setSelectedRecipientEmail(email === selectedRecipientEmail ? null : email);
  };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <strong style={{ fontSize: "16px" }}>Campaign progress</strong>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "160px",
            overflowY: "auto",
            border: "1px solid #e0e3e7",
            borderRadius: "10px",
            padding: "8px",
            backgroundColor: "#f8f9fa",
          }}
        >
          {campaigns.length === 0 ? (
            <span style={{ fontSize: "13px", color: "#5f6368" }}>
              Launch a campaign to see performance metrics.
            </span>
          ) : (
            campaigns.map((campaign) => {
              const isActive = campaign.id === activeCampaignId;
              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => handleSelectCampaign(campaign.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: isActive ? "2px solid #0b57d0" : "1px solid #dadce0",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600 }}>{campaign.name}</span>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>
                      {campaign.recipients.sent} / {campaign.recipients.total} sent
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      backgroundColor: "#e8f0fe",
                      color: "#0b57d0",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {campaign.status}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {activeCampaignId && (
          <div
            style={{
              border: "1px solid #e0e3e7",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "14px" }}>Analytics</strong>
              <Button
                variant="secondary"
                onClick={() => fetchMetricsMutation.mutate(activeCampaignId)}
                style={{ padding: "6px 12px" }}
              >
                Refresh
              </Button>
            </div>

            {fetchMetricsMutation.isPending && (
              <span style={{ fontSize: "13px" }}>Fetching metrics…</span>
            )}

            {activeMetrics && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                <MetricTile label="Recipients" value={activeMetrics.totalRecipients} />
                <MetricTile label="Sent" value={activeMetrics.sentCount} icon="✓" />
                <MetricTile label="Failed" value={activeMetrics.failedCount} icon="⚠" />
                <MetricTile label="Opens" value={activeMetrics.opens} icon="✓✓" />
                <MetricTile label="Clicks" value={activeMetrics.clicks} icon="✓✓" />
              </div>
            )}

            {recipientsQuery.data && (
              <div
                style={{
                  border: "1px solid #e0e3e7",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "14px" }}>Recipients</strong>
                  <span style={{ fontSize: "12px", color: "#5f6368" }}>
                    {recipientsQuery.data.recipients.length} total
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {recipientsQuery.data.recipients.map((recipient) => {
                    const isSelected = recipient.email === selectedRecipientEmail;
                    return (
                      <button
                        key={recipient.id}
                        type="button"
                        onClick={() => handleSelectRecipient(recipient.email)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: isSelected ? "2px solid #1a73e8" : "1px solid #dadce0",
                          backgroundColor: isSelected ? "#eef3fe" : "#fff",
                          cursor: "pointer",
                          textAlign: "left",
                          fontSize: "12px",
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{recipient.email}</span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "999px",
                            backgroundColor:
                              recipient.status === "SENT"
                                ? "#e6f4ea"
                                : recipient.status === "FAILED"
                                  ? "#fce8e6"
                                  : "#e8f0fe",
                            color:
                              recipient.status === "SENT"
                                ? "#137333"
                                : recipient.status === "FAILED"
                                  ? "#c5221f"
                                  : "#1a73e8",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          {recipient.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedRecipientEmail && activityQuery.data && (
              <RecipientActivityTimeline
                recipientEmail={selectedRecipientEmail}
                timeline={activityQuery.data.timeline}
                isLoading={activityQuery.isLoading}
                error={activityQuery.error instanceof Error ? activityQuery.error.message : null}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const MetricTile = ({ label, value, icon }: { label: string; value: number; icon?: string }) => (
  <div
    style={{
      padding: "12px",
      borderRadius: "10px",
      border: "1px solid #dadce0",
      backgroundColor: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}
  >
    <span style={{ fontSize: "12px", color: "#5f6368", textTransform: "uppercase" }}>
      {icon ? `${icon} ` : ""}
      {label}
    </span>
    <strong style={{ fontSize: "18px" }}>{value}</strong>
  </div>
);


