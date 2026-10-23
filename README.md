# Aura Skincare — AI Voice CX Agent (Aria)

A complete, production-grade hiring assignment project implementing **Aria**, an AI Voice Customer Experience Agent for **Aura Skincare**, a premium organic Indian skincare brand.

Aria communicates with customers via spoken voice, resolves order tracking requests, evaluates return/cancellation eligibility under deterministic brand rules, and produces structured post-call summaries.

---

## 1. Quick Start & Local Setup

### Prerequisites
- Node.js 18+ or 20+
- Modern Web Browser (Google Chrome or Microsoft Edge recommended for native Web Speech API support)

### Installation
```bash
# 1. Clone repository & install dependencies
git clone <your-repo-url>
cd Aura-ai
npm install

# 2. Configure environment variables
cp .env.example .env.local
```

### Environment Variables
Edit `.env.local` to add your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note**: Even if no Gemini API key is provided or if quota is exceeded, the application features an automatic **deterministic fallback engine** that handles order tracking, cancellations, returns, shipping, COD, and brand questions seamlessly.

### Run Locally
```bash
# Start Next.js development server
npm run dev

# Or run production build
npm run build
npm start
```
Visit `http://localhost:3000` in Google Chrome or Microsoft Edge.

### Run Tests
```bash
npm test
```
Vitest executes 19 unit tests across order lookup and deterministic policy rules.

---

## 2. Architecture & Design Decisions

### Tech Stack
- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Tailwind CSS with an organic earthy palette (forest green, natural clay, stone neutrals)
- **Voice Input**: Browser `webkitSpeechRecognition` / `SpeechRecognition` configured for `en-IN`
- **Voice Output**: Browser `SpeechSynthesis` with acoustic feedback suppression
- **AI Engine**: Google Generative AI (Gemini 1.5 Flash) via server-side Route Handlers
- **Validation**: Zod schema validation on all API endpoints
- **Testing**: Vitest for unit & boundary testing
- **Deployment Target**: Vercel Hobby tier (stateless, zero-cost, no external DB needed)

### Directory Structure
```
src/
├── app/
│   ├── api/
│   │   ├── calls/[callId]/end/route.ts # Final call summary generation
│   │   ├── chat/route.ts              # Agent turn orchestration
│   │   ├── health/route.ts            # Service diagnostics & config check
│   │   ├── orders/route.ts            # Evaluator mock orders list
│   │   └── orders/[orderId]/route.ts  # Real internal order lookup
│   ├── globals.css                    # Tailwind aesthetics & styling
│   ├── layout.tsx                     # App layout & font setup
│   └── page.tsx                       # Main voice customer dashboard
├── components/
│   ├── CallSummaryCard.tsx            # Structured JSON summary + copy button
│   ├── OrderHelper.tsx                # 3 canonical demo orders with test buttons
│   ├── StatusIndicator.tsx            # Live state (Idle, Listening, Thinking, Speaking, Error)
│   ├── Transcript.tsx                 # Live customer & Aria conversation turns + text input
│   └── VoiceControls.tsx              # Start Call, End Call & animated voice visualizer
├── hooks/
│   └── useVoiceAgent.ts               # Call lifecycle, Web Speech API & audio controls
├── lib/
│   ├── agent/agentOrchestrator.ts     # Intent detection, tool execution, fallback generator
│   ├── ai/geminiAdapter.ts            # Server-side Gemini client & system instructions
│   ├── data/mockData.ts               # Mock orders (ORD-101, ORD-102, ORD-103) & brand data
│   ├── services/
│   │   ├── orderService.ts            # get_order_details(order_id) & normalization
│   │   ├── policyService.ts           # Hard deterministic business policy rules
│   │   └── summaryService.ts          # Structured call summary generation
│   └── validation/index.ts            # Zod validation schemas
├── types/index.ts                     # Shared TypeScript interfaces
tests/
└── policyAndOrder.test.ts             # 19 Vitest unit tests for orders & policy rules
```

---

## 3. Brand Policies & Deterministic Guardrails

To prevent LLM hallucination of refunds, delivery promises, or policy exceptions, all business logic is hardcoded in TypeScript (`src/lib/services/policyService.ts`):

