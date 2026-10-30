# SSRF: evidence URL handling

Evidence URLs are untrusted input that every validator will fetch. Without
controls, a reporter could make validators fetch cloud metadata endpoints or
internal admin panels. This is the single most dangerous bug class in the
project (§33.2, SEC-001..003).

## Controls (all mandatory)

1. Only `https://`, port 443, no userinfo.
2. Host must match the deploy-time allowlist; wildcard only for a leading
   `*.` subdomain.
3. DNS is resolved **after** the allowlist match and private/link-local/
   loopback/metadata ranges are rejected.
4. Redirects to non-allowlisted hosts are refused; at most 2 redirects, each
   re-checked.
5. IP literals are rejected entirely, including decimal, octal, hex, and
   IPv4-mapped IPv6 forms.
6. Bytes read are capped at 40 KB total, not just bytes stored.
7. No URL reaches a fetch without passing all of the above.

## Test matrix (SEC-001, EVD-010)

`127.0.0.1`, `localhost`, `[::1]`, `169.254.169.254`, `10.0.0.1`,
`192.168.0.1`, `172.16.0.1`, `0.0.0.0`, `2130706433`, `0x7f000001`,
`[::ffff:127.0.0.1]`, redirect chains, and DNS-rebinding simulation.

## What verification cannot prove

Verification (§21) proves which code is running, not that the allowlist is
correct for every deployment. Review the allowlist in
`deployments/<network>.json` (`evidenceAllowlistHash`) before trusting a
deployment.
