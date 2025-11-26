"use client";

import Layout from "@/components/Layout";

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              TaskForce ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              By using TaskForce, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>Email address and account information</li>
              <li>Display name and profile picture (from OAuth providers)</li>
              <li>Campaign and meeting data you create</li>
              <li>Communication preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2.2 Information We Collect Automatically</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>Usage data and analytics</li>
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2.3 Information from Third Parties</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We integrate with Google services (Gmail, Calendar) through OAuth. We only access the permissions
              you explicitly grant and use them solely to provide our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process and manage your email campaigns and meetings</li>
              <li>Send you service-related communications</li>
              <li>Monitor and analyze usage patterns</li>
              <li>Detect, prevent, and address technical issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Data Storage and Security</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.1 Minimal Data Storage</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We follow a "minimal data storage" principle. We store only:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>User IDs and email addresses (for authentication)</li>
              <li>Gmail message IDs (references only, not content)</li>
              <li>Campaign metadata (IDs, status, counts)</li>
              <li>Meeting metadata (IDs, times, status)</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We do NOT store:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
              <li>Email body/content</li>
              <li>Email HTML</li>
              <li>Campaign template content</li>
              <li>Recipient personal data (beyond email addresses)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.2 Security Measures</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We implement industry-standard security measures:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>AES-256-GCM encryption for sensitive data</li>
              <li>HTTPS/TLS for all data transmission</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication</li>
              <li>Comprehensive audit logging</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We do not sell, trade, or rent your personal information to third parties. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or court orders</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>With service providers who assist in operating our service (under strict confidentiality agreements)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Your Rights</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your personal data</li>
              <li><strong>Withdraw Consent:</strong> Revoke OAuth permissions at any time</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
              To exercise these rights, please contact us at privacy@taskforce.com
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Cookies and Tracking</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Maintain your session and authentication</li>
              <li>Remember your preferences</li>
              <li>Analyze usage patterns</li>
              <li>Improve our services</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
              You can control cookies through your browser settings, but this may affect service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Data Retention</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We retain your personal data only for as long as necessary to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Provide our services</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes</li>
              <li>Enforce our agreements</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
              When you delete your account, we delete all associated data within 30 days, except where
              retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. International Data Transfers</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Your information may be transferred to and processed in countries other than your country of
              residence. We ensure appropriate safeguards are in place to protect your data in accordance
              with this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Children's Privacy</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Our service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children. If you believe we have collected information from a child,
              please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new policy on this page and updating the "Last updated" date. You are advised to
              review this policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> privacy@taskforce.com<br />
                <strong>Address:</strong> [Your Company Address]
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

