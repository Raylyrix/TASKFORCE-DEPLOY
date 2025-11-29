import { Button } from "./Button";
import { Card } from "./Card";

type AuthCardProps = {
  isConnecting: boolean;
  onConnect: () => void;
  backendUrl: string;
};

export const AuthCard = ({ isConnecting, onConnect, backendUrl }: AuthCardProps) => {
  const isProduction = backendUrl.includes("railway.app") || backendUrl.includes("taskforce");
  
  return (
    <Card>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 600,
          marginBottom: "8px",
          color: "#202124",
        }}
      >
        Connect Google Workspace
      </h2>
      <p
        style={{
          color: "#5f6368",
          fontSize: "14px",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        {isProduction ? (
          <>
            Click the button below to connect your Google account. This will allow TaskForce to send Gmail campaigns, 
            import recipients from Google Sheets, and schedule follow-ups.
          </>
        ) : (
          <>
            Authorize TaskForce to send Gmail campaigns, import recipients from Google Sheets, and
            schedule follow-ups. Backend: <strong>{backendUrl}</strong>
          </>
        )}
      </p>
      <Button onClick={onConnect} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect Google Account"}
      </Button>
      {!isProduction && (
        <p
          style={{
            color: "#ea8600",
            fontSize: "12px",
            marginTop: "12px",
            padding: "8px",
            backgroundColor: "#fff4ce",
            borderRadius: "6px",
          }}
        >
          ⚠️ Using custom backend URL. Make sure it's accessible.
        </p>
      )}
    </Card>
  );
};


