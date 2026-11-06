# The research

Market research for one idea, done once at the start and again for a new market or segment. The
output is `strategy/research/reports/<title>.md`, a narrative report with inline source links, and
`strategy/research/notes/<title>/<subtopic>.md`, the findings behind it. Prettier leaves this
folder alone, so sources and tables stay as they were written.

## The research brief

From `brief.md`, write one brief per subtopic, constrained to the user's geography, segment and
time (today's date; facts older than two years are marked [older]). The subtopics, always:

| Subtopic                | Key questions                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Market size             | How many firms or people of the target kind, by country and size class, from official statistics? How many use a tool of this category today? What is the category worth, top-down and bottom-up?                                                     |
| Niches and segments     | Which segments inside the market write the cheque most easily: size, pain, current tools, willingness to pay, how to reach them (associations, communities, partners)? Which look big but are served by funded verticals?                             |
| Competitors             | Who serves this market: horizontal tools, local tools, verticals, the incumbent's own module, the spreadsheet? Prices per tier, what each tier excludes, funding or owner, recent moves, what reviewers praise and complain about (verbatim, linked). |
| Pricing and packaging   | Tier medians, what is gated where, per-seat versus per-account, annual discounts, trials, metered add-ons, what customers call unfair.                                                                                                                |
| Channels                | How comparable products got their first 100 customers; which channels work for a founder with this budget and these skills; partner programmes, review sites, SEO volumes, paid search costs.                                                         |
| Regulation and triggers | Dated events that make the target buy or switch (mandates, deadlines, a competitor's exit, a platform change); rules that shape the product (retention, privacy, invoicing, accessibility); funding programmes.                                       |

Add a subtopic when the brief names one (a specific competitor to study, a second country, a
channel the user already has). Remove none.

## With the deep-research skill

Run it with the subtopics as the decomposition and the questions as each researcher's key
questions. Tell it to create its folders inside `strategy/research/` (`reports/`, `notes/`) rather
than in the repository root. Pass the constraints: geography, segment, "mark estimates (est.),
mark unconfirmed claims (unverified), prefer primary sources (statistics offices, chambers,
registers, vendor pages), quote reviews verbatim with links". One round; a second only for a gap
that blocks the direction.

## Without it

Research each subtopic yourself with web search, in parallel where the agent allows it. One note
file per subtopic in this format:

```markdown
# <Subtopic>: <the question in one line>

Research date: <date>. Scope: <geography, segment, constraints>.

## <Question 1>

### Takeaway

<two to four sentences>

### Cited findings

- **<fact>** — [<source name>](url)
- ...

### Inferences

- <what follows, marked (est.) where it is a number>

### Gaps

- <what was not found, and where it would be>
```

Then write the report: a title that states the conclusion, an opening paragraph with the
recommendation, one section per subtopic with the numbers and their links inline, and a closing
section "what to validate first". Narrative prose with bold figures; tables only for TAM/SAM/SOM
and the competitor comparison.

## Sources

- Prefer primary: statistics offices (Eurostat, Destatis, Statistik Austria, ONS, Census), chambers
  and registers, laws and official timelines, vendor pricing pages, filings.
- Review sites for sentiment (OMR, G2, Capterra, Trustpilot), quoted verbatim and dated; never a
  review invented or paraphrased into a quote.
- Press for moves (funding, acquisitions, exits) with the date; a vendor's own claim is marked
  "(vendor)".
- A number that only an aggregator carries is **(unverified)** until the primary source is found.
- Note what the search did not reach (a paywalled report, a PDF not opened) under gaps rather than
  filling it with a guess.
