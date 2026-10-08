#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

[[ -r /dev/tty ]] || { echo 'Run this command in an interactive terminal so the password stays private.' >&2; exit 1; }
dc run --rm -T operator node dist/bootstrap-admin.js --check

society_name=${BOOTSTRAP_SOCIETY_NAME:-}
admin_name=${BOOTSTRAP_ADMIN_NAME:-}
admin_email=${BOOTSTRAP_ADMIN_EMAIL:-}
[[ -n "$society_name" ]] || read -r -p 'Society name: ' society_name </dev/tty
[[ -n "$admin_name" ]] || read -r -p 'Administrator name: ' admin_name </dev/tty
[[ -n "$admin_email" ]] || read -r -p 'Administrator email: ' admin_email </dev/tty
read -r -s -p 'Admin password (16–128 characters): ' admin_password </dev/tty
printf '\n' >/dev/tty
read -r -s -p 'Confirm password: ' confirmation </dev/tty
printf '\n' >/dev/tty
if [[ "$admin_password" != "$confirmation" ]]; then
  unset admin_password confirmation
  echo 'Passwords do not match. No account created.' >&2
  exit 1
fi
if ((${#admin_password} < 16 || ${#admin_password} > 128)); then
  unset admin_password confirmation
  echo 'Password must contain 16–128 characters. No account created.' >&2
  exit 1
fi
unset confirmation
trap 'unset admin_password' EXIT
printf '%s' "$admin_password" | dc run --rm -T \
  -e "BOOTSTRAP_SOCIETY_NAME=$society_name" \
  -e "BOOTSTRAP_ADMIN_NAME=$admin_name" \
  -e "BOOTSTRAP_ADMIN_EMAIL=$admin_email" \
  operator node dist/bootstrap-admin.js
