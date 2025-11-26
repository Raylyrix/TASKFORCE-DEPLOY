"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { LabelPickerModal } from "@/components/LabelPickerModal";
import { LabelManagerModal } from "@/components/LabelManagerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail,
  Search,
  RefreshCw,
  ChevronRight,
  Star,
  Archive,
  Trash2,
  Sparkles,
  Reply,
  ReplyAll,
  Forward,
  Edit,
  Check,
  X,
  Eye,
  EyeOff,
  MoreVertical,
  Filter,
  Tag,
  Plus,
  Settings,
  XCircle,
  FileText,
  Clock,
  Send,
  Save,
  Calendar,
  Zap,
  MessageSquare,
} from "lucide-react";

export default function EmailsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "replyAll" | "forward">("new");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [labelPickerTarget, setLabelPickerTarget] = useState<string | string[] | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "thread">("list");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesError,
    refetch,
  } = useQuery({
    queryKey: ["gmail-messages", pageToken, searchQuery],
    queryFn: () => api.gmail.getMessages({ pageToken, maxResults: 50, query: searchQuery || undefined }),
    retry: 1,
  });

  const actionMutation = useMutation({
    mutationFn: ({ messageId, action, labelIds }: { messageId: string; action: string; labelIds?: string[] }) =>
      api.gmail.action(messageId, action as any, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-message", selectedMessageId] });
      setSelectedMessages(new Set());
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: ({ messageIds, action, labelIds }: { messageIds: string[]; action: string; labelIds?: string[] }) =>
      api.gmail.bulkAction(messageIds, action as any, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
      setSelectedMessages(new Set());
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ messageId, text, html, replyAll }: { messageId: string; text: string; html?: string; replyAll?: boolean }) =>
      api.gmail.reply(messageId, text, html, replyAll),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
      setShowCompose(false);
      alert("Reply sent successfully!");
    },
  });

  const sendMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; text: string; html?: string; cc?: string; bcc?: string }) =>
      api.gmail.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
      setShowCompose(false);
      alert("Email sent successfully!");
    },
  });

  const { data: selectedMessage, isLoading: messageLoading } = useQuery({
    queryKey: ["gmail-message", selectedMessageId],
    queryFn: () => api.gmail.getMessage(selectedMessageId!),
    enabled: !!selectedMessageId,
  });

  const { data: labelsData } = useQuery({
    queryKey: ["gmail-labels"],
    queryFn: () => api.gmail.getLabels(),
  });

  const labels = labelsData?.labels || [];
  const userLabels = labels.filter((l) => l.type === "user");
  const systemLabels = labels.filter((l) => l.type === "system");

  // Threading
  const { data: threadData } = useQuery({
    queryKey: ["gmail-thread", selectedThreadId],
    queryFn: () => api.gmail.getThread(selectedThreadId!),
    enabled: !!selectedThreadId && viewMode === "thread",
  });

  // Drafts
  const { data: draftsData } = useQuery({
    queryKey: ["email-drafts"],
    queryFn: () => api.emailFeatures.getDrafts(),
    enabled: showDrafts || showCompose,
  });

  const saveDraftMutation = useMutation({
    mutationFn: (data: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      body: string;
      html?: string;
      threadId?: string;
      replyToId?: string;
    }) =>
      currentDraftId
        ? api.emailFeatures.updateDraft(currentDraftId, data)
        : api.emailFeatures.createDraft(data),
    onSuccess: (data) => {
      setCurrentDraftId(data.id);
      queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
    },
  });

  // Templates
  const { data: templatesData } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => api.emailFeatures.getTemplates(),
    enabled: showTemplates || showCompose,
  });

  // Scheduled emails
  const { data: scheduledData } = useQuery({
    queryKey: ["scheduled-emails"],
    queryFn: () => api.emailFeatures.getScheduled(),
  });

  // Snoozed emails
  const { data: snoozedData } = useQuery({
    queryKey: ["snoozed-emails"],
    queryFn: () => api.emailFeatures.getSnoozed(),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageToken(undefined);
    refetch();
  };

  const handleLabelAction = (messageIds: string | string[], labelId: string, add: boolean) => {
    const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
    const action = add ? "addLabel" : "removeLabel";
    
    ids.forEach((id) => {
      const currentLabels = id === selectedMessageId 
        ? selectedMessage?.labelIds || []
        : messagesData?.messages.find((m) => m.id === id)?.labelIds || [];
      
      const newLabelIds = add
        ? [...currentLabels, labelId]
        : currentLabels.filter((lid) => lid !== labelId);
      
      actionMutation.mutate({
        messageId: id,
        action: "read", // Dummy action, we'll use labelIds
      }, {
        onSuccess: () => {
          // Apply label via labelIds parameter
          actionMutation.mutate({
            messageId: id,
            action: "read",
          });
        },
      });
    });
    
    // Use bulk action if multiple messages
    if (ids.length > 1) {
      bulkActionMutation.mutate({
        messageIds: ids,
        action: "read",
        labelIds: add ? [labelId] : undefined,
      });
    } else {
      const currentLabels = ids[0] === selectedMessageId
        ? selectedMessage?.labelIds || []
        : messagesData?.messages.find((m) => m.id === ids[0])?.labelIds || [];
      
      const finalLabelIds = add
        ? [...currentLabels, labelId]
        : currentLabels.filter((lid) => lid !== labelId);
      
      actionMutation.mutate({
        messageId: ids[0],
        action: "read",
      });
    }
  };

  const getLabelColor = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId);
    return label?.color || "#e5e7eb";
  };

  const getLabelName = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId);
    return label?.name || labelId;
  };

  // Get messages data - moved after early return to avoid initialization issues

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (messagesData?.messages) {
      setSelectedMessages(new Set(messagesData.messages.map((m) => m.id)));
    }
  };

  const selectNone = () => {
    setSelectedMessages(new Set());
  };

  const handleBulkAction = (action: string) => {
    if (selectedMessages.size === 0) return;
    if (confirm(`Are you sure you want to ${action} ${selectedMessages.size} email(s)?`)) {
      bulkActionMutation.mutate({
        messageIds: Array.from(selectedMessages),
        action,
      });
    }
  };

  const handleAction = (messageId: string, action: string) => {
    actionMutation.mutate({ messageId, action });
  };

  const handleReply = (messageId: string, replyAll = false) => {
    setReplyToMessageId(messageId);
    setComposeMode(replyAll ? "replyAll" : "reply");
    setShowCompose(true);
  };

  const handleCompose = () => {
    setReplyToMessageId(null);
    setComposeMode("new");
    setShowCompose(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "a" && e.ctrlKey) {
        e.preventDefault();
        selectAll();
      } else if (e.key === "Escape") {
        setSelectedMessages(new Set());
        setShowCompose(false);
      } else if (selectedMessageId) {
        if (e.key === "r") {
          e.preventDefault();
          handleReply(selectedMessageId, false);
        } else if (e.key === "R" && e.shiftKey) {
          e.preventDefault();
          handleReply(selectedMessageId, true);
        } else if (e.key === "a" && !e.ctrlKey) {
          e.preventDefault();
          handleAction(selectedMessageId, "archive");
        } else if (e.key === "d") {
          e.preventDefault();
          handleAction(selectedMessageId, "delete");
        } else if (e.key === "s") {
          e.preventDefault();
          const message = messagesData?.messages.find((m) => m.id === selectedMessageId);
          const isStarred = message?.labelIds?.includes("STARRED");
          handleAction(selectedMessageId, isStarred ? "unstar" : "star");
        } else if (e.key === "e") {
          e.preventDefault();
          handleAction(selectedMessageId, "read");
        } else if (e.key === "u") {
          e.preventDefault();
          handleAction(selectedMessageId, "unread");
        }
      }

      if (e.key === "c" && !e.ctrlKey) {
        e.preventDefault();
        handleCompose();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedMessageId, messagesData]);

  if (messagesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  // Get messages data
  const messages = messagesData?.messages || [];

  // Group messages by thread
  const threadsMap = new Map<string, typeof messages>();
  messages.forEach((msg) => {
    const threadId = msg.threadId || msg.id;
    if (!threadsMap.has(threadId)) {
      threadsMap.set(threadId, []);
    }
    threadsMap.get(threadId)!.push(msg);
  });

  // Get thread summary (most recent message)
  const threadSummaries = Array.from(threadsMap.entries()).map(([threadId, threadMessages]) => {
    const sorted = [...threadMessages].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    return {
      threadId,
      messageCount: threadMessages.length,
      latestMessage: sorted[0],
      unreadCount: threadMessages.filter((m) => m.labelIds?.includes("UNREAD")).length,
    };
  });

  const filteredMessages = selectedLabelFilter
    ? messages.filter((m) => m.labelIds?.includes(selectedLabelFilter))
    : messages;

  const filteredThreadSummaries = selectedLabelFilter
    ? threadSummaries.filter((t) => t.latestMessage.labelIds?.includes(selectedLabelFilter))
    : threadSummaries;

  const hasSelection = selectedMessages.size > 0;
  const allSelected = messages.length > 0 && selectedMessages.size === messages.length;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
        {/* Labels Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-l-xl shadow-sm flex flex-col min-w-0">
          {/* Fixed Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Labels
              </h2>
              <button
                onClick={() => setShowLabelManager(true)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title="Manage Labels"
              >
                <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Scrollable Labels Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 pt-2">
              {/* Label Filter */}
              <button
                onClick={() => setSelectedLabelFilter(null)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
                  selectedLabelFilter === null
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                All Mail
              </button>

              {/* System Labels */}
              {systemLabels.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 px-3">System</div>
                  {systemLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => setSelectedLabelFilter(label.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors flex items-center gap-2 ${
                        selectedLabelFilter === label.id
                          ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {label.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                      )}
                      <span className="truncate">{label.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* User Labels */}
              {userLabels.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 px-3">Custom</div>
                  {userLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => setSelectedLabelFilter(label.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors flex items-center gap-2 ${
                        selectedLabelFilter === label.id
                          ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {label.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                      )}
                      <span className="truncate flex-1 min-w-0">{label.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {userLabels.length === 0 && systemLabels.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-4 text-center">
                  No labels found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex flex-col min-w-0">
          {/* Fixed Header with Compose */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <button
              onClick={handleCompose}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Compose
            </button>
            <button
              onClick={() => refetch()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Bulk Actions Toolbar */}
          {hasSelection && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-primary-50 dark:bg-primary-900/20 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedMessages.size} selected
                </span>
                <button
                  onClick={selectNone}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction("archive")}
                  disabled={bulkActionMutation.isPending}
                  className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                  title="Archive"
                >
                  <Archive className="w-4 h-4 text-primary-600" />
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  disabled={bulkActionMutation.isPending}
                  className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-primary-600" />
                </button>
                <button
                  onClick={() => handleBulkAction("read")}
                  disabled={bulkActionMutation.isPending}
                  className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                  title="Mark as read"
                >
                  <Eye className="w-4 h-4 text-primary-600" />
                </button>
                <button
                  onClick={() => handleBulkAction("star")}
                  disabled={bulkActionMutation.isPending}
                  className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                  title="Star"
                >
                  <Star className="w-4 h-4 text-primary-600" />
                </button>
                <button
                  onClick={() => {
                    setLabelPickerTarget(Array.from(selectedMessages));
                    setShowLabelPicker(true);
                  }}
                  disabled={bulkActionMutation.isPending}
                  className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                  title="Add/Remove Labels"
                >
                  <Tag className="w-4 h-4 text-primary-600" />
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search emails... (e.g., from:user@example.com subject:meeting)"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Advanced Search"
              >
                <Filter className="w-5 h-5 text-gray-600" />
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Search
              </button>
            </form>
            
            {/* Advanced Search Helper */}
            {showAdvancedSearch && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium mb-2">Search Operators:</div>
                <div className="space-y-1 text-gray-600">
                  <div><code className="bg-white px-1 rounded">from:email</code> - From sender</div>
                  <div><code className="bg-white px-1 rounded">to:email</code> - To recipient</div>
                  <div><code className="bg-white px-1 rounded">subject:text</code> - In subject</div>
                  <div><code className="bg-white px-1 rounded">has:attachment</code> - Has attachments</div>
                  <div><code className="bg-white px-1 rounded">label:name</code> - Has label</div>
                  <div><code className="bg-white px-1 rounded">is:unread</code> - Unread emails</div>
                  <div><code className="bg-white px-1 rounded">is:starred</code> - Starred emails</div>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle & Quick Actions */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setViewMode("list");
                  setSelectedThreadId(null);
                }}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Mail className="w-4 h-4 inline mr-1" />
                List
              </button>
              <button
                onClick={() => {
                  setViewMode("thread");
                  if (selectedMessageId) {
                    const msg = messages.find((m) => m.id === selectedMessageId);
                    if (msg) setSelectedThreadId(msg.threadId);
                  }
                }}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === "thread"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Threads
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDrafts(!showDrafts)}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors flex items-center justify-center gap-1 ${
                  showDrafts
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <FileText className="w-4 h-4" />
                Drafts ({draftsData?.drafts?.length || 0})
              </button>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors flex items-center justify-center gap-1 ${
                  showTemplates
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Zap className="w-4 h-4" />
                Templates
              </button>
            </div>
          </div>

          {/* Messages or Threads - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {viewMode === "thread" ? (
              // Thread View
              filteredThreadSummaries.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredThreadSummaries.map((thread) => {
                    const msg = thread.latestMessage;
                    const isSelected = selectedMessageId === msg.id;
                    const isUnread = thread.unreadCount > 0;

                    return (
                      <div
                        key={thread.threadId}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          selectedThreadId === thread.threadId ? "bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500" : ""
                        } ${isUnread ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                        onClick={() => {
                          setSelectedThreadId(thread.threadId);
                          setSelectedMessageId(msg.id);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-medium truncate ${isUnread ? "text-gray-900 dark:text-white font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                                {msg.subject || "(No Subject)"}
                              </p>
                              {thread.messageCount > 1 && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {thread.messageCount}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{msg.from || "Unknown"}</p>
                            {msg.snippet && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">{msg.snippet}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">No threads found</div>
              )
            ) : filteredMessages.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Select All */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={allSelected ? selectNone : selectAll}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Select all</span>
                  </label>
                </div>

                {filteredMessages.map((message) => {
                  const isSelected = selectedMessages.has(message.id);
                  const isUnread = message.labelIds?.includes("UNREAD");
                  const isStarred = message.labelIds?.includes("STARRED");

                  return (
                    <div
                      key={message.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        selectedMessageId === message.id ? "bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500" : ""
                      } ${isUnread ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      onClick={(e) => {
                        // Don't select if clicking checkbox or action buttons
                        if ((e.target as HTMLElement).closest("input, button")) return;
                        setSelectedMessageId(message.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleMessageSelection(message.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                            <p className={`font-medium truncate ${isUnread ? "text-gray-900 dark:text-white font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                              {message.subject || "(No Subject)"}
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{message.from || "Unknown"}</p>
                          {message.snippet && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">{message.snippet}</p>
                          )}
                          {/* Labels */}
                          {message.labelIds && message.labelIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {message.labelIds
                                .filter((lid) => lid !== "UNREAD" && lid !== "STARRED" && lid !== "INBOX")
                                .slice(0, 3)
                                .map((labelId) => {
                                  const label = labels.find((l) => l.id === labelId);
                                  if (!label) return null;
                                  return (
                                    <span
                                      key={labelId}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded"
                                      style={{
                                        backgroundColor: label.color ? `${label.color}20` : "#e5e7eb",
                                        color: label.color || "#6b7280",
                                      }}
                                    >
                                      {label.color && (
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: label.color }}
                                        />
                                      )}
                                      {label.name}
                                    </span>
                                  );
                                })}
                              {message.labelIds.filter((lid) => lid !== "UNREAD" && lid !== "STARRED" && lid !== "INBOX").length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{message.labelIds.filter((lid) => lid !== "UNREAD" && lid !== "STARRED" && lid !== "INBOX").length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(message.id, isStarred ? "unstar" : "star");
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title={isStarred ? "Unstar" : "Star"}
                          >
                            <Star
                              className={`w-4 h-4 ${isStarred ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                {messagesError ? (
                  <div className="space-y-2">
                    <p className="text-red-600 font-medium">Error loading emails</p>
                    <p className="text-sm text-gray-500">
                      {messagesError instanceof Error ? messagesError.message : "Please check your Gmail connection"}
                    </p>
                    {messagesError instanceof Error && messagesError.message.includes("User not found") ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-gray-600">You need to log in again.</p>
                        <button
                          onClick={() => {
                            localStorage.removeItem("userId");
                            router.push("/login");
                          }}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Go to Login
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => refetch()}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-gray-500">No emails found</p>
                    <p className="text-xs text-gray-400">Make sure you're connected to Gmail</p>
                    <button
                      onClick={() => refetch()}
                      className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-500">No emails match your filter</p>
                    {selectedLabelFilter && (
                      <button
                        onClick={() => setSelectedLabelFilter(null)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {messagesData?.nextPageToken && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setPageToken(messagesData.nextPageToken);
                    refetch();
                  }}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message View or Thread View */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-r-xl shadow-sm flex flex-col min-w-0 overflow-hidden">
          {viewMode === "thread" && selectedThreadId ? (
            threadData ? (
              <ThreadView
                thread={threadData}
                onAction={handleAction}
                onReply={handleReply}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            )
          ) : selectedMessageId ? (
            messageLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : selectedMessage ? (
              <EmailView
                message={selectedMessage}
                onAction={handleAction}
                onReply={handleReply}
                isUnread={selectedMessage.labelIds?.includes("UNREAD")}
                isStarred={selectedMessage.labelIds?.includes("STARRED")}
                onShowLabelPicker={(messageId) => {
                  setLabelPickerTarget(messageId);
                  setShowLabelPicker(true);
                }}
              />
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Failed to load message</div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Select an email to view
            </div>
          )}
        </div>
      </div>

      {/* Compose/Reply Modal */}
      {showCompose && (
        <ComposeModal
          mode={composeMode}
          messageId={replyToMessageId}
          originalMessage={replyToMessageId ? selectedMessage : null}
          drafts={draftsData?.drafts || []}
          templates={templatesData?.templates || []}
          currentDraftId={currentDraftId}
          onDraftChange={setCurrentDraftId}
          onSaveDraft={saveDraftMutation.mutate}
          autoSaveEnabled={autoSaveEnabled}
          onClose={() => {
            setShowCompose(false);
            setReplyToMessageId(null);
            setCurrentDraftId(null);
          }}
          onSend={(data) => {
            if (replyToMessageId) {
              replyMutation.mutate({
                messageId: replyToMessageId,
                text: data.text,
                html: data.html,
                replyAll: composeMode === "replyAll",
              });
            } else {
              sendMutation.mutate(data);
            }
            setCurrentDraftId(null);
          }}
          onSchedule={(data, scheduledAt) => {
            api.emailFeatures.scheduleEmail({
              to: data.to,
              cc: data.cc,
              bcc: data.bcc,
              subject: data.subject,
              body: data.text,
              html: data.html,
              scheduledAt: scheduledAt.toISOString(),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
              setShowCompose(false);
              setCurrentDraftId(null);
              alert("Email scheduled successfully!");
            });
          }}
          isSending={replyMutation.isPending || sendMutation.isPending}
        />
      )}

      {/* Drafts Sidebar */}
      {showDrafts && (
        <DraftsPanel
          drafts={draftsData?.drafts || []}
          onClose={() => setShowDrafts(false)}
          onSelect={(draft) => {
            setCurrentDraftId(draft.id);
            setShowCompose(true);
            setComposeMode("new");
            setShowDrafts(false);
          }}
          onDelete={(draftId) => {
            api.emailFeatures.deleteDraft(draftId).then(() => {
              queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
            });
          }}
        />
      )}

      {/* Templates Sidebar */}
      {showTemplates && (
        <TemplatesPanel
          templates={templatesData?.templates || []}
          onClose={() => setShowTemplates(false)}
          onSelect={(template) => {
            // Load template into compose
            const fullTemplate = templatesData?.templates.find((t) => t.id === template.id);
            if (fullTemplate) {
              setShowCompose(true);
              setComposeMode("new");
              setShowTemplates(false);
              // Template will be loaded via ComposeModal's template picker
            }
          }}
          onDelete={(templateId) => {
            api.emailFeatures.deleteTemplate(templateId).then(() => {
              queryClient.invalidateQueries({ queryKey: ["email-templates"] });
            });
          }}
        />
      )}

      {/* Label Picker Modal */}
      {showLabelPicker && labelPickerTarget && (
        <LabelPickerModal
          labels={userLabels}
          currentLabelIds={
            Array.isArray(labelPickerTarget)
              ? messagesData?.messages
                  .filter((m) => labelPickerTarget.includes(m.id))
                  .flatMap((m) => m.labelIds || [])
                  .filter((id, index, arr) => arr.indexOf(id) === index) || []
              : messagesData?.messages.find((m) => m.id === labelPickerTarget)?.labelIds || []
          }
          onClose={() => {
            setShowLabelPicker(false);
            setLabelPickerTarget(null);
          }}
          onApply={(labelIds) => {
            if (!labelPickerTarget) return;
            
            const targetIds = Array.isArray(labelPickerTarget) ? labelPickerTarget : [labelPickerTarget];
            
            if (targetIds.length > 1) {
              // Bulk action - add labels
              const currentLabels = messagesData?.messages
                .filter((m) => labelPickerTarget.includes(m.id))
                .flatMap((m) => m.labelIds || [])
                .filter((id, index, arr) => arr.indexOf(id) === index) || [];
              
              const toAdd = labelIds.filter((id) => !currentLabels.includes(id));
              
              if (toAdd.length > 0) {
                bulkActionMutation.mutate({
                  messageIds: targetIds,
                  action: "read",
                  labelIds: toAdd,
                });
              }
            } else {
              // Single message
              const currentLabels = messagesData?.messages.find((m) => m.id === targetIds[0])?.labelIds || [];
              const toAdd = labelIds.filter((id) => !currentLabels.includes(id));
              
              if (toAdd.length > 0) {
                actionMutation.mutate({
                  messageId: targetIds[0],
                  action: "read",
                  labelIds: toAdd,
                });
              }
            }
            
            setShowLabelPicker(false);
            setLabelPickerTarget(null);
          }}
        />
      )}

      {/* Label Manager Modal */}
      {showLabelManager && (
        <LabelManagerModal
          labels={labels}
          onClose={() => setShowLabelManager(false)}
        />
      )}
    </Layout>
  );
}

function EmailView({
  message,
  onAction,
  onReply,
  isUnread,
  isStarred,
  onShowLabelPicker,
}: {
  message: {
    id: string;
    threadId: string;
    snippet: string;
    payload: {
      headers: Record<string, string>;
      body: { text: string; html: string };
      attachments?: Array<{
        filename: string;
        mimeType: string;
        size: number;
        attachmentId: string;
      }>;
    };
    internalDate?: number;
    labelIds: string[];
  };
  onAction: (messageId: string, action: string) => void;
  onReply: (messageId: string, replyAll?: boolean) => void;
  isUnread?: boolean;
  isStarred?: boolean;
  onShowLabelPicker?: (messageId: string) => void;
}) {
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiSummary = async () => {
    setShowAiSummary(true);
    setAiLoading(true);
    try {
      const summary = await api.ai.summarizeEmail(message.payload.body.text || message.snippet);
      setAiSummary(summary);
    } catch (error) {
      setAiSummary("Failed to generate summary");
    } finally {
      setAiLoading(false);
    }
  };

  const from = message.payload.headers.from || "Unknown";
  const to = message.payload.headers.to || "Unknown";
  const subject = message.payload.headers.subject || "(No Subject)";
  const date = message.internalDate
    ? new Date(message.internalDate).toLocaleString()
    : "Unknown Date";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Action Bar */}
      <div className="p-6 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(message.id, false)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Reply (r)"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => onReply(message.id, true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            title="Reply All (Shift+R)"
          >
            <ReplyAll className="w-4 h-4" />
            Reply All
          </button>
          <button
            onClick={() => onAction(message.id, isStarred ? "unstar" : "star")}
            className={`p-1.5 rounded-lg transition-colors ${
              isStarred ? "bg-yellow-50 text-yellow-600" : "hover:bg-gray-100 text-gray-600"
            }`}
            title="Star (s)"
          >
            <Star className={`w-5 h-5 ${isStarred ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={() => onAction(message.id, "archive")}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Archive (a)"
          >
            <Archive className="w-5 h-5" />
          </button>
          <button
            onClick={() => onAction(message.id, "delete")}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Delete (d)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          {isUnread ? (
            <button
              onClick={() => onAction(message.id, "read")}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              title="Mark as read (e)"
            >
              <Eye className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => onAction(message.id, "unread")}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              title="Mark as unread (u)"
            >
              <EyeOff className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowLabelPicker?.(message.id);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Add/Remove Labels"
          >
            <Tag className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const snoozeUntil = new Date();
              snoozeUntil.setHours(snoozeUntil.getHours() + 1); // Default: 1 hour
              api.emailFeatures.snoozeEmail({
                messageId: message.id,
                threadId: message.threadId,
                snoozeUntil: snoozeUntil.toISOString(),
              }).then(() => {
                alert("Email snoozed until " + snoozeUntil.toLocaleString());
              });
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Snooze Email"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiSummary}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="AI Summary"
          >
            <Sparkles className="w-5 h-5 text-primary-600" />
          </button>
        </div>
      </div>

      {/* Fixed Header */}
      <div className="px-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{subject}</h2>
        </div>
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">From:</span> {from}
          </div>
          <div>
            <span className="font-medium">To:</span> {to}
          </div>
          <div>
            <span className="font-medium">Date:</span> {date}
          </div>
        </div>
      </div>

      {/* AI Summary - Fixed */}
      {showAiSummary && (
        <div className="mx-6 mt-4 mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex-shrink-0">
          <h3 className="font-semibold text-primary-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Summary
          </h3>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-primary-700">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              Generating summary...
            </div>
          ) : (
            <p className="text-primary-800 whitespace-pre-wrap">{aiSummary}</p>
          )}
        </div>
      )}

      {/* Attachments - Fixed */}
      {message.payload.attachments && message.payload.attachments.length > 0 && (
        <div className="mx-6 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg flex-shrink-0">
          <h3 className="font-semibold text-gray-900 mb-2">Attachments ({message.payload.attachments.length})</h3>
          <div className="space-y-2">
            {message.payload.attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{attachment.filename}</p>
                    <p className="text-xs text-gray-500">
                      {attachment.mimeType} • {(attachment.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/gmail/messages/${message.id}/attachments/${attachment.attachmentId}?filename=${encodeURIComponent(attachment.filename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors inline-block"
                  onClick={(e) => {
                    // Open in new tab and trigger download
                    e.stopPropagation();
                  }}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="prose max-w-none dark:prose-invert break-words">
          {message.payload.body.html ? (
            <div
              dangerouslySetInnerHTML={{ __html: message.payload.body.html }}
              className="email-body break-words overflow-wrap-anywhere"
              style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{message.payload.body.text || message.snippet}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadView({
  thread,
  onAction,
  onReply,
}: {
  thread: {
    threadId: string;
    messages: Array<{
      id: string;
      threadId: string;
      snippet: string;
      payload: {
        headers: Record<string, string>;
        body: { text: string; html: string };
        attachments?: Array<{
          filename: string;
          mimeType: string;
          size: number;
          attachmentId: string;
        }>;
      };
      internalDate?: number;
      labelIds: string[];
    }>;
  };
  onAction: (messageId: string, action: string) => void;
  onReply: (messageId: string, replyAll?: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {thread.messages[0]?.payload.headers.subject || "(No Subject)"}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""} in conversation
        </p>
      </div>

      {/* Scrollable Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
        {thread.messages.map((message, index) => {
          const from = message.payload.headers.from || "Unknown";
          const to = message.payload.headers.to || "Unknown";
          const date = message.internalDate
            ? new Date(message.internalDate).toLocaleString()
            : "Unknown Date";
          const isUnread = message.labelIds?.includes("UNREAD");
          const isStarred = message.labelIds?.includes("STARRED");

          return (
            <div
              key={message.id}
              className={`p-4 border border-gray-200 rounded-lg ${
                isUnread ? "bg-blue-50 border-blue-200" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{from}</span>
                    {isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <span className="font-medium">To:</span> {to}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span> {date}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReply(message.id, false)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Reply"
                  >
                    <Reply className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => onAction(message.id, isStarred ? "unstar" : "star")}
                    className={`p-1.5 rounded transition-colors ${
                      isStarred ? "text-yellow-500" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    title="Star"
                  >
                    <Star className={`w-4 h-4 ${isStarred ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="prose max-w-none mt-4 break-words">
                {message.payload.body.html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: message.payload.body.html }}
                    className="email-body break-words overflow-wrap-anywhere"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                    {message.payload.body.text || message.snippet}
                  </div>
                )}
              </div>

              {index < thread.messages.length - 1 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-400">--- Next Message ---</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComposeModal({
  mode,
  messageId,
  originalMessage,
  drafts,
  templates,
  currentDraftId,
  onDraftChange,
  onSaveDraft,
  autoSaveEnabled,
  onClose,
  onSend,
  onSchedule,
  isSending,
}: {
  mode: "new" | "reply" | "replyAll" | "forward";
  messageId: string | null;
  originalMessage: any;
  drafts: Array<{ id: string; to: string; cc?: string; bcc?: string; subject: string; body: string; html?: string }>;
  templates: Array<{ id: string; name: string; subject: string; body: string; html?: string }>;
  currentDraftId: string | null;
  onDraftChange: (id: string | null) => void;
  onSaveDraft: (data: any) => void;
  autoSaveEnabled: boolean;
  onClose: () => void;
  onSend: (data: { to: string; subject: string; text: string; html?: string; cc?: string; bcc?: string }) => void;
  onSchedule: (data: { to: string; subject: string; text: string; html?: string; cc?: string; bcc?: string }, scheduledAt: Date) => void;
  isSending: boolean;
}) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Load draft if currentDraftId is set
  useEffect(() => {
    if (currentDraftId && mode === "new") {
      const draft = drafts.find((d) => d.id === currentDraftId);
      if (draft) {
        setTo(draft.to);
        setCc(draft.cc || "");
        setBcc(draft.bcc || "");
        setSubject(draft.subject);
        setBody(draft.body);
      }
    }
  }, [currentDraftId, drafts, mode]);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!autoSaveEnabled || mode !== "new" || !to.trim() || !subject.trim()) return;

    const timeoutId = setTimeout(() => {
      onSaveDraft({
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        html: body.replace(/\n/g, "<br>"),
        threadId: originalMessage?.threadId,
        replyToId: messageId || undefined,
      });
      setLastSaved(new Date());
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [to, cc, bcc, subject, body, autoSaveEnabled, mode, onSaveDraft, originalMessage, messageId]);

  useEffect(() => {
    if (mode === "reply" || mode === "replyAll") {
      if (originalMessage?.payload?.headers) {
        const headers = originalMessage.payload.headers;
        setTo(mode === "replyAll" ? headers.from || "" : headers.from || "");
        setCc(mode === "replyAll" ? headers.cc || "" : "");
        setSubject(headers.subject?.startsWith("Re:") ? headers.subject : `Re: ${headers.subject || ""}`);
        setBody("\n\n--- Original Message ---\n" + (originalMessage.payload.body.text || originalMessage.snippet));
      }
    } else if (mode === "forward") {
      if (originalMessage?.payload?.headers) {
        const headers = originalMessage.payload.headers;
        setSubject(`Fwd: ${headers.subject || ""}`);
        setBody("\n\n--- Forwarded Message ---\n" + (originalMessage.payload.body.text || originalMessage.snippet));
      }
    }
  }, [mode, originalMessage]);

  const handleSend = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      alert("Please fill in all required fields");
      return;
    }
    onSend({
      to: to.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject: subject.trim(),
      text: body.trim(),
      html: body.trim().replace(/\n/g, "<br>"),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "new" ? "Compose" : mode === "reply" ? "Reply" : mode === "replyAll" ? "Reply All" : "Forward"}
            </h2>
            {lastSaved && (
              <span className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === "new" && (
              <>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Templates"
                >
                  <Zap className="w-5 h-5 text-gray-600" />
                </button>
                {showTemplates && templates.length > 0 && (
                  <div className="absolute top-16 left-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto min-w-64">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSubject(template.subject);
                          setBody(template.body);
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-500 truncate">{template.subject}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="recipient@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cc (optional)</label>
            <input
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="cc@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bcc (optional)</label>
            <input
              type="email"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="bcc@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Email subject"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-h-[300px]"
              placeholder="Type your message here..."
              required
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 space-y-3">
          {showSchedule && mode === "new" && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-600" />
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                min={new Date().toISOString().split("T")[0]}
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => setShowSchedule(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === "new" && (
                <>
                  <button
                    onClick={() => setShowSchedule(!showSchedule)}
                    className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Schedule
                  </button>
                  <button
                    onClick={() => {
                      onSaveDraft({
                        to,
                        cc: cc || undefined,
                        bcc: bcc || undefined,
                        subject,
                        body,
                        html: body.replace(/\n/g, "<br>"),
                      });
                      setLastSaved(new Date());
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {showSchedule && scheduledDate && scheduledTime ? (
                <button
                  onClick={() => {
                    if (!to.trim() || !subject.trim() || !body.trim()) {
                      alert("Please fill in all required fields");
                      return;
                    }
                    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
                    onSchedule({
                      to: to.trim(),
                      cc: cc.trim() || undefined,
                      bcc: bcc.trim() || undefined,
                      subject: subject.trim(),
                      text: body.trim(),
                      html: body.trim().replace(/\n/g, "<br>"),
                    }, scheduledAt);
                  }}
                  disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Schedule Send
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftsPanel({
  drafts,
  onClose,
  onSelect,
  onDelete,
}: {
  drafts: Array<{ id: string; to: string; subject: string; updatedAt: string }>;
  onClose: () => void;
  onSelect: (draft: { id: string; to: string; subject: string; updatedAt: string }) => void;
  onDelete: (draftId: string) => void;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Drafts ({drafts.length})
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {drafts.length > 0 ? (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(draft)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{draft.subject || "(No Subject)"}</p>
                    <p className="text-sm text-gray-500 truncate mt-1">{draft.to}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(draft.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this draft?")) {
                        onDelete(draft.id);
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p>No drafts yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesPanel({
  templates,
  onClose,
  onSelect,
  onDelete,
}: {
  templates: Array<{ id: string; name: string; subject: string; category?: string }>;
  onClose: () => void;
  onSelect: (template: { id: string; name: string; subject: string }) => void;
  onDelete: (templateId: string) => void;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Templates ({templates.length})
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    {template.category && (
                      <p className="text-xs text-gray-500 mt-1">{template.category}</p>
                    )}
                    <p className="text-sm text-gray-600 truncate mt-1">{template.subject}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this template?")) {
                        onDelete(template.id);
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p>No templates yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

