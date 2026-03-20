"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, Camera, Shield, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/deliverables", label: "Inbox", icon: Inbox },
  { href: "/dashboard/photos", label: "Photo Studio", icon: Camera },
  { href: "/dashboard/competitors", label: "Competitors", icon: Shield },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-subtle flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-stone-200 fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-stone-200">
          <Link href="/" className="text-base font-semibold tracking-tight text-stone-900">
            Hospitality God
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500 -ml-[2px] pl-[14px]"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-brand-600" : "text-stone-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-stone-200">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors"
          >
            <Settings className="w-4 h-4 text-stone-400" />
            Settings
          </Link>
          <div className="flex items-center gap-3 px-3 py-3 mt-2">
            <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
              <span className="text-xs text-stone-500 font-medium">P</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">Property Owner</p>
              <p className="text-xs text-stone-400">Pro plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200">
        <div className="px-4 h-14 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-stone-900">Hospitality God</span>
          <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full font-medium">Pro</span>
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 w-full z-40 bg-white border-t border-stone-200">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  isActive ? "text-brand-600" : "text-stone-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-60 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-8 md:py-10 mt-14 md:mt-0 mb-20 md:mb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
