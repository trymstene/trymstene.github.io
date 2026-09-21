# Banana Town — the duties chip (what your job wants from you today)

Since 21 September a player can hold a job in Banana Town: at the General Store (Pip), at the
Arcade (Spinner) or at the Coffee Cup (Bean). One job at a time. The store and the arcade pay a
**weekly cheque** — derived from the days you turned up, paid every Monday, delivered as a payslip
in the letterbox at your homestead. The Coffee Cup pays **tips per cup**, at the end of a shift, and
never a cheque.

Until now the job was silent between the boss's card and the payslip. This job is the **duties
chip**: a small paper note in the corner of the square, the sibling of the quest's yellow journal
chip, in the town's own brown-and-cream paper. It says ONE line at a time:

1. **The duty**, while today's work is still undone — one line per workplace (`duty.store`,
   `duty.condo`, `duty.cafe`). It tells you what the place wants of you today.
   - The General Store: the shelf wants restocking (the crate by the till, the faces on the shelf).
   - The Arcade: for now the arcade wants nothing but your company — being there is the day's work
     (a real chore comes later; do not invent one).
   - The Coffee Cup: clock in at the serving window and make cups.
2. **The wage line** (`wage`), once you have turned up today at a cheque job: how much the week
   has earned so far and how far away payday is. It MUST contain the placeholders `{coins}` and
   `{days}` exactly — the game prints the numbers. Payday is Monday.
3. **The café's after-line** (`cafeDone`), once you have clocked in today at the Coffee Cup: tips
   are counted on the tray as you pour, and paid when you step away. No numbers.
4. **The payslip line** (`payslip`), when a cheque has been paid and is waiting in the letterbox
   at your homestead. It sends you home to open it. No numbers — the payslip has them.

## Rules

- It is a NOTE TO YOURSELF, the same grammar as the quest chip: **lower case first letter**, short
  (under 70 characters; `wage` may run to 80), a phrase or one plain sentence.
- The one place in this world where an instruction belongs — but never a control: no "tap", "click",
  "button", "menu", "screen".
- **No numbers** in the prose, ever. `{coins}` and `{days}` are the only numbers, and only in `wage`.
- Never name the money as a reward, a bonus or a prize. A wage is a wage; a tip is a tip.
- The chip is read in the square, so it need not say "in Banana Town".
- Warm, dry, plain. A 13-year-old and a 50-year-old both read it without a stumble.
