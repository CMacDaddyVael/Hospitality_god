/**
 * Plain HTML email templates — readable in all clients, no heavy design.
 * Single-column layout, inline styles only, dark-free (client-safe).
 */

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
  color: #1a1a1a;
`

const buttonStyle = `
  display: inline-block;
  background: #f59e0b;
  color: #111827;
  font-weight: 700;
  font-size: 16px;
  text-decoration: none;
  padding: 14px 32px;
  border-radius: 8px;
  margin: 24px 0;
`

const headerStyle = `
  background: #0f172a;
  padding: 28px 40px;
  border-radius: 8px 8px 0 0;
`

const bodyStyle = `
  padding: 40px;
  background: #ffffff;
`

const footerStyle = `
  padding: 24px 40px;
  background: #f8fafc;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 13px;
`

const issueBoxStyle = `
  background: #fef9ee;
  border-left: 4px solid #f59e0b;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 0 6px 6px 0;
`

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VAEL Host</title>
</head>
<body style="margin:0;padding:16px;background:#f1f5f9;">
  <div style="${baseStyle}">
    <div style="${headerStyle}">
      <span style="color:#f59e0b;font-size:20px;font-weight:800;letter-spacing:-0.5px;">VAEL Host</span>
      <span style="color:#94a3b8;font-size:14px;margin-left:8px;">AI CMO for STR Owners</span>
    </div>
    <div style="${bodyStyle}">
      ${inner}
    </div>
    <div style="${footerStyle}">
      You're receiving this because you have a VAEL Host account.<br/>
      Questions? Reply to this email — a human will respond.<br/>
      <a href="${'{{unsubscribe}}'}" style="color:#94a3b8;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

// ─── Template 1: Welcome ──────────────────────────────────────────────────────

export interface WelcomeTemplateData {
  firstName: string
  dashboardUrl: string
  auditUrl: string
}

export function welcomeTemplate(data: WelcomeTemplateData): { subject: string; html: string; text: string } {
  const subject = 'Welcome to VAEL Host — your AI marketing team is ready'

  const html = wrap(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px 0;color:#0f172a;">
      Welcome, ${escapeHtml(data.firstName)}! 👋
    </h1>
    <p style="font-size:16px;color:#475569;margin:0 0 24px 0;">
      Your AI CMO is ready to get to work. Here's what happens next:
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:36px;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#fef9ee;border:2px solid #f59e0b;text-align:center;line-height:24px;font-weight:700;color:#f59e0b;font-size:13px;">1</span>
        </td>
        <td style="padding:12px 0 12px 12px;border-bottom:1px solid #e2e8f0;">
          <strong style="color:#0f172a;">Run your free listing audit</strong><br/>
          <span style="color:#64748b;font-size:14px;">Paste your Airbnb or Vrbo URL and get a scored report in under 60 seconds.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#f1f5f9;border:2px solid #cbd5e1;text-align:center;line-height:24px;font-weight:700;color:#64748b;font-size:13px;">2</span>
        </td>
        <td style="padding:12px 0 12px 12px;border-bottom:1px solid #e2e8f0;">
          <strong style="color:#0f172a;">See exactly what's holding you back</strong><br/>
          <span style="color:#64748b;font-size:14px;">Photos, copy, pricing, SEO — we score all of it and show you the gaps.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;vertical-align:top;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#f1f5f9;border:2px solid #cbd5e1;text-align:center;line-height:24px;font-weight:700;color:#64748b;font-size:13px;">3</span>
        </td>
        <td style="padding:12px 0 12px 12px;">
          <strong style="color:#0f172a;">Subscribe and let the swarm fix it</strong><br/>
          <span style="color:#64748b;font-size:14px;">$49/mo — your AI team writes, optimizes, and creates. You copy-paste and post.</span>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      <a href="${data.auditUrl}" style="${buttonStyle}">
        Start My Free Audit →
      </a>
    </div>

    <p style="font-size:14px;color:#64748b;margin:24px 0 0 0;text-align:center;">
      Already subscribed? <a href="${data.dashboardUrl}" style="color:#f59e0b;text-decoration:none;">Go to your dashboard →</a>
    </p>
  `)

  const text = `Welcome to VAEL Host, ${data.firstName}!

Your AI CMO is ready to get to work.

Step 1: Run your free listing audit — paste your Airbnb or Vrbo URL and get a scored report in under 60 seconds.
Step 2: See exactly what's holding you back — photos, copy, pricing, SEO — we score all of it.
Step 3: Subscribe ($49/mo) and let the swarm fix it — your AI team creates content, you copy-paste and post.

Start your free audit: ${data.auditUrl}

Go to your dashboard: ${data.dashboardUrl}

Questions? Just reply to this email.

— The VAEL Host Team`

  return { subject, html, text }
}

