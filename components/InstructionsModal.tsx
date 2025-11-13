"use client";

import { useEffect, useState } from "react";

type InstructionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  instructionsUrl: string;
};

export function InstructionsModal({
  isOpen,
  onClose,
  instructionsUrl,
}: InstructionsModalProps) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && instructionsUrl) {
      setIsLoading(true);
      setError(null);
      setContent("");

      // Use API proxy route to avoid CORS issues
      const proxyUrl = `/api/instructions?url=${encodeURIComponent(instructionsUrl)}`;
      
      if (process.env.NODE_ENV !== "production") {
        console.log("[InstructionsModal] Fetching from:", proxyUrl);
      }
      
      fetch(proxyUrl)
        .then((response) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[InstructionsModal] Response status:", response.status, response.statusText);
          }
          
          if (!response.ok) {
            // Try to parse error message from JSON response
            return response.json().then((data) => {
              const errorMsg = data.error || `Failed to fetch instructions: ${response.statusText}`;
              if (process.env.NODE_ENV !== "production") {
                console.error("[InstructionsModal] Error response:", data);
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
            console.log("[InstructionsModal] Content received, length:", text.length);
            console.log("[InstructionsModal] Content preview (first 500 chars):", text.substring(0, 500));
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
                  console.log("[InstructionsModal] Extracted body content, length:", processedContent.length);
                }
              } else {
                // Fallback: try to extract content between body tags manually
                const bodyMatch = processedContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                if (bodyMatch && bodyMatch[1]) {
                  processedContent = bodyMatch[1].trim();
                  if (process.env.NODE_ENV !== "production") {
                    console.log("[InstructionsModal] Extracted body content (regex), length:", processedContent.length);
                  }
                }
              }
            } catch (parseError) {
              console.warn("[InstructionsModal] Failed to parse HTML, using raw content:", parseError);
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
          console.error("[InstructionsModal] Fetch error:", err);
          setError(err.message || "Failed to load instructions");
          setIsLoading(false);
        });
    } else if (isOpen && !instructionsUrl) {
      setError("Instructions URL is not configured");
      setIsLoading(false);
    }
  }, [isOpen, instructionsUrl]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Instructions
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
              {process.env.NODE_ENV !== "production" && instructionsUrl && (
                <p className="text-slate-500 dark:text-slate-500 mt-4 text-xs font-mono break-all">
                  URL: {instructionsUrl}
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

          {!isLoading && !error && !content && instructionsUrl && (
            <div className="py-12 text-center">
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                No content received.
              </p>
              <p className="text-slate-500 dark:text-slate-500 mt-2 text-sm">
                The instructions URL returned empty content.
              </p>
              {process.env.NODE_ENV !== "production" && (
                <p className="text-slate-400 dark:text-slate-500 mt-4 text-xs font-mono break-all">
                  URL: {instructionsUrl}
                </p>
              )}
            </div>
          )}

          {!isLoading && !error && !content && !instructionsUrl && (
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
    </div>
  );
}

