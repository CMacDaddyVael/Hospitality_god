"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, Camera, Shield, Settings, Building2, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/deliverables", label: "Inbox", icon: Inbox },
  { href: "/dashboard/optimization", label: "Optimization", icon: TrendingUp },
  { href: "/dashboard/photos", label: "Photo Studio", icon: Camera },
  { href: "/dashboard/competitors", label: "Competitors", icon: Shield },
  { href: "/dashboard/properties", label: "Properties", icon: Building2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-stone-950 fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-5">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <span className="text-[15px] font-heading font-semibold text-white/90 group-hover:text-white transition">
              Hospitality God
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <p className="px-3 pt-3 pb-2 text-[10px] font-medium text-white/30 uppercase tracking-[0.15em]">
            Marketing
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                }`}
              >
                <Icon className={`w-[15px] h-[15px] ${isActive ? "text-brand-400" : "text-white/30"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
          >
            <Settings className="w-[15px] h-[15px]" />
            Settings
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-3 mt-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">P</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white/80 truncate">Property Owner</p>
              <p className="text-[10px] text-white/30">Pro · $49/mo</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 w-full z-40 bg-stone-950/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">H</span>
            </div>
            <span className="text-sm font-heading font-semibold text-white/90">Hospitality God</span>
          </div>
          <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full font-medium">Pro</span>
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 w-full z-40 bg-stone-950 border-t border-white/[0.06] safe-area-bottom">
        <div className="flex">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  isActive ? "text-brand-400" : "text-white/30"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-[220px] min-h-screen">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 md:py-10 mt-14 md:mt-0 mb-20 md:mb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
