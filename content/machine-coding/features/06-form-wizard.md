---
title: "Build a multi-step form wizard with validation and persisted progress"
level: hard
type: implement
tags: [forms, wizard, validation, zod, state-machine, localStorage, a11y]
related: [machine-coding/progress-stepper, machine-coding/otp-input, state/forms-zod-react-hook-form]
---

## Question
Build a 3-step signup wizard: Account (email, password), Profile (name, role), and Review (summary and submit).

**Must-haves**
- Next is blocked until the current step is valid; errors appear on the relevant fields.
- Back keeps entered data.
- A progress indicator shows the current step.
- Review shows all values and has a Submit button with a loading state.
- Data survives a refresh.

**Stretch goals**
- Jump back to a previous step from the review screen.
- Disable steps the user has not reached yet.
- Move focus to the step heading on change.

## Clues
- Keep one `data` object for all steps in the wizard parent, not per-step state that is lost on unmount.
- Define validation per step as a schema or function so Next can run only the current step's checks.
- Treat the current step as an index or a union (`"account" | "profile" | "review"`) and derive everything else from it.

## Interview Answer
The wizard component owns two pieces of state: `step` and a single `data` object holding every field. Each step is a small controlled component that receives its slice of `data`, an `onChange`, and its errors. Validation is declared per step (a Zod schema or a function returning an errors object); clicking Next validates only that step, stores the errors, marks fields touched, and advances only if there are none. Back never validates. Because all data lives in the parent, unmounting a step loses nothing. I persist `{ step, data }` to `localStorage` (excluding the password) in an effect and hydrate it on mount, guarding for SSR. On the review step Submit disables itself while the request runs, shows server errors, and clears the saved draft on success. For accessibility I move focus to the step heading on every transition and use `aria-current="step"` in the indicator, `aria-invalid` and `aria-describedby` on fields.

## Explanation
### Structure
```txt
Wizard (step, data, errors)
 ├─ Stepper (steps, step)           display only
 ├─ AccountStep | ProfileStep       controlled by data/onChange/errors
 └─ ReviewStep                      read-only summary + edit links
```

### Code

```tsx
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const accountSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
const profileSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  role: z.enum(["frontend", "backend", "fullstack"], { message: "Pick a role" }),
});

const steps = [
  { id: "account", label: "Account", schema: accountSchema },
  { id: "profile", label: "Profile", schema: profileSchema },
  { id: "review", label: "Review", schema: null },
] as const;

type Data = { email: string; password: string; name: string; role: string };
type Errors = Partial<Record<keyof Data, string>>;
const empty: Data = { email: "", password: "", name: "", role: "" };

export function Wizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Restore draft (never store the password)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("signup-draft") ?? "null");
      if (saved) { setData({ ...empty, ...saved.data }); setStep(saved.step ?? 0); }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const { password, ...safe } = data;
    localStorage.setItem("signup-draft", JSON.stringify({ step, data: safe }));
  }, [data, step, hydrated]);

  useEffect(() => { heading.current?.focus(); }, [step]);        // move focus on step change

  function validate(): boolean {
    const schema = steps[step].schema;
    if (!schema) return true;
    const result = schema.safeParse(data);
    if (result.success) { setErrors({}); return true; }
    const next: Errors = {};
    for (const issue of result.error.issues) next[issue.path[0] as keyof Data] ??= issue.message;
    setErrors(next);
    return false;
  }

  const next = () => validate() && setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => { setErrors({}); setStep((s) => Math.max(s - 1, 0)); };
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  async function submit() {
    setSubmitting(true);
    try {
      await fetch("/api/signup", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
      localStorage.removeItem("signup-draft");
      // navigate to success
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); step === steps.length - 1 ? submit() : next(); }} noValidate>
      <ol>
        {steps.map((s, i) => (
          <li key={s.id} aria-current={i === step ? "step" : undefined}>{s.label}</li>
        ))}
      </ol>

      <h2 ref={heading} tabIndex={-1}>{steps[step].label}</h2>

      {step === 0 && <AccountFields data={data} errors={errors} set={set} />}
      {step === 1 && <ProfileFields data={data} errors={errors} set={set} />}
      {step === 2 && <Review data={data} goTo={setStep} />}

      <button type="button" onClick={back} disabled={step === 0}>Back</button>
      <button type="submit" disabled={submitting}>
        {step === steps.length - 1 ? (submitting ? "Submitting…" : "Submit") : "Next"}
      </button>
    </form>
  );
}
```

`AccountFields` and similar components are plain controlled inputs; each shows `errors.field` with `aria-invalid` and `aria-describedby`. Because the password is not persisted, a restored draft that reaches the review step must ask for it again (or keep password only in the first step).

### Design choices
- **Single source of truth for data:** step components unmount, so local state would reset.
- **Per-step validation:** validating the whole schema would show errors for steps the user has not reached.
- **Final validation:** re-validate everything on submit, and again on the server; client checks are a convenience.
- **Step as state machine:** conditional steps (skip Profile for existing users) are easier when transitions are a function `nextStep(step, data)` instead of `step + 1`.
- **Libraries:** React Hook Form with one `useForm` provider across steps plus `trigger(fieldNames)` validates the current step's fields.
- **URL per step:** storing the step in the URL (`?step=2`) makes the back button and refresh work naturally.
- **Sensitive data:** never persist passwords or card numbers to `localStorage`.

## Follow-ups
- **How do you prevent users from jumping ahead via the URL?** — Validate earlier steps on load and redirect to the first invalid one.
- **How would you handle async validation (username taken)?** — Debounced check on blur, with a pending state that blocks Next until it settles.

## Common Mistakes
- Keeping each step's state inside the step component.
- Validating on every keystroke before the user has finished typing.
- Storing secrets in `localStorage`.

## Tips
- Call out the three decisions: lifted data, per-step schema, focus management.
