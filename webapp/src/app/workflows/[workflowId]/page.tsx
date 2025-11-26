"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ArrowLeft, Play, Pause, Save, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workflowId = params.workflowId as string;
  const [testTriggerData, setTestTriggerData] = useState<Record<string, unknown>>({});

  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => api.workflows.get(workflowId),
  });

  const { data: executions } = useQuery({
    queryKey: ["workflow-executions", workflowId],
    queryFn: () => api.workflows.getExecutions(workflowId),
    enabled: !!workflowId,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) => api.workflows.update(workflowId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (triggerData?: Record<string, unknown>) => api.workflows.execute(workflowId, triggerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      alert("Workflow executed successfully!");
    },
    onError: (error: Error) => {
      alert(`Workflow execution failed: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.workflows.delete(workflowId),
    onSuccess: () => {
      router.push("/workflows");
    },
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!workflow) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workflow Not Found</h1>
          <p className="text-gray-600">The workflow you're looking for doesn't exist.</p>
        </div>
      </Layout>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "RUNNING":
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case "CANCELLED":
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "FAILED":
        return "bg-red-100 text-red-700";
      case "RUNNING":
        return "bg-blue-100 text-blue-700";
      case "CANCELLED":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{workflow.workflow.name}</h1>
              {workflow.workflow.description && (
                <p className="text-gray-600 mt-1">{workflow.workflow.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => executeMutation.mutateAsync(testTriggerData)}
              disabled={executeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {executeMutation.isPending ? "Executing..." : "Test Run"}
            </button>
            <button
              onClick={() => toggleActiveMutation.mutateAsync(!workflow.workflow.isActive)}
              disabled={toggleActiveMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                workflow.workflow.isActive
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {workflow.workflow.isActive ? (
                <>
                  <Pause className="w-5 h-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Activate
                </>
              )}
            </button>
            <button
              onClick={() => router.push(`/workflows/${workflowId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit className="w-5 h-5" />
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this workflow?")) {
                  deleteMutation.mutate();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Status</div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
              workflow.workflow.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}>
              {workflow.workflow.isActive ? "Active" : "Paused"}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Runs</div>
            <div className="text-3xl font-bold text-gray-900">{workflow.workflow.runCount}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Trigger</div>
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {workflow.workflow.trigger.type.replace(/_/g, " ")}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Last Run</div>
            <div className="text-sm text-gray-900">
              {workflow.workflow.lastRunAt
                ? new Date(workflow.workflow.lastRunAt).toLocaleString()
                : "Never"}
            </div>
          </div>
        </div>

        {/* Test Trigger Data */}
        {workflow.workflow.trigger.type === "manual" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Trigger Data</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (for testing)
                </label>
                <input
                  type="email"
                  value={(testTriggerData.email as string) || ""}
                  onChange={(e) => setTestTriggerData({ ...testTriggerData, email: e.target.value })}
                  placeholder="test@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject (for testing)
                </label>
                <input
                  type="text"
                  value={(testTriggerData.subject as string) || ""}
                  onChange={(e) => setTestTriggerData({ ...testTriggerData, subject: e.target.value })}
                  placeholder="Test subject"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Execution History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Execution History</h2>
          {executions && executions.executions.length > 0 ? (
            <div className="space-y-3">
              {executions.executions.map((execution) => (
                <div
                  key={execution.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(execution.status)}
                    <div>
                      <div className="font-medium text-gray-900">
                        Execution {execution.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Started: {new Date(execution.startedAt).toLocaleString()}
                        {execution.completedAt && (
                          <> • Completed: {new Date(execution.completedAt).toLocaleString()}</>
                        )}
                      </div>
                      {execution.error && (
                        <div className="text-sm text-red-600 mt-1">Error: {execution.error}</div>
                      )}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(execution.status)}`}>
                    {execution.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No executions yet. Click "Test Run" to execute this workflow.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