| Policy Area | Rule | Implementation |
|---|---|---|
| **Shipping Fees** | Free above ₹499; ₹50 fee on ₹499 or below | `calculateShippingFee(amount)` strictly evaluates boundary condition. |
| **Delivery Time** | Standard 3–5 business days across India | Verified in both prompt and fallback strings. |
| **Returns** | Accepted within 7 days of delivery for unopened products | `checkReturnEligibility(order)` evaluates delivery days. ORD-102 (14 days ago) is rejected. |
| **Damaged Items**| Must be reported within 48 hours with photos | `checkDamagedReportingEligibility(hours)` enforces 48-hour cutoff. |
| **Cancellations** | Only allowed while status is `Processing` | `checkCancellationEligibility(order)`. ORD-101 (Out for Delivery) is rejected; ORD-103 (Processing) is approved. |
| **Refusal at Door** | Shipped/Out for Delivery orders cannot be cancelled | Customer is guided to refuse delivery at doorstep. |
| **COD** | Up to ₹2,500; payable by cash or UPI | `checkCodEligibility(amount)`. |

---

## 4. Canonical Test Orders

| Order ID | Customer | Product | Amount | Status | Expected Behavior |
|---|---|---|---|---|---|
| **ORD-101** | Priya Sharma | Vitamin C Serum 30ml | ₹699 | Out for Delivery | BlueDart tracking `BD-982103`. Delivery by 6 PM today. Cancellation rejected; advise refusal at doorstep. |
| **ORD-102** | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Delivered | Delivered 14 days ago via Delhivery (`DL-441029`). Return rejected (exceeds 7 days). |
| **ORD-103** | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Processing | Ordered 3 hours ago. Cancellation eligible. Free shipping applied. |

Unknown order IDs (e.g., `ORD-999`) return a clear, safe error message without fabricating data.

---

## 5. Voice Agent Technical Details

1. **Acoustic Feedback Suppression**: When Aria begins speaking via browser `SpeechSynthesis`, speech recognition is paused. When synthesis finishes, recognition is automatically restarted.
2. **Auto-Restart on Silence**: The browser speech recognition automatically restarts if silence causes an unexpected disconnect while the call is still active.
3. **Indian English (`en-IN`)**: Speech recognition is configured to `en-IN` and voice synthesis prefers Indian English or natural English voices.
4. **Clean End-of-Call**: Clicking **End Call** immediately cancels pending speech synthesis, closes the microphone stream, and requests the post-call summary.
5. **Typing Fallback**: If the evaluator is in a noisy environment or on an unsupported browser, an inline text box allows testing the exact same agent flow.

---

## 6. Call Summary JSON Output

When **End Call** is clicked, a structured summary conforming to the assignment schema is generated and displayed with a 1-click **Copy JSON** button:

```json
{
  "customer_intent": "ORDER_TRACKING",
  "order_id": "ORD-101",
  "resolution_status": "RESOLVED",
  "call_summary": "Customer asked about delivery. Agent provided the current status, courier, tracking ID, and expected delivery time."
}
```

---

## 7. Deployment Instructions (Vercel)

1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Aura Skincare AI Voice CX Agent"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. Open the [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: your Google Gemini API key.
5. Click **Deploy**. The application will build and deploy cleanly on the Vercel Hobby tier.

---

## 8. Answers to Assignment Technical Questions

### Q1: How do you prevent LLMs from hallucinating order details and promises?
**Answer:** We separate intent understanding from data retrieval and policy enforcement. The LLM is never tasked with remembering orders or deciding business policy. Instead, our deterministic `orderService` looks up orders via `get_order_details(order_id)` and verifies facts against mock data. The policy service computes exact answers (e.g. `ORD-102` is 14 days old and cannot be returned). These verified facts are injected into the prompt as strict constraints with instructions to deliver 1–2 sentence responses. If the LLM is unavailable, the deterministic fallback delivers the verified policy message directly.

### Q2: Why use the Browser Web Speech API instead of a server-side WebSocket/Twilio architecture?
**Answer:** The Browser Web Speech API runs entirely client-side without costly external telephony subscriptions (Twilio/Agora) or heavy streaming audio servers. This allows a zero-cost, free-tier deployment on Vercel Hobby while keeping latency minimal. Speech is transcribed locally and sent as text over stateless HTTP route handlers.

### Q3: How is acoustic feedback (Aria hearing herself) prevented?
**Answer:** In `useVoiceAgent.ts`, `SpeechSynthesisUtterance` triggers `isSpeakingRef.current = true` and aborts active `SpeechRecognition`. When the `utterance.onend` event fires, recognition is safely resumed. This ensures Aria never transcribes her own voice.

### Q4: How does the application maintain conversation state in a serverless environment?
**Answer:** Vercel serverless functions are stateless. With each request to `POST /api/chat`, the client sends the active conversation transcript history. The server inspects both the current utterance and recent turns to maintain context and pass accurate context to Gemini.
