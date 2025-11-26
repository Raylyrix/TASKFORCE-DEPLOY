"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Calendar,
  Filter,
  Search,
  Download,
  X,
  Clock,
  User,
  Video,
  MapPin,
  Phone,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Mail,
} from "lucide-react";

type Booking = {
  id: string;
  meetingType: {
    id: string;
    name: string;
    durationMinutes: number;
    meetingLocationType: string;
  };
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  inviteeEmail: string;
  inviteeName: string | null;
  conferenceUrl: string | null;
  calendarEventId: string | null;
  createdAt: string;
};

export default function BookingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filters, setFilters] = useState({
    status: "" as "" | "PENDING" | "CONFIRMED" | "CANCELLED",
    meetingTypeId: "",
    search: "",
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", filters],
    queryFn: () =>
      api.bookings.list({
        status: filters.status || undefined,
        meetingTypeId: filters.meetingTypeId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      }),
  });

  const { data: meetingTypes } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => api.bookings.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedBooking(null);
      alert("Booking cancelled successfully");
    },
  });

  const bookings = bookingsData?.bookings || [];
  const total = bookingsData?.total || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-700";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case "GOOGLE_MEET":
        return <Video className="w-4 h-4" />;
      case "PHONE":
        return <Phone className="w-4 h-4" />;
      case "CUSTOM_URL":
        return <LinkIcon className="w-4 h-4" />;
      case "IN_PERSON":
        return <MapPin className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (bookingsLoading) {
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
            <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-600 mt-1">
              Manage your meeting bookings ({total} total)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value as typeof filters.status })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type</label>
                <select
                  value={filters.meetingTypeId}
                  onChange={(e) => setFilters({ ...filters, meetingTypeId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Types</option>
                  {meetingTypes?.map((mt) => (
                    <option key={mt.id} value={mt.id}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() =>
                  setFilters({
                    status: "",
                    meetingTypeId: "",
                    search: "",
                    startDate: "",
                    endDate: "",
                  })
                }
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Bookings List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {bookings.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                  className={`p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedBooking?.id === booking.id ? "bg-primary-50 border-l-4 border-primary-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {booking.meetingType.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            booking.status,
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(booking.startTime)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>
                            {booking.inviteeName || "Guest"} ({booking.inviteeEmail})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {getLocationIcon(booking.meetingType.meetingLocationType)}
                          <span className="capitalize">
                            {booking.meetingType.meetingLocationType.replace("_", " ").toLowerCase()}
                          </span>
                        </div>
                      </div>

                      {booking.conferenceUrl && (
                        <div className="mt-3">
                          <a
                            href={booking.conferenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                          >
                            <Video className="w-4 h-4" />
                            Join Meeting
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {booking.status !== "CANCELLED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to cancel this booking?")) {
                              cancelMutation.mutate(booking.id);
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancel booking"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No bookings found</p>
              <p className="text-sm mt-2">Bookings will appear here once recipients schedule meetings</p>
            </div>
          )}
        </div>

        {/* Booking Detail Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Meeting Type</h3>
                  <p className="text-lg font-semibold text-gray-900">{selectedBooking.meetingType.name}</p>
                  <p className="text-sm text-gray-600">{selectedBooking.meetingType.durationMinutes} minutes</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Time</h3>
                  <p className="text-gray-900">{formatDate(selectedBooking.startTime)}</p>
                  <p className="text-sm text-gray-600">
                    Ends at {formatDate(selectedBooking.endTime)}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Invitee</h3>
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-gray-900">{selectedBooking.inviteeName || "Guest"}</p>
                      <a
                        href={`mailto:${selectedBooking.inviteeEmail}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {selectedBooking.inviteeEmail}
                      </a>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      selectedBooking.status,
                    )}`}
                  >
                    {selectedBooking.status}
                  </span>
                </div>

                {selectedBooking.conferenceUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Meeting Link</h3>
                    <a
                      href={selectedBooking.conferenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      Join Meeting
                    </a>
                  </div>
                )}

                {selectedBooking.status !== "CANCELLED" && (
                  <div className="pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this booking?")) {
                          cancelMutation.mutate(selectedBooking.id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cancel Booking
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}





