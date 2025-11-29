import { useState, useRef, useEffect } from "react";

type UserMenuProps = {
  user: {
    email: string;
    displayName?: string | null;
    pictureUrl?: string | null;
  };
  onDisconnect: () => void;
  onReauthenticate: () => void;
  isDisconnecting: boolean;
  isConnecting: boolean;
};

export const UserMenu = ({
  user,
  onDisconnect,
  onReauthenticate,
  isDisconnecting,
  isConnecting,
}: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid #dadce0",
          backgroundColor: "#fff",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f8f9fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#fff";
        }}
      >
        {user.pictureUrl ? (
          <img
            src={user.pictureUrl}
            alt={user.displayName ?? user.email}
            style={{ width: "24px", height: "24px", borderRadius: "50%" }}
          />
        ) : (
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#0b57d0",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {(user.displayName || user.email)[0].toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: "13px", fontWeight: 500, color: "#1f1f1f" }}>
          {user.displayName ?? user.email}
        </span>
        <span style={{ fontSize: "10px", color: "#5f6368" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            minWidth: "200px",
            backgroundColor: "#fff",
            border: "1px solid #dadce0",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #e8eaed",
              backgroundColor: "#f8f9fa",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#1f1f1f", marginBottom: "4px" }}>
              {user.displayName ?? "User"}
            </div>
            <div style={{ fontSize: "11px", color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px" }}>
            <button
              type="button"
              onClick={() => {
                onReauthenticate();
                setIsOpen(false);
              }}
              disabled={isConnecting || isDisconnecting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: "#34a853",
                cursor: isConnecting || isDisconnecting ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                textAlign: "left",
                opacity: isConnecting || isDisconnecting ? 0.6 : 1,
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isConnecting && !isDisconnecting) {
                  e.currentTarget.style.backgroundColor = "#e8f5e9";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span style={{ fontSize: "14px" }}>🔄</span>
              {isConnecting ? "Reauthenticating…" : "Reauthenticate"}
            </button>

            <button
              type="button"
              onClick={() => {
                onDisconnect();
                setIsOpen(false);
              }}
              disabled={isDisconnecting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: "#ea4335",
                cursor: isDisconnecting ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                textAlign: "left",
                opacity: isDisconnecting ? 0.6 : 1,
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isDisconnecting) {
                  e.currentTarget.style.backgroundColor = "#fce8e6";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span style={{ fontSize: "14px" }}>🚪</span>
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

