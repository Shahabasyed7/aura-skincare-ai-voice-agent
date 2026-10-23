# Aura Skincare — AI Voice Customer Experience Agent Architecture

## 1. Overview
Aura Skincare AI Voice CX Agent is a full-stack, serverless voice-enabled customer support assistant designed for Indian e-commerce support. The agent, **Aria**, converses in clear, concise English with Indian customer care warmth (1–2 sentences per turn) and enforces strict brand policies through deterministic code.

## 2. High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                               Client Browser                                    |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |                          React Dashboard (Next.js)                      |   |
|   |   - VoiceControls (Start/End Call, Aura Ring animation)                 |   |
|   |   - StatusIndicator (Idle, Listening, Thinking, Speaking, Error)        |   |
|   |   - Transcript (Live customer/agent bubble stream + typed fallback)      |   |
|   |   - OrderHelper (Evaluator panel with ORD-101, ORD-102, ORD-103)        |   |
|   |   - CallSummaryCard (JSON output + 1-click clipboard copy)              |   |
|   +-------------------------------------------------------------------------+   |
|                                        ^                                        |
|                                        |                                        |
|   +------------------------------------+------------------------------------+   |
|   |                     useVoiceAgent Custom Hook                           |   |
|   |   - Web SpeechRecognition (lang: 'en-IN', auto-restart, continuous)     |   |
|   |   - SpeechSynthesis (Aria voice, auto-pause recognition during speech)  |   |
|   |   - State lifecycle management & microphone permissions error handling   |   |
|   +------------------------------------+------------------------------------+   |
+----------------------------------------|----------------------------------------+
                                         | HTTP POST (Stateless Conversation Context)
                                         v
+---------------------------------------------------------------------------------+
|                     Next.js Route Handlers (Serverless API)                     |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |  Routes:                                                                |   |
|   |    POST /api/chat               - Orchestrates turn, returns reply      |   |
|   |    GET  /api/health             - Diagnostic status (no secrets leaked) |   |
|   |    GET  /api/orders             - Evaluator list of 3 test orders       |   |
|   |    GET  /api/orders/[orderId]   - Real internal order lookup            |   |
|   |    POST /api/calls/[callId]/end - Structured summary generator          |   |
|   +-------------------------------------------------------------------------+   |
|                                        |                                        |
|   +------------------------------------+------------------------------------+   |
|   |                         agentOrchestrator                               |   |
|   |   - classifyIntent()                                                    |   |
|   |   - extractOrderIdFromText()                                            |   |
|   +-------------------+---------------------------------+-------------------+   |
|                       |                                 |                       |
|                       v                                 v                       |
|   +------------------------------------+   +--------------------------------+   |
|   |       Deterministic Guardrails     |   |          Gemini Adapter        |   |
|   |   - orderService                   |   |   - Google Generative AI       |   |
|   |   - policyService                  |   |   - Strict system instructions |   |
|   |     * Free ship > ₹499 (₹50 fee)   |   |   - Temperature: 0.3           |   |
|   |     * Return window: 7 days        |   |   - Max tokens: 120 (1-2 sent) |   |
|   |     * Damaged item: 48 hours       |   +--------------------------------+   |
|   |     * Cancel: Only 'Processing'    |                    |                   |
|   |     * COD: Up to ₹2,500 (Cash/UPI) |                    v                   |
|   +------------------------------------+   +--------------------------------+   |
|                       |                    |      Deterministic Fallback    |   |
|                       |                    |  (Runs if Gemini fails/no key) |   |
|                       +------------------->+--------------------------------+   |
+---------------------------------------------------------------------------------+
```

## 3. Data & State Flow
1. **Microphone Capture**: The browser's Web Speech API converts the user's speech to text in Indian English (`en-IN`).
2. **Stateless Request**: The client sends the latest transcript history and user utterance to `POST /api/chat`.
3. **Intent & Policy Engine**:
   - The server inspects the query for intents (Order Tracking, Cancellation, Returns, Damaged Items, Shipping, COD, Products).
   - If an order ID is present, `get_order_details(order_id)` checks the mock database (`ORD-101`, `ORD-102`, `ORD-103`).
   - Hard deterministic rules determine policy compliance (e.g. `ORD-101` cannot be cancelled because it is Out for Delivery; `ORD-102` cannot be returned because 14 days have passed; `ORD-103` is Processing and can be cancelled).
4. **Resilient AI Synthesis**:
   - The verified facts are passed into the Gemini prompt as strict system ground-truth.
   - If Gemini is offline or unconfigured, the deterministic fallback engine formulates the exact policy answer.
5. **Speech Synthesis**: The response is spoken aloud using browser `SpeechSynthesis`. Web Speech recognition is paused during speech to prevent Aria from hearing her own voice.
6. **Call End & Summary**: Ending the call triggers `POST /api/calls/[callId]/end`, compiling a structured JSON summary conforming to the assignment schema.
