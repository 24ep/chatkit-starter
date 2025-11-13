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
export const AGENT_VERSION = "27.0.0";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const INSTRUCTIONS_URL =
  process.env.NEXT_PUBLIC_INSTRUCTIONS_URL?.trim() ?? "";

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
