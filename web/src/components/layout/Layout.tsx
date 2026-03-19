import { Nav } from './Nav'
import { Footer } from './Footer'

interface LayoutProps {
  children: React.ReactNode
  /** Hide nav/footer for focused flows like auth or onboarding */
  minimal?: boolean
}

export function Layout({ children, minimal = false }: LayoutProps) {
  if (minimal) {
    return (
      <div className="min-h-screen flex flex-col bg-neutral-900">
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-900">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
