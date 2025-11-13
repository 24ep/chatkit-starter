"use client";

import { useEffect, useState } from "react";
import { INSTRUCTIONS_URL } from "@/lib/config";

export default function InstructionsPage() {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (INSTRUCTIONS_URL) {
      setIsLoading(true);
      setError(null);
      setContent("");

      // Use API proxy route to avoid CORS issues
      const proxyUrl = `/api/instructions?url=${encodeURIComponent(INSTRUCTIONS_URL)}`;
      
      if (process.env.NODE_ENV !== "production") {
        console.log("[InstructionsPage] Fetching from:", proxyUrl);
      }
      
      fetch(proxyUrl)
        .then((response) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[InstructionsPage] Response status:", response.status, response.statusText);
          }
          
          if (!response.ok) {
            // Try to parse error message from JSON response
            return response.json().then((data) => {
              const errorMsg = data.error || `Failed to fetch instructions: ${response.statusText}`;
              if (process.env.NODE_ENV !== "production") {
                console.error("[InstructionsPage] Error response:", data);
              }
              throw new Error(errorMsg);
            }).catch(() => {
              throw new Error(`Failed to fetch instructions: ${response.statusText}`);
            });
          }
          return response.text();
        })
        .then((text) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[InstructionsPage] Content received, length:", text.length);
            console.log("[InstructionsPage] Content preview (first 500 chars):", text.substring(0, 500));
          }
          // Trim whitespace and check if content is actually present
          let processedContent = text.trim();
          if (processedContent.length === 0) {
            throw new Error("Received empty content from server");
          }
          
          // If content is a full HTML document, extract the body content
          if (processedContent.includes('<!DOCTYPE html>') || processedContent.includes('<html')) {
            try {
              // Create a temporary DOM parser to extract body content
              const parser = new DOMParser();
              const doc = parser.parseFromString(processedContent, 'text/html');
              const bodyContent = doc.body?.innerHTML || doc.documentElement.innerHTML;
              
              if (bodyContent && bodyContent.trim().length > 0) {
                processedContent = bodyContent;
                if (process.env.NODE_ENV !== "production") {
                  console.log("[InstructionsPage] Extracted body content, length:", processedContent.length);
                }
              } else {
                // Fallback: try to extract content between body tags manually
                const bodyMatch = processedContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                if (bodyMatch && bodyMatch[1]) {
                  processedContent = bodyMatch[1].trim();
                  if (process.env.NODE_ENV !== "production") {
                    console.log("[InstructionsPage] Extracted body content (regex), length:", processedContent.length);
                  }
                }
              }
            } catch (parseError) {
              console.warn("[InstructionsPage] Failed to parse HTML, using raw content:", parseError);
              // If parsing fails, try to extract body content with regex
              const bodyMatch = processedContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
              if (bodyMatch && bodyMatch[1]) {
                processedContent = bodyMatch[1].trim();
              }
            }
          }
          
          setContent(processedContent);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("[InstructionsPage] Fetch error:", err);
          setError(err.message || "Failed to load instructions");
          setIsLoading(false);
        });
    } else {
      setError("Instructions URL is not configured");
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Instructions
          </h1>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100"></div>
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400 text-lg font-semibold">{error}</p>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Please check the instructions URL configuration.
            </p>
            {process.env.NODE_ENV !== "production" && INSTRUCTIONS_URL && (
              <p className="text-slate-500 dark:text-slate-500 mt-4 text-xs font-mono break-all">
                URL: {INSTRUCTIONS_URL}
              </p>
            )}
          </div>
        )}

        {!isLoading && !error && content && (
          <div 
            className="instructions-content text-slate-700 dark:text-slate-200"
            style={{
              fontSize: '1rem',
              lineHeight: '1.75',
            }}
          >
            <div
              className="prose prose-slate dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}

        {!isLoading && !error && !content && INSTRUCTIONS_URL && (
          <div className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              No content received.
            </p>
            <p className="text-slate-500 dark:text-slate-500 mt-2 text-sm">
              The instructions URL returned empty content.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <p className="text-slate-400 dark:text-slate-500 mt-4 text-xs font-mono break-all">
                URL: {INSTRUCTIONS_URL}
              </p>
            )}
          </div>
        )}

        {!isLoading && !error && !content && !INSTRUCTIONS_URL && (
          <div className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Instructions URL is not configured.
            </p>
            <p className="text-slate-500 dark:text-slate-500 mt-2 text-sm">
              Please set NEXT_PUBLIC_INSTRUCTIONS_URL in your environment variables.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

