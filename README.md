# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nabila12667/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nabila12667/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 198 pre-token protocols ranked by expected launch value — what the token would be worth, times the chance it ever launches — with launch odds, honest 80% intervals and costed farm plans, built from the DefiLlama snapshot. Model radar-5: a log-linear size law (market cap grows roughly with the square root of TVL, fitted slope 0.52), shrunk category levels and primary-chain adjustments (leave-one-out median error 1.24, vs 1.69 for v1 and 1.58 for v3), launch odds from the peers' record, every term kept or dropped on held-out data. The board's top values are about 6× lower than v3's because v3 assumed market cap was proportional to TVL and so overstated the largest protocols — not because the protocols shrank.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
