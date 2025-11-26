"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Calendar, Clock, MapPin, Video, Phone, Link as LinkIcon, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

interface AvailabilityDay {
  date: string;
  slots: Array<{
    start: string;
    end: string;
    status: "available" | "busy";
  }>;
}

interface Recommendation {
  start: string;
  end: string;
  score?: number;
}

export default function BookingPage() {
  const params = useParams();
  const token = params.token as string;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: bookingData, isLoading } = useQuery({
    queryKey: ["booking-page", token],
    queryFn: () => api.booking.getBookingPageData(token),
    enabled: !!token,
  });

  const bookingMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; notes?: string; start: string; end: string }) =>
      api.booking.createBooking(token, data),
    onSuccess: (data) => {
      // Show success message
      const message = data.booking.conferenceUrl
        ? `Meeting booked successfully! Google Meet link: ${data.booking.conferenceUrl}`
        : "Meeting booked successfully! Check your email for confirmation.";
      alert(message);
      if (data.booking.conferenceUrl) {
        setTimeout(() => {
          window.open(data.booking.conferenceUrl!, "_blank");
        }, 1000);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!bookingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h1>
          <p className="text-gray-600">This booking link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const availability = bookingData.availability as AvailabilityDay[];
  const recommendations = (bookingData.recommendations || []) as Recommendation[];
  const meeting = bookingData.meeting;
  const host = bookingData.host;

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
  };

  const handleBooking = async () => {
    if (!selectedSlot || !email.trim()) {
      alert("Please select a time slot and enter your email");
      return;
    }

    try {
      await bookingMutation.mutateAsync({
        email: email.trim(),
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        start: selectedSlot.start,
        end: selectedSlot.end,
      });
      alert("Meeting booked successfully! Check your email for confirmation.");
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Booking failed");
    }
  };

  // Get available slots for selected date
  const selectedDaySlots = selectedDate
    ? availability.find((day) => {
        const dayDate = new Date(day.date);
        return (
          dayDate.getDate() === selectedDate.getDate() &&
          dayDate.getMonth() === selectedDate.getMonth() &&
          dayDate.getFullYear() === selectedDate.getFullYear()
        );
      })?.slots.filter((slot) => slot.status === "available") || []
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{meeting.name}</h1>
          {meeting.description && <p className="text-gray-600 mb-4">{meeting.description}</p>}
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{meeting.durationMinutes} minutes</span>
            </div>
            {meeting.locationType === "GOOGLE_MEET" && (
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>Google Meet</span>
              </div>
            )}
            {meeting.locationType === "PHONE" && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>Phone Call</span>
              </div>
            )}
            {meeting.locationType === "CUSTOM_URL" && meeting.locationValue && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                <span>{meeting.locationValue}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar & Time Selection */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Date & Time</h2>

            {/* Smart Recommendations */}
            {recommendations.length > 0 && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
                <h3 className="text-sm font-semibold text-indigo-900 mb-2">✨ Recommended Times</h3>
                <div className="space-y-2">
                  {recommendations.slice(0, 3).map((rec, idx) => {
                    const start = new Date(rec.start);
                    const end = new Date(rec.end);
                    const isSelected = selectedSlot?.start === rec.start && selectedSlot?.end === rec.end;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSlotSelect({ start: rec.start, end: rec.end })}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </div>
                            <div className="text-sm text-gray-600">
                              {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -{" "}
                              {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calendar View */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-semibold text-gray-900">
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h3>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Simple calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }, (_, i) => {
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i - 6);
                  const hasAvailability = availability.some((day) => {
                    const dayDate = new Date(day.date);
                    return (
                      dayDate.getDate() === date.getDate() &&
                      dayDate.getMonth() === date.getMonth() &&
                      dayDate.getFullYear() === date.getFullYear() &&
                      day.slots.some((slot) => slot.status === "available")
                    );
                  });
                  const isSelected =
                    selectedDate &&
                    date.getDate() === selectedDate.getDate() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();
                  const isToday =
                    date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth() &&
                    date.getFullYear() === new Date().getFullYear();
                  const isPast = date < new Date() && !isToday;

                  if (date.getMonth() !== currentMonth.getMonth()) {
                    return <div key={i} className="h-10"></div>;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => !isPast && hasAvailability && handleDateSelect(date)}
                      disabled={isPast || !hasAvailability}
                      className={`h-10 rounded-lg text-sm transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold"
                          : isToday
                            ? "bg-indigo-100 text-indigo-700 font-medium"
                            : hasAvailability && !isPast
                              ? "bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-700"
                              : "bg-gray-50 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots for Selected Date */}
            {selectedDate && selectedDaySlots.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Available Times for {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {selectedDaySlots.map((slot, idx) => {
                    const start = new Date(slot.start);
                    const end = new Date(slot.end);
                    const isSelected = selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSlotSelect({ start: slot.start, end: slot.end })}
                        className={`p-3 rounded-lg border-2 text-sm transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold"
                            : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700"
                        }`}
                      >
                        {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Booking Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Any additional information..."
                />
              </div>

              <button
                onClick={handleBooking}
                disabled={!selectedSlot || !email.trim() || bookingMutation.isPending}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {bookingMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Booking...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm Booking
                  </>
                )}
              </button>

              {selectedSlot && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-900 mb-1">Selected Time:</div>
                  <div className="text-sm text-green-700">
                    {new Date(selectedSlot.start).toLocaleString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    - {new Date(selectedSlot.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

