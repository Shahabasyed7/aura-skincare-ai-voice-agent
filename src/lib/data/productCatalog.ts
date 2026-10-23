/**
 * Aura Skincare — Centralized Product Knowledge Catalog
 * 
 * Sources:
 * - DataStraw assignment specifications (authoritative for product names, bundle relations, and brand policies)
 * - Explicitly labelled demo/mock catalog details for ingredients, usage, and safety, clearly grounded without false clinical claims.
 */

export interface ProductCatalogEntry {
  id: string;
  name: string;
  category: "Serum" | "Sunscreen" | "Cleanser" | "Toner" | "Bundle";
  size: string;
  price?: number;
  priceDescription: string;
  isBundlePart?: boolean;
  bundleReference?: string;
  description: string;
  purposeAndBenefits: string[];
  ingredients: Array<{
    name: string;
    function: string;
  }>;
  directions: {
    routinePlacement: string;
    frequency: string;
    instructions: string;
  };
  skinTypeSuitability: string[];
  precautions: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  compatibility: {
    compatibleWith: string[];
    notes: string;
  };
  storageAndShelfLife: string;
  commonTroubleshooting: string[];
  returnAndReplacementRules: string;
  disclaimer: string;
}

export const AURA_PRODUCT_CATALOG: Record<string, ProductCatalogEntry> = {
  "vitamin-c-serum": {
    id: "vitamin-c-serum",
    name: "Vitamin C Serum 30ml",
    category: "Serum",
    size: "30ml",
    price: 699,
    priceDescription: "₹699 for 30ml (as established in canonical order ORD-101)",
    description: "A facial serum featuring Vitamin C.",
    purposeAndBenefits: [
      "Facial serum for daily skincare",
    ],
    ingredients: [
      { name: "Vitamin C", function: "Active serum component" },
    ],
    directions: {
      routinePlacement: "Apply onto face and neck as part of your skincare routine.",
      frequency: "Daily.",
      instructions: "Apply onto clean skin.",
    },
    skinTypeSuitability: ["Suitable for everyday use; patch test recommended."],
    precautions: [
      "Avoid direct contact with eyes. For external cosmetic use only.",
    ],
    faqs: [
      {
        question: "Can I use it with Green Tea Face Wash?",
        answer: "Yes, you can use Green Tea Face Wash before applying Vitamin C Serum.",
      },
    ],
    compatibility: {
      compatibleWith: ["Hydrating Sunscreen SPF 50", "Green Tea Face Wash", "Toner"],
      notes: "Can be used alongside Hydrating Sunscreen, Green Tea Face Wash, and Toner.",
    },
    storageAndShelfLife: "Store in a cool, dry place.",
    commonTroubleshooting: [],
    returnAndReplacementRules: "Eligible for return within 7 days of delivery only if unopened, unused, and in original packaging. Damaged bottles reported within 48 hours with photos are replaced.",
    disclaimer: "Cosmetic formulation for daily skincare.",
  },

  "hydrating-sunscreen": {
    id: "hydrating-sunscreen",
    name: "Hydrating Sunscreen SPF 50",
    category: "Sunscreen",
    size: "50g",
    price: 499,
    priceDescription: "₹499 (as established in canonical order ORD-102)",
    description: "A broad-spectrum SPF 50 sunscreen.",
    purposeAndBenefits: [
      "SPF 50 sun protection",
    ],
    ingredients: [],
    directions: {
      routinePlacement: "Apply as part of your morning skincare routine.",
      frequency: "Every morning before sun exposure.",
      instructions: "Apply evenly across face and neck.",
    },
    skinTypeSuitability: ["Suitable for everyday use."],
    precautions: [
      "For external cosmetic use only. Avoid contact with eyes.",
    ],
    faqs: [],
    compatibility: {
      compatibleWith: ["Vitamin C Serum", "Green Tea Face Wash", "Toner"],
      notes: "Can be applied after serums or cleansers.",
    },
    storageAndShelfLife: "Store in a cool, dry place away from direct heat.",
    commonTroubleshooting: [],
    returnAndReplacementRules: "Eligible for return within 7 days of delivery only if unopened and sealed. Order ORD-102 was delivered 14 days ago and is outside this window.",
    disclaimer: "Cosmetic sun protection product for daily use.",
  },

  "green-tea-face-wash": {
    id: "green-tea-face-wash",
    name: "Green Tea Face Wash",
    category: "Cleanser",
    size: "100ml",
    priceDescription: "Available as part of our Green Tea Face Wash + Toner bundle for ₹850 (featured in order ORD-103). Individual standalone price is currently unavailable.",
    isBundlePart: true,
    bundleReference: "Green Tea Face Wash + Toner Bundle (ORD-103, ₹850)",
    description: "A facial cleanser formulated with green tea.",
    purposeAndBenefits: [
      "Facial cleanser for daily skincare",
    ],
    ingredients: [
      { name: "Green Tea Extract", function: "Cleanser formulation component" },
    ],
    directions: {
      routinePlacement: "Cleansing step of daily skincare routine.",
      frequency: "Daily cleanser.",
      instructions: "Gently massage onto wet face and rinse thoroughly with water.",
    },
    skinTypeSuitability: ["Suitable for most skin types; patch test recommended."],
    precautions: [
      "Avoid direct contact with eyes. For external cosmetic use only.",
    ],
    faqs: [
      {
        question: "Can I use it with the Vitamin C Serum?",
        answer: "Yes, you can use the Green Tea Face Wash to cleanse your face before applying your Vitamin C Serum.",
      },
      {
        question: "What is its individual price?",
        answer: "A standalone individual price is currently unavailable; it is offered in our Green Tea Face Wash + Toner bundle for ₹850.",
      },
      {
        question: "Is it part of the ORD-103 order?",
        answer: "Yes, order ORD-103 features our Green Tea Face Wash paired together with our Toner for ₹850.",
      },
    ],
    compatibility: {
      compatibleWith: ["Toner", "Vitamin C Serum", "Hydrating Sunscreen SPF 50"],
      notes: "Can be paired with Toner and Vitamin C Serum in your daily routine.",
    },
    storageAndShelfLife: "Store in a cool, dry place.",
    commonTroubleshooting: [],
    returnAndReplacementRules: "Eligible for return within 7 days of delivery only if unopened and unused in original packaging.",
    disclaimer: "Cosmetic facial cleanser.",
  },

  "toner": {
    id: "toner",
    name: "Toner",
    category: "Toner",
    size: "100ml",
    priceDescription: "Offered in our Green Tea Face Wash + Toner bundle for ₹850 (featured in order ORD-103). Individual standalone price is currently unavailable.",
    isBundlePart: true,
    bundleReference: "Green Tea Face Wash + Toner Bundle (ORD-103, ₹850)",
    description: "A facial toner.",
    purposeAndBenefits: [
      "Facial toner for daily skincare",
    ],
    ingredients: [],
    directions: {
      routinePlacement: "Step after cleansing.",
      frequency: "Daily.",
      instructions: "Apply gently to clean skin.",
    },
    skinTypeSuitability: ["Suitable for everyday use."],
    precautions: [
      "Avoid contact with eyes. For external cosmetic use only.",
    ],
    faqs: [
      {
        question: "How does it relate to ORD-103?",
        answer: "In order ORD-103, this Toner is bundled together with the Green Tea Face Wash for ₹850.",
      },
    ],
    compatibility: {
      compatibleWith: ["Green Tea Face Wash", "Vitamin C Serum", "Hydrating Sunscreen SPF 50"],
      notes: "Recommended after cleansing with Green Tea Face Wash.",
    },
    storageAndShelfLife: "Store in a cool, dry place.",
    commonTroubleshooting: [],
    returnAndReplacementRules: "Eligible for return within 7 days of delivery only when unopened and unused in original packaging.",
    disclaimer: "Cosmetic facial toner for daily skincare.",
  },
};

