import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import { useExtensionStore } from "../shared/store";
import type { CampaignSummary } from "../shared/types";

type CampaignListResponse = {
  campaigns: CampaignSummary[];
};

export const useCampaigns = () => {
  const user = useExtensionStore((state) => state.user);
  const setCampaigns = useExtensionStore((state) => state.setCampaigns);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["campaigns"],
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await apiClient.request<CampaignListResponse>("/api/campaigns", {
        method: "GET",
      });
      setCampaigns(response.campaigns);
      return response.campaigns;
    },
  });

  const refetchCampaigns = async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    await query.refetch();
  };

  return {
    ...query,
    refetchCampaigns,
  };
};


