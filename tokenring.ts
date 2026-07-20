#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import TokenRingApp, { PluginManager } from "@tokenring-ai/app";
import { buildTokenRingAppConfigLayers } from "@tokenring-ai/app/buildTokenRingAppConfig";
import ConfigurationService from "@tokenring-ai/app/config/ConfigurationService";
import type { BunStorageConfigSchema } from "@tokenring-ai/bun-storage";
import type { FileSystemConfigSchema } from "@tokenring-ai/filesystem/schema";
import type { TerminalConfigSchema } from "@tokenring-ai/terminal/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import type { WebHostConfigSchema } from "@tokenring-ai/web-host/schema";
import { secrets } from "bun";
import chalk from "chalk";
import { Command } from "commander";
import type { z } from "zod";
import config from "./config/index.ts";
import packageInfo from "./package.json" with { type: "json" };
import { configSchema, plugins } from "./plugins.ts";

// Interface definitions
interface CommandOptions {
  projectDirectory: string;
  dataDirectory: string;
  listen: string;
  port: string;
  auth: boolean;
  vaultFile: string;
}

const homeDirectory = process.env.HOME || "/home/" + process.env.USER || "/root";

// Create a new Commander program
const program = new Command();

program
  .name("tokenring")
  .description("TokenRing One - AI-powered personal assistant")
  .version(packageInfo.version)
  .option("--projectDirectory <path>", "Path to the working directory to work in (default: cwd)", ".")
  .option(
    "--dataDirectory <path>",
    "Path to the data directory to use to store data (knowledge, session database, etc.) (default: <projectDirectory>/.tokenring)",
    "",
  )
  .option("--listen <host>", "Host interface the HTTP server binds to", "127.0.0.1")
  .option("--port <port>", "Port the HTTP server listens on (0 picks a random free port)", "0")
  .option(
    "--vaultFile <path>",
    "Path to the vault file for storing secrets. Password is read from the system secrets manager (auto-generated on first run) or TR_VAULT_PASSWORD.",
    `${homeDirectory}/.config/tokenring/secrets.vault`,
  )
  .addHelpText(
    "after",
    `
Examples:
  tokenring
  tokenring --projectDirectory ./my-app --dataDirectory ./my-data
  tokenring --listen 127.0.0.1 --port 3000
`,
  )
  .action(runApp)
  .parse();

async function runApp({ projectDirectory, dataDirectory, listen, port, vaultFile }: CommandOptions): Promise<void> {
  try {
    projectDirectory = path.resolve(projectDirectory);
    dataDirectory = path.resolve(dataDirectory || path.join(projectDirectory, "/.tokenring"));
    const configDirectory = path.join(os.homedir(), "/.config/tokenring");
    if (!fs.existsSync(configDirectory)) {
      fs.mkdirSync(configDirectory, { recursive: true });
    }

    const adminUser = process.env.TR_ADMIN_USER || "admin";
    let adminPassword = process.env.TR_ADMIN_PASSWORD;

    if (!adminPassword) {
      adminPassword = (await secrets.get({ service: "tokenring", name: "adminPassword" })) ?? undefined;
    }

    if (!adminPassword) {
      adminPassword = randomBytes(12).toString("hex");
      console.log(`A admin password was not provided in TR_ADMIN_PASSWORD.\nUsing login/password ${adminUser}/${adminPassword}`);

      try {
        await secrets.set({ service: "tokenring", name: "adminPassword", value: adminPassword });
        console.log(`Admin password stored in system keychain. Please copy the password above as it will not be displayed again.`);
      } catch (err) {
        console.error(`Failed to store admin password in keychain, password will reset at every application restart: ${formatError(err)}`);
      }
    }

    const listenPort = parseInt(port, 10);
    if (Number.isNaN(listenPort) || listenPort < 0 || listenPort > 65535) {
      console.error(`Invalid port number: ${port}`);
      process.exit(1);
    }

    const frontendDirectory = path.resolve(process.env.FRONTEND_DIRECTORY || path.resolve(import.meta.dirname, "./frontend"));

    if (!fs.existsSync(frontendDirectory)) {
      console.error(`Frontend directory not found: ${frontendDirectory}`);
      process.exit(1);
    }

    const defaultConfig = {
      app: {
        configDirectories: [path.join(homeDirectory, "configs"), path.join(dataDirectory, "configs")],
        dataDirectory,
        printLogs: true,
      },
      checkpoint: {
        app: {
          projectDirectory,
        },
      },
      oneFrontend: {
        spaDirectory: path.resolve(frontendDirectory, "one"),
      },
      mediaLibrary: {
        agentDefaults: {
          outputDirectory: path.join(dataDirectory, "media-library"),
        },
      },
      research: {
        researchDirectory: path.join(dataDirectory, "research"),
      },
      imageGeneration: {
        agentDefaults: {},
      },
      videoGeneration: {
        defaultModels: ["*"],
        agentDefaults: {},
      },
      filesystem: {
        agentDefaults: {
          provider: "posix",
          workingDirectory: projectDirectory,
        },
      } satisfies z.input<typeof FileSystemConfigSchema>,
      terminal: {
        agentDefaults: {
          provider: "posix",
          workingDirectory: projectDirectory,
        },
      } satisfies z.input<typeof TerminalConfigSchema>,
      bunStorage: {
        connectionString: `sqlite://${path.resolve(configDirectory, "./database.sqlite")}`,
      } satisfies z.input<typeof BunStorageConfigSchema>,
      webHost: {
        host: listen,
        port: listenPort,
        auth: {
          users: {
            [adminUser]: {
              password: adminPassword,
            },
          },
        },
      } satisfies z.input<typeof WebHostConfigSchema>,
      vault: {
        vaultFile,
      },
    } satisfies Partial<z.input<typeof configSchema>>;

    const mergedConfig = deepClone(defaultConfig, config) as unknown;
    const parsedConfig = configSchema.parse(mergedConfig);

    const userOverridesFile = path.join(os.homedir(), ".tokenring", "config.yaml");
    const { config: appConfig, baseConfig, overrides, overlayError } = await buildTokenRingAppConfigLayers(configSchema, parsedConfig, { userOverridesFile });

    const app = new TokenRingApp(appConfig);

    app.addServices(
      new ConfigurationService(app, {
        configSchema,
        baseConfig,
        overridesFile: userOverridesFile,
        overrides,
        overlayError,
      }),
    );

    const pluginManager = new PluginManager(app);

    await pluginManager.installPlugins(plugins);

    await app.run();
  } catch (err) {
    process.stdout.write("\u001B[2J\u001B[H\n\n");
    console.error(chalk.red(formatError(err)));
  }
}
