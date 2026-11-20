"""
Email Service — Gmail SMTP-based email notifications for GEN-016.
Uses Python's built-in smtplib and email packages only.
All templates are highly polished, responsive, and use inline CSS only.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)

# Shared footer across all templates
SHARED_FOOTER = (
    "GEN-016 Food Inventory & Expiry Management System"
)


def _send_smtp_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Helper function to send email via Gmail SMTP_SSL (port 465).
    Wraps in try/except and never crashes the caller.
    If the recipient email is a mock domain, redirects to settings.alert_email_to
    to prevent Mailer Daemon bounces during hackathon demos.
    """
    if not settings.smtp_email or not settings.smtp_password:
        logger.error("SMTP_EMAIL or SMTP_PASSWORD not configured — email sending skipped.")
        return False

    original_to = to_email
    # Redirect if target is a mock domain
    is_mock_domain = any(
        to_email.endswith(dom)
        for dom in ["edu.in", "example.com", "school.edu", "ngo.org", "foodbank.org"]
    )
    
    recipient = to_email
    demo_banner = ""
    if is_mock_domain and settings.alert_email_to:
        recipient = settings.alert_email_to
        demo_banner = f"""
        <div style="background-color: #ffedd5; border: 1px solid #f97316; padding: 12px; text-align: center; font-size: 12px; color: #c2410c; font-weight: bold; margin-bottom: 20px; font-family: Arial, sans-serif; border-radius: 8px;">
            🔧 DEMO REDIRECT: Intended recipient was {original_to} (Mock Domain)
        </div>
        """
        # Prepend banner inside body tag if present, else just prepend to body
        if "<body>" in html_body:
            html_body = html_body.replace("<body>", f"<body>{demo_banner}")
        else:
            html_body = demo_banner + html_body

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"GEN-016 FIMS <{settings.smtp_email}>"
        msg["To"] = recipient

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.smtp_email, settings.smtp_password)
            server.sendmail(settings.smtp_email, recipient, msg.as_string())

        logger.info("Polished email successfully sent to %s (originally %s) with subject: %s", recipient, original_to, subject)
        return True

    except Exception as e:
        logger.error("Failed to send SMTP email to %s: %s", recipient, e, exc_info=True)
        return False


