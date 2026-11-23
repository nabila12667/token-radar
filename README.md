# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nabila12667/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nabila12667/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 198 pre-token protocols ranked by implied value, with concrete farm plans — built from the DefiLlama snapshot. Model radar-3: TVL × category multiple × growth × maturity × breadth × sector momentum × category leadership. Top: #1 Steakhouse Financial $675.4M, #2 Sentora Curator $648.5M, #3 Gauntlet $403.4M.

## Practice trials

- v2 (this commit): model radar-3 adds sector momentum and category leadership to the v1 model; dashboard adds a Top-10 chart, category/chain breakdowns, and a per-protocol "why this rank" line. Board stays 198 rows, 40/40 watchlist, dossier byte-identical across two runs.
- v1: model radar-2 (TVL × category multiple × growth × maturity × breadth); Development provisional rate 0.824969 (10 won / 1 drawn / 1 lost of 12 games).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
