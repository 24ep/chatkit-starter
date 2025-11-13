import { WORKFLOW_ID } from "@/lib/config";
import { createTrace, getLangfuseClient } from "@/lib/langfuse";

export const runtime = "edge";

interface CreateSessionRequestBody {
  workflow?: { id?: string | null } | null;
  scope?: { user_id?: string | null } | null;
  workflowId?: string | null;
  chatkit_configuration?: {
    file_upload?: {
      enabled?: boolean;
    };
  };
}

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }
  let sessionCookie: string | null = null;
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY environment variable",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const parsedBody = await safeParseJson<CreateSessionRequestBody>(request);
    const { userId, sessionCookie: resolvedSessionCookie } =
      await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;
    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    if (process.env.NODE_ENV !== "production") {
      console.info("[create-session] handling request", {
        resolvedWorkflowId,
        body: JSON.stringify(parsedBody),
      });
    }

    if (!resolvedWorkflowId) {
      return buildJsonResponse(
        { error: "Missing workflow id" },
        400,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;
    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: resolvedWorkflowId },
        user: userId,
        chatkit_configuration: {
          file_upload: {
            enabled:
              parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
          },
        },
        // Note: ChatKit API doesn't support metadata parameter in session creation
        // We'll sync trace IDs through Langfuse metadata instead
      }),
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[create-session] upstream response", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
    }

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as
      | Record<string, unknown>
      | undefined;

    if (!upstreamResponse.ok) {
      const upstreamError = extractUpstreamError(upstreamJson);
      console.error("OpenAI ChatKit session creation failed", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamJson,
      });
      
      // Track session creation failure in Langfuse
      if (userId) {
        try {
          const trace = createTrace(
            userId,
            userId,
            {
              workflowId: resolvedWorkflowId,
              action: "session_creation_failed",
              errorType: "upstream_error",
            },
            request
          );
          if (trace) {
            trace.span({
              name: "session_creation_error",
              input: {
                workflowId: resolvedWorkflowId,
                requestBody: parsedBody,
              },
              output: {
                error: upstreamError ?? upstreamResponse.statusText,
                status: upstreamResponse.status,
                details: upstreamJson,
              },
              metadata: {
                level: "ERROR",
                statusCode: upstreamResponse.status,
              },
            });
            trace.end();
          }
        } catch (langfuseError) {
          // Don't fail the request if Langfuse tracking fails
          console.error("[create-session] Langfuse error tracking failed:", langfuseError);
        }
      }
      
      return buildJsonResponse(
        {
          error:
            upstreamError ??
            `Failed to create session: ${upstreamResponse.statusText}`,
          details: upstreamJson,
        },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const clientSecret = upstreamJson?.client_secret ?? null;
    const expiresAfter = upstreamJson?.expires_after ?? null;
    
    // Log full response in development to see what ChatKit actually returns
    if (process.env.NODE_ENV !== "production") {
      console.log("[create-session] ChatKit API response keys:", Object.keys(upstreamJson || {}));
      console.log("[create-session] ChatKit API response:", JSON.stringify(upstreamJson, null, 2));
    }
    
    // Extract ChatKit trace/run IDs from response if available
    // Note: ChatKit API may not return these in session creation response
    // They might only be available during actual conversations or through the ChatKit SDK
    const chatkitTraceId = upstreamJson?.trace_id as string | undefined;
    const chatkitRunId = upstreamJson?.run_id as string | undefined;
    const chatkitSessionId = upstreamJson?.session_id as string | undefined;
    
    // Extract agent/workflow version from ChatKit response if available
    // ChatKit might return version info in workflow, agent, or version fields
    let chatkitAgentVersion = 
      upstreamJson?.agent_version as string | undefined ||
      upstreamJson?.workflow_version as string | undefined ||
      upstreamJson?.version as string | undefined ||
      (upstreamJson?.workflow as { version?: string })?.version ||
      (upstreamJson?.agent as { version?: string })?.version ||
      null;
    
    // If no version in response, try to extract from workflow ID pattern
    // Some workflows might have version info embedded in the ID or metadata
    if (!chatkitAgentVersion && resolvedWorkflowId) {
      // Check if workflow ID contains version pattern (e.g., wf_xxx_v27)
      const versionMatch = resolvedWorkflowId.match(/[_-]v?(\d+(?:\.\d+)*(?:-[a-z0-9]+)?)/i);
      if (versionMatch) {
        chatkitAgentVersion = versionMatch[1];
      }
      
      // Also check workflow metadata if available
      const workflowMeta = upstreamJson?.workflow as Record<string, unknown> | undefined;
      if (workflowMeta) {
        chatkitAgentVersion = chatkitAgentVersion || 
          (workflowMeta.version as string) ||
          (workflowMeta.agent_version as string) ||
          (workflowMeta.revision as string) ||
          null;
      }
    }
    
    // Alternative: Use client_secret as a session identifier if available
    // The client_secret is unique per session and can be used for correlation
    const chatkitClientSecret = clientSecret ? `secret_${clientSecret.substring(0, 8)}...` : null;
    
    // Track session creation in Langfuse (server-side) with ChatKit trace sync
    if (userId) {
      try {
        const trace = createTrace(
          userId,
          userId, // Use userId as sessionId if no session ID is available
          {
            workflowId: resolvedWorkflowId,
            action: "session_created",
            expiresAfter,
            success: true,
            fileUploadEnabled: parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
            chatkitConfiguration: {
              fileUpload: {
                enabled: parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
              },
            },
            // Sync ChatKit trace information (only include if available)
            // Note: ChatKit API doesn't return trace/run IDs in session creation response
            // These are only available during conversations or through ChatKit SDK
            ...(chatkitTraceId ? { chatkitTraceId } : {}),
            ...(chatkitRunId ? { chatkitRunId } : {}),
            ...(chatkitSessionId ? { chatkitSessionId } : {}),
            ...(chatkitClientSecret ? { chatkitClientSecret } : {}),
            ...(chatkitAgentVersion ? { chatkitAgentVersion } : {}),
            ...(upstreamJson?.metadata ? { chatkitMetadata: upstreamJson.metadata as Record<string, unknown> } : {}),
            // Store full response keys for debugging (development only)
            ...(process.env.NODE_ENV !== "production" ? { chatkitResponseKeys: Object.keys(upstreamJson || {}) } : {}),
            // Use ChatKit agent version if available, otherwise use configured version
            agentVersion: chatkitAgentVersion || process.env.NEXT_PUBLIC_AGENT_VERSION || "opi-mm-wf-27.0.0",
            // Note about ChatKit trace IDs
            chatkitTraceNote: !chatkitTraceId && !chatkitRunId && !chatkitSessionId 
              ? "ChatKit trace IDs not available in session creation response. They may be available during conversations."
              : undefined,
          },
          request
        );
        
        if (trace && process.env.NODE_ENV !== "production") {
          console.log("[create-session] Langfuse trace created:", trace.id);
        }
        
        if (process.env.NODE_ENV !== "production") {
          console.log("[create-session] ChatKit trace sync:", {
            chatkitTraceId,
            chatkitRunId,
            chatkitSessionId,
          });
        }
      } catch (langfuseError) {
        // Don't fail the request if Langfuse tracking fails
        console.error("[create-session] Langfuse tracking error:", langfuseError);
      }
    }
    
    const responsePayload = {
      client_secret: clientSecret,
      expires_after: expiresAfter,
      user_id: userId, // Include user_id in response for client-side tracking
      session_id: userId, // Use userId as session_id for now
      // Include ChatKit trace information for client-side sync (if available)
      chatkit_trace_id: chatkitTraceId,
      chatkit_run_id: chatkitRunId,
      chatkit_session_id: chatkitSessionId,
    };

    return buildJsonResponse(
      responsePayload,
      200,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  } catch (error) {
    console.error("Create session error", error);
    
    // Track unexpected errors in Langfuse
    try {
      const { userId } = await resolveUserId(request);
      if (userId) {
        const trace = createTrace(
          userId,
          userId,
          {
            workflowId: WORKFLOW_ID,
            action: "session_creation_exception",
            errorType: "unexpected_exception",
          },
          request
        );
        if (trace) {
          trace.span({
            name: "unexpected_error",
            input: {
              workflowId: WORKFLOW_ID,
            },
            output: {
              error: error instanceof Error ? error.message : String(error),
              errorType: error instanceof Error ? error.constructor.name : typeof error,
            },
            metadata: {
              level: "ERROR",
              exception: true,
            },
          });
          trace.end();
        }
      }
    } catch (langfuseError) {
      // Don't fail the request if Langfuse tracking fails
      console.error("[create-session] Langfuse error tracking failed:", langfuseError);
    }
    
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowedResponse();
}

function methodNotAllowedResponse(): Response {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

function generateUUID(): string {
  // Try crypto.randomUUID first (available in modern browsers and Edge Runtime)
  // Check if it exists, is a function, AND can be called successfully
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try {
      // Verify it's actually callable by attempting to call it
      if (typeof crypto.randomUUID === "function") {
        const uuid = crypto.randomUUID();
        // Verify it returns a valid string
        if (typeof uuid === "string" && uuid.length > 0) {
          return uuid;
        }
      }
    } catch {
      // Fall through to alternative method if it throws
    }
  }

  // Fallback: Use Web Crypto API's getRandomValues (more widely supported)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Format as UUID v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
      ].join("-");
    } catch {
      // Fall through to simple random method
    }
  }

  // Last resort: simple random string (not a proper UUID, but works)
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function resolveUserId(request: Request): Promise<{
  userId: string;
  sessionCookie: string | null;
}> {
  const existing = getCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  );
  if (existing) {
    return { userId: existing, sessionCookie: null };
  }

  const generated = generateUUID();

  return {
    userId: generated,
    sessionCookie: serializeSessionCookie(generated),
  };
}

function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }
    if (rawName.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function serializeSessionCookie(value: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null
): Response {
  const responseHeaders = new Headers(headers);

  if (sessionCookie) {
    responseHeaders.append("Set-Cookie", sessionCookie);
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
}

async function safeParseJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractUpstreamError(
  payload: Record<string, unknown> | undefined
): string | null {
  if (!payload) {
    return null;
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
  return null;
}
