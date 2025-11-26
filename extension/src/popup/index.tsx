import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { useAuth } from "../hooks/useAuth";
import { useCampaigns } from "../hooks/useCampaigns";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useExtensionStore } from "../shared/store";

const queryClient = new QueryClient();

const PopupApp = () => (
  <QueryClientProvider client={queryClient}>
    <PopupContent />
  </QueryClientProvider>
);

const PopupContent = () => {
  const { user, connect, isConnecting, disconnect, isDisconnecting, refetch: refetchAuth } = useAuth();
  const { data: campaigns, refetch: refetchCampaigns } = useCampaigns();
  const setSelectedTab = useExtensionStore((state) => state.selectedTab);

  useEffect(() => {
    if (user) {
      void refetchCampaigns();
    }
  }, [user, refetchCampaigns]);

  const handleDisconnect = async () => {
    await disconnect();
    await refetchAuth();
    void refetchCampaigns();
  };

  const handleReauthenticate = async () => {
    await disconnect();
    await connect();
    await refetchAuth();
    void refetchCampaigns();
  };

  return (
    <div
      style={{
        width: "320px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
      }}
    >
      <strong style={{ fontSize: "16px" }}>TaskForce Campaigns</strong>
      {!user ? (
        <button
          type="button"
          onClick={() => connect()}
          disabled={isConnecting}
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#0b57d0",
            color: "#fff",
            fontWeight: 600,
            cursor: isConnecting ? "not-allowed" : "pointer",
            opacity: isConnecting ? 0.6 : 1,
          }}
        >
          {isConnecting ? "Connecting…" : "Connect Google Account"}
        </button>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                minWidth: 0,
              }}
            >
              {user.pictureUrl ? (
                <img
                  src={user.pictureUrl}
                  alt={user.displayName ?? user.email}
                  style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0 }}
                />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>{user.displayName ?? user.email}</span>
                <span style={{ fontSize: "12px", color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              border: "1px solid #dadce0",
              borderRadius: "10px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "13px" }}>
              Active campaigns: {campaigns?.length ?? 0}
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedTab("campaigns");
                  chrome.tabs.create({ url: "https://mail.google.com/mail/u/0/#inbox" });
                }}
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #0b57d0",
                  backgroundColor: "#fff",
                  color: "#0b57d0",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Open Gmail
              </button>
              <button
                type="button"
                onClick={handleReauthenticate}
                disabled={isConnecting || isDisconnecting}
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #34a853",
                  backgroundColor: "#fff",
                  color: "#34a853",
                  cursor: isConnecting || isDisconnecting ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 500,
                  opacity: isConnecting || isDisconnecting ? 0.6 : 1,
                }}
              >
                {isConnecting ? "Reconnecting…" : "Reauthenticate"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ea4335",
                backgroundColor: "#fff",
                color: "#ea4335",
                cursor: isDisconnecting ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                opacity: isDisconnecting ? 0.6 : 1,
              }}
            >
              {isDisconnecting ? "Disconnecting…" : "Disconnect Account"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}

