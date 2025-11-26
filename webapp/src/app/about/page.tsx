"use client";

import Layout from "@/components/Layout";
import { Mail, Calendar, Zap, Shield, Users, Target } from "lucide-react";

export default function AboutPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            About TaskForce
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Empowering teams with intelligent email automation and meeting management
          </p>
        </div>

        {/* Mission */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Our Mission</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            TaskForce is dedicated to revolutionizing how teams manage their email communications and meetings.
            We believe that automation should enhance human productivity, not replace it. Our platform empowers
            professionals to focus on what matters most while we handle the repetitive tasks.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            We're committed to building tools that are secure, efficient, and user-friendly, ensuring that
            your data remains private and your workflows remain seamless.
          </p>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">What We Offer</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Email Automation</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Automate your email campaigns with intelligent scheduling, follow-up sequences, and
                personalized templates. Reach your audience at the right time with the right message.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Meeting Management</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Streamline your meeting scheduling with automated booking links, calendar sync, and
                smart availability management. Never miss a meeting again.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Smart Features</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Leverage AI-powered email summarization, advanced search, email threading, and intelligent
                filtering to manage your inbox efficiently.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Enterprise Security</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Your data is protected with military-grade encryption, comprehensive audit logging, and
                minimal data storage. We take security seriously.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Team Collaboration</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Work together seamlessly with shared inboxes, email assignments, and team management
                features designed for modern teams.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Target className="w-6 h-6 text-primary-600" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics & Insights</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Track your email performance with detailed analytics, open rates, click tracking, and
                campaign insights to optimize your outreach.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Our Values</h2>
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Privacy First</h3>
              <p className="text-gray-700 dark:text-gray-300">
                We believe your data belongs to you. We store minimal data, encrypt everything sensitive,
                and never share your information with third parties.
              </p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">User-Centric Design</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Every feature we build is designed with the user in mind. We prioritize simplicity,
                efficiency, and ease of use.
              </p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Continuous Innovation</h3>
              <p className="text-gray-700 dark:text-gray-300">
                We're constantly improving our platform, adding new features, and staying ahead of the
                curve in email automation and productivity tools.
              </p>
            </div>
          </div>
        </section>

        {/* Technology */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Built for Scale</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            TaskForce is built on modern, scalable technology that can handle thousands of concurrent users
            without breaking a sweat. Our infrastructure is designed for reliability, performance, and security.
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>Horizontal scaling architecture</li>
            <li>Redis-based caching for optimal performance</li>
            <li>Comprehensive database indexing</li>
            <li>Enterprise-grade security measures</li>
            <li>99.9% uptime guarantee</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center p-8 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Join thousands of professionals who trust TaskForce for their email automation and meeting management.
          </p>
          <a
            href="/campaigns/new"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Get Started
          </a>
        </section>
      </div>
    </Layout>
  );
}

