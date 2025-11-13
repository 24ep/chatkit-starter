// This file is injected at the start of every bundle via webpack entry modification
// It MUST run before any other code executes
(function() {
  'use strict';
  try {
    if (typeof crypto !== 'undefined' && crypto && crypto.getRandomValues) {
      var polyfill = function() {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        var hex = Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
      };
      try {
        crypto.randomUUID = polyfill;
        Object.defineProperty(crypto, 'randomUUID', {
          value: polyfill,
          writable: true,
          configurable: true,
          enumerable: false
        });
      } catch {
        crypto.randomUUID = polyfill;
      }
      if (typeof window !== 'undefined' && window.crypto) {
        try {
          window.crypto.randomUUID = polyfill;
        } catch {
          // Silently fail
        }
      }
    }
  } catch {
    // Silently fail
  }
})();

