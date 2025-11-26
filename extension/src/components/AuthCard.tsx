import { Button } from "./Button";
import { Card } from "./Card";

type AuthCardProps = {
  isConnecting: boolean;
  onConnect: () => void;
  backendUrl: string;
};

export const AuthCard = ({ isConnecting, onConnect, backendUrl }: AuthCardProps) => (
  <Card>
    <h2
      style={{
        fontSize: "18px",
        marginBottom: "12px",
      }}
    >
      Connect Google Workspace
    </h2>
    <p
      style={{
        color: "#5f6368",
        fontSize: "14px",
        lineHeight: 1.5,
        marginBottom: "16px",
      }}
    >
      Authorize TaskForce to send Gmail campaigns, import recipients from Google Sheets, and
      schedule follow-ups. Ensure the backend at <strong>{backendUrl}</strong> is reachable.
    </p>
    <Button onClick={onConnect} disabled={isConnecting}>
      {isConnecting ? "Connecting..." : "Connect Google Account"}
    </Button>
  </Card>
);


