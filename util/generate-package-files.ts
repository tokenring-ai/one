#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";

const baseDir = path.resolve(import.meta.dir, "../");

// Configuration
const sourceDir = `${baseDir}/scripts/boilerplate`;
const targetPatterns = ["plugin/*"];

function getBoilerplateFiles(dir: string, relativePath = ""): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativeEntry = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      results.push(...getBoilerplateFiles(fullPath, relativeEntry));
    } else {
      results.push(relativeEntry);
    }
  }

  return results;
}

function expandGlobPattern(pattern: string, cwd: string): string[] {
  const parts = pattern.split("/");
  const results: string[] = [];

  const parentDir = path.join(cwd, parts[0].replace("*", ""));
  if (!fs.existsSync(parentDir)) {
    return [];
  }

  const entries = fs.readdirSync(parentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      results.push(path.join(parentDir, entry.name));
    }
  }

  return results;
}

async function main(): Promise<void> {
  try {
    // Get the list of boilerplate files
    const files = getBoilerplateFiles(sourceDir);

    console.log(`Found ${files.length} boilerplate files to sync.\n`);

    // Process each pattern
    for (const pattern of targetPatterns) {
      const dirs = expandGlobPattern(pattern, baseDir);

      for (const packageDir of dirs) {
        try {
          const stats = fs.statSync(packageDir);
          if (!stats.isDirectory()) {
            continue;
          }

          console.log(`Processing package: ${packageDir}`);

          // Copy each file to the package directory
          for (const file of files) {
            const src = path.join(sourceDir, file);
            const dst = path.join(packageDir, file);

            try {
              fs.copyFileSync(src, dst);
              console.log(`  -> Copied ${file}`);
            } catch (err) {
              console.error(`  [!] Failed to copy ${file} to ${packageDir}:`, err);
            }
          }

          // Handle package.json modifications
          const packageJsonPath = path.join(packageDir, "package.json");
          try {
            const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
            const packageData = JSON.parse(packageJsonContent);

            let modified = false;
            // Initialize devDependencies if it doesn't exist
            if (!packageData.devDependencies) {
              packageData.devDependencies ??= {};
            }
            if (!packageData.scripts) {
              packageData.scripts ??= {};
            }

            if (packageData.scripts.test !== "bun test") {
              modified = true;
              packageData.scripts.test = "bun test";
            }

            if (packageData.scripts["test:watch"] !== "bun test --watch") {
              modified = true;
              packageData.scripts["test:watch"] = "bun test --watch";
            }

            if (packageData.scripts["test:coverage"] !== "bun test --coverage") {
              modified = true;
              packageData.scripts["test:coverage"] = "bun test --coverage";
            }

            // Remove vitest devDependencies if present
            if (packageData.devDependencies.vitest) {
              modified = true;
              delete packageData.devDependencies.vitest;
            }

            if (packageData.devDependencies["@vitest/coverage-v8"]) {
              modified = true;
              delete packageData.devDependencies["@vitest/coverage-v8"];
            }

            if (packageData.scripts.build !== "tsc --noEmit") {
              modified = true;
              packageData.scripts.build = "tsc --noEmit";
            }

            if (!packageData.exports) {
              modified = true;
              packageData.exports = {};
            }

            if (!packageData.exports["."]) {
              modified = true;
              packageData.exports["."] = "./index.ts";
            }

            if (!packageData.exports["./*"]) {
              modified = true;
              packageData.exports["./*"] = "./*.ts";
            }

            if (!packageData.license) {
              modified = true;
              packageData.license = "MIT";
            }

            if (!packageData.type) {
              modified = true;
              packageData.type = "module";
            }

            // Remove vitest-specific scripts
            if (packageData.scripts["test:ui"] && packageData.scripts["test:ui"].includes("vitest")) {
              modified = true;
              delete packageData.scripts["test:ui"];
            }

            if (packageData.scripts["test:run"] && packageData.scripts["test:run"].includes("vitest")) {
              modified = true;
              delete packageData.scripts["test:run"];
            }

            if (modified) {
              // Write the updated package.json back
              fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
              console.log(`  -> Updated package.json`);
            }
          } catch (err) {
            console.error(`  [!] Failed to update package.json in ${packageDir}:`, err);
          }

          console.log("");

          // Remove old vitest.config.ts if it exists
          const vitestConfigPath = path.join(packageDir, "vitest.config.ts");
          if (fs.existsSync(vitestConfigPath)) {
            try {
              fs.unlinkSync(vitestConfigPath);
              console.log(`  -> Removed vitest.config.ts`);
            } catch (err) {
              console.error(`  [!] Failed to remove vitest.config.ts from ${packageDir}:`, err);
            }
          }

          console.log("");
        } catch (err) {
          console.error(`Error processing directory ${packageDir}:`, err);
        }
      }
    }

    console.log("Done!");
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();