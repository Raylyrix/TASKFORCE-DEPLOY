import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";

export type TimelineEvent =
  | {
      type: "message";
      id: string;
      timestamp: string;
      subject: string;
      status: string;
      isFollowUp: boolean;
      opens: number;
      clicks: number;
      trackingEvents: Array<{
        type: string;
        timestamp: string;
      }>;
    }
  | {
      type: "booking";
      id: string;
      timestamp: string;
      meetingType: {
        id: string;
        name: string;
        durationMinutes: number;
      };
      startTime: string;
      endTime: string;
      status: string;
    }
  | {
      type: "reminder";
      id: string;
      timestamp: string;
      meetingType: {
        id: string;
        name: string;
      };
      status: string;
      sendCount: number;
    };

type RecipientActivityTimelineProps = {
  recipientEmail: string;
  timeline: TimelineEvent[];
  isLoading?: boolean;
  error?: string | null;
};

const formatEventTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, "MMM d, yyyy 'at' h:mm a"),
  };
};

const statusColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case "SENT":
    case "DELIVERED":
    case "CONFIRMED":
      return "#137333";
    case "PENDING":
    case "SCHEDULED":
      return "#1a73e8";
    case "FAILED":
    case "CANCELLED":
    case "DECLINED":
      return "#c5221f";
    default:
      return "#5f6368";
  }
};

export const RecipientActivityTimeline = ({
  recipientEmail,
  timeline,
  isLoading,
  error,
}: RecipientActivityTimelineProps) => {
  const sortedTimeline = useMemo(() => {
    return [...timeline].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [timeline]);

  if (isLoading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e0e3e7",
          backgroundColor: "#f8f9fa",
          fontSize: "13px",
          color: "#5f6368",
        }}
      >
        Loading activity timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #f6c3c3",
          backgroundColor: "#fef3f2",
          fontSize: "13px",
          color: "#b3261e",
        }}
      >
        {error}
      </div>
    );
  }

  if (sortedTimeline.length === 0) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e0e3e7",
          backgroundColor: "#f8f9fa",
          fontSize: "13px",
          color: "#5f6368",
        }}
      >
        No activity recorded for {recipientEmail} yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: "14px", color: "#1f1f1f" }}>Activity timeline</strong>
        <span style={{ fontSize: "12px", color: "#5f6368" }}>
          {sortedTimeline.length} event{sortedTimeline.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          border: "1px solid #e0e3e7",
          borderRadius: "10px",
          padding: "12px",
          backgroundColor: "#fff",
          maxHeight: "400px",
          overflowY: "auto",
        }}
      >
        {sortedTimeline.map((event, index) => {
          const { relative, absolute } = formatEventTime(event.timestamp);
          const isLast = index === sortedTimeline.length - 1;

          return (
            <div
              key={`${event.type}-${event.id}`}
              style={{
                display: "flex",
                gap: "12px",
                paddingBottom: isLast ? 0 : "12px",
                borderBottom: isLast ? "none" : "1px solid #f1f3f4",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  backgroundColor:
                    event.type === "booking"
                      ? "#137333"
                      : event.type === "message"
                        ? event.isFollowUp
                          ? "#1a73e8"
                          : "#5f6368"
                        : "#ff9800",
                  marginTop: "6px",
                  flexShrink: 0,
                }}
              />

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {event.type === "message" ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
                        {event.isFollowUp ? "Follow-up: " : ""}
                        {event.subject}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          backgroundColor: statusColor(event.status) + "1a",
                          color: statusColor(event.status),
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {event.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#5f6368" }}>
                      {event.opens > 0 && <span>Opened {event.opens}x</span>}
                      {event.clicks > 0 && <span>Clicked {event.clicks}x</span>}
                      {event.trackingEvents.length > 0 && (
                        <span>
                          {event.trackingEvents.length} tracking event
                          {event.trackingEvents.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </>
                ) : event.type === "booking" ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
                        Booked: {event.meetingType.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          backgroundColor: statusColor(event.status) + "1a",
                          color: statusColor(event.status),
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {event.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#5f6368" }}>
                      {format(new Date(event.startTime), "MMM d, yyyy 'at' h:mm a")} •{" "}
                      {event.meetingType.durationMinutes} minutes
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
                        Reminder: {event.meetingType.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          backgroundColor: statusColor(event.status) + "1a",
                          color: statusColor(event.status),
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {event.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#5f6368" }}>
                      Sent {event.sendCount} time{event.sendCount === 1 ? "" : "s"}
                    </div>
                  </>
                )}
                <span style={{ fontSize: "11px", color: "#9aa0a6" }} title={absolute}>
                  {relative}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

