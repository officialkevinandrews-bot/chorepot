# ChorePot

Build a family chore and pocket money tracking app for parents and children (supporting GBP £/p).

Core functionality:
1. Household and roles:
- Primary Parent account sets up the family household.
- Parent can invite another adult (Co-Parent) via email link or code so both parents can manage chores, see notifications, and approve tasks.
- Parent can invite children via an email invite link that automatically attaches them to the family on sign-up, plus a 6-character family invite code / QR code backup for joining easily on tablets or phones.
- Role-based views: streamlined, administrative view for Parents and an engaging, encouraging dashboard for Children.

2. Chores management & scheduling:
- Parents can create custom chores, assign them to specific children, set the scheduled day of the week, and assign a monetary value (e.g. 50p, £1.00, £2.50).
- Recurring weekly schedule view and a clear "Today's Chores" list for the child.

3. Completion & Parent Verification Loop:
- When a child finishes a chore, they tick it off and can optionally take or upload a photo as proof (e.g. tidy room, completed English homework).
- Completing a chore changes its status to "Pending Approval" and sends a notification alert to parents.
- Parent dashboard prominently highlights pending chores needing verification. Parents review the submission (and photo proof) and confirm it by ticking it off, or reject with a note.
- Once confirmed, the chore's bounty is instantly added to the child's pocket money balance.

4. Pocket money, savings goals & payday:
- Running virtual balance for each child.
- Savings goals: Child can set visual targets (like a toy or game) and allocate earnings toward their goal with a fun progress bar.
- Weekly payday settlement: Summary of earnings for the week with a "Mark as Paid" button when parents transfer money or hand over physical cash.
- Activity and earnings history ledger.

5. Mobile/tablet experience:
- Fully responsive, installable PWA with in-app notification center and lock-screen alert support.
- Kid-friendly, celebratory micro-animations when completing tasks and hitting savings milestones.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e742218d-444f-483f-92ea-ca71243aa1af).

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
