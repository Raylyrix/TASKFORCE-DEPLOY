import { useMemo } from "react";
import type { MeetingTypeSummary, BookingLinkSummary } from "../shared/types";

type BookingPagePreviewProps = {
  meetingType: MeetingTypeSummary;
  bookingLink: BookingLinkSummary;
  backendUrl: string;
  previewToken?: string;
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

const formatLocationType = (type: MeetingTypeSummary["meetingLocationType"]) => {
  switch (type) {
    case "googleMeet":
      return "Google Meet";
    case "phone":
      return "Phone call";
    case "inPerson":
      return "In person";
    case "customUrl":
      return "Custom link";
    default:
      return "TBD";
  }
};

export const BookingPagePreview = ({
  meetingType,
  bookingLink,
  backendUrl,
}: BookingPagePreviewProps) => {
  const bookingUrl = useMemo(() => {
    if (!backendUrl || !bookingLink) return null;
    const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    return `${base}/book/${bookingLink.token}`;
  }, [backendUrl, bookingLink]);

  if (!bookingUrl) {
    return (
      <div
        style={{
          border: "1px solid #dadce0",
          borderRadius: "10px",
          padding: "16px",
          backgroundColor: "#f8f9fa",
          fontSize: "12px",
          color: "#5f6368",
        }}
      >
        Booking page preview unavailable — backend URL missing.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #dadce0",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        maxHeight: "600px",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid #e0e3e7",
          padding: "12px 16px",
          backgroundColor: "#f8f9fa",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
          Booking page preview
        </span>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "11px",
            color: "#1a73e8",
            textDecoration: "none",
            fontWeight: 600,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.textDecoration = "none";
          }}
        >
          Open full page →
        </a>
      </div>

      <div
        style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          overflowY: "auto",
          fontSize: "13px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 600,
              color: "#1f1f1f",
              marginBottom: "8px",
            }}
          >
            {meetingType.name}
          </h1>
          {meetingType.description ? (
            <p style={{ margin: 0, color: "#5f6368", fontSize: "14px" }}>{meetingType.description}</p>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            padding: "12px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", color: "#5f6368", display: "block" }}>Duration</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
              {formatDuration(meetingType.durationMinutes)}
            </span>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "#5f6368", display: "block" }}>Location</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f1f1f" }}>
              {formatLocationType(meetingType.meetingLocationType)}
            </span>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #d2e3fc",
            borderRadius: "10px",
            padding: "16px",
            backgroundColor: "#eef3fe",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "#1f1f1f" }}>
            Suggested time
          </h2>
          <div
            style={{
              padding: "12px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #c3d4fd",
              marginBottom: "12px",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1f1f1f", marginBottom: "4px" }}>
              Smart recommendation
            </div>
            <div style={{ fontSize: "12px", color: "#5f6368" }}>
              {meetingType.durationMinutes} minute meeting • Your timezone
            </div>
          </div>
          <button
            type="button"
            disabled
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#1a73e8",
              color: "#fff",
              cursor: "default",
              fontSize: "13px",
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            Book selected time
          </button>
          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#5f6368", textAlign: "center" }}>
            Select a suggested slot or browse other availability below.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "#1f1f1f" }}>
            Pick another time
          </h2>
          <div
            style={{
              border: "1px dashed #dadce0",
              borderRadius: "8px",
              padding: "24px",
              textAlign: "center",
              color: "#5f6368",
              fontSize: "12px",
            }}
          >
            Availability grid will show here. Run a calendar sync to populate slots.
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e0e3e7",
            borderRadius: "10px",
            padding: "16px",
            backgroundColor: "#f8f9fa",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#1f1f1f" }}>
            Need something else?
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#5f6368" }}>
            Let us know what works better and we'll coordinate with the host.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #dadce0",
                background: "#fff",
                color: "#3c4043",
                cursor: "default",
                fontSize: "12px",
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              Propose different times
            </button>
            <button
              type="button"
              disabled
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #dadce0",
                background: "#fff",
                color: "#3c4043",
                cursor: "default",
                fontSize: "12px",
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              Notify me when new slots open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


