export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate that the URL is from the allowed domain (optional security check)
    const instructionsUrl = process.env.NEXT_PUBLIC_INSTRUCTIONS_URL?.trim();
    if (instructionsUrl) {
      try {
        const requestedUrl = new URL(url);
        const allowedUrl = new URL(instructionsUrl);
        // Check if the origin (protocol + hostname) matches
        if (requestedUrl.origin !== allowedUrl.origin) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[instructions] Origin mismatch:", {
              requested: requestedUrl.origin,
              allowed: allowedUrl.origin,
            });
          }
          return new Response(
            JSON.stringify({ 
              error: "Invalid URL origin",
              requested: requestedUrl.origin,
              allowed: allowedUrl.origin,
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (urlError) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[instructions] URL parse error:", urlError);
        }
        return new Response(
          JSON.stringify({ error: "Invalid URL format" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[instructions] Fetching from:", url);
    }

    // Fetch the content server-side (no CORS restrictions)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Next.js Instructions Proxy)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.error("[instructions] Fetch failed:", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200),
        });
      }
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch instructions: ${response.statusText}`,
          status: response.status 
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const content = await response.text();
    const contentType = response.headers.get("content-type") || "text/html";
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[instructions] Successfully fetched content, length:", content.length, "type:", contentType);
    }

    // Return the content with appropriate headers
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[instructions] proxy error", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to fetch instructions" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

