"use client";

import Layout from "@/components/Layout";

export default function TermsPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              By accessing and using TaskForce ("the Service"), you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to these Terms of Service, please do not
              use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              TaskForce is an email automation and meeting management platform that integrates with Google
              services (Gmail, Calendar) to provide:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Email campaign management and automation</li>
              <li>Meeting scheduling and calendar management</li>
              <li>Email organization and filtering</li>
              <li>Team collaboration features</li>
              <li>Analytics and reporting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. User Accounts</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">3.1 Account Creation</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              To use the Service, you must create an account using OAuth authentication with Google. You are
              responsible for maintaining the confidentiality of your account credentials.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">3.2 Account Responsibility</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>All activities that occur under your account</li>
              <li>Maintaining the security of your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Ensuring you have the right to use any data you provide</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Acceptable Use</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.1 Permitted Use</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree
              not to use the Service:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>In any way that violates any applicable law or regulation</li>
              <li>To send spam, unsolicited, or bulk emails</li>
              <li>To transmit any malicious code, viruses, or harmful data</li>
              <li>To impersonate or attempt to impersonate another person or entity</li>
              <li>To engage in any automated use of the system that interferes with the Service</li>
              <li>To attempt to gain unauthorized access to any portion of the Service</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.2 Compliance with Email Laws</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You agree to comply with all applicable email laws, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>CAN-SPAM Act (United States)</li>
              <li>GDPR (European Union)</li>
              <li>CASL (Canada)</li>
              <li>Any other applicable anti-spam legislation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">5.1 Our Property</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The Service and its original content, features, and functionality are owned by TaskForce and are
              protected by international copyright, trademark, patent, trade secret, and other intellectual
              property laws.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">5.2 Your Content</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You retain ownership of any content you create or upload to the Service. By using the Service,
              you grant us a limited, non-exclusive license to use, store, and process your content solely
              for the purpose of providing the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Third-Party Services</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The Service integrates with Google services (Gmail, Calendar) through OAuth. Your use of these
              third-party services is subject to their respective terms of service and privacy policies. We
              are not responsible for the practices of these third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Service Availability</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted or error-free service.
              We reserve the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Modify or discontinue the Service at any time</li>
              <li>Perform maintenance that may temporarily interrupt service</li>
              <li>Suspend or terminate accounts that violate these Terms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TASKFORCE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES,
              WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE
              LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Indemnification</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You agree to defend, indemnify, and hold harmless TaskForce and its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and expenses,
              including reasonable attorneys' fees, arising out of or in any way connected with your use of
              the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Termination</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior
              notice, for conduct that we believe violates these Terms or is harmful to other users, us, or
              third parties. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Changes to Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of any material
              changes by posting the new Terms on this page and updating the "Last updated" date. Your
              continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Governing Law</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction],
              without regard to its conflict of law provisions. Any disputes arising from these Terms or the
              Service shall be resolved in the courts of [Your Jurisdiction].
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. Contact Information</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> legal@taskforce.com<br />
                <strong>Address:</strong> [Your Company Address]
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

