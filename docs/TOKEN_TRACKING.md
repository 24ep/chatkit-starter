# Token and Cost Tracking with Langfuse

## Summary

**Yes, Langfuse can track tokens and costs**, but **ChatKit does not currently expose token usage data** in its API responses or SDK callbacks.

## Current Status

- ✅ Langfuse supports token and cost tracking
- ✅ The codebase has been updated to support token/cost data when available
- ❌ ChatKit does not expose token usage in its responses
- ❌ ChatKit does not expose message content (needed to calculate tokens manually)

## What Was Updated

The `createGeneration` function in `lib/langfuse.ts` has been enhanced to accept token and cost data:

```typescript
createGeneration(
  traceId: string,
  name: string,
  input: unknown,
  output?: unknown,
  metadata?: Record<string, unknown>,
  options?: {
    model?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    cost?: number;
    unit?: string; // e.g., "USD"
  }
)
```

## How to Use (When Data Becomes Available)

If ChatKit starts exposing token usage data in the future, you can track it like this:

```typescript
// Example: If ChatKit provides usage data
const usage = chatkitResponse.usage; // hypothetical

createGeneration(
  traceId,
  "assistant_response",
  input,
  output,
  metadata,
  {
    model: "gpt-4", // Model name enables Langfuse automatic cost calculation
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    cost: usage.cost, // Optional: if ChatKit provides cost directly
    unit: "USD"
  }
);
```

## Alternative Solutions

Since ChatKit doesn't expose token usage, here are potential workarounds:

### 1. Proxy/Middleware Approach
If you control the ChatKit API endpoint or can add a proxy layer, you could intercept requests/responses to extract token usage from underlying OpenAI API calls.

### 2. Manual Token Calculation (Limited)
If ChatKit ever starts exposing message content, you could use a tokenizer library like `tiktoken` to calculate tokens:

```typescript
import { encoding_for_model } from "tiktoken";

const encoding = encoding_for_model("gpt-4");
const promptTokens = encoding.encode(promptText).length;
const completionTokens = encoding.encode(completionText).length;
```

### 3. Estimate Based on Workflow
If you know which model your ChatKit workflow uses, you could estimate costs based on average token counts, though this would be less accurate.

## Langfuse Automatic Cost Calculation

Langfuse can automatically calculate costs for supported models (OpenAI, Anthropic, etc.) if you:
1. Provide the correct model name (e.g., "gpt-4", "gpt-3.5-turbo")
2. Provide token usage data

Example:
```typescript
createGeneration(..., {
  model: "gpt-4",
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
  // Langfuse will automatically calculate cost based on GPT-4 pricing
});
```

## References

- [Langfuse Token & Cost Tracking Docs](https://langfuse.com/docs/model-usage-and-cost)
- [Langfuse FAQ: Costs & Tokens](https://langfuse.com/faq/all/costs-tokens-langfuse)
- [ChatKit Documentation](http://openai.github.io/chatkit-js/)


