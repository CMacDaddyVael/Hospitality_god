import { APP_URL } from '../resend'

export type DeliverablesReadyEmailData = {
  userEmail: string
  userName: string
  listingTitle: string
  deliverableCounts: {
    listing_rewrite: number
    review_responses: number
    social_posts: number
  }
}

export const DELIVERABLES_READY_SUBJECT =
  'Your first deliverables are ready — here\'s what we built'

export function renderDeliverablesReadyEmail(data: DeliverablesReadyEmailData): string {
  const { userName, listingTitle, deliverableCounts } = data

  const totalCount =
    deliverableCounts.listing_rewrite +
    deliverableCounts.review_responses +
    deliverableCounts.social_posts

  const deliverableItems = [
    {
      icon: '&#9998;',
      label: 'Listing rewrite',
      count: deliverableCounts.listing_rewrite,
      description:
        'Your title, description, and amenity copy — rewritten to rank higher in Airbnb search and convert more browsers into guests.',
      available: deliverableCounts.listing_rewrite > 0,
    },
    {
      icon: '&#9734;',
      label: 'Review responses',
      count: deliverableCounts.review_responses,
      description:
        'Personalized responses to your recent guest reviews, written in your voice. Copy, paste, done.',
      available: deliverableCounts.review_responses > 0,
    },
    {
      icon: '&#9635;',
      label: 'Social posts',
      count: deliverableCounts.social_posts,
      description:
        "Ready-to-post Instagram and TikTok content for your property — captions, hashtags, and lifestyle images included.",
      available: deliverableCounts.social_posts > 0,
    },
  ]

  const itemRows = deliverableItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="48" valign="top">
              <div style="
                width: 36px;
                height: 36px;
                background-color: #f3f4f6;
                border-radius: 8px;
                text-align: center;
                line-height: 36px;
                font-size: 16px;
              ">${item.icon}</div>
            </td>
            <td valign="top">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      ${item.label}
                      ${
                        item.count > 0
                          ? `<span style="margin-left: 8px; display: inline-block; padding: 1px 8px; background-color: #111827; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 600;">${item.count} ready</span>`
                          : ''
                      }
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      ${item.description}
                    </p>
                  </td>
                </tr>
              </table>
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
  <title>${DELIVERABLES_READY_SUBJECT}</title>
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
              <table cellpadding="0" cellspacing="0" border="0" width="100%">

                <!-- Header section -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">
                      Pro subscription active
                    </p>
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                      Your first ${totalCount} deliverable${totalCount !== 1 ? 's are' : ' is'} ready
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      We've been working on ${escapeHtml(listingTitle)}. Here's what your marketing team put together for you.
                    </p>
                  </td>
                </tr>

                <!-- Deliverable list -->
                <tr>
                  <td style="padding: 8px 32px 0 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${itemRows}
                    </table>
                  </td>
                </tr>

                <!-- How it works -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                          <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
                            How it works
                          </p>
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td style="padding-bottom: 8px;">
                                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                                  1. Open your dashboard inbox<br/>
                                  2. Review each deliverable (edit anything you want)<br/>
                                  3. Copy and paste into Airbnb, Instagram, etc.<br/>
                                  4. We'll keep producing new content every week
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 0 32px 32px 32px;">
                    <a href="${APP_URL}/dashboard/deliverables"
                       style="display: block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; text-align: center;">
                      Open your dashboard inbox
                    </a>
                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                      New deliverables are generated weekly. Your swarm is always working.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0 0;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                You're receiving this because you subscribed to Hospitality God Pro.
                Questions? Reply to this email and we'll get back to you.
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
