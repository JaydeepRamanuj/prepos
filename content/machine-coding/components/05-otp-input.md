---
title: "Build an OTP input with auto-advance, paste support and smart backspace"
level: hard
type: implement
tags: [otp, refs, focus-management, paste, keyboard, forms]
related: [machine-coding/star-rating, machine-coding/form-wizard]
---

## Question
Build an `OtpInput` component — the 6-box code entry you see on every Indian banking and UPI app.

**Must-haves**
- `length` boxes (default 6), each accepting a single digit.
- Typing a digit moves focus to the next box.
- Backspace on a filled box clears it; Backspace on an empty box moves to the previous box and clears it.
- Pasting "123456" into any box fills all boxes from that position.
- Calls `onComplete(code)` when all boxes are filled.

**Stretch goals**
- Arrow Left/Right move between boxes.
- Work with SMS autofill on mobile (`autocomplete="one-time-code"`).
- A resend timer ("Resend OTP in 30s").

```tsx
<OtpInput length={6} onComplete={(code) => verify(code)} />
```

## Clues
- Store the digits as an array of strings, one per box, and keep an array of refs to the input elements so you can call `.focus()` on any index.
- Handle typing in `onChange`, but handle Backspace and arrows in `onKeyDown` — `onChange` does not fire when you press Backspace on an already empty input.
- For paste, `preventDefault()` the paste event, read `e.clipboardData.getData("text")`, strip non-digits, and write the characters starting at the current index.

## Interview Answer
My state is `values: string[]` of length `length`, one digit per box, plus an array of refs to the inputs for focus management. In `onChange` I take only the last typed character, reject non-digits, update that index and focus the next box. Backspace has to be in `onKeyDown`, because when a box is already empty there is no change event — so if the box has a value I clear it, otherwise I move to the previous box and clear that. Paste is handled in `onPaste`: I prevent the default, sanitise the clipboard text to digits, and spread them across the boxes from the current index, then focus the box after the last filled one. When every box has a digit I call `onComplete` with the joined string. Each input gets `inputMode="numeric"`, an `aria-label` like "Digit 3 of 6", and the first one gets `autoComplete="one-time-code"` for SMS autofill.

## Explanation
### State and refs
```txt
values:  ["4", "2", "", "", "", ""]
refs:    [inp0, inp1, inp2, inp3, inp4, inp5]
                     ▲ focus here next
```

Why an array instead of a single string? Each box has its own slot; a string like `"42"` cannot represent "box 4 is filled but box 3 is empty" (which happens when a user clicks a later box and types). The final code is `values.join("")`.

Refs are an array (`useRef<(HTMLInputElement | null)[]>([])`) filled with callback refs — you need imperative `.focus()`, which state cannot do.

### Complete code

```tsx
// OtpInput.tsx
import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";

type Props = {
  length?: number;
  onComplete?: (code: string) => void;
  disabled?: boolean;
};

export function OtpInput({ length = 6, onComplete, disabled = false }: Props) {
  const [values, setValues] = useState<string[]>(() => Array(length).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focusAt = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select(); // so typing over a filled box replaces it
  };

  // Single place that writes state and checks completion
  function update(next: string[]) {
    setValues(next);
    if (next.every((v) => v !== "")) onComplete?.(next.join(""));
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    // Mobile autofill can insert the whole code into one box
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) return; // ignore letters, keep the old value
    if (digits.length > 1 && digits.length >= length) {
      fillFrom(0, digits);
      return;
    }
    const next = [...values];
    next[i] = digits[digits.length - 1]; // last typed char wins
    update(next);
    if (i < length - 1) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...values];
      if (next[i]) {
        next[i] = ""; // clear current box, stay here
      } else if (i > 0) {
        next[i - 1] = ""; // empty box: go back and clear previous
        focusAt(i - 1);
      }
      setValues(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function fillFrom(start: number, digits: string) {
    const next = [...values];
    let last = start;
    for (let k = 0; k < digits.length && start + k < length; k++) {
      next[start + k] = digits[k];
      last = start + k;
    }
    update(next);
    focusAt(last + 1 < length ? last + 1 : last);
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault(); // stop the browser inserting the whole string into one box
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (digits) fillFrom(i, digits);
  }

  return (
    <fieldset style={{ border: 0, padding: 0 }} disabled={disabled}>
      <legend>Enter the {length}-digit code sent to your phone</legend>
      <div style={{ display: "flex", gap: 8 }}>
        {values.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={v}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1} of ${length}`}
            style={{ width: 40, height: 48, textAlign: "center", fontSize: 20 }}
          />
        ))}
      </div>
    </fieldset>
  );
}
```

```tsx
// App.tsx
import { useState } from "react";
import { OtpInput } from "./OtpInput";

