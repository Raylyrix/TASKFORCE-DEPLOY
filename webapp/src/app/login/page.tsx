"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: (notification?: (notification: { isNotDisplayed: boolean; isSkippedMoment: boolean }) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const [showAutoLogin, setShowAutoLogin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Try to detect Google account
    const detectGoogleAccount = async () => {
      try {
        // Load Google Identity Services
        if (typeof window === "undefined") return;

        // Check if Google Identity Services is available
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          // Get Google Client ID from environment
          // In Next.js, NEXT_PUBLIC_* vars are available at runtime
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          
          if (!clientId || !window.google) {
            // Fallback: try to detect from localStorage or skip auto-detection
            detectEmailFromBrowser();
            return;
          }

          // Try to get one-tap sign-in
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              try {
                // Decode JWT to get email
                const payload = JSON.parse(atob(response.credential.split('.')[1]));
                const email = payload.email;
                
                if (email) {
                  setDetectedEmail(email);
                  setShowAutoLogin(true);
                }
              } catch (err) {
                console.error("Error decoding credential:", err);
              }
            },
          });

          // Show one-tap prompt
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed || notification.isSkippedMoment) {
              // One-tap not available, try to detect from browser
              detectEmailFromBrowser();
            }
          });
        };

        script.onerror = () => {
          // Fallback to browser detection
          detectEmailFromBrowser();
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error("Error detecting Google account:", err);
        detectEmailFromBrowser();
      }
    };

    const detectEmailFromBrowser = () => {
      // Try to get email from localStorage (if previously logged in)
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        setDetectedEmail(storedEmail);
        setShowAutoLogin(true);
      }
    };

    detectGoogleAccount();
  }, []);

  const handleAutoLogin = async () => {
    if (!detectedEmail) return;
    
    try {
      setLoading(true);
      setError(null);

      // Get current URL for redirect
      const redirectUri = typeof window !== "undefined" ? window.location.origin + "/auth/callback" : undefined;

      // Start OAuth flow
      const { url } = await api.auth.startGoogleAuth(redirectUri);

      // Store redirect URI in sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oauth_redirect_uri", redirectUri || "");
      }

      // Redirect to Google OAuth
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authentication");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current URL for redirect
      const redirectUri = typeof window !== "undefined" ? window.location.origin + "/auth/callback" : undefined;

      // Start OAuth flow
      const { url } = await api.auth.startGoogleAuth(redirectUri);

      // Store redirect URI in sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oauth_redirect_uri", redirectUri || "");
      }

      // Redirect to Google OAuth
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authentication");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <div className="max-w-md w-full px-6 py-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TaskForce</h1>
          <p className="text-gray-600">Email Campaign CRM</p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {showAutoLogin && detectedEmail && (
            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Continue as</p>
                  <p className="text-sm text-gray-600">{detectedEmail}</p>
                </div>
              </div>
              <button
                onClick={handleAutoLogin}
                disabled={loading}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? "Signing in..." : "Continue"}
              </button>
              <button
                onClick={() => setShowAutoLogin(false)}
                className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Use a different account
              </button>
            </div>
          )}

          {(!showAutoLogin || !detectedEmail) && (
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-medium">
              {loading ? "Redirecting..." : "Continue with Google"}
            </span>
          </button>
          )}

          <p className="text-xs text-gray-500 text-center mt-4">
            By continuing, you agree to TaskForce's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

