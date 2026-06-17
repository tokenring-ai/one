#!/usr/bin/env node

import deepClone from "@tokenring-ai/utility/object/deepClone";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ACPConfigSchema } from "@tokenring-ai/acp";
import TokenRingApp, { PluginManager } from "@tokenring-ai/app";
import buildTokenRingAppConfig from "@tokenring-ai/app/buildTokenRingAppConfig";
import type { CLIConfigSchema } from "@tokenring-ai/cli";
import type { DrizzleStorageConfigSchema } from "@tokenring-ai/drizzle-storage/schema";
import type { FileSystemConfigSchema } from "@tokenring-ai/filesystem/schema";
import type { TerminalConfigSchema } from "@tokenring-ai/terminal/schema";
import formatLogMessages from "@tokenring-ai/utility/string/formatLogMessage";
import type { WebHostAuthConfig, WebHostConfigSchema } from "@tokenring-ai/web-host/schema";
import chalk from "chalk";
import { Command } from "commander";
import type { z } from "zod";
import packageInfo from "./package.json" with { type: "json" };
import bannerCompact from "./banner.compact.txt" with { type: "text" };
import bannerNarrow from "./banner.narrow.txt" with { type: "text" };
import bannerWide from "./banner.wide.txt" with { type: "text" };
import config from "./config/index.ts";
import { configSchema, plugins } from "./plugins.ts";

// Interface definitions
interface CommandOptions {
  projectDirectory: string;
  dataDirectory: string;
  acp: boolean;
  http?: string | undefined;
  auth: boolean;
  vault?: string | true;
  ui: "cli" | "none";
  agent: string;
  p: boolean;
  args: string[];
}

const homeDirectory = process.env.HOME || "/home/" + process.env.USER || "/root";

// Create a new Commander program
const program = new Command();

program
  .name("tokenring")
  .description("TokenRing One - AI-powered personal assistant")
  .version(packageInfo.version)
  .option("--ui <cli|none>", "Select the UI to use for the application", "cli")
  .option("--projectDirectory <path>", "Path to the working directory to work in (default: cwd)", ".")
  .option(
    "--dataDirectory <path>",
    "Path to the data directory to use to store data (knowledge, session database, etc.) (default: <projectDirectory>/.tokenring)",
    "",
  )
  .option("--acp", "Start the app in ACP mode over stdin/stdout")
  .option(
    "--http [host:port]",
    "Starts an HTTP server for interacting with the application, by default listening on 127.0.0.1 and a random port, unless host and port are specified",
  )
  .option("--auth", "Require authentication for the webui (tokens must be provided via TR_AUTH_PASSWORD or TR_AUTH_BEARER environment variables)")
  .option("--agent <type>", "Agent type to start with", "code")
  .option(
    "--vault [path]",
    "Use a vault file for storing secrets. The vault password will be prompted for at startup, or can be provided from TR_VAULT_PASSWORD. (default: ~/.tokenring/secrets.vault)",
  )
  .option("-p", "Enable shutdown when done")
  .allowExcessArguments(true)
  .addHelpText(
    "after",
    `
Examples:
  tokenring
  tokenring --projectDirectory ./my-app --dataDirectory ./my-data
  tokenring --acp --projectDirectory ./my-app
  tokenring --agent leader "Create a new React component"
  tokenring -p "Fix the bug in app.ts"
`,
  )
  .action(runApp)
  .parse();

