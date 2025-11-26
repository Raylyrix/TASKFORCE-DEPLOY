import { useMutation, useQuery } from "@tanstack/react-query";

import {
  MessageType,
  sendRuntimeMessage,
  type AuthStartResponse,
  type AuthStatusResponse,
} from "../shared/messages";
import { useExtensionStore } from "../shared/store";

export const useAuth = () => {
  const setUser = useExtensionStore((state) => state.setUser);

  const statusQuery = useQuery({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const response = await sendRuntimeMessage<AuthStatusResponse>({
        type: MessageType.AuthStatus,
      });
      if (response?.user) {
        setUser(response.user);
      } else {
        // Clear user from store if not authenticated
        setUser(null);
      }
      return response?.user ?? null;
    },
    refetchInterval: 30000, // Refetch every 30 seconds to keep auth state in sync
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await sendRuntimeMessage<AuthStartResponse, { interactive: boolean }>({
        type: MessageType.AuthStart,
        payload: { interactive: true },
      });
      if (response?.user) {
        setUser(response.user);
      }
      return response?.user ?? null;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await sendRuntimeMessage({
        type: MessageType.AuthSignOut,
      });
      setUser(null);
      return null;
    },
  });

  return {
    user: statusQuery.data ?? null,
    isLoading: statusQuery.isLoading,
    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    refetch: statusQuery.refetch,
  };
};


