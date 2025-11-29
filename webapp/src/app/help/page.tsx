"use client";

import Layout from "@/components/Layout";
import Link from "next/link";
import { Book, Video, FileText, MessageCircle, Search, Settings } from "lucide-react";

export default function HelpPage() {
  const helpCategories = [
    {
      title: "Getting Started",
      icon: Book,
      items: [
        { title: "Install the Chrome Extension", href: "/installation" },
        { title: "Creating Your First Campaign", href: "/campaigns/new" },
        { title: "Connecting Your Gmail Account", href: "/settings" },
        { title: "Setting Up Calendar Sync", href: "/settings" },
        { title: "Understanding the Dashboard", href: "/dashboard" },
      ],
    },
    {
      title: "Email Features",
      icon: MessageCircle,
      items: [
        { title: "Creating Email Campaigns", href: "#" },
        { title: "Using Email Templates", href: "#" },
        { title: "Scheduling Emails", href: "#" },
        { title: "Email Threading and Organization", href: "#" },
        { title: "Advanced Search", href: "#" },
      ],
    },
    {
      title: "Meeting Management",
      icon: Settings,
      items: [
        { title: "Creating Meeting Types", href: "#" },
        { title: "Setting Up Booking Links", href: "#" },
        { title: "Managing Calendar Events", href: "#" },
        { title: "Automated Reminders", href: "#" },
      ],
    },
    {
      title: "Team Collaboration",
      icon: MessageCircle,
      items: [
        { title: "Creating Teams", href: "#" },
        { title: "Shared Inboxes", href: "#" },
        { title: "Email Assignments", href: "#" },
        { title: "Role Management", href: "#" },
      ],
    },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Help Center
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Find answers to common questions and learn how to use TaskForce
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for help articles..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Link
            href="/installation"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
          >
            <Book className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Installation Guide
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Step-by-step guide to install the TaskForce Chrome extension.
            </p>
          </Link>
          <Link
            href="/help/getting-started"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
          >
            <Book className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Getting Started Guide
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              New to TaskForce? Start here to learn the basics.
            </p>
          </Link>

          <Link
            href="/help/video-tutorials"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
          >
            <Video className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Video Tutorials
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Watch step-by-step video guides for all features.
            </p>
          </Link>

          <Link
            href="/contact"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
          >
            <MessageCircle className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Contact Support
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Can't find what you're looking for? Get in touch.
            </p>
          </Link>
        </div>

        {/* Help Categories */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {helpCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.title}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {category.title}
                  </h2>
                </div>
                <ul className="space-y-2">
                  {category.items.map((item) => (
                    <li key={item.title}>
                      <Link
                        href={item.href}
                        className="text-primary-600 hover:text-primary-700 hover:underline text-sm"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How do I connect my Gmail account?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Click on "Settings" in the sidebar, then select "Connect Gmail". You'll be redirected to
                Google to authorize TaskForce to access your Gmail account. We only request the minimum
                permissions needed to provide our services.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Is my data secure?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Yes! We use military-grade encryption (AES-256-GCM) for all sensitive data. We follow a
                "minimal data storage" principle - we only store IDs and metadata, not your email content.
                All data is encrypted at rest and in transit.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Can I schedule emails in advance?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Absolutely! When composing an email, click the "Schedule" button to choose a date and time
                for sending. Scheduled emails are stored securely and sent automatically at the specified time.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How do meeting booking links work?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Create a meeting type with your availability preferences, then generate a booking link.
                Share this link with others, and they can book time slots directly. The meeting is
                automatically added to your calendar with a Google Meet link.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Can I use TaskForce with a team?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Yes! TaskForce supports team collaboration with shared inboxes, email assignments, and
                role-based access control. Create a team and invite members to get started.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Additional Resources
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/privacy"
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors text-gray-700 dark:text-gray-300"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors text-gray-700 dark:text-gray-300"
            >
              Terms of Service
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors text-gray-700 dark:text-gray-300"
            >
              About Us
            </Link>
            <Link
              href="/contact"
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors text-gray-700 dark:text-gray-300"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

