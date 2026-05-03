# ARAM Bound — Homepage wireframe spec

**Purpose:** Blueprint for layout and content hierarchy (not pixel-perfect design). Use for sketches, Figma, or implementation order.

**Vision anchor:** Home for ARAM Mayhem build guides and discussion; browse by champion and style; submit structured guides; compete for weekly spotlight (upvoted + featured videos). **Spicy** is a separate reaction from upvotes, with a clear banner explaining intent.

---

## Global layout (all viewports)

```
┌─────────────────────────────────────────────────────────┐
│ [ZONE A] Global navigation                                 │
├─────────────────────────────────────────────────────────┤
│ [ZONE B] Optional thin strip (patch / legal)               │
├─────────────────────────────────────────────────────────┤
│ [ZONE C] Hero                                              │
├─────────────────────────────────────────────────────────┤
│ [ZONE D] Spicy explainer banner                            │
├─────────────────────────────────────────────────────────┤
│ [ZONE E] Weekly spotlight (featured builds + video)        │
├─────────────────────────────────────────────────────────┤
│ [ZONE F] This week — dual rails (Upvotes vs Spicy)         │
├─────────────────────────────────────────────────────────┤
│ [ZONE G] Browse / featured grid + filters                 │
├─────────────────────────────────────────────────────────┤
│ [ZONE H] Footer                                            │
└─────────────────────────────────────────────────────────┘
```

---

## Zone A — Global navigation

| Element        | Placeholder copy / notes |
|----------------|---------------------------|
| Brand / logo   | `[Logo] ARAM Bound` |
| Primary links  | `[Builds]` `[Champions]` `[Community]` |
| Primary CTA    | `[Submit build]` (strongest visual weight) |

**Notes:** Sticky optional. Same nav on inner pages for consistency.

---

## Zone B — Optional thin strip

| Element | Placeholder copy / notes |
|---------|---------------------------|
| Meta / trust | `[Patch 15.x · ARAM Mayhem]` or `[Fan project — not affiliated with Riot Games]` |

**Notes:** Omit if crowded on mobile; can move line to footer.

---

## Zone C — Hero

| Element   | Placeholder copy |
|-----------|------------------|
| Headline  | `[H1: ARAM Mayhem build hub]` |
| Subhead   | `[Browse trusted guides by champion and style. Submit your build—clips and votes can land you on the homepage.]` |
| Primary CTA | `[Browse builds]` |
| Secondary CTA | `[Submit a guide]` |

**Notes:** One dominant action; secondary supports vision without competing.

---

## Zone D — Spicy explainer banner

**Intent:** Users understand **Spicy ≠ upvote**. Spicy rewards unexpected-off-meta builds that still work in a devious or cunning way.

| Element | Placeholder copy |
|---------|------------------|
| Icon / label | `[🌶 Spicy]` or `[Spicy]` |
| Body | `[Spicy highlights builds that look wrong for this champion—but work anyway. Think surprise, cunning, off-meta genius. For “best overall” or most respected builds, use Upvotes.]` |
| Dismiss (optional) | `[×]` (stores preference locally) |
| Link | `[How Spicy works →]` (anchors to FAQ or modal) |

**Notes:** Distinct background or border so it never blends with hero or cards.

---

## Zone E — Weekly spotlight

**Intent:** Homepage real estate for **most upvoted / editorial picks** and **featured video clips** for the week.

| Element | Placeholder copy |
|---------|------------------|
| Section title | `[This week’s spotlight]` |
| Eyebrow (optional) | `[Resets Monday]` or `[Week of [date]]` |
| Card 1 | `[Video thumb]` `[Build title]` `[Champion]` `[Author]` `[▶ Featured clip]` |
| Card 2–3 | Repeat pattern or `[+ Add slot when data exists]` |
| Footer link | `[See past spotlights →]` |

**Notes:** Thumbnail + title mandatory; author and champion for scanability. Empty state: `[No spotlight yet—submit a build with a clip to be eligible.]`

---

## Zone F — This week — dual rails

**Intent:** Side-by-side or tabbed comparison of **Top by upvotes** vs **Spiciest by Spicy reactions**.

| Element | Placeholder copy |
|---------|------------------|
| Column / tab A title | `[Top this week · Upvotes]` |
| Column / tab B title | `[Spiciest this week · Spicy]` |
| Rail items (×3–5 each) | `[Rank #]` `[Build title]` `[Champion]` `[↑ 000]` or `[🌶 000]` `[1-line hook]` |
| Tie-break note (footer of zone) | `[Ties: newer first]` or `[Editor tie-break]` — TBD |

**Notes:** Mobile: stack A then B, or tabs. Do not merge the two metrics into one list without labels.

---

## Zone G — Browse / featured grid + filters

| Element | Placeholder copy |
|---------|------------------|
| Section title | `[Explore builds]` |
| Filters | `[Champion ▼]` `[Style / tag ▼]` `[Sort: New · Top · Spicy ▼]` |
| Grid card | `[Thumb or champ art]` `[Title]` `[Tags]` `[↑ n]` `[🌶 n]` |
| Pagination / load more | `[Load more]` |

**Notes:** Cards always show **both** upvote and Spicy counts when applicable. Empty filter: `[No builds match—clear filters]`

---

## Zone H — Footer

| Element | Placeholder copy |
|---------|------------------|
| Links | `[About]` `[Community guidelines]` `[Contact]` |
| Legal | `[Fan project — not Riot]` |
| Reaction FAQ | `[Upvotes vs Spicy →]` |

---

## Responsive notes (sketch targets)

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Full width; Zone F as two columns. |
| Tablet | Zone F stacked or tabs; grid 2 columns. |
| Mobile | Single column; banner D full width; spotlight horizontal scroll or single card + “more.” |

---

## Open decisions (for later implementation)

- Weekly spotlight: **purely algorithmic** (top upvotes + clip) vs **editor + algorithm**.
- Spicy: **one reaction per user per build** vs unlimited (abuse risk).
- Auth: anonymous vs account for votes/Spicy (affects wireframes for sign-in strip—**not** on this homepage spec until decided).

---

## Document control

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Scope | Homepage only |
| Companion specs (future) | Builds feed card, Build detail reactions row, Create flow steps |
