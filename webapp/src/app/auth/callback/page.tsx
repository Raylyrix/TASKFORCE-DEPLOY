"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        // Check for OAuth error from Google
        if (error) {
          setError(`OAuth error: ${error}. Please try logging in again.`);
          return;
        }

        if (!code || !state) {
          setError("Missing authentication parameters. Please try logging in again.");
          return;
        }

        // Exchange code for tokens
        // Use direct backend URL to avoid Next.js rewrite issues (like extension does)
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://taskforce-backend-production.up.railway.app";
        
        // Add timeout wrapper to prevent hanging
        const fetchWithTimeout = (url: string, config: RequestInit, timeoutMs: number): Promise<Response> => {
          return Promise.race([
            fetch(url, config),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
        };

        const exchangeResponse = await fetchWithTimeout(
          `${backendUrl}/api/auth/google/exchange`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, state }),
          },
          30000 // 30 second timeout
        );

        if (!exchangeResponse.ok) {
          const errorText = await exchangeResponse.text();
          let errorMessage = errorText || `Authentication failed with status ${exchangeResponse.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = errorJson.error;
            }
          } catch {
            // Not JSON, use text as-is
          }
          throw new Error(errorMessage);
        }

        const { user } = await exchangeResponse.json();

        // Store user info
        if (typeof window !== "undefined") {
          localStorage.setItem("userId", user.id);
          localStorage.setItem("userEmail", user.email);
          localStorage.setItem("userDisplayName", user.displayName || user.email);
          if (user.pictureUrl) {
            localStorage.setItem("userPictureUrl", user.pictureUrl);
          }
        }

        // Redirect to dashboard
        router.push("/dashboard");
      } catch (err) {
        let errorMessage = "Authentication failed";
        if (err instanceof Error) {
          errorMessage = err.message;
          // Provide more helpful error message for state issues
          if (errorMessage.includes("OAuth state") || errorMessage.includes("Invalid or expired")) {
            errorMessage = "Authentication session expired. Please try logging in again.";
          }
        }
        setError(errorMessage);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-6 py-8 bg-white rounded-2xl shadow-xl text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

