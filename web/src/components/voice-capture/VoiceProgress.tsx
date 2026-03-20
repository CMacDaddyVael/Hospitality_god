'use client'

type Step = {
  id: number
  label: string
  shortLabel: string
}

type VoiceProgressProps = {
  steps: Step[]
  currentStep: number
}

export function VoiceProgress({ steps, currentStep }: VoiceProgressProps) {
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <div className="px-6 md:px-8 py-4 border-b border-slate-700/50">
      {/* Step counter */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400">
          Step {currentStep} of {steps.length}
        </span>
        <span className="text-xs font-medium text-amber-400">
          {steps[currentStep - 1]?.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        {/* Track */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step dots — desktop only */}
        <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 w-full justify-between px-0">
          {steps.map((step) => {
            const isCompleted = step.id < currentStep
            const isCurrent = step.id === currentStep
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-amber-400 border-amber-400'
                      : isCurrent
                      ? 'bg-slate-800 border-amber-400 ring-2 ring-amber-400/30'
                      : 'bg-slate-700 border-slate-600'
                  }`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Step labels — desktop only */}
      <div className="hidden md:flex justify-between mt-3">
        {steps.map((step) => (
          <span
            key={step.id}
            className={`text-xs transition-colors duration-300 ${
              step.id === currentStep
                ? 'text-amber-400 font-medium'
                : step.id < currentStep
                ? 'text-slate-400'
                : 'text-slate-600'
            }`}
          >
            {step.shortLabel}
          </span>
        ))}
      </div>
    </div>
  )
}
