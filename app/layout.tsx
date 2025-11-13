import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentKit demo",
  description: "Demo of ChatKit with hosted workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          id="crypto-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
                crypto.randomUUID = function() {
                  const bytes = new Uint8Array(16);
                  crypto.getRandomValues(bytes);
                  bytes[6] = (bytes[6] & 0x0f) | 0x40;
                  bytes[8] = (bytes[8] & 0x3f) | 0x80;
                  const hex = Array.from(bytes)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                  return [
                    hex.slice(0, 8),
                    hex.slice(8, 12),
                    hex.slice(12, 16),
                    hex.slice(16, 20),
                    hex.slice(20, 32)
                  ].join('-');
                };
              }
            `,
          }}
        />
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
