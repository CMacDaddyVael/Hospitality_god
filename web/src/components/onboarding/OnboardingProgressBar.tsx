'use client'

type Step = {
  id: number
  label: string
}

type Props = {
  steps: Step[]
  currentStep: number
}

export function OnboardingProgressBar({ steps, currentStep }: Props) {
  return (
    <div className="px-6 py-5 border-b border-slate-700/50">
      {/* Mobile: pill progress */}
      <div className="flex sm:hidden items-center justify-center gap-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              step.id < currentStep
                ? 'bg-amber-400 w-8'
                : step.id === currentStep
                ? 'bg-amber-400 w-12'
                : 'bg-slate-700 w-4'
            }`}
          />
        ))}
      </div>

      {/* Desktop: labeled steps */}
      <div className="hidden sm:flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  step.id < currentStep
                    ? 'bg-amber-400 text-slate-900'
                    : step.id === currentStep
                    ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-400/20'
                    : 'bg-slate-800 border border-slate-700 text-slate-500'
                }`}
              >
                {step.id < currentStep ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  step.id === currentStep ? 'text-white' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-px w-20 mx-3 mb-5 transition-all duration-500 ${
                  step.id < currentStep ? 'bg-amber-400' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
