import AgentPlugin from "@tokenring-ai/agent/plugin";
import AIClientPlugin from "@tokenring-ai/ai-client/plugin";
import { TokenRingAppConfigSchema } from "@tokenring-ai/app/schema";
import AudioPlugin from "@tokenring-ai/audio/plugin";
import AWSPlugin from "@tokenring-ai/aws/plugin";
import BlogPlugin from "@tokenring-ai/blog/plugin";
import BotPlugin from "@tokenring-ai/bot/plugin";
import BrowserPlugin from "@tokenring-ai/browser/plugin";
import BunStoragePlugin from "@tokenring-ai/bun-storage/plugin";
import CalendarPlugin from "@tokenring-ai/calendar/plugin";
import CDNPlugin from "@tokenring-ai/cdn/plugin";
import ChatPlugin from "@tokenring-ai/chat/plugin";
import CheckpointPlugin from "@tokenring-ai/checkpoint/plugin";
import CloudQuotePlugin from "@tokenring-ai/cloudquote/plugin";
import CodeWatchPlugin from "@tokenring-ai/code-watch/plugin";
import CodeBasePlugin from "@tokenring-ai/codebase/plugin";
import DatabasePlugin from "@tokenring-ai/database/plugin";
import DiscordPlugin from "@tokenring-ai/discord/plugin";
import DockerPlugin from "@tokenring-ai/docker/plugin";
import EmailPlugin from "@tokenring-ai/email/plugin";
import FeedbackPlugin from "@tokenring-ai/feedback/plugin";
import FileIndexPlugin from "@tokenring-ai/file-index/plugin";
import FilesystemPlugin from "@tokenring-ai/filesystem/plugin";
import GhostIOPlugin from "@tokenring-ai/ghost-io/plugin";
import GitPlugin from "@tokenring-ai/git/plugin";
import GithubPlugin from "@tokenring-ai/github/plugin";
import GooglePlugin from "@tokenring-ai/google/plugin";
import ImageGenerationPlugin from "@tokenring-ai/image/plugin";
import JavascriptPlugin from "@tokenring-ai/javascript/plugin";
import KubernetesPlugin from "@tokenring-ai/kubernetes/plugin";
import LifecyclePlugin from "@tokenring-ai/lifecycle/plugin";
import MarkdownPlugin from "@tokenring-ai/markdown/plugin";
import MCPPlugin from "@tokenring-ai/mcp/plugin";
import MediaLibraryPlugin from "@tokenring-ai/media-library/plugin";
import MemoryPlugin from "@tokenring-ai/memory/plugin";
import MetricsPlugin from "@tokenring-ai/metrics/plugin";
import NewsRPMPlugin from "@tokenring-ai/newsrpm/plugin";
import OneFrontendPlugin from "@tokenring-ai/one-frontend/plugin";
import PosixSystemPlugin from "@tokenring-ai/posix-system/plugin";
import QueuePlugin from "@tokenring-ai/queue/plugin";
import RedditPlugin from "@tokenring-ai/reddit/plugin";
import ResearchPlugin from "@tokenring-ai/research/plugin";
import RPCPlugin from "@tokenring-ai/rpc/plugin";
import SandboxPlugin from "@tokenring-ai/sandbox/plugin";
import SchedulerPlugin from "@tokenring-ai/scheduler/plugin";
import ScraperAPIPlugin from "@tokenring-ai/scraperapi/plugin";
import ScriptingPlugin from "@tokenring-ai/scripting/plugin";
import SecretsPlugin from "@tokenring-ai/secrets/plugin";
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
import WebDesignPlugin from "@tokenring-ai/web-design/plugin";
import WebHostPlugin from "@tokenring-ai/web-host/plugin";
import WebSearchPlugin from "@tokenring-ai/websearch/plugin";
import WordPressPlugin from "@tokenring-ai/wordpress/plugin";
import WorkflowPlugin from "@tokenring-ai/workflow/plugin";
import XPlugin from "@tokenring-ai/x/plugin";
import { z } from "zod";

