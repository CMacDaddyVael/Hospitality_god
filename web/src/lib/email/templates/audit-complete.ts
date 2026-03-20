import { APP_URL } from '../resend'

export type AuditCompleteEmailData = {
  userEmail: string
  userName: string
  listingScore: number
  listingTitle: string
  listingUrl: string
  recommendations: Array<{
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
  }>
  auditId: string
}

export function getAuditCompleteSubject(score: number): string {
  if (score < 40) {
    return `Your listing scored ${score}/100 — here's what's hurting you`
  } else if (score < 65) {
    return `Your listing scored ${score}/100 — several quick wins available`
  } else {
    return `Your listing scored ${score}/100 — here's how to get to the top`
  }
}

export function renderAuditCompleteEmail(data: AuditCompleteEmailData): string {
  const { userName, listingScore, listingTitle, recommendations, auditId } = data

  const top3 = recommendations.slice(0, 3)

  const scoreColor =
    listingScore < 40 ? '#dc2626' : listingScore < 65 ? '#d97706' : '#16a34a'

  const scoreLabel =
    listingScore < 40
      ? 'Needs significant work'
      : listingScore < 65
        ? 'Room for improvement'
        : 'Good — let\'s optimize further'

  const recommendationRows = top3
    .map(
      (rec, i) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="32" valign="top" style="padding-right: 12px;">
              <div style="
                width: 24px;
                height: 24px;
                background-color: #f3f4f6;
                border-radius: 50%;
                text-align: center;
                line-height: 24px;
                font-size: 12px;
                font-weight: 600;
                color: #374151;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              ">${i + 1}</div>
            </td>
            <td valign="top">
              <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                ${escapeHtml(rec.title)}
              </p>
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                ${escapeHtml(rec.description)}
              </p>
            </td>
            <td width="80" valign="top" style="text-align: right;">
              <span style="
                display: inline-block;
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 500;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background-color: ${rec.impact === 'high' ? '#fef2f2' : rec.impact === 'medium' ? '#fffbeb' : '#f0fdf4'};
                color: ${rec.impact === 'high' ? '#991b1b' : rec.impact === 'medium' ? '#92400e' : '#166534'};
              ">${rec.impact} impact</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${getAuditCompleteSubject(listingScore)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827; letter-spacing: 0.05em; text-transform: uppercase;">
                Hospitality God
              </p>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">

              <!-- Score banner -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">
                      Audit complete
                    </p>
                    <h1 style="margin: 0 0 4px 0; font-size: 28px; font-weight: 700; color: #111827;">
                      Your listing scored
                      <span style="color: ${scoreColor};">${listingScore}/100</span>
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      ${escapeHtml(listingTitle)} &middot; ${scoreLabel}
                    </p>
                  </td>
                </tr>

                <!-- Score bar -->
                <tr>
                  <td style="padding: 0 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 16px 0 24px 0;">
                          <div style="background-color: #f3f4f6; border-radius: 9999px; height: 8px; width: 100%;">
                            <div style="background-color: ${scoreColor}; border-radius: 9999px; height: 8px; width: ${listingScore}%;"></div>
                          </div>
                          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 6px;">
                            <tr>
                              <td style="font-size: 11px; color: #9ca3af;">0</td>
                              <td align="right" style="font-size: 11px; color: #9ca3af;">100</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Recommendations -->
                <tr>
                  <td style="padding: 0 32px 8px 32px;">
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #111827;">
                      Top 3 issues to fix
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                      Addressing these will have the biggest impact on your score and bookings.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${recommendationRows}
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 24px 32px 32px 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827;">
                            Fix these issues automatically
                          </p>
                          <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                            A Pro subscription gives you rewritten listing copy, review responses, and social content — ready to copy and paste. Your AI marketing team works while you sleep.
                          </p>
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <a href="${APP_URL}/audit?id=${auditId}&upgrade=true"
                                   style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                                  View full results and upgrade
                                </a>
                              </td>
                              <td style="padding-left: 12px;">
                                <a href="${APP_URL}/audit?id=${auditId}"
                                   style="display: inline-block; color: #6b7280; text-decoration: none; padding: 12px 0; font-size: 13px;">
                                  View results only
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0 0;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                You received this because you ran a listing audit at Hospitality God.
                Questions? Reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