// ─── Template 2: Audit Complete ──────────────────────────────────────────────

export interface AuditCompleteTemplateData {
  firstName: string
  score: number
  topIssues: string[]           // exactly 3 strings
  dashboardUrl: string
  upgradeUrl: string
  isFree: boolean               // show upgrade CTA only for free tier
  listingTitle?: string
}

export function auditCompleteTemplate(data: AuditCompleteTemplateData): { subject: string; html: string; text: string } {
  const subject = `Your listing scored ${data.score}/100 — here's what to fix`

  const scoreColor = data.score >= 70 ? '#22c55e' : data.score >= 45 ? '#f59e0b' : '#ef4444'
  const scoreLabel = data.score >= 70 ? 'Good' : data.score >= 45 ? 'Needs Work' : 'Critical Issues'

  const issuesHtml = data.topIssues
    .slice(0, 3)
    .map(
      (issue, i) => `
      <div style="${issueBoxStyle}">
        <strong style="color:#92400e;font-size:13px;">Issue #${i + 1}</strong><br/>
        <span style="color:#1a1a1a;font-size:15px;">${escapeHtml(issue)}</span>
      </div>`
    )
    .join('\n')

  const upgradeCta = data.isFree
    ? `
    <div style="background:#0f172a;border-radius:8px;padding:28px;text-align:center;margin-top:32px;">
      <p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">Your AI team is standing by to fix every one of these issues.</p>
      <p style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 4px 0;">Get everything fixed for $49/mo</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 20px 0;">Rewritten copy · Optimized photos · Social posts · Review responses</p>
      <a href="${data.upgradeUrl}" style="${buttonStyle}">
        Start My Pro Subscription →
      </a>
    </div>`
    : `
    <div style="text-align:center;margin-top:28px;">
      <a href="${data.dashboardUrl}" style="${buttonStyle}">
        View Full Audit Report →
      </a>
    </div>`

  const html = wrap(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px 0;color:#0f172a;">
      Your audit is complete${data.listingTitle ? ` — ${escapeHtml(data.listingTitle)}` : ''} 🔍
    </h1>
    <p style="font-size:15px;color:#475569;margin:0 0 28px 0;">
      Hi ${escapeHtml(data.firstName)}, here's what we found.
    </p>

    <!-- Score card -->
    <div style="border:2px solid ${scoreColor};border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Listing Score</div>
      <div style="font-size:64px;font-weight:800;color:${scoreColor};line-height:1;">${data.score}</div>
      <div style="font-size:20px;color:#94a3b8;margin-bottom:8px;">/100</div>
      <div style="display:inline-block;background:${scoreColor}20;color:${scoreColor};padding:4px 14px;border-radius:20px;font-size:14px;font-weight:600;">${scoreLabel}</div>
    </div>

    <h2 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 12px 0;">
      Top 3 issues holding you back:
    </h2>
    ${issuesHtml}

    ${upgradeCta}

    <p style="font-size:13px;color:#94a3b8;text-align:center;margin-top:20px;">
      <a href="${data.dashboardUrl}" style="color:#94a3b8;">View full report in dashboard</a>
    </p>
  `)

  const issuesText = data.topIssues
    .slice(0, 3)
    .map((issue, i) => `  Issue #${i + 1}: ${issue}`)
    .join('\n')

  const text = `Your listing audit is complete${data.listingTitle ? ` — ${data.listingTitle}` : ''}.

Hi ${data.firstName}, here's what we found:

LISTING SCORE: ${data.score}/100

Top 3 issues holding you back:
${issuesText}

${
    data.isFree
      ? `Your AI team can fix every one of these issues for $49/mo.
Rewritten copy, optimized photos, social posts, review responses — all done for you.

Start your Pro subscription: ${data.upgradeUrl}`
      : `View your full audit report: ${data.dashboardUrl}`
  }

Questions? Just reply to this email.

— The VAEL Host Team`

  return { subject, html, text }
}

// ─── Template 3: Deliverables Ready ──────────────────────────────────────────

export interface DeliverablesReadyTemplateData {
  firstName: string
  deliverableCount: number
  deliverableTypes: string[]    // e.g. ['social post', 'review response', 'listing rewrite']
  dashboardUrl: string
  deliverablesUrl: string
}

export function deliverablesReadyTemplate(data: DeliverablesReadyTemplateData): { subject: string; html: string; text: string } {
  const count = data.deliverableCount
  const subject = count === 1
    ? `Your AI team prepared 1 new deliverable — ready to review`
    : `Your AI team prepared ${count} new deliverables — ready to review`

  const typeListHtml = data.deliverableTypes
    .slice(0, 6)
    .map(
      (t) => `<li style="padding:6px 0;color:#1a1a1a;font-size:15px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#f59e0b;margin-right:8px;">✓</span>${escapeHtml(capitalise(t))}
      </li>`
    )
    .join('\n')

  const remainder = data.deliverableTypes.length > 6 ? data.deliverableTypes.length - 6 : 0

  const html = wrap(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px 0;color:#0f172a;">
      ${count} new ${count === 1 ? 'deliverable' : 'deliverables'} ready for you ✨
    </h1>
    <p style="font-size:15px;color:#475569;margin:0 0 28px 0;">
      Hi ${escapeHtml(data.firstName)}, your AI marketing team has been busy.
      ${count === 1 ? 'Here\'s what they prepared:' : `Here's what they prepared this batch:`}
    </p>

    <ul style="list-style:none;margin:0 0 28px 0;padding:0;background:#f8fafc;border-radius:8px;padding:8px 16px;">
      ${typeListHtml}
      ${
        remainder > 0
          ? `<li style="padding:6px 0;color:#64748b;font-size:14px;">
              <span style="color:#f59e0b;margin-right:8px;">+</span>${remainder} more…
            </li>`
          : ''
      }
    </ul>

    <p style="font-size:15px;color:#475569;margin:0 0 24px 0;">
      Review each item, make any edits you want, then copy-paste directly into Airbnb, Instagram, or wherever it belongs.
      <strong style="color:#0f172a;">You're always in control.</strong>
    </p>

    <div style="text-align:center;">
      <a href="${data.deliverablesUrl}" style="${buttonStyle}">
        Review My Deliverables →
      </a>
    </div>

    <p style="font-size:13px;color:#94a3b8;text-align:center;margin-top:20px;">
      <a href="${data.dashboardUrl}" style="color:#94a3b8;">Go to dashboard</a>
    </p>
  `)

  const typeListText = data.deliverableTypes.map((t) => `  • ${capitalise(t)}`).join('\n')

  const text = `${count} new ${count === 1 ? 'deliverable' : 'deliverables'} ready for you!

Hi ${data.firstName}, your AI marketing team has been busy. Here's what they prepared:

${typeListText}

Review each item, make any edits you want, then copy-paste directly into Airbnb, Instagram, or wherever it belongs. You're always in control.

Review your deliverables: ${data.deliverablesUrl}

Go to dashboard: ${data.dashboardUrl}

— The VAEL Host Team`

  return { subject, html, text }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
