# PORTO VERDE — Sunset Run

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/batako-hash/gta6-01-v4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/batako-hash/gta6-01-v4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01): a sun-soaked harbour
city that turns neon after dark, played top-down in the browser from static
files — no build step, no libraries, no network requests, no external assets.

You are Rae "Rook" Calloway, fresh out of prison with a debt to the fixer
Mara Voss. Eight story jobs stand between Rook and freedom.

## What is in the game

- **An open city**: Porto Verde — five districts (Downtown, Old Town,
  Industrial, Palm Court, Marina), a bay and beach, a park, eight named
  landmarks, traffic and pedestrians, all seeded and reproducible.
- **On foot and by car**: walk, sprint, steal any parked or traffic car (E),
  drive with braking and off-road slowdown.
- **8 story missions** from Mara Voss, Sister Luz and Eddie Kwan: car theft,
  a timed courier run, a vault hold, a harbour chase, a checkpoint street
  race, a pier rescue, a 5-star getaway and the finale heist.
- **5-star wanted system**: patrol cars that ram, foot cops who bust a
  cornered player, a police helicopter with a searchlight at 3+ stars,
  roadblocks at 4+ stars, spike strips at 5 stars. Heat decays when you lay
  low. BUSTED and WASTED cost 10% of your cash.
- **Combat**: weapon wheel (fists, pistol, SMG, shotgun) with ammo, mouse
  aim, guards who shoot back during jobs.
- **Progression**: cash rewards, respect ranks, a garage (engine and armor
  upgrades, repairs), a crew member — Juno joins after the street race and
  can be called in (C) to ram the nearest cop car.
- **Activities**: street races, radio with three switchable synth stations
  (R), day/night cycle from golden hour to neon night, HUD with minimap,
  start and pause screens, and a save that resumes the current mission at
  its current stage (localStorage).

## Controls

WASD / arrows — walk and drive · E — steal / enter / exit car · Mouse — aim ·
Click — shoot · 1–4 — weapons · Q — cycle weapon · Space — brake · R — radio ·
C — call Juno · G — garage menu · M — mute · Esc — pause · Enter — start

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The four staged shots in `screenshots/` are real renders of the game's own
code (`shots.json` lists the `?shot=` scene for each): the title over the city
at golden hour, a 3-star chase with the helicopter, the vault hold, and the
story-complete screen.

## License

MIT — see `LICENSE`.