def send_expiry_alert(to_email: str, institution_name: str, items: list[dict]) -> bool:
    """
    Template 1: Expiry Alert Email
    """
    n_items = len(items)
    subject = f"⚠️ [ACTION REQUIRED] Expiry Alert — {institution_name} — {n_items} items need attention"

    # Count item risk levels for summary boxes
    critical_count = sum(1 for i in items if i.get("risk_level", "").upper() in ("CRITICAL", "EXPIRED"))
    expiring_soon_count = sum(1 for i in items if i.get("risk_level", "").upper() == "EXPIRING_SOON")
    fresh_count = sum(1 for i in items if i.get("risk_level", "").upper() == "FRESH")

    # Define priority mapping for sorting (CRITICAL/EXPIRED first, then EXPIRING_SOON, then FLASH/FRESH)
    def sort_key(item):
        risk = item.get("risk_level", "").upper()
        if risk == "EXPIRED":
            return 0
        if risk == "CRITICAL":
            return 1
        if risk == "EXPIRING_SOON":
            return 2
        return 3

    sorted_items = sorted(items, key=sort_key)

    # Build table rows
    table_rows = ""
    for idx, item in enumerate(sorted_items):
        bg_color = "#ffffff" if idx % 2 == 0 else "#f9fafb"
        risk = item.get("risk_level", "FRESH").upper()

        # Status badge pill color
        if risk == "CRITICAL":
            pill_color = "#dc2626"
        elif risk == "EXPIRING_SOON":
            pill_color = "#ea580c"
        elif risk == "EXPIRED":
            pill_color = "#7f1d1d"
        else:
            pill_color = "#16a34a"  # FRESH

        table_rows += f"""
        <tr style="background-color: {bg_color};">
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; font-weight: 500;">{item.get('name', 'Unknown')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569;">{item.get('category', 'Uncategorized')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569;">{item.get('quantity', 1)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569; font-weight: bold;">{item.get('days_remaining', 0)}d</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: center;">
                <span style="background-color: {pill_color}; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px; display: inline-block; text-transform: uppercase;">
                    {risk}
                </span>
            </td>
        </tr>
        """

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            
            <!-- Dark Navy Header -->
            <div style="background-color: #1a1a2e; padding: 28px; text-align: center; color: #ffffff;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">⚠️</span>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Expiry Alert</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">{institution_name} &mdash; Daily Inventory Report</p>
            </div>

            <!-- Body Content -->
            <div style="padding: 28px;">
                <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                    The following items in your inventory require immediate attention. Please take action before these items expire and contribute to food waste.
                </p>

                <!-- Summary Strip -->
                <div style="margin-bottom: 28px; text-align: center; font-size: 0;">
                    <div style="display: inline-block; width: 30%; margin-right: 3%; background-color: #dc2626; border-radius: 8px; padding: 12px 0; text-align: center; vertical-align: top;">
                        <span style="display: block; font-size: 18px; font-weight: 800; color: #ffffff;">{critical_count}</span>
                        <span style="display: block; font-size: 10px; font-weight: bold; color: #fee2e2; text-transform: uppercase; margin-top: 2px;">Critical</span>
                    </div>
                    <div style="display: inline-block; width: 30%; margin-right: 3%; background-color: #ea580c; border-radius: 8px; padding: 12px 0; text-align: center; vertical-align: top;">
                        <span style="display: block; font-size: 18px; font-weight: 800; color: #ffffff;">{expiring_soon_count}</span>
                        <span style="display: block; font-size: 10px; font-weight: bold; color: #ffedd5; text-transform: uppercase; margin-top: 2px;">Soon</span>
                    </div>
                    <div style="display: inline-block; width: 30%; background-color: #16a34a; border-radius: 8px; padding: 12px 0; text-align: center; vertical-align: top;">
                        <span style="display: block; font-size: 18px; font-weight: 800; color: #ffffff;">{fresh_count}</span>
                        <span style="display: block; font-size: 10px; font-weight: bold; color: #dcfce7; text-transform: uppercase; margin-top: 2px;">Fresh</span>
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 28px;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Item Name</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Category</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Qty</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Days</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table_rows}
                    </tbody>
                </table>

                <!-- Action Box -->
                <div style="background-color: #fefce8; border: 1px solid #ca8a04; border-radius: 12px; padding: 18px; margin-bottom: 28px;">
                    <h4 style="margin: 0 0 6px 0; font-size: 15px; color: #854d0e; font-weight: 700;">🍽️ Recommended Action</h4>
                    <p style="margin: 0; font-size: 13.5px; color: #713f12; line-height: 1.5;">
                        Use CRITICAL items today. Consider donating surplus to nearby institutions via the Surplus Network before items expire.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 32px; margin-bottom: 8px;">
                    <a href="{settings.frontend_url}" target="_blank" style="background-color: #1a1a2e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(26, 26, 46, 0.2);">
                        Open Dashboard
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;">
                    {SHARED_FOOTER}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return _send_smtp_email(to_email, subject, html_body)


