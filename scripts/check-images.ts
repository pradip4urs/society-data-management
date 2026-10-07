// Verify public registry manifests without a Docker daemon. This does not verify
// image runtime behavior; Compose still requires a Docker-enabled host.
export {};
const images = [
  "library/postgres:18.3-alpine",
  "library/redis:8.2.2-alpine",
  "chrislusf/seaweedfs:4.48",
  "axllent/mailpit:v1.27.8",
  "clamav/clamav:1.4.3",
];
for (const image of images) {
  const [repository, tag] = image.split(":");
  const auth = await fetch(
    `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`,
  );
  if (!auth.ok) throw new Error("Registry token unavailable");
  const { token } = await auth.json();
  const manifest = await fetch(
    `https://registry-1.docker.io/v2/${repository}/manifests/${tag}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:
          "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json",
      },
    },
  );
  console.log(
    image,
    manifest.status,
    manifest.headers.get("docker-content-digest") ?? "",
  );
  if (!manifest.ok) process.exitCode = 1;
}
