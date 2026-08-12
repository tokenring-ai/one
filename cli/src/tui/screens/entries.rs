//! Build and group the entries displayed by the selection browser.

use chrono::{DateTime, Datelike, Local, NaiveDate, TimeZone};
use std::cmp::Reverse;

use super::{SelectionData, SelectionEntry, SelectionOutcome, SelectionTab};
use crate::rpc::{CheckpointEntry, RunningAgent};

pub(super) fn selection_has_any_options(data: &SelectionData) -> bool {
    !data.agents.is_empty()
        || !data.checkpoints.is_empty()
        || !data.types.is_empty()
        || !data.workflows.is_empty()
}

pub(super) fn build_tab_entries(tab: SelectionTab, data: &SelectionData) -> Vec<SelectionEntry> {
    match tab {
        SelectionTab::RunningAgents => build_running_agent_entries(data),
        SelectionTab::RecentSessions => build_recent_session_entries(data),
        SelectionTab::AgentDirectory => build_agent_directory_entries(data),
        SelectionTab::Workflows => build_workflow_entries(data),
    }
}

fn checkpoint_date_heading(created_at_ms: i64) -> String {
    Local
        .timestamp_millis_opt(created_at_ms)
        .single()
        .map(|created| created.format("%b %d, %Y").to_string())
        .unwrap_or_else(|| "Unknown Date".to_string())
}

pub(super) fn build_recent_session_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;

    let mut checkpoints = data.checkpoints.iter().collect::<Vec<_>>();
    checkpoints.sort_by_key(|checkpoint| Reverse(checkpoint.created_at));

    let mut groups: BTreeMap<String, Vec<&CheckpointEntry>> = BTreeMap::new();
    let mut group_order = Vec::new();
    for checkpoint in checkpoints {
        let heading = checkpoint_date_heading(checkpoint.created_at);
        if !groups.contains_key(&heading) {
            group_order.push(heading.clone());
        }
        groups.entry(heading).or_default().push(checkpoint);
    }

    let mut result = Vec::new();
    for heading in group_order {
        result.push(SelectionEntry::Heading(heading.clone()));
        let Some(items) = groups.remove(&heading) else {
            continue;
        };
        result.extend(items.into_iter().map(|checkpoint| {
            let timestamp = format_running_agent_timestamp(checkpoint.created_at);
            let label = if timestamp.is_empty() {
                checkpoint.name.clone()
            } else {
                format!("{}  {timestamp}", checkpoint.name)
            };
            let mut preview_lines = vec![
                checkpoint.name.clone(),
                format!("Created: {timestamp}"),
                format!("Agent: {}", checkpoint.agent_id),
            ];
            if !checkpoint.agent_type.is_empty() {
                preview_lines.push(format!("Type: {}", checkpoint.agent_type));
            }
            if !checkpoint.session_id.is_empty() {
                preview_lines.push(format!("Session: {}", checkpoint.session_id));
            }
            SelectionEntry::Option {
                label,
                outcome: SelectionOutcome::Resume {
                    checkpoint_id: checkpoint.id,
                    display_name: checkpoint.name.clone(),
                },
                preview_title: format!("Checkpoint {}", checkpoint.id),
                preview_lines,
            }
        }));
    }
    result
}

const RUNNING_AGENT_TIME_CATEGORIES: [&str; 4] =
    ["Today", "Yesterday", "This Week", "More Than a Week Ago"];

fn local_midnight_ms<Tz: TimeZone>(day: NaiveDate, tz: &Tz) -> Option<i64>
where
    Tz::Offset: Copy,
{
    let midnight = day.and_hms_opt(0, 0, 0)?;
    Some(
        tz.from_local_datetime(&midnight)
            .single()?
            .timestamp_millis(),
    )
}

pub(super) fn running_agent_time_category_at<Tz: TimeZone>(
    created_at_ms: i64,
    now: DateTime<Tz>,
) -> &'static str
where
    Tz::Offset: Copy,
{
    let today = now.date_naive();
    let tz = now.timezone();
    let Some(start_of_today) = local_midnight_ms(today, &tz) else {
        return "More Than a Week Ago";
    };
    let start_of_yesterday =
        local_midnight_ms(today.pred_opt().unwrap_or(today), &tz).unwrap_or(start_of_today);
    let week_ago_day = today
        .checked_sub_days(chrono::Days::new(7))
        .unwrap_or(today);
    let start_of_week_window = local_midnight_ms(week_ago_day, &tz).unwrap_or(start_of_yesterday);

    if created_at_ms >= start_of_today {
        "Today"
    } else if created_at_ms >= start_of_yesterday {
        "Yesterday"
    } else if created_at_ms >= start_of_week_window {
        "This Week"
    } else {
        "More Than a Week Ago"
    }
}

