# Command Reference

Every command a TokenRing One chat session accepts, grouped by its first word. Type a command as
`/<name> <arguments>`; a multi-word name such as `chat send` is typed in full. Text that does not start
with a command name is sent to the agent's default command (`chat send`).

Descriptions are taken from each command's source definition. Commands marked *(agent)* are defined in an agent
configuration `commands:` block and run that agent.

## /agent

| Command | Description |
| --- | --- |
| `/agent checkpoint create` | Create a conversation checkpoint |
| `/agent checkpoint history` | Browse checkpoint history grouped by agent |
| `/agent checkpoint list` | Interactive checkpoint browser |
| `/agent checkpoint restore` | Restore a checkpoint by ID |
| `/agent list` | List all currently running agents |
| `/agent run` | Run an agent with a message |
| `/agent shutdown` | Shut down an agent |
| `/agent types` | List all available agent types |

## /ai

| Command | Description |
| --- | --- |
| `/ai models update` | Updates the models file with the latest models from the TokenRing AI server. |

## /app

| Command | Description |
| --- | --- |
| `/app checkpoint create` | Create an app state checkpoint |
| `/app checkpoint history` | Browse app checkpoint history |
| `/app checkpoint list` | Interactive checkpoint browser |

## /approval

| Command | Description |
| --- | --- |
| `/approval` | Show or set tool approval level and mode (ask, reject, auto) |

## /audio

| Command | Description |
| --- | --- |
| `/audio generate` | Convert text to speech |
| `/audio model stt get` | Show current STT model |
| `/audio model stt reset` | Reset STT model |
| `/audio model stt select` | Interactive STT model selection |
| `/audio model stt set` | Set STT model |
| `/audio model tts get` | Show current TTS model |
| `/audio model tts reset` | Reset TTS model |
| `/audio model tts select` | Interactive TTS model selection |
| `/audio model tts set` | Set TTS model |
| `/audio reindex` | Reindex audio files in the media library directory |
| `/audio transcribe` | Transcribe audio to text |

## /aws

| Command | Description |
| --- | --- |
| `/aws status` | View current AWS authentication status |

## /blog

| Command | Description |
| --- | --- |
| `/blog post clear` | Clear current post selection |
| `/blog post get` | Show current post |
| `/blog post info` | Show info about current post |
| `/blog post publish` | Publish current post |
| `/blog post select` | Select a post |
| `/blog provider get` | Show current provider |
| `/blog provider list` | List all registered blog providers |
| `/blog provider reset` | Reset to initial provider |
| `/blog provider select` | Interactively select a provider |
| `/blog provider set` | Set the active provider |
| `/blog test` | Test blog connection |

## /bots

| Command | Description |
| --- | --- |
| `/bots` | List the configured bots and the platforms they are reachable on |
| `/bots join` | Add a bot to a group or channel it has been invited to |
| `/bots leave` | Remove a bot from a group or channel |

## /branch

| Command | Description |
| --- | --- |
| `/branch` | Checkpoint the current agent and start a new agent from that checkpoint |

## /calendar

| Command | Description |
| --- | --- |
| `/calendar event clear` | Clear current event selection |
| `/calendar event create` | Create an event |
| `/calendar event delete` | Delete current event |
| `/calendar event get` | Show current event |
| `/calendar event info` | Show event details |
| `/calendar event list` | List upcoming events |
| `/calendar event search` | Search events |
| `/calendar event select` | Select an event |
| `/calendar provider get` | Show current provider |
| `/calendar provider reset` | Reset to initial provider |
| `/calendar provider select` | Interactively select a provider |
| `/calendar provider set` | Set the active provider |

## /call

| Command | Description |
| --- | --- |
| `/call` | Call a function and display output |

## /cdn

| Command | Description |
| --- | --- |
| `/cdn provider list` | List all registered CDN providers |

## /chat

