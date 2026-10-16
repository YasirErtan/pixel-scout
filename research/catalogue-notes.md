# Big 4 search catalogue

Snapshot: 15 October 2026. Season: 2026/27. Source: ESPN's public soccer team inventory and roster JSON endpoints. These are ESPN's own published data, not copied original-game code or artwork. Fetcher: `scripts/fetch-catalogue.mjs`.

## Coverage

| League | ESPN league key | Teams fetched | Players |
| --- | --- | ---: | ---: |
| Premier League | eng.1 | 20 / 20 | 590 |
| LaLiga | esp.1 | 20 / 20 | 602 |
| Serie A | ita.1 | 20 / 20 | 620 |
| Ligue 1 | fra.1 | 18 / 18 | 517 |
| Total | | 78 / 78 | 2,329 |

`catalogue.json` has a `searchPlayers` array independent from the portrait target pool. All players listed by these current first-team roster endpoints are included, including academy players registered/listed alongside first-team squads. This is a complete traversal of the selected provider's 78 current roster endpoints; it is not a claim that every country's official registration database was independently audited.

## Pagination and completeness

All four team inventories are requested with `limit=1000`. Their returned counts match the known league sizes (20/20/20/18). The payload has the teams in a single `sports[0].leagues[0].teams` array and exposes no page count or next-page link at this endpoint. The fetcher asserts the exact team count and fails rather than silently shipping fewer clubs.

All 78 roster endpoints are requested with `limit=1000`. They return a flat `athletes` array, `status: success` and season year 2026. The largest roster returned is 37 players, well below the request limit. No roster endpoint exposed a page count or next-page link. Every team's requested URL, returned count, season, source timestamp and pagination observation are retained in `coverage`. There are no failed teams and no duplicate final IDs.

The source URLs for each player include the exact roster endpoint plus its ESPN player card. No ESPN photographs, club badges, flags or other image assets are downloaded or included. Flag strings are derived from standard region codes; UK home nations have null flags and explicit nationality names/codes for the UI to render its own cross/flag icon.

## Data treatment

- Stable IDs are `espn-<athlete ID>`, except the existing 20 targets retain their original IDs after matching both name and birth date. This avoids conflating different players called Vitinha or an unrelated player called Kevin.
- The initial 20 target records match ESPN on club, league, broad position, birth date, shirt number and nationality code.
- Names and aliases come from the source display/full/short names, plus previously verified target aliases. A short alias is a search aid, not an identity key.
- ESPN's citizenship field supplies the national identity. This should not be presented as an independently established list of all passports or eligibility. Birthplace is never substituted for nationality.
- Nationality abbreviations are mapped to ISO two-letter codes where applicable, retaining ESPN's original abbreviation in `sourceNationalityCode`. ENG/SCO/WAL/NIR remain football codes.
- Positions are broad GK/DF/MF/FW; the unnormalized source label is retained.
- Unknown fields remain null: 76 birth dates, 16 shirt numbers and 87 nationalities. No unknown position. Do not show a numeric direction comparison for missing age or shirt number.
- `wikiTitle` is null because a person's display name alone is insufficient to prove the correct Wikipedia article. Portrait lookup must resolve redirects and disambiguation, using birth date and club when names overlap.

## One verified provider identity correction

ESPN reuses athlete ID 213535 for Moussa Diarra in both Málaga and Lens. Official Málaga data identifies the Malian defender born 20 January 2002; the official Lens page identifies an Ivorian attacker wearing 37. Those are different players. Lens is assigned `rclens-moussa-diarra`, nationality CI, position FW, number 37 and birthDate null, with the official source added. Its birth date is deliberately unresolved. Málaga retains the ESPN ID and verified defender identity.

- Lens: https://www.rclens.fr/fr/moussa-diarra
- Málaga: https://www.malagacf.com/jugadores/moussa
- LaLiga: https://www.laliga.com/jugador/moussa-diarra

## Integration

Search across `searchPlayers`, while answer selection uses only portrait-approved target IDs. Join portraits to catalogue by verified identity rather than array index or surname. Show the snapshot date. A player without a portrait remains a valid guess. Keep comparisons stable for the entire round. Re-run the fetcher deliberately for future season/transfer updates, audit differences, and update the snapshot rather than mixing dates silently.

The source has broad coverage, not perfect infallibility; the namesake correction demonstrates why the selected portrait target pool deserves additional verification. The catalogue retains provenance and unknowns so subsequent corrections can be reviewed.
