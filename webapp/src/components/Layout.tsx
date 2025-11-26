"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Calendar,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Users,
  Workflow,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import Footer from "./Footer";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userPictureUrl, setUserPictureUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Only read from localStorage on client side after mount
    setMounted(true);
    setUserEmail(localStorage.getItem("userEmail"));
    setUserDisplayName(localStorage.getItem("userDisplayName"));
    setUserPictureUrl(localStorage.getItem("userPictureUrl"));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userDisplayName");
    localStorage.removeItem("userPictureUrl");
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/campaigns", label: "Campaigns", icon: Mail },
    { href: "/campaigns/new", label: "Compose", icon: Mail },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/bookings", label: "Bookings", icon: CalendarCheck },
    { href: "/emails", label: "Emails", icon: MessageSquare },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/follow-ups", label: "Follow-ups", icon: TrendingUp },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">TaskForce</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? <X className="w-6 h-6 text-gray-700 dark:text-gray-300" /> : <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar - Icon-only with hover expansion */}
        <aside
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${
            sidebarOpen || sidebarHovered ? "w-64" : "w-16"
          } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out overflow-hidden shadow-lg`}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className={`h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 ${sidebarOpen || sidebarHovered ? "px-6" : "px-2"}`}>
              {(sidebarOpen || sidebarHovered) && <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">TaskForce</h1>}
              {!(sidebarOpen || sidebarHovered) && <h1 className="text-xl font-bold text-gray-900 dark:text-white">TF</h1>}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="lg:flex hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:flex hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {sidebarOpen ? <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 py-6 space-y-1 overflow-y-auto ${sidebarOpen || sidebarHovered ? "px-4" : "px-2"} transition-all duration-300`}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const showLabel = sidebarOpen || sidebarHovered;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center ${showLabel ? "gap-3 px-4" : "justify-center px-2"} py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    title={!showLabel ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {showLabel && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className={`border-t border-gray-200 dark:border-gray-700 ${sidebarOpen || sidebarHovered ? "p-4" : "p-2"} transition-all duration-300`}>
              {(sidebarOpen || sidebarHovered) ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {mounted && userPictureUrl ? (
                      <img
                        src={userPictureUrl}
                        alt={userDisplayName || ""}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 dark:text-primary-300 font-medium">
                          {(mounted && (userDisplayName || userEmail)) ? (userDisplayName || userEmail || "U")[0].toUpperCase() : "U"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {mounted ? (userDisplayName || "User") : "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{mounted ? userEmail : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm whitespace-nowrap">Log out</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {mounted && userPictureUrl ? (
                    <img
                      src={userPictureUrl}
                      alt={userDisplayName || ""}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-primary-700 dark:text-primary-300 font-medium text-xs">
                        {(mounted && (userDisplayName || userEmail)) ? (userDisplayName || userEmail || "U")[0].toUpperCase() : "U"}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 transition-all duration-300 min-w-0 flex flex-col">
          <div className="p-4 lg:p-8 flex-1">{children}</div>
          <Footer />
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

