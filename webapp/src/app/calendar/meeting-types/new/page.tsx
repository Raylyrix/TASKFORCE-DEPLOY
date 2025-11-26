"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Calendar, Clock, MapPin, Video, Phone, Link as LinkIcon, Save, X } from "lucide-react";

export default function NewMeetingTypePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: connections } = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => api.calendar.getConnections(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [calendarConnectionId, setCalendarConnectionId] = useState("");
  const [meetingLocationType, setMeetingLocationType] = useState<"GOOGLE_MEET" | "PHONE" | "CUSTOM_URL">("GOOGLE_MEET");
  const [meetingLocationValue, setMeetingLocationValue] = useState("");
  const [createDefaultBookingLink, setCreateDefaultBookingLink] = useState(true);
  const [bookingLinkName, setBookingLinkName] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.calendar.createMeetingType({
        name,
        durationMinutes,
        description: description || undefined,
        calendarConnectionId: calendarConnectionId || (connections?.[0]?.id ?? ""),
        meetingLocationType,
        meetingLocationValue: meetingLocationType !== "GOOGLE_MEET" ? meetingLocationValue : undefined,
        createDefaultBookingLink,
        bookingLinkName: bookingLinkName || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meeting-types"] });
      router.push(`/calendar/meeting-types/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !calendarConnectionId) {
      alert("Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Meeting Type</h1>
          <p className="text-gray-600 mt-1">Set up a new type of meeting that recipients can book</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="30-minute consultation"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this meeting is about..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="5"
              max="480"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calendar Connection <span className="text-red-500">*</span>
            </label>
            {connections && connections.length > 0 ? (
              <select
                value={calendarConnectionId}
                onChange={(e) => setCalendarConnectionId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select calendar...</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.accountEmail} {conn.timeZone ? `(${conn.timeZone})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No calendar connections found. Please connect your Google Calendar first in Settings.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Location <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="locationType"
                  value="GOOGLE_MEET"
                  checked={meetingLocationType === "GOOGLE_MEET"}
                  onChange={(e) => setMeetingLocationType(e.target.value as "GOOGLE_MEET")}
                  className="w-4 h-4 text-primary-600"
                />
                <Video className="w-5 h-5 text-gray-600" />
                <span>Google Meet (automatic link)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="locationType"
                  value="PHONE"
                  checked={meetingLocationType === "PHONE"}
                  onChange={(e) => setMeetingLocationType(e.target.value as "PHONE")}
                  className="w-4 h-4 text-primary-600"
                />
                <Phone className="w-5 h-5 text-gray-600" />
                <span>Phone</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="locationType"
                  value="CUSTOM_URL"
                  checked={meetingLocationType === "CUSTOM_URL"}
                  onChange={(e) => setMeetingLocationType(e.target.value as "CUSTOM_URL")}
                  className="w-4 h-4 text-primary-600"
                />
                <LinkIcon className="w-5 h-5 text-gray-600" />
                <span>Custom URL</span>
              </label>
            </div>

            {(meetingLocationType === "PHONE" || meetingLocationType === "CUSTOM_URL") && (
              <div className="mt-3">
                <input
                  type="text"
                  value={meetingLocationValue}
                  onChange={(e) => setMeetingLocationValue(e.target.value)}
                  placeholder={
                    meetingLocationType === "PHONE" ? "+1 (555) 123-4567" : "https://zoom.us/j/..."
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 mt-2"
                />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Link</h3>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={createDefaultBookingLink}
                onChange={(e) => setCreateDefaultBookingLink(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Create default booking link</span>
            </label>
            {createDefaultBookingLink && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link Name (optional)</label>
                <input
                  type="text"
                  value={bookingLinkName}
                  onChange={(e) => setBookingLinkName(e.target.value)}
                  placeholder="Default link"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !calendarConnectionId}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Meeting Type
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}



