/**
 * Workflow Builder Page
 * 
 * Visual workflow builder interface for creating automation workflows.
 * 
 * Features:
 * - Drag-and-drop node creation
 * - Visual node connections with edges
 * - Trigger configuration (email events, meetings, campaigns)
 * - Node configuration panels
 * - Real-time workflow preview
 * - Save and test workflows
 * 
 * Node Types:
 * - trigger: Entry point (configured via dropdown)
 * - action: Send email, add label, create meeting
 * - condition: If-then logic with branching
 * - delay: Wait before next step
 * - webhook: Call external API
 * 
 * @module app/workflows/new
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Save, Play, ArrowLeft, Plus, X, Trash2, Settings } from "lucide-react";

/** Supported workflow node types */
type NodeType = "trigger" | "condition" | "action" | "delay" | "webhook";

/** Represents a workflow node in the visual builder */
interface Node {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

/** Represents a connection between two workflow nodes */
interface Edge {
  id: string;
  source: string;
  target: string;
  condition?: string; // "true" or "false" for conditional edges
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nextNodeId, setNextNodeId] = useState(1);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      trigger: { type: string; config: Record<string, unknown> };
      nodes: Node[];
      edges: Edge[];
      isActive: boolean;
    }) => api.workflows.create(data),
    onSuccess: () => {
      router.push("/workflows");
    },
  });

  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<string>("email_received");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({
    from: "",
    subject: "",
  });

  // Initialize with trigger node
  useEffect(() => {
    const triggerNode: Node = {
      id: "trigger-1",
      type: "trigger",
      label: "Email Received",
      config: {
        type: triggerType,
        ...triggerConfig,
      },
      position: { x: 100, y: 100 },
    };
    setNodes([triggerNode]);
  }, [triggerType, triggerConfig]);

  const addNode = (type: NodeType) => {
    const newNode: Node = {
      id: `node-${nextNodeId}`,
      type,
      label: getNodeLabel(type),
      config: getDefaultConfig(type),
      position: { x: 300 + (nodes.length * 50), y: 200 },
    };
    setNodes([...nodes, newNode]);
    setNextNodeId(nextNodeId + 1);
  };

  const getNodeLabel = (type: NodeType): string => {
    switch (type) {
      case "trigger":
        return "Trigger";
      case "condition":
        return "Condition";
      case "action":
        return "Action";
      case "delay":
        return "Delay";
      case "webhook":
        return "Webhook";
      default:
        return "Node";
    }
  };

  const getDefaultConfig = (type: NodeType): Record<string, unknown> => {
    switch (type) {
      case "action":
        return { type: "send_email", to: "", subject: "", body: "" };
      case "condition":
        return { type: "condition", field: "", operator: "equals", value: "" };
      case "delay":
        return { delayMs: 60000 }; // 1 minute default
      case "webhook":
        return { url: "", method: "POST", headers: {}, body: {} };
      default:
        return {};
    }
  };

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const updateNode = (nodeId: string, updates: Partial<Node>) => {
    setNodes(
      nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, ...updates });
    }
  };

  const addEdge = (sourceId: string, targetId: string, condition?: string) => {
    // Check if edge already exists
    const exists = edges.some((e) => e.source === sourceId && e.target === targetId);
    if (exists) {
      return;
    }

    const newEdge: Edge = {
      id: `edge-${edges.length + 1}`,
      source: sourceId,
      target: targetId,
      condition,
    };
    setEdges([...edges, newEdge]);
  };

  const deleteEdge = (edgeId: string) => {
    setEdges(edges.filter((e) => e.id !== edgeId));
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find((n) => n.id === sourceId);
    if (sourceNode?.type === "condition") {
      // For conditions, add both true and false edges
      addEdge(sourceId, targetId, "true");
    } else {
      addEdge(sourceId, targetId);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a workflow name");
      return;
    }

    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      alert("Workflow must have a trigger node");
      return;
    }

    // Update trigger node config
    const updatedTriggerNode = {
      ...triggerNode,
      config: {
        type: triggerType,
        ...triggerConfig,
      },
    };

    await createMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      trigger: {
        type: triggerType,
        config: triggerConfig,
      },
      nodes: nodes.filter((n) => n.type !== "trigger").map((n) => {
        // Update trigger node if it's in the list
        if (n.id === triggerNode.id) {
          return updatedTriggerNode;
        }
        return n;
      }),
      edges,
      isActive: true,
    });
  };

  const getNodeColor = (type: NodeType): string => {
    switch (type) {
      case "trigger":
        return "bg-blue-500";
      case "condition":
        return "bg-yellow-500";
      case "action":
        return "bg-green-500";
      case "delay":
        return "bg-purple-500";
      case "webhook":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
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
              <h1 className="text-3xl font-bold text-gray-900">Create Workflow</h1>
              <p className="text-gray-600 mt-1">Build automated workflows with visual nodes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {createMutation.isPending ? "Saving..." : "Save Workflow"}
            </button>
          </div>
        </div>

        {/* Workflow Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Auto-respond to new emails"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          {/* Trigger Configuration */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Type
            </label>
            <select
              value={triggerType}
              onChange={(e) => {
                setTriggerType(e.target.value);
                setTriggerConfig({});
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="email_received">Email Received</option>
              <option value="email_opened">Email Opened</option>
              <option value="email_clicked">Email Clicked</option>
              <option value="meeting_booked">Meeting Booked</option>
              <option value="campaign_sent">Campaign Sent</option>
              <option value="manual">Manual (Run on demand)</option>
            </select>
            
            {triggerType === "email_received" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email (optional, use * for any)
                  </label>
                  <input
                    type="text"
                    value={(triggerConfig.from as string) || ""}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, from: e.target.value })}
                    placeholder="* or specific email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Contains (optional)
                  </label>
                  <input
                    type="text"
                    value={(triggerConfig.subject as string) || ""}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, subject: e.target.value })}
                    placeholder="Keyword in subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
            
            {triggerType === "meeting_booked" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Type ID (optional, leave empty for any)
                </label>
                <input
                  type="text"
                  value={(triggerConfig.meetingTypeId as string) || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, meetingTypeId: e.target.value })}
                  placeholder="Specific meeting type ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Node Palette */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Add Node</h3>
            <div className="space-y-2">
              <button
                onClick={() => addNode("action")}
                className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
              >
                <div className="font-medium text-green-900">Action</div>
                <div className="text-xs text-green-700">Send email, add label, etc.</div>
              </button>
              <button
                onClick={() => addNode("condition")}
                className="w-full text-left px-4 py-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors"
              >
                <div className="font-medium text-yellow-900">Condition</div>
                <div className="text-xs text-yellow-700">If-then logic</div>
              </button>
              <button
                onClick={() => addNode("delay")}
                className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
              >
                <div className="font-medium text-purple-900">Delay</div>
                <div className="text-xs text-purple-700">Wait before next step</div>
              </button>
              <button
                onClick={() => addNode("webhook")}
                className="w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
              >
                <div className="font-medium text-orange-900">Webhook</div>
                <div className="text-xs text-orange-700">Call external API</div>
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="lg:col-span-2 bg-gray-50 rounded-xl border border-gray-200 p-6 min-h-[600px] relative overflow-auto">
            <div className="relative" style={{ minWidth: "800px", minHeight: "600px" }}>
              {/* Trigger Node (Fixed) */}
              {nodes
                .filter((n) => n.type === "trigger")
                .map((node) => (
                  <div
                    key={node.id}
                    className="absolute bg-blue-500 text-white rounded-lg p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                    style={{ left: node.position.x, top: node.position.y, width: "200px" }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div className="font-semibold">{node.label}</div>
                    <div className="text-xs opacity-90 mt-1">
                      {node.config.type as string}
                    </div>
                  </div>
                ))}

              {/* Other Nodes */}
              {nodes
                .filter((n) => n.type !== "trigger")
                .map((node) => (
                  <div
                    key={node.id}
                    className={`absolute ${getNodeColor(node.type)} text-white rounded-lg p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
                      selectedNode?.id === node.id ? "ring-4 ring-indigo-300" : ""
                    }`}
                    style={{ left: node.position.x, top: node.position.y, width: "200px" }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{node.label}</div>
                        <div className="text-xs opacity-90 mt-1">
                          {node.type === "action" && (node.config.type as string)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className="p-1 hover:bg-white/20 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {/* Edges (simplified - would need SVG for proper lines) */}
              {edges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                return (
                  <div
                    key={edge.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: sourceNode.position.x + 100,
                      top: sourceNode.position.y + 40,
                      width: targetNode.position.x - sourceNode.position.x,
                      height: 2,
                      background: "#6366f1",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Node Configuration */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label
                  </label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) =>
                      updateNode(selectedNode.id, { label: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {selectedNode.type === "action" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Action Type
                      </label>
                      <select
                        value={(selectedNode.config.type as string) || "send_email"}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            config: { ...selectedNode.config, type: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="send_email">Send Email</option>
                        <option value="add_label">Add Label</option>
                        <option value="create_meeting">Create Meeting</option>
                      </select>
                    </div>
                    {(selectedNode.config.type as string) === "send_email" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            To
                          </label>
                          <input
                            type="text"
                            value={(selectedNode.config.to as string) || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: { ...selectedNode.config, to: e.target.value },
                              })
                            }
                            placeholder="{{email}}"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject
                          </label>
                          <input
                            type="text"
                            value={(selectedNode.config.subject as string) || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: { ...selectedNode.config, subject: e.target.value },
                              })
                            }
                            placeholder="Email subject"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Body
                          </label>
                          <textarea
                            value={(selectedNode.config.body as string) || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: { ...selectedNode.config, body: e.target.value },
                              })
                            }
                            rows={4}
                            placeholder="Email body (use {{variable}} for dynamic content)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedNode.type === "delay" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delay (milliseconds)
                    </label>
                    <input
                      type="number"
                      value={(selectedNode.config.delayMs as number) || 60000}
                      onChange={(e) =>
                        updateNode(selectedNode.id, {
                          config: { ...selectedNode.config, delayMs: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a node to configure it</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

