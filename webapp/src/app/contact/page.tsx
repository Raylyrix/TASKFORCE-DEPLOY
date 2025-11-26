"use client";

import Layout from "@/components/Layout";
import { Mail, MessageSquare, HelpCircle, Bug, Lightbulb } from "lucide-react";

export default function ContactPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            We're here to help! Get in touch with our team.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">General Inquiries</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              For general questions, partnerships, or business inquiries:
            </p>
            <a
              href="mailto:hello@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              hello@taskforce.com
            </a>
          </div>

          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Support</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Need help with your account or have technical questions?
            </p>
            <a
              href="mailto:support@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              support@taskforce.com
            </a>
          </div>

          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Bug className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Report a Bug</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Found a bug or experiencing an issue? Let us know:
            </p>
            <a
              href="mailto:bugs@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              bugs@taskforce.com
            </a>
          </div>

          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Feature Requests</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Have an idea for a new feature? We'd love to hear it:
            </p>
            <a
              href="mailto:features@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              features@taskforce.com
            </a>
          </div>
        </div>

        {/* Privacy & Legal */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Privacy & Legal</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              For privacy concerns or legal inquiries:
            </p>
            <a
              href="mailto:privacy@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              privacy@taskforce.com
            </a>
          </div>

          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Press & Media</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              For media inquiries and press releases:
            </p>
            <a
              href="mailto:press@taskforce.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              press@taskforce.com
            </a>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-primary-50 dark:bg-primary-900/20 p-6 rounded-lg mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Response Times
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li><strong>Support:</strong> Within 24 hours (Monday-Friday)</li>
            <li><strong>Bug Reports:</strong> Within 48 hours</li>
            <li><strong>General Inquiries:</strong> Within 2-3 business days</li>
            <li><strong>Feature Requests:</strong> Reviewed monthly</li>
          </ul>
        </div>

        {/* Office Address */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Office Address
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            TaskForce Inc.<br />
            [Your Street Address]<br />
            [City, State ZIP Code]<br />
            [Country]
          </p>
        </div>
      </div>
    </Layout>
  );
}

