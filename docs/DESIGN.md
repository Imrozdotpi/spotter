# Design notes: removing the "AI-generated" look

Why the interface was restyled, what was found, and what changed. No behaviour changed: every button, input and calculation works as before, and all tests still pass.

## 1. What the research says

"AI slop" in interface design means the look that code-generating models fall back on when nobody gives them a direction. The sources below are design blogs and community checklists, not controlled studies, and one of them points out that these patterns do not prove a page was machine-made. They do agree closely on the list.

**Why it happens.** Models reproduce the most common patterns in the code they learned from, which is dominated by tutorials, starter templates and one popular component stack (Tailwind CSS with its default colour palette). The result is an average of everything.

**The tells that came up repeatedly**

| # | Tell | Where it was reported |
|---|---|---|
| 1 | Emoji used as icons, in navigation and in headings | Krebs; Utsubo |
| 2 | Default framework colours, especially Tailwind's palette (indigo/violet most of all) | DEV; Utsubo; 925 Studios |
| 3 | Gradients everywhere: backgrounds, buttons, text | Krebs; Utsubo |
| 4 | Glassmorphism (translucent, blurred bars) | Krebs |
| 5 | Coloured glows and coloured box-shadows | Krebs |
| 6 | All-caps, letter-spaced section labels and headings | Krebs |
| 7 | Uppercase pill badges | Krebs |
| 8 | Everything in identical rounded cards; cards inside cards | Utsubo; Krebs; search summaries |
| 9 | Coloured border on one edge or all edges of a card | Krebs |
| 10 | Stat banner rows of boxed numbers | Krebs |
| 11 | Numbered or arrowed "1 → 2 → 3" step diagrams | Krebs |
| 12 | Permanent dark mode with medium-grey, barely readable body text | Krebs |
| 13 | One generic typeface at one or two heavy weights, no hierarchy | Krebs; Utsubo |
| 14 | Buzzword and exclamation-mark copy; emoji-led bullets | Utsubo |

**Sources read for this**

