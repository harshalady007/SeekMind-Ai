import type { SearchResult } from "@/lib/core/types";

/**
 * Deterministic fixture corpus for demo mode and automated tests.
 * All URLs point at real, stable domains but the snippets are original
 * fixture text — the demo badge makes clear none of this came from a live
 * search.
 */

export interface FixtureTopic {
  /** Keywords that map a query onto this topic. */
  keywords: string[];
  results: SearchResult[];
}

const now = () => new Date();
const daysAgo = (n: number) =>
  new Date(now().getTime() - n * 24 * 60 * 60 * 1000).toISOString();

export const FIXTURE_TOPICS: FixtureTopic[] = [
  {
    keywords: ["solid", "state", "battery", "batteries", "ev", "electric"],
    results: [
      {
        url: "https://www.nature.com/articles/d41586-demo-solid-state",
        title: "Solid-state batteries edge closer to commercial electric vehicles",
        snippet:
          "Manufacturers report pilot production lines for sulfide-electrolyte cells with energy densities near 400 Wh/kg, though scaling separator manufacturing remains the key bottleneck.",
        content:
          "Solid-state batteries replace the flammable liquid electrolyte of lithium-ion cells with a solid conductor. Pilot lines announced this year target energy densities of 350–450 Wh/kg, roughly 1.5x today's best packs. Remaining hurdles include stack pressure management, dendrite suppression at fast-charge rates, and the cost of sulfide electrolyte synthesis. Analysts caution that announced timelines have historically slipped by 2–3 years.",
        providerScore: 0.93,
        publishedAt: daysAgo(12),
        author: "Fixture Desk",
      },
      {
        url: "https://arxiv.org/abs/2405.00001",
        title:
          "Interface engineering for sulfide solid electrolytes: a systematic review",
        snippet:
          "Preprint reviewing 214 studies of cathode-electrolyte interface coatings; halide interlayers show the most consistent cycle-life gains.",
        content:
          "This preprint (not yet peer reviewed) aggregates 214 experimental studies on interfacial degradation in sulfide-based solid-state cells. Halide interlayers improved capacity retention by a median of 18% over 500 cycles. The authors note publication bias toward positive results and call for standardized cycling protocols.",
        providerScore: 0.88,
        publishedAt: daysAgo(90),
        author: "L. Chen, R. Okafor",
      },
      {
        url: "https://www.energy.gov/eere/vehicles/demo-battery-research",
        title: "DOE overview: next-generation battery research programs",
        snippet:
          "Federal program summary covering solid-state, lithium-sulfur, and sodium-ion chemistries with funding milestones through 2028.",
        content:
          "The Department of Energy's vehicle technologies office funds pre-competitive research in solid-state architectures. Program goals: $60/kWh pack cost, 500 Wh/kg by 2030. Current solid-state demonstrations in national labs reach 350 Wh/kg at C/3 discharge over 600 cycles.",
        providerScore: 0.85,
        publishedAt: daysAgo(200),
        author: null,
      },
      {
        url: "https://www.reuters.com/business/autos-transportation/demo-ssb-plant",
        title: "Automaker breaks ground on solid-state battery pilot plant",
        snippet:
          "The plant is slated to produce sample cells for fleet validation in 2027; executives declined to confirm mass-production dates.",
        content:
          "Construction began on a pilot facility intended to produce solid-state sample cells for vehicle validation. The company said sample deliveries to fleet partners are planned for 2027, with mass production 'toward the end of the decade'. Industry analysts note that pilot-to-mass-production transitions for new cell chemistries typically take four to six years.",
        providerScore: 0.82,
        publishedAt: daysAgo(3),
        author: "Fixture Newswire",
      },
      {
        url: "https://spectrum.ieee.org/demo-solid-state-reality-check",
        title: "A reality check on solid-state battery timelines",
        snippet:
          "Engineering analysis of why solid-state cells remain hard to manufacture at scale despite strong lab results.",
        content:
          "Lab cells routinely hit impressive numbers, but manufacturing yield is the quiet obstacle: solid electrolyte layers must be defect-free at thicknesses under 30 micrometers across meters of web. Current pilot yields are estimated well below the 90%+ needed for cost parity. Dry-room requirements for sulfides add further capital cost.",
        providerScore: 0.8,
        publishedAt: daysAgo(45),
        author: "Fixture Engineering Desk",
      },
    ],
  },
  {
    keywords: ["sleep", "memory", "consolidation", "brain", "learning"],
    results: [
      {
        url: "https://pubmed.ncbi.nlm.nih.gov/00000001/",
        title: "Slow-wave sleep and declarative memory consolidation: a meta-analysis",
        snippet:
          "Meta-analysis of 61 studies finds a moderate positive association between slow-wave sleep duration and next-day declarative recall.",
        content:
          "Across 61 controlled studies (n=3,412), slow-wave sleep duration correlated with declarative memory retention (pooled r = 0.31, 95% CI 0.24–0.38). Effects were strongest for hippocampus-dependent tasks. Heterogeneity was substantial; targeted memory reactivation studies showed the largest effects.",
        providerScore: 0.94,
        publishedAt: daysAgo(400),
        author: "M. Ito, S. Fernandez",
      },
      {
        url: "https://www.nih.gov/news-events/demo-sleep-memory",
        title: "How sleep supports learning and memory",
        snippet:
          "NIH overview: memory traces are replayed and redistributed from hippocampus to cortex during deep sleep.",
        content:
          "During slow-wave sleep, coordinated hippocampal sharp-wave ripples, thalamocortical spindles, and cortical slow oscillations replay recent experience, gradually transferring memories into cortical networks. REM sleep appears more important for emotional and procedural memory. Total sleep deprivation after learning reduces retention substantially in most paradigms.",
        providerScore: 0.9,
        publishedAt: daysAgo(700),
        author: null,
      },
      {
        url: "https://www.science.org/doi/10.1126/science.demo.sleep",
        title: "Targeted memory reactivation strengthens specific memories during sleep",
        snippet:
          "Replaying learning-associated audio cues during slow-wave sleep improved recall of cued items by ~10% versus uncued items.",
        content:
          "In a within-subject design (n=58), sound cues associated with specific learned items were replayed during slow-wave sleep. Cued items were recalled better than matched uncued items (d = 0.42). The effect vanished when cues were played during wake, supporting a causal role for sleep replay.",
        providerScore: 0.88,
        publishedAt: daysAgo(900),
        author: "K. Aldous et al.",
      },
      {
        url: "https://en.wikipedia.org/wiki/Memory_consolidation",
        title: "Memory consolidation",
        snippet:
          "Overview of synaptic and systems consolidation, including the active systems consolidation hypothesis and synaptic homeostasis hypothesis.",
        content:
          "Memory consolidation spans synaptic consolidation (hours) and systems consolidation (weeks to years). The active systems consolidation hypothesis holds that sleep replay redistributes memories to neocortex; the synaptic homeostasis hypothesis proposes sleep globally downscales synapses, improving signal-to-noise. These accounts are increasingly seen as complementary.",
        providerScore: 0.78,
        publishedAt: daysAgo(60),
        author: null,
      },
    ],
  },
  {
    keywords: ["typescript", "javascript", "type", "types", "strict", "adoption"],
    results: [
      {
        url: "https://www.typescriptlang.org/docs/handbook/demo-strictness",
        title: "TypeScript handbook: strictness flags",
        snippet:
          "Official documentation of strict mode: strictNullChecks, noImplicitAny, noUncheckedIndexedAccess and their trade-offs.",
        content:
          "The strict family of compiler flags turns on the most valuable checks. strictNullChecks removes null/undefined from every type unless stated; noUncheckedIndexedAccess adds undefined to index signatures. Teams migrating large codebases typically enable flags incrementally per directory.",
        providerScore: 0.92,
        publishedAt: daysAgo(150),
        author: null,
      },
      {
        url: "https://github.blog/demo-octoverse-typescript",
        title: "Language trends: TypeScript continues multi-year growth",
        snippet:
          "Annual report data shows TypeScript among the fastest-growing major languages by contributor count for the fifth straight year.",
        content:
          "Repository and contributor statistics show sustained TypeScript growth, driven by frontend frameworks that ship TS-first APIs and by backend adoption via Node.js. Survey respondents cite refactoring safety and editor tooling as primary motivations; build complexity remains the top complaint.",
        providerScore: 0.86,
        publishedAt: daysAgo(120),
        author: "Fixture Data Team",
      },
      {
        url: "https://stackoverflow.blog/demo-dev-survey-typescript",
        title: "Developer survey: TypeScript satisfaction and usage",
        snippet:
          "TypeScript ranks in the top five 'admired' languages; usage among professional web developers exceeds two-thirds.",
        content:
          "In the latest developer survey, a majority of professional web developers report using TypeScript in production. Satisfaction ('admired') scores place it above JavaScript. Respondents in large organizations report the highest adoption, citing maintainability of shared codebases.",
        providerScore: 0.83,
        publishedAt: daysAgo(240),
        author: null,
      },
      {
        url: "https://effectivetypescript.com/demo-migration-guide",
        title: "Migrating to strict TypeScript: an incremental playbook",
        snippet:
          "Practical strategies: enable flags per-package, use // @ts-expect-error budgets, and burn down suppressions with CI ratchets.",
        content:
          "Successful strict-mode migrations share a pattern: turn on one flag at a time, fail CI only for new violations (ratcheting), and track suppression counts as a burn-down metric. Codemods handle mechanical fixes; the long tail is API boundary types.",
        providerScore: 0.79,
        publishedAt: daysAgo(300),
        author: "Fixture Author",
      },
    ],
  },
  {
    keywords: ["coral", "reef", "bleaching", "ocean", "climate", "marine"],
    results: [
      {
        url: "https://www.noaa.gov/demo-coral-bleaching-status",
        title: "Global coral bleaching event status update",
        snippet:
          "Monitoring shows heat stress sufficient to cause bleaching across large parts of three ocean basins in the past year.",
        content:
          "Satellite sea-surface temperature monitoring confirms bleaching-level heat stress across the tropical Atlantic, Pacific, and Indian Ocean basins. Bleaching does not equal mortality: recovery is possible if temperatures fall quickly, but repeat events shorten recovery windows. Reef restoration programs are scaling heat-tolerant coral propagation.",
        providerScore: 0.95,
        publishedAt: daysAgo(8),
        author: null,
      },
      {
        url: "https://www.nature.com/articles/demo-reef-adaptation",
        title: "Assisted evolution shows promise for heat-tolerant corals",
        snippet:
          "Field trials of selectively bred corals show 30–40% higher survival under thermal stress, with open questions about genetic diversity.",
        content:
          "Selective breeding and assisted gene flow produced coral colonies with markedly higher survival in thermal stress trials. Ecologists caution that scaling from thousands to millions of colonies remains unsolved, and warn against narrowing genetic diversity. Combining restoration with emissions reduction is described as essential by all cited researchers.",
        providerScore: 0.89,
        publishedAt: daysAgo(30),
        author: "Fixture Science Desk",
      },
      {
        url: "https://www.bbc.com/news/demo-reef-report",
        title: "Reef survey finds patchy recovery after mass bleaching",
        snippet:
          "Long-term monitoring shows fast-growing corals rebounding in sheltered areas while slow-growing reef builders continue to decline.",
        content:
          "Annual survey data across 120 reef sites shows a mixed picture: branching Acropora recovering strongly at about a third of sites, while massive slow-growing species — which give reefs long-term structure — continue a two-decade decline. Scientists say headline coral-cover numbers can mask this compositional shift.",
        providerScore: 0.84,
        publishedAt: daysAgo(2),
        author: "Fixture Correspondent",
      },
      {
        url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.demo",
        title:
          "Local stressor reduction and coral resilience: evidence from marine protected areas",
        snippet:
          "Reefs in well-enforced protected areas recovered coral cover ~1.8x faster after bleaching than comparable unprotected reefs.",
        content:
          "Comparing 64 matched reef pairs, reefs inside well-enforced marine protected areas recovered coral cover significantly faster following bleaching events (median 1.8x). Water quality and herbivorous fish biomass were the strongest mediators. Authors note protection does not prevent bleaching itself.",
        providerScore: 0.81,
        publishedAt: daysAgo(180),
        author: "A. Ramos et al.",
      },
    ],
  },
];

