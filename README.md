This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Visory Performance & Growth OS

### Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (Neon) connection string. `npm run build` runs `prisma migrate deploy` against it. |
| `AUTH_SECRET` | NextAuth session secret. |
| `APP_URL` | Public URL used in emails and calendar links. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email. When unset, emails are skipped and logged. |
| `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/reminders`. |
| `REMINDER_TIMEZONE` | IANA zone for the Sunday/Monday reminder rule (default `Australia/Melbourne`). |

### Review flow

1. Admin opens a cycle (`/admin/cycles`) with due dates for self-assessments, manager reviews and 1:1s. Everyone is emailed.
2. Employees record metric results and complete the self-assessment. Managers rate each section blind, then reveal the self-review and write a response.
3. The manager submits and **shares** the review ahead of the 1:1. Edits after sharing require a reason and are logged.
4. Meeting mode on the summary runs the 1:1: results, both sides of every section, prescribed and agreed actions, autosaving notes, then "Mark 1:1 complete", which makes notes and actions visible to the employee.
5. Reminders go out on Sunday and Monday mornings to anyone behind (cron in `vercel.json`), escalating to the manager's manager three days after a due date. Admins can also send them on demand.

Role-set metrics and goals are managed under `/admin/roles` and flow to everyone holding the job role.