| Command | Description |
| --- | --- |
| `/chat compact` | Compact conversation context by summarizing prior messages |
| `/chat context` | Show the current context for the chat session |
| `/chat model get` | Show current model |
| `/chat model reset` | Reset to initial model |
| `/chat model select` | Interactively select a model |
| `/chat model set` | Set the model |
| `/chat model settings disable` | Disable model feature flags |
| `/chat model settings enable` | Enable model feature flags |
| `/chat model settings select` | Interactively select model settings |
| `/chat model settings set` | Set a model feature flag |
| `/chat model settings show` | Show model settings |
| `/chat reset` | Reset the chat context |
| `/chat send` | Send messages to the LLM |

## /codebase

| Command | Description |
| --- | --- |
| `/codebase disable` | Disable codebase resources |
| `/codebase enable` | Enable codebase resources |
| `/codebase list` | List enabled codebase resources |
| `/codebase reset` | Reset enabled codebase resources |
| `/codebase select` | Interactive resource selection |
| `/codebase set` | Set enabled codebase resources |
| `/codebase show repo` | Display the repository map |

## /confirm

| Command | Description |
| --- | --- |
| `/confirm` | Prompt user for yes/no confirmation |

## /connect

| Command | Description |
| --- | --- |
| `/connect discord` | Connects a Discord application account |
| `/connect github` | Connects a GitHub account |
| `/connect google` | Connects a Google account |
| `/connect reddit` | Connects a Reddit account for bot messaging |
| `/connect slack` | Connects a Slack app installation |
| `/connect telegram` | Connects a Telegram bot account |
| `/connect x` | Connects an X (Twitter) account for bot messaging |

## /costs

| Command | Description |
| --- | --- |
| `/costs` | Displays total costs incurred by the Agent. |

## /debug

| Command | Description |
| --- | --- |
| `/debug app shutdown` | Shut down the app (asks first unless --confirm is given) |
| `/debug chat throwError` | Throw an error in the chat handler |
| `/debug checkpoint` | Dumps the current state of the agent to the chat window |
| `/debug commands` | Dumps a list of all the registered commands into the chat |
| `/debug logging` | Enable or disable debug logging |
| `/debug markdown` | Output a markdown sample |
| `/debug questions` | Test human interface request types |
| `/debug services` | Display service logs |

## /echo

| Command | Description |
| --- | --- |
| `/echo` | Display text or variable value |

## /email

| Command | Description |
| --- | --- |
| `/email draft clear` | Clear current draft selection |
| `/email draft get` | Show current draft |
| `/email draft send` | Send current draft |
| `/email message clear` | Clear current message selection |
| `/email message get` | Show current message |
| `/email message info` | Show info about current message |
| `/email message select` | Select a message |
| `/email message set` | Select an email message by ID |
| `/email messages list` | List messages |
| `/email provider get` | Show current provider |
| `/email provider reset` | Reset to initial provider |
| `/email provider select` | Interactively select a provider |
| `/email provider set` | Set the active provider |
| `/email search` | Search messages |

## /escalation

| Command | Description |
| --- | --- |
| `/escalation` | Show where agents' unanswered approvals are sent |
| `/escalation off` | Stop sending agents' unanswered approvals anywhere |
| `/escalation set` | Send agents' unanswered approvals to a person, channel or group |
| `/escalation test` | Send a test message to the approval escalation target |

## /eval

| Command | Description |
| --- | --- |
| `/eval` | Interpolate variables and execute a command |

## /file

| Command | Description |
| --- | --- |
| `/file add` | Add files to the chat session |
| `/file clear` | Remove all files from the chat session |
| `/file default` | Reset to default files from config |
| `/file list` | List all files in the chat session |
| `/file remove` | Remove files from the chat session |
| `/file select` | Open interactive file selector |

## /fileindex

