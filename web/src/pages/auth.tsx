import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandLink } from "../components/brand";
import { Badge, Button, Card, Field, Input } from "../components/ui";
import { signIn, signUp } from "../lib/auth";
import { errorMessage } from "../lib/api";

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signUpMode = mode === "sign-up";
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from?.startsWith("/app")
      ? (location.state as { from: string }).from
      : "/app";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = signUpMode
        ? await signUp.email({ name: name.trim(), email: email.trim(), password })
        : await signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message || "Unable to authenticate");
        return;
      }
      navigate(from, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, "Unable to authenticate"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page grid min-h-screen place-items-center p-5">
      <Card className="w-full max-w-md p-7">
        <BrandLink className="mb-8" to="/" />
        <Badge tone="accent">{signUpMode ? "Create account" : "Welcome back"}</Badge>
        <h1 className="mt-4 text-2xl font-semibold">
          {signUpMode ? "Start your workspace" : "Sign in to Mindvault"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {signUpMode
            ? "Create an account with email and password. Invitations only work for registered users."
            : "Use your email and password to return to your projects."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {signUpMode ? (
            <Field label="Name">
              <Input
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
          ) : null}
          <Field label="Email">
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          <Field label="Password">
            <Input
              autoComplete={signUpMode ? "new-password" : "current-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </Field>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full" disabled={pending} type="submit">
            {pending ? "Please wait..." : signUpMode ? "Create account" : "Sign in"}
          </Button>
        </form>
        <Link
          className="mt-7 inline-block text-sm text-orange-300 hover:text-orange-200"
          to={signUpMode ? "/sign-in" : "/sign-up"}
        >
          {signUpMode ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </Link>
      </Card>
    </main>
  );
}