async function runApp({ projectDirectory, dataDirectory, acp, ui, http, auth, agent, vault, p }: CommandOptions): Promise<void> {
  const args = program.args;
  try {
    if (acp && args.length > 0) {
      throw new Error("ACP mode does not support positional startup prompts");
    }

    projectDirectory = path.resolve(projectDirectory);
    dataDirectory = path.resolve(dataDirectory || path.join(projectDirectory, "/.tokenring"));
    const configDirectory = path.join(os.homedir(), "/.tokenring");
    if (!fs.existsSync(configDirectory)) {
      fs.mkdirSync(configDirectory, { recursive: true });
    }

    // Handle authentication via environment variables
    const users: WebHostAuthConfig["users"] = {};

    if (auth) {
      // Read auth tokens from environment variables
      const authPassword = process.env.TR_AUTH_PASSWORD;
      const authBearer = process.env.TR_AUTH_BEARER;

      // Validate that at least one auth method is provided
      if (!authPassword && !authBearer) {
        console.error("Error: Authentication requested but no auth tokens provided.");
        console.error("Please set TR_AUTH_PASSWORD or TR_AUTH_BEARER environment variable(s).");
        process.exit(1);
      }

      // Build auth configuration from environment variables
      if (authPassword) {
        const [username, password] = authPassword.split(":");
        if (!username || !password) {
          console.error("Error: Invalid TR_AUTH_PASSWORD format. Expected format: 'username:password'");
          process.exit(1);
        }
        if (password.length < 8) {
          console.error("Error: Password must be at least 8 characters long.");
          process.exit(1);
        }
        (users[username] ??= {}).password = password;
      }

      if (authBearer) {
        const [username, bearerToken] = authBearer.split(":");
        if (!username || !bearerToken) {
          console.error("Error: Invalid TR_AUTH_BEARER format. Expected format: 'username:token'");
          process.exit(1);
        }
        if (bearerToken.length < 8) {
          console.error("Error: Bearer token must be at least 8 characters long.");
          process.exit(1);
        }
        (users[username] ??= {}).bearerToken = bearerToken;
      }
    }

    const [listenHost, listenPortStr] = http?.split?.(":") ?? ["127.0.0.1", ""];
    const listenPort = listenPortStr ? parseInt(listenPortStr, 10) : undefined;
    if (listenPort && Number.isNaN(listenPort)) {
      console.error(`Invalid port number: ${listenPort}`);
      process.exit(1);
    }

    let frontendDirectory = path.resolve(process.env.FRONTEND_DIRECTORY || path.resolve(import.meta.dirname, "./frontend"));

    if (! fs.existsSync(frontendDirectory)) {
      console.error(`Frontend directory not found: ${frontendDirectory}`)
      process.exit(1);
    }

    const defaultConfig = {
      app: {
        configDirectories: [path.join(homeDirectory, "configs"), path.join(dataDirectory, "configs")],
        dataDirectory,
        printLogs: ui === "none" && !acp,
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
      drizzleStorage: {
        type: "sqlite",
        databasePath: path.resolve(configDirectory, "./database.sqlite"),
      } satisfies z.input<typeof DrizzleStorageConfigSchema>,
      ...(acp && {
        acp: {
          transport: "stdio",
          defaultAgentType: agent,
        } satisfies z.input<typeof ACPConfigSchema>,
      }),
      ...(!acp &&
        ui !== "none" && {
          cli: {
            chatBanner: `TokenRing One ${packageInfo.version}`,
            screenBanner: `TokenRing One ${packageInfo.version}`,
            loadingBannerWide: bannerWide,
            loadingBannerNarrow: bannerNarrow,
            loadingBannerCompact: bannerCompact,
            ...(args.length > 0 && {
              startAgent: {
                type: agent,
                prompt: args.join(" "),
                shutdownWhenDone: p,
              },
            }),
          } satisfies z.input<typeof CLIConfigSchema>,
        }),
      webHost: {
        host: listenHost,
        ...(listenPort && { port: listenPort }),
        ...(auth && {
          auth: {
            users,
          },
        }),
        autoStart: !!http,
      } satisfies z.input<typeof WebHostConfigSchema>,
      ...(vault && {
        vault: {
          vaultFile: typeof vault === "string" ? vault : `${homeDirectory}/.tokenring/secrets.vault`,
        },
      }),
    } satisfies Partial<z.input<typeof configSchema>>;

    const mergedConfig = deepClone(defaultConfig, config);
    const parsedConfig = configSchema.parse(mergedConfig);

    const appConfig = await buildTokenRingAppConfig(configSchema, parsedConfig);

    const app = new TokenRingApp(appConfig);

    const pluginManager = new PluginManager(app);

    await pluginManager.installPlugins(plugins);

    await app.run();
  } catch (err: unknown) {
    process.stdout.write("\u001B[2J\u001B[H\n\n");
    console.error(chalk.red(formatLogMessages(err as Error)));
  }
}
