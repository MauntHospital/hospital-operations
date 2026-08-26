import dotenv from "dotenv";

dotenv.config({ path: process.env.LOCAL_ENV_FILE ?? ".env.local" });

const { runOperationalCycle } = await import("../server/operationsData");

try {
  const result = await runOperationalCycle();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error("Local operational cycle failed", error);
  process.exitCode = 1;
}
