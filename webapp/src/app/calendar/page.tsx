"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Calendar as CalendarIcon, Clock, MapPin, Users, RefreshCw, Plus } from "lucide-react";

export default function CalendarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => api.calendar.getConnections(),
  });

  const { data: meetingTypes, isLoading: meetingTypesLoading } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) => api.calendar.sync(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-connections"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-types"] });
    },
  });

  if (connectionsLoading || meetingTypesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your calendar connections and meeting types</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/calendar/view")}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <CalendarIcon className="w-5 h-5" />
              View Calendar
            </button>
            <button
              onClick={() => router.push("/calendar/meeting-types/new")}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Meeting Type
            </button>
          </div>
        </div>

        {/* Calendar Connections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendar Connections
          </h2>

          {connections && connections.length > 0 ? (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{connection.accountEmail}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {connection.timeZone && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {connection.timeZone}
                          </span>
                        )}
                        {connection.lastSyncedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last synced: {new Date(connection.lastSyncedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => syncMutation.mutate(connection.id)}
                    disabled={syncMutation.isPending}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                    />
                    Sync Now
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No calendar connections found. Connect your Google Calendar to get started.
            </div>
          )}
        </div>

        {/* Meeting Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Meeting Types ({meetingTypes?.length || 0})
          </h2>

          {meetingTypes && meetingTypes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meetingTypes.map((meetingType) => (
                <div
                  key={meetingType.id}
                  className="p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/calendar/meeting-types/${meetingType.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{meetingType.name}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        meetingType.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {meetingType.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {meetingType.durationMinutes} minutes
                    </div>
                    {meetingType.bookingStats && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {meetingType.bookingStats.total} total bookings
                        {meetingType.bookingStats.confirmed > 0 && (
                          <span className="text-green-600">
                            ({meetingType.bookingStats.confirmed} confirmed)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No meeting types yet. Create your first meeting type to start accepting bookings.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