| Command | Description |
| --- | --- |
| `/fileindex provider get` | Show active provider |
| `/fileindex provider reset` | Reset to default provider |
| `/fileindex provider select` | Interactively select a provider |
| `/fileindex provider set` | Set the active provider |
| `/fileindex search` | Search across files |

## /filesystem

| Command | Description |
| --- | --- |
| `/filesystem path add` | Allow agents to access a directory |
| `/filesystem path list` | List the directories agents may access |
| `/filesystem path remove` | Remove a directory from the allow-list |

## /for

| Command | Description |
| --- | --- |
| `/for` | Iterate over lists |

## /function

| Command | Description |
| --- | --- |
| `/function define expr` | Define a function that evaluates an expression |
| `/function define js` | Define a JavaScript scripting function |
| `/function define llm` | Define an LLM-backed scripting function |
| `/function delete` | Delete a scripting function |
| `/function show` | Show a specific scripting function |

## /functions

| Command | Description |
| --- | --- |
| `/functions clear` | Clear all local scripting functions |
| `/functions list` | List all scripting functions |

## /git

| Command | Description |
| --- | --- |
| `/git branch create` | Create and switch to a new branch |
| `/git branch current` | Show current branch |
| `/git branch delete` | Delete a branch |
| `/git branch list` | List all branches (local and remote) |
| `/git branch switch` | Switch to an existing branch |
| `/git commit` | Commit changes in the source directory |
| `/git diff` | Show uncommitted changes in the repository |
| `/git rollback` | Roll back to a previous commit state |

## /github

| Command | Description |
| --- | --- |
| `/github account auth` | Authenticate a GitHub account |
| `/github account get` | Show a GitHub account |
| `/github account list` | List available GitHub accounts |
| `/github account logout` | Revoke a GitHub account's stored token |
| `/github docs` | Get repository documentation |
| `/github file` | Get a repository file |
| `/github issue` | Get issue details |
| `/github issue comment` | Comment on an issue |
| `/github issue create` | Create an issue |
| `/github issues` | List repository issues |
| `/github issues search` | Search issues across repositories |
| `/github labels` | List repository labels |
| `/github pr` | Get pull request details |
| `/github pr comment` | Comment on a pull request |
| `/github pr create` | Open a pull request |
| `/github pr diff` | Show a pull request's diff |
| `/github pr files` | List a pull request's changed files |
| `/github pr review` | Review a pull request |
| `/github pr status` | Show a pull request's CI status |
| `/github prs` | List repository pull requests |
| `/github prs search` | Search pull requests across repositories |
| `/github search` | Search repositories |

## /goal

| Command | Description |
| --- | --- |
| `/goal` | Set a goal the agent pursues autonomously, with an independent verifier judging every turn |

## /google

| Command | Description |
| --- | --- |
| `/google account auth` | Authenticate a Google account |
| `/google account get` | Show a Google account |
| `/google account list` | List available Google accounts |

## /help

| Command | Description |
| --- | --- |
| `/help` | Show this help message |

## /hooks

| Command | Description |
| --- | --- |
| `/hooks disable` | Disable one or more hooks |
| `/hooks enable` | Enable one or more hooks |
| `/hooks get` | Show currently enabled hooks |
| `/hooks list` | List all registered hooks |
| `/hooks reset` | Reset hooks to initial configuration |
| `/hooks select` | Interactive hook selection |
| `/hooks set` | Set enabled hooks (replaces current selection) |

## /if

| Command | Description |
| --- | --- |
| `/if` | Conditional execution |

## /image

| Command | Description |
| --- | --- |
| `/image model get` | Show current image generation model |
| `/image model reset` | Reset to initial image generation model |
| `/image model select` | Interactively select an image generation model |
| `/image model set` | Set the image generation model |
| `/image reindex` | Reindex images in the media library directory |

## /list

| Command | Description |
| --- | --- |
| `/list` | Define or assign lists |

## /lists

| Command | Description |
| --- | --- |
| `/lists` | List all lists or show specific list |

## /loop

