import ACPPlugin from "@tokenring-ai/acp/plugin";
import AgentPlugin from "@tokenring-ai/agent/plugin";
import AIClientPlugin from "@tokenring-ai/ai-client/plugin";
import { TokenRingAppConfigSchema } from "@tokenring-ai/app/schema";
import AudioPlugin from "@tokenring-ai/audio/plugin";
import AWSPlugin from "@tokenring-ai/aws/plugin";
import ChatPlugin from "@tokenring-ai/chat/plugin";
import CheckpointPlugin from "@tokenring-ai/checkpoint/plugin";
import ChromePlugin from "@tokenring-ai/chrome/plugin";
import CLIPlugin from "@tokenring-ai/cli/plugin";
import CloudQuotePlugin from "@tokenring-ai/cloudquote/plugin";
import CodeWatchPlugin from "@tokenring-ai/code-watch/plugin";
import CodeBasePlugin from "@tokenring-ai/codebase/plugin";
import DatabasePlugin from "@tokenring-ai/database/plugin";
import DockerPlugin from "@tokenring-ai/docker/plugin";
import BunStoragePlugin from "@tokenring-ai/bun-storage/plugin";
import EmailPlugin from "@tokenring-ai/email/plugin";
import EscalationPlugin from "@tokenring-ai/escalation/plugin";
import FeedbackPlugin from "@tokenring-ai/feedback/plugin";
import FileIndexPlugin from "@tokenring-ai/file-index/plugin";
import FilesystemPlugin from "@tokenring-ai/filesystem/plugin";
import GitPlugin from "@tokenring-ai/git/plugin";
import GithubPlugin from "@tokenring-ai/github/plugin";
import ImageGenerationPlugin from "@tokenring-ai/image/plugin";
import JavascriptPlugin from "@tokenring-ai/javascript/plugin";
import KubernetesPlugin from "@tokenring-ai/kubernetes/plugin";
import LifecyclePlugin from "@tokenring-ai/lifecycle/plugin";
import LinuxAudioPlugin from "@tokenring-ai/linux-audio/plugin";
import MarkdownPlugin from "@tokenring-ai/markdown/plugin";
import MCPPlugin from "@tokenring-ai/mcp/plugin";
import MediaLibraryPlugin from "@tokenring-ai/media-library/plugin";
import MemoryPlugin from "@tokenring-ai/memory/plugin";
import MetricsPlugin from "@tokenring-ai/metrics/plugin";
import MySQLPlugin from "@tokenring-ai/mysql/plugin";
import NewsRPMPlugin from "@tokenring-ai/newsrpm/plugin";
import OneFrontendPlugin from "@tokenring-ai/one-frontend/plugin";
import PosixSystemPlugin from "@tokenring-ai/posix-system/plugin";
import QueuePlugin from "@tokenring-ai/queue/plugin";
import ResearchPlugin from "@tokenring-ai/research/plugin";
import RPCPlugin from "@tokenring-ai/rpc/plugin";
import SandboxPlugin from "@tokenring-ai/sandbox/plugin";
import SchedulerPlugin from "@tokenring-ai/scheduler/plugin";
import ScraperAPIPlugin from "@tokenring-ai/scraperapi/plugin";
import ScriptingPlugin from "@tokenring-ai/scripting/plugin";
import SerperPlugin from "@tokenring-ai/serper/plugin";
import SkillsPlugin from "@tokenring-ai/skills/plugin";
import SlackPlugin from "@tokenring-ai/slack/plugin";
import TasksPlugin from "@tokenring-ai/tasks/plugin";
import TelegramPlugin from "@tokenring-ai/telegram/plugin";
import TerminalPlugin from "@tokenring-ai/terminal/plugin";
import TestingPlugin from "@tokenring-ai/testing/plugin";
import TodoPlugin from "@tokenring-ai/todo/plugin";
import TypescriptPlugin from "@tokenring-ai/typescript/plugin";
import VaultPlugin from "@tokenring-ai/vault/plugin";
import VideoGenerationPlugin from "@tokenring-ai/video/plugin";
import WebHostPlugin from "@tokenring-ai/web-host/plugin";
import WebSearchPlugin from "@tokenring-ai/websearch/plugin";
import WorkflowPlugin from "@tokenring-ai/workflow/plugin";
import { z } from "zod";

