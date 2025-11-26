"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EventModal } from "@/components/EventModal";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  Phone,
  Globe,
  Plus,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, parseISO, getHours, getMinutes } from "date-fns";

type ViewMode = "month" | "week" | "day";

export default function CalendarViewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<"create" | "edit">("create");

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const startDate = viewMode === "month" ? startOfWeek(monthStart, { weekStartsOn: 1 }) : weekStart;
  const endDate = viewMode === "month" ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : weekEnd;

  const { data: eventsData, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ["calendar-events", startDate.toISOString(), endDate.toISOString()],
    queryFn: () => api.calendar.getEvents({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }),
    retry: 1,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.bookings.list({ limit: 1000 }),
  });

  const events = eventsData?.events || [];
  const bookings = bookingsData?.bookings || [];

  // Combine events and bookings
  const allEvents = [
    ...events.map((e) => ({
      id: e.id,
      title: e.summary,
      start: e.start,
      end: e.end,
      type: e.isHoliday ? ("holiday" as const) : ("calendar" as const),
      location: e.location,
      description: e.description,
      attendees: e.attendees,
      conferenceUrl: e.conferenceData?.entryPoints?.[0]?.uri,
      isHoliday: e.isHoliday,
      holidayType: e.holidayType,
      calendarId: e.calendarId,
    })),
    ...bookings.map((b) => ({
      id: b.id,
      title: b.meetingType?.name || "Meeting",
      start: b.startTime,
      end: b.endTime,
      type: "booking" as const,
      location: b.conferenceUrl || "",
      attendees: [],
      conferenceUrl: b.conferenceUrl || null,
      isHoliday: false,
    })),
  ];

  const createEventMutation = useMutation({
    mutationFn: (data: {
      summary: string;
      description?: string;
      start: string;
      end: string;
      location?: string;
      attendees?: Array<{ email: string; displayName?: string }>;
    }) => api.calendar.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowEventModal(false);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: any }) =>
      api.calendar.updateEvent(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowEventModal(false);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: ({ eventId, calendarId }: { eventId: string; calendarId?: string }) =>
      api.calendar.deleteEvent(eventId, calendarId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowEventModal(false);
    },
  });

  const handleEventClick = (event: any, e: React.MouseEvent) => {
    if (e.detail === 2) {
      // Double click
      if (event.type !== "holiday" && event.type !== "booking") {
        setSelectedEvent(event);
        setEventModalMode("edit");
        setShowEventModal(true);
      }
    } else {
      // Single click - show event details
      setSelectedEvent(event);
      setEventModalMode(event.type === "holiday" ? "edit" : "edit");
      setShowEventModal(true);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setEventModalMode("create");
    setShowEventModal(true);
  };

  const handleSaveEvent = async (data: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
  }) => {
    if (eventModalMode === "create") {
      await createEventMutation.mutateAsync(data);
    } else if (selectedEvent) {
      await updateEventMutation.mutateAsync({
        eventId: selectedEvent.id,
        data: {
          ...data,
          calendarId: selectedEvent.calendarId,
        },
      });
    }
  };

  const handleDeleteEvent = async (eventId: string, calendarId?: string) => {
    await deleteEventMutation.mutateAsync({ eventId, calendarId });
  };

  const getEventsForDate = (date: Date) => {
    return allEvents.filter((event) => {
      // Handle both date-time and date-only formats
      let eventStart: Date;
      if (event.start.includes("T")) {
        eventStart = parseISO(event.start);
      } else {
        // Date-only format (for holidays)
        eventStart = new Date(event.start);
        eventStart.setHours(0, 0, 0, 0);
      }
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      return isSameDay(eventStart, compareDate);
    });
  };

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1)));
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
      return newDate;
    });
  };

  const navigateDay = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  if (eventsLoading) {
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
            <p className="text-gray-600 dark:text-gray-400 mt-1">View your calendar events and meetings</p>
            {eventsError && (
              <p className="text-red-500 text-sm mt-2">
                Error loading events. Please check your calendar connection.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setSelectedEvent(null);
              setEventModalMode("create");
              setShowEventModal(true);
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Event
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
            <button
              onClick={() => setViewMode("month")}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === "month"
                  ? "bg-primary-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === "week"
                  ? "bg-primary-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === "day"
                  ? "bg-primary-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Day
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (viewMode === "month") navigateMonth("prev");
                else if (viewMode === "week") navigateWeek("prev");
                else navigateDay("prev");
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                if (viewMode === "month") navigateMonth("next");
                else if (viewMode === "week") navigateWeek("next");
                else navigateDay("next");
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <div className="flex-1 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {viewMode === "month"
                ? format(currentDate, "MMMM yyyy")
                : viewMode === "week"
                  ? `Week of ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
                  : format(currentDate, "EEEE, MMMM d, yyyy")}
            </h2>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {viewMode === "month" && (
            <div className="p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={idx}
                      className={`min-h-[100px] p-2 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isCurrentMonth ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"
                      } ${isToday ? "ring-2 ring-primary-500" : ""}`}
                      onClick={() => handleDateClick(day)}
                      onDoubleClick={() => handleDateClick(day)}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isCurrentMonth ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"
                        } ${isToday ? "text-primary-600 dark:text-primary-400" : ""}`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event, e);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event, e);
                            }}
                            className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
                              (event as any).isHoliday
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                : event.type === "booking"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            }`}
                            title={event.title}
                          >
                            {(event as any).isHoliday ? "🎉 " : ""}
                            {event.start.includes("T") ? format(parseISO(event.start), "HH:mm") + " " : ""}
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div className="p-4">
              {/* Time slots */}
              <div className="grid grid-cols-8 gap-2">
                {/* Time column */}
                <div className="space-y-1">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="h-16 text-xs text-gray-500 dark:text-gray-400 text-right pr-2">
                      {i.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Days */}
                {days.map((day) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div key={day.toISOString()} className="border-l border-gray-200 dark:border-gray-700">
                      <div
                        className={`text-center p-2 border-b border-gray-200 dark:border-gray-700 ${
                          isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {format(day, "EEE")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{format(day, "d")}</div>
                      </div>
                      <div className="relative min-h-[384px]">
                        {dayEvents.map((event) => {
                          const start = parseISO(event.start);
                          const end = parseISO(event.end);
                          const top = (getHours(start) + getMinutes(start) / 60) * 16;
                          const height = ((end.getTime() - start.getTime()) / (1000 * 60)) * (16 / 60);

                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              className={`absolute left-0 right-0 p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                                (event as any).isHoliday
                                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                                  : event.type === "booking"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                              }`}
                              style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                              title={event.title}
                            >
                              <div className="font-medium truncate">
                                {(event as any).isHoliday ? "🎉 " : ""}
                                {event.title}
                              </div>
                              <div className="text-xs opacity-75">
                                {format(start, "HH:mm")} - {format(end, "HH:mm")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "day" && (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Time slots */}
                <div className="space-y-1">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hourDate = new Date(currentDate);
                    hourDate.setHours(i, 0, 0, 0);
                    const hourEvents = allEvents.filter((event) => {
                      const eventStart = parseISO(event.start);
                      return eventStart.getHours() === i && isSameDay(eventStart, currentDate);
                    });

                    return (
                      <div key={i} className="flex gap-2">
                        <div className="w-16 text-xs text-gray-500 dark:text-gray-400 text-right">
                          {i.toString().padStart(2, "0")}:00
                        </div>
                        <div className="flex-1 min-h-[60px] border-t border-gray-200 dark:border-gray-700">
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              className={`p-2 rounded mb-1 cursor-pointer hover:opacity-80 transition-opacity ${
                                (event as any).isHoliday
                                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                  : event.type === "booking"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              <div className="font-medium text-sm">
                                {(event as any).isHoliday ? "🎉 " : ""}
                                {event.title}
                              </div>
                              <div className="text-xs opacity-75">
                                {format(parseISO(event.start), "HH:mm")} - {format(parseISO(event.end), "HH:mm")}
                              </div>
                              {event.location && (
                                <div className="text-xs opacity-75 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Event details */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {format(currentDate, "EEEE, MMMM d")}
                  </h3>
                  <div className="space-y-3">
                    {getEventsForDate(currentDate).map((event) => {
                      const start = parseISO(event.start);
                      const end = parseISO(event.end);

                      return (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(event, e)}
                          onDoubleClick={(e) => handleEventClick(event, e)}
                          className={`p-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${
                            (event as any).isHoliday
                              ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                              : event.type === "booking"
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {(event as any).isHoliday ? "🎉 " : ""}
                              {event.title}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                (event as any).isHoliday
                                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                  : event.type === "booking"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {(event as any).isHoliday ? "Holiday" : event.type === "booking" ? "Booking" : "Event"}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {format(start, "HH:mm")} - {format(end, "HH:mm")}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {event.location}
                              </div>
                            )}
                            {event.conferenceUrl && (
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                <a
                                  href={event.conferenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                  Join Meeting
                                </a>
                              </div>
                            )}
                            {event.attendees.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {getEventsForDate(currentDate).length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No events scheduled
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={selectedEvent && selectedEvent.type !== "holiday" && selectedEvent.type !== "booking" ? handleDeleteEvent : undefined}
        mode={eventModalMode}
        defaultDate={selectedDate || undefined}
      />
    </Layout>
  );
}

