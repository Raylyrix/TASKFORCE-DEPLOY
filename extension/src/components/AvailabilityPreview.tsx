import type { AvailabilityDay } from "../shared/types";

type AvailabilityPreviewProps = {
  meetingName?: string;
  availability: AvailabilityDay[];
  metadata?: {
    rangeStart: string;
    rangeEnd: string;
    meetingTypeId: string | null;
    cachesEvaluated: number;
    needsSync?: boolean;
    availabilityMessage?: string | null;
    error?: string;
  };
  isLoading: boolean;
  error?: string | null;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export const AvailabilityPreview = ({
  meetingName,
  availability,
  metadata,
  isLoading,
  error,
}: AvailabilityPreviewProps) => {
  if (!meetingName) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          border: "1px solid #e0e3e7",
          borderRadius: "10px",
          padding: "12px",
          backgroundColor: "#f8f9fa",
          fontSize: "12px",
          color: "#5f6368",
        }}
      >
        <div
          className="taskforce-spinner"
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid #dadce0",
            borderTopColor: "#1a73e8",
            borderRadius: "50%",
          }}
        />
        <span>Loading availability for {meetingName}…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          border: "1px solid #f6c3c3",
          borderRadius: "10px",
          padding: "12px",
          backgroundColor: "#fef3f2",
          fontSize: "12px",
          color: "#b3261e",
        }}
      >
        <span style={{ fontSize: "18px", flexShrink: 0 }}>❌</span>
        <div style={{ flex: 1, lineHeight: "1.5" }}>{error}</div>
      </div>
    );
  }

  if (availability.length === 0 || metadata?.needsSync) {
    const message = metadata?.availabilityMessage || metadata?.message || "No availability data yet. Run a calendar sync to populate busy blocks.";
    return (
      <div
        style={{
          border: "1px solid #fbbf24",
          borderRadius: "10px",
          padding: "12px",
          fontSize: "12px",
          backgroundColor: "#fef3c7",
          color: "#92400e",
        }}
      >
        <strong>⚠️ {metadata?.needsSync ? "Calendar sync required" : "No availability data"}</strong>
        <p style={{ margin: "8px 0 0", lineHeight: "1.5" }}>{message}</p>
      </div>
    );
  }

  const daysWithSlots = availability.slice(0, 5);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        border: "1px solid #e0e3e7",
        borderRadius: "10px",
        padding: "10px",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "#5f6368" }}>Calendar snapshot</span>
        {metadata ? (
          <span style={{ fontSize: "11px", color: "#9aa0a6" }}>
            {new Date(metadata.rangeStart).toLocaleDateString()} –{" "}
            {new Date(metadata.rangeEnd).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {daysWithSlots.map((day) => (
          <div
            key={day.date}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              border: "1px solid #dadce0",
              borderRadius: "8px",
              padding: "8px",
              backgroundColor: "#f8f9fa",
            }}
          >
            <strong style={{ fontSize: "12px", color: "#1f1f1f" }}>{formatDate(day.date)}</strong>
            {day.slots.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#5f6368" }}>No busy blocks recorded.</span>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  fontSize: "12px",
                  color: "#3c4043",
                }}
              >
                {day.slots.slice(0, 3).map((slot, index) => (
                  <li key={`${slot.start}-${index}`}>
                    Busy {formatTimeRange(slot.start, slot.end)}
                    {slot.source ? ` • ${slot.source}` : ""}
                  </li>
                ))}
                {day.slots.length > 3 ? (
                  <li style={{ color: "#5f6368" }}>+{day.slots.length - 3} more</li>
                ) : null}
              </ul>
            )}
          </div>
        ))}
      </div>

      {metadata ? (
        <span style={{ fontSize: "11px", color: "#9aa0a6" }}>
          Busy data from {metadata.cachesEvaluated} cache{metadata.cachesEvaluated === 1 ? "" : "s"}.
        </span>
      ) : null}
    </div>
  );
};


