# Community evidence for "People and Place: past to present"

**Page:** `/past`, section `past-people`. **Published file:** `data/content/community.json` (ships empty, status `no-approved-material`). **Code:** `apps/web/src/past/communityModel.ts` (schema, validator, importer), `communityCli.ts`, `PeopleAndPlace.tsx`. Builds on `consent-protocol.md`, `data-dictionary.md` and the explicit missing-value reasons of `@makarba/survey`.

Nothing on this page is invented. No residents, quotations or findings exist in the repository. Until researchers supply approved material and run the import below, the page says that no permission-cleared recollections have been published.

## What must be collected (one record per recollection, kept by researchers, never committed)

| Field | Rule |
|---|---|
| `id` | Opaque reference, 3 to 40 characters. Not a name, phone or address. |
| `theme` | One of `transport-access`, `livelihoods`, `community-public-space`, `heritage-connection`, `housing-urbanisation`, `environment-water-green`, `development-benefits`, `development-costs`. Collect benefits and costs with equal effort. |
| `period` | Years as the participant stated them: `{kind:"period",from,to}` or `{kind:"before-after",beforeYear,afterYear}`. If not stated: `{missing:"unsure"}` (or another reason). Never estimate on their behalf. |
| `perspective` | `positive`, `negative`, `mixed` or `neutral` (the participant's own stance on the change), or `{missing:"..."}`. |
| `text` | A short excerpt the participant agreed to publish (`textKind:"excerpt"`), or a researcher paraphrase (`"paraphrase"`). 15 to 600 characters. No names, contacts, house addresses or coordinates. |
| `consent.consentId` | The random receipt reference the participant holds. Not derived from identity. |
| `consent.publicationScope` | `public` (short excerpt or paraphrase may appear), `anonymised-summary` (paraphrase only, never a verbatim quote), `withheld` (never published). |
| `consent.withdrawn` | Explicit `true` or `false`. Absent is rejected, not assumed false. |
| `consent.consentedOn`, optional `expiresOn` | ISO dates. With no `expiresOn`, consent lapses 24 months after `consentedOn` (a project default pending institutional review). |
| `consent.approverRole` | `principal-investigator`, `institutional-reviewer` or `data-steward`: the role that checked the consent and the text, never a person's name. |
| `provenance.method` | `interview`, `survey` or `observation`. |
| `provenance.collectedOn` | ISO date (published as year-month only). |
| `provenance.locality` | Ward or neighbourhood name, or `{missing:"..."}`. Never a street, plot, building or coordinate. |

Any other field is rejected: names, contact details, latitude/longitude, interview position, researcher id.

## Consent wording required before anything here can be published

Extending the script in `consent-protocol.md`, the participant must be told, in their own language and before agreeing, and the answer recorded with script version, time and collector:

1. What is kept: a short recollection of how the place has changed, the years they mention, a theme and the ward or neighbourhood. Not their name, phone or home address.
2. How it may appear: as a short quotation (`public`), or only as a researcher's paraphrase with no quotation (`anonymised-summary`), or not at all (`withheld`). These are separate yes/no permissions, also separate from survey and GPS consent.
3. That it is shown with a project-chosen label (theme, years, locality, stance), beside recollections from other people, including ones who disagree.
4. That it appears only if enough other participants (at least 5 separate people) share the same theme and locality, so a single person is never singled out.
5. That they may withdraw at any time through the approved project process, that it will then be removed from the published file at the next import, and what cannot be undone (copies already read or saved by visitors; earlier backups follow the approved retention rule).
6. How long the permission lasts (default 24 months, then it must be renewed or the recollection is removed).

The institutional lead must approve the final wording and supply the real contact process; none is invented here. Do not approach minors without an approved procedure. Officials speaking in a role need verified authority (see `consent-protocol.md`).

## What the validator rejects (`validateEntry`)

Missing, withdrawn or expired consent; `withheld` scope; a verbatim excerpt under `anonymised-summary`; an unknown theme; text over 600 characters; unknown or private fields; email addresses, social handles, web addresses, phone numbers, precise coordinates (3 or more decimal places in a pair, degree-minute notation, "latitude/longitude/GPS" followed by a number), titled or introduced personal names ("my name is...", "Mrs ..."), house or flat addresses, 12-digit and PAN-style numbers; impossible or future dates; implausible years; duplicate ids and duplicate text. Error messages name the rule and the entry index, never the text. The pattern checks are a safety net, not proof of anonymity: a human must still read every excerpt. A false rejection is the safe failure; paraphrase and re-import.

## Privacy protection on import (`importCommunity`)

A theme, and a locality (an unrecorded locality counts as one group), is published only if at least `MIN_CELL_SIZE = 5` **distinct consents** fall in it. This is the same provisional k5 threshold as the insights contract (`packages/contracts`). It counts people, so one participant with many excerpts cannot fill a cell. Dropping an entry can shrink another group, so suppression repeats until stable. Only a total of suppressed entries is reported; per-group small numbers are never written. The published file omits `consentId`, approver role and exact dates. When the browser loads the file it re-validates it (`parsePublished`) and shows nothing if any rule fails.

## Running the import

```
pnpm --filter @makarba/web community:check <private-file.json> [--dry-run] [--drop-rejected] [--as-of YYYY-MM-DD]
```

The private file is `{ "entries": [ ... ] }` (or a bare array) kept outside the repository. The command prints every rejected entry and a summary. If any entry is rejected nothing is written, unless `--drop-rejected` is given. It writes `data/content/community.json` (or the `--out` path) containing only the publishable subset; if nothing is publishable it writes the empty `no-approved-material` document, so withdrawing every recollection unpublishes the page content. To honour a withdrawal: mark the record `withdrawn: true` (or remove it), re-run the import, review the diff and deploy. Commit only the generated `community.json`, never the private file.

## Tests and fixtures

`communityModel.test.ts`, `communityCli.test.ts` and `PeopleAndPlace.test.tsx` cover consent, privacy, small cells, missing values, filtering, empty and error states, axe accessibility and the shipped file. The only sample data is `apps/web/src/past/__fixtures__/communitySynthetic.ts`: obviously synthetic text and an invented locality, imported only by tests, never published.

## Limits

- This is a workflow and a validator. No real recollection has been collected, reviewed or published.
- The 5-person minimum and the 24-month consent default are provisional project choices needing institutional review.
- The identifier patterns cannot catch every re-identifying detail (a rare occupation, a unique event). Human review is required.
- Entries are individual recollections, not a representative sample. The page never converts them into percentages or trends.
- Withdrawal removes content at the next import and deploy; it cannot recall what a visitor already saw.
