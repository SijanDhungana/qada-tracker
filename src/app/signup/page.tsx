import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export const runtime = "nodejs";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Username and password — that's all we need."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