/**
 * Helper to identify which product a user is asking about from an utterance or previous history.
 */
export function identifyProductFromContext(
  text: string,
  history: Array<{ sender: "customer" | "aria"; text: string }> = []
): ProductCatalogEntry | null {
  const lower = text.toLowerCase();

  // 1. Direct mentions in current text
  if (lower.includes("green tea") || lower.includes("face wash") || lower.includes("cleanser")) {
    return AURA_PRODUCT_CATALOG["green-tea-face-wash"];
  }
  if (lower.includes("vitamin c") || lower.includes("serum") || lower.includes("kakadu")) {
    return AURA_PRODUCT_CATALOG["vitamin-c-serum"];
  }
  if (lower.includes("sunscreen") || lower.includes("spf") || lower.includes("sun block")) {
    return AURA_PRODUCT_CATALOG["hydrating-sunscreen"];
  }
  if (lower.includes("toner") || lower.includes("witch hazel")) {
    return AURA_PRODUCT_CATALOG["toner"];
  }

  // 2. Anaphora / pronoun resolution from history ("What ingredients does it contain?", "How often should I use it?", "price of it", "tell me more", "can you tell me more?")
  const isAnaphora =
    lower.includes(" it ") ||
    lower.startsWith("it ") ||
    lower.endsWith(" it") ||
    lower.includes(" its ") ||
    lower.includes("this product") ||
    lower.includes("that product") ||
    lower.includes("tell me more") ||
    lower.includes("more about that") ||
    lower.includes("buy") ||
    lower.includes("purchase") ||
    lower.includes("order it") ||
    lower.includes("buy it") ||
    lower.includes("ingredients") ||
    lower.includes("how often") ||
    lower.includes("how to use") ||
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("directions") ||
    lower.includes("safe for");

  if (isAnaphora && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const turnLower = history[i].text.toLowerCase();
      if (turnLower.includes("green tea") || turnLower.includes("face wash")) {
        return AURA_PRODUCT_CATALOG["green-tea-face-wash"];
      }
      if (turnLower.includes("vitamin c") || turnLower.includes("serum")) {
        return AURA_PRODUCT_CATALOG["vitamin-c-serum"];
      }
      if (turnLower.includes("sunscreen") || turnLower.includes("spf")) {
        return AURA_PRODUCT_CATALOG["hydrating-sunscreen"];
      }
      if (turnLower.includes("toner") || turnLower.includes("witch hazel")) {
        return AURA_PRODUCT_CATALOG["toner"];
      }
    }
  }

  return null;
}