- [Scoring Show HN submissions for AI design patterns](https://adriankrebs.ch/blog/design-slop/) (Adrian Krebs)
- [The "Built with AI" Tell: 12 Signals That Drop Trust in 2026](https://www.utsubo.com/blog/built-with-ai-trust-signals-2026) (Utsubo; a studio's own marketing post)
- [Why every AI-built website looks the same: blame Tailwind's indigo-500](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p) (DEV)
- [AI Slop Fonts and Gradients](https://www.925studios.co/blog/ai-slop-design-tells) (925 Studios)
- [How to detect AI slop in your design](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design)
- [Dark mode UI design best practices](https://blog.logrocket.com/ux-design/dark-mode-ui-design-best-practices-and-examples/) (LogRocket) and [Dark mode UI: 7 best practices](https://atmos.style/blog/dark-mode-ui-best-practices) (Atmos), for the dark-surface guidance

One page that was meant to be read (an anti-pattern catalogue on mintlify.com) returned "410 Gone" and was not used.

## 2. Audit: what Spotter had

Twelve of the fourteen tells were present. The two that were not: there was no purple, and no hero section.

| Tell | Where it was in Spotter |
|---|---|
| Emoji as icons | All five tabs (🏋️‍♂️ 🔥 🧮 📊 🤝), the header (📅 ⏱ 🔔), eleven card titles (🔥 💧 🏆 💾 🥚 …), the 👻 ghost bar, ⚡ before every muscle group, 🧘‍♂️ on rest days, ⚙️ on Targets |
| Default framework colours | The whole palette was Tailwind's defaults by hex value: `#10b981` emerald-500, `#f59e0b` amber-500, `#ef4444` red-500, `#3b82f6` blue-500, `#94a3b8` slate-400, `#f8fafc` slate-50, on slate-navy backgrounds |
| Gradients | Every progress bar (`linear-gradient(90deg, #10b981, #34d399)`) |
| Glassmorphism | The header and bottom bar were translucent with `backdrop-filter: blur` |
| All-caps tracked labels | Muscle headings, stat labels, set-table headers, the macro labels, "⚡ 1-TAP GYM FOODS (SWIPE →):", Spotter's section kickers, the "SPOTTER" wordmark with 3px letter-spacing |
| Pill badges | Split selector, readiness chips and solver result were fully rounded pills with a tinted translucent fill and a matching coloured border |
| Cards inside cards | Four bordered stat boxes inside the summary card; four bordered macro boxes inside the macros card; three bordered boxes inside "How it works" |
| Coloured card borders | The Autopilot card and the low-intake card changed border colour by state; finished exercises got a green border |
| Stat banner row | The four boxed figures at the top of the workout |
| Arrowed step diagram | "How it works": three boxes joined by ↓ arrows |
| Heavy weights, no hierarchy | Almost all text was weight 800 or 900, so nothing stood out |
| Copy | "Rest & Muscle Growth Day", "hit your protein & hydration goals!", "Log and tick sets to see your PRs!", "+ Log Meal" |

## 3. What changed

| Before | After | The convention it follows |
|---|---|---|
| Emoji icons | Eleven original line icons (one stroke weight, drawn for this app, inline SVG) | Tab bars in Apple's own apps and in Material apps use simple one-colour glyphs with a text label |
| Tailwind palette on slate-navy | Neutral near-black page `#0f0f0e`, raised surfaces `#191918` and `#222220`, off-white text, one green accent `#4cc38a`, slightly desaturated status colours | Material Design's dark theme: a dark grey base, depth shown by lighter surfaces, and desaturated accents. Apple's dark system backgrounds are also near-black greys |
| Blurred translucent bars | Solid bars with a 1px hairline | Plain, opaque navigation as in most native iOS and Android apps |
| Gradient progress bars, 8px tall | Flat 4px bars in one colour | |
| Borders on every card | No borders on cards; a card is just a lighter surface | Material dark-theme elevation |
| Boxes inside cards | Figures separated by hairlines; macro values as plain label + number + thin bar | Inset grouped lists in iOS Settings and Health: rows divided by hairlines, no nested boxes |
| Split selector as tinted pills | Text tabs with a coloured underline on the active one | Material tabs; iOS segmented navigation |
| Readiness and result pills with tinted fill | A solid coloured dot followed by plain words, in a neutral outlined button | Status indicators in issue trackers such as Linear and GitHub: dot + label |
| Card border changes colour by state; green border on a finished exercise | A status dot before the card title; a finished exercise just dims its name | Same |
| ALL-CAPS tracked labels | Sentence case, normal spacing, muted colour | GOV.UK's style guide uses sentence case throughout because it is easier to read |
| Weights 800/900 everywhere | 400 for text, 600 for emphasis, 700 only for the page title | A type scale needs contrast to show hierarchy |
| "How it works" as three boxes with arrows | Three plain rows | |
| "SPOTTER" in spaced capitals, green | "Spotter" as an ordinary title | |
| Bright white native checkbox | A drawn checkbox: outlined when empty, green with a dark tick when done | Workout loggers such as Strong and Hevy use a quiet tick at the end of each set row |
| Decorative copy and exclamation marks | Short plain labels: "Rest day", "Add exercise", "Log food", "Quick foods", "Targets", "Save" | Plain-language button labels |
| Numbers in proportional figures | Tabular figures for weights, reps, timers and totals, so columns line up | Standard for data tables |
| Corner radius 14px and full pills | 10px for surfaces, 8px for controls | |
| Icon: emerald on navy | Same barbell mark, green on near-black with an off-white chevron | Matches the new palette |

The references in the right-hand column are conventions I know from those products and guidelines. They were not fetched or measured during this work, and nothing was copied from them: no assets, no fonts, no layouts.

**Text contrast** (computed from the hex values): body text is 16.2:1 on the page; muted text is 7.5:1 on the page, 6.9:1 on a card and 6.2:1 inside an input; input placeholders are 5.0:1. All pass the 4.5:1 minimum for normal text. Two spots that first measured about 3:1 (placeholders and the delete ✕) were raised.

## 4. What was deliberately kept

- **Dark mode.** "Permanent dark mode" is on the list of tells, but a gym app used in dim rooms has a reason to be dark. The fix applied is contrast, not a theme switch.
- **The system font.** The tell is one web font (Inter) used by default. Spotter loads no fonts at all, because it makes no network requests; it uses the phone's own typeface, which on iPhone is the same one Apple's apps use.
- **Green, amber and red for the three verdicts**, and the exact poster wording.
- **Cards as the top-level grouping.** There are fewer visual layers now, but the screens are still stacks of cards.
- **Tab names, split names and exercise names.** These are yours.

## 5. What this did not do

- It was reviewed from screenshots at 500px wide in a desktop browser, not on an iPhone. Check it on the phone.
- It is a restyle, not a new layout. A designer could go further: a custom typeface, a denser set table, charts of each lift's trend.
- Whether it now looks "not AI" is a judgement. The measurable part is that the specific patterns in section 2 are gone.
