// Wording switch: the interview-prep copy (default) or the office-friendly copy.
// NEXT_PUBLIC_INTERVIEW_PREP=false → office copy. Unset or any other value → interview-prep copy.
// It is inlined at build time, so change it in Vercel and redeploy.
export const useInterviewPrepCopy = process.env.NEXT_PUBLIC_INTERVIEW_PREP !== "false";

const interviewPrep = {
  siteTitle: "PrepOS — frontend interview prep",
  siteDescription:
    "Frontend interview questions with interview-ready answers, deep explanations and clues — JavaScript, React, Next.js and everything around them.",
  answerLabel: "Interview answer",
  reviseIntro: "Just the interview answers, one per screen. Swipe up for the next one — made for the commute.",
  heroUnsolved: (total: number) => `${total} questions between you and the next interview.`,
  coreBlurb: "The three tracks most frontend interviews are built on.",
};

const office = {
  siteTitle: "PrepOS — frontend skills prep",
  siteDescription:
    "Frontend questions with model answers, deep explanations and clues — JavaScript, React, Next.js and everything around them.",
  answerLabel: "Model answer",
  reviseIntro: "Just the model answers, one per screen. Swipe up for the next one — made for the commute.",
  heroUnsolved: (total: number) => `${total} questions left to work through.`,
  coreBlurb: "The three tracks most frontend roles are built on.",
};

export const copy = useInterviewPrepCopy ? interviewPrep : office;

// Track descriptions from meta.json are replaced by these in office mode.
export const officeTrackDescriptions: Record<string, string> = {
  javascript:
    "The language under everything: scope, closures, this, prototypes, the event loop, async patterns and the polyfills people ask about most.",
  testing: "What to test and how — the testing knowledge frontend developers are expected to have.",
  backend: "Node, API design, auth and databases — enough to own the full stack.",
};
