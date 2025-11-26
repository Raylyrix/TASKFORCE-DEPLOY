import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import type { GmailLabel } from "../shared/types";

type GmailLabelResponse = {
  labels: GmailLabel[];
};

export const useGmailLabels = () =>
  useQuery({
    queryKey: ["gmail-labels"],
    queryFn: async () => {
      const response = await apiClient.request<GmailLabelResponse>("/api/gmail/labels", {
        method: "GET",
      });
      return response.labels;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });



