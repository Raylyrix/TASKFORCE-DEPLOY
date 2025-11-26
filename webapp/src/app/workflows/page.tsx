"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Play, Pause, Trash2, Edit, Eye, Workflow, Zap } from "lucide-react";

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => api.workflows.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId: string) => api.workflows.delete(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ workflowId, isActive }: { workflowId: string; isActive: boolean }) =>
      api.workflows.update(workflowId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const handleDelete = async (workflowId: string) => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      await deleteMutation.mutateAsync(workflowId);
    }
  };

  const handleToggleActive = async (workflowId: string, currentActive: boolean) => {
    await toggleActiveMutation.mutateAsync({ workflowId, isActive: !currentActive });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600 mt-1">Automate your email and meeting workflows</p>
          </div>
          <button
            onClick={() => router.push("/workflows/new")}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Workflow
          </button>
        </div>

        {/* Workflows List */}
        {data && data.workflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      workflow.isActive ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      <Workflow className={`w-6 h-6 ${
                        workflow.isActive ? "text-green-600" : "text-gray-400"
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {workflow.trigger.type.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(workflow.id, workflow.isActive)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title={workflow.isActive ? "Pause workflow" : "Activate workflow"}
                    >
                      {workflow.isActive ? (
                        <Pause className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Play className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={() => router.push(`/workflows/${workflow.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit workflow"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(workflow.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>

                {workflow.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{workflow.description}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {workflow.runCount} runs
                    </span>
                    {workflow.lastRunAt && (
                      <span>
                        Last run: {new Date(workflow.lastRunAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    workflow.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {workflow.isActive ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Workflow className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
            <p className="text-gray-600 mb-6">Create your first workflow to automate email and meeting tasks</p>
            <button
              onClick={() => router.push("/workflows/new")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Workflow
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}


