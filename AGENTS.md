# Project rules

## Deploys and remote Cloudflare resources

- **Never deploy or mutate remote Cloudflare resources unless the user explicitly asks for it in the
  current turn.** Building, testing and local inspection are always fine.
- The only deploy target is the account pinned in `wrangler.jsonc` (`account_id`). A command must
  never reach another account.
- Deploy with `npm run deploy:prod`; check readiness without deploying with
  `npm run deploy:check`. There is intentionally no plain `deploy` script.
- Auth is per-directory via Wrangler profiles: `wrangler auth create <profile>` then
  `wrangler auth activate <profile> .` Re-run the activation if Wrangler starts using the wrong account.
- `CLOUDFLARE_API_TOKEN` overrides profiles, so it must not be set while deploying (unless
  `ALLOW_API_TOKEN=1` is passed on purpose).
- Never commit tokens, `.dev.vars`, or `.wrangler/` state. Remote D1 commands are remote mutations:
  ask first.

## Before finishing work

- `npm test` and `npm run build` must pass.
- Gameplay-facing changes should be verified in the browser (dev server, `?scene=` shortcuts) or by a
  unit test when UI is not involved.
