# Test fixtures

None of these files contain real personal data.

- `legacy-backup.json`: a backup in the exact shape the original tracker's "Download Backup" wrote:
  `{ workoutLogs, macroGoals }`, set fields as strings, pre-filled RPE, no Spotter fields. The numbers
  are synthetic (written by `tools/make-legacy-fixture.js`). Used to prove old backups still import.
- `load-5-weeks.json`: hand-computed session loads with the expected answers written out.
- `rts-chart.json`: RPE chart values as supplied in the build brief. Not independently checked
  against the original source.
- `sample-prices.json`: SAMPLE rupee prices, made up for tests and demo mode. Not real canteen prices.
