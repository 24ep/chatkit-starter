import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

// Read app version from package.json
let APP_VERSION = "1.0.0-alpha";
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require("../package.json");
  APP_VERSION = packageJson.version || APP_VERSION;
} catch {
  // Fallback to default if package.json can't be read
}

export const APP_VERSION_NUMBER = APP_VERSION;
// Try to extract version from workflow ID if it contains version pattern
function extractVersionFromWorkflowId(workflowId: string): string | null {
  if (!workflowId) return null;
  // Match patterns like: wf_xxx_v27, wf_xxx-27.0.0, wf_xxx_v1.0.0-alpha, wf_xxx_27
  // Also try to extract any numeric pattern that might represent a version
  const versionMatch = workflowId.match(/[_-]v?(\d+(?:\.\d+)*(?:-[a-z0-9]+)?)/i);
  if (versionMatch) {
    return versionMatch[1];
  }
  // If no explicit version pattern, try to use last segment of workflow ID as version identifier
  // This is a fallback - workflow IDs are typically hashes, so this may not be useful
  return null;
}

// Get agent version: from env, or extract from workflow ID, or use default
const WORKFLOW_ID_TEMP = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";
const VERSION_FROM_WORKFLOW = extractVersionFromWorkflowId(WORKFLOW_ID_TEMP);

export const AGENT_VERSION =
  process.env.NEXT_PUBLIC_AGENT_VERSION?.trim() ||
  (VERSION_FROM_WORKFLOW ? `opi-mm-wf-${VERSION_FROM_WORKFLOW}` : null) ||
  "opi-mm-wf-27.0.0";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const INSTRUCTIONS_URL =
  process.env.NEXT_PUBLIC_INSTRUCTIONS_URL?.trim() ?? "";

// Langfuse configuration
export const LANGFUSE_PUBLIC_KEY = process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY?.trim() ?? "";
export const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY?.trim() ?? "";
export const LANGFUSE_HOST = process.env.NEXT_PUBLIC_LANGFUSE_HOST?.trim() ?? "https://cloud.langfuse.com";
export const LANGFUSE_ENABLED = Boolean(LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What event today?",
    prompt: "What event today?",
    icon: "circle-question",
  },
  {
    label: "What are the open and close times of the venue?",
    prompt: "What are the open and close times of the venue?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "Type your question about QSNCC";

export const GREETING = "How can I help you today?";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 220,
      tint: 6,
      shade: theme === "dark" ? -1 : -4,
    },
    accent: {
      primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
      level: 1,
    },
  },
  radius: "round",
  // Add other theme options here
  // chatkit.studio/playground to explore config options
});
