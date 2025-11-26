import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";

import type { MeetingTypeSummary } from "../shared/types";
import { useExtensionStore } from "../shared/store";
import { schedulerApi } from "../shared/schedulerApi";
import type { CalendarListEntry, CalendarConnectionSummary } from "../shared/types";
import { AvailabilityPreview } from "./AvailabilityPreview";
import { BookingPagePreview } from "./BookingPagePreview";

const CADENCE_OPTIONS: Array<{ value: string; label: string; minutes: number | null }> = [
  { value: "manual", label: "Manual only", minutes: null },
  { value: "30", label: "Every 30 min", minutes: 30 },
  { value: "60", label: "Every hour", minutes: 60 },
  { value: "120", label: "Every 2 hours", minutes: 120 },
  { value: "360", label: "Every 6 hours", minutes: 360 },
  { value: "720", label: "Every 12 hours", minutes: 720 },
  { value: "1440", label: "Every day", minutes: 1440 },
  { value: "2880", label: "Every 2 days", minutes: 2880 },
];

const formatLinkText = (name: string) => `Book time (${name})`;

type MeetingTypePickerProps = {
  backendUrl: string;
  onInsertIntoBody: (link: string, meetingName: string, linkLabel: string) => void;
  onInsertIntoSubject: (text: string) => void;
};

const ensureAbsoluteUrl = (backendUrl: string, token: string) => {
  const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
  return `${base}/book/${token}`;
};

const toast = (message: string) => {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("taskforce-toast", { detail: { message } }));
    }
  } catch {
    // noop
  }
};

