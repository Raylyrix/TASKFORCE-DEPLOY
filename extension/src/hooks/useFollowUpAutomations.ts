import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import type { FollowUpAutomation } from "../shared/types";

type FollowUpAutomationResponse = {
  automations: FollowUpAutomation[];
};

export const useFollowUpAutomations = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["follow-up-automations"],
    queryFn: async () => {
      const response = await apiClient.request<FollowUpAutomationResponse>("/api/follow-ups/automations", {
        method: "GET",
      });
      return response.automations;
    },
    staleTime: 60 * 1000,
  });

  const refetchAutomations = async () => {
    await queryClient.invalidateQueries({ queryKey: ["follow-up-automations"] });
    await query.refetch();
  };

  return {
    ...query,
    refetchAutomations,
  };
};



