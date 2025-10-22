# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build production app with Turbopack
- `pnpm start` - Start production server
- `pnpm tsc --noEmit` - Run TypeScript compiler to check for type errors

## Code Quality

**IMPORTANT**: Always run `pnpm tsc --noEmit` after writing or modifying any code to ensure there are no TypeScript errors before considering the task complete.

## Package Manager

This project strictly uses **pnpm**. Do not use npm or yarn.

### AI Integration

- Uses AI SDK 5's `streamText()` for streaming responses
- API route at `/api/chat` expects `{ messages: Array }` and returns streaming text
- use useChat for all streaming handling (read the doc first, always, before writing any streaming code: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- **CRITICAL**: `sendMessage()` from useChat ONLY accepts UIMessage-compatible objects: `sendMessage({ text: "message" })`
- **NEVER** use `sendMessage("string")` - this does NOT work and will cause runtime errors
- Messages from useChat have a `parts` array structure, NOT a simple `content` field
- Tool calls and sources are supported in the response format
- Requires environment variables in `.env.local`
- Reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#streamtext

### AI SDK Tools

**CRITICAL REQUIREMENT**: You MUST read the AI SDK tools documentation before working with tools: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

**ALSO REQUIRED**: Read the manual agent loop cookbook for advanced patterns: https://ai-sdk.dev/cookbook/node/manual-agent-loop

This documentation is essential for understanding:
- How tools are called by language models
- Tool execution flow and lifecycle
- Tool choice strategies (`auto`, `required`, `none`, specific tool)
- Multi-step tool calling with `stopWhen` and `stepCountIs()`
- Tool call monitoring and error handling
- Manual agent loops for complex tool workflows

#### Data Streaming with Tools

**IMPORTANT**: Always read the AI SDK data streaming documentation when working with custom data parts: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data



##### Types of Streamable Data

1. **Tool Results**: Automatically streamed when tools return data
2. **Sources**: Can be included in tool results for RAG implementations
3. **Custom Data Parts**: Can be streamed using `streamData` for more complex scenarios

##### Best Practices

- Keep tool return types simple to avoid TypeScript deep instantiation errors
- Include sources directly in tool results for automatic streaming
- Use the `toUIMessageStreamResponse()` method for proper client compatibility
- Tool results are automatically included in the message parts array

#### Current AI SDK API (v5.0.44+)

**IMPORTANT**: The AI SDK API has evolved. Always use current patterns:

##### Multi-Step Tool Execution with `stepCountIs()`

```typescript
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { executeSQLQuery },
  stopWhen: stepCountIs(10), // CURRENT API - replaces deprecated maxSteps
});
```

##### Tool Choice Strategies

Control how and when tools are called using the `toolChoice` parameter:

```typescript
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { executeSQLQuery },
  toolChoice: 'auto', // Options: 'auto', 'required', 'none', or specific tool name
  stopWhen: stepCountIs(5),
});
```

- **`auto` (default)**: Model decides whether to call tools based on context
- **`required`**: Model must call at least one tool before responding
- **`none`**: Disable all tool calls
- **Specific tool**: Force a particular tool to be called



#### Tool Implementation Guidelines

- **Structure**: Each tool uses AI SDK's `tool()` function with:
  - `description`: Clear explanation of the tool's purpose (influences tool selection)
  - `inputSchema`: Zod schema defining input parameters
  - `execute`: Async function performing the tool's action



#### Tool Call Monitoring

Add logging in tools to monitor execution:

```typescript
// In tool execute function
execute: async ({ query }) => {
  console.log(`🔍 Tool executing with query: "${query}"`);
  try {
    const result = await performAction(query);
    console.log(`✅ Tool completed successfully`);
    return result;
  } catch (error) {
    console.error(`💥 Tool error:`, error);
    throw error;
  }
}
```

#### Tool Call UI Indicators

Display tool execution states using AI Elements:

```typescript
// Example
{message.parts?.filter(part => part.type === "tool").map((part, i) => {
  const toolState = part.result
    ? "output-available"
    : part.input
      ? "input-available"
      : "input-streaming";

  return (
    <Tool defaultOpen={true}>
      <ToolHeader type={`tool-${part.toolName}`} state={toolState} />
      <ToolContent>
        {part.input && <ToolInput input={part.input} />}
        {part.result && <ToolOutput output={part.result} />}
        {toolState === "input-streaming" && (
          <div>🔍 Executing SQL query...</div>
        )}
      </ToolContent>
    </Tool>
  );
})}
```

#### Tool Call Best Practices

- **Clear Descriptions**: Write detailed descriptions to help the model choose the right tool
- **Specific Input Schemas**: Use descriptive Zod schemas with `.describe()` for parameters
- **Error Handling**: Always wrap tool execution in try-catch blocks
- **Logging**: Add console logging to track tool usage and debug issues
- **Return Structure**: Keep return types simple to avoid TypeScript complexity
- **UI Feedback**: Always show tool execution state using AI Elements components

### Chat Architecture

- **Frontend**: Use `useChat` hook from `@ai-sdk/react`
- **API Route**: Validates messages, converts UIMessages to ModelMessages using `convertToModelMessages()`, streams response via `toTextStreamResponse()`
- **Message Format**: Messages have `parts` array with typed parts (text, tool, source-url, etc.), NOT simple `content` field
- **Sending Messages**: MUST use `sendMessage({ text: "message" })` format - string format does NOT work
- **Streaming**: Official `useChat` hook handles streaming automatically
- **Error Handling**: Graceful fallbacks for API failures via `status` monitoring

### UI Components

- **shadcn/ui** configured with:
  - New York style
  - Neutral base color with CSS variables
  - Import aliases: `@/components`, `@/lib`, `@/lib/utils`, `@/components/ui`, `@/hooks`
  - Lucide React for icons
- **AI Elements** from Vercel:
  - Pre-built components for AI applications
  - Located in `components/ai-elements/`
  - Key components: Conversation, Message, PromptInput, Sources, Tool, Reasoning
  - Supports tool calls, sources, reasoning tokens, and rich message formatting
  - Reasoning component documentation: https://ai-sdk.dev/elements/components/reasoning#reasoning
  - Reasoning tokens automatically display as collapsible blocks with duration tracking

### Adding Components

- shadcn/ui: `pnpm dlx shadcn@latest add [component-name]`
- AI Elements: `pnpm dlx ai-elements@latest` (adds all components)



## Critical Rules for useChat Implementation

**NEVER EVER DO THIS:**
- ❌ `sendMessage("string")` - This DOES NOT work and causes runtime errors
- ❌ Accessing `message.content` directly - Messages use `parts` array structure
- ❌ Passing plain strings to sendMessage

**ALWAYS DO THIS:**
- ✅ `sendMessage({ text: "message content" })` - Only UIMessage-compatible objects work
- ✅ Access message content via `message.parts` array
- ✅ Read AI SDK docs before implementing any useChat functionality