import { Langfuse } from "langfuse";
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, LANGFUSE_ENABLED, AGENT_VERSION } from "./config";
import { getBrowserMetadata, getEnvironmentMetadata, getRequestMetadata } from "./metadata";

let langfuseClient: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!LANGFUSE_ENABLED) {
    return null;
  }

  if (!langfuseClient) {
    try {
      langfuseClient = new Langfuse({
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_SECRET_KEY,
        baseUrl: LANGFUSE_HOST,
      });
    } catch (error) {
      console.error("[Langfuse] Failed to initialize client:", error);
      return null;
    }
  }

  return langfuseClient;
}

export function createTrace(
  userId: string,
  sessionId: string,
  metadata?: Record<string, unknown>,
  request?: Request
) {
  const client = getLangfuseClient();
  if (!client) return null;

  try {
    // Collect all metadata
    const envMetadata = getEnvironmentMetadata();
    const browserMetadata = typeof window !== "undefined" ? getBrowserMetadata() : {};
    const requestMetadata = request ? getRequestMetadata(request) : {};
    
    // Use agent version from metadata if provided (from ChatKit), otherwise use configured version
    const finalAgentVersion = (metadata?.agentVersion as string) || AGENT_VERSION;
    
    // Ensure app version is always included (from envMetadata, but make it explicit)
    const appVersion = (envMetadata.appVersion as string) || "1.0.0-alpha";
    
    return client.trace({
      userId,
      sessionId,
      metadata: {
        ...metadata,
        ...envMetadata,
        ...browserMetadata,
        ...requestMetadata,
        workflowId: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID,
        agentVersion: finalAgentVersion,
        displayType: "chatkit",
        // Explicitly include app version to ensure it's always present
        appVersion: appVersion,
        applicationVersion: appVersion, // Also include as applicationVersion for clarity
      },
    });
  } catch (error) {
    console.error("[Langfuse] Failed to create trace:", error);
    return null;
  }
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface GenerationOptions {
  model?: string;
  usage?: TokenUsage;
  cost?: number;
  unit?: string; // e.g., "USD"
}

export function createGeneration(
  traceId: string,
  name: string,
  input: unknown,
  output?: unknown,
  metadata?: Record<string, unknown>,
  options?: GenerationOptions
) {
  const client = getLangfuseClient();
  if (!client) return null;

  try {
    // Build generation object with optional token/cost tracking
    // Only include input/output if they have actual values (not null/undefined)
    const generationData: {
      traceId: string;
      name: string;
      input?: unknown;
      output?: unknown;
      metadata: Record<string, unknown>;
      model?: string;
      usage?: TokenUsage;
      cost?: number;
      unit?: string;
    } = {
      traceId,
      name,
      metadata: metadata || {},
    };

    // Only include input if it's not null/undefined
    if (input !== null && input !== undefined) {
      generationData.input = input;
    }

    // Only include output if it's not null/undefined
    if (output !== null && output !== undefined) {
      generationData.output = output;
    }

    // Add model if provided (enables Langfuse automatic cost calculation for supported models)
    if (options?.model) {
      generationData.model = options.model;
    }

    // Add usage data if provided
    if (options?.usage) {
      generationData.usage = options.usage;
    }

    // Add cost if provided
    if (options?.cost !== undefined) {
      generationData.cost = options.cost;
      generationData.unit = options.unit || "USD";
    }
    
    return client.generation(generationData);
  } catch (error) {
    console.error("[Langfuse] Failed to create generation:", error);
    return null;
  }
}

export function createSpan(
  trace: { span: (args: { name: string; input?: unknown; output?: unknown; metadata?: Record<string, unknown> }) => unknown } | null,
  name: string,
  input?: unknown,
  output?: unknown,
  metadata?: Record<string, unknown>
) {
  if (!trace) return null;

  try {
    // Build span object, only including input/output if they have actual values
    const spanData: {
      name: string;
      input?: unknown;
      output?: unknown;
      metadata: Record<string, unknown>;
    } = {
      name,
      metadata: metadata || {},
    };

    // Only include input if it's not null/undefined
    if (input !== null && input !== undefined) {
      spanData.input = input;
    }

    // Only include output if it's not null/undefined
    if (output !== null && output !== undefined) {
      spanData.output = output;
    }

    return trace.span(spanData);
  } catch (error) {
    console.error("[Langfuse] Failed to create span:", error);
    return null;
  }
}

