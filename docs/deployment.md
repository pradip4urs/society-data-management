# Single-host deployment runbook

## Host and storage

Use Ubuntu 24.04 LTS AMD64 with Docker Engine and Compose v2.24+ (tested Compose 5.5.1). Initial sizing recommendation: 4 vCPU, 8 GiB RAM, 100+ GiB encrypted persistent disk, subject to measured society load; ClamAV alone can use 2 GiB. One VM is a single failure domain. No managed Azure service or registry is needed.

Install Docker from its official Ubuntu repository, enable the daemon, install `age jq openssl curl git`, and checkout this repository at /opt/society. Docker membership is equivalent to host administrator access. Do not mount its socket into app containers. Keep Ubuntu/Docker/image updates on a reviewed schedule.

Mount an existing formatted data disk by UUID in /etc/fstab before running bootstrap; never format a disk containing data. Set DATA_ROOT and BACKUP_ROOT to the intended mounted paths. Confirm with `findmnt` and `df -h`. Named Docker volumes (PostgreSQL/Redis/ClamAV/Caddy) reside in Docker's data root: move that root onto the persistent disk through Docker's documented daemon configuration with the daemon stopped before first setup, or keep the persistent OS disk protected. Changing DATA_ROOT moves documents/status only, not named volumes. Record all volume locations in operations inventory.

Bootstrap creates UID/GID 1000 document mounts with mode 0700, root-owned secret parent 0700, file-mounted secrets readable by application UID, and status folder readable to web. Never recursively chown unrelated disks/directories. Run `sudo bash scripts/bootstrap.sh` once after configuring .env; repeated runs preserve existing secrets.

## Local HTTPS

Copy .env.compose.example to .env (do not overwrite a native development .env). Defaults use localhost and Caddy's internal CA. If Windows reserves ports, set HTTP_PORT=8088, HTTPS_PORT=8443 and APP_URL=https://localhost:8443. Base Compose publishes proxy ports to loopback only. WSL requires Docker Desktop WSL integration; run Bash scripts inside the enabled distro and use Linux filesystem paths with UID 1000 ownership where possible.

Run `bash scripts/deploy.sh`. Extract ONLY the public root certificate:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt
# Ubuntu trust (local testing only):
sudo cp caddy-local-root.crt /usr/local/share/ca-certificates/society-local.crt
sudo update-ca-certificates
CURL_CA_BUNDLE=$PWD/caddy-local-root.crt bash scripts/verify.sh
```

On Windows import the public root into the current user's Trusted Root store: `Import-Certificate -FilePath .\caddy-local-root.crt -CertStoreLocation Cert:\CurrentUser\Root`. Chrome/Edge use the OS trust; Firefox may require explicit certificate import. Keep Caddy's private CA key in its volume; do not distribute it. Automated disposable Playwright rehearsal uses ignoreHTTPSErrors explicitly; interactive trust instructions are separate. APP_URL must exactly match the browser origin, including port.

## First administrator / local accounts

No default password and no email service. After migrations, provide a strong unique password without shell history or Docker environment exposure:

Run `bash scripts/first-admin.sh` in an interactive Bash/WSL terminal for guided society/name/email prompts and a private confirmed password prompt. It uses the selected `.env`/ENV_FILE and does not store the password in a file or command arguments. The equivalent manual command is:

```bash
read -rsp 'First admin password: ' bootstrap_password; echo
printf '%s' "$bootstrap_password" | docker compose run --rm -T \
  -e BOOTSTRAP_SOCIETY_NAME='Your Society' -e BOOTSTRAP_ADMIN_NAME='Administrator' \
  -e BOOTSTRAP_ADMIN_EMAIL='admin@your-domain.example' operator node dist/bootstrap-admin.js
unset bootstrap_password
```

Password minimum 16 characters. Bootstrap serializes in PostgreSQL and refuses an already populated installation. Sign in and enroll TOTP before ADMIN/CASHIER/AUDITOR business access. Save recovery codes securely when generated; only hashes are retained, and consumed codes cannot be replayed.

Check setup status without supplying a password: `docker compose run --rm -T operator node dist/bootstrap-admin.js --check`. If initialized, bootstrap cannot create another first admin or reset a password. Provision an additional account in the existing society instead:

```bash
read -rsp 'New administrator password: ' admin_password; echo
printf '%s' "$admin_password" | docker compose run --rm -T \
  -e PROVISION_NAME='Administrator' -e PROVISION_EMAIL='your-admin@example.test' \
  -e PROVISION_SOCIETY_ID='existing-society-id' -e PROVISION_ROLE=ADMIN \
  operator node dist/provision-user.js
unset admin_password
```

Find the existing society ID in the administrator UI or through the trusted host DB console. Provisioning does not rename the society or transfer records. A separate empty installation must use a distinct COMPOSE_PROJECT_NAME, document root, secret directory and unused proxy ports; do not delete old volumes to make bootstrap succeed. Updating example values in this document does not update persisted accounts. Bootstrap errors identify invalid setting names without exposing password values.

Provision later local accounts similarly using `operator node dist/provision-user.js`, password on stdin and PROVISION_EMAIL/NAME/SOCIETY_ID/ROLE/PERSON_ID environment options. Resident membership alone grants no flat access; admin creates explicit dated grants, linked to occupancy for move-out revocation. Profile phone approval is separate from a resident's self-edited phone.

Trusted account recovery requires documented identity verification through society-approved evidence and a separate authorized operator. Never reset MFA based solely on an email/name. Record a ticket/reason and operator identity:

```bash
docker compose run --rm -T -e RECOVERY_EMAIL='verified-account@example.test' \
  -e RECOVERY_OPERATOR='authorized-operator-id' -e RECOVERY_REASON='Verified in-person identity; ticket ABC123' \
  operator node dist/recover-account.js