/**
 * Formats a product entry into compact system-verified context for Gemini.
 */
export function formatProductContext(product: ProductCatalogEntry): string {
  const ingList = product.ingredients.map((ing) => `${ing.name} (${ing.function})`).join(", ");
  return `[PRODUCT CATALOG ENTRY - ${product.name}]:
- Name: ${product.name}
- Category: ${product.category}
- Size & Price: ${product.size}; ${product.priceDescription}
${product.bundleReference ? `- Bundle Reference: ${product.bundleReference}` : ""}
- Purpose & Benefits: ${product.purposeAndBenefits.join("; ")}
- Key Ingredients: ${ingList}
- Directions: Routine placement: ${product.directions.routinePlacement}; Frequency: ${product.directions.frequency}; Instructions: ${product.directions.instructions}
- Skin Type Suitability: ${product.skinTypeSuitability.join(", ")}
- Precautions: ${product.precautions.join("; ")}
- Compatibility with Vitamin C / other products: ${product.compatibility.notes}
- Storage & Shelf Life: ${product.storageAndShelfLife}
- Return / Replacement Rule: ${product.returnAndReplacementRules}
- Verified Disclaimer: ${product.disclaimer}
`;
}

/**
 * Generates an authoritative, structured introduction of Aura Skincare's complete product range.
 */
export function getGeneralCatalogIntroduction(): string {
  return "Aura Skincare offers four core products: Vitamin C Serum 30ml (₹699), Hydrating Sunscreen SPF 50 (₹499), Green Tea Face Wash (100ml), and Toner (100ml), also offered paired in our ORD-103 bundle for ₹850. Which product would you like to know more about?";
}

