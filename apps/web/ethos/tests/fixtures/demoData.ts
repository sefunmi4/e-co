export interface DemoPod {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  heroImageAlt: string;
}

export interface DemoArtifact {
  id: string;
  podId: string;
  title: string;
  summary: string;
  madeBy: string;
  priceCents: number;
  currency: string;
  deliveryEstimate: string;
}

export interface CheckoutTotals {
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
}

export interface CheckoutScenario {
  successHeadline: string;
  successMessage: string;
  receiptNote: string;
  totals: CheckoutTotals;
}

export interface DemoStorefrontData {
  pods: DemoPod[];
  artifacts: DemoArtifact[];
  checkout: CheckoutScenario;
}

export const demoStorefrontData: DemoStorefrontData = {
  pods: [
    {
      id: "pod-signal-fire",
      slug: "signal-fire-studio",
      title: "Signal Fire Studio",
      subtitle: "Alex Rivers • Narrative systems lab",
      description:
        "Branching narratives, ambient scores, and interactive story prototypes produced every full moon.",
      heroImageAlt: "Flickering campfire illuminating storyboards",
    },
    {
      id: "pod-synth-garden",
      slug: "synth-garden-lab",
      title: "Synth Garden Lab",
      subtitle: "Bianca Lee • Generative soundscapes",
      description:
        "Modular patches, tactile controllers, and gentle machines tuned for sunset listening sessions.",
      heroImageAlt: "Analog synthesizers surrounded by plants",
    },
    {
      id: "pod-living-archive",
      slug: "living-archive-forge",
      title: "Living Archive Forge",
      subtitle: "Cedric Patel • Community remixes",
      description:
        "A rotating catalog of community artifacts curated for remix, preservation, and collaborative storytelling.",
      heroImageAlt: "Collage of remixed artifacts and recorded performances",
    },
  ],
  artifacts: [
    {
      id: "artifact-beacon-script",
      podId: "pod-signal-fire",
      title: "Beacon Script",
      summary: "Interactive pilot episode outline with multi-path dialogues and ambient cues.",
      madeBy: "Alex Rivers",
      priceCents: 4800,
      currency: "USD",
      deliveryEstimate: "Instant download",
    },
    {
      id: "artifact-garden-sequencer",
      podId: "pod-synth-garden",
      title: "Garden Sequencer",
      summary: "Layered spring patterns for modular rigs with printable performance notes.",
      madeBy: "Bianca Lee",
      priceCents: 3600,
      currency: "USD",
      deliveryEstimate: "Ships in 3-5 days",
    },
    {
      id: "artifact-memory-weave",
      podId: "pod-living-archive",
      title: "Memory Weave",
      summary: "Curated bundle of community submissions ready for gallery installation.",
      madeBy: "Cedric Patel",
      priceCents: 5400,
      currency: "USD",
      deliveryEstimate: "Delivery within 7 days",
    },
  ],
  checkout: {
    successHeadline: "Order confirmed",
    successMessage:
      "Your artifact is en route. A receipt and download link were sent to your studio inbox.",
    receiptNote: "We log every sale so collaborators receive instant revenue splits.",
    totals: {
      subtotalCents: 3600,
      feesCents: 180,
      totalCents: 3780,
    },
  },
};
