import { useQuery, useMutation } from "@tanstack/react-query";

import { MessageType, sendRuntimeMessage, type ConfigGetResponse } from "../shared/messages";
import { useExtensionStore } from "../shared/store";

export const useBackendConfig = () => {
  const backendUrl = useExtensionStore((state) => state.backendUrl);
  const setBackendUrl = useExtensionStore((state) => state.setBackendUrl);

  const query = useQuery({
    queryKey: ["backend-url"],
    queryFn: async () => {
      const response = await sendRuntimeMessage<ConfigGetResponse>({
        type: MessageType.ConfigGet,
      });
      setBackendUrl(response.backendUrl);
      return response.backendUrl;
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextUrl: string) => {
      await sendRuntimeMessage({
        type: MessageType.ConfigSet,
        payload: { backendUrl: nextUrl },
      });
      setBackendUrl(nextUrl);
      return nextUrl;
    },
  });

  return {
    backendUrl: backendUrl || query.data || "",
    isLoading: query.isLoading,
    updateBackendUrl: mutation.mutateAsync,
    updating: mutation.isPending,
    refetch: query.refetch,
  };
};


