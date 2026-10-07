import { afterAll, expect, it } from "vitest";
import { createServer, type Socket } from "node:net";
import { scannerReady, scanBytes } from "@/server/scanner";
const sockets = new Set<Socket>();
let stale = false;
const server = createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  let input = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    input = Buffer.concat([input, chunk]);
    if (input.toString().startsWith("zVERSION\0"))
      socket.end(
        `ClamAV 1.4.6/28146/${stale ? "Sun Mar 1 07:24:39 2026" : new Date().toUTCString()}\0`,
      );
    else if (
      input.length >= 10 &&
      input.subarray(0, 10).toString() === "zINSTREAM\0"
    ) {
      let offset = 10;
      const chunks: Buffer[] = [];
      while (offset + 4 <= input.length) {
        const size = input.readUInt32BE(offset);
        offset += 4;
        if (!size) {
          socket.end(
            Buffer.concat(chunks).includes(Buffer.from("EICAR"))
              ? "stream: Eicar-Test-Signature FOUND\0"
              : "stream: OK\0",
          );
          return;
        }
        if (offset + size > input.length) return;
        chunks.push(input.subarray(offset, offset + size));
        offset += size;
      }
    }
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.CLAMAV_HOST = "127.0.0.1";
process.env.CLAMAV_PORT = String((server.address() as { port: number }).port);
afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it("uses the bounded ClamAV INSTREAM protocol and refuses stale signatures", async () => {
  await expect(scanBytes(Buffer.alloc(200000, 1))).resolves.toBe(true);
  await expect(scanBytes(Buffer.from("%PDF-1.7 EICAR"))).resolves.toBe(false);
  stale = true;
  await expect(scannerReady()).rejects.toThrow("stale");
});
