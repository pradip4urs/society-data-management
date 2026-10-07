#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
dc config --quiet
for service in postgres redis web worker caddy; do
  id=$(dc ps -q "$service")
  [[ -n "$id" && $(docker inspect -f '{{.State.Running}}' "$id") == true ]] || { echo "Service unavailable: $service" >&2; exit 1; }
done
dc exec -T web node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>{if(!r.ok)process.exit(1)})'
curl --fail --silent --show-error "${APP_URL}/api/health"
echo
for service in postgres redis clamav web worker; do
  id=$(dc ps -q "$service")
  [[ -z $(docker port "$id") ]] || { echo "Unexpected published port: $service" >&2; exit 1; }
done
dc exec -T worker node -e 'fetch("http://web:3000/api/health").then(r=>{if(!r.ok)process.exit(1)})'
dc exec -T clamav clamdcheck.sh
dc exec -T web node -e 'const s=require("net").connect({host:"clamav",port:3310});let v="";s.setTimeout(15000,()=>{s.destroy();process.exit(1)});s.on("connect",()=>s.write("zVERSION\0"));s.on("data",b=>v+=b);s.on("end",()=>{const date=new Date(v.replace(/\0/g,"").trim().split("/").at(-1));if(!Number.isFinite(+date)||Date.now()-date>7*86400000){console.error("Scanner signatures stale: uploads remain blocked");process.exit(1)}});s.on("error",()=>process.exit(1))'
echo 'Health/TLS/private ports/scanner verified. Business acceptance tests remain separately required.'
