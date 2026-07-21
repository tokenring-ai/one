#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

const projectDirectory = path.resolve(import.meta.dir, "..");
const outputDirectory = path.join(projectDirectory, "schema/rpc");
const schemaGlob = new Bun.Glob("plugin/*/rpc/schema.ts");

type JSONSchema = Record<string, unknown>;

const unrepresentableTypes = new Map([
  ["bigint", "BigInt"],
  ["symbol", "symbol"],
  ["undefined", "undefined"],
  ["void", "void"],
  ["nan", "NaN"],
  ["custom", "custom type"],
  ["function", "function"],
  ["transform", "transform"],
  ["map", "Map"],
  ["set", "Set"],
]);

function escapeJSONPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function withoutSchemaDeclaration(schema: JSONSchema): JSONSchema {
  const { $schema: _, ...embeddedSchema } = schema;
  return embeddedSchema;
}

export function convertSchema(schema: z.ZodType, io: "input" | "output"): JSONSchema {
  return withoutSchemaDeclaration(
    z.toJSONSchema(schema, {
      io,
      target: "draft-2020-12",
      // Date is the only non-JSON Zod type supported by the RPC transport: JSON
      // serialization turns it into an ISO 8601 string. Other unsupported types
      // are rejected by the override below.
      unrepresentable: "any",
      override: ({ zodSchema, jsonSchema, path: schemaPath }) => {
        const definition = zodSchema._zod.def as { type: string; values?: unknown[] };
        if (definition.type === "date") {
          Object.assign(jsonSchema, { type: "string", format: "date-time" });
          return;
        }

        const unrepresentableType = unrepresentableTypes.get(definition.type);
        const hasUnrepresentableLiteral =
          definition.type === "literal" &&
          definition.values?.some(
            value =>
              value === undefined ||
              typeof value === "bigint" ||
              typeof value === "symbol" ||
              (typeof value === "number" && !Number.isFinite(value)),
          );
        if (unrepresentableType || hasUnrepresentableLiteral) {
          const location = schemaPath.length > 0 ? ` at ${schemaPath.join(".")}` : "";
          throw new Error(`Cannot export ${unrepresentableType ?? "non-JSON literal"}${location}`);
        }
      },
    }) as JSONSchema,
  );
}

function createRPCJSONSchema(rpcSchema: RPCSchema, source: string) {
  const definitions: Record<string, unknown> = {
    JSONRPCError: {
      type: "object",
      properties: {
        jsonrpc: { const: "2.0" },
        id: { type: ["number", "null"] },
        error: {
          type: "object",
          properties: {
            code: { type: "number" },
            message: { type: "string" },
          },
          required: ["code", "message"],
          additionalProperties: false,
        },
      },
      required: ["jsonrpc", "id", "error"],
      additionalProperties: false,
    },
  };
  const messages: unknown[] = [{ $ref: "#/$defs/JSONRPCError" }];
  const methods: Record<string, unknown> = {};

  for (const [methodName, method] of Object.entries(rpcSchema.methods)) {
    const paramsDefinition = `${methodName}Params`;
    const resultDefinition = `${methodName}Result`;
    const paramsReference = `#/$defs/${escapeJSONPointer(paramsDefinition)}`;
    const resultReference = `#/$defs/${escapeJSONPointer(resultDefinition)}`;

    try {
      definitions[paramsDefinition] = convertSchema(method.input, "input");
      definitions[resultDefinition] = convertSchema(method.result, "output");
    } catch (error) {
      throw new Error(`Failed to export ${source} method ${methodName}`, { cause: error });
    }
    methods[methodName] = {
      type: method.type,
      params: paramsReference,
      result: resultReference,
    };

    messages.push(
      {
        title: `${methodName} request`,
        type: "object",
        properties: {
          jsonrpc: { const: "2.0" },
          id: { type: "number" },
          method: { const: `${rpcSchema.path}.${methodName}` },
          params: { $ref: paramsReference },
        },
        required: ["jsonrpc", "id", "method", "params"],
        additionalProperties: false,
      },
      {
        title: `${methodName} response`,
        type: "object",
        properties: {
          jsonrpc: { const: "2.0" },
          id: { type: "number" },
          result: { $ref: resultReference },
        },
        required: ["jsonrpc", "id", "result"],
        additionalProperties: false,
      },
    );

    if (method.type === "stream") {
      messages.push({
        title: `${methodName} stream end response`,
        type: "object",
        properties: {
          jsonrpc: { const: "2.0" },
          id: { type: "number" },
          result: { type: "null" },
          stream: { const: "end" },
        },
        required: ["jsonrpc", "id", "result", "stream"],
        additionalProperties: false,
      });
    }
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: rpcSchema.name,
    description: `JSON-RPC 2.0 messages for ${rpcSchema.path}`,
    anyOf: messages,
    $defs: definitions,
    "x-tokenring-rpc": {
      name: rpcSchema.name,
      path: rpcSchema.path,
      source,
      methods,
    },
  };
}

async function main(): Promise<void> {
  const schemaFiles = [...schemaGlob.scanSync({ cwd: projectDirectory, absolute: true })].sort();
  if (schemaFiles.length === 0) {
    throw new Error("No RPC schema modules found at plugin/*/rpc/schema.ts");
  }

  const exports: { outputFile: string; contents: string; relativeSource: string; methodCount: number }[] = [];
  let methodCount = 0;
  for (const schemaFile of schemaFiles) {
    const relativeSource = path.relative(projectDirectory, schemaFile);
    const pluginName = relativeSource.split(path.sep)[1];
    if (!pluginName) {
      throw new Error(`Could not determine plugin name from ${relativeSource}`);
    }

    const module = (await import(schemaFile)) as { default?: RPCSchema };
    if (!module.default?.name || !module.default.path || !module.default.methods) {
      throw new Error(`${relativeSource} does not have a valid default RPC schema export`);
    }

    const rpcSchema = module.default;
    const outputFile = path.join(outputDirectory, `${pluginName}.json`);
    const jsonSchema = createRPCJSONSchema(rpcSchema, relativeSource);
    const currentMethodCount = Object.keys(rpcSchema.methods).length;
    methodCount += currentMethodCount;
    exports.push({ outputFile, contents: `${JSON.stringify(jsonSchema, null, 2)}\n`, relativeSource, methodCount: currentMethodCount });
  }

  // Convert every schema before writing so a failure cannot leave a partially
  // updated output directory.
  await mkdir(outputDirectory, { recursive: true });
  for (const rpcExport of exports) {
    await writeFile(rpcExport.outputFile, rpcExport.contents);
    console.log(
      `Exported ${rpcExport.relativeSource} -> ${path.relative(projectDirectory, rpcExport.outputFile)} (${rpcExport.methodCount} methods)`,
    );
  }

  console.log(`Exported ${schemaFiles.length} RPC schemas with ${methodCount} methods.`);
}

if (import.meta.main) {
  await main();
}