def send_surplus_match_notification(
    to_email: str,
    receiver_institution: str,
    sender_institution: str,
    sender_address: str,
    item_name: str,
    quantity_kg: float,
    hours_remaining: int,
    distance_km: float,
    contact_phone: str,
    contact_email: str,
    expiry_date: str,
    storage_instructions: str,
) -> bool:
    """
    Template 2: Surplus Match Notification
    """
    subject = f"🚨 URGENT — {quantity_kg}kg {item_name} available {distance_km}km away — expires in {hours_remaining}hrs"
    co2_saved = round(quantity_kg * 2.5, 1)

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            
            <!-- Deep Orange Header -->
            <div style="background-color: #7c2d12; padding: 28px; text-align: center; color: #ffffff;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">🚨</span>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Surplus Alert</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #ffedd5; font-weight: 500;">Food available near you &mdash; act fast</p>
            </div>

            <!-- Body Content -->
            <div style="padding: 28px;">
                
                <!-- Urgency Banner -->
                <div style="background-color: #fee2e2; border: 1px solid #dc2626; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; font-weight: 700; color: #991b1b; display: inline-block;">
                        ⏰ This offer expires in {hours_remaining} hours. First institution to respond gets priority.
                    </p>
                </div>

                <!-- Surplus Details Card (Two-column layout via table for email client compatibility) -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                    <tr>
                        <td style="width: 50%; padding: 18px; border-right: 1px solid #e2e8f0; vertical-align: top; background-color: #fafafa;">
                            <span style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">From</span>
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #1e293b; font-weight: bold;">{sender_institution}</h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569; line-height: 1.4;">{sender_address}</p>
                            <span style="font-size: 12.5px; font-weight: bold; color: #7c2d12;">📍 {distance_km} km away</span>
                        </td>
                        <td style="width: 50%; padding: 18px; vertical-align: top;">
                            <span style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Item Details</span>
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #1e293b; font-weight: bold;">{item_name}</h4>
                            <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;"><strong>Quantity:</strong> {quantity_kg} kg</p>
                            <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;"><strong>Expires:</strong> {expiry_date}</p>
                            <p style="margin: 0; font-size: 12.5px; color: #64748b; line-height: 1.4;"><strong>Storage:</strong> {storage_instructions}</p>
                        </td>
                    </tr>
                </table>

                <!-- Contact Details Box -->
                <div style="background-color: #f0fdf4; border: 1px solid #16a34a; border-radius: 12px; padding: 18px; margin-bottom: 28px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 15px; color: #14532d; font-weight: 700;">📞 Contact to Arrange Pickup</h4>
                    <p style="margin: 0 0 4px 0; font-size: 13.5px; color: #166534;"><strong>Phone:</strong> {contact_phone}</p>
                    <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #166534;"><strong>Email:</strong> {contact_email}</p>
                    <p style="margin: 0; font-size: 11px; color: #15803d; font-style: italic; font-weight: bold;">* Mention this surplus alert when you call</p>
                </div>

                <!-- Two Side-by-Side Call to Action Buttons -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 24px;">
                    <tr>
                        <td style="width: 48%; text-align: right; padding-right: 4%;">
                            <a href="{settings.frontend_url}/surplus" target="_blank" style="background-color: #16a34a; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.2);">
                                ✅ Accept Transfer
                            </a>
                        </td>
                        <td style="width: 48%; text-align: left;">
                            <a href="{settings.frontend_url}/surplus" target="_blank" style="background-color: #6b7280; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(107, 114, 128, 0.2);">
                                ❌ Decline
                            </a>
                        </td>
                    </tr>
                </table>

                <!-- Impact line at bottom -->
                <p style="margin: 24px 0 0 0; font-size: 13px; color: #475569; text-align: center; line-height: 1.5; font-weight: 500;">
                    ♻️ Accepting this transfer prevents <strong>{quantity_kg}kg</strong> of food waste and saves approximately <strong>{co2_saved}kg</strong> of CO2 emissions.
                </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;">
                    {SHARED_FOOTER}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return _send_smtp_email(to_email, subject, html_body)