export const MeetingTypePicker = ({ backendUrl, onInsertIntoBody, onInsertIntoSubject }: MeetingTypePickerProps) => {
  const scheduler = useExtensionStore((state) => state.scheduler);
  const setSelectedMeetingType = useExtensionStore((state) => state.setSelectedMeetingType);
  const setSelectedBookingLink = useExtensionStore((state) => state.setSelectedBookingLink);
  const setAvailabilityData = useExtensionStore((state) => state.setAvailabilityData);
  const setAvailabilityLoading = useExtensionStore((state) => state.setAvailabilityLoading);
  const startCalendarSync = useExtensionStore((state) => state.startCalendarSync);
  const completeCalendarSync = useExtensionStore((state) => state.completeCalendarSync);
  const upsertMeetingTypes = useExtensionStore((state) => state.upsertMeetingTypes);
  const upsertCalendarConnections = useExtensionStore((state) => state.upsertCalendarConnections);
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    durationMinutes: 30,
    meetingLocationType: "GOOGLE_MEET",
    meetingLocationValue: "",
    description: "",
  });
  const [ctaSubjectTemplate, setCtaSubjectTemplate] = useState("Book time ({{meetingName}})");
  const [ctaBodyLabel, setCtaBodyLabel] = useState("Schedule time with me");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [renameDraft, setRenameDraft] = useState<{ id: string; value: string } | null>(null);
  const [managementBusyId, setManagementBusyId] = useState<string | null>(null);
  const [connectionBusyId, setConnectionBusyId] = useState<string | null>(null);
  const [calendarPanelOpen, setCalendarPanelOpen] = useState<string | null>(null);
  const [calendarLists, setCalendarLists] = useState<Record<string, CalendarListEntry[]>>({});
  const [calendarSelections, setCalendarSelections] = useState<Record<string, Set<string>>>({});
  const [calendarLoading, setCalendarLoading] = useState<Record<string, boolean>>({});
  const [calendarErrors, setCalendarErrors] = useState<Record<string, string | null>>({});
  const [showBookingPreview, setShowBookingPreview] = useState(false);

  const allMeetingTypes = scheduler.meetingTypes;
  const meetingTypes = allMeetingTypes.filter((meetingType) => meetingType.isActive);
  const connections = scheduler.calendarConnections;

  const meetingLocationLabel: Record<MeetingTypeSummary["meetingLocationType"], string> = {
    googleMeet: "Google Meet",
    phone: "Phone call",
    inPerson: "In person",
    customUrl: "Custom link",
  };

  const selectedMeeting = useMemo(() => {
    return scheduler.meetingTypes.find((meetingType) => meetingType.id === scheduler.selectedMeetingTypeId);
  }, [scheduler.meetingTypes, scheduler.selectedMeetingTypeId]);

  const bookingLinks = selectedMeeting?.bookingLinks ?? [];

  const selectedBookingLink = bookingLinks.find((link) => link.id === scheduler.selectedBookingLinkId) ?? bookingLinks[0];

  const meetingLink =
    selectedBookingLink && backendUrl
      ? ensureAbsoluteUrl(backendUrl, selectedBookingLink.token)
      : null;

  useEffect(() => {
    if (allMeetingTypes.length > 0) {
      setPanelOpen(true);
    }
  }, [allMeetingTypes.length]);

  useEffect(() => {
    if (calendarPanelOpen && !connections.some((connection) => connection.id === calendarPanelOpen)) {
      setCalendarPanelOpen(null);
    }
  }, [calendarPanelOpen, connections]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedMeeting) {
      setAvailabilityData({ availability: [], metadata: undefined });
      return;
    }

    // Check if calendar connection exists
    if (connections.length === 0) {
      setAvailabilityLoading(
        false,
        "Calendar connection required. Please connect your Google Calendar first.",
      );
      setAvailabilityData({
        availability: [],
        metadata: {
          error: "NO_CALENDAR_CONNECTION",
          message: "Calendar connection required. Please connect your Google Calendar first.",
        },
      });
      return;
    }

    const start = new Date();
    const end = addDays(start, 7);
    setAvailabilityLoading(true, null);

    void schedulerApi
      .fetchAvailability({
        start: start.toISOString(),
        end: end.toISOString(),
        meetingTypeId: selectedMeeting.id,
      })
      .then((payload) => {
        if (cancelled) return;
        
        // Check if sync is needed
        const needsSync = payload.metadata?.needsSync ?? false;
        const availabilityMessage = payload.metadata?.message;
        
        setAvailabilityData({
          availability: payload.availability,
          metadata: {
            rangeStart: payload.metadata.rangeStart,
            rangeEnd: payload.metadata.rangeEnd,
            meetingTypeId: payload.metadata.meetingTypeId,
            cachesEvaluated: payload.metadata.cachesEvaluated,
            needsSync,
            availabilityMessage,
          },
        });
        
        if (needsSync) {
          setAvailabilityLoading(
            false,
            availabilityMessage || "Calendar sync required. Please sync your calendar to see availability.",
          );
        } else {
          setAvailabilityLoading(false);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load availability.";
        setAvailabilityLoading(false, message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMeeting?.id, connections.length, setAvailabilityData, setAvailabilityLoading]);

  const handleMeetingTypeChange = (meetingTypeId: string) => {
    if (!meetingTypeId) {
      setSelectedMeetingType(undefined);
      return;
    }
    setSelectedMeetingType(meetingTypeId);
  };

  const handleBookingLinkChange = (bookingLinkId: string) => {
    if (!bookingLinkId) {
      setSelectedBookingLink(undefined);
      return;
    }
    setSelectedBookingLink(bookingLinkId);
  };

  const handleManualSync = async (connectionId: string) => {
    try {
      startCalendarSync();
      await schedulerApi.syncConnection(connectionId);
      completeCalendarSync();
      toast("Calendar synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar sync failed.";
      completeCalendarSync(message);
      toast(message);
    }
  };

  const handleSyncAllConnections = async () => {
    if (connections.length === 0) {
      return;
    }
    try {
      startCalendarSync();
      await Promise.all(connections.map((connection) => schedulerApi.syncConnection(connection.id)));
      completeCalendarSync();
      toast("Calendar synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar sync failed.";
      completeCalendarSync(message);
      toast(message);
    }
  };

  const renderConnectionsSummary = () => {
    if (connections.length === 0) {
      return null;
    }

    const now = Date.now();

    return (
      <div
        style={{
          border: "1px solid #e0e3e7",
          borderRadius: "10px",
          padding: "10px",
          backgroundColor: "#f8f9fa",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "12px",
        }}
      >
        <strong style={{ color: "#1f1f1f" }}>Calendar availability sources</strong>
        {connections.map((connection) => {
          const busy = connectionBusyId === connection.id;
          const lastSyncedAt = connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : null;
          const lastSyncedLabel = lastSyncedAt ? lastSyncedAt.toLocaleString() : "Never synced";
          const cadenceMinutes = connection.syncCadenceMinutes ?? null;
          const staleThresholdMs = cadenceMinutes ? cadenceMinutes * 60_000 * 1.2 : null;
          const isStale =
            staleThresholdMs !== null && lastSyncedAt
              ? now - lastSyncedAt.getTime() > staleThresholdMs
              : false;
          const staleByMinutes =
            isStale && cadenceMinutes && lastSyncedAt
              ? Math.max(1, Math.round((now - lastSyncedAt.getTime()) / 60000 - cadenceMinutes))
              : null;
          const cadenceValue =
            connection.syncCadenceMinutes && connection.syncCadenceMinutes > 0
              ? String(connection.syncCadenceMinutes)
              : "manual";
          const calendarsSummary = describeCalendars(connection);
          const isPanelOpen = calendarPanelOpen === connection.id;
          const calendarList = calendarLists[connection.id];
          const selection = calendarSelections[connection.id] ?? new Set(connection.selectedCalendars);
          const isLoadingCalendars = calendarLoading[connection.id];
          const calendarError = calendarErrors[connection.id];

          return (
            <div
              key={connection.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                border: "1px solid #dadce0",
                borderRadius: "8px",
                padding: "10px",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span style={{ color: "#1f1f1f", fontWeight: 600 }}>{connection.accountEmail}</span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleManualSync(connection.id);
                    }}
                    disabled={scheduler.syncState.isSyncing || busy}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #1a73e8",
                      background: "#fff",
                      color: "#1a73e8",
                      cursor: scheduler.syncState.isSyncing || busy ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      opacity: scheduler.syncState.isSyncing || busy ? 0.7 : 1,
                    }}
                  >
                    {scheduler.syncState.isSyncing ? "Syncing…" : "Sync now"}
                  </button>
                  {scheduler.syncState.lastSyncedAt ? (
                    <span style={{ fontSize: "11px", color: "#5f6368" }}>
                      Background sync {new Date(scheduler.syncState.lastSyncedAt).toLocaleTimeString()}
                    </span>
                  ) : null}
                  {scheduler.syncState.error ? (
                    <span style={{ fontSize: "11px", color: "#b3261e" }}>{scheduler.syncState.error}</span>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "#5f6368" }}>Last sync: {lastSyncedLabel}</span>
                {isStale && staleByMinutes !== null ? (
                  <span style={{ fontSize: "11px", color: "#b3261e" }}>
                    Stale by {staleByMinutes} minute{staleByMinutes === 1 ? "" : "s"}. Run a sync or increase cadence.
                  </span>
                ) : null}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "#5f6368" }}>Auto-sync cadence</label>
                <select
                  value={cadenceValue}
                  onChange={(event) => void handleCadenceSelectChange(connection, event.target.value)}
                  disabled={busy}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #dadce0",
                    fontSize: "12px",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {CADENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#5f6368" }}>Calendars feeding availability</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleCalendarPanel(connection);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #dadce0",
                      background: "#fff",
                      color: "#1a73e8",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {isPanelOpen ? "Hide calendars" : "Manage calendars"}
                  </button>
                </div>
                <span style={{ fontSize: "11px", color: "#3c4043" }}>{calendarsSummary}</span>
              </div>

              {isPanelOpen ? (
                <div
                  style={{
                    border: "1px solid #d2e3fc",
                    borderRadius: "8px",
                    padding: "10px",
                    backgroundColor: "#eef3fe",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {isLoadingCalendars ? (
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Loading calendars…</span>
                  ) : calendarError ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#b3261e" }}>{calendarError}</span>
                      <button
                        type="button"
                        onClick={() => void loadCalendarsForConnection(connection.id)}
                        style={{
                          alignSelf: "flex-start",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #1a73e8",
                          background: "#fff",
                          color: "#1a73e8",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : calendarList && calendarList.length > 0 ? (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {calendarList.map((calendar) => (
                          <label
                            key={calendar.id}
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "flex-start",
                              fontSize: "12px",
                              color: "#3c4043",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selection.has(calendar.id)}
                              onChange={(event) =>
                                handleCalendarSelectionChange(connection, calendar.id, event.target.checked)
                              }
                              style={{ marginTop: "4px" }}
                            />
                            <span style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600 }}>
                                {calendar.summary}
                                {calendar.primary ? " (Primary)" : ""}
                              </span>
                              <span style={{ fontSize: "11px", color: "#5f6368" }}>
                                {calendar.timeZone ?? "Time zone unknown"}
                                {calendar.description ? ` • ${calendar.description}` : ""}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void handleSaveCalendars(connection)}
                          disabled={busy}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#1a73e8",
                            color: "#fff",
                            cursor: busy ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                            opacity: busy ? 0.7 : 1,
                          }}
                        >
                          {busy ? "Saving…" : "Save calendars"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void loadCalendarsForConnection(connection.id)}
                          disabled={isLoadingCalendars}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                            background: "#fff",
                            color: "#3c4043",
                            cursor: isLoadingCalendars ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Refresh list
                        </button>
                      </div>
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>
                        Make sure at least one calendar stays selected so availability remains accurate.
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>No calendars available.</span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const getPrimaryBookingLink = (meetingType: MeetingTypeSummary) =>
    meetingType.bookingLinks.find((link) => link.isPublic) ?? meetingType.bookingLinks[0] ?? null;

  const handleCopyPrimaryLink = async (meetingType: MeetingTypeSummary) => {
    const primaryLink = getPrimaryBookingLink(meetingType);
    if (!primaryLink) {
      toast("No booking link available yet.");
      return;
    }
    if (!backendUrl) {
      toast("Backend URL missing. Reconnect TaskForce to copy links.");
      return;
    }
    const url = ensureAbsoluteUrl(backendUrl, primaryLink.token);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast("Booking link copied");
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      toast("Failed to copy link automatically. Copy it from the preview instead.");
    }
  };

  const handleOpenPrimaryLink = (meetingType: MeetingTypeSummary) => {
    const primaryLink = getPrimaryBookingLink(meetingType);
    if (!primaryLink) {
      toast("No booking link available yet.");
      return;
    }
    if (!backendUrl) {
      toast("Backend URL missing. Reconnect TaskForce to open links.");
      return;
    }
    const url = ensureAbsoluteUrl(backendUrl, primaryLink.token);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const applyMeetingTypeUpdate = async (
    meetingTypeId: string,
    payload: Parameters<typeof schedulerApi.updateMeetingType>[1],
    successMessage: string,
  ) => {
    try {
      setManagementBusyId(meetingTypeId);
      const response = await schedulerApi.updateMeetingType(meetingTypeId, payload);
      upsertMeetingTypes([response.meetingType]);
      toast(successMessage);
      return response.meetingType;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update meeting type.";
      toast(message);
      throw error;
    } finally {
      setManagementBusyId(null);
    }
  };

  const handleToggleMeetingType = async (meetingType: MeetingTypeSummary) => {
    await applyMeetingTypeUpdate(
      meetingType.id,
      { isActive: !meetingType.isActive },
      meetingType.isActive ? "Meeting type paused" : "Meeting type activated",
    );
  };

  const startRenameMeetingType = (meetingType: MeetingTypeSummary) => {
    setRenameDraft({ id: meetingType.id, value: meetingType.name });
  };

  const cancelRenameMeetingType = () => setRenameDraft(null);

  const submitRenameMeetingType = async (meetingTypeId: string) => {
    if (!renameDraft || renameDraft.id !== meetingTypeId) {
      return;
    }
    const nextName = renameDraft.value.trim();
    if (!nextName) {
      toast("Meeting name cannot be empty.");
      return;
    }
    await applyMeetingTypeUpdate(meetingTypeId, { name: nextName }, "Meeting name updated");
    setRenameDraft(null);
  };

  const loadCalendarsForConnection = async (connectionId: string) => {
    setCalendarLoading((prev) => ({ ...prev, [connectionId]: true }));
    setCalendarErrors((prev) => ({ ...prev, [connectionId]: null }));
    try {
      const calendars = await schedulerApi.fetchConnectionCalendars(connectionId);
      setCalendarLists((prev) => ({ ...prev, [connectionId]: calendars }));
      setCalendarSelections((prev) => ({
        ...prev,
        [connectionId]: new Set(calendars.filter((entry) => entry.selected).map((entry) => entry.id)),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load calendars.";
      setCalendarErrors((prev) => ({ ...prev, [connectionId]: message }));
    } finally {
      setCalendarLoading((prev) => ({ ...prev, [connectionId]: false }));
    }
  };

  const handleToggleCalendarPanel = (connection: CalendarConnectionSummary) => {
    if (calendarPanelOpen === connection.id) {
      setCalendarPanelOpen(null);
      return;
    }
    setCalendarPanelOpen(connection.id);
    setCalendarSelections((prev) => ({
      ...prev,
      [connection.id]: new Set(connection.selectedCalendars),
    }));
    if (!calendarLists[connection.id]) {
      void loadCalendarsForConnection(connection.id);
    }
  };

  const handleCalendarSelectionChange = (
    connection: CalendarConnectionSummary,
    calendarId: string,
    checked: boolean,
  ) => {
    setCalendarSelections((prev) => {
      const base = prev[connection.id] ?? new Set(connection.selectedCalendars);
      const nextSet = new Set(base);
      if (checked) {
        nextSet.add(calendarId);
      } else {
        nextSet.delete(calendarId);
      }
      return {
        ...prev,
        [connection.id]: nextSet,
      };
    });
  };

  const applyConnectionPreferences = async (
    connectionId: string,
    payload: { syncCadenceMinutes?: number | null; calendars?: string[] },
    successMessage: string,
  ) => {
    try {
      setConnectionBusyId(connectionId);
      const updated = await schedulerApi.updateConnectionPreferences(connectionId, payload);
      upsertCalendarConnections([updated]);
      toast(successMessage);
      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update calendar preferences.";
      toast(message);
      throw error;
    } finally {
      setConnectionBusyId(null);
    }
  };

  const handleSaveCalendars = async (connection: CalendarConnectionSummary) => {
    const currentSelection = calendarSelections[connection.id] ?? new Set(connection.selectedCalendars);
    const calendars = Array.from(currentSelection);
    if (calendars.length === 0) {
      toast("Select at least one calendar for availability.");
      return;
    }
    try {
      const updated = await applyConnectionPreferences(
        connection.id,
        { calendars },
        "Calendars updated",
      );
      setCalendarSelections((prev) => ({
        ...prev,
        [connection.id]: new Set(updated.selectedCalendars),
      }));
      setCalendarLists((prev) => {
        const list = prev[connection.id];
        if (!list) {
          return prev;
        }
        return {
          ...prev,
          [connection.id]: list.map((entry) => ({
            ...entry,
            selected: updated.selectedCalendars.includes(entry.id),
          })),
        };
      });
    } catch {
      // Error toast already handled in applyConnectionPreferences.
    }
  };

  const handleCadenceSelectChange = async (connection: CalendarConnectionSummary, rawValue: string) => {
    const option = CADENCE_OPTIONS.find((item) => item.value === rawValue);
    const minutes =
      option !== undefined
        ? option.minutes
        : rawValue === "manual"
          ? null
          : Number.isNaN(Number(rawValue))
            ? null
            : Number(rawValue);

    if (rawValue !== "manual" && minutes === null) {
      return;
    }

    const nextMinutes = minutes;
    const currentMinutes = connection.syncCadenceMinutes ?? null;
    if (nextMinutes === currentMinutes) {
      return;
    }

    try {
      await applyConnectionPreferences(
        connection.id,
        { syncCadenceMinutes: nextMinutes },
        "Sync cadence updated",
      );
    } catch {
      // Error toast already handled inside applyConnectionPreferences.
    }
  };

  const describeCalendars = (connection: CalendarConnectionSummary) => {
    const list = calendarLists[connection.id];
    if (connection.selectedCalendars.length === 0) {
      return "Using primary calendar";
    }
    if (!list) {
      const count = connection.selectedCalendars.length;
      return `${count} calendar${count === 1 ? "" : "s"} selected`;
    }

    const names = connection.selectedCalendars
      .map((id) => list.find((entry) => entry.id === id)?.summary ?? id)
      .filter((name) => Boolean(name));

    if (names.length === 0) {
      const count = connection.selectedCalendars.length;
      return `${count} calendar${count === 1 ? "" : "s"} selected`;
    }
    if (names.length === 1) {
      return names[0];
    }
    if (names.length === 2) {
      return `${names[0]}, ${names[1]}`;
    }
    return `${names[0]}, ${names[1]} +${names.length - 2} more`;
  };

  const renderMeetingTypeManagement = () => {
    if (allMeetingTypes.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          border: "1px solid #e0e3e7",
          borderRadius: "12px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>Manage meeting types</span>
            <span style={{ fontSize: "11px", color: "#5f6368" }}>
              Rename, pause, or grab links without leaving the composer.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {allMeetingTypes.map((meetingType) => {
            const stats = meetingType.bookingStats;
            const isRenaming = renameDraft?.id === meetingType.id;
            const busy = managementBusyId === meetingType.id;
            const primaryLink = getPrimaryBookingLink(meetingType);

            const statsSegments = [
              `${stats.total} total`,
              `${stats.confirmed} confirmed`,
              `${stats.pending} pending`,
            ];
            if (stats.cancelled > 0) {
              statsSegments.push(`${stats.cancelled} cancelled`);
            }
            if (stats.declined > 0) {
              statsSegments.push(`${stats.declined} declined`);
            }
            const statsLine =
              stats.total === 0
                ? "No bookings yet."
                : `Bookings: ${statsSegments.join(" · ")}`;

            const lastBookedLine = stats.lastBookedAt
              ? `Last booking ${new Date(stats.lastBookedAt).toLocaleString()}`
              : "No bookings recorded yet.";

            const locationLabel = meetingLocationLabel[meetingType.meetingLocationType];

            return (
              <div
                key={meetingType.id}
                style={{
                  border: "1px solid #dadce0",
                  borderRadius: "10px",
                  padding: "10px",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  {isRenaming ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                      <input
                        value={renameDraft?.value ?? ""}
                        onChange={(event) =>
                          setRenameDraft((prev) =>
                            prev && prev.id === meetingType.id ? { ...prev, value: event.target.value } : prev,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submitRenameMeetingType(meetingType.id);
                          } else if (event.key === "Escape") {
                            cancelRenameMeetingType();
                          }
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          fontSize: "13px",
                        }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void submitRenameMeetingType(meetingType.id)}
                          disabled={busy}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#1a73e8",
                            color: "#fff",
                            cursor: busy ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                            opacity: busy ? 0.7 : 1,
                          }}
                        >
                          Save name
                        </button>
                        <button
                          type="button"
                          onClick={cancelRenameMeetingType}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                            background: "#fff",
                            color: "#3c4043",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "14px", color: "#1f1f1f" }}>{meetingType.name}</strong>
                        <span
                          style={{
                            fontSize: "11px",
                            color: meetingType.isActive ? "#137333" : "#b3261e",
                            backgroundColor: meetingType.isActive ? "#e6f4ea" : "#fce8e6",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          {meetingType.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "#5f6368" }}>
                        {meetingType.durationMinutes} min · {locationLabel}
                        {meetingType.meetingLocationValue
                          ? ` · ${meetingType.meetingLocationValue}`
                          : ""}
                      </span>
                    </div>
                  )}

                  {!isRenaming ? (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => startRenameMeetingType(meetingType)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          background: "#fff",
                          color: "#1a73e8",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleMeetingType(meetingType)}
                        disabled={busy}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: meetingType.isActive ? "#fce8e6" : "#e6f4ea",
                          color: meetingType.isActive ? "#b3261e" : "#137333",
                          cursor: busy ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          opacity: busy ? 0.7 : 1,
                        }}
                      >
                        {meetingType.isActive ? "Pause" : "Activate"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={{ fontSize: "12px", color: "#3c4043" }}>{statsLine}</div>
                <div style={{ fontSize: "11px", color: "#5f6368" }}>{lastBookedLine}</div>

                {primaryLink ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#5f6368" }}>Primary booking link</span>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => void handleCopyPrimaryLink(meetingType)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #1a73e8",
                          background: "#fff",
                          color: "#1a73e8",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPrimaryLink(meetingType)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#1a73e8",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Open page
                      </button>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: "11px", color: "#b3261e" }}>No public booking link yet.</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleCreateMeetingType = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    
    // Check if calendar connection exists
    if (connections.length === 0) {
      setFormError(
        "Calendar connection required. Please connect your Google Calendar first. Go to Settings and connect your calendar, then try again.",
      );
      return;
    }

    if (!formValues.name.trim()) {
      setFormError("Meeting name is required.");
      return;
    }
    if (formValues.meetingLocationType === "PHONE" && !formValues.meetingLocationValue.trim()) {
      setFormError("Add a dial-in number for phone meetings.");
      return;
    }
    if (formValues.meetingLocationType === "CUSTOM_URL" && !formValues.meetingLocationValue.trim()) {
      setFormError("Provide a URL for custom meeting locations.");
      return;
    }

    try {
      setFormBusy(true);
      
      // Use first available calendar connection if none specified
      const calendarConnectionId = connections[0]?.id ?? null;
      
      const response = await schedulerApi.createMeetingType({
        name: formValues.name.trim(),
        durationMinutes: Number(formValues.durationMinutes),
        meetingLocationType: formValues.meetingLocationType as "GOOGLE_MEET" | "PHONE" | "IN_PERSON" | "CUSTOM_URL",
        meetingLocationValue: formValues.meetingLocationValue.trim() || undefined,
        description: formValues.description.trim() || undefined,
        calendarConnectionId,
        createDefaultBookingLink: true,
      });
      upsertMeetingTypes([response.meetingType]);
      setSelectedMeetingType(response.meetingType.id);
      setSelectedBookingLink(response.meetingType.bookingLinks[0]?.id);
      setIsCreating(false);
      setFormValues({
        name: "",
        durationMinutes: 30,
        meetingLocationType: "GOOGLE_MEET",
        meetingLocationValue: "",
        description: "",
      });
      setCtaSubjectTemplate("Book time ({{meetingName}})");
      setCtaBodyLabel("Schedule time with me");
      toast("Meeting type created");
      
      // Auto-sync calendar on first meeting type creation
      if (connections.length > 0 && calendarConnectionId) {
        try {
          startCalendarSync();
          await schedulerApi.syncConnection(calendarConnectionId);
          completeCalendarSync();
          toast("Calendar synced automatically");
        } catch (syncError) {
          completeCalendarSync();
          // Don't show error toast - sync failure is not critical here
          console.warn("Auto-sync failed:", syncError);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create meeting type.";
      setFormError(message);
    } finally {
      setFormBusy(false);
    }
  };

  const renderCreateForm = () => (
    <form
      onSubmit={handleCreateMeetingType}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        border: "1px solid #e0e3e7",
        borderRadius: "12px",
        padding: "12px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>
          Meeting name
          <input
            value={formValues.name}
            onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Intro call"
            style={{
              marginTop: "4px",
              padding: "10px 12px",
              border: "1px solid #dadce0",
              borderRadius: "8px",
            }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>Duration (min)</span>
          <input
            type="number"
            min={5}
            max={480}
            value={formValues.durationMinutes}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }))
            }
            style={{
              padding: "10px 12px",
              border: "1px solid #dadce0",
              borderRadius: "8px",
            }}
          />
        </label>
        <label style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>Location</span>
          <select
            value={formValues.meetingLocationType}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                meetingLocationType: event.target.value,
                meetingLocationValue:
                  event.target.value === "GOOGLE_MEET" ? "" : prev.meetingLocationValue,
              }))
            }
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <option value="GOOGLE_MEET">Google Meet</option>
            <option value="PHONE">Phone call</option>
            <option value="IN_PERSON">In person</option>
            <option value="CUSTOM_URL">Custom URL</option>
          </select>
        </label>
        {(formValues.meetingLocationType === "PHONE" || formValues.meetingLocationType === "CUSTOM_URL") ? (
          <label style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>
              {formValues.meetingLocationType === "PHONE" ? "Dial-in / instructions" : "Meeting URL"}
            </span>
            <input
              value={formValues.meetingLocationValue}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, meetingLocationValue: event.target.value }))
              }
              placeholder={formValues.meetingLocationType === "PHONE" ? "+1 (555) 123-4567" : "https://…"}
              style={{
                padding: "10px 12px",
                border: "1px solid #dadce0",
                borderRadius: "8px",
              }}
            />
          </label>
        ) : null}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>Description (optional)</span>
        <textarea
          value={formValues.description}
          onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="What should invitees expect?"
          style={{
            padding: "10px 12px",
            border: "1px solid #dadce0",
            borderRadius: "8px",
            minHeight: "80px",
          }}
        />
      </label>
      {formError ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "#fef3f2",
            border: "1px solid #f6c3c3",
            fontSize: "12px",
            color: "#b3261e",
          }}
        >
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <span>{formError}</span>
        </div>
      ) : (
        <span style={{ fontSize: "11px", color: "#5f6368" }}>
          A public booking link will be generated automatically.
        </span>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="submit"
          disabled={formBusy}
          style={{
            padding: "8px 12px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {formBusy ? "Creating…" : "Create meeting type"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsCreating(false);
            setFormError(null);
          }}
          style={{
            padding: "8px 12px",
            background: "transparent",
            color: "#1a73e8",
            border: "1px solid #1a73e8",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (scheduler.isLoading && meetingTypes.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #e0e3e7",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "#f8f9fa",
          fontSize: "13px",
          color: "#5f6368",
        }}
      >
        Loading meeting types…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        border: "1px solid #e0e3e7",
        borderRadius: "12px",
        padding: "12px",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>Meeting scheduler</span>
          <span style={{ fontSize: "11px", color: "#5f6368" }}>
            Insert booking links or manage meeting types.
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPanelOpen((prev) => !prev);
          }}
          style={{
            border: "none",
            background: "#e8f0fe",
            color: "#1a73e8",
            borderRadius: "999px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {panelOpen ? "Hide" : "Show"}
        </button>
      </div>

      {!panelOpen ? null : (
        allMeetingTypes.length === 0 ? (
          isCreating ? (
            renderCreateForm()
          ) : (
            <div
              style={{
                border: "1px dashed #dadce0",
                borderRadius: "12px",
                padding: "12px",
                backgroundColor: "#fff",
                fontSize: "13px",
                color: "#5f6368",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <strong style={{ fontSize: "13px", color: "#1f1f1f" }}>Bring scheduling into your outreach</strong>
                <span>
                  Create a meeting type to generate booking links with live Google Calendar availability and Meet rooms.
                </span>
              </div>
              {scheduler.isLoading ? (
                <span style={{ fontSize: "12px", color: "#5f6368" }}>Checking for calendar connections…</span>
              ) : connections.length === 0 ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#5f6368",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                >
                  We haven’t detected a calendar connection yet. Re-run the TaskForce connect flow to grant Calendar & Meet
                  permissions.
                </div>
              ) : (
                renderConnectionsSummary()
              )}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  style={{
                    alignSelf: "flex-start",
                    padding: "8px 12px",
                    background: "#1a73e8",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  New meeting type
                </button>
                {connections.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleSyncAllConnections()}
                    disabled={scheduler.syncState.isSyncing}
                    style={{
                      padding: "8px 12px",
                      background: "#e8f0fe",
                      color: "#1a73e8",
                      border: "1px solid #1a73e8",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {scheduler.syncState.isSyncing ? "Syncing…" : "Sync availability"}
                  </button>
                ) : null}
              </div>
              <span style={{ fontSize: "11px", color: "#5f6368" }}>
                Meeting links make it easy for prospects to pick a slot—right from your campaign or follow-up.
              </span>
            </div>
          )
        ) : (
          <>
            {isCreating ? (
              renderCreateForm()
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 10px",
                  background: "#e8f0fe",
                  color: "#1a73e8",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                + Create meeting type
              </button>
            )}

            {renderMeetingTypeManagement()}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>
                Meeting type
              </label>
              <select
                value={selectedMeeting?.id ?? ""}
                onChange={(event) => handleMeetingTypeChange(event.target.value)}
                disabled={meetingTypes.length === 0}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #dadce0",
                }}
              >
                <option value="">Select a meeting type</option>
                {meetingTypes.map((meetingType) => (
                  <option key={meetingType.id} value={meetingType.id}>
                    {meetingType.name} • {meetingType.durationMinutes} min
                  </option>
                ))}
              </select>
              {meetingTypes.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#b3261e" }}>
                  No active meeting types. Activate one above to insert booking links.
                </span>
              ) : null}
            </div>

            {renderConnectionsSummary()}

            {selectedMeeting ? (
              <>
                {bookingLinks.length > 1 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f" }}>
                      Booking link
                    </label>
                    <select
                      value={selectedBookingLink?.id ?? ""}
                      onChange={(event) => handleBookingLinkChange(event.target.value)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                    >
                      {bookingLinks.map((link) => (
                        <option key={link.id} value={link.id}>
                          {link.name ?? "Unnamed link"} • {new Date(link.createdAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {meetingLink ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "10px",
                      border: "1px solid #e0e3e7",
                      borderRadius: "10px",
                      backgroundColor: "#f8f9fa",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Selected link</span>
                    <code
                      style={{
                        fontFamily: "var(--font-family-monospace, Consolas, Monaco, monospace)",
                        fontSize: "12px",
                        wordBreak: "break-all",
                        backgroundColor: "#fff",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                    >
                      {meetingLink}
                    </code>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "12px", color: "#5f6368" }}>
                        Subject CTA text (use {"{"}
                        {"{"}meetingName{"}"})
                        <input
                          value={ctaSubjectTemplate}
                          onChange={(event) => setCtaSubjectTemplate(event.target.value)}
                          style={{
                            marginTop: "4px",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                          }}
                        />
                      </label>
                      <label style={{ fontSize: "12px", color: "#5f6368" }}>
                        Body link label
                        <input
                          value={ctaBodyLabel}
                          onChange={(event) => setCtaBodyLabel(event.target.value)}
                          style={{
                            marginTop: "4px",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                          }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const label = ctaBodyLabel.trim() || "Schedule time";
                          onInsertIntoBody(meetingLink, selectedMeeting.name, label);
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#1a73e8",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Insert into body
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const template = (ctaSubjectTemplate || "{{meetingName}}").trim();
                          const finalTemplate = template.includes("{{meetingName}}")
                            ? template
                            : `${template} {{meetingName}}`;
                          const subjectCta = finalTemplate.replace(/{{meetingName}}/g, selectedMeeting.name);
                          onInsertIntoSubject(subjectCta);
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #1a73e8",
                          background: "#fff",
                          color: "#1a73e8",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Add subject CTA
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (navigator.clipboard?.writeText) {
                              await navigator.clipboard.writeText(meetingLink);
                              toast("✓ Link copied to clipboard");
                            } else {
                              throw new Error("Clipboard API unavailable");
                            }
                          } catch (error) {
                            toast("Failed to copy link. Please select and copy manually.");
                          }
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          background: "#fff",
                          color: "#3c4043",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        📋 Copy link
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px solid #f6c3c3",
                      borderRadius: "10px",
                      padding: "10px",
                      backgroundColor: "#fef3f2",
                      fontSize: "12px",
                      color: "#b3261e",
                    }}
                  >
                    No booking link found for this meeting type.
                  </div>
                )}

                {meetingLink && selectedBookingLink ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
                        Booking page preview
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBookingPreview((prev) => !prev)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          background: "#fff",
                          color: "#1a73e8",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {showBookingPreview ? "Hide preview" : "Show preview"}
                      </button>
                    </div>
                    {showBookingPreview ? (
                      <BookingPagePreview
                        meetingType={selectedMeeting}
                        bookingLink={selectedBookingLink}
                        backendUrl={backendUrl}
                      />
                    ) : null}
                  </div>
                ) : null}

                <AvailabilityPreview
                  meetingName={selectedMeeting.name}
                  availability={scheduler.availability}
                  metadata={scheduler.availabilityMetadata}
                  isLoading={scheduler.availabilityIsLoading}
                  error={scheduler.availabilityError}
                />
              </>
            ) : null}
          </>
        )
      )}
    </div>
  );
};


