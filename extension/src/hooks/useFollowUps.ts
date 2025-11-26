import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import type { FollowUpSequenceDraft } from "../shared/types";

type FollowUpSequenceResponse = {
  sequences: Array<FollowUpSequenceDraft & { id: string }>;
};

export const useFollowUps = (campaignId: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["follow-ups", campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      if (!campaignId) {
        return [];
      }
      const response = await apiClient.request<FollowUpSequenceResponse>(
        `/api/follow-ups/${campaignId}`,
        {
          method: "GET",
        },
      );
      return response.sequences;
    },
  });

  const refetchFollowUps = async () => {
    await queryClient.invalidateQueries({ queryKey: ["follow-ups", campaignId] });
    await query.refetch();
  };

  return {
    ...query,
    refetchFollowUps,
  };
};


