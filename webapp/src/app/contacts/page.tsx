"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Mail, User, ArrowRight } from "lucide-react";

export default function ContactsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["contacts-search", searchQuery],
    queryFn: () => api.customerView.search(searchQuery, 20),
    enabled: searchQuery.length >= 2,
  });

  const handleContactClick = (email: string) => {
    router.push(`/contacts/${encodeURIComponent(email)}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Search and view all your contacts</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Results */}
        {searchQuery.length < 2 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Enter at least 2 characters to search for contacts</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : searchResults && searchResults.contacts && Array.isArray(searchResults.contacts) && searchResults.contacts.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="divide-y divide-gray-200">
              {searchResults.contacts.map((contact) => (
                <button
                  key={contact.email}
                  onClick={() => handleContactClick(contact.email)}
                  className="w-full p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">
                        {contact.name || contact.email}
                      </div>
                      {contact.name && (
                        <div className="text-sm text-gray-500">{contact.email}</div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No contacts found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </Layout>
  );
}