export const plugins = [
  SecretsPlugin,
  AgentPlugin,
  AIClientPlugin,
  AudioPlugin,
  AWSPlugin,
  OneFrontendPlugin,
  BlogPlugin,
  BrowserPlugin,
  CalendarPlugin,
  CDNPlugin,
  ChatPlugin,
  CloudQuotePlugin,
  CheckpointPlugin,
  CodeBasePlugin,
  CodeWatchPlugin,
  DatabasePlugin,
  DiscordPlugin,
  DockerPlugin,
  BunStoragePlugin,
  EmailPlugin,
  BotPlugin,
  FeedbackPlugin,
  FileIndexPlugin,
  FilesystemPlugin,
  GhostIOPlugin,
  GitPlugin,
  GithubPlugin,
  GooglePlugin,
  MediaLibraryPlugin,
  ImageGenerationPlugin,
  JavascriptPlugin,
  KubernetesPlugin,
  LifecyclePlugin,
  PosixSystemPlugin,
  MarkdownPlugin,
  MCPPlugin,
  MemoryPlugin,
  MetricsPlugin,
  NewsRPMPlugin,
  RedditPlugin,
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
  WebDesignPlugin,
  WebHostPlugin,
  WebSearchPlugin,
  WordPressPlugin,
  WorkflowPlugin,
  XPlugin,
];
export const configSchema = z.object({
  ...TokenRingAppConfigSchema.shape,
  ...AgentPlugin.configSchema.shape,
  ...AIClientPlugin.configSchema.shape,
  ...AudioPlugin.configSchema.shape,
  ...AWSPlugin.configSchema.shape,
  ...BlogPlugin.configSchema.shape,
  ...BrowserPlugin.configSchema.shape,
  ...CalendarPlugin.configSchema.shape,
  ...ChatPlugin.configSchema.shape,
  ...CloudQuotePlugin.configSchema.shape,
  ...CheckpointPlugin.configSchema.shape,
  ...CodeBasePlugin.configSchema.shape,
  ...CodeWatchPlugin.configSchema.shape,
  ...DatabasePlugin.configSchema.shape,
  ...DiscordPlugin.configSchema.shape,
  ...DockerPlugin.configSchema.shape,
  ...BunStoragePlugin.immutableConfigSchema.shape,
  ...BotPlugin.configSchema.shape,
  ...FileIndexPlugin.configSchema.shape,
  ...FilesystemPlugin.configSchema.shape,
  ...GhostIOPlugin.configSchema.shape,
  ...GithubPlugin.configSchema.shape,
  ...GooglePlugin.configSchema.shape,
  ...MediaLibraryPlugin.configSchema.shape,
  ...ImageGenerationPlugin.configSchema.shape,
  ...KubernetesPlugin.configSchema.shape,
  ...LifecyclePlugin.configSchema.shape,
  ...PosixSystemPlugin.configSchema.shape,
  ...MarkdownPlugin.configSchema.shape,
  ...MemoryPlugin.configSchema.shape,
  ...MetricsPlugin.configSchema.shape,
  ...MCPPlugin.configSchema.shape,
  ...NewsRPMPlugin.configSchema.shape,
  ...RedditPlugin.configSchema.shape,
  ...ResearchPlugin.configSchema.shape,
  ...QueuePlugin.configSchema.shape,
  ...SandboxPlugin.configSchema.shape,
  ...SchedulerPlugin.configSchema.shape,
  ...ScraperAPIPlugin.configSchema.shape,
  ...ScriptingPlugin.configSchema.shape,
  ...SerperPlugin.configSchema.shape,
  ...SkillsPlugin.configSchema.shape,
  ...SlackPlugin.configSchema.shape,
  ...TasksPlugin.configSchema.shape,
  ...TelegramPlugin.configSchema.shape,
  ...TerminalPlugin.configSchema.shape,
  ...TestingPlugin.configSchema.shape,
  ...TodoPlugin.configSchema.shape,
  ...VaultPlugin.immutableConfigSchema.shape,
  ...VideoGenerationPlugin.configSchema.shape,
  ...WebDesignPlugin.configSchema.shape,
  ...WebHostPlugin.configSchema.shape,
  ...WebSearchPlugin.configSchema.shape,
  ...WordPressPlugin.configSchema.shape,
  ...WorkflowPlugin.configSchema.shape,
  ...XPlugin.configSchema.shape,
});
