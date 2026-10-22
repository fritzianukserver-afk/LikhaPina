export const DEMO_STORAGE_KEY = "likhapina.next-demo.v1";

export const producers = [
  {
    slug: "aklan-loom-collective",
    name: "Aklan Loom Collective",
    location: "Kalibo",
    materials: "Pure piña · handwoven",
    capacity: "Up to 40 m / month",
    leadTime: "30–45 days",
    about:
      "A fictional Aklan weaving collective focused on handwoven piña textiles for formalwear and custom projects.",
    products: ["Pure Piña Handwoven Textile", "Custom Handwoven Piña"],
  },
  {
    slug: "kalibo-pina-works",
    name: "Kalibo Piña Works",
    location: "Kalibo",
    materials: "Piña-seda blend",
    capacity: "Up to 60 m / month",
    leadTime: "25–40 days",
    about: "A fictional workshop demonstrating blended textile sourcing and quotation workflows.",
    products: ["Piña-Seda Blend", "Piña Fabric for Barong"],
  },
  {
    slug: "banga-heritage-weavers",
    name: "Banga Heritage Weavers",
    location: "Banga",
    materials: "Pure piña · custom weave",
    capacity: "Up to 25 m / month",
    leadTime: "35–50 days",
    about: "A fictional producer profile for custom woven piña textile requests.",
    products: ["Custom Handwoven Piña", "Piña Textile for Filipiniana"],
  },
  {
    slug: "libacao-fiber-weaving",
    name: "Libacao Fiber & Weaving",
    location: "Libacao",
    materials: "Piña fiber · blended textiles",
    capacity: "Up to 35 m / month",
    leadTime: "30–45 days",
    about: "A fictional Libacao-based profile for the LikhaPiña hackathon demo.",
    products: ["Piña-Seda Blend", "Piña Textile for Filipiniana"],
  },
  {
    slug: "akean-handloom-studio",
    name: "Akean Handloom Studio",
    location: "Malinao",
    materials: "Pure piña · Filipiniana textiles",
    capacity: "Up to 20 m / month",
    leadTime: "40–55 days",
    about: "A fictional small-batch handloom profile with custom options by request.",
    products: ["Pure Piña Handwoven Textile", "Piña Fabric for Barong"],
  },
];

export const products = [
  {
    name: "Pure Piña Handwoven Textile",
    category: "Pure piña",
    description: "Natural ivory handwoven textile concept for commercial garment orders.",
    detail: "Fine handwoven texture · Barong and formalwear",
  },
  {
    name: "Piña-Seda Blend",
    category: "Piña-seda",
    description: "A piña and silk blend concept with a soft drape for special pieces.",
    detail: "Piña and silk blend · Made to requested dimensions",
  },
  {
    name: "Piña Fabric for Barong",
    category: "Formalwear",
    description: "Lightweight textile concept for barong and tailored garments.",
    detail: "Lightweight weave · Quote by quantity and finish",
  },
  {
    name: "Piña Textile for Filipiniana",
    category: "Custom weave",
    description: "A customizable textile concept for Filipiniana collections.",
    detail: "Custom dimensions · Producer confirmation required",
  },
];

export const productionStages = [
  "Order Confirmed",
  "Materials Prepared",
  "Fiber Preparation",
  "Knotting / Spinning",
  "Warping",
  "Weaving",
  "Finishing",
  "Quality Check",
  "Ready for Release",
  "Completed",
];

export type SourcingRequest = {
  id: string;
  buyer: string;
  material: string;
  blend: string;
  quantity: number;
  unit: string;
  width: string;
  length: string;
  use: string;
  budget: number;
  deadline: string;
  destination: string;
  notes: string;
  createdAt: string;
};

export type DemoQuote = {
  id: string;
  requestId: string;
  producerSlug: string;
  producer: string;
  material: string;
  quantity: number;
  unit: string;
  price: number;
  completion: string;
  terms: string;
  notes: string;
  status: "Pending" | "Accepted" | "Declined";
};

export type DemoOrder = {
  id: string;
  requestId: string;
  quoteId: string;
  buyer: string;
  producer: string;
  material: string;
  quantity: number;
  unit: string;
  price: number;
  completion: string;
  stage: number;
  createdAt: string;
};

export type DemoState = {
  requests: SourcingRequest[];
  quotes: DemoQuote[];
  orders: DemoOrder[];
};

export const initialDemoState: DemoState = {
  requests: [
    {
      id: "REQ-1001",
      buyer: "Amihan Atelier",
      material: "Pure Piña Handwoven Textile",
      blend: "Pure piña",
      quantity: 20,
      unit: "meters",
      width: "36 in",
      length: "20 m",
      use: "Barong",
      budget: 30000,
      deadline: "2026-12-15",
      destination: "Manila",
      notes: "Sample request · consistent hand feel requested.",
      createdAt: "2026-10-01T09:00:00.000Z",
    },
  ],
  quotes: [
    {
      id: "QUO-1001",
      requestId: "REQ-1001",
      producerSlug: "aklan-loom-collective",
      producer: "Aklan Loom Collective",
      material: "Pure Piña Handwoven Textile",
      quantity: 20,
      unit: "meters",
      price: 28000,
      completion: "30 days",
      terms: "50% down payment · 50% upon completion",
      notes: "Sample quotation for the video demo.",
      status: "Pending",
    },
  ],
  orders: [],
};

export function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}
