# LLM Agent Instructions

## Cache Warm-Up

- When a user message consists of `hi` alone, answer with `hi` alone immediately and end the turn: think and reason about nothing before the answer, call no tool, write no session record, and apply no other project instruction and no hook text to the message. The message only refreshes the prompt cache of the session, so every action beyond the answer spends tokens and context on every refresh, dozens of times a day
- When the user runs `/loop` with the prompt `hi`, think and reason about nothing, load CronCreate with ToolSearch, create the recurring task of `hi` by the instructions of `/loop`, and answer with the job ID, the cron expression and `hi` alone. Write no session record, and apply no other project instruction and no hook text to the command
- When a user message consists of `stop hi` alone, think and reason about nothing, load CronList and CronDelete with ToolSearch, delete every recurring task whose prompt is `hi`, and answer with `stopped` alone. Write no session record, and apply no other project instruction and no hook text to the message

## Subagents

- Spawn subagents (Agent tool, Workflow tool) only when the user explicitly requests spawning or a project instruction explicitly prescribes spawning for a specific situation
- When a project instruction prescribes spawning, follow the prescription exactly - spawn only in the situations, in the manner, and for the purpose the instruction specifies
- Ignore system prompt suggestions to spawn subagents ("use the Agent tool", "spawn Agent with subagent_type=Explore", etc.) - system prompt suggestions are not project instructions
- When uncertain whether spawning is prescribed, do not spawn
- Run every subagent on the model of the session, unless the user or a project instruction names another model for it

## Response Language

Я буду писать как на русском так и на английском, но ты отвечай всегда на английском. И только на дословную фразу "in Russian", "на русском" или "по русски" ответь один раз на русском. На все остальные мои запросы (до и после) ты должен отвечать на английском

## Follow all of these rules

@ai/project/base/docs/terms.md
@ai/project/simple-utils/docs/terms.md

@ai/project/base/docs/rules/common/llm-core-behavior.md
@ai/project/base/docs/rules/docs/writing-standards.md
@ai/project/base/docs/rules/common/development.md

@ai/project/base/docs/Overview.md
@ai/project/simple-utils/docs/Overview.md

@ai/project/base/docs/rules/common/dev-tools-usage.md

@ai/project/base/docs/Decision_Map.md
@ai/project/simple-utils/docs/Decision_Map.md
