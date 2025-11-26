import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { schedulerApi } from "../shared/schedulerApi";
import { useExtensionStore } from "../shared/store";

export const useSchedulerBootstrap = () => {
  const scheduler = useExtensionStore((state) => state.scheduler);
  const setSchedulerState = useExtensionStore((state) => state.setSchedulerState);
  const upsertMeetingTypes = useExtensionStore((state) => state.upsertMeetingTypes);
  const upsertCalendarConnections = useExtensionStore((state) => state.upsertCalendarConnections);

  const connectionsQuery = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: schedulerApi.fetchConnections,
  });

  const meetingTypesQuery = useQuery({
    queryKey: ["calendar-meeting-types"],
    queryFn: schedulerApi.fetchMeetingTypes,
  });

  useEffect(() => {
    if (connectionsQuery.data) {
      upsertCalendarConnections(connectionsQuery.data);
    }
  }, [connectionsQuery.data, upsertCalendarConnections]);

  useEffect(() => {
    if (meetingTypesQuery.data) {
      upsertMeetingTypes(meetingTypesQuery.data);
    }
  }, [meetingTypesQuery.data, upsertMeetingTypes]);

  useEffect(() => {
    const isLoading = Boolean(connectionsQuery.isLoading || meetingTypesQuery.isLoading);
    const error =
      (connectionsQuery.error as Error | undefined)?.message ??
      (meetingTypesQuery.error as Error | undefined)?.message ??
      null;

    setSchedulerState({
      isLoading,
      error,
      lastSyncedAt: new Date().toISOString(),
    });
  }, [
    connectionsQuery.isLoading,
    connectionsQuery.error,
    meetingTypesQuery.isLoading,
    meetingTypesQuery.error,
    setSchedulerState,
  ]);

  return {
    ...scheduler,
    refreshConnections: connectionsQuery.refetch,
    refreshMeetingTypes: meetingTypesQuery.refetch,
  };
};


