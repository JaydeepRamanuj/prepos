---
title: "Which Chrome DevTools features do you use besides console.log?"
level: medium
type: concept
tags: [devtools, breakpoints, network, performance, memory]
related: [debugging/systematic-debugging-method, debugging/react-devtools-profiler, debugging/memory-leak-uncleared-subscription]
---

## Question
Many developers debug only with `console.log`. Which Chrome DevTools features do you actually use, and when would you pick each one?

## Interview Answer
I pick the panel by the kind of question I have. For "why is this value wrong" I use the Sources panel: line breakpoints, conditional breakpoints so I stop only for the bad item, and logpoints, which log without editing code. For "who changed this DOM node" I set a DOM breakpoint on subtree or attribute modifications, and for "who sent this request" I use the Network panel's Initiator column or a fetch/XHR breakpoint. For "why is it slow" I record in the Performance panel with CPU throttling and look for long tasks in the flame chart. For "why does memory keep growing" I take two heap snapshots in the Memory panel and compare them, filtering for detached DOM nodes.

## Explanation
### Sources panel: pause instead of print
| Tool | How | Use it when |
|---|---|---|
| Line breakpoint | Click the line number | You want to inspect scope, `this`, the call stack at one point |
| Conditional breakpoint | Right-click line → *Add conditional breakpoint* → `item.id === 42` | The code runs 1,000 times but only one case is wrong |
| Logpoint | Right-click → *Add logpoint* → `'price', item.price` | You want a log without editing, rebuilding or committing it |
| `debugger;` statement | In code | Quick pause in a dev build |
| Event listener breakpoints | Sidebar → *Event Listener Breakpoints* → `click` | You don't know which handler runs on click |
| XHR/fetch breakpoints | Sidebar → *XHR/fetch Breakpoints* → URL contains `/api/cart` | Find the code that sends a request |
| Pause on exceptions | Sidebar toggle (optionally caught ones too) | An error is swallowed by a `try/catch` somewhere |

While paused, the **Scope** pane shows closures (great for stale-closure bugs), the **Call Stack** shows how you got here, and you can edit values in the console in the current scope. Add noisy library code to the **ignore list** so stepping skips `node_modules`.

### Elements panel: DOM breakpoints
Right-click a node → *Break on* → **subtree modifications**, **attribute modifications**, or **node removal**. The debugger stops on the exact JS line that changed it — ideal for "some script keeps adding `display: none`".

### Network panel
- **Preserve log** — keep requests across redirects and reloads.
- **Disable cache** — rule out stale assets (only while DevTools is open).
- **Throttling** — reproduce races and loading states on "Slow 4G".
- **Initiator** column — the call stack that triggered a request.
- **Right-click → Copy as cURL / fetch** — replay a request outside the app to tell frontend bugs from backend ones.
- **Block request URL** — test how the app behaves when a script or API fails.
- Check the **Headers** (status, CORS headers, cache headers) and **Response** before blaming your code.

### Performance panel
Record an interaction with CPU throttling (4× or 6×) to simulate a mid-range phone. In the flame chart, long tasks (over 50 ms) are flagged; wide bars are the expensive functions. Look for repeated purple *Layout* blocks after style reads — that is layout thrashing.

### Memory panel
1. Take a heap snapshot.
2. Perform the suspect action several times (open and close a modal).
3. Take another snapshot, switch to **Comparison** view, sort by *# Delta*.
4. Filter for `Detached` to find DOM nodes removed from the page but still referenced from JS. The **Retainers** pane shows who holds them.

## Follow-ups
- **What is the difference between a logpoint and `console.log`?** — Same output, but a logpoint lives in DevTools: no code change, no rebuild, no risk of committing it, and it works on production code with source maps.
- **How do you debug code that runs on page load before you can set a breakpoint?** — Set the breakpoint and reload (breakpoints persist), or use *Event Listener Breakpoints → Script → first statement*.
- **How do you debug a minified production bundle?** — Use source maps if available; otherwise *pretty print* (`{}`) in Sources still lets you set breakpoints.

## Common Mistakes
- Leaving "Disable cache" on and then being confused that production caching "doesn't work".
- Profiling on a fast laptop without CPU throttling and concluding there is no problem.
- Taking a single heap snapshot; leaks only show up in a comparison over repeated actions.

## Tips
- Frame the answer as "question → panel", not a list of features. It shows judgment.
- Mention conditional breakpoints and DOM breakpoints by name — most candidates don't, and they are the fastest wins.
