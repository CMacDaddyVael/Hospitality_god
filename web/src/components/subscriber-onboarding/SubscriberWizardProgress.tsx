'use client'

type Step = {
  id: number
  label: string
  description: string
}

type Props = {
  steps: Step[]
  currentStep: number
}

export function SubscriberWizardProgress({ steps, currentStep }: Props) {
  return (
    <div className="px-6 py-5 border-b border-slate-700/50">
      {/* Mobile: dots */}
      <div className="flex md:hidden items-center justify-center gap-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`h-2 rounded-full transition-all duration-300 ${
              step.id < currentStep
                ? 'bg-amber-400 w-6'
                : step.id === currentStep
                ? 'bg-amber-400 w-8'
                : 'bg-slate-600 w-2'
            }`}
          />
        ))}
      </div>

      {/* Desktop: labeled steps */}
      <div className="hidden md:flex items-center justify-center gap-0">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  step.id < currentStep
                    ? 'bg-amber-400 text-slate-900'
                    : step.id === currentStep
                    ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-400/20'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {step.id < currentStep ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <div className="mt-2 text-center min-w-[80px]">
                <div
                  className={`text-xs font-semibold ${
                    step.id === currentStep ? 'text-white' : step.id < currentStep ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{step.description}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-16 mx-2 mb-6 transition-all duration-500 ${
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
