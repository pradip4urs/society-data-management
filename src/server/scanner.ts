import { connect } from "node:net";
function clamRequest(command: string, data?: Uint8Array): Promise<string> {
  return new Promise((done, reject) => {
    const socket = connect({
      host: process.env.CLAMAV_HOST ?? "clamav",
      port: Number(process.env.CLAMAV_PORT ?? 3310),
    });
    let result = "";
    socket.setTimeout(15000, () =>
      socket.destroy(new Error("Scanner timeout")),
    );
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      result += chunk.toString();
      if (result.length > 4096)
        socket.destroy(new Error("Invalid scanner response"));
    });
    socket.on("end", () => done(result.replace(/\0/g, "").trim()));
    socket.on("connect", () => {
      socket.write(`z${command}\0`);
      if (data) {
        for (let offset = 0; offset < data.length; offset += 65536) {
          const chunk = data.subarray(offset, offset + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}
export async function scannerReady() {
  const version = await clamRequest("VERSION");
  const signatureDate = new Date(version.split("/").at(-1) ?? "");
  if (
    !version.startsWith("ClamAV") ||
    !Number.isFinite(signatureDate.getTime()) ||
    Date.now() - signatureDate.getTime() > 7 * 86400000
  )
    throw new Error("Scanner signatures unavailable or stale");
}
export async function scanBytes(bytes: Uint8Array) {
  await scannerReady();
  const reply = await clamRequest("INSTREAM", bytes);
  if (reply.endsWith(" FOUND")) return false;
  if (!reply.endsWith(" OK")) throw new Error("Scanner did not confirm result");
  return true;
}
