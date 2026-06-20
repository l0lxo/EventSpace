/**
 * utils/emailTemplates/layout.js
 *
 * A single shared HTML wrapper used by every email template. Keeps a
 * consistent header/footer across all emails without repeating the same
 * boilerplate HTML seven times across seven template functions.
 *
 * Each individual email template (see the other files in this folder)
 * only needs to provide the inner content — a short HTML snippet — and
 * this function wraps it in the full page structure.
 *
 * Inline CSS is used throughout (rather than a <style> block or external
 * stylesheet) because most email clients — Gmail, Outlook, Apple Mail —
 * strip out <style> tags or render them inconsistently. Inline styles on
 * each element are the only reliable way to control appearance across
 * different email clients.
 */

const wrapEmail = (innerHtml) => `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:8px; overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background-color:#003366; padding:24px 32px;">
                <span style="color:#ffffff; font-size:20px; font-weight:bold;">
                  Strathmore University Events
                </span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                ${innerHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px; background-color:#f4f4f7; border-top:1px solid #e0e0e0;">
                <p style="margin:0; font-size:12px; color:#888888;">
                  This is an automated message from the Strathmore University Event
                  Management System. Please do not reply directly to this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

module.exports = wrapEmail;