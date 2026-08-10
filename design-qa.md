# Design QA

## Evidence

- Source visual truth: `C:\Users\angames\Desktop\KakaoTalk_20260810_083351518.png`
- Updated schedule capture: `C:\Loa\raid-scheduler\implementation-mobile-roster.png`
- Updated member-roster capture: `C:\Loa\raid-scheduler\implementation-members-roster.png`
- Side-by-side comparison: `C:\Loa\raid-scheduler\qa-comparison-roster.png`
- Schedule viewport: 390 x 844 CSS px, device scale factor 1, full-page capture.
- Member-management viewport: 624 px content width, device scale factor 1, viewport capture.
- Source image: 554 x 778 PNG. The side-by-side comparison keeps the source native and scales the implementation to 554 px wide.
- State: Wednesday 8/12, actual character names visible, acquired-gold labels visible, member roster populated with up to six characters.

## Full-view comparison evidence

The updated prototype keeps the supplied spreadsheet's compact table language: black borders, pale-green condition and role rows, gray/blue/gold raid headers, stable member color cells, and one support plus three dealer columns. Web-only controls remain outside the raid tables.

## Focused region comparison evidence

`qa-comparison-roster.png` compares the source and implementation at equal table width. The former `전투력` interpretation is corrected to `획득 골드`; slot labels now show actual character names while retaining the member color grouping. The member-management capture separately verifies the new one-member-to-six-characters hierarchy.

## Required fidelity surfaces

- Fonts and typography: Korean labels remain legible at compact table sizes; hierarchy is consistent across the source-derived raid cards and the new roster-management view.
- Spacing and layout rhythm: schedule rows remain dense, member cards use a two-column character grid at tablet width, and no page-level horizontal overflow was detected at 390 px or 624 px.
- Colors and visual tokens: source raid and member colors are preserved; the same member color follows all of that member's characters.
- Image quality and asset fidelity: no source raster assets require recreation. No placeholder image, handcrafted SVG, or CSS illustration is used.
- Copy and content: `획득 골드`, actual character names, character class, item level, role, `6/6`, and unavailable-weekday labels are all visible and correct.

## Interaction verification

- Opened member management and inspected grouped character rosters.
- Toggled a character between support and dealer.
- Opened an actual-character picker grouped by member.
- Reassigned a schedule slot to another real character name.
- Opened the Lost Ark roster lookup and verified the missing-JWT error state.
- Verified that the API endpoint keeps the JWT server-side and returns the full account roster for selecting at most six characters.
- Verified weekday/level warnings no longer use combat power or acquired gold.
- Checked browser console errors and warnings: none.

## Comparison history

1. The original prototype treated the numeric field as recommended combat power and stored one character per member (P1 product-model mismatch).
2. The raid field was changed to acquired gold and removed from eligibility calculations. Members now own character arrays and assignments store actual character IDs.
3. The first roster-sync implementation automatically kept the top six characters, which did not allow deliberate selection (P2 workflow mismatch).
4. The API now returns the full roster and the sync dialog allows selecting zero to six characters before saving.
5. Post-fix screenshots show the corrected gold label, actual character names, and the six-character member roster without overflow.

## Findings

- No actionable P0, P1, or P2 visual or interaction findings remain.
- External verification gap: a live Lost Ark API response cannot be tested until `LOSTARK_API_JWT` is placed in `.env.local`. The missing-configuration state is handled and was verified.
- Hosting note: the local Vite server securely proxies the API. A production deployment will need an equivalent server-side endpoint and secret configuration.

## Follow-up polish

- P3: replace the current realistic roster examples with live guild data after the API key is configured.

final result: passed
