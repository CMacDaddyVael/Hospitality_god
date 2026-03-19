import { SignupForm } from "@/components/auth/SignupForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Start your free trial</h2>
        <p className="text-gray-500 text-sm mt-1">
          No credit card required. Set up in 2 minutes.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