fn format_running_agent_timestamp(created_at_ms: i64) -> String {
    let Some(created) = Local.timestamp_millis_opt(created_at_ms).single() else {
        return String::new();
    };
    let today = Local::now().date_naive();
    let created_date = created.date_naive();
    if created_date == today {
        created.format("%H:%M:%S").to_string()
    } else if created_date.year() != today.year() {
        created.format("%b %d %Y %H:%M").to_string()
    } else {
        created.format("%b %d %H:%M").to_string()
    }
}

pub(super) fn running_agent_label(agent: &RunningAgent) -> String {
    let timestamp = format_running_agent_timestamp(agent.created_at);
    if timestamp.is_empty() {
        agent.display_name.clone()
    } else {
        format!("{}  {timestamp}", agent.display_name)
    }
}

fn running_agent_option(agent: &RunningAgent) -> SelectionEntry {
    SelectionEntry::Option {
        label: running_agent_label(agent),
        outcome: SelectionOutcome::Connect {
            id: agent.id.clone(),
            display_name: agent.display_name.clone(),
        },
        preview_title: format!("Agent {}", agent.id),
        preview_lines: {
            let status = if agent.idle { "idle" } else { "running" };
            let created = format_running_agent_timestamp(agent.created_at);
            let mut lines = vec![
                agent.display_name.clone(),
                format!("Status: {status}"),
                format!("Created: {created}"),
            ];
            if !agent.current_activity.is_empty() {
                lines.push(format!("Activity: {}", agent.current_activity));
            }
            lines
        },
    }
}

pub(super) fn build_running_agent_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;

    let now = Local::now();
    let mut categories: BTreeMap<&'static str, Vec<&RunningAgent>> = BTreeMap::new();

    for agent in &data.agents {
        let category = running_agent_time_category_at(agent.created_at, now);
        categories.entry(category).or_default().push(agent);
    }

    let mut result = Vec::new();
    for category in RUNNING_AGENT_TIME_CATEGORIES {
        let Some(mut agents) = categories.remove(category) else {
            continue;
        };
        agents.sort_by_key(|agent| Reverse(agent.created_at));
        result.push(SelectionEntry::Heading(category.to_string()));
        result.extend(agents.into_iter().map(running_agent_option));
    }
    result
}

pub(super) fn build_agent_directory_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;
    let mut categories: BTreeMap<String, Vec<SelectionEntry>> = BTreeMap::new();

    for entry in &data.types {
        let category = entry
            .category
            .clone()
            .unwrap_or_else(|| "Other".to_string());
        let list = categories.entry(category).or_default();
        list.push(SelectionEntry::Option {
            label: format!("{} ({})", entry.display_name, entry.r#type),
            outcome: SelectionOutcome::Spawn {
                agent_type: entry.r#type.clone(),
                display_name: entry.display_name.clone(),
            },
            preview_title: entry.display_name.clone(),
            preview_lines: {
                let tools = if entry.enabled_tools.is_empty() {
                    "(none)".to_string()
                } else {
                    entry
                        .enabled_tools
                        .iter()
                        .map(|s| format!("- {}", s))
                        .collect::<Vec<_>>()
                        .join("\n")
                };
                vec![
                    entry.description.clone(),
                    format!("Enabled tools:\n{tools}"),
                ]
            },
        });
    }

    let mut result = Vec::new();
    for (category, mut list) in categories {
        if list.is_empty() {
            continue;
        }
        list.sort_by(|a, b| entry_label(a).cmp(entry_label(b)));
        result.push(SelectionEntry::Heading(category));
        result.extend(list);
    }
    result
}

pub(super) fn build_workflow_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;
    let mut categories: BTreeMap<String, Vec<SelectionEntry>> = BTreeMap::new();

    for wf in &data.workflows {
        let category = if wf.category.is_empty() {
            "Other".to_string()
        } else {
            wf.category.clone()
        };
        let list = categories.entry(category).or_default();
        list.push(SelectionEntry::Option {
            label: format!("{} ({})", wf.display_name, wf.name),
            outcome: SelectionOutcome::Workflow {
                name: wf.name.clone(),
                display_name: wf.display_name.clone(),
            },
            preview_title: wf.display_name.clone(),
            preview_lines: {
                let mut lines = vec![wf.description.clone()];
                if !wf.steps.is_empty() {
                    let labels: Vec<String> = wf.steps.iter().map(|s| s.label()).collect();
                    lines.push(format!("Steps: {}", labels.join(" → ")));
                }
                lines
            },
        });
    }

    let mut result = Vec::new();
    for (category, mut list) in categories {
        if list.is_empty() {
            continue;
        }
        list.sort_by(|a, b| entry_label(a).cmp(entry_label(b)));
        result.push(SelectionEntry::Heading(category));
        result.extend(list);
    }
    result
}

fn entry_label(entry: &SelectionEntry) -> &str {
    match entry {
        SelectionEntry::Heading(l) => l,
        SelectionEntry::Option { label, .. } => label,
    }
}
