# mnemo-hook

**Claude Code 持久记忆层** — 让 AI 记住上次会话发生了什么。

> *mnemo*（希腊语：mneme，记忆）— 因为每次会话都应该从上次结束的地方开始。

[English](../../README.md) | [Korean](README.ko.md) | [Russian](README.ru.md)

---

## 问题

每次启动新的 Claude Code 会话时，上下文都会丢失。你需要重新解释正在做什么、做了哪些决定、还有什么未完成。**mnemo-hook** 通过 Claude Code 的钩子系统自动记录和召回会话历史来解决这个问题。

## 功能特性

- **会话简报** — 新会话开始时显示上次会话摘要：最近的决定、进展、待办事项
- **自动保存** — 自动捕获 git 提交、文件写入里程碑和关键决定
- **静默提示** — 工作时，当当前任务与过去的记忆重叠时，显示一行提示
- **深度搜索** — 输入 `recall {主题}` 搜索所有存储的记忆
- **知识图谱** — 构建项目图 + Obsidian Canvas 可视化（可选）
- **隐私优先** — 自动删除密码、令牌、私钥等敏感信息
- **安全加固** — 路径遍历防护、ReDoS 防御、YAML 注入阻止，自动检测 GitHub/AWS/Anthropic/Slack/JWT 令牌

## 快速开始

```bash
git clone https://github.com/lucasung-debug/mnemo-hook.git
cd mnemo-hook
npm test
npm run install-hooks
# 重启 Claude Code
```

## 系统要求

- Node.js >= 18
- Claude Code
- 零 npm 依赖

## 许可证

MIT
