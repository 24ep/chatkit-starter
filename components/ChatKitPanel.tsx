"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";
import { createTrace, createSpan, createGeneration } from "@/lib/langfuse";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  const langfuseTraceRef = useRef<ReturnType<typeof createTrace> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const responseStartTimeRef = useRef<number | null>(null);
  const threadChangeCountRef = useRef(0);
  const messageCountRef = useRef<number>(0);
  const currentGenerationRef = useRef<ReturnType<typeof createGeneration> | null>(null);
  const traceIdRef = useRef<string | null>(null);
  const responseMetadataRef = useRef<Array<{
    messageNumber: number;
    startTime: number;
    endTime?: number;
    latency?: number;
    timestamp: string;
  }>>([]);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    // End current Langfuse trace with metadata
    if (langfuseTraceRef.current) {
        // Calculate final response statistics
        const completedResponses = responseMetadataRef.current.filter(r => r.latency !== undefined);
        const totalLatency = completedResponses.reduce((sum, r) => sum + (r.latency || 0), 0);
        const averageLatency = completedResponses.length > 0 ? totalLatency / completedResponses.length : null;
        
        createSpan(
          langfuseTraceRef.current,
          "chat_reset",
          {
            event: "chat_reset",
            action: "user_initiated",
            workflowId: WORKFLOW_ID,
            totalResponses: messageCountRef.current,
          },
          {
            threadChangeCount: threadChangeCountRef.current,
            messageCount: messageCountRef.current,
            completedResponses: completedResponses.length,
            averageResponseLatencyMs: averageLatency,
            resetAt: new Date().toISOString(),
          },
          {
            theme: theme,
            timestamp: new Date().toISOString(),
          }
        );
      // Trace will be automatically finalized by Langfuse
      langfuseTraceRef.current = null;
    }
    currentUserIdRef.current = null;
    responseStartTimeRef.current = null;
    threadChangeCountRef.current = 0;
    messageCountRef.current = 0;
    currentGenerationRef.current = null;
    traceIdRef.current = null;
    responseMetadataRef.current = [];
    
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            chatkit_configuration: {
              // enable attachments
              file_upload: {
                enabled: true,
              },
            },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        // Track session creation in Langfuse
        const sessionId = data?.session_id as string | undefined;
        const userId = data?.user_id as string | undefined;
        if (sessionId && userId) {
          currentUserIdRef.current = userId;
          langfuseTraceRef.current = createTrace(
            userId,
            sessionId,
            {
              workflowId: WORKFLOW_ID,
              action: "session_created",
              sessionCreatedAt: new Date().toISOString(),
              expiresAfter: data?.expires_after as number | undefined,
              success: true,
              theme: theme,
              // Sync with ChatKit trace if available from API response
              chatkitTraceId: data?.chatkit_trace_id as string | undefined,
              chatkitRunId: data?.chatkit_run_id as string | undefined,
              chatkitSessionId: data?.chatkit_session_id as string | undefined,
            }
          );
          // Store trace ID for generation tracking
          // Note: Langfuse trace object may not expose ID directly
          // We'll try to get it, but generations can also be created via trace.generation()
          if (langfuseTraceRef.current) {
            try {
              // Try to get trace ID from the trace object
              const trace = langfuseTraceRef.current as { id?: string; traceId?: string };
              traceIdRef.current = trace.id || trace.traceId || null;
            } catch {
              traceIdRef.current = null;
            }
          }
          // Reset counters for new session
          threadChangeCountRef.current = 0;
          responseStartTimeRef.current = null;
          messageCountRef.current = 0;
          responseMetadataRef.current = [];
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        
        // Track session creation failure in Langfuse (client-side)
        if (currentUserIdRef.current) {
          const trace = createTrace(
            currentUserIdRef.current,
            currentUserIdRef.current,
            {
              workflowId: WORKFLOW_ID,
              action: "session_creation_failed_client",
            }
          );
          if (trace) {
            createSpan(
              trace,
              "session_creation_error",
              {
                workflowId: WORKFLOW_ID,
                endpoint: CREATE_SESSION_ENDPOINT,
                theme: theme,
              },
              {
                error: detail,
                errorType: error instanceof Error ? error.constructor.name : typeof error,
              },
              {
                level: "ERROR",
                timestamp: new Date().toISOString(),
              }
            );
            // Trace will be automatically finalized by Langfuse
          }
        }
        
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        // Enable attachments
        enabled: true,
      },
    },
    threadItemActions: {
      feedback: true,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      // Track tool invocation in Langfuse
      if (langfuseTraceRef.current) {
        createSpan(
          langfuseTraceRef.current,
          `tool_${invocation.name}`,
          {
            tool: invocation.name,
            params: invocation.params,
            workflowId: WORKFLOW_ID,
          },
          { success: true },
          {
            toolName: invocation.name,
            theme: theme,
            timestamp: new Date().toISOString(),
          }
        );
      }

      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: () => {
      // Track response completion in Langfuse with latency
      if (langfuseTraceRef.current) {
        const endTime = Date.now();
        const latency = responseStartTimeRef.current 
          ? endTime - responseStartTimeRef.current 
          : null;
        
        // Update response metadata
        if (responseMetadataRef.current.length > 0) {
          const lastResponse = responseMetadataRef.current[responseMetadataRef.current.length - 1];
          lastResponse.endTime = endTime;
          lastResponse.latency = latency || undefined;
        }
        
        // Calculate response statistics
        const completedResponses = responseMetadataRef.current.filter(r => r.latency !== undefined);
        const totalLatency = completedResponses.reduce((sum, r) => sum + (r.latency || 0), 0);
        const averageLatency = completedResponses.length > 0 ? totalLatency / completedResponses.length : null;
        const minLatency = completedResponses.length > 0 ? Math.min(...completedResponses.map(r => r.latency || 0)) : null;
        const maxLatency = completedResponses.length > 0 ? Math.max(...completedResponses.map(r => r.latency || 0)) : null;
        
        // Complete the generation for assistant response
        if (currentGenerationRef.current) {
          try {
            // Update generation with completion info
            // Note: ChatKit doesn't expose message content or token usage, so we track metadata only
            // If token usage becomes available, you can add it to the end() call:
            // currentGenerationRef.current.end({
            //   ...,
            //   usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            //   cost: 0.002
            // })
            currentGenerationRef.current.end({
              output: {
                status: "completed",
                latencyMs: latency,
                completedAt: new Date().toISOString(),
                messageNumber: messageCountRef.current,
                totalResponses: messageCountRef.current,
              },
              metadata: {
                latency: latency ? `${latency}ms` : undefined,
                latencyMs: latency,
                completedAt: new Date().toISOString(),
                responseNumber: messageCountRef.current,
                averageLatency: averageLatency ? `${Math.round(averageLatency)}ms` : undefined,
                minLatency: minLatency ? `${minLatency}ms` : undefined,
                maxLatency: maxLatency ? `${maxLatency}ms` : undefined,
              },
            });
          } catch (error) {
            console.warn("[Langfuse] Failed to end generation:", error);
          }
          currentGenerationRef.current = null;
        }
        
        createSpan(
          langfuseTraceRef.current,
          "response_completed",
          {
            event: "response_end",
            workflowId: WORKFLOW_ID,
            messageNumber: messageCountRef.current,
            startedAt: responseStartTimeRef.current 
              ? new Date(responseStartTimeRef.current).toISOString() 
              : null,
            totalResponses: messageCountRef.current,
            completedResponses: completedResponses.length,
          },
          { 
            status: "completed",
            latencyMs: latency,
            completedAt: new Date().toISOString(),
            responseStatistics: {
              total: messageCountRef.current,
              completed: completedResponses.length,
              averageLatencyMs: averageLatency,
              minLatencyMs: minLatency,
              maxLatencyMs: maxLatency,
            },
          },
          {
            theme: theme,
            latency: latency ? `${latency}ms` : undefined,
            timestamp: new Date().toISOString(),
            responseNumber: messageCountRef.current,
          }
        );
        
        // Note: Response statistics are included in each span and will be aggregated in trace.end()
        
        responseStartTimeRef.current = null;
      }
      onResponseEnd();
    },
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
      
      // Track response start in Langfuse with timing
      if (langfuseTraceRef.current) {
        const startTime = Date.now();
        responseStartTimeRef.current = startTime;
        messageCountRef.current += 1;
        
        // Store response metadata
        const responseMeta = {
          messageNumber: messageCountRef.current,
          startTime: startTime,
          timestamp: new Date().toISOString(),
        };
        responseMetadataRef.current.push(responseMeta);
        
        // Create a generation to track the assistant's response
        // Note: ChatKit doesn't expose message content, so we track the flow
        if (langfuseTraceRef.current) {
          try {
            // Try to create generation using trace object directly
            const trace = langfuseTraceRef.current as { 
              generation?: (args: { name: string; input?: unknown; output?: unknown; metadata?: Record<string, unknown> }) => { end: (args?: { output?: unknown; metadata?: Record<string, unknown> }) => void }
            };
            if (trace.generation) {
              // Only include output if we have a value - omit it initially
              const generationArgs: {
                name: string;
                input: unknown;
                output?: unknown;
                metadata: Record<string, unknown>;
              } = {
                name: `assistant_response_${messageCountRef.current}`,
                input: {
                  event: "assistant_response_start",
                  messageNumber: messageCountRef.current,
                  workflowId: WORKFLOW_ID,
                  timestamp: new Date().toISOString(),
                  totalResponses: messageCountRef.current,
                  previousResponses: responseMetadataRef.current.length - 1,
                },
                metadata: {
                  model: "chatkit",
                  theme: theme,
                  startedAt: new Date().toISOString(),
                  responseNumber: messageCountRef.current,
                },
              };
              // Don't include output field - will be set when response ends
              currentGenerationRef.current = trace.generation(generationArgs) as ReturnType<typeof createGeneration>;
            } else if (traceIdRef.current) {
              // Fallback to createGeneration if trace.generation is not available
              // Note: ChatKit doesn't expose token usage data, so we can't track tokens/costs
              // If token usage becomes available in the future, pass it via the options parameter:
              // createGeneration(..., {...}, {
              //   model: "gpt-4",
              //   usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
              //   cost: 0.002
              // })
              // Don't pass output parameter - will be set when response ends
              currentGenerationRef.current = createGeneration(
                traceIdRef.current,
                `assistant_response_${messageCountRef.current}`,
                {
                  event: "assistant_response_start",
                  messageNumber: messageCountRef.current,
                  workflowId: WORKFLOW_ID,
                  timestamp: new Date().toISOString(),
                  totalResponses: messageCountRef.current,
                  previousResponses: responseMetadataRef.current.length - 1,
                },
                undefined, // Omit output - will be set when response ends
                {
                  model: "chatkit",
                  theme: theme,
                  startedAt: new Date().toISOString(),
                  responseNumber: messageCountRef.current,
                }
                // Token/cost tracking not available - ChatKit doesn't expose usage data
              );
            }
          } catch (error) {
            console.warn("[Langfuse] Failed to create generation:", error);
          }
        }
        
        createSpan(
          langfuseTraceRef.current,
          "response_started",
          {
            event: "response_start",
            workflowId: WORKFLOW_ID,
            messageNumber: messageCountRef.current,
            totalResponses: messageCountRef.current,
            sessionResponses: responseMetadataRef.current.length,
          },
          { 
            status: "started",
            startedAt: new Date().toISOString(),
            responseIndex: messageCountRef.current,
          },
          {
            theme: theme,
            timestamp: new Date().toISOString(),
            responseNumber: messageCountRef.current,
          }
        );
      }
    },
    onThreadChange: () => {
      processedFacts.current.clear();
      
      // Track thread changes in Langfuse
      if (langfuseTraceRef.current) {
        threadChangeCountRef.current += 1;
        createSpan(
          langfuseTraceRef.current,
          "thread_changed",
          {
            event: "thread_change",
            workflowId: WORKFLOW_ID,
            previousCount: threadChangeCountRef.current - 1,
          },
          { 
            threadChangeCount: threadChangeCountRef.current,
            changedAt: new Date().toISOString(),
          },
          {
            theme: theme,
            timestamp: new Date().toISOString(),
          }
        );
      }
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("ChatKit error", error);
      
      // Track errors in Langfuse
      if (langfuseTraceRef.current) {
        createSpan(
          langfuseTraceRef.current,
          "error",
          {
            event: "error_occurred",
            workflowId: WORKFLOW_ID,
          },
          {
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorStack: error instanceof Error ? error.stack : undefined,
            occurredAt: new Date().toISOString(),
          },
          {
            level: "ERROR",
            timestamp: new Date().toISOString(),
          }
        );
      }
    },
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white transition-colors dark:bg-slate-900">
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "block h-full w-full"
        }
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
