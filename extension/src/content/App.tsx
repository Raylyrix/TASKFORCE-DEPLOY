import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuth } from "../hooks/useAuth";
import { useBackendConfig } from "../hooks/useBackendConfig";
import { useCampaigns } from "../hooks/useCampaigns";
import { useExtensionStore } from "../shared/store";
import { AuthCard } from "../components/AuthCard";
import { ComposerPanel } from "../components/ComposerPanel";
import { FollowUpPanel } from "../components/FollowUpPanel";
import { CampaignsPanel } from "../components/CampaignsPanel";
import { BestPracticesPanel } from "../components/BestPracticesPanel";
import { TabSwitcher } from "../components/TabSwitcher";
import { UserMenu } from "../components/UserMenu";

const queryClient = new QueryClient();

type SelectedTab = "composer" | "followUps" | "campaigns";

type AppProps = {
  forcedTab?: SelectedTab;
  hideTabs?: boolean;
};

export const App = ({ forcedTab, hideTabs }: AppProps) => (
  <QueryClientProvider client={queryClient}>
    <Content forcedTab={forcedTab} hideTabs={hideTabs} />
  </QueryClientProvider>
);

export const ComposerApp = () => <App forcedTab="composer" hideTabs />;

export const FollowUpApp = () => <App forcedTab="followUps" hideTabs />;

export const BestPracticesApp = () => (
  <QueryClientProvider client={queryClient}>
    <BestPracticesPanel />
  </QueryClientProvider>
);

const Content = ({ forcedTab, hideTabs }: AppProps) => {
  const { backendUrl, isLoading: backendLoading } = useBackendConfig();
  const { user, isLoading: authLoading, connect, isConnecting, disconnect, isDisconnecting, refetch: refetchAuth } = useAuth();
  const { refetchCampaigns } = useCampaigns();
  const storeSelectedTab = useExtensionStore((state) => state.selectedTab);
  const setSelectedTab = useExtensionStore((state) => state.setSelectedTab);
  const setBackendUrlInStore = useExtensionStore((state) => state.setBackendUrl);

  useEffect(() => {
    if (backendUrl) {
      setBackendUrlInStore(backendUrl);
    }
  }, [backendUrl, setBackendUrlInStore]);

  useEffect(() => {
    if (forcedTab) {
      setSelectedTab(forcedTab);
    }
  }, [forcedTab, setSelectedTab]);

  useEffect(() => {
    if (user) {
      // Update store user when auth state changes
      const setUser = useExtensionStore.getState().setUser;
      setUser(user);
      void refetchCampaigns();
    } else {
      // Clear user from store if not authenticated
      const setUser = useExtensionStore.getState().setUser;
      setUser(null);
    }
  }, [user, refetchCampaigns]);

  const isLoading = backendLoading || authLoading;

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "24px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "14px" }}>Loading extension…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthCard
        onConnect={async () => {
          await connect();
          await refetchAuth();
        }}
        isConnecting={isConnecting}
        backendUrl={backendUrl}
      />
    );
  }

  const activeTab = forcedTab ?? storeSelectedTab;

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
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        padding: "0 4px",
      }}
    >
      {/* User Menu */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "-4px",
        }}
      >
        <UserMenu
          user={user}
          onDisconnect={handleDisconnect}
          onReauthenticate={handleReauthenticate}
          isDisconnecting={isDisconnecting}
          isConnecting={isConnecting}
        />
      </div>

      {!hideTabs ? (
        <TabSwitcher
          tabs={[
            { id: "composer", label: "Composer" },
            { id: "followUps", label: "Follow-ups" },
            { id: "campaigns", label: "Campaigns" },
          ]}
          activeId={activeTab}
          onChange={(tab) => setSelectedTab(tab as SelectedTab)}
        />
      ) : null}

      {activeTab === "composer" && <ComposerPanel onCampaignCreated={refetchCampaigns} />}
      {activeTab === "followUps" && <FollowUpPanel />}
      {activeTab === "campaigns" && <CampaignsPanel />}
    </div>
  );
};