export const GENERIC_RESULTS: SearchResult[] = [
  {
    url: "https://en.wikipedia.org/wiki/Demo_topic_overview",
    title: "Overview and background (demo fixture)",
    snippet:
      "General reference entry summarizing the topic's definitions, history, and major viewpoints for demo purposes.",
    content:
      "This demo fixture stands in for a general reference article. It outlines the topic's core definitions, historical development, primary debates, and commonly cited statistics, suitable for grounding an introductory answer.",
    providerScore: 0.8,
    publishedAt: daysAgo(100),
    author: null,
  },
  {
    url: "https://www.reuters.com/demo-topic-report",
    title: "Recent reporting on the topic (demo fixture)",
    snippet: "Wire-service style report covering the latest developments and reactions.",
    content:
      "This demo fixture stands in for recent news coverage: what changed recently, who is affected, and what officials and independent experts said in response. Figures in demo answers derive only from fixture text.",
    providerScore: 0.75,
    publishedAt: daysAgo(1),
    author: "Fixture Newswire",
  },
  {
    url: "https://www.brookings.edu/demo-topic-analysis",
    title: "In-depth analysis and policy context (demo fixture)",
    snippet:
      "Think-tank style analysis discussing trade-offs, stakeholders, and open questions.",
    content:
      "This demo fixture stands in for long-form analysis: the main schools of thought, areas of expert agreement and disagreement, and the evidence gaps a careful answer should acknowledge.",
    providerScore: 0.72,
    publishedAt: daysAgo(40),
    author: "Fixture Analyst",
  },
  {
    url: "https://arxiv.org/abs/2501.99999",
    title: "Related academic preprint (demo fixture)",
    snippet:
      "Preprint offering quantitative evidence relevant to the query; not yet peer reviewed.",
    content:
      "This demo fixture stands in for an academic preprint with quantitative findings relevant to the question. As a preprint it has not completed peer review, which a careful answer should mention when citing it.",
    providerScore: 0.7,
    publishedAt: daysAgo(60),
    author: "Fixture Researcher",
  },
];

/** Example searches surfaced on the landing page (all have rich fixtures). */
export const EXAMPLE_QUERIES = [
  "How close are solid-state batteries to powering mass-market EVs?",
  "What does sleep research say about memory consolidation?",
  "Why are teams adopting strict TypeScript, and what does migration cost?",
  "What is the current state of coral reef bleaching and recovery?",
] as const;
