import type { SubscriberBriefPayload } from '../weekly-brief'

interface TemplateParams extends SubscriberBriefPayload {
  dashboardUrl: string
  unsubscribeUrl: string
  subject: string
}

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  social_post: '📱 Social Post',
  listing_rewrite: '✍️ Listing Rewrite',
  review_response: '⭐ Review Response',
  seasonal_update: '🌿 Seasonal Update',
  guest_message: '💬 Guest Message',
  seo_content: '🔍 SEO Content',
  competitor_analysis: '🔭 Competitor Analysis',
  image_set: '📸 Image Set',
}

function typeLabel(type: string): string {
  return DELIVERABLE_TYPE_LABELS[type] ?? `📄 ${type.replace(/_/g, ' ')}`
}

function scoreBadge(score: number | null): string {
  if (score === null) return ''
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:9999px;font-size:13px;font-weight:700;">${score}/100</span>`
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return ''
  if (delta === 0) return `<span style="color:#94a3b8;">Score unchanged this week</span>`
  const sign = delta > 0 ? '+' : ''
  const color = delta > 0 ? '#22c55e' : '#ef4444'
  const arrow = delta > 0 ? '▲' : '▼'
  return `<span style="color:${color};font-weight:600;">${arrow} ${sign}${delta} pts vs last week</span>`
}

export function renderWeeklyBriefHtml(params: TemplateParams): string {
  const {
    propertyName,
    currentScore,
    previousScore,
    scoreDelta,
    deliverables,
    dashboardUrl,
    unsubscribeUrl,
    email,
  } = params

  const deliverableRows = deliverables
    .map(
      (d) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #1e293b;">
        <div style="margin-bottom:4px;">
          <span style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${typeLabel(d.type)}</span>
        </div>
        <div style="font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:6px;">${escHtml(d.title)}</div>
        <div style="font-size:14px;color:#94a3b8;line-height:1.5;">${escHtml(d.summary)}</div>
      </td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your VAEL Weekly Brief</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader text -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${deliverables.length} item${deliverables.length !== 1 ? 's' : ''} ready for ${propertyName} — review and approve in your dashboard.
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1e293b 100%);padding:32px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:800;color:#fbbf24;letter-spacing:-0.5px;">VAEL Host</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.1em;">Weekly Marketing Brief</div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="font-size:12px;color:#64748b;">${formatDate(new Date())}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;line-height:1.3;">
                Your marketing team<br/>showed up this week. 💼
              </h1>
              <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">
                Here's what we prepared for <strong style="color:#f1f5f9;">${escHtml(propertyName)}</strong>.
                Review and approve below — then copy-paste to publish.
              </p>
            </td>
          </tr>

          <!-- Score block -->
          ${currentScore !== null ? `
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#0f172a;border-radius:12px;padding:20px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Listing Score</div>
                    <div style="display:flex;align-items:center;gap:12px;">
                      ${scoreBadge(currentScore)}
                      ${previousScore !== null ? `<span style="color:#64748b;font-size:13px;">was ${previousScore}</span>` : ''}
                    </div>
                    <div style="margin-top:8px;font-size:14px;">
                      ${deltaLabel(scoreDelta)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Deliverables section -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">
                Ready for Review
              </div>
              <div style="font-size:20px;font-weight:700;color:#f1f5f9;margin-bottom:16px;">
                ${deliverables.length} item${deliverables.length !== 1 ? 's' : ''} pending approval
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${deliverableRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:#fbbf24;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;border-radius:10px;">
                      Review Your Deliverables →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
                Or go directly to your
                <a href="${dashboardUrl}" style="color:#fbbf24;text-decoration:none;">VAEL dashboard</a>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #0f172a;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 8px;font-size:12px;color:#475569;line-height:1.6;">
                You're receiving this because you're a VAEL Host Pro subscriber
                (${escHtml(email)}). Your AI marketing team sends this every Monday.
              </p>
              <p style="margin:0;font-size:12px;color:#475569;">
                <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/dashboard" style="color:#64748b;text-decoration:underline;">Dashboard</a>
                &nbsp;·&nbsp;
                VAEL Host · AI CMO for STR Owners
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
