/**
 * Collect browser/client metadata for Langfuse tracking
 */
export function getBrowserMetadata(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return {};
  }

  const metadata: Record<string, unknown> = {};

  try {
    // User Agent
    if (window.navigator?.userAgent) {
      metadata.userAgent = window.navigator.userAgent;
    }

    // Browser language
    if (window.navigator?.language) {
      metadata.language = window.navigator.language;
      metadata.languages = window.navigator.languages || [window.navigator.language];
    }

    // Screen information
    if (window.screen) {
      metadata.screen = {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
      };
    }

    // Viewport information
    if (window.innerWidth && window.innerHeight) {
      metadata.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }

    // Platform
    if (window.navigator?.platform) {
      metadata.platform = window.navigator.platform;
    }

    // Online status
    if (typeof window.navigator?.onLine !== "undefined") {
      metadata.online = window.navigator.onLine;
    }

    // Timezone
    try {
      metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      metadata.timezoneOffset = new Date().getTimezoneOffset();
    } catch {
      // Ignore timezone errors
    }

    // Cookie enabled
    if (typeof window.navigator?.cookieEnabled !== "undefined") {
      metadata.cookieEnabled = window.navigator.cookieEnabled;
    }

    // Do not track
    if (typeof window.navigator?.doNotTrack !== "undefined") {
      metadata.doNotTrack = window.navigator.doNotTrack;
    }

    // URL and path information
    if (window.location) {
      metadata.url = {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        host: window.location.host,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
      };
    }

    // Device type detection with more details
    const userAgent = window.navigator?.userAgent?.toLowerCase() || "";
    let deviceType = "desktop";
    let deviceBrand = null;
    let deviceModel = null;
    let os = null;
    let osVersion = null;
    let browser = null;
    let browserVersion = null;
    
    // Mobile detection
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      deviceType = "mobile";
      
      // Detect specific mobile devices
      if (/iphone/i.test(userAgent)) {
        deviceBrand = "Apple";
        deviceModel = "iPhone";
        const match = userAgent.match(/iphone os (\d+[_\d]*)/i);
        if (match) osVersion = match[1].replace(/_/g, ".");
      } else if (/ipod/i.test(userAgent)) {
        deviceBrand = "Apple";
        deviceModel = "iPod";
      } else if (/android/i.test(userAgent)) {
        deviceBrand = "Android";
        const match = userAgent.match(/android (\d+\.?\d*)/i);
        if (match) osVersion = match[1];
        // Try to detect specific Android device
        const deviceMatch = userAgent.match(/; ([^;)]+)\)/i);
        if (deviceMatch) deviceModel = deviceMatch[1].trim();
      } else if (/blackberry/i.test(userAgent)) {
        deviceBrand = "BlackBerry";
      }
    } 
    // Tablet detection
    else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      deviceType = "tablet";
      if (/ipad/i.test(userAgent)) {
        deviceBrand = "Apple";
        deviceModel = "iPad";
        const match = userAgent.match(/os (\d+[_\d]*)/i);
        if (match) osVersion = match[1].replace(/_/g, ".");
      } else if (/android/i.test(userAgent) && !/mobile/i.test(userAgent)) {
        deviceBrand = "Android";
        deviceModel = "Android Tablet";
      }
    }
    
    // OS detection
    if (/windows/i.test(userAgent)) {
      os = "Windows";
      const match = userAgent.match(/windows nt (\d+\.\d+)/i);
      if (match) {
        const version = match[1];
        osVersion = version === "10.0" ? "10/11" : version;
      }
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      os = "macOS";
      const match = userAgent.match(/mac os x (\d+[._]\d+)/i);
      if (match) osVersion = match[1].replace(/_/g, ".");
    } else if (/linux/i.test(userAgent)) {
      os = "Linux";
    } else if (/android/i.test(userAgent)) {
      os = "Android";
      const match = userAgent.match(/android (\d+\.?\d*)/i);
      if (match) osVersion = match[1];
    } else if (/ios|iphone|ipad|ipod/i.test(userAgent)) {
      os = "iOS";
      const match = userAgent.match(/(?:iphone|ipad|ipod).*os (\d+[_\d]*)/i);
      if (match) osVersion = match[1].replace(/_/g, ".");
    }
    
    // Browser detection
    if (/chrome/i.test(userAgent) && !/edg|opr/i.test(userAgent)) {
      browser = "Chrome";
      const match = userAgent.match(/chrome\/(\d+\.\d+)/i);
      if (match) browserVersion = match[1];
    } else if (/firefox/i.test(userAgent)) {
      browser = "Firefox";
      const match = userAgent.match(/firefox\/(\d+\.\d+)/i);
      if (match) browserVersion = match[1];
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = "Safari";
      const match = userAgent.match(/version\/(\d+\.\d+)/i);
      if (match) browserVersion = match[1];
    } else if (/edg/i.test(userAgent)) {
      browser = "Edge";
      const match = userAgent.match(/edg\/(\d+\.\d+)/i);
      if (match) browserVersion = match[1];
    } else if (/opr/i.test(userAgent)) {
      browser = "Opera";
      const match = userAgent.match(/opr\/(\d+\.\d+)/i);
      if (match) browserVersion = match[1];
    }
    
    metadata.device = {
      type: deviceType,
      ...(deviceBrand ? { brand: deviceBrand } : {}),
      ...(deviceModel ? { model: deviceModel } : {}),
      os: os || "Unknown",
      ...(osVersion ? { osVersion } : {}),
      browser: browser || "Unknown",
      ...(browserVersion ? { browserVersion } : {}),
    };
    
    // Keep deviceType for backward compatibility
    metadata.deviceType = deviceType;

    // Connection information (if available)
    const connection = (window.navigator as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } })?.connection;
    if (connection) {
      metadata.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }

    // Hardware concurrency (CPU cores)
    if (window.navigator?.hardwareConcurrency) {
      metadata.hardwareConcurrency = window.navigator.hardwareConcurrency;
      metadata.cpuCores = window.navigator.hardwareConcurrency;
    }
    
    // Device capabilities
    metadata.capabilities = {
      touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      geolocation: "geolocation" in navigator,
      notifications: "Notification" in window,
      serviceWorker: "serviceWorker" in navigator,
      webGL: (() => {
        try {
          const canvas = document.createElement("canvas");
          return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
        } catch {
          return false;
        }
      })(),
      webAssembly: typeof WebAssembly !== "undefined",
    };
    
    // Media capabilities
    if (navigator.mediaDevices) {
      metadata.mediaCapabilities = {
        hasMediaDevices: true,
        getUserMedia: typeof navigator.mediaDevices.getUserMedia !== "undefined",
        enumerateDevices: typeof navigator.mediaDevices.enumerateDevices !== "undefined",
      };
    }
    
    // Battery API (if available)
    if ("getBattery" in navigator) {
      try {
        // Note: This is async, so we'll just note that it's available
        metadata.batteryApiAvailable = true;
      } catch {
        metadata.batteryApiAvailable = false;
      }
    }
    
    // Storage information
    if (navigator.storage && navigator.storage.estimate) {
      try {
        navigator.storage.estimate().then((estimate: { quota?: number; usage?: number }) => {
          // This is async, so we'll just note it's available
          metadata.storageApiAvailable = true;
        }).catch(() => {
          metadata.storageApiAvailable = false;
        });
      } catch {
        metadata.storageApiAvailable = false;
      }
    }
    
    // Local storage availability
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      metadata.localStorageAvailable = true;
    } catch {
      metadata.localStorageAvailable = false;
    }
    
    // Session storage availability
    try {
      const testKey = "__session_storage_test__";
      sessionStorage.setItem(testKey, "test");
      sessionStorage.removeItem(testKey);
      metadata.sessionStorageAvailable = true;
    } catch {
      metadata.sessionStorageAvailable = false;
    }

    // Memory information (if available)
    const memory = (window.performance as { memory?: { jsHeapSizeLimit?: number; totalJSHeapSize?: number; usedJSHeapSize?: number } })?.memory;
    if (memory) {
      metadata.memory = {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
      };
    }

    // Performance timing (if available)
    if (window.performance?.timing) {
      const timing = window.performance.timing;
      const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
      if (pageLoadTime > 0) {
        metadata.pageLoadTime = pageLoadTime;
        metadata.performance = {
          pageLoadTime,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          domInteractive: timing.domInteractive - timing.navigationStart,
          firstPaint: (performance.getEntriesByType("paint") as Array<{ name: string; startTime: number }>)
            .find(entry => entry.name === "first-paint")?.startTime || null,
          firstContentfulPaint: (performance.getEntriesByType("paint") as Array<{ name: string; startTime: number }>)
            .find(entry => entry.name === "first-contentful-paint")?.startTime || null,
        };
      }
    }
    
    // Navigation timing (if available)
    if (window.performance?.navigation) {
      metadata.navigation = {
        type: window.performance.navigation.type, // 0=navigate, 1=reload, 2=back_forward, 255=reserved
        redirectCount: window.performance.navigation.redirectCount,
      };
    }
    
    // Resource timing (if available)
    if (window.performance?.getEntriesByType) {
      try {
        const resources = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        if (resources.length > 0) {
          metadata.resourceCount = resources.length;
          const totalResourceSize = resources.reduce((sum, r) => {
            const size = (r as { transferSize?: number }).transferSize || 0;
            return sum + size;
          }, 0);
          metadata.totalResourceSize = totalResourceSize;
        }
      } catch {
        // Ignore errors
      }
    }
    
    // Web Vitals (if available via PerformanceObserver)
    if (typeof PerformanceObserver !== "undefined") {
      metadata.webVitalsAvailable = true;
    }
  } catch (error) {
    console.warn("[metadata] Failed to collect browser metadata:", error);
  }

  return metadata;
}

