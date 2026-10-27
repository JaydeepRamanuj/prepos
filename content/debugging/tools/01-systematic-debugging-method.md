---
title: "Walk me through how you debug a bug you have never seen before"
level: easy
type: concept
tags: [debugging-method, git-bisect, reproduction, binary-search]
related: [debugging/chrome-devtools-beyond-console-log, debugging/production-error-debugging, scenarios/production-errors-cannot-reproduce]
---

## Question
A ticket says: "The checkout button sometimes does nothing." You have never touched this code. How do you go from that sentence to a fix? Describe your method, not a specific tool.

## Interview Answer
I follow a loop: reproduce, isolate, hypothesize, verify. First I make the bug happen on demand, because a bug I cannot reproduce is a bug I cannot prove I fixed — I pin down the exact steps, browser, account and data. Then I shrink the search space: binary search over code paths, inputs or commits — if it worked last week, `git bisect` finds the breaking commit in a handful of steps. Once the area is small, I form one specific, falsifiable hypothesis ("the click handler returns early because `cart` is still loading") and test it with a breakpoint or a log, changing one thing at a time. Finally I write a test that fails before the fix and passes after, check nearby code for the same pattern, and note the root cause in the PR.

## Explanation
### The loop

```txt
reproduce ──▶ isolate ──▶ hypothesize ──▶ verify ──▶ fix + regression test
    ▲                          │
    └──── hypothesis wrong ◀───┘   (go back with what you learned)
```

**1. Reproduce.** Turn "sometimes" into "always, when…". Ask for the URL, browser, user role, time, and a screen recording. Try a slow network (DevTools throttling), a fresh account, an empty cart. Intermittent bugs usually hide a variable you have not controlled yet: timing, data, cache, or environment.

**2. Isolate.** Cut the problem in half repeatedly instead of reading everything:
- *Code:* comment out half the component tree, or put a breakpoint midway through the flow — is the state already wrong there?
- *Input:* does it happen with one cart item? With zero coupons?
- *Time:* if there is a known good version, bisect the history.

```bash
git bisect start
git bisect bad                 # current commit is broken
git bisect good v2.3.0         # this tag worked
# git checks out a commit halfway; test it, then:
git bisect good                # or: git bisect bad
# ...repeat ~log2(N) times until git prints the first bad commit
git bisect reset
```

With 500 commits between good and bad, that is about 9 checks. If you can script the check, `git bisect run npm test -- checkout` automates it.

**3. Hypothesize.** Write the hypothesis down as a sentence that could be false. "Something is wrong with state" is not testable; "`isSubmitting` stays `true` after a failed request because the `finally` is missing" is.

**4. Verify.** Change one variable, observe. Breakpoint, conditional logpoint, or a temporary `console.log` with a unique prefix. If the result surprises you, your mental model is wrong — that is progress.

**5. Fix and protect.** Fix the root cause, not the symptom (a `setTimeout` that "fixes" a race is a symptom fix). Add a regression test and grep for the same pattern elsewhere.

### Habits that speed this up
- **Read the actual error** — full message, stack trace, Network response body. Many "mysteries" are spelled out in a 400 response.
- **Check what changed** — deploy, dependency bump, feature flag, backend release, browser update.
- **Rubber-duck it** — explaining the flow step by step often exposes the wrong assumption.

## Follow-ups
- **What if you cannot reproduce it at all?** — Add instrumentation (structured logs, error monitoring breadcrumbs, session replay) around the suspected path, ship it, and let production reproduce it for you.
- **When would `git bisect` not help?** — When there is no known good commit, or the bug depends on data/backend changes rather than your code; then bisect over data or config instead.
- **How do you avoid "fixing" the wrong thing?** — Prove the hypothesis first: the bug must disappear when you change exactly that one thing, and come back when you revert it.

## Common Mistakes
- Changing several things at once, so you never learn which change mattered.
- Jumping to a fix before reproducing, then declaring victory because it did not happen once.
- Reading the whole codebase top to bottom instead of bisecting the search space.
- Ignoring the Network tab and the exact error text.

## Tips
- Name the four steps out loud — "reproduce, isolate, hypothesize, verify" — interviewers are listening for a method, not a tool.
- Mention `git bisect` with a number ("500 commits is about 9 checks"); it shows you think in binary search.