def send_transfer_accepted_notification(
    to_email: str,
    source_institution: str,
    matched_institution: str,
    item_name: str,
    quantity_kg: float,
    contact_phone: str,
    contact_email: str,
) -> bool:
    """
    Template 3: Transfer Accepted Notification
    """
    subject = f"✅ Transfer Confirmed — {matched_institution} will collect your {item_name}"
    co2_saved = round(quantity_kg * 2.5, 1)

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            
            <!-- Dark Green Header -->
            <div style="background-color: #14532d; padding: 28px; text-align: center; color: #ffffff;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">✅</span>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Transfer Accepted</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #dcfce7; font-weight: 500;">Your surplus found a home &mdash; food waste prevented</p>
            </div>

            <!-- Body Content -->
            <div style="padding: 28px;">
                
                <!-- Success Banner -->
                <div style="background-color: #f0fdf4; border: 1px solid #16a34a; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; font-weight: 700; color: #14532d; line-height: 1.4;">
                        🎉 Great news! <strong>{matched_institution}</strong> has accepted your surplus transfer. Coordinate pickup as soon as possible.
                    </p>
                </div>

                <!-- Transfer Summary Card -->
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                    <div style="background-color: #f8fafc; padding: 12px 18px; border-bottom: 1px solid #e2e8f0;">
                        <h4 style="margin: 0; font-size: 13px; font-weight: bold; color: #475569; text-transform: uppercase;">Transfer Summary</h4>
                    </div>
                    <div style="padding: 18px; background-color: #ffffff;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.5; color: #334155;">
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; color: #64748b; width: 120px;">Item:</td>
                                <td style="padding: 6px 0; font-weight: bold; color: #1e293b;">{item_name} &mdash; {quantity_kg}kg</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">From (Donor):</td>
                                <td style="padding: 6px 0; color: #1e293b;">{source_institution}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">To (Recipient):</td>
                                <td style="padding: 6px 0; color: #1e293b;">{matched_institution}</td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Contact Details Box -->
                <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 15px; color: #1e3a8a; font-weight: 700;">📞 Their Contact Details</h4>
                    <p style="margin: 0 0 4px 0; font-size: 13.5px; color: #1e40af;"><strong>Phone:</strong> {contact_phone}</p>
                    <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #1e40af;"><strong>Email:</strong> {contact_email}</p>
                    <p style="margin: 0; font-size: 11px; color: #2563eb; font-weight: bold;">* Please arrange pickup before the item expires</p>
                </div>

                <!-- Impact Celebration Box -->
                <div style="background-color: #faf5ff; border: 1px solid #9333ea; border-radius: 12px; padding: 18px; margin-bottom: 28px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #581c87; font-weight: bold;">🌍 Impact Celebration</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b21a8; line-height: 1.6;">
                        <li style="margin-bottom: 4px;">By completing this transfer, you are preventing <strong>{quantity_kg}kg</strong> of food waste</li>
                        <li style="margin-bottom: 4px;">Saving approximately <strong>{co2_saved}kg</strong> of CO2 emissions</li>
                        <li>Contributing to UN SDG 12.3 &mdash; halve global food waste by 2030</li>
                    </ul>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 28px; margin-bottom: 8px;">
                    <a href="{settings.frontend_url}/surplus" target="_blank" style="background-color: #16a34a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.2);">
                        Mark Transfer Complete
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;">
                    {SHARED_FOOTER}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return _send_smtp_email(to_email, subject, html_body)


def send_test_email(to_email: str) -> bool:
    """
    Sends a simple styled connection test email confirming SMTP works.
    """
    subject = "GEN-016 SMTP Connection Test"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{subject}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background-color: #1e293b; padding: 24px; text-align: center; color: #ffffff;">
                <span style="font-size: 28px; display: block; margin-bottom: 6px;">🔌</span>
                <h1 style="margin: 0; font-size: 20px; font-weight: 800;">SMTP Connection Test</h1>
            </div>
            <div style="padding: 28px; text-align: center;">
                <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-top: 0;">
                    🎉 <strong>GEN-016 email connection working!</strong>
                </p>
                <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
                    This verifies that your Gmail SMTP server settings are correctly configured for the GEN-016 Food Inventory Management System.
                </p>
                <span style="background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
                    CONNECTION SUCCESSFUL
                </span>
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;">
                    {SHARED_FOOTER}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return _send_smtp_email(to_email, subject, html_body)