export default function App() {
  const [status, setStatus] = useState("");
  return (
    <div style={{ padding: 24 }}>
      <OtpInput onComplete={(code) => setStatus(code === "123456" ? "Verified" : "Wrong code")} />
      <p role="status">{status}</p>
    </div>
  );
}
```

Note there is no `maxLength={1}`. With `maxLength=1`, typing into an already filled box is blocked by the browser, so overwrite fails; instead we accept any input and keep only the last digit. Autofill on Android/iOS may drop the full code into the first box, which `handleChange` detects and spreads.

### Why Backspace lives in `onKeyDown`
```txt
box has "5", press Backspace → value becomes "" → onChange fires ✓
box is "",  press Backspace → value stays "" → NO onChange ✗
```
So the "move back" behaviour can only be implemented on `keydown`. Once you handle Backspace there, `preventDefault` it so the two handlers don't both act.

### Accessibility
- A `<fieldset>` + `<legend>` gives the group one announced label.
- Each box: `aria-label="Digit 3 of 6"`.
- `inputMode="numeric"` shows the number pad on mobile without the quirks of `type="number"` (spinners, `e` allowed, leading zeros stripped).
- Announce success/failure with `role="status"`.
- Some teams prefer one real `<input maxLength={6}>` visually styled as boxes — simpler for screen readers and autofill. Mention it as an alternative.

### Edge cases
| Case | Handling |
|---|---|
| Letter typed | Regex strips it; value unchanged |
| Paste "12-34 56" | Non-digits stripped → "123456" |
| Paste longer than remaining boxes | Loop stops at `length` |
| Click box 4 and type | Works; completion only fires when *all* boxes filled |
| Typing over a filled box | `select()` on focus + "last char wins" replaces it |
| `onComplete` firing twice | Only fires from `update`, which runs once per change |

### Stretch: resend timer
Keep `secondsLeft` in state, start a 1s `setInterval` in an effect with cleanup, disable the "Resend" button while `secondsLeft > 0`, and reset it to 30 on click. See the countdown question for drift-free timing.

## Follow-ups
- **Why not `type="number"`?** — It allows `e`, `+`, `-`, shows spinners, and `maxLength` is ignored on number inputs. `inputMode="numeric"` with a text input is the standard choice.
- **How does SMS autofill work on the web?** — `autocomplete="one-time-code"` lets iOS Safari and Android suggest the code from an incoming SMS; the WebOTP API (`navigator.credentials.get({ otp })`) can read it programmatically on supported Chromium browsers.
- **How would you make it controlled?** — Accept `value: string` and `onChange(value: string)`, derive the boxes with `value.padEnd(length).split("")`, and keep only refs internally.
- **How would you test it?** — React Testing Library + `user-event`: `user.type`, `user.keyboard("{Backspace}")`, `user.paste("123456")`, and assert focus with `toHaveFocus()`.

## Common Mistakes
- Handling Backspace only in `onChange`, so you can't go back from an empty box.
- Using `maxLength={1}`, which prevents overwriting a filled box.
- Not calling `preventDefault` on paste, so the full string lands in one box.
- Reading the new values from state right after `setValues` to check completion — state is not updated yet; compute from the `next` array.

## Tips
- Explain the three handlers by job: **onChange types, onKeyDown deletes and navigates, onPaste spreads**.
- Mention that you tested on mobile mindset — `inputMode`, `one-time-code` autofill — it shows real product experience, which Indian fintech interviewers love.