/**
 * Get environment metadata
 */
export function getEnvironmentMetadata(): Record<string, unknown> {
  // Read app version from package.json (same approach as config.ts)
  let appVersion = "1.0.0-alpha";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require("../package.json");
    appVersion = packageJson.version || appVersion;
  } catch {
    // Fallback to default if package.json can't be read
  }

  const metadata: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    appVersion: appVersion,
    applicationVersion: appVersion, // Also include as applicationVersion for clarity
  };

  // Add deployment/release information if available
  if (process.env.VERCEL) {
    metadata.deployment = {
      platform: "vercel",
      env: process.env.VERCEL_ENV,
      url: process.env.VERCEL_URL,
      deploymentUrl: process.env.VERCEL_DEPLOYMENT_URL,
    };
  }

  // Add build information
  if (process.env.NEXT_PUBLIC_BUILD_ID) {
    metadata.buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  }

  // Add custom tags if set
  if (process.env.NEXT_PUBLIC_ENVIRONMENT_TAG) {
    metadata.environmentTag = process.env.NEXT_PUBLIC_ENVIRONMENT_TAG;
  }

  return metadata;
}

/**
 * Get request metadata from server-side request
 */
export function getRequestMetadata(request: Request): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  try {
    // User Agent from request
    const userAgent = request.headers.get("user-agent");
    if (userAgent) {
      metadata.userAgent = userAgent;
    }

    // Referer
    const referer = request.headers.get("referer");
    if (referer) {
      metadata.referer = referer;
    }

    // Origin
    const origin = request.headers.get("origin");
    if (origin) {
      metadata.origin = origin;
    }

    // Accept-Language
    const acceptLanguage = request.headers.get("accept-language");
    if (acceptLanguage) {
      metadata.acceptLanguage = acceptLanguage;
    }

    // Accept
    const accept = request.headers.get("accept");
    if (accept) {
      metadata.accept = accept;
    }

    // IP address detection - prioritize real client IP from various headers
    // Check headers in order of reliability for getting real client IP
    let ipAddress: string | null = null;
    let ipSource: string | null = null;
    
    // 1. Cloudflare (most reliable when behind Cloudflare)
    const cfConnectingIp = request.headers.get("cf-connecting-ip");
    if (cfConnectingIp && cfConnectingIp !== "::1" && cfConnectingIp !== "127.0.0.1") {
      ipAddress = cfConnectingIp;
      ipSource = "cf-connecting-ip";
    }
    
    // 2. X-Forwarded-For (common in proxies/load balancers)
    // Take the first IP (original client), not the last (immediate proxy)
    if (!ipAddress) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      if (forwardedFor) {
        const ips = forwardedFor.split(",").map(ip => ip.trim()).filter(ip => 
          ip && ip !== "::1" && ip !== "127.0.0.1" && ip !== "localhost"
        );
        if (ips.length > 0) {
          ipAddress = ips[0]; // First IP is usually the original client
          ipSource = "x-forwarded-for";
        }
      }
    }
    
    // 3. X-Real-IP (nginx and some proxies)
    if (!ipAddress) {
      const realIp = request.headers.get("x-real-ip");
      if (realIp && realIp !== "::1" && realIp !== "127.0.0.1" && realIp !== "localhost") {
        ipAddress = realIp;
        ipSource = "x-real-ip";
      }
    }
    
    // 4. X-Client-IP (some proxies)
    if (!ipAddress) {
      const clientIp = request.headers.get("x-client-ip");
      if (clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" && clientIp !== "localhost") {
        ipAddress = clientIp;
        ipSource = "x-client-ip";
      }
    }
    
    // 5. True-Client-IP (Cloudflare Enterprise, Akamai)
    if (!ipAddress) {
      const trueClientIp = request.headers.get("true-client-ip");
      if (trueClientIp && trueClientIp !== "::1" && trueClientIp !== "127.0.0.1" && trueClientIp !== "localhost") {
        ipAddress = trueClientIp;
        ipSource = "true-client-ip";
      }
    }
    
    // 6. X-Forwarded (alternative format)
    if (!ipAddress) {
      const forwarded = request.headers.get("x-forwarded");
      if (forwarded) {
        const ipMatch = forwarded.match(/for=([^;,\s]+)/);
        if (ipMatch && ipMatch[1] && ipMatch[1] !== "::1" && ipMatch[1] !== "127.0.0.1") {
          ipAddress = ipMatch[1].replace(/^"|"$/g, ""); // Remove quotes if present
          ipSource = "x-forwarded";
        }
      }
    }
    
    // Store IP information
    if (ipAddress) {
      metadata.ip = ipAddress;
      metadata.ipType = ipAddress.includes(":") ? "ipv6" : "ipv4";
      if (ipSource) {
        metadata.ipSource = ipSource;
      }
    } else {
      // Only show localhost if we're truly in local development and no real IP found
      // In production behind a proxy, we should always get an IP from headers
      const isLocalhost = request.headers.get("host")?.includes("localhost") || 
                         request.headers.get("host")?.includes("127.0.0.1");
      if (isLocalhost) {
        metadata.ip = "localhost";
        metadata.ipType = "localhost";
        metadata.ipSource = "local-development";
      }
      // If not localhost but no IP found, it might be a misconfiguration
      // We'll leave it undefined rather than showing localhost
    }

    // URL information
    try {
      const url = new URL(request.url);
      metadata.requestUrl = {
        pathname: url.pathname,
        search: url.search,
        hostname: url.hostname,
        protocol: url.protocol,
      };
    } catch {
      // Ignore URL parsing errors
    }

    // Cloudflare headers (if available)
    const cfCountry = request.headers.get("cf-ipcountry");
    const cfRay = request.headers.get("cf-ray");
    if (cfCountry) {
      metadata.cloudflare = {
        country: cfCountry,
        ray: cfRay,
      };
    }

    // Vercel headers (if available)
    const vercelCountry = request.headers.get("x-vercel-ip-country");
    const vercelRegion = request.headers.get("x-vercel-ip-country-region");
    if (vercelCountry) {
      metadata.vercel = {
        country: vercelCountry,
        region: vercelRegion,
      };
    }
  } catch (error) {
    console.warn("[metadata] Failed to collect request metadata:", error);
  }

  return metadata;
}

