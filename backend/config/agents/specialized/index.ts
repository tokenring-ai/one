import type { AgentPackageConfig } from "@tokenring-ai/agent/schema";
import deepClone from "@tokenring-ai/utility/object/deepClone";

import accessibilityEngineer from "./accessibility-engineer.yaml" with { type: "yaml" };
import apiDesigner from "./api-designer.yaml" with { type: "yaml" };
import authDesign from "./auth-design.yaml" with { type: "yaml" };
import backendDesign from "./backend-design.yaml" with { type: "yaml" };
import businessLogicEngineer from "./business-logic-engineer.yaml" with { type: "yaml" };
import explore from "./code-explorer.yaml" with { type: "yaml" };
import codeQualityEngineer from "./code-quality-engineer.yaml" with { type: "yaml" };
import dataEngineer from "./data-engineer.yaml" with { type: "yaml" };
import databaseDesign from "./database-design.yaml" with { type: "yaml" };
import devopsEngineer from "./devops-engineer.yaml" with { type: "yaml" };
import documentationEngineer from "./documentation-engineer.yaml" with { type: "yaml" };
import frontendDesign from "./frontend-design.yaml" with { type: "yaml" };
import fullStackDeveloper from "./full-stack-developer.yaml" with { type: "yaml" };
import integrationEngineer from "./integration-engineer.yaml" with { type: "yaml" };
import performanceEngineer from "./performance-engineer.yaml" with { type: "yaml" };
import productDesignEngineer from "./product-design-engineer.yaml" with { type: "yaml" };
import productManager from "./product-manager.yaml" with { type: "yaml" };
import securityReview from "./security-review.yaml" with { type: "yaml" };
import seoEngineer from "./seo-engineer.yaml" with { type: "yaml" };
import systemArchitect from "./system-architect.yaml" with { type: "yaml" };
import testEngineer from "./test-engineer.yaml" with { type: "yaml" };
import uiUxDesigner from "./ui-ux-designer.yaml" with { type: "yaml" };

export default deepClone(
  accessibilityEngineer,
  apiDesigner,
  authDesign,
  backendDesign,
  businessLogicEngineer,
  codeQualityEngineer,
  databaseDesign,
  dataEngineer,
  devopsEngineer,
  documentationEngineer,
  explore,
  frontendDesign,
  fullStackDeveloper,
  integrationEngineer,
  performanceEngineer,
  productDesignEngineer,
  productManager,
  securityReview,
  seoEngineer,
  systemArchitect,
  testEngineer,
  uiUxDesigner,
) satisfies AgentPackageConfig["agents"];
