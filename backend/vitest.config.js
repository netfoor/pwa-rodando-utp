import { defineConfig } from "vitest/config";

// Las pruebas usan una base PostgreSQL real (por defecto la de docker en el puerto 55432).
// Se fija en process.env para que también lo vea globalSetup (proceso principal).
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://rodando:rodando@localhost:55432/rodando_test";
process.env.DATABASE_SSL = "false";

export default defineConfig({
  test: {
    globalSetup: ["tests/globalSetup.js"],
    fileParallelism: false,
    testTimeout: 20000
  }
});
