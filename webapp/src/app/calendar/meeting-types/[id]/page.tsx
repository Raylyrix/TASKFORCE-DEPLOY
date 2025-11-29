"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Calendar, Clock, MapPin, Video, Phone, Link as LinkIcon, Save, X, Plus, Edit2, Trash2, Copy, Check, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

type AvailabilitySlot = {
  id: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  timeZone: string;
  isActive: boolean;
  notes?: string;
};

export default function MeetingTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingTypeId = params.id as string;
  const queryClient = useQueryClient();

  const { data: meetingType, isLoading } = useQuery({
    queryKey: ["meeting-type", meetingTypeId],
    queryFn: () => api.calendar.getMeetingType(meetingTypeId),
    enabled: !!meetingTypeId,
  });

  const { data: slotsData, refetch: refetchSlots } = useQuery({
    queryKey: ["slots", meetingTypeId],
    queryFn: () => api.calendar.getSlots(meetingTypeId),
    enabled: !!meetingTypeId,
  });

  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({
    startTime: "",
    endTime: "",
    isRecurring: false,
    recurrenceRule: "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isActive: true,
    notes: "",
  });

  const createSlotMutation = useMutation({
    mutationFn: (data: typeof slotForm) => api.calendar.createSlot(meetingTypeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots", meetingTypeId] });
      setShowSlotForm(false);
      setSlotForm({
        startTime: "",
        endTime: "",
        isRecurring: false,
        recurrenceRule: "",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isActive: true,
        notes: "",
      });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ slotId, data }: { slotId: string; data: Partial<typeof slotForm> }) =>
      api.calendar.updateSlot(meetingTypeId, slotId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots", meetingTypeId] });
      setEditingSlot(null);
      setSlotForm({
        startTime: "",
        endTime: "",
        isRecurring: false,
        recurrenceRule: "",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isActive: true,
        notes: "",
      });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) => api.calendar.deleteSlot(meetingTypeId, slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots", meetingTypeId] });
    },
  });

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setEditingSlot(slot.id);
    setSlotForm({
      startTime: slot.startTime,
      endTime: slot.endTime,
      isRecurring: slot.isRecurring,
      recurrenceRule: slot.recurrenceRule || "",
      timeZone: slot.timeZone,
      isActive: slot.isActive,
      notes: slot.notes || "",
    });
    setShowSlotForm(true);
  };

  const handleSubmitSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSlot) {
      updateSlotMutation.mutate({ slotId: editingSlot, data: slotForm });
    } else {
      createSlotMutation.mutate(slotForm);
    }
  };

  const handleCopyBookingLink = (token: string) => {
    const url = `${window.location.origin}/book/${token}`;
    navigator.clipboard.writeText(url);
    toast("Booking link copied to clipboard!");
  };

  const toast = (message: string) => {
    // Simple toast notification
    const toastEl = document.createElement("div");
    toastEl.className = "fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50";
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 3000);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!meetingType) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Meeting type not found</p>
          <button
            onClick={() => router.push("/calendar")}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Calendar
          </button>
        </div>
      </Layout>
    );
  }

  const slots = slotsData?.slots || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/calendar")}
              className="text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-2"
            >
              ← Back to Calendar
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{meetingType.name}</h1>
            {meetingType.description && (
              <p className="text-gray-600 mt-1">{meetingType.description}</p>
            )}
          </div>
        </div>

        {/* Meeting Type Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meeting Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium text-gray-900">{meetingType.durationMinutes} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {meetingType.meetingLocationType === "GOOGLE_MEET" ? (
                <Video className="w-5 h-5 text-gray-600" />
              ) : meetingType.meetingLocationType === "PHONE" ? (
                <Phone className="w-5 h-5 text-gray-600" />
              ) : (
                <LinkIcon className="w-5 h-5 text-gray-600" />
              )}
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-medium text-gray-900">
                  {meetingType.meetingLocationType === "GOOGLE_MEET"
                    ? "Google Meet"
                    : meetingType.meetingLocationType === "PHONE"
                    ? "Phone"
                    : meetingType.meetingLocationValue || "Custom URL"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Links */}
        {meetingType.bookingLinks && meetingType.bookingLinks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Links</h2>
            <div className="space-y-3">
              {meetingType.bookingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{link.name || "Default Link"}</p>
                    <p className="text-sm text-gray-600">{`${window.location.origin}/book/${link.token}`}</p>
                  </div>
                  <button
                    onClick={() => handleCopyBookingLink(link.token)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Availability Slots */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Time Slots</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define specific time slots that recipients can choose from when booking
              </p>
            </div>
            <button
              onClick={() => {
                setShowSlotForm(true);
                setEditingSlot(null);
                setSlotForm({
                  startTime: "",
                  endTime: "",
                  isRecurring: false,
                  recurrenceRule: "",
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  isActive: true,
                  notes: "",
                });
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Slot
            </button>
          </div>

          {/* Slot Form */}
          {showSlotForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <form onSubmit={handleSubmitSlot} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={slotForm.startTime ? format(parseISO(slotForm.startTime), "yyyy-MM-dd'T'HH:mm") : ""}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value).toISOString() : "";
                        setSlotForm({ ...slotForm, startTime: date });
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        slotForm.endTime
                          ? new Date(slotForm.endTime).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          // Convert local datetime to ISO string
                          const localDate = new Date(e.target.value);
                          setSlotForm({ ...slotForm, endTime: localDate.toISOString() });
                        } else {
                          setSlotForm({ ...slotForm, endTime: "" });
                        }
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <input
                    type="text"
                    value={slotForm.timeZone}
                    onChange={(e) => setSlotForm({ ...slotForm, timeZone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slotForm.isRecurring}
                      onChange={(e) => setSlotForm({ ...slotForm, isRecurring: e.target.checked })}
                      className="w-4 h-4 text-gray-900"
                    />
                    <span className="text-sm text-gray-700">Recurring slot</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slotForm.isActive}
                      onChange={(e) => setSlotForm({ ...slotForm, isActive: e.target.checked })}
                      className="w-4 h-4 text-gray-900"
                    />
                    <span className="text-sm text-gray-700">Active (offered to recipients)</span>
                  </label>
                </div>

                {slotForm.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recurrence Rule (RRULE format)
                    </label>
                    <input
                      type="text"
                      value={slotForm.recurrenceRule}
                      onChange={(e) => setSlotForm({ ...slotForm, recurrenceRule: e.target.value })}
                      placeholder='e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR'
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Example: FREQ=WEEKLY;BYDAY=MO,WE,FR for Monday, Wednesday, Friday
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={slotForm.notes}
                    onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={createSlotMutation.isPending || updateSlotMutation.isPending}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingSlot ? "Update Slot" : "Create Slot"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSlotForm(false);
                      setEditingSlot(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Slots List */}
          {slots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No custom slots defined yet.</p>
              <p className="text-sm mt-1">Add slots to offer specific times for recipients to choose from.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`p-4 rounded-lg border ${
                    slot.isActive ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {format(parseISO(slot.startTime), "MMM d, yyyy 'at' h:mm a")} -{" "}
                          {format(parseISO(slot.endTime), "h:mm a")}
                        </span>
                        {slot.isActive ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                        {slot.isRecurring && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            Recurring
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Timezone: {slot.timeZone}</p>
                        {slot.recurrenceRule && <p>Rule: {slot.recurrenceRule}</p>}
                        {slot.notes && <p>Notes: {slot.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditSlot(slot)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        title="Edit slot"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this slot?")) {
                            deleteSlotMutation.mutate(slot.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        title="Delete slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

