import { VoiceCaptureWizard } from '@/components/voice-capture/VoiceCaptureWizard'

export const metadata = {
  title: 'Brand Voice Setup — VAEL Host',
  description: 'Help your AI marketing team learn how you communicate',
}

export default function BrandVoicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <VoiceCaptureWizard />
    </div>
  )
}
