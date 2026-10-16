# Player data snapshot

Verified on 14 October 2026 for the 2026/27 season. `player-data.json` contains 20 players matching the portrait agent's approved list. Arda Güler's full-body portrait was rejected and replaced by verified Lautaro Martínez. No candidate without an approved close-up image should enter the active pool.

## Source policy

Club and number use official current club pages or official 2026/27 squad announcements. Birth date, position, and national-team identity use official club/league profiles. Donnarumma's birth date uses the cited Premier League transfer announcement; his current club and number use Manchester City's 2026/27 number announcement. Every record retains its source URLs and verification date.

Nationality means the represented senior national team, rather than birthplace or all passports. This matters for England players and Madrid-born Hakimi. `ENG` is a football nationality code, not ISO 3166; the flag field for England is a fallback black flag, so show the nationality name/code or implement an England cross icon in the interface. Other nationality codes use two-letter country codes.

Positions are normalized into GK / DF / MF / FW. Palmer is MF because Chelsea describes him as an attacking midfielder/winger; Foden is MF following City's current roster; Saka and Yamal are FW following the league/club profiles. The UI should describe these as broad roles and avoid claiming the exact original game's classification.

## Important current-season differences

- Kylian Mbappé: Real Madrid, number 10.
- Lamine Yamal: Barcelona, number 10.
- Gianluigi Donnarumma: Manchester City, number 1 (the earlier number 25 is stale for this snapshot).
- Kevin De Bruyne: Napoli, number 11.
- Mohamed Salah is absent from the verified Liverpool 2026/27 squad; excluded.
- Antoine Griezmann is outside the verified Big 4 scope; excluded.
- Rodri is absent from the inspected current City and Real Madrid official rosters; excluded because no reliable current club/number was resolved.

## Maintenance

Keep club, shirt number and age comparisons anchored to the displayed snapshot date. Compute age from birthDate at 2026-10-14, never from the host's moving clock, so a saved game cannot change clues unexpectedly. Update the whole pool deliberately at transfer windows; do not silently substitute live numbers mid-round. The portrait's capture date may differ from the roster snapshot.

The pool is intentionally small and curated. Unlimited play means reshuffling this finite pool once exhausted; it does not imply unlimited unique players. League distribution and duplicate-nationality/club clue overlap should be assessed after portrait approval.
