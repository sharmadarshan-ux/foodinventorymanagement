"""
One-time script to test Gmail SMTP setup.
Run with: python test_email.py
"""

import sys
import os

# Add current directory to path so app modules can be loaded
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.email_service import send_test_email
from app.config import settings

def main():
    print("=== GEN-016 Gmail SMTP Tester ===")
    print(f"Configured SMTP Email: {settings.smtp_email or 'Not configured'}")
    
    if not settings.smtp_email or not settings.smtp_password:
        print("\n[ERROR] SMTP_EMAIL and SMTP_PASSWORD must be configured in your .env file.")
        print("Please check your .env settings and try again.")
        return

    recipient = input("\nEnter recipient email address: ").strip()
    if not recipient:
        print("[ERROR] Recipient email cannot be empty.")
        return

    print(f"\nSending test email from '{settings.smtp_email}' to '{recipient}'...")
    success = send_test_email(recipient)
    
    if success:
        print("\n[SUCCESS] The test email has been sent. Check your inbox (and spam folder).")
    else:
        print("\n[FAILURE] Failed to send email. Check backend log output above.")

if __name__ == "__main__":
    main()