```

This transaction resets MFA and revokes sessions, audits each membership, and forces privileged MFA re-enrollment. It does not change password or memberships. Legacy Stage 1 encrypted recovery codes must be regenerated through verified MFA enrollment before relying on recovery; old codes are not accepted by hash storage.

## Azure Ubuntu public VM

Configure a DNS A record to the VM's static public IP (AAAA only with working IPv6). Set DEPLOYMENT_MODE=public, SITE_ADDRESS=society.yourdomain.example, APP_URL=https://society.yourdomain.example. `compose.production.yaml` publishes only Caddy 80/443 on all interfaces and disables internal TLS so Caddy obtains public ACME certificates. In Azure NSG allow 80/443 and restrict SSH22 to trusted operator IPs; mirror that in UFW. Docker published ports can bypass UFW, so inspect the actual Compose published ports and use NSG as the perimeter. Never expose PostgreSQL5432/Redis6379/ClamAV3310/web3000. Do not apply the dev override.

Caddy needs DNS and outbound ACME access; ClamAV needs DNS and HTTPS to database.clamav.net (CDN) plus its normal signature DNS checks. Only scanner_updates has separate update egress; worker backend is internal. Stop uploads if signature updates fail/stale. No provider payment/email/SMS credentials are required. Backends use local private networks; host administrators remain trusted.

## Release / migration / image transfer

Run tests before release; create a verified encrypted backup before upgrade. `deploy.sh` takes a host flock shared with backup/restore, builds compiled images (or BUILD_IMAGES=0 for loaded images), starts DB/Redis and verifies credentials, then stops traffic/web/worker, migrates exactly once using owner credentials and starts healthy containers. Migration failure leaves traffic stopped intentionally. Runtime role cannot create schema objects/update audits. App/worker entrypoints never migrate. No demo seed is part of deployment.

Deployment checks actual TCP authentication for the database owner/runtime and Redis before stopping app traffic. PostgreSQL readiness alone does not validate passwords. Bootstrap refuses to generate missing secrets when the selected Compose project already has a PostgreSQL volume.

### P1000 / existing-volume secret mismatch

The PostgreSQL image applies POSTGRES_PASSWORD_FILE only when initializing an empty volume. Changing `.env`/SECRETS_DIR or regenerating secret files does not change credentials stored in an existing database. A newly generated auth secret also cannot decrypt existing TOTP data. Restore the original secret files and set SECRETS_DIR to their directory; keep DATA_ROOT pointing at the documents that belong to that database. Retry `BUILD_IMAGES=0 bash scripts/deploy.sh` if the existing compiled images are current.

Use the same ENV_FILE and COMPOSE_PROJECT_NAME consistently across bootstrap/deploy/backup. A separate fresh installation requires a distinct Compose project, DATA_ROOT, secrets and unused proxy ports. Do not use `docker compose down -v` to fix authentication: it deletes persisted data. If original secrets are unavailable, use the documented trusted recovery/escrow process; do not assume new secret files restore MFA or database access.

Use immutable RELEASE_TAG values and keep prior images. Building on ARM targets linux/amd64 via Compose build platforms. Transfer without a registry:

```bash
docker compose --profile tools build web worker operator
docker save -o society-release.tar society-web:YOUR_TAG society-worker:YOUR_TAG society-operator:YOUR_TAG
sha256sum society-release.tar > society-release.tar.sha256
# Transfer repository + images to VM using scp, verify checksum there, then:
docker load -i society-release.tar
BUILD_IMAGES=0 bash scripts/deploy.sh
```

Pull pinned infrastructure images on target or include them in save/load for disconnected transfer. Log rotation is 10 MiB × 3 per container. Web/worker run non-root/read-only with private mounts and temporary directories. Production rejects development MFA bypass and mock-payment flags. Secret values are never copied into image build context.

## Upgrade / rollback / monitoring

Prefer additive backward-compatible migrations. Before upgrading: backup, test fresh restore, note release/schema IDs, verify free disk and health, then deploy/verify plus business smoke. Monitor disk space, backup age/failure in admin Audit trail, scanner freshness, restart/error counts, and DB availability. External monitoring is optional; host systemd timers/journald and Docker logs suffice initially. Do not log request bodies/PII or passwords.

App-image rollback is allowed only with compatible schema: set prior RELEASE_TAG, BUILD_IMAGES=0 and redeploy. Destructive schema changes may require restoration to a fresh stack; writes after the backup can be lost. No automatic lossless destructive rollback is promised. Preserve the original stack/evidence; compare restored invariants before DNS/proxy cutover. See backup-restore.md.

Azure VM deployment, real domain ACME, independent security/accessibility, large-society load and full financial acceptance remain unverified until run on the actual host.
