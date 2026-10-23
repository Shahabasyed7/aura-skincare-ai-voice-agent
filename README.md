# Aura Skincare — AI Voice CX Agent (Aria)

A complete, production-grade AI Voice Customer Experience Agent for **Aura Skincare India**, built for real-time voice conversations, canonical order tracking, deterministic brand policy guardrails, automatic free-quota fallback, and structured post-call summaries.

- **Live Production URL**: [https://aura-skincare-ai-voice-agent-delta.vercel.app/](https://aura-skincare-ai-voice-agent-delta.vercel.app/)
- **GitHub Repository**: [https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent](https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent)
- **Developer Portfolio**: [https://shahaba-ai-portfolio.vercel.app/](https://shahaba-ai-portfolio.vercel.app/)

---

## 1. Project Overview & Features

Aria acts as Aura Skincare's AI Voice Customer Experience representative. Customers can speak naturally to track orders, evaluate returns or cancellations, check shipping or COD rules, and inquire about botanical skincare products.

### Core Capabilities
- **Bidirectional Voice Interface**: Real-time spoken dialogue using the browser Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) with acoustic echo cancellation to prevent Aria from speaking to herself.
- **Audited Botanical Catalog & Pricing**: Grounded in verified catalog data (Vitamin C Serum 30ml at ₹699, Hydrating Sunscreen SPF 50 at ₹499, and the Green Tea Face Wash + Toner bundle at ₹850). Never fabricates organic certifications or medical cures.
- **Deterministic Policy Enforcement**: Strict mathematical boundary validation for:
  - **Returns**: Strictly within 7 days of delivery for unopened, unused products in original packaging. General policy questions (e.g. *"I bought this 20 days ago and opened it"*) are explained immediately without requiring an order ID.
  - **Damaged Items**: Within 48 hours of delivery with photos sent to `support@auraskincare.in`.
  - **Cancellations**: Allowed only while an order is in `Processing` status (`ORD-103`). Out for Delivery (`ORD-101`) or Delivered (`ORD-102`) orders cannot be cancelled; customer is advised to refuse delivery at doorstep.
  - **Shipping Fees**: Free shipping above ₹499; flat ₹50 on orders ₹499 or below.
  - **Cash on Delivery (COD)**: Available up to ₹2,500; payable via cash or UPI at the doorstep.
- **Isolated Customer Order Cards**: Displays sensitive customer order cards (e.g., `ORD-103` for Ananya Patel) only when the customer explicitly asks to track or references an order ID.
- **Spoken Order ID Normalization**: Automatically normalizes spoken digits (*"order one zero one"*, *"ord 101"*) to standard identifiers (`ORD-101`).
- **Structured Post-Call Summary**: Emits an assessment-compliant JSON audit summary tracking all touched order IDs, actions taken, resolution status (`RESOLVED`, `POLICY_EXPLAINED`, or `UNRESOLVED`), and follow-up requirements.
- **Evaluator Drawer**: One-click slideout drawer with predefined assessment test cases for `ORD-101`, `ORD-102`, `ORD-103`, price follow-ups, and edge cases.

---

## 2. Architecture & Design

### Request Flow & Hybrid Engine
```
                                 [Customer Voice / Text]
                                            │
                                            ▼
                               [useVoiceAgent Hook / UI]
                                            │
                                            ▼
                           [/api/chat Route Handler (Zod)]
                                            │
                                            ▼
                            [Agent Orchestrator Pipeline]
                                ┌───────────┴───────────┐
                                ▼                       ▼
                      [Catalog & Policies]     [Order Service Tool]
                      (Deterministic Rules)     (ORD-101, 102, 103)
                                └───────────┬───────────┘
                                            │ Verified Context
                                            ▼
                              [Gemini 3.8 / LLM Adapter]
                               (4,500ms Timeout Guard)
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
             [Gemini Success]                      [Fallback Engine Triggered]
          (Natural Spoken Reply)                • Missing / Invalid API Key
                     │                          • Free Quota Exhausted (HTTP 429)
                     │                          • Provider Outage (HTTP 503)
                     │                          • Network Stalling / Timeout (>4.5s)
                     │                                             │
                     │                                             ▼
                     │                                [Deterministic Grounding]
                     │                                (100% Policy & Catalog Match)
                     └──────────────────────┬──────────────────────┘
                                            │
                                            ▼
                                   [JSON Chat Response]
                         { reply, intent, detectedOrderId, usedFallback }
                                            │
                                            ▼
                                [Browser SpeechSynthesis]
```

### Technology Stack
- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Vanilla CSS & Tailwind CSS with custom botanical palette (`#FAF8F2` cream, `#2D5A43` eucalyptus green, `#18392B` deep forest)
- **Speech Engine**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` + `SpeechSynthesis`)
- **Primary AI Provider**: Google Generative AI (`gemini-3.8-flash`) via server-side Route Handlers
- **Fallback Engine**: Pure TypeScript deterministic rule engine with zero external dependencies
- **Validation**: Zod schema validation
- **Testing**: Vitest (`61 automated regression tests`)
- **Hosting**: Vercel Serverless Production

---

## 3. Gemini Integration & Free-Quota Resilience

### Supported Model & Configuration
- **Model Identifier**: `gemini-3.8-flash` (or configurable via `GEMINI_MODEL`).
- **Endpoint**: Google AI Studio Gemini API (`generativelanguage.googleapis.com/v1beta`).
- **System Instructions**: Configured with strict brand rules, prohibition of fabricated claims, and conversational voice brevity.

### Automatic Free-Quota & Outage Fallback
Aria treats Gemini as an enhancement for natural phrasing while keeping deterministic business logic as the authoritative foundation:
1. **Missing or Invalid Key**: Falls back instantly to deterministic responses; `/api/health` indicates `geminiConfigured: false`.
2. **Quota Exhaustion (HTTP 429) & Server Errors (HTTP 503)**: Automatically intercepted by the adapter without throwing unhandled exceptions.
3. **Timeout Protection**: Guarded by a strict 4,500ms `Promise.race` timeout. Voice conversations never hang indefinitely.
4. **Metadata Transparency**: Fallback responses set `usedFallback: true`. Aria never falsely claims a fallback response was produced by Gemini.
5. **Automatic Recovery**: Every request evaluates Gemini fresh. When rate limits reset or quota refreshes, Gemini resumes without requiring a server reboot.

---

## 4. Browser Speech Voice Limitations

Browser speech synthesis relies on voices installed on the customer's device and browser:
- Aria automatically audits system voices and prioritizes Indian English (`en-IN`) female voices (specifically **Microsoft Heera** or **Google Neerja**).
- If an Indian English voice is unavailable on the client operating system (e.g. Linux or standard macOS installations without downloaded voices), Aria falls back safely to female English voices such as **Microsoft Zira (en-US)** or the default system voice.
- An Indian accent is therefore **not guaranteed** across all devices, as browsers cannot synthesize voices that are not installed on the operating system.

---

## 5. Canonical Mock Orders

| Order ID | Customer | Product | Amount | Status | Expected Behavior |
|:---|:---|:---|:---|:---|:---|
| **ORD-101** | Priya Sharma | Vitamin C Serum 30ml | ₹699 | Out for Delivery | BlueDart tracking `BD-982103`. Delivery by 6 PM today. Cancellation refused; advise doorstep refusal. |
| **ORD-102** | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Delivered | Delivered 14 days ago via Delhivery (`DL-441029`). Return refused (exceeds 7-day window). |
| **ORD-103** | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Processing | Ordered 3 hours ago. Eligible for cancellation. Standalone items bundled. |

---

## 6. Local Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent.git
cd aura-skincare-ai-voice-agent

# 2. Install dependencies
npm install

# 3. Create environment file from template
cp .env.example .env.local

# 4. (Optional) Configure Gemini API key in .env.local
# GEMINI_API_KEY=your_key_here

# 5. Run development server
npm run dev
```

Open `http://localhost:3000` in Google Chrome or Microsoft Edge (recommended for Web Speech API support).

---

## 7. Testing & Verification

Run the automated Vitest test suite:
```bash
npm test -- --run
```
**Test Results**: **61 passed (61 tests)** across:
- Section 1–4: Canonical order retrieval, status checking, and shipping/return boundary math
- Section 5–7: Multi-turn intent maintenance, pronoun resolution, and catalog protection
- Section 8: Five verified bug regressions (summary history, timestamp formatting, multi-intent turns, voice selection)
- Section 9: Remaining bug fixes (complete touched order tracking, spoken order IDs, clean product copy, refund demands)
- Section 10: Gemini API key validation, HTTP 429 quota exhaustion, timeout guards, and deterministic post-call summaries

Run the production build:
```bash
npm run build
```

---

## 8. Assessment Reflection & Engineering Questions

### Q1. Why did you choose this architecture and tech stack?
**Answer**:
I chose **Next.js 14 App Router with TypeScript, Tailwind CSS, and Vercel Serverless** because customer experience voice agents require ultra-low latency, reliable state management, and strict policy adherence. 

Rather than allowing an LLM to hallucinate customer order records or invent return dates, I architected a **hybrid model**:
1. **Deterministic Core**: Pure TypeScript services handle order status lookups, date arithmetic (e.g. 7-day return window, 48-hour damage reports), and shipping calculations.
2. **AI Voice Layer**: Google Gemini provides conversational warmth and phrasing over verified context data.
3. **Web Speech API**: Zero-latency native browser speech recognition and synthesis eliminates expensive, slow roundtrips to external speech-to-text / text-to-speech APIs, keeping the agent responsive within milliseconds.

### Q2. What was the hardest part, and how did you solve it?
**Answer**:
The hardest engineering challenge was **preventing acoustic echo loops while maintaining continuous conversation state across multi-turn queries**.

In web browsers, when the agent speaks through the device speaker, `SpeechRecognition` frequently transcribes the agent's own speech, causing the AI to talk to itself or interrupt itself. 
To solve this:
- Implemented an **audio-locking synchronization hook** (`useVoiceAgent.ts`) that temporarily pauses microphone input while `SpeechSynthesis` is active and introduces a 300ms cooldown window before resuming recognition.
- Coupled this with **context-aware intent routing** so that when a customer asks multi-question turns (e.g. *"Can I cancel ORD-101 and also check if I can return ORD-102?"*), the agent evaluates each order independently without confusing cancellation targets with return targets.

### Q3. If you had one more week, what would you improve first and why?
**Answer**:
If granted another week, I would implement **WebSocket-based bidirectional audio streaming using Gemini Live API (Audio-to-Audio)** combined with **server-side Voice Activity Detection (VAD)**. 

While the browser Web Speech API provides free, zero-setup speech synthesis, client voice quality varies significantly depending on the user's operating system (Windows vs. macOS vs. Android). Moving to streaming PCM audio over WebSockets with server-rendered neural Indian English voices (such as Google Cloud TTS Journey voices) would guarantee consistent studio-grade Indian customer care warmth on every browser and device.

### Q4. What would you change to support 1,000 conversations per day?
**Answer**:
Handling 1,000 conversations per day (~5,000–10,000 conversational turns/day) requires addressing concurrency, quota limits, persistence, and observability:
1. **Gemini Tier Upgrade & Rate Limiting**: Move from free-tier AI Studio keys to Google Cloud Vertex AI or paid Gemini API tier with higher RPM/TPM allowances. Implement token bucket rate limiting on the `/api/chat` route.
2. **Persistent Database & Order System**: Replace in-memory mock data with **PostgreSQL via Prisma or Supabase** to log live call transcripts, customer CSAT ratings, and real inventory/order states.
3. **Redis Caching**: Deploy Redis (e.g. Upstash) to cache product catalog embeddings and frequent policy answers, reducing redundant LLM calls by ~40%.
4. **Distributed Tracing & Audio Monitoring**: Integrate OpenTelemetry and Sentry to track turn latency, audio dropouts, and LLM fallback rates in real time.
5. **PII Masking**: Implement regex-based masking of customer phone numbers, street addresses, and payment details before transcripts are logged or passed to any third-party provider.

---

## 9. Author & Portfolio

- **Author**: **Shahaba Syed**
- **Portfolio**: [https://shahaba-ai-portfolio.vercel.app/](https://shahaba-ai-portfolio.vercel.app/)
- **GitHub**: [@Shahabasyed7](https://github.com/Shahabasyed7)
- **Project Repository**: [https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent](https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent)
