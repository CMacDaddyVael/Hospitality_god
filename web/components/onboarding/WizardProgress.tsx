'use client'

type Step = {
  id: number
  label: string
  description: string
}

type WizardProgressProps = {
  steps: Step[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="border-b border-slate-700/50 px-6 py-4">
      {/* Mobile: pill progress bar */}
      <div className="flex md:hidden items-center gap-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              step.id < currentStep
                ? 'bg-amber-400'
                : step.id === currentStep
                ? 'bg-amber-400'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      {/* Mobile: current step label */}
      <div className="flex md:hidden mt-2 items-center justify-between">
        <span className="text-xs font-medium text-amber-400">
          {steps.find((s) => s.id === currentStep)?.label}
        </span>
        <span className="text-xs text-slate-500">
          {currentStep} / {steps.length}
        </span>
      </div>

      {/* Desktop: full step indicators */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  step.id < currentStep
                    ? 'bg-amber-400 text-slate-900'
                    : step.id === currentStep
                    ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-400/20'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {step.id < currentStep ? (
                  <svg
                    className="h-4 w-4"
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
              <div className="mt-1.5 text-center">
                <p
                  className={`text-xs font-medium whitespace-nowrap ${
                    step.id === currentStep
                      ? 'text-white'
                      : step.id < currentStep
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-2 mb-5 h-px flex-1 transition-all duration-500 ${
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
