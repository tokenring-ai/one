#!/usr/bin/env bun

import { createHash, randomBytes } from "node:crypto";
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
  publicUrl?: string;
  /** Commander sets this to false for `--no-access-qr`. */
  accessQr: boolean;
}

const homeDirectory = os.homedir();

/**
 * Default workspace location: out of the launch tree, keyed by launch path so
 * each project keeps its own workspace (config, sessions, media) under
 * ~/.tokenring/workspaces. Pass --workspaceDirectory to override.
 */
function defaultWorkspaceDirectory(launchDirectory: string): string {
  const slug = (path.basename(launchDirectory) || "root").replace(/[^\w.-]+/g, "-").slice(0, 40);
  const hash = createHash("sha256").update(launchDirectory).digest("hex").slice(0, 8);
  return path.join(os.homedir(), ".tokenring", "workspaces", `${slug}-${hash}`);
}

// Create a new Commander program
const program = new Command();

program
  .name("tokenring")
  .description("TokenRing One - AI-powered personal assistant")
  .version(packageInfo.version)
  .option("--workingDirectory <path>", "Directory to launch in; seeds the default allowed path for agents (default: cwd)", ".")
  .option(
    "--workspaceDirectory <path>",
    "Path to the directory to use to store data (knowledge, session database, etc.) (default: ~/.tokenring/workspaces/<name>-<hash of launch dir>)",
  )
  .option("--listen <host>", "Host interface the HTTP server binds to", "127.0.0.1")
  .option("--port <port>", "Port the HTTP server listens on (0 picks a random free port)", "0")
  .option(
    "--vaultFile <path>",
    "Path to the vault file for storing secrets. Password is read from the system secrets manager (auto-generated on first run) or TR_VAULT_PASSWORD.",
    `${homeDirectory}/.config/tokenring/secrets.vault`,
  )
  .option(
    "--public-url <url>",
    "Address people outside this machine use to reach the app (Docker port mappings, reverse proxies). Used for access links and QR codes. Also TR_PUBLIC_URL.",
  )
  .option("--no-access-qr", "Do not print the remote-access sign-in link and QR code at startup")
  .addHelpText(
    "after",
    `
Examples:
  tokenring
  tokenring --workingDirectory ./my-app --workspaceDirectory ./my-data
  tokenring --listen 127.0.0.1 --port 3000
  tokenring --listen 0.0.0.0 --port 3000     (prints a QR code to sign in from a phone)
`,
  )
  .action(runApp)
  .parse();

function publicUrlProblem(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "it must start with http:// or https://";
    if (url.username || url.password) return "it must not contain a username or password";
    if (url.search || url.hash) return "it must not contain a ? query or # fragment";
    return null;
  } catch {
    return "it is not a valid URL, for example https://tokenring.example.com";
  }
}

