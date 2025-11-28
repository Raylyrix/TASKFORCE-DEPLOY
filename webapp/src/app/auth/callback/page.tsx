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
        const error = searchParams.get("error");
        const success = searchParams.get("success");

        // Check for OAuth error
        if (error) {
          setError(decodeURIComponent(error));
          return;
        }

        // Backend now handles exchange directly and redirects here with user info
        if (success === "true") {
          const userId = searchParams.get("userId");
          const email = searchParams.get("email");
          const displayName = searchParams.get("displayName");
          const pictureUrl = searchParams.get("pictureUrl");

          if (!userId || !email) {
            setError("Missing user information. Please try logging in again.");
            return;
          }

          // Store user info
          if (typeof window !== "undefined") {
            localStorage.setItem("userId", userId);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userDisplayName", displayName || email);
            if (pictureUrl) {
              localStorage.setItem("userPictureUrl", pictureUrl);
            }
          }

          // Redirect to dashboard
          router.push("/dashboard");
          return;
        }

        // Fallback: If no success param, show error
        setError("Authentication failed. Please try logging in again.");
      } catch (err) {
        let errorMessage = "Authentication failed";
        if (err instanceof Error) {
          errorMessage = err.message;
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

