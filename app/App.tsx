"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { WORKFLOW_ID } from "@/lib/config";

export default function App() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col p-4 relative" style={{ backgroundColor: 'rgba(255, 245, 220, 1)' }}>
      {/* Agent Name and Number Text on Background */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-0 pointer-events-none">
        <div className="text-left p-6">
          <p className="text-6xl font-bold text-slate-400 dark:text-slate-600 opacity-60 whitespace-nowrap">
            QSNCC Agent Chatkit
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 opacity-70 mt-2">
            Version 27 (Engine evaluate test)
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 opacity-70 mt-4 font-mono">
            Workflow ID: {WORKFLOW_ID || "Not configured"}
          </p>
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