| Command | Description |
| --- | --- |
| `/loop` | Schedule a prompt to run repeatedly |

## /media

| Command | Description |
| --- | --- |
| `/media reindex` | Reindex the media library directory |

## /memory

| Command | Description |
| --- | --- |
| `/memory delete` | Delete a stored memory |
| `/memory list` | List stored memories, optionally within a single category |
| `/memory read` | Show the contents of a single memory |
| `/memory search` | Search memory names and contents for a substring |
| `/memory write` | Create or overwrite a memory |

## /message

| Command | Description |
| --- | --- |
| `/message` | Send a message to a user, channel, or group |

## /newsrpm

| Command | Description |
| --- | --- |
| `/newsrpm article` | Get article by slug or ID |
| `/newsrpm body` | Get article body content |
| `/newsrpm index` | Search indexed data by key |
| `/newsrpm providers` | List available news providers |
| `/newsrpm search` | Search articles with filters |

## /prompt

| Command | Description |
| --- | --- |
| `/prompt` | Prompt user for input |

## /queue

| Command | Description |
| --- | --- |
| `/queue add` | Add a task to a queue |
| `/queue clear` | Remove all pending items from a queue |
| `/queue create` | Create a new named queue |
| `/queue list` | Display the items waiting on a queue |
| `/queue queues` | List all configured queues |
| `/queue remove` | Remove a pending item from a queue by position |
| `/queue results` | Display recently completed work on a queue |
| `/queue status` | Show the configuration and health of a queue |

## /sandbox

| Command | Description |
| --- | --- |
| `/sandbox create` | Create a container |
| `/sandbox exec` | Execute a command in the active container |
| `/sandbox logs` | Get container logs |
| `/sandbox provider get` | Show current provider |
| `/sandbox provider reset` | Reset to initial provider |
| `/sandbox provider select` | Interactively select a provider |
| `/sandbox provider set` | Set the active provider |
| `/sandbox remove` | Remove a container |
| `/sandbox status` | Show sandbox status |
| `/sandbox stop` | Stop a container |

## /schedule

| Command | Description |
| --- | --- |
| `/schedule add` | Add a scheduled task |
| `/schedule history` | Show task execution history |
| `/schedule remove` | Remove a scheduled task |
| `/schedule show` | Show scheduled tasks |
| `/schedule start` | Start the scheduler |
| `/schedule stop` | Stop the scheduler |

## /script

| Command | Description |
| --- | --- |
| `/script info` | Show script information |
| `/script list` | List available scripts |
| `/script run` | Run a predefined script |

## /settings

| Command | Description |
| --- | --- |
| `/settings` | Show current chat settings. |

## /skills

| Command | Description |
| --- | --- |
| `/skills` | Manage installed skills |
| `/skills delete` | Delete an installed skill |
| `/skills disable` | Disable an installed skill |
| `/skills download` | Download and install a skill |
| `/skills enable` | Enable an installed skill |
| `/skills list` | List installed skills |
| `/skills reset` | Reset an installed skill |
| `/skills run` | Run an installed skill |

## /sleep

| Command | Description |
| --- | --- |
| `/sleep` | Sleep for specified seconds |

## /tasks

| Command | Description |
| --- | --- |
| `/tasks assign` | Assign an agent to a task |
| `/tasks board create` | Create a task board |
| `/tasks boards` | List task boards |
| `/tasks cancel` | Cancel running agents on a task |
| `/tasks comment` | Comment on a task |
| `/tasks dir` | Show where tasks are stored and how they are configured |
| `/tasks dispatch` | Start the agents assigned to a task |
| `/tasks list` | List the tasks on a board |
| `/tasks move` | Move a task to another column |
| `/tasks new` | Create a task on a board |
| `/tasks show` | Show a task with its agents and activity |

## /terminal

