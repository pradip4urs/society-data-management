export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("./server/config");
    assertProductionConfig();
  }
}
