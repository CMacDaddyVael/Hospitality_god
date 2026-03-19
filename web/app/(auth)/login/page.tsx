import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
          Start free trial
        </Link>
      </p>
    </>
  );
}