| Command | Description |
| --- | --- |
| `/terminal list` | List active terminal sessions |
| `/terminal output` | Get complete output from a session |
| `/terminal provider get` | Show current provider |
| `/terminal provider list` | List available providers |
| `/terminal provider select` | Interactively select a provider |
| `/terminal provider set` | Set the active provider |
| `/terminal send` | Send input to a session |
| `/terminal start` | Start a new terminal session |
| `/terminal stop` | Terminate a terminal session |

## /test

| Command | Description |
| --- | --- |
| `/test list` | List available tests |
| `/test run` | Run tests |

## /tool

| Command | Description |
| --- | --- |
| `/tool list` | List enabled tools |

## /tools

| Command | Description |
| --- | --- |
| `/tools disable` | Disable tools |
| `/tools enable` | Enable tools |
| `/tools select` | Interactively select tools |
| `/tools set` | Set enabled tools |

## /var

| Command | Description |
| --- | --- |
| `/var delete` | Delete a scripting variable |
| `/var set` | Set a scripting variable |

## /vars

| Command | Description |
| --- | --- |
| `/vars clear` | Clear all scripting variables |
| `/vars list` | List all scripting variables |
| `/vars show` | Show a scripting variable |

## /vault

| Command | Description |
| --- | --- |
| `/vault list` | List vault credentials |
| `/vault lock` | Lock the vault |
| `/vault store` | Store a credential |
| `/vault unlock` | Unlock the vault |

## /video

| Command | Description |
| --- | --- |
| `/video model get` | Show current video generation model |
| `/video model reset` | Reset to initial video generation model |
| `/video model select` | Interactively select a video generation model |
| `/video model set` | Set the video generation model |
| `/video reindex` | Reindex videos in the media library directory |

## /webhost

| Command | Description |
| --- | --- |
| `/webhost show` | Show web host URL and available resources |

## /websearch

| Command | Description |
| --- | --- |
| `/websearch deep` | Comprehensive search with content fetching |
| `/websearch fetch` | Fetch content from a URL |
| `/websearch news` | Search for news articles |
| `/websearch provider get` | Show current provider |
| `/websearch provider reset` | Reset to initial provider |
| `/websearch provider select` | Interactively select a provider |
| `/websearch provider set` | Set the active provider |
| `/websearch search` | Perform a web search |

## /while

| Command | Description |
| --- | --- |
| `/while` | Execute commands while condition is truthy |

## /workflow

| Command | Description |
| --- | --- |
| `/workflow cancel` | Cancel an in-flight workflow run by run id or workflow name |
| `/workflow list` | List available workflows |
| `/workflow rerun` | Run a finished or interrupted workflow run again |
| `/workflow spawn` | Spawn a new agent and run a workflow |

## /search_agent

| Command | Description |
| --- | --- |
| `/search_agent` *(agent)* | Perform a deep-dive web search on a specific topic |

## /deep

| Command | Description |
| --- | --- |
| `/deep research` *(agent)* | Perform deep multi-file research on a topic or goal |

## /memorize

| Command | Description |
| --- | --- |
| `/memorize` *(agent)* | Save something worth remembering as a durable memory |

## /design

| Command | Description |
| --- | --- |
| `/design` *(agent)* | Design HTML UI mockups organized into flows |

## /design-visual

| Command | Description |
| --- | --- |
| `/design-visual` *(agent)* | Design visually-verified HTML UI mockups organized into flows |

## /plan

| Command | Description |
| --- | --- |
| `/plan` *(agent)* | Generate an implementation plan for a task |

## /coding_explore

| Command | Description |
| --- | --- |
| `/coding_explore` *(agent)* | Deeply explore the codebase to map out logic, symbols, and architectural patterns |

## /swarm

| Command | Description |
| --- | --- |
| `/swarm` *(agent)* | Run a swarm of agents in parallel to complete a task |

## /leader

| Command | Description |
| --- | --- |
| `/leader` *(agent)* | Orchestrate a complex project using multiple specialized agents |