/** Creates a folder the app needs, turning "not allowed" into something a person can act on. */
function createDirectory(directory: string): void {
  try {
    fs.mkdirSync(directory, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EACCES" && code !== "EPERM") throw error;
    const user = typeof process.getuid === "function" ? `user id ${process.getuid()}` : "this user";
    console.error(
      `Cannot create ${directory}: ${user} is not allowed to write there.\n` +
        "Its parent folder belongs to someone else. In a container, this usually means a volume created by an older image " +
        "(which ran as root) or a mount owned by another user: change the owner of the volume to the user the container runs as " +
        "(see the Docker section of the docs), or start the container with --user set to the owner.",
    );
    process.exit(1);
  }
}

async function runApp({ workingDirectory, workspaceDirectory, listen, port, vaultFile, publicUrl, accessQr }: CommandOptions): Promise<void> {
  let app: TokenRingApp | undefined;

  // Docker stop / systemd / Ctrl+C must reach TokenRingApp.shutdown instead of
  // hard-killing the process mid-request.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, shutting down...`);
      app?.shutdown(`Received ${signal}`);
      // Services get a grace period via the abort signal; force-exit as a backstop.
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }

  try {
    workingDirectory = path.resolve(workingDirectory);

    if (!fs.existsSync(workingDirectory)) {
      console.error(`Working directory does not exist: ${workingDirectory}`);
      process.exit(1);
    }
    process.chdir(workingDirectory);

    workspaceDirectory = path.resolve(workspaceDirectory || defaultWorkspaceDirectory(workingDirectory));

    if (!fs.existsSync(workspaceDirectory)) {
      console.log(`Workspace directory does not exist, creating: ${workspaceDirectory}`);
      createDirectory(workspaceDirectory);
    }

    const configDirectory = path.join(os.homedir(), "/.config/tokenring");
    if (!fs.existsSync(configDirectory)) {
      console.log(`Config directory does not exist, creating: ${configDirectory}`);
      createDirectory(configDirectory);
    }

    const publicUrlSetting = (publicUrl ?? process.env.TR_PUBLIC_URL)?.trim() || undefined;
    if (publicUrlSetting) {
      const problem = publicUrlProblem(publicUrlSetting);
      if (problem) {
        console.error(`Invalid public URL "${publicUrlSetting}": ${problem}`);
        process.exit(1);
      }
    }

    const adminUser = process.env.TR_ADMIN_USER || "admin";
    let adminPassword = process.env.TR_ADMIN_PASSWORD;

    if (!adminPassword) {
      try {
        adminPassword = (await secrets.get({ service: "tokenring", name: "adminPassword" })) ?? undefined;
      } catch {
        // No system keychain (a container, a server with no secret service): nothing is stored. Fall through so the
        // messages below explain what to do, instead of dying with "libsecret not available".
      }
    }

    if (!adminPassword) {
      adminPassword = randomBytes(12).toString("hex");
      const storePassword = () => secrets.set({ service: "tokenring", name: "adminPassword", value: adminPassword! });

      if (process.stdout.isTTY) {
        console.log(`An admin password was not provided in TR_ADMIN_PASSWORD.\nUsing login/password ${adminUser}/${adminPassword}`);
        try {
          await storePassword();
          console.log("Admin password stored in the system keychain. Please copy the password above; it will not be displayed again.");
        } catch (err) {
          console.error(`Failed to store admin password in keychain, password will reset at every application restart: ${formatError(err)}`);
        }
      } else {
        // stdout is a log file or journal — printing the credential there would
        // persist it for anyone with log access.
        try {
          await storePassword();
          console.log(
            "Generated an admin password and stored it in the system keychain (service 'tokenring', item 'adminPassword'). " +
              "Retrieve it from the keychain, or set TR_ADMIN_PASSWORD to choose your own.",
          );
        } catch (err) {
          console.error(
            "No TR_ADMIN_PASSWORD is set, stdout is not a terminal, and the system keychain is unavailable, " +
              `so the generated admin password cannot be disclosed or stored: ${formatError(err)}\n` +
              "Set TR_ADMIN_PASSWORD (or run attached to a terminal once) and restart.",
          );
          process.exit(1);
        }
      }
    }

    const listenPort = parseInt(port, 10);
    if (Number.isNaN(listenPort) || listenPort < 0 || listenPort > 65535) {
      console.error(`Invalid port number: ${port}`);
      process.exit(1);
    }

    const defaultConfig = {
      app: {
        configDirectories: [path.join(homeDirectory, ".config", "tokenring", "configs"), path.join(workspaceDirectory, "configs")],
        workingDirectory,
        workspaceDirectory,
        printLogs: true,
      },
      filesystem: {
        allowedPaths: [
          {
            path: workingDirectory,
            permission: "write",
            description: "Launch directory",
          },
        ],
      } satisfies z.input<typeof FileSystemConfigSchema>,
      terminal: {
        agentDefaults: {
          provider: "posix",
        },
      } satisfies z.input<typeof TerminalConfigSchema>,
      webHost: {
        host: listen,
        port: listenPort,
        ...(publicUrlSetting ? { publicUrl: publicUrlSetting } : {}),
        // Printed only on a terminal and a network-reachable address; see plugin/web-host/startupAccess.ts.
        printAccessLink: accessQr,
        auth: {
          users: {
            [adminUser]: {
              password: adminPassword,
              role: "admin",
            },
          },
          // Accounts created in the web UI live beside the vault file, so they work while the vault is locked.
          usersFile: path.join(configDirectory, "users.json"),
        },
      } satisfies z.input<typeof WebHostConfigSchema>,
      vault: {
        vaultFile,
      },
    } satisfies Partial<z.input<typeof configSchema>>;

    const mergedConfig = deepClone(defaultConfig, config) as unknown;
    const parsedConfig = configSchema.parse(mergedConfig);

    const globalConfigFile = path.join(os.homedir(), ".tokenring", "config.yaml");
    const workspaceConfigFile = path.join(workspaceDirectory, "config.yaml");
    const { appConfig, globalConfig, workspaceConfig, overlayError } = await buildTokenRingAppConfigLayers(configSchema, parsedConfig, {
      globalConfigFile: globalConfigFile,
      workspaceConfigFile: workspaceConfigFile,
    });

    app = new TokenRingApp(appConfig, { globalConfig, workspaceConfig });

    app.addService(
      ConfigurationService,
      new ConfigurationService(app, {
        configSchema,
        overridesFiles: { global: globalConfigFile, workspace: workspaceConfigFile },
        overlayError,
      }),
    );

    const pluginManager = app.addService(PluginManager, new PluginManager(app));

    await pluginManager.installPlugins(plugins);

    await app.run();
  } catch (err) {
    process.stdout.write("\u001B[2J\u001B[H\n\n");
    console.error(chalk.red(formatError(err)));
    // Fatal startup errors must be visible to supervisors, CI, and scripts.
    process.exit(1);
  }
}
