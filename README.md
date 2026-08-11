# Wealthpilot

Build a private, mobile-first personal finance web app for Abhi called “Wealthpilot”. It must be easy to understand, visually clean, and work well on iPhone and desktop.

Core setup

- Email login with cloud backup using Supabase authentication and database.
- Keep the project private/draft by default.
- Use in-app reminders and browser notifications. Ask permission before enabling browser notifications.
- Include a built-in financial coach that works without a paid AI API. Structure it so a future full AI assistant can be added later without rewriting the app.
- Allow statement uploads for bank statements, credit-card statements, pay stubs, and retirement statements. For now, parse basic text/CSV/PDF metadata where possible, extract candidate balances/transactions, and always show a review-and-confirm screen before saving anything. Never silently overwrite balances.

Seed the app with this current data as of July 23, 2026:
Income and rent

- Conservative monthly take-home budget: $5,200
- Average monthly take-home: about $5,850
- Expected next pay: about $2,800 on July 30, 2026
- Total house rent: $2,600/month
- Roommates contribute $2,140/month
- Abhi’s actual rent share: $460/month
- Treat roommates’ contributions and the full rent payment as transfers, not personal income/expense; only $460 is Abhi’s personal rent expense.

Cash and retirement

- Chequing: $826.43
- Savings: $3.15
- Money Master: $100.02
- Total cash: $929.60
- Work RRSP: $4,002.91
- Employer DPSP: $4,002.91
- Total workplace retirement: $8,005.82
- Continue existing matched workplace RRSP contribution; do not suggest reducing it while employer matching continues.

Debt

- PC Mastercard: current balance $1,540.17, pending payment -$70, adjusted balance $1,470.17, APR 26.99%, limit $1,500, minimum $33.88, due Aug 4, 2026. Priority 1.
- RBC Visa: balance $2,530.70, purchase APR 25.99%, cash-advance APR 27.99%, limit $2,500, minimum $132, due Aug 14, 2026, account has a missed payment/past-due issue. Priority 2.
- Scene+ Visa: balance about $2,928.79, APR 21.99%, limit $3,000, minimum $75.75, due Aug 13, 2026. Priority 3.
- Passport Visa: balance $1,538.46 plus pending $70.56, adjusted $1,609.02, APR 20.99%, limit $7,500, due Aug 12, 2026; exact minimum not confirmed, use a clearly labeled temporary estimate of $50 until updated. Priority 4.
- Affirm: balance $254.26, $84.75 overdue.
- Afterpay: $0, fully cleared.
- Car loan: balance $24,194.90, APR 3.99%, payment $313.27 biweekly. Keep normal payments; do not prioritize over high-interest credit cards.

Recurring costs and targets

- Car insurance: $465.51/month
- Phone: $131.24/month
- Utilities budget: $150/month
- Gas budget: $400/month
- Groceries starter budget: $350/month
- Dining & coffee limit during debt payoff: $250/month
- Subscriptions limit: $75/month
- Shopping/gaming: $0 temporarily
- Entertainment: $0 temporarily
- Car maintenance fund: $100/month
- Minimum cash buffer: $500
- Monthly credit-card payment target: $1,800 before extra overtime money
- No new Afterpay, Affirm, or credit-card purchases while balances are being cleared.

Existing reminder

- “Verify card payments” scheduled for Aug 3, 2026.

Main screens

1. Dashboard

- KPI cards: total cash, high-interest debt, car loan, workplace retirement, simple net worth.
- Clear debt priority panel with balances, APRs, utilization, minimums, due dates, and warnings.
- Next-payday plan that shows a running balance using the seeded data.
- Upcoming reminders and tasks.
- Progress rings for emergency fund, credit-card payoff, and retirement.
- A simple “What should I do today?” card from the built-in coach.

2. Debt Tracker

- Editable balances, rates, limits, minimums, due dates, status, and payoff priority.
- Show avalanche payoff plan by default.
- Show projected payoff month based on user-selected monthly payment.
- Warn when utilization exceeds 80% and especially 100%.
- Allow marking a payment as scheduled, pending, or cleared.

3. Budget

- Planned vs actual monthly budget.
- Separate transfers from expenses so roommates’ rent contributions do not distort income.
- Categories: rent, car payment, insurance, phone, utilities, gas, groceries, India RD, dining/coffee, subscriptions, shopping/gaming, entertainment, car maintenance, emergency savings, debt payments.
- Simple over-budget warnings and remaining amount.

4. Transactions

- Manual entry with date, type, category, account, description, amount, need/want, and cleared status.
- Import review flow from uploaded statement.
- Prevent double counting of credit-card purchases and credit-card payments.

5. Goals

- Starter emergency fund $1,000, then $3,000, then 3 months of essential expenses.
- Credit-card debt payoff goal.
- Future optional FHSA goal, but label it “Not active yet” because Abhi has not opened an FHSA and is unsure about buying a home.
- Retirement goal showing RRSP + DPSP and employer match.

6. Assistant

- Built-in rules-based coach with chat-style UI.
- It should answer from app data and produce specific next actions, for example: “Your RBC minimum is due soon,” “PC should be paid first because it has the highest APR,” and “Keep your $500 cash buffer.”
- Include quick prompts: “What should I pay next?”, “Can I afford this?”, “Where did my money go?”, “What should I do on payday?”, and “How am I doing this month?”
- For “Can I afford this?”, ask amount and category, then compare against remaining budget, cash buffer, and debt plan.
- Be direct, supportive, and plainspoken. Avoid jargon.
- Add an “AI Upgrade” settings card marked “Coming later” for a future provider/API connection.

7. Automations

- In-app reminder builder with one-time and recurring reminders.
- Support due-date reminders, payday check-ins, monthly budget review, and statement-upload reminders.
- Seed the Aug 3 card-payment verification reminder.
- Include browser notification permission flow and graceful fallback to in-app reminders.
- Add a recommended recurring payday routine: update balances, confirm minimums, keep $500 buffer, then pay the highest-priority debt.

8. Settings

- Profile, currency CAD, timezone America/Toronto.
- Notification preferences.
- Export/import backup and CSV export.
- Data privacy section explaining that uploaded documents require confirmation before saving extracted data.

Design

- Premium but simple financial dashboard, not a generic banking app.
- Dark navy, white, and soft green accents.
- Large readable numbers, strong hierarchy, minimal clutter.
- Mobile bottom navigation and desktop sidebar.
- Use charts sparingly: one debt-balance chart and one monthly spending chart.
- Include realistic empty states, loading states, and validation.

Acceptance requirements

- Fully functional seeded prototype with editable data.
- Supabase auth and persistence.
- Browser notification permission UI and in-app reminders.
- Statement upload review-and-confirm workflow.
- Built-in assistant works from live app data without a paid AI API.
- No mock placeholders for the main flows; all core interactions should work.
- Keep secrets out of client-side code.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://financial-vista-tool.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8e90c66a-8fce-49c6-bfd1-d7c8ff58f861).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
