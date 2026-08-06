#!/usr/bin/env bun

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import TokenRingApp, { PluginManager } from "@tokenring-ai/app";
import { buildTokenRingAppConfigLayers } from "@tokenring-ai/app/buildTokenRingAppConfig";
import ConfigurationService from "@tokenring-ai/app/config/ConfigurationService";
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
  workingDirectory: string;
  workspaceDirectory: string;
  listen: string;
  port: string;
  vaultFile: string;
}

const homeDirectory = process.env.HOME || "/home/" + process.env.USER || "/root";

// Create a new Commander program
const program = new Command();

program
  .name("tokenring")
  .description("TokenRing One - AI-powered personal assistant")
  .version(packageInfo.version)
  .option("--workingDirectory <path>", "Path to the directory to work in (default: cwd)", ".")
  .option(
    "--workspaceDirectory <path>",
    "Path to the directory to directory to use to store data (knowledge, session database, etc.) (default: <workingDirectory>/.tokenring)",
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
  tokenring --workingDirectory ./my-app --workspaceDirectory ./my-data
  tokenring --listen 127.0.0.1 --port 3000
`,
  )
  .action(runApp)
  .parse();

async function runApp({ workingDirectory, workspaceDirectory, listen, port, vaultFile }: CommandOptions): Promise<void> {
  try {
    workingDirectory = path.resolve(workingDirectory);
    process.chdir(workingDirectory);

    if (!fs.existsSync(workingDirectory)) {
      console.error(`Working directory does not exist: ${workingDirectory}`);
      process.exit(1);
    }

    workspaceDirectory = path.resolve(workspaceDirectory || path.join(workingDirectory, "/.tokenring"));

    if (!fs.existsSync(workspaceDirectory)) {
      console.log(`Workspace directory does not exist, creating: ${workspaceDirectory}`);
      fs.mkdirSync(workspaceDirectory, { recursive: true });
    }

    const configDirectory = path.join(os.homedir(), "/.config/tokenring");
    if (!fs.existsSync(configDirectory)) {
      console.log(`Config directory does not exist, creating: ${configDirectory}`);
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

    const defaultConfig = {
      app: {
        configDirectories: [path.join(homeDirectory, "configs"), path.join(workspaceDirectory, "configs")],
        workingDirectory,
        workspaceDirectory,
        printLogs: true,
      },
      filesystem: {
        agentDefaults: {
          provider: "posix",
        },
      } satisfies z.input<typeof FileSystemConfigSchema>,
      terminal: {
        agentDefaults: {
          provider: "posix",
        },
      } satisfies z.input<typeof TerminalConfigSchema>,
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

    const globalConfigFile = path.join(os.homedir(), ".tokenring", "config.yaml");
    const workspaceConfigFile = path.join(workspaceDirectory, ".tokenring", "config.yaml");
    const { appConfig, globalConfig, workspaceConfig, overlayError } = await buildTokenRingAppConfigLayers(configSchema, parsedConfig, {
      globalConfigFile: globalConfigFile,
      workspaceConfigFile: workspaceConfigFile,
    });

    const app = new TokenRingApp(appConfig, { globalConfig, workspaceConfig });

    app.addService(
      new ConfigurationService(app, {
        configSchema,
        overridesFiles: { global: globalConfigFile, workspace: workspaceConfigFile },
        overlayError,
      }),
    );

    const pluginManager = app.addService(new PluginManager(app));

    await pluginManager.installPlugins(plugins);

    await app.run();
  } catch (err) {
    process.stdout.write("\u001B[2J\u001B[H\n\n");
    console.error(chalk.red(formatError(err)));
  }
}
