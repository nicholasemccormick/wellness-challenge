# St. Mark Staff Wellness Challenge

An installable web app for tracking points in the St. Mark Staff Wellness Challenge (Sept 8, 2026 to April 30, 2027).

- Live app: https://nicholasemccormick.github.io/wellness-challenge/
- Each person signs in with an emailed code and sees only their own log.
- Tracking is monthly: one count per challenge per month, with no dates or notes stored.
- Data is stored in Supabase with row-level security, and anyone can delete their own account from the Me tab. Challenges and point values live in `challenges.js`.

The site is served by GitHub Pages from the `gh-pages` branch.
