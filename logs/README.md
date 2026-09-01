# logs

`arcads-api.jsonl` — one JSON line per Arcads generation call (model, params,
`creditsCharged`, asset id). The `arcads-external-api` skill reads this file as
its primary source for credit-cost estimates, so keep it committed.
