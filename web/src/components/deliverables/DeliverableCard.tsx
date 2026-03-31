'use client'

import { useState, useRef, useEffect } from 'react'
import type { Deliverable, DeliverableType } from './DeliverablesPanel'

type TypeConfig = {
  label: string
  icon: string
  color: string
}

type Props = {
  deliverable: Deliverable
  typeConfig: TypeConfig
  onMarkUsed: (id: string) => Promise<void>
  onSaveEdit: (id: string, content: string) => Promise<void>
}

export function DeliverableCard({ deliverable, typeConfig, onMarkUsed, onSaveEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(deliverable.content)
  const [isSaving, setIsSaving] = useState(false)
  const [isMarkingUsed, setIsMarkingUsed] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      // Move cursor to end
      el.selectionStart = el.value.length
      el.selectionEnd = el.value.length
    }
  }, [isEditing])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleEdit = () => {
    setEditContent(deliverable.content)
    setSaveError(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(deliverable.content)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (editContent.trim() === '') {
      setSaveError('Content cannot be empty.')
      return
    }
    setSaveError(null)
    setIsSaving(true)
    try {
      await onSaveEdit(deliverable.id, editContent.trim())
      setIsEditing(false)
    } catch {
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkUsed = async () => {
    setIsMarkingUsed(true)
    try {
      await onMarkUsed(deliverable.id)
    } finally {
      setIsMarkingUsed(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deliverable.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select all text in a temp element
    }
  }

  const formattedDate = new Date(deliverable.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-600/60">
      {/* Card header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeConfig.color}`}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">Generated {formattedDate}</span>
          {/* Copy button */}
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
          >
            {copied ? (
              <span className="text-emerald-400 font-medium">Copied!</span>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleTextareaChange}
              className="w-full bg-slate-900/80 border border-slate-600 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 rounded-xl px-4 py-3 text-slate-100 text-sm leading-relaxed resize-none outline-none transition-colors min-h-[120px]"
              placeholder="Edit your content here…"
              disabled={isSaving}
            />
            {saveError && (
              <p className="text-red-400 text-xs">{saveError}</p>
            )}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || editContent.trim() === ''}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save & Approve'
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
            {deliverable.content}
          </p>
        )}
      </div>

      {/* Card footer — action buttons */}
      {!isEditing && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-700/40 bg-slate-900/30">
          <button
            onClick={handleMarkUsed}
            disabled={isMarkingUsed}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-semibold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMarkingUsed ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-transparent rounded-full animate-spin" />
                <span>Marking…</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                <span>Mark as Used</span>
              </>
            )}
          </button>

          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm rounded-lg transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
              />
            </svg>
            <span>Edit</span>
          </button>
        </div>
      )}
    </div>
  )
}
