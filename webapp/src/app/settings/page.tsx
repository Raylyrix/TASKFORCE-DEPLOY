"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  User,
  Calendar,
  Bell,
  Key,
  Trash2,
  Save,
  RefreshCw,
  LogOut,
  Mail,
  Globe,
  Clock,
  Download,
  Package,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "calendar" | "notifications" | "account">("profile");
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    email: "",
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
      return;
    }

    // Load user data
    const displayName = localStorage.getItem("userDisplayName") || "";
    const email = localStorage.getItem("userEmail") || "";
    setProfileForm({ displayName, email });
  }, [router]);

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => api.calendar.getConnections(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string }) => {
      // In a real app, this would call an API endpoint
      localStorage.setItem("userDisplayName", data.displayName);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      alert("Profile updated successfully");
    },
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) => api.calendar.sync(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-connections"] });
      alert("Calendar synced successfully");
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userDisplayName");
    localStorage.removeItem("userPictureUrl");
    router.push("/login");
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "account" as const, label: "Account", icon: Key },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {activeTab === "profile" && (
            <ProfileTab
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              updateMutation={updateProfileMutation}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarTab
              connections={connections}
              isLoading={connectionsLoading}
              syncMutation={syncMutation}
            />
          )}

          {activeTab === "notifications" && <NotificationsTab />}

          {activeTab === "account" && <AccountTab onLogout={handleLogout} />}
          
          {activeTab === "profile" && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <ExtensionDownloadSection />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ProfileTab({
  profileForm,
  setProfileForm,
  updateMutation,
}: {
  profileForm: { displayName: string; email: string };
  setProfileForm: (form: { displayName: string; email: string }) => void;
  updateMutation: ReturnType<typeof useMutation<{ success: boolean }, Error, { displayName: string }, unknown>>;
}) {
  const userPictureUrl = typeof window !== "undefined" ? localStorage.getItem("userPictureUrl") : null;
  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>

        {/* Profile Picture */}
        <div className="flex items-center gap-4 mb-6">
          {userPictureUrl ? (
            <img
              src={userPictureUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full border-2 border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center border-2 border-gray-200">
              <User className="w-10 h-10 text-primary-600" />
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Profile picture is managed by Google</p>
            <p className="text-xs text-gray-500 mt-1">Update your picture in your Google account</p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
            <input
              type="text"
              value={profileForm.displayName}
              onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={profileForm.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email is managed by Google and cannot be changed here</p>
          </div>

          <button
            onClick={() => updateMutation.mutate({ displayName: profileForm.displayName })}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarTab({
  connections,
  isLoading,
  syncMutation,
}: {
  connections?: Array<{
    id: string;
    accountEmail: string;
    timeZone: string | null;
    lastSyncedAt: string | null;
  }>;
  isLoading: boolean;
  syncMutation: ReturnType<typeof useMutation<any, Error, string, unknown>>;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Calendar Connections</h2>

        {connections && connections.length > 0 ? (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{connection.accountEmail}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {connection.timeZone && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-4 h-4" />
                            {connection.timeZone}
                          </span>
                        )}
                        {connection.lastSyncedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last synced: {new Date(connection.lastSyncedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => syncMutation.mutate(connection.id)}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                    />
                    Sync Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No calendar connections found</p>
            <p className="text-sm mt-2">Connect your Google Calendar to get started</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Sync Preferences</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• Calendar sync runs automatically based on your configured cadence</p>
          <p>• Manual syncs are available anytime using the "Sync Now" button</p>
          <p>• Sync cadence can be configured in the Calendar page</p>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [notifications, setNotifications] = useState({
    emailBookings: true,
    emailCampaigns: true,
    emailReminders: true,
    browserBookings: true,
    browserCampaigns: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
        <p className="text-sm text-gray-600 mb-6">
          Choose how you want to be notified about important events
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">New Booking</p>
                <p className="text-sm text-gray-500">Get notified when someone books a meeting</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.emailBookings}
                onChange={(e) =>
                  setNotifications({ ...notifications, emailBookings: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Campaign Updates</p>
                <p className="text-sm text-gray-500">Notifications about campaign progress and milestones</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.emailCampaigns}
                onChange={(e) =>
                  setNotifications({ ...notifications, emailCampaigns: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Meeting Reminders</p>
                <p className="text-sm text-gray-500">Reminders before scheduled meetings</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.emailReminders}
                onChange={(e) =>
                  setNotifications({ ...notifications, emailReminders: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Browser Notifications</p>
                <p className="text-sm text-gray-500">Show browser notifications for new bookings</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.browserBookings}
                onChange={(e) =>
                  setNotifications({ ...notifications, browserBookings: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Save className="w-4 h-4" />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtensionDownloadSection() {
  const handleDownload = () => {
    // Create a temporary anchor element to trigger download
    const link = document.createElement("a");
    link.href = "/taskforce-extension-v1.0.0.zip";
    link.download = "taskforce-extension-v1.0.0.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Package className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chrome Extension v1.0.0</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download the TaskForce Chrome extension to compose campaigns directly from Gmail. 
            The extension integrates seamlessly with your Gmail account and allows you to create 
            and manage email campaigns without leaving your inbox.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            <strong>Version 1.0.0</strong> - Includes follow-ups, replies, reminders, email selector, and all latest features.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Download Extension
            </button>
            <a
              href="/INSTALLATION_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Installation Guide
            </a>
          </div>
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600">
              <strong>Installation Steps:</strong>
            </p>
            <ol className="text-xs text-gray-600 mt-2 space-y-1 list-decimal list-inside">
              <li>Extract the downloaded zip file</li>
              <li>Open Chrome and navigate to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
              <li>Enable "Developer mode" (toggle in top right)</li>
              <li>Click "Load unpacked" and select the extracted folder</li>
              <li>Click the extension icon and connect your Google account</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountTab({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h2>

        <div className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Reconnect Google Account</h3>
            <p className="text-sm text-gray-600 mb-4">
              Re-authenticate with Google to refresh your calendar and email permissions
            </p>
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Reconnect Google
            </button>
          </div>

          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <h3 className="font-medium text-red-900 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h3>
            <p className="text-sm text-red-700 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Sign Out</h3>
            <p className="text-sm text-gray-600 mb-4">Sign out of your account</p>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





