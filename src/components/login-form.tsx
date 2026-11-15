"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialLoginFormState, LOGIN_MESSAGES, type LoginFormState } from "@/lib/login-form";

/** The login form. The message stays above the form, so the link can be asked for again. */
export function LoginForm({
  action,
}: {
  action: (state: LoginFormState, formData: FormData) => Promise<LoginFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialLoginFormState);
  const fieldError = state.status === "invalid" ? LOGIN_MESSAGES.invalid : undefined;

  return (
    <div className="flex flex-col gap-5">
      {state.status === "sent" && (
        <p role="status" className="rounded-field bg-muted px-4 py-3">
          {LOGIN_MESSAGES.sent(state.sentTo)}
        </p>
      )}
      {(state.status === "limited" || state.status === "failed") && (
        <p role="alert" className="text-destructive">
          {LOGIN_MESSAGES[state.status]}
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">Почта</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            // The form is reset after every action: keep what was typed.
            defaultValue={state.email}
            placeholder="name@example.com"
            autoComplete="email"
            autoFocus
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "login-email-error" : undefined}
          />
          {fieldError && (
            <p id="login-email-error" className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Отправляю…" : "Получить ссылку"}
          </Button>
        </div>
      </form>
    </div>
  );
}
