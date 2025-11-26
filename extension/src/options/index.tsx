import { useState } from "react";
import { createRoot } from "react-dom/client";

import { useBackendConfig } from "../hooks/useBackendConfig";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

const OptionsApp = () => {
  const { backendUrl, updateBackendUrl, updating } = useBackendConfig();
  const [localBackendUrl, setLocalBackendUrl] = useState(backendUrl);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSave = async () => {
    await updateBackendUrl(localBackendUrl);
    setStatusMessage("Backend URL updated.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: "40px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Card style={{ width: "520px" }}>
        <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>TaskForce Extension Settings</h1>
        <p style={{ fontSize: "14px", color: "#5f6368", marginBottom: "16px" }}>
          Configure the backend API endpoint used for scheduling, Gmail delivery, and Sheets
          imports. This should match the URL where the TaskForce backend is running.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontWeight: 600 }}>Backend URL</span>
          <input
            type="url"
            value={localBackendUrl}
            onChange={(event) => setLocalBackendUrl(event.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          />
        </label>
        <Button
          onClick={handleSave}
          disabled={updating}
          style={{ marginTop: "16px", width: "160px" }}
        >
          {updating ? "Saving…" : "Save"}
        </Button>
        {statusMessage && (
          <span style={{ display: "block", marginTop: "12px", color: "#188038" }}>
            {statusMessage}
          </span>
        )}
      </Card>
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<OptionsApp />);
}


