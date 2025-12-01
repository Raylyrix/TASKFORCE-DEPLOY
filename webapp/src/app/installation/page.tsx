"use client";

import Layout from "@/components/Layout";
import { Download, Chrome, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function InstallationPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Installation Guide
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Install the TaskForce Chrome Extension to supercharge your Gmail experience
          </p>
        </div>

        {/* Download Section */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Download className="w-10 h-10" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Download TaskForce Extension</h2>
              <p className="text-blue-100">
                Get the latest version of our Chrome extension
              </p>
            </div>
          </div>
          <a
            href="/taskforce-extension-v1.0.0.zip"
            download="taskforce-extension-v1.0.0.zip"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow-md hover:bg-blue-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Extension v1.0.0 (ZIP)
          </a>
          <p className="text-sm text-blue-100 mt-2">
            Version 1.0.0 - Latest stable release
          </p>
        </div>

        {/* Installation Steps */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Installation Steps
          </h2>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Download the Extension
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Click the download button above to get the <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">taskforce-extension-v1.0.0.zip</code> file.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Make sure to download the ZIP file to a location you can easily find, such as your Downloads folder.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Extract the ZIP File
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Right-click on the downloaded ZIP file and select "Extract All" (Windows) or double-click to extract (Mac). Extract it to a folder you can easily access.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Windows:</strong> Right-click → Extract All → Choose destination<br />
                      <strong>Mac:</strong> Double-click the ZIP file → It will extract automatically<br />
                      <strong>Linux:</strong> Right-click → Extract Here or use <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">unzip taskforce-extension.zip</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Open Chrome Extensions Page
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Open Google Chrome and navigate to the Extensions management page. You can do this in several ways:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                    <li>Type <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">chrome://extensions/</code> in the address bar</li>
                    <li>Click the three-dot menu (⋮) → More tools → Extensions</li>
                    <li>Right-click the Extensions icon in the toolbar → Manage extensions</li>
                  </ul>
                  <a
                    href="chrome://extensions/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Open Extensions Page
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">4</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Enable Developer Mode
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    In the top-right corner of the Extensions page, toggle the "Developer mode" switch to ON.
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Developer mode is required to install extensions that aren't from the Chrome Web Store.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">5</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Load the Extension
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Click the "Load unpacked" button that appears after enabling Developer mode. Navigate to the extracted extension folder and select it.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Important:</strong> Select the folder that contains the <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">manifest.json</code> file. This should be the extracted folder (usually named <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">dist</code> or <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">taskforce-extension</code>).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">6</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Verify Installation
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    After loading, you should see the TaskForce extension appear in your extensions list. Open Gmail in a new tab to start using the extension.
                  </p>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>Success!</strong> The extension is now installed. You should see the TaskForce icon in your Chrome toolbar and be able to access it from Gmail.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            System Requirements
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Chrome className="w-6 h-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Browser</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                Google Chrome version 88 or later, or any Chromium-based browser (Edge, Brave, Opera, etc.)
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                A Google account with Gmail access. You'll need to authorize TaskForce to access your Gmail and Calendar.
              </p>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Troubleshooting
          </h2>
          <div className="space-y-4">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Extension not appearing in Gmail?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Make sure you're using the Gmail website (mail.google.com), not the mobile app. The extension only works on the web version of Gmail.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                "Load unpacked" button not visible?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Ensure Developer mode is enabled. The toggle should be in the top-right corner of the Extensions page.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Extension shows errors after installation?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Try reloading the extension by clicking the refresh icon on the Extensions page. If issues persist, make sure you extracted all files from the ZIP correctly.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Need more help?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Check out our <Link href="/help" className="text-primary-600 dark:text-primary-400 hover:underline">Help Center</Link> or <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">contact support</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="bg-primary-50 dark:bg-primary-900/20 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Next Steps
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Now that you've installed the extension, here's what you can do:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-6">
            <li>Open Gmail and look for the TaskForce icon in the toolbar</li>
            <li>Click the icon to open the extension panel</li>
            <li>Sign in with your Google account to authorize TaskForce</li>
            <li>Start creating email campaigns and managing meetings</li>
          </ul>
          <div className="flex gap-4">
            <Link
              href="/help"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              View Help Center
            </Link>
            <Link
              href="/campaigns/new"
              className="inline-block px-6 py-3 bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border border-primary-600 dark:border-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium"
            >
              Create Your First Campaign
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}