export const plugins = [
  ACPPlugin,
  AgentPlugin,
  AIClientPlugin,
  AudioPlugin,
  AWSPlugin,
  OneFrontendPlugin,
  ChatPlugin,
  CLIPlugin,
  CloudQuotePlugin,
  CheckpointPlugin,
  ChromePlugin,
  CodeBasePlugin,
  CodeWatchPlugin,
  DatabasePlugin,
  DockerPlugin,
  BunStoragePlugin,
  EmailPlugin,
  EscalationPlugin,
  FeedbackPlugin,
  FileIndexPlugin,
  FilesystemPlugin,
  GitPlugin,
  GithubPlugin,
  MediaLibraryPlugin,
  ImageGenerationPlugin,
  JavascriptPlugin,
  KubernetesPlugin,
  LifecyclePlugin,
  LinuxAudioPlugin,
  PosixSystemPlugin,
  MarkdownPlugin,
  MCPPlugin,
  MemoryPlugin,
  MetricsPlugin,
  MySQLPlugin,
  NewsRPMPlugin,
  ResearchPlugin,
  RPCPlugin,
  QueuePlugin,
  SandboxPlugin,
  SchedulerPlugin,
  ScraperAPIPlugin,
  ScriptingPlugin,
  SerperPlugin,
  SlackPlugin,
  SkillsPlugin,
  TasksPlugin,
  TelegramPlugin,
  TerminalPlugin,
  TestingPlugin,
  TodoPlugin,
  TypescriptPlugin,
  VaultPlugin,
  VideoGenerationPlugin,
  WebHostPlugin,
  WebSearchPlugin,
  WorkflowPlugin,
];
export const configSchema = z.object({
  ...TokenRingAppConfigSchema.shape,
  ...ACPPlugin.config.shape,
  ...AgentPlugin.config.shape,
  ...AIClientPlugin.config.shape,
  ...AudioPlugin.config.shape,
  ...AWSPlugin.config.shape,
  ...OneFrontendPlugin.config.shape,
  ...ChatPlugin.config.shape,
  ...CLIPlugin.config.shape,
  ...CloudQuotePlugin.config.shape,
  ...CheckpointPlugin.config.shape,
  ...ChromePlugin.config.shape,
  ...CodeBasePlugin.config.shape,
  ...CodeWatchPlugin.config.shape,
  ...DatabasePlugin.config.shape,
  ...DockerPlugin.config.shape,
  ...BunStoragePlugin.config.shape,
  ...EscalationPlugin.config.shape,
  ...FeedbackPlugin.config.shape,
  ...FileIndexPlugin.config.shape,
  ...FilesystemPlugin.config.shape,
  ...GitPlugin.config.shape,
  ...GithubPlugin.config.shape,
  ...MediaLibraryPlugin.config.shape,
  ...ImageGenerationPlugin.config.shape,
  ...JavascriptPlugin.config.shape,
  ...KubernetesPlugin.config.shape,
  ...LifecyclePlugin.config.shape,
  ...LinuxAudioPlugin.config.shape,
  ...PosixSystemPlugin.config.shape,
  ...MarkdownPlugin.config.shape,
  ...MetricsPlugin.config.shape,
  ...MCPPlugin.config.shape,
  ...MemoryPlugin.config.shape,
  ...MySQLPlugin.config.shape,
  ...NewsRPMPlugin.config.shape,
  ...ResearchPlugin.config.shape,
  ...RPCPlugin.config.shape,
  ...QueuePlugin.config.shape,
  ...SandboxPlugin.config.shape,
  ...SchedulerPlugin.config.shape,
  ...ScraperAPIPlugin.config.shape,
  ...ScriptingPlugin.config.shape,
  ...SerperPlugin.config.shape,
  ...SkillsPlugin.config.shape,
  ...SlackPlugin.config.shape,
  ...TasksPlugin.config.shape,
  ...TelegramPlugin.config.shape,
  ...TerminalPlugin.config.shape,
  ...TestingPlugin.config.shape,
  ...TodoPlugin.config.shape,
  ...TypescriptPlugin.config.shape,
  ...VaultPlugin.config.shape,
  ...VideoGenerationPlugin.config.shape,
  ...WebHostPlugin.config.shape,
  ...WebSearchPlugin.config.shape,
  ...WorkflowPlugin.config.shape,
});
