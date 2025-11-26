"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, Users, Trash2, Save } from "lucide-react";
import { format, parseISO } from "date-fns";

interface EventModalProps {
  event: {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
    type?: "calendar" | "booking" | "holiday";
    isHoliday?: boolean;
    calendarId?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
  }) => Promise<void>;
  onDelete?: (eventId: string, calendarId?: string) => Promise<void>;
  mode?: "create" | "edit";
  defaultDate?: Date;
}

export function EventModal({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  mode = "edit",
  defaultDate,
}: EventModalProps) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === "create" && defaultDate) {
        const dateStr = format(defaultDate, "yyyy-MM-dd");
        const timeStr = format(defaultDate, "HH:mm");
        setStartDate(dateStr);
        setStartTime(timeStr);
        setEndDate(dateStr);
        // Default to 1 hour duration
        const endDateTime = new Date(defaultDate);
        endDateTime.setHours(endDateTime.getHours() + 1);
        setEndTime(format(endDateTime, "HH:mm"));
        setSummary("");
        setDescription("");
        setLocation("");
        setAttendees("");
      } else if (event) {
        const start = parseISO(event.start);
        const end = parseISO(event.end);
        setSummary(event.title);
        setDescription(event.description || "");
        setStartDate(format(start, "yyyy-MM-dd"));
        setStartTime(format(start, "HH:mm"));
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
        setLocation(event.location || "");
        setAttendees(
          event.attendees?.map((a) => a.email).join(", ") || ""
        );
      }
    }
  }, [isOpen, event, mode, defaultDate]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!summary.trim()) {
      alert("Please enter an event title");
      return;
    }

    setIsSaving(true);
    try {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);

      if (end <= start) {
        alert("End time must be after start time");
        setIsSaving(false);
        return;
      }

      const attendeeList = attendees
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => ({ email }));

      await onSave({
        summary: summary.trim(),
        description: description.trim() || undefined,
        start: start.toISOString(),
        end: end.toISOString(),
        location: location.trim() || undefined,
        attendees: attendeeList.length > 0 ? attendeeList : undefined,
      });

      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to save event");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    if (!confirm("Are you sure you want to delete this event?")) return;

    setIsDeleting(true);
    try {
      await onDelete(event.id, event.calendarId);
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  const isHoliday = event?.isHoliday || event?.type === "holiday";
  const isBooking = event?.type === "booking";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === "create" ? "Create Event" : isHoliday ? "Holiday" : "Edit Event"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {isHoliday ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Holiday Name
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {event.title}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {format(parseISO(event.start), "EEEE, MMMM d, yyyy")}
                </div>
              </div>
              {event.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {event.description}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Event title"
                  disabled={isBooking}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={isBooking}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={isBooking}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={isBooking}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={isBooking}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Event location"
                  disabled={isBooking}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Event description"
                  disabled={isBooking}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Attendees (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="email1@example.com, email2@example.com"
                  disabled={isBooking}
                />
              </div>

              {isBooking && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                  This is a booking event and cannot be edited here. Please manage it from the bookings page.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {onDelete && !isBooking && !isHoliday && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {!isBooking && !isHoliday && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Saving..." : mode === "create" ? "Create" : "Save"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


