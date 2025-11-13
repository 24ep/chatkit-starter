"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { WORKFLOW_ID, INSTRUCTIONS_URL, APP_VERSION_NUMBER, AGENT_VERSION } from "@/lib/config";

export default function App() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
    // Note: Widget actions are tracked in ChatKitPanel's onClientTool callback
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col p-4 relative" style={{ backgroundColor: 'rgba(255, 245, 220, 1)' }}>
      {/* Agent Name and Number Text on Background */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-0">
        <div className="text-left p-6">
          <p className="text-6xl font-bold text-slate-400 dark:text-slate-600 opacity-60 whitespace-nowrap pointer-events-none">
            QSNCC Agent chat
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 opacity-70 mt-2 pointer-events-none">
            version : app {APP_VERSION_NUMBER} | agent {AGENT_VERSION} | display type : chatkit
          </p>
          <div className="mt-4">
            <p className="text-sm text-slate-500 dark:text-slate-500 opacity-70 font-mono pointer-events-none">
              Workflow ID: {WORKFLOW_ID || "Not configured"}
            </p>
            {INSTRUCTIONS_URL && (
              <button
                onClick={() => window.open(INSTRUCTIONS_URL, '_blank')}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all opacity-90 hover:opacity-100 pointer-events-auto flex items-center gap-1.5"
                title="Read me instruction"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Read me instruction
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Text - Testing Notice and Developer Info */}
      <div className="fixed bottom-4 left-4 right-4 z-0 pointer-events-none">
        <div className="text-left p-4">
          <p className="text-xs text-slate-400 dark:text-slate-600 opacity-60">
            Engine test evaluate version
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-600 opacity-60 mt-1">
            This application is currently on testing. By using this application, you agree to our Terms and Policy.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <img 
              src="/docs/ncc_logo_color.png" 
              alt="NCC Logo" 
              className="h-4 w-auto opacity-60"
            />
            <p className="text-xs text-slate-400 dark:text-slate-600 opacity-60">
              Developed by Information and Technology N.C.C. Management & Development Co., Ltd.
            </p>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-600 opacity-60 mt-1">
            Copyright © 2025. All rights reserved.
          </p>
        </div>
      </div>

      {/* Chat Widget - Full Height, Fixed Width, Right Aligned with Card Background */}
      <div className="ml-auto w-full max-w-md h-[calc(100vh-2rem)] relative z-10">
        <div className="h-full rounded-2xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <ChatKitPanel
            theme={scheme}
            onWidgetAction={handleWidgetAction}
            onResponseEnd={handleResponseEnd}
            onThemeRequest={setScheme}
          />
        </div>
      </div>

    </main>
  );
}
