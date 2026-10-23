# Aura Skincare — AI Voice CX Agent (Aria)

A complete, production-grade AI Voice Customer Experience Agent for **Aura Skincare India**, built for natural customer support conversations, order lifecycle management, deterministic policy enforcement, and structured post-call summaries.

- **Live Production URL**: [https://aura-skincare-ai-voice-agent.vercel.app](https://aura-skincare-ai-voice-agent.vercel.app)
- **GitHub Repository**: [https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent](https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent)
- **Portfolio**: [https://shahaba-ai-portfolio.vercel.app/](https://shahaba-ai-portfolio.vercel.app/)

---

## 1. Project Overview & Key Features

Aria communicates with customers via continuous bidirectional spoken voice, resolves order tracking requests, evaluates return/cancellation eligibility under deterministic brand rules, and produces structured post-call summaries.

### Key Capabilities
- **Natural Voice Conversations**: Real-time spoken dialogue powered by the browser Web Speech API (`en-IN`) with female voice matching, continuous listening, and acoustic feedback suppression so Aria never hears herself.
- **Product Intelligence & Context Maintenance**: Handles multi-turn inquiries, pronoun resolution ("its price", "buy it"), and product transitions without restarting.
- **Audited Botanical Catalog**: Uses strictly verified product data. Green Tea Face Wash + Toner bundle is offered for ₹850 (with standalone prices accurately identified as unavailable). Does not invent unverified ingredients, medical benefits, or organic claims.
- **Isolated Customer Order Cards**: Displays customer order cards (e.g. `ORD-103` for Ananya Patel) only when the customer explicitly provides an order ID or asks for tracking, preventing customer data exposure during general product inquiries.
- **Deterministic Policy Guardrails**: Enforces exact, non-hallucinated return windows (7 days from delivery), cancellation windows (processing status only), COD thresholds (up to ₹2,500), and shipping fee rules (free above ₹499; ₹50 otherwise).
- **Post-Call Summary Generation**: Produces a standardized JSON summary compliant with the assessment schema upon call completion with a 1-click copy feature.
- **Evaluator Drawer & Test Scenarios**: Includes a slide-out testing drawer with one-click test cases for canonical orders (`ORD-101`, `ORD-102`, `ORD-103`), price follow-ups, and policy edge cases.

---

## 2. Architecture & Design

### Technology Stack
- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Vanilla CSS & Tailwind CSS with a botanical aesthetic (warm cream `#FAF8F2`, eucalyptus green `#2D5A43`, mist green `#DCE7D8`, and deep forest `#18392B`)
- **Speech Input**: Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with `en-IN` localization
- **Speech Synthesis**: Browser `SpeechSynthesis` with female voice filtering and synthesis locking
- **AI Engine**: Google Generative AI (Gemini 1.5 Flash) via server-side Route Handlers with deterministic fallback
- **Validation**: Zod schema validation on all API requests
- **Test Suite**: Vitest for unit, boundary, and multi-turn regression testing
- **Deployment**: Vercel Serverless (stateless, zero-cost, zero external database dependency)

### Directory Structure
```
src/
├── app/
│   ├── api/
│   │   ├── calls/[callId]/end/route.ts # Post-call JSON summary generation
│   │   ├── chat/route.ts              # Agent turn orchestration
│   │   ├── health/route.ts            # Service diagnostics & config check
│   │   ├── orders/route.ts            # Evaluator mock orders list
│   │   └── orders/[orderId]/route.ts  # Real internal order lookup
│   ├── globals.css                    # Design tokens & botanical styling
│   ├── layout.tsx                     # Root layout & typography
│   └── page.tsx                       # Main voice CX dashboard & footer
├── components/
│   ├── ActiveConversationView.tsx     # Live transcript, order card & call controls
│   ├── CallSummaryView.tsx            # Structured JSON summary + copy button
│   ├── EvaluatorDrawer.tsx            # Drawer for evaluator scenarios & test orders
│   ├── SupportCategories.tsx          # Quick-start topic cards
│   └── VoiceOrb.tsx                   # Multi-state animated voice orb
├── hooks/
│   └── useVoiceAgent.ts               # Call lifecycle, Web Speech API & audio controls
├── lib/
│   ├── agent/agentOrchestrator.ts     # Multi-turn intent detection & catalog routing
│   ├── ai/geminiAdapter.ts            # Server-side Gemini client & system instructions
│   ├── data/
│   │   ├── mockData.ts                # Canonical mock orders (ORD-101, ORD-102, ORD-103)
│   │   └── productCatalog.ts          # Verified product catalog & pricing
│   ├── services/
│   │   ├── orderService.ts            # Order lookup & normalization
│   │   ├── policyService.ts           # Hard deterministic business policy rules
│   │   ├── summaryService.ts          # Structured call summary generation
│   │   └── voiceService.ts            # Female voice matching & synthesis
│   └── validation/index.ts            # Zod validation schemas
├── types/index.ts                     # TypeScript interfaces
tests/
└── policyAndOrder.test.ts             # 47 automated Vitest regression tests
```

---

## 3. Brand Policies & Deterministic Guardrails

All business rules are evaluated deterministically in TypeScript (`src/lib/services/policyService.ts`) to prevent hallucinated promises or policy bypasses:

| Policy Area | Rule | Enforcement |
|---|---|---|
| **Shipping Fees** | Free above ₹499; ₹50 fee on orders ₹499 or below | `calculateShippingFee(amount)` strictly evaluates boundary condition. |
| **Delivery Time** | Standard 3–5 business days across India | Verified in both prompt and fallback strings. |
| **Returns** | Accepted within 7 days of delivery for unopened products | `checkReturnEligibility(order)`. ORD-102 (delivered 14 days ago) is rejected. |
| **Damaged Items** | Must be reported within 48 hours with photos | `checkDamagedReportingEligibility(hours)` enforces 48-hour cutoff. |
| **Cancellations** | Allowed only while status is `Processing` | `checkCancellationEligibility(order)`. ORD-101 (Out for Delivery) is rejected; ORD-103 (Processing) is approved. |
| **Refusal at Door** | Shipped/Out for Delivery orders cannot be cancelled | Customer is guided to refuse delivery at doorstep. |
| **Cash on Delivery** | Available up to ₹2,500; payable by cash or UPI | `checkCodEligibility(amount)`. |

---

## 4. Canonical Test Orders

| Order ID | Customer | Product | Amount | Status | Expected Behavior |
|---|---|---|---|---|---|
| **ORD-101** | Priya Sharma | Vitamin C Serum 30ml | ₹699 | Out for Delivery | BlueDart tracking `BD-982103`. Delivery by 6 PM today. Cancellation rejected; advise refusal at doorstep. |
| **ORD-102** | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Delivered | Delivered 14 days ago via Delhivery (`DL-441029`). Return rejected (exceeds 7-day window). |
| **ORD-103** | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Processing | Ordered 3 hours ago. Cancellation eligible. Free shipping applied. |

---

## 5. Local Setup & Configuration

### Prerequisites
- Node.js 18+ or 20+
- Google Chrome or Microsoft Edge (native Web Speech API support)

### Installation
```bash
# 1. Clone repository & install dependencies
git clone https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent.git
cd aura-skincare-ai-voice-agent
npm install

# 2. Configure environment variables
cp .env.example .env.local
```

### Environment Variables
Edit `.env.local`:
```env
# Server-side Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Next.js telemetry
NEXT_TELEMETRY_DISABLED=1
```
> **Note on Gemini Configuration**: If `GEMINI_API_KEY` is absent, empty, or invalid, Aria operates seamlessly on the deterministic fallback engine and reports `"geminiConfigured": false` at `/api/health`. To enable server-side Gemini 1.5 Flash in Vercel production:
> 1. Go to your **Vercel Project Dashboard → Settings → Environment Variables**.
> 2. Add `GEMINI_API_KEY` with your Google AI Studio API key for the **Production** environment.
> 3. Trigger a redeployment. `/api/health` will then report `"geminiConfigured": true`.

### Browser Speech Voice Limitations
Browser speech synthesis voices depend on the operating system and browser installed on the customer's machine:
- The application automatically discovers installed voices and prioritizes Indian English (`en-IN`) female voices, specifically **Microsoft Heera** or **Google Neerja**.
- If an Indian English voice is not installed on the user's operating system, the application falls back safely to a female English voice such as **Microsoft Zira (en-US)** or an available system voice.
- An Indian accent is therefore **not guaranteed** across all client machines, as the browser cannot synthesize voices that are not installed on the host operating system.

### Running Locally
```bash
# Start Next.js development server
npm run dev

# Or run the production build locally
npm run build
npm start
```
Open `http://localhost:3000` in Google Chrome or Microsoft Edge.

---

## 6. Testing

Run the automated test suite with Vitest:
```bash
npm test -- --run
```
The test suite executes **47 automated tests** across:
- Order status & tracking lookup
- Return policy eligibility (boundary conditions & delivered checks)
- Cancellation window enforcement
- Shipping fee thresholds & COD limits
- Multi-turn conversation orchestration, pronoun resolution & product switching
- Isolation of customer order cards during general product queries
- Audited catalog enforcement (no unsupported ingredients or organic claims)

---

## 7. Deployment (Vercel)

1. Connect the GitHub repository `https://github.com/Shahabasyed7/aura-skincare-ai-voice-agent` in the Vercel dashboard.
2. In **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` = your Google Gemini API key.
3. Deploy with default Next.js build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build`
   - **Output Directory**: `.next`

---

## 8. Author & Portfolio

Designed and developed by **Shahaba Syed**:
- Portfolio: [https://shahaba-ai-portfolio.vercel.app/](https://shahaba-ai-portfolio.vercel.app/)
- GitHub: [@Shahabasyed7](https://github.com/Shahabasyed7)
