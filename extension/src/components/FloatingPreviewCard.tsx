import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useExtensionStore } from "../shared/store";

type FloatingPreviewCardProps = {
  show: boolean;
  onClose: () => void;
  campaignName: string;
  recipientsLabel: string;
  startAtLabel: string;
  delayLabel: string;
  subjectPreview?: string;
  bodyPreview?: string;
  mergeFieldStatus?: {
    missing: string[];
    unused: string[];
  };
  recipientNavigator?: {
    currentIndex: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
  };
  searchControls?: {
    isOpen: boolean;
    query: string;
    onChange: (value: string) => void;
    onToggle: () => void;
    onClear: () => void;
    hasResults: boolean;
    totalResults: number;
  };
};

const PORTAL_ID = "taskforce-preview-portal";

export const FloatingPreviewCard = ({
  show,
  onClose,
  campaignName,
  recipientsLabel,
  startAtLabel,
  delayLabel,
  subjectPreview,
  bodyPreview,
  mergeFieldStatus,
  recipientNavigator,
  searchControls,
}: FloatingPreviewCardProps) => {
  const backendUrl = useExtensionStore((state) => state.backendUrl);
  const scheduler = useExtensionStore((state) => state.scheduler);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? window.innerWidth - 360 - 32 : 0,
    y: 96,
  }));
  const dragState = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    let container = document.getElementById(PORTAL_ID) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = PORTAL_ID;
      document.body.appendChild(container);
    }
    containerRef.current = container;
    return () => {
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPosition({
        x: Math.max(12, event.clientX - dragState.current.offsetX),
        y: Math.max(64, event.clientY - dragState.current.offsetY),
      });
    };

    const handleMouseUp = () => {
      dragState.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    dragState.current.dragging = true;
    dragState.current.offsetX = event.clientX - position.x;
    dragState.current.offsetY = event.clientY - position.y;
  };

  const selectedMeetingType = useMemo(
    () => scheduler.meetingTypes.find((item) => item.id === scheduler.selectedMeetingTypeId),
    [scheduler.meetingTypes, scheduler.selectedMeetingTypeId],
  );

  const selectedBookingLink = useMemo(() => {
    if (!selectedMeetingType) return undefined;
    if (scheduler.selectedBookingLinkId) {
      return selectedMeetingType.bookingLinks.find((link) => link.id === scheduler.selectedBookingLinkId);
    }
    return selectedMeetingType.bookingLinks[0];
  }, [selectedMeetingType, scheduler.selectedBookingLinkId]);

  const meetingLink = useMemo(() => {
    if (!backendUrl || !selectedBookingLink) return null;
    const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    return `${base}/book/${selectedBookingLink.token}`;
  }, [backendUrl, selectedBookingLink]);

  const availabilityDays = useMemo(() => scheduler.availability.slice(0, 3), [scheduler.availability]);

  const availabilityNote = scheduler.availabilityMetadata
    ? `Busy data from ${scheduler.availabilityMetadata.cachesEvaluated} cache${
        scheduler.availabilityMetadata.cachesEvaluated === 1 ? "" : "s"
      }.`
    : null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTimeRange = (startIso: string, endIso: string) => {
    const startTime = new Date(startIso);
    const endTime = new Date(endIso);
    return `${startTime.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })} – ${endTime.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  const portalChild = useMemo(() => {
    if (!show) return null;
    return (
      <div
        ref={cardRef}
        style={{
          position: "fixed",
          top: `${position.y}px`,
          left: `${position.x}px`,
          width: "340px",
          maxWidth: "90vw",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 10px 32px rgba(0,0,0,0.2)",
          border: "1px solid rgba(60,64,67,0.2)",
          zIndex: 2147483647,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          onMouseDown={handleMouseDown}
          style={{
            cursor: "grab",
            padding: "12px 16px",
            background: "#f8f9fa",
            borderBottom: "1px solid #e0e3e7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            userSelect: "none",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", color: "#5f6368" }}>Campaign preview</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#1f1f1f" }}>{campaignName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "16px",
              color: "#5f6368",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "13px",
              color: "#3c4043",
            }}
          >
            <span>{recipientsLabel}</span>
            <span>{startAtLabel}</span>
            <span>{delayLabel}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              color: "#5f6368",
            }}
          >
            {recipientNavigator ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={recipientNavigator.onPrevious}
                  style={{
                    border: "1px solid #dadce0",
                    background: "#ffffff",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    minWidth: "28px",
                  }}
                  disabled={recipientNavigator.total === 0}
                  aria-label="Previous recipient"
                >
                  ‹
                </button>
                <span>
                  {recipientNavigator.total === 0
                    ? "No recipients"
                    : `Recipient ${recipientNavigator.currentIndex + 1} of ${recipientNavigator.total}`}
                </span>
                <button
                  type="button"
                  onClick={recipientNavigator.onNext}
                  style={{
                    border: "1px solid #dadce0",
                    background: "#ffffff",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    minWidth: "28px",
                  }}
                  disabled={recipientNavigator.total === 0}
                  aria-label="Next recipient"
                >
                  ›
                </button>
                {searchControls ? (
                  <button
                    type="button"
                    onClick={searchControls.onToggle}
                    style={{
                      border: "1px solid #dadce0",
                      background: searchControls.isOpen ? "#e8f0fe" : "#ffffff",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {searchControls.isOpen ? "Close search" : "Search…"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {searchControls && searchControls.isOpen ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  border: "1px solid #dadce0",
                  borderRadius: "10px",
                  padding: "10px",
                  backgroundColor: "#ffffff",
                }}
              >
                <label style={{ fontSize: "12px", color: "#5f6368" }}>
                  Filter recipients
                  <input
                    value={searchControls.query}
                    onChange={(event) => searchControls.onChange(event.target.value)}
                    placeholder="Name, company, email…"
                    style={{
                      marginTop: "6px",
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #dadce0",
                    }}
                    autoFocus
                  />
                </label>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span>
                    {searchControls.hasResults
                      ? `${searchControls.totalResults} match${searchControls.totalResults === 1 ? "" : "es"}`
                      : "No matches"}
                  </span>
                  {searchControls.query ? (
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#1a73e8",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      onClick={searchControls.onClear}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {mergeFieldStatus && (mergeFieldStatus.missing.length > 0 || mergeFieldStatus.unused.length > 0) ? (
            <div
              style={{
                border: "1px solid #e0e3e7",
                borderRadius: "10px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              {mergeFieldStatus.missing.length > 0 ? (
                <div>
                  <strong style={{ color: "#c5221f" }}>Missing merge fields</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "16px", color: "#5f6368" }}>
                    {mergeFieldStatus.missing.map((token) => (
                      <li key={`preview-missing-${token}`}>{token}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span style={{ color: "#137333" }}>All merge fields appear valid.</span>
              )}
              {mergeFieldStatus.unused.length > 0 ? (
                <div>
                  <strong style={{ color: "#1a73e8" }}>Unused columns</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "16px", color: "#5f6368" }}>
                    {mergeFieldStatus.unused.map((field) => (
                      <li key={`preview-unused-${field}`}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {subjectPreview ? (
            <div>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#5f6368" }}>
                Subject
              </strong>
              <span style={{ fontSize: "14px", color: "#1f1f1f" }}>{subjectPreview}</span>
            </div>
          ) : null}
          {bodyPreview ? (
            <div>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#5f6368" }}>
                Body
              </strong>
              <div
                style={{
                  fontSize: "13px",
                  color: "#3c4043",
                  border: "1px solid #e0e3e7",
                  borderRadius: "10px",
                  padding: "10px",
                  backgroundColor: "#fff",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: bodyPreview }}
              />
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "#5f6368" }}>
              Import recipients to preview personalized content.
            </span>
          )}

          {selectedMeetingType ? (
            <div
              style={{
                border: "1px solid #e0e3e7",
                borderRadius: "10px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "#1f1f1f" }}>{selectedMeetingType.name}</strong>
                {meetingLink ? (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 600 }}
                  >
                    Booking page
                  </a>
                ) : null}
              </div>
              {scheduler.availabilityIsLoading ? (
                <span style={{ color: "#5f6368" }}>Loading calendar availability…</span>
              ) : scheduler.availabilityError ? (
                <span style={{ color: "#b3261e" }}>{scheduler.availabilityError}</span>
              ) : availabilityDays.length === 0 ? (
                <span style={{ color: "#5f6368" }}>No busy blocks captured yet.</span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    color: "#3c4043",
                  }}
                >
                  {availabilityDays.map((day) => (
                    <li key={`preview-availability-${day.date}`}>
                      <strong>{formatDate(day.date)}:</strong>{" "}
                      {day.slots.length === 0
                        ? "No busy blocks"
                        : day.slots
                            .slice(0, 2)
                            .map((slot) => formatTimeRange(slot.start, slot.end))
                            .join(", ")}
                      {day.slots.length > 2 ? ` (+${day.slots.length - 2} more)` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {availabilityNote ? (
                <span style={{ color: "#9aa0a6", fontSize: "11px" }}>{availabilityNote}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }, [
    show,
    campaignName,
    recipientsLabel,
    startAtLabel,
    delayLabel,
    subjectPreview,
    bodyPreview,
    position.x,
    position.y,
    selectedMeetingType,
    meetingLink,
    scheduler.availabilityIsLoading,
    scheduler.availabilityError,
    availabilityDays,
    availabilityNote,
  ]);

  if (!containerRef.current || !portalChild) return null;
  return createPortal(portalChild, containerRef.current);
};

