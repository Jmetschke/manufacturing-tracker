# Manufacturing Tracker

## Render Alert Setup

The app supports in-app alerts, email alerts, SMS text alerts, or any combination. The in-app alert is always created first. If email or SMS settings are missing, the app logs a warning and keeps running.

Alert recipients are managed from the admin dashboard in the **Alert Recipients** tab. Each active recipient can be assigned alert types and can independently opt into email and/or SMS.

## Email Alerts

Email alerts use Nodemailer. Add these environment variables in Render under **Environment**:

- `SMTP_HOST`: SMTP server host, for example `smtp.gmail.com`.
- `SMTP_PORT`: SMTP server port, commonly `465`, `587`, or `2525`.
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password, app password, or provider API key.
- `ALERT_FROM_EMAIL`: sender address shown on alert emails.

Do not commit SMTP credentials to this repository. Store them only in Render environment variables or a local `.env` file for development.

## SMS Alerts

SMS alerts use Twilio. Add these environment variables in Render under **Environment**:

- `TWILIO_ACCOUNT_SID`: Twilio account SID.
- `TWILIO_AUTH_TOKEN`: Twilio auth token.
- `TWILIO_FROM_PHONE`: Twilio sender phone number in E.164 format, for example `+18475551234`.

Recipient phone numbers must also be stored in E.164 format, for example `+18475551234`.

## Alert Types

The admin recipient form currently supports:

- `recipe_published`
- `delivery_added`
- `delivery_scheduled`
- `delivery_completed`
- `low_inventory`
- `task_assigned`
- `system_error`

Existing ordered-item delivery alerts use `delivery_added` and `delivery_scheduled`.
