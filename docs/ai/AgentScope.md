---
title: AgentScope Java：从框架全貌到常用 API
description: 先用一次请求建立 AgentScope Java 的整体认知，再按 API 和问题查找模型、工具、状态、权限、MCP、RAG 与服务化用法。
---

# AgentScope Java：从框架全貌到常用 API

> 这份笔记有两个入口：**第一次接触框架**时，先读下面的「整体认识」和[最小示例](#s02)，弄清一次请求的执行过程；**遇到具体问题**时，按 API 名或现象查[API 索引](#api-index)与[故障速查](#s19)。示例固定以 **AgentScope Java v2.0.4** 为基线，核对日期为 **2026-10-18**。在线 `/v2/` 文档持续更新，可能展示尚未进入这个版本的 API。

## 这份笔记怎么用 {#how-to-use}

- **完全没有整体认知**：先读[整体认识](#mental-model)、[最小示例](#s02)与[ReAct 循环](#s03)。读完应能说清消息、工具和状态分别在哪一步起作用。
- **已经知道类名，想查 API**：按 `Ctrl+K` 使用站内搜索，输入 `RuntimeContext`、`Toolkit.registerTool` 等；也可浏览[API 索引](#api-index)。每个入口链接到用法和边界。
- **想理解某项技术**：用[快速定位](#quick-locator)找到对应章节，先看它解决的问题，再看相邻概念和代码。
- **代码行为不符合预期**：从[故障速查](#s19)开始，再回到章节中的版本说明及固定版本源码。

带 `java` 的代码块有两类：第 2 节的 `FirstAgent.java` 是独立类，替换模型凭据后可从 IDE 运行；标为「片段」的代码需要放进已有类、方法或应用装配处，变量由业务代码提供。文中框架事实尽量链接到固定版本源码或文档；「工程建议」用于指导应用设计，不是框架自动提供的保证。

## 先建立整体认识 {#mental-model}

### Agent 是什么，AgentScope 多做了什么

普通模型调用通常是：应用发送消息，模型返回文本。Agent 让模型在回答前**选择下一步动作**：它可以请求调用某个工具，应用执行并把结果送回模型，模型再决定继续调用工具还是给出最终答复。AgentScope Java 把这个循环、消息结构、工具注册、权限判断、事件流和会话状态实现为 SDK。模型负责生成和选择，Java 工具负责访问真实业务系统，应用仍负责认证、授权、部署和外部事务。

第一次阅读只要记住六个对象：

- **模型 `Model`**：生成文本或工具调用；字符串模型名要有对应 provider 依赖。[模型配置](#s05)
- **Agent `ReActAgent` / `HarnessAgent`**：组织推理与工具循环；Harness 再加长期任务能力。[二者区别](#s03)
- **消息 `Msg`**：把用户输入、工具请求/结果和最终回答组织成结构化内容。[消息结构](#s04)
- **工具 `@Tool` / `Toolkit`**：把 Java 方法或 MCP 能力暴露给模型，实际执行仍在应用侧。[工具示例](#s06)
- **本次请求 `RuntimeContext`**：带 `userId`、`sessionId` 等身份和临时数据。[身份范围](#s10)
- **可恢复状态 `AgentState` / `AgentStateStore`**：保存对应会话的历史、权限和执行位置等。[状态保存](#s10)

它们在一个 Java 应用中的位置可以这样看：

```text
浏览器 / HTTP 请求
    │ 用户文本 + 已认证的用户 ID + 会话 ID
    ▼
你的 Spring Boot 应用 ──构造──> RuntimeContext、UserMessage
    │                              │
    └──调用──> ReActAgent 或 HarnessAgent
                   ├── Model：请求大模型
                   ├── Toolkit：注册并分派 Java/MCP 工具
                   ├── AgentStateStore：读取和保存会话状态
                   └── AgentEvent：向前端报告文本增量、工具进度、确认请求
    ◀── Msg：最终回答或等待确认的结果
```

### 用一个问题看完整执行过程 {#flow-walkthrough}

假设用户问「查一下编号 `N-42` 的笔记，并概括要点」，应用注册了 `find_note(note_id)` 工具。一次典型运行如下；模型可能选择不调用工具，因此需要验证工具轨迹，不能只从最终文本猜测执行过程。

| 步骤 | 实际发生了什么 | 对应 API / 数据 |
| --- | --- | --- |
| 1 | 应用从登录态取得用户 `alice`，从已授权会话取得 `notes-001`，封装用户问题 | `RuntimeContext.builder()`、`new UserMessage(...)` |
| 2 | 若配置了 StateStore，Agent 用这两个 ID 读取会话状态；随后准备系统指令、历史和工具 schema | `AgentStateStore`、`Toolkit` |
| 3 | 模型返回对 `find_note` 的调用请求，参数是 `note_id=N-42` | `ToolUseBlock`；流式观察者看到工具相关事件 |
| 4 | 框架检查工具权限。若是 `ASK`，先暂停等待用户确认 | `PermissionDecision`、`RequireUserConfirmEvent` |
| 5 | 获准后 Java 工具按 `alice` 的身份查询业务数据，返回成功或失败 | `@Tool` 方法、`ToolResultBlock` |
| 6 | 工具结果回到模型输入；模型形成给用户的摘要 | `Msg`、`TextBlock`、`GenerateReason` |
| 7 | 配置了 StateStore 时保存状态；应用把最终消息或事件流交给前端 | `AgentStateStore`、`call()` / `streamEvents()` |

**要把两种循环分开理解**：应用的一次 `call()` 是一个外部请求；内部可能有多次模型调用和工具执行。如果只看「模型回复了一段话」，就无法判断它是否检索了资料、是否被权限系统挡住，也无法解释成本和延迟。下面的章节按这个调用链展开。

### 之后遇到这些名词，怎样放回整张图

- **上下文 Context**：每次请求模型前，决定这一次模型**看得到**哪些消息和资料；磁盘上的完整历史可能更长。
- **StateStore**：调用开始时读、结束时写，回答「这段会话的数据放在哪里」；它与 Workspace 文件目录是两类存储。
- **长期记忆 Memory**：跨会话提炼稳定事实和偏好；它不承担全文资料库的检索。
- **Workspace**：Harness 放置指令、Skill、记忆与产物的逻辑文件空间；文件目录本身不是强隔离沙箱。
- **Skill**：告诉 Agent 某类任务**怎样做**；Tool 才是可调用的具体操作。
- **MCP**：按协议连接外部工具服务；连接 MCP Server 不等于启动了另一个 Agent。
- **RAG**：从外部文档中检索与问题相关的片段和来源；它处理证据，不等于长期记忆。
- **Subagent**：让另一 Agent 独立完成有边界的子任务；它有自己的执行过程。

遇到「框架为什么记不住」时沿 `RuntimeContext → StateStore → Context → Memory` 查；遇到「回答没有依据」时沿 `RAG → ToolResultBlock → Msg` 查；遇到「工具没有执行」时沿 `Toolkit → Permission → AgentEvent` 查。这比逐个背术语更容易定位原因。

## 常用 API 按用途查 {#api-index}

以下按**操作目的**排，直接用页面搜索或站内搜索输入类名即可。每项后的链接给出解释与代码；这份索引本身不要求你记住所有类。

### 创建 Agent，发起调用

- **`ReActAgent.builder()`**：设 `name`、`sysPrompt`、`model`、`toolkit` 后 `build()`，得到核心 Agent。[完整代码](#s02) · [ReAct 过程](#s03)
- **`HarnessAgent.builder()`**：在核心循环上配置 `workspace` 等长期任务能力。[构建片段](#s02) · [文件布局](#s11)
- **`new UserMessage(text)` + `agent.call(List.of(msg), ctx)`**：把一条用户消息送进 ReActAgent，返回 `Mono<Msg>`；Harness 还提供单条消息重载。[调用示例](#s02) · [消息](#s04)
- **`agent.streamEvents(msg, ctx)`**：取得 `Flux<AgentEvent>`，用于文本增量、工具进度、确认请求等。[事件示例](#s04) · [WebFlux 接线](#s17)
- **`agent.call(msgs, MyType.class, ctx)`**：要求结构化结果，仍先返回 `Msg`，再用 `getStructuredData(MyType.class)` 提取。[结构化输出](#s05)

### 用户、会话和运行状态

- **`RuntimeContext.builder().userId(...).sessionId(...).build()`**：标识**本次调用**属于谁、哪段会话。[身份与状态](#s10)
- **Builder 的 `stateStore(...)`**：让纯 ReActAgent 在调用结束时保存、下一次按同一身份恢复。[持久化代码](#s10)
- **`Msg.getTextContent()` / `getContentBlocks(ToolUseBlock.class)`**：读取一条回复的文本和特定内容块；完整工具过程要看事件或历史。[消息与事件](#s04)

### 工具、控制和扩展

- **`@Tool`、`@ToolParam`、`Toolkit.registerTool(...)`**：把 Java 方法注册给模型，工具执行仍由应用承担。[完整工具示例](#s06)
- **`ToolResultBlock.text(...).withState(SUCCESS)` / `error(...)`**：声明一次工具调用成功或失败。[结果状态](#s06)
- **`PermissionContextState`、`ConfirmResult`**：设置写操作规则，并把人工决定交回同一会话。[权限与确认](#s08)
- **`MiddlewareBase`**：在整次调用、每轮推理、工具阶段或模型请求周围加逻辑。[五个 Hook](#s07)
- **`McpClientBuilder.create(...)`**：连接外部 MCP Server，再通过 Toolkit 暴露其中的工具。[MCP](#s14)
- **`SubagentDeclaration`、`agent_spawn`**：定义并调用有单独职责的子 Agent。[任务编排](#s15)

`AgentState`、Workspace、长期记忆和 RAG 这几个名词容易混：先看[上下文](#s09)与[技术地图](#mental-model)，再分别查[状态](#s10)、[记忆](#s12)、[RAG](#s16)。

## 按问题快速定位 {#quick-locator}

| 你要查什么 | 对应章节 |
| --- | --- |
| 项目到底该引入什么、最小调用怎么写 | [1 定位](#s01)、[2 最小示例](#s02) |
| Agent、Harness、消息、流式输出的关系 | [3 架构](#s03)、[4 消息和事件](#s04) |
| 模型、结构化输出、工具和扩展点 | [5 模型](#s05)、[6 工具](#s06)、[7 Middleware](#s07) |
| 写操作审批、确认后继续、隔离 | [8 权限](#s08)、[10 状态恢复](#s10)、[11 工作区](#s11) |
| 长对话、记忆、Skill | [9 上下文](#s09)、[12 记忆](#s12)、[13 Skill](#s13) |
| 接 MCP、子 Agent、RAG、Spring Boot | [14 MCP](#s14)、[15 编排](#s15)、[16 RAG](#s16)、[17 服务化](#s17) |
| 出问题该先查哪里 | [18 观测与验证](#s18)、[19 综合速查](#s19) |

## 1. AgentScope Java 的定位和版本边界 {#s01}

AgentScope Java v2 把「模型推理并选择工具」和「在长期任务中维持工作区、状态、权限与协作」分开。你在 Java 应用中直接组合 SDK 时，通常从 `agentscope-core` 的 `ReActAgent` 或 `agentscope-harness` 的 `HarnessAgent` 起步。另一个产品层面的 `AgentScope Service` 是托管运行时，有独立的 API 和部署要求。把 Harness 依赖加进普通 Spring Boot 项目，不会自动得到 Service 的会话 API、Team 或 Workflow。

| 层 | 解决的问题 | 何时用 |
| --- | --- | --- |
| Core / `ReActAgent` | 模型、消息、推理循环、工具、权限、事件 | 需要精确控制能力和较轻的嵌入 |
| Harness / `HarnessAgent` | 在 ReAct 上装配工作区、文件、记忆、Skill、压缩、子 Agent 等 | 任务跨多步、需要保存过程或操作文件 |
| Service | 托管 Agent、运行时、会话与组织级协作 | 愿意运行平台并通过其 API 接入 |

**版本判读**：Releases 在核对日将 v2.0.4 标为 Latest，`2.1.0-BETA1` 是预发布。下面示例只承诺与 v2.0.4 **源码签名**相符；没有连接实际模型或完成 Maven 编译。网上 v1、2.0.0-RC 和当前 `main` 的例子不可直接混用。尤其要注意：当前文档的 `AgentSession` / `Session Log` 与六个 Middleware Hook 不属于 v2.0.4；另一方面 v2.0.4 **确实仍有** RAG 兼容扩展，不能简单说 Java v2 没有 RAG。

[固定版本 Release](https://github.com/agentscope-ai/agentscope-java/releases/tag/v2.0.4) · [v2 中文文档](https://java.agentscope.io/v2/zh/) · [固定版本源码](https://github.com/agentscope-ai/agentscope-java/tree/v2.0.4)

## 2. 环境与一个最小 Agent {#s02}

先用 `ReActAgent` 跑通「消息 → 模型 → 回复」，因为它只引入核心推理循环。看懂这一步后，再把它换成 `HarnessAgent`，观察工作区和会话状态如何加入。需要 JDK 17+、官方推荐 Maven 3.9+、一个可用的模型服务与密钥。示例选 DashScope；换供应商时，**模型扩展依赖、字符串前缀、环境变量**要一起换。

### 准备项目

目录只有 Maven POM 和一个 Java 类；以下是完整的最小 `pom.xml`，可以从普通 Maven 项目开始：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>example</groupId>
  <artifactId>agentscope-notes-demo</artifactId>
  <version>1.0-SNAPSHOT</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <agentscope.version>2.0.4</agentscope.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>io.agentscope</groupId>
      <artifactId>agentscope-harness</artifactId>
      <version>${agentscope.version}</version>
    </dependency>
    <dependency>
      <groupId>io.agentscope</groupId>
      <artifactId>agentscope-extensions-model-dashscope</artifactId>
      <version>${agentscope.version}</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
      </plugin>
    </plugins>
  </build>
</project>
```

`agentscope-harness` 会传递依赖 `agentscope-core`；所以这个项目既能写 `ReActAgent`，也能写 `HarnessAgent`。只做核心 Agent 时可直接依赖 `agentscope-core`。模型实现始终来自单独的 `agentscope-extensions-model-*`。在 PowerShell 当前终端设置 `$env:DASHSCOPE_API_KEY = "你的密钥"`，再从同一个终端启动 IDE 或 Maven；实际应用把密钥交给凭据系统。

### 第一段：只向模型提问

保存为 `src/main/java/example/FirstAgent.java`，从 IDE 运行 `main`。这段代码的输出由模型决定，重点看 API 的输入和返回类型：

```java
package example;

import io.agentscope.core.ReActAgent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.tool.Toolkit;
import java.util.List;

public class FirstAgent {
    public static void main(String[] args) {
        ReActAgent agent = ReActAgent.builder()
                .name("notes-assistant")
                .sysPrompt("你是技术笔记助手，事实不足时明确说明。")
                .model("dashscope:qwen-plus")
                .toolkit(new Toolkit())
                .build();

        RuntimeContext ctx = RuntimeContext.builder()
                .userId("local-user")
                .sessionId("notes-001")
                .build();
        Msg result = agent.call(
                List.of(new UserMessage("用三句话解释什么是 Agent。")), ctx).block();
        if (result != null) {
            System.out.println(result.getTextContent());
            System.out.println("结束原因：" + result.getGenerateReason());
        }
    }
}
```

逐行对应：`sysPrompt` 是稳定行为指令；`model` 找模型 provider；空 `Toolkit` 表示目前没有业务工具；`UserMessage` 是本轮输入；`RuntimeContext` 选定用户和会话；`call` 返回 Reactor `Mono<Msg>`，`block()` 在命令行中订阅并等待结果。**默认的纯 `ReActAgent` 未配置 `stateStore`，不能因为传了相同 `sessionId` 就认为已经持久化对话**；保存方法见[第 10 节](#s10)。

### 第二段：需要工作区和长期任务时换成 Harness

核心调用方式不变，只把构建和资源生命周期换成 Harness；下方是另一个类中的装配片段：

```java
try (HarnessAgent agent = HarnessAgent.builder()
        .name("notes-assistant")
        .sysPrompt("你是技术笔记助手，事实不足时明确说明。")
        .model("dashscope:qwen-plus")
        .workspace(Path.of(".agentscope/workspace"))
        .build()) {
    RuntimeContext ctx = RuntimeContext.builder()
            .userId("local-user").sessionId("notes-001").build();
    Msg result = agent.call(new UserMessage("总结今天的笔记。"), ctx).block();
    System.out.println(result.getTextContent());
}
```

这个片段需导入 `HarnessAgent`、`RuntimeContext`、`Msg`、`UserMessage` 和 `java.nio.file.Path`。`try` 在命令行任务结束时释放 Harness 资源；在 Spring Boot 中应由应用管理单例的关闭时机。Harness 默认加入工作区、状态等能力，具体读取和写入位置见[第 11 节](#s11)。

`RuntimeContext` 中的用户和会话 ID 应来自已认证的应用端，不从模型文本推断。`call()` / `streamEvents()` 是冷的响应式流：没有订阅就没有执行；同一个流重复订阅，可能再次调用模型或工具。命令行可 `block()`，WebFlux 请求链直接组合 `Mono` / `Flux`。运行失败时优先核对 JDK、依赖版本、密钥、模型名和网络端点。

[固定版本快速开始](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/quickstart.md) · [HarnessAgent 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/HarnessAgent.java)

## 3. Agent、ReAct 循环与 Harness {#s03}

`Agent` 表示可调用的智能体接口。`ReActAgent` 每轮准备上下文、让模型生成内容或工具调用、检查权限、执行工具、把结果送回模型，直到得到回复、达到轮数上限或被中断。`HarnessAgent` 在这个内核外管理长任务所需的工作区与运行能力，不代表采用了不同的推理原理。

为什么叫 **ReAct**？它把「推理下一步」和「采取行动」交替进行。以 `find_note` 为例：模型第一次输出工具名和参数；Java 工具返回笔记内容；模型第二次基于结果写摘要。对外只有一次 `agent.call(...)`，内部可能有两次模型请求。没有工具可用时，模型通常直接回答；工具被拒绝或等待确认时，这次调用会走不同的终态。因此诊断 Agent 行为要看消息与事件，不能只看最后一段文本。

```text
用户消息 + 已保存会话状态
  → 构建模型输入
  → 模型回复 / 提议工具
  → 权限判定（ALLOW / DENY / ASK）
  → 执行工具或等待人工
  → 工具结果进入会话
  → 继续推理或返回终态
```

| 入口 | 得到什么 | 常见用途 |
| --- | --- | --- |
| `call(...)` | `Mono<Msg>`，一次调用的最终消息或挂起结果 | 普通请求、服务端聚合结果 |
| `streamEvents(...)` | `Flux<AgentEvent>` | 前端流式显示、工具进度、HITL |
| `observe(...)` | 观察运行过程的 API | 需要与执行控制分开处理的场景 |
| 结构化 `call(..., Class<?>, ctx)` | 仍是 `Mono<Msg>` | Java 对象输出，需检查并提取 |
| 中断/运行控制 | 取消、停止或恢复相应运行 | 长任务与断线处理 |

`maxIters` 限制 ReAct 循环轮数，不等于总 Token、费用或执行时长上限。`Msg.getGenerateReason()` 是判断正常完成、权限等待、轮数限制等终态的入口。v2.0.4 的 HarnessAgent 允许同一实例服务多个身份，同一实例内相同用户/会话排队；这不等于跨 JVM 的全局串行，更不免除共享 Tool、Middleware 的线程安全要求。对外部写操作仍应设置业务幂等键。

选择入口时可以按任务复杂度判断：只需模型和少量业务工具，用 `ReActAgent` 明确组装 Toolkit 与 StateStore；需要工作区文件、长期记忆、Skill、计划和子 Agent，再用 `HarnessAgent`。要在组织内托管多种 Agent、统一运行时和工作流，才考虑 Service。两种 SDK Agent 对应用的主要调用形状相近，迁移核心业务 Tool 不需要重写成另一个语言的框架。

[Agent 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/agent.md) · [ReActAgent 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java) · [Harness 架构](https://java.agentscope.io/v2/zh/docs/harness/architecture)

## 4. Msg、内容块与事件 {#s04}

最容易混淆的是三层：**Msg** 是一条有角色和元数据的消息；**ContentBlock** 是消息内的文本、思考、工具调用/结果或多模态片段；**AgentEvent** 是运行时发给观察者的增量和交互信号。最终 `Msg` 可有多个内容块，所以 `getTextContent()` 只适合取文本，不代表完整工具轨迹。

可以把 `Msg` 想成一封信，`ContentBlock` 是信里的段落或附件，`AgentEvent` 是写信和投递过程中不断传出的状态。用户问题是 `UserMessage`；模型要求使用工具时，回复中有 `ToolUseBlock`；工具完成后产生 `ToolResultBlock`；最终回答里常见的是 `TextBlock`。一个回复可能同时包含文本和工具调用，所以不能把 `Msg` 简化成 `String`。

| 类型 | 你关心的字段/现象 | 用法 |
| --- | --- | --- |
| `UserMessage` / `AssistantMessage` 等 | 角色、内容块、metadata | 构造上下文和保存会话 |
| `TextBlock`、`ThinkingBlock` | 可见文本与模型推理片段 | 根据产品策略展示 |
| `ToolUseBlock` / `ToolResultBlock` | 调用 ID、工具名、输入、状态、结果 | 关联一次工具生命周期 |
| 图片、音频等数据块 | URL 或内容载荷、媒体类型 | 先核对所用模型实际支持 |
| `AgentEvent` 子类 | 文本 delta、工具开始/结束、确认请求等 | 流式 UI、追踪与交互 |

事件不是消息的另一个名字。前端应按回复 ID、块 ID 累加文本增量，按 tool call ID 关联工具开始/结束，不把 JSON 参数增量直接当作最终完整参数。`ToolProgressEvent` 只是进度，`ThinkingBlock` 也不是工具已执行的证明。最后以终态消息和工具结果确认结果。事件是否可在断线后重放取决于运行层是否保存事件，不能由「事件是瞬时的」推出「永远不能保存」。将日志留存、会话历史、前端流分开设计。

命令行先用最粗粒度的方法观察事件类型，再按产品需要处理具体事件；`blockLast()` 只适用于示例程序：

```java
agent.streamEvents(new UserMessage("查找笔记 N-42 并总结"), ctx)
    .doOnNext(event -> System.out.println(event.getClass().getSimpleName()))
    .blockLast();
```

只用 `call()` 时，也可以查看结构化内容，而不是只打印文本：

```java
Msg reply = agent.call(List.of(new UserMessage("查找笔记 N-42")), ctx).block();
if (reply != null) {
    System.out.println(reply.getTextContent());
    System.out.println(reply.getGenerateReason());
    reply.getContentBlocks(ToolUseBlock.class)
         .forEach(tool -> System.out.println(tool.getName() + " : " + tool.getState()));
}
```

最后一段是方法体片段，需导入 `Msg`、`UserMessage`、`ToolUseBlock`、`List`，并使用已有的 `agent` 和 `ctx`。`getContentBlocks(...)` 只检查**这条返回消息**，不保证包含前面轮次的全部工具调用；要重建完整过程应观察事件流或保存的会话记录。如果要画前端工具卡片，还要用 tool call ID 关联开始、结果与确认请求，不能只按工具名关联，因为同一个工具可能被调用多次。

```java
Flux<AgentEvent> events =
        agent.streamEvents(new UserMessage("总结这篇笔记"), ctx);
return events; // WebFlux 层可以继续映射为 SSE，由框架订阅。
```

[消息与事件](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/message-and-event.md) · [Msg 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/Msg.java)

## 5. 模型接入与结构化输出 {#s05}

模型标识 `provider:model` 由已安装模块的 `ModelProvider` 解析。能解析不表示账号有权限、该型号存在、该型号支持工具或 JSON Schema。特殊 endpoint、网络客户端、超时及供应商参数可用具体 `*ChatModel.builder()` 创建 `Model`，再交给 Agent。

| 前缀 | 模块 | 常见环境变量 |
| --- | --- | --- |
| `dashscope:` | `agentscope-extensions-model-dashscope` | `DASHSCOPE_API_KEY` |
| `openai:` | `agentscope-extensions-model-openai` | `OPENAI_API_KEY` |
| `deepseek:` | OpenAI 兼容模块内 provider | `DEEPSEEK_API_KEY` |
| `anthropic:` | `agentscope-extensions-model-anthropic` | `ANTHROPIC_API_KEY` |
| `gemini:` | `agentscope-extensions-model-gemini` | `GEMINI_API_KEY` |
| `ollama:` | `agentscope-extensions-model-ollama` | `OLLAMA_BASE_URL` |

结构化输出的 Java 类型是**结果提取目标**，`call` 本身不返回 `Mono<NoteSummary>`：

```java
record NoteSummary(String title, java.util.List<String> keyPoints) {}

Msg msg = agent.call(
        java.util.List.of(new UserMessage("整理为标题和三个要点：……")),
        NoteSummary.class,
        ctx).block();
if (msg == null || !msg.hasStructuredData()) {
    throw new IllegalStateException("本次运行没有结构化终态结果");
}
NoteSummary summary = msg.getStructuredData(NoteSummary.class);
```

具体模型支持原生结构化输出时框架可传 schema；否则可能用 `generate_response` 合成工具取得结构化结果。日志里出现这个工具名未必是业务工具。对象反序列化成功也要校验字段和业务约束。v2.0.4 提供模型重试、`fallbackModel` 和 failover listener；模型调用重试并不负责 Java 工具的幂等或外部事务补偿。

[模型注册源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/model/ModelRegistry.java) · [CallableAgent](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/agent/CallableAgent.java) · [固定版本模型示例](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/quickstart.md)

## 6. 工具定义、Toolkit 与执行策略 {#s06}

模型看到的是工具的 schema，真正执行的是 Java 方法或外部工具。`Toolkit` 管理注册、可见性与分派；`@Tool` 方法适合应用内函数，`ToolBase` 适合自定义 schema、权限检查或外部执行控制。工具名和参数描述应写成模型能理解的业务含义，但不能把描述当作权限。

一次工具调用分为四段：你写 Java 方法 → `Toolkit.registerTool` 从注解生成 schema → 模型按 schema 提出工具名和参数 → 框架先过权限，再调用 Java 方法，把结果塞回推理上下文。**模型没有直接调用数据库的能力**；它只能请求应用已经注册的操作。下面的 `NoteTools` 用内存 Map 展示读取，业务项目再把 Map 换成已做身份校验的查询服务。

```java
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolResultState;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import java.util.Map;

public class NoteTools {
    private final Map<String, String> notes = Map.of(
            "N-42", "ReAct 循环：模型提出动作，应用执行工具，再把结果交回模型。");

    @Tool(name = "find_note", description = "按编号读取一条示例笔记",
          readOnly = true, concurrencySafe = true)
    public ToolResultBlock find(
            @ToolParam(name = "note_id", description = "笔记编号") String noteId,
            RuntimeContext ctx) {
        if (noteId == null || noteId.isBlank()) {
            return ToolResultBlock.error("note_id 不能为空");
        }
        // 本示例只有公开的内存数据；实际服务要依据 ctx 的用户身份查权限。
        String content = notes.get(noteId);
        if (content == null) {
            return ToolResultBlock.error("笔记不存在：" + noteId);
        }
        return ToolResultBlock.text("编号=" + noteId + "；内容=" + content)
                .withState(ToolResultState.SUCCESS);
    }
}
```

保存为 `NoteTools.java` 后，在应用装配处注册；以下代码置于 `main` 方法或 Spring Bean 装配方法中，`ctx` 使用第 2 节创建的上下文：

```java
Toolkit toolkit = new Toolkit();
toolkit.registerTool(new NoteTools());
ReActAgent agent = ReActAgent.builder()
        .name("notes-assistant")
        .sysPrompt("回答笔记问题时，先根据编号读取笔记，再概括工具返回的内容。")
        .model("dashscope:qwen-plus")
        .toolkit(toolkit)
        .build();
Msg result = agent.call(
        List.of(new UserMessage("请总结 N-42 号笔记")), ctx).block();
System.out.println(result.getTextContent());
```

第二段需导入 `Toolkit`、`ReActAgent`、`Msg`、`UserMessage` 与 `List`。模型通常会按提示使用工具，但提示词不是强制执行保证；如果业务要求「必须查询后才回答」，应用应在进入 Agent 前先执行查询或验证工具轨迹。`@ToolParam` 是**模型应填写**的参数，`RuntimeContext` 由框架注入，不要标成模型参数。`readOnly` 默认 false、`concurrencySafe` 默认 true；两者是声明，不会替你完成鉴权或线程安全。`ToolResultBlock.text(...)` 在 v2.0.4 **默认是 RUNNING**，完整结果应明确设 `SUCCESS`，失败可用 `error(...)`。工具进度事件也不是最终结果。

工具组能控制本轮哪些 schema 暴露给模型；隐藏工具是节省上下文和引导选择的方法，**不能代替执行时授权**。v2.0.4 的 Meta Tool 使用 `reset_tools` 管理组，部分旧文档的 `list_tools` / `activate_group` 名字不适用。业务写工具应把「模型提出请求」「权限允许」「服务端鉴权」「业务事务成功」视为四个独立步骤，并用执行 ID 实现幂等。

[Tool 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Tool.java) · [Toolkit](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java) · [ToolResultBlock](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/ToolResultBlock.java)

## 7. Middleware：在哪一层扩展 {#s07}

v2.0.4 的 `MiddlewareBase` 有五个 Hook，签名都携带 `RuntimeContext`。在线文档出现的 `onAgentStateReady` 和 `activePoints()` 属于后续版本，复制到固定版本会找不到方法。

| Hook | 包裹的范围 | 适合做什么 |
| --- | --- | --- |
| `onAgent` | 整次 Agent 调用 | 一次运行的总耗时、终态记录 |
| `onReasoning` | 一轮推理 | 观察多轮决策、动态约束 |
| `onActing` | 工具执行阶段 | 记录工具调用与结果；输入可能包含多个 ToolUseBlock |
| `onModelCall` | 一次底层模型调用 | 模型耗时、用量与故障观测 |
| `onSystemPrompt` | 系统提示词变换 | 注入当前请求需要的稳定指令 |

前四者使用 `next.apply(input)` 继续执行，返回 `Flux<AgentEvent>`；`onSystemPrompt` 返回 `Mono<String>`。例如模型调用计时：

```java
public final class ModelTimingMiddleware
        implements io.agentscope.core.middleware.MiddlewareBase {
    @Override
    public reactor.core.publisher.Flux<io.agentscope.core.event.AgentEvent> onModelCall(
            io.agentscope.core.agent.Agent agent,
            io.agentscope.core.agent.RuntimeContext ctx,
            io.agentscope.core.middleware.ModelCallInput input,
            java.util.function.Function<
                    io.agentscope.core.middleware.ModelCallInput,
                    reactor.core.publisher.Flux<io.agentscope.core.event.AgentEvent>> next) {
        return reactor.core.publisher.Flux.defer(() -> {
            long start = System.nanoTime();
            return next.apply(input).doFinally(signal ->
                    System.out.printf("session=%s modelMs=%d signal=%s%n",
                            ctx.getSessionId(),
                            (System.nanoTime() - start) / 1_000_000,
                            signal));
        });
    }
}
```

`order()` 数值越大越外层，进入时先执行、退出时后执行；相同顺序保留注册次序。共享的 Middleware 实例不应把当前用户或会话放进成员字段。日志记录参数时要限制长度并处理凭据和敏感内容。Middleware 能包住框架内的工具阶段，不能自动包住在框架外异步执行的业务事务。

[MiddlewareBase 固定源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/middleware/MiddlewareBase.java) · [当前在线文档，注意版本](https://java.agentscope.io/v2/zh/docs/building-blocks/middleware)

## 8. 权限、安全与人工确认 {#s08}

**允许模型提出工具调用**不等于**允许执行**。v2.0.4 权限结果为 `ALLOW`、`DENY`、`ASK`。显式的 deny/ask/allow 规则、工具自身检查与模式共同参与决策；具体规则匹配内容由工具解释。应用仍须在实际业务服务验证用户、租户和资源权限。

| 模式 | 主要意图 | 不应误解为 |
| --- | --- | --- |
| `DEFAULT` | 普通交互 | 默认所有工具都 ASK：空配置可走轻量兼容路径 |
| `EXPLORE` | 只读探索 | 可替代底层文件系统隔离 |
| `ACCEPT_EDITS` | 允许工作区内编辑 | 允许任意业务数据写入 |
| `BYPASS` | 受控场景跳过部分默认确认 | 忽略显式 deny/ask |
| `DONT_ASK` | 默认决策不询问 | 抹掉所有提前返回的 ASK |

规则示意，以下对象传给 Builder 的 `.permissionContext(policy)`：

```java
PermissionContextState policy = PermissionContextState.builder()
    .mode(PermissionMode.DEFAULT)
    .addAllowRule("find_note", new PermissionRule(
        "find_note", null, PermissionBehavior.ALLOW, "application"))
    .addAskRule("publish_note", new PermissionRule(
        "publish_note", null, PermissionBehavior.ASK, "application"))
    .addDenyRule("drop_database", new PermissionRule(
        "drop_database", null, PermissionBehavior.DENY, "application"))
    .build();
```

真实写操作还要检查工具输入，限制可操作目标，并设置幂等键。`DEFAULT` 空权限上下文在 v2.0.4 有快捷路径，不能单凭模式名保证写操作一定确认。无人值守任务应明确设置规则，处理无法询问的结果；`DONT_ASK` 只在默认兜底路径将 ASK 转 DENY，显式 ASK 或安全检查仍可能挂起。

**ASK 的往返**：`call` 可返回 `GenerateReason.PERMISSION_ASKING`，消息里包含状态为 `ASKING` 的 `ToolUseBlock`；流式入口发 `RequireUserConfirmEvent`。应用向用户展示工具名、参数与影响，取得真实决策后，将对应 `ConfirmResult` 置于下一条 `UserMessage` 的 `Msg.METADATA_CONFIRM_RESULTS`，以**同一 userId/sessionId**继续调用。确认不是发送一句「同意」自然语言。拒绝后模型可能继续给出替代方案；要终止整轮，应另行控制。

```java
List<ToolUseBlock> pending = paused.getContentBlocks(ToolUseBlock.class)
    .stream()
    .filter(x -> x.getState() == ToolCallState.ASKING)
    .toList();
List<ConfirmResult> decisions = pending.stream()
    .map(x -> new ConfirmResult(false, x, null, "内容尚未复核"))
    .toList();
UserMessage reply = UserMessage.builder()
    .metadata(Map.of(Msg.METADATA_CONFIRM_RESULTS, decisions))
    .build();
Msg resumed = agent.call(List.of(reply), sameContext).block();
```

以上片段需置于已有 `paused`、`agent`、`sameContext` 的方法体内并导入对应类型。`ConfirmResult` 第三个参数是规则列表，**不要自动持久化模型建议规则**。`externalTool = true` 又是另一机制：框架请求外部执行，应用回传 `ToolResultBlock`，不能用确认结果代替。无论采用哪一种，框架的准入决策都不代表业务事务已经提交。

[权限引擎](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/permission/PermissionEngine.java) · [ConfirmResult](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/event/ConfirmResult.java) · [Agent HITL 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/agent.md)

## 9. 上下文构建、预算与压缩 {#s09}

三个集合不要混为一谈：**完整历史**是状态中记录的消息；**本轮模型上下文**是经过选择和压缩送进模型的内容；**长期记忆**是跨会话的提炼资料。保存了历史，并不保证下一轮把全部历史送进模型。大段工具结果、工作区文件和知识片段都会占用上下文与成本。

Harness v2.0.4 默认启用上下文压缩和工具结果卸载。压缩得到的摘要是有损的，关键约束应保留在稳定指令或明确的任务状态中；工具输出应可按来源回查。配置保留消息数量时，`keepMessages(...)` 与 `keepTokens(...)` 共同起作用；若希望按消息数精确保留，需要 `keepTokens(0)`。当前在线文档的 `ContextSource` / `ContextPolicy` 流程已演进，不能直接当作 v2.0.4 构建代码。

排查「模型忘了刚才的信息」时，先看身份是否变了、状态是否保存，再看压缩结果和最终模型输入；排查「超出窗口」时，分别统计系统提示、工具 schema、历史、检索片段、工具结果。缩小工具返回值通常比盲目扩大窗口更稳定。

[固定版本记忆与压缩文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/memory.md) · [当前上下文文档，注意版本](https://java.agentscope.io/v2/zh/docs/harness/context)

## 10. 会话、AgentState 与恢复 {#s10}

`RuntimeContext` 携带本次调用身份和运行信息；`AgentState` 保存会话状态；`AgentStateStore` 决定如何读写。稳定的 `userId + sessionId` 是恢复同一会话的前提，但不等于完整恢复：还需要可访问的状态存储、工作区和所依赖的外部资源。Harness 默认的 `JsonFileAgentStateStore` 适合单机开发；固定版本还提供内存、Redis、MySQL 等状态存储实现。跨进程或多副本应配置可共享的存储，并验证冲突处理与工作区的一致性。

先分清三个范围：

| 范围 | 保存什么 | 何时产生、何时读取 |
| --- | --- | --- |
| `RuntimeContext` | 当前请求的 `userId`、`sessionId` 与临时属性 | 应用每次调用创建；用身份定位状态，但自定义属性本身不会自动持久化 |
| `AgentState` | 对话、压缩摘要、权限和工具状态等 | Agent 一次运行中读取和修改；是否跨调用保存取决于 StateStore |
| Workspace 文件 | `AGENTS.md`、记忆、Skill、任务文件等 | Harness 按配置读写；文件存在不表示对话状态也存在 |

**纯 `ReActAgent` 的显式持久化例子**，把第 2 节的构建代码加上 `stateStore(...)`：

```java
import io.agentscope.core.state.JsonFileAgentStateStore;
import java.nio.file.Path;

ReActAgent agent = ReActAgent.builder()
    .name("notes-assistant")
    .sysPrompt("你是技术笔记助手。")
    .model("dashscope:qwen-plus")
    .toolkit(new Toolkit())
    .stateStore(new JsonFileAgentStateStore(Path.of(".agentscope/sessions")))
    .build();
RuntimeContext ctx = RuntimeContext.builder()
    .userId("alice").sessionId("notes-001").build();
agent.call(List.of(new UserMessage("我在研究 AgentScope Java。")), ctx).block();
Msg next = agent.call(List.of(new UserMessage("我刚才研究的是什么？")), ctx).block();
System.out.println(next.getTextContent());
```

这是方法体片段，需复用第 2 节的 `ReActAgent`、`Toolkit`、`RuntimeContext`、`Msg`、`UserMessage`、`List` 导入。第一轮结束后，StateStore 保存对应身份的状态；第二轮用相同身份读取。把 `sessionId` 换掉，就是另一段会话；重启后能否恢复，取决于存储目录是否保留、Agent 配置和实际写入结果。**只传相同 ID 而不配置 StateStore，并不等于有持久历史**。

| 现象 | 应核查 |
| --- | --- |
| 新请求看不到上一轮 | userId/sessionId、StateStore 配置、保存是否成功 |
| 进程重启后文件还在但对话没了 | 工作区文件和 AgentState 是两类存储 |
| 同一会话被两个节点同时推进 | 存储 CAS/冲突策略、应用级串行和幂等 |
| 前端断线后想接着看 | 正在运行的任务、事件持久化、重放协议分别处理 |
| 工具已写入外部系统但请求失败 | 外部事务 ID、幂等检查和补偿，不靠重放模型消除副作用 |

v2.0.4 的状态存储具备版本/CAS 能力，但**同一实例 FIFO 不等于跨节点全局无冲突或无重复执行**。取消运行也不是回滚已完成的外部操作。当前官网的 `AgentSession`、`Session Log`、后台会话队列和事件重放属于后续文档/Service 语境，v2.0.4 Harness 中不要照着调用这些 API。固定版本的状态管理应从 `AgentStateStore` 与对应 Harness 配置出发。管理后台最好使用显式的用户/会话 ID 查询状态；某些无参 `getAgentState()` 重载已弃用且不会保证返回「最近活动会话」。

[ReActAgent 固定源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java) · [Harness 固定源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/HarnessAgent.java) · [当前 Session 文档，注意版本](https://java.agentscope.io/v2/zh/docs/harness/session-log)

## 11. Workspace、文件系统与沙箱 {#s11}

Workspace 是 Harness 的文件化定义与运行资料入口。典型结构如下，**均按需要选用**，不要把它理解成必须一次建齐的模板：

```text
workspace/
  AGENTS.md                 # 行为与系统指令
  knowledge/KNOWLEDGE.md    # 领域参考资料入口
  MEMORY.md                 # 长期提炼的记忆
  memory/                   # 记忆明细
  skills/<name>/SKILL.md    # 可复用操作方法
  subagents/<id>.md         # 子 Agent 声明
  tools.json                # 工具/MCP 配置
  plans/PLAN.md             # 计划模式产物（启用时）
```

**三类内容生命周期不同**：`AGENTS.md`、Skill、工具配置宜版本管理和审查；会话文件、计划、生成物属于任务数据；`MEMORY.md` 是跨会话提炼结果，应允许更正和过期。WorkspaceContextMiddleware 在 v2.0.4 每次调用时读取 `AGENTS.md`、`MEMORY.md`、`KNOWLEDGE.md` 并拼入系统上下文；当前主分支的参考块/动态 ContextSource 机制不同。用户提供的文件内容属于不可信资料，不能仅因放在 workspace 就赋予系统指令权限。

**文件系统选型**：本地目录适合单进程开发；多节点需要共享可访问的数据与状态；远程沙箱的工作文件还要核对挂载或同步方式。v2.0.4 对 RemoteFilesystemSpec 缺少共享状态存储有硬性约束，Sandbox 场景是警告而非一律构建失败。沙箱隔离的是进程和文件访问面，仍要限制网络、凭据、工具授权与最终产物读取。工作区路径边界不能代替操作系统或容器隔离。

[固定版本 Workspace](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/workspace.md) · [文件系统](https://java.agentscope.io/v2/zh/docs/harness/filesystem) · [沙箱](https://java.agentscope.io/v2/zh/docs/harness/sandbox)

## 12. 长期记忆与会话历史 {#s12}

**历史**回答「这个会话发生过什么」；**记忆**回答「跨会话仍值得保留什么」；**RAG**回答「外部资料库中有什么证据」。上下文压缩只是缩短当前模型输入。将这四者混用会出现两类问题：事实过期还持续注入，或者用户以为已保存的资料会自动出现在每轮对话。

v2.0.4 的长期记忆有两层：对话中抽取的新事实追加到 `memory/YYYY-MM-DD.md`；后台合并去重后写入 `MEMORY.md`，后者在后续推理中加载。抽取（flush）、合并（consolidation）和对话压缩摘要（compaction summary）是三次不同用途的模型调用，各有触发与配置。记忆常见内容包括稳定偏好、已确认的领域事实、尚未完成的长期目标；临时验证码、一次性任务输出和未经核实的推断不应升格为长期事实。应用应记录来源与更新时间，允许用户查看、更正和删除，并明确租户归属。

自查一条记忆是否工作：用用户 A 的会话记录一条稳定事实；换新 session 验证读取；再用用户 B 验证隔离；改正事实后验证旧值不再影响回答。若隔离不成立，先查 workspace 根路径与身份命名空间，再看模型提示内容。v2.0.4 工作区把记忆文件注入系统上下文，因此不要将外部文档或网页原文未经审查地写进 `MEMORY.md`。

[记忆文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/memory.md) · [Workspace 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/workspace.md)

## 13. Skill：可复用的做事方法 {#s13}

Skill 是带适用条件、步骤、参考资料与可选脚本的能力包；它教 Agent **如何完成某类任务**。Tool 提供可调用操作，Skill 规定何时与怎样组织操作，Memory 保存长期事实，RAG 提供外部证据。Skill 文本本身不赋予文件、网络或外部系统权限。

```text
skills/
  summarize-note/
    SKILL.md
    references/
      citation-format.md
    scripts/
      check-citations.py
```

```markdown
---
name: summarize-note
description: 当用户要求总结技术笔记并保留来源时使用。
---
# 总结技术笔记
1. 先读取原文和相关来源。
2. 区分原文事实、个人推断与尚未核实的信息。
3. 输出摘要、关键术语、引用位置与待确认问题。
```

这是 Skill 文件形状示例，不表示脚本自动获准执行。团队共用 Skill 宜纳入代码审查；用户或运行时生成的 Skill 应在明确目录和权限内加载。遇到「Skill 没触发」，检查描述是否覆盖用户请求、目录是否进入当前 workspace、资源是否可读，以及工具是否真正注册；不要仅把描述写得更长。Skill 不是长篇系统提示的堆积地，步骤应可检查、失败处理应明确。

[固定版本 Skill 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/skill.md) · [Workspace 布局](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/harness/workspace.md)

## 14. MCP：把外部能力注册为工具 {#s14}

MCP 是外部能力的协议层；AgentScope 通过客户端连接 Server、发现 schema、注册工具，再按模型选择执行。与应用内 `@Tool` 的主要区别是能力来自另一个进程或服务。MCP Server 的返回值仍是外部输入，工具可见性和权限需要在本应用单独设置。

从一次调用看，它和本地 Java Tool 的后半段相同：模型仍只看到工具名、描述和参数 schema；差别是实际执行时，Toolkit 把调用转发到 MCP Server。连接阶段通常依次经过 transport 建立连接、初始化、工具发现、注册到 Toolkit；运行阶段是模型提议 → 权限检查 → 远端调用 → 结果回到模型。**能连通 Server**与**模型能看到并获准调用某个工具**是两次不同检查。

v2.0.4 的客户端 Builder 是 `McpClientBuilder.create(name)`，不是一些博客里的 `streamableHttp().name().url().build()`：

```java
McpClientWrapper client = McpClientBuilder.create("remote-notes")
    .streamableHttpTransport("https://mcp.example.com/mcp")
    .header("Authorization", "Bearer " + System.getenv("NOTES_MCP_TOKEN"))
    .buildAsync()
    .block();

Toolkit toolkit = new Toolkit();
toolkit.registration()
    .mcpClient(client)
    .mcpToolNamePrefix("mcp__remote_notes__")
    .enableTools(List.of("search_notes", "read_note"))
    .propagateMeta(false)
    .apply();
// 把 toolkit 传给 Agent Builder；在应用关闭时管理 MCP 客户端生命周期。
```

这是接入片段，URL 和 Token 均是占位值。STDIO 可用 `stdioTransport(command, args, env)`，SSE/HTTP 也有对应 transport。`buildAsync()` 仅创建客户端包装，工具发现和注册在 Toolkit 注册阶段完成。默认工具名来自远端工具，**不会自动**加 `mcp__server__` 前缀；多 Server 时应显式设置 `mcpToolNamePrefix`，避免重名并便于权限规则识别。

连接失败先查 transport 类型与 URL、Server 是否实际启动、认证头、初始化超时，再查工具发现；工具能发现却不能用，查工具启用列表、权限规则和参数 schema。不要把 MCP 返回文本当成可信指令。关闭时处理连接资源，并控制日志中传递的 metadata 与密钥。

[McpClientBuilder 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpClientBuilder.java) · [Toolkit MCP 注册](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java) · [MCP 文档](https://java.agentscope.io/v2/zh/docs/building-blocks/tool)

## 15. 规划、子 Agent 与任务编排 {#s15}

先按**控制权**区分三种机制。Plan Mode 让同一个 Agent 先制定/维护计划；Subagent 把一个有边界的任务交给另一 Agent；Service Team/Workflow 在平台层管理成员或固定步骤。确定性的业务流程可直接由 Java 代码组织，开放式子问题再交给 Agent。

| 机制 | 合适的问题 | 需要应用明确处理 |
| --- | --- | --- |
| Plan Mode / Todo | 长任务需要阶段、待办和审批点 | 进入/退出条件，计划是否被批准 |
| Harness Subagent | 搜索、审查等可独立交付的子任务 | 输入输出契约、工具白名单、超时与结果合并 |
| 后台任务 | 子任务执行时间较长 | task ID、进度、取消、重试与完成通知 |
| Service Workflow | 多步骤有固定依赖和分支 | Service 部署、权限、版本与监控 |

`enablePlanMode()` 是注册规划能力，不代表每次调用自动进入；应用可用带上下文的 `enterPlanMode(ctx)` 强制进入。`plan_exit` 可触发人工确认，但应用直接调用退出方法时，应先自行验证批准者。规划阶段放开 shell 后也不能再假设只读。

子 Agent 声明可以来自 Workspace 的 `subagents/<id>.md`，也可以用 `SubagentDeclaration` Builder；`tools(...)` 过滤继承能力，不是最终业务鉴权。默认隔离工作区、默认不持久化子会话。`agent_spawn` 的后台模式会返回 task ID，完成通知在父 Agent 后续推理前注入；它不意味着原进程退出后计算会自动转移到另一节点。并行前确认子任务真的独立，多个 Agent 写同一文件或业务记录时需要合并规则或串行控制。

[Subagent 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/docs/harness/subagent.md) · [Plan Mode 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/docs/harness/plan-mode.md) · [Service 编排](https://java.agentscope.io/v2/en/service/orchestration)

## 16. RAG 与知识检索 {#s16}

v2.0.4 **有可用的 RAG 扩展**，包括 SimpleKnowledge 与若干知识平台适配；但 Core 中的旧 `Knowledge`、`RAGMode` 和 Builder `.knowledge(...)` 等兼容接线已标记弃用。新应用可把检索封装成自己的 Tool 或上下文装配层，让底层索引与知识平台可以替换。不要把 Workspace 的 `knowledge/` 文件注入等同于语义搜索。

RAG 的核心目标是让回答有**可回查的外部证据**。例如用户问「我们的发布流程是什么」，应用先从有权访问的文档里检索到几段与「发布流程」相关的原文，连同文档 ID、页码或段落位置交给模型；模型据此回答，应用再校验引用是否真的指向所用片段。这里的「检索」可以在 Agent 调用前由应用强制执行，也可以注册为 `search_notes` 工具供模型选择。前者适合必须引用的业务问答，后者适合探索式任务。

| 路线 | 何时用 | 边界 |
| --- | --- | --- |
| `agentscope-extensions-rag-simple` | 想直接接解析、Embedding 和向量库 | 应用负责入库、索引更新与授权 |
| Bailian、Dify、HayStack、RAGFlow 等适配 | 已有知识平台 | 平台配置和资料生命周期在平台侧 |
| 自定义业务检索 Tool | 已有搜索服务或精细权限 | 自己设计搜索结果与来源契约 |

兼容 `RAGMode` 的枚举值是 `GENERIC`、`AGENTIC`、`NONE`，不是部分文档写的 `STATIC`。`GENERIC` 在模型调用前注入检索，`AGENTIC` 让模型决定是否调用检索工具。若产品规定每个回答都要有可查证据，应由应用保证先检索、再验证引用；不能依赖模型「可能会搜索」。

如果已有检索服务，应用可以定义自己的接口，再用普通 `@Tool` 暴露它。下列 `NoteSearchService` 和 `SearchHit` 是**你自己定义的业务类型**，不是 AgentScope API：

```java
record SearchHit(String documentId, String location, String excerpt) {}

interface NoteSearchService {
    List<SearchHit> searchAuthorized(String userId, String query, int limit);
}

final class SearchTools {
    private final NoteSearchService search;
    SearchTools(NoteSearchService search) { this.search = search; }

    @Tool(name = "search_notes", description = "检索当前用户有权阅读的技术笔记")
    public List<SearchHit> searchNotes(
            @ToolParam(name = "query", description = "要检索的问题") String query,
            RuntimeContext ctx) {
        return search.searchAuthorized(ctx.getUserId(), query, 5);
    }
}
// 装配时：toolkit.registerTool(new SearchTools(noteSearchService));
```

片段需要导入 `List`、`Tool`、`ToolParam`、`RuntimeContext`，检索服务还要实现权限过滤、索引查询和来源映射。返回普通 Java 对象时框架会转换成工具结果；如果需要明确错误状态，可按[工具章节](#s06)返回 `ToolResultBlock`。把 `userId` 写进提示词无法代替检索层授权。

典型离线链路：文档解析 → 分块 → 保存来源/版本/访问范围 → Embedding → 索引。在线链路：鉴权 → 查询 → **在检索层做权限过滤** → 可选重排 → 片段与来源送入 Agent → 引用核验。官方 Simple 参数表提到 metadata filter，但 v2.0.4 `SimpleKnowledge.retrieve` 实现未见把它传给向量查询；不应假设其默认具备租户过滤。检索为空、召回错、排序错、生成时忽略证据，是四种不同故障，分别排查。更换 Embedding 模型后需评估重建索引。

[官方 Simple RAG 集成](https://java.agentscope.io/v2/en/integration/rag/simple) · [固定版本 SimpleKnowledge 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-rag/agentscope-extensions-rag-simple/src/main/java/io/agentscope/core/rag/knowledge/SimpleKnowledge.java) · [迁移说明](https://java.agentscope.io/v2/en/docs/change-log)

## 17. Spring Boot、Service 与部署 {#s17}

嵌入自己的 Spring Boot 应用时，建议把 Agent 作为应用生命周期内的 Bean/服务管理；认证、会话归属、限流、HTTP/SSE 协议、业务工具和部署由应用负责。v2.0.4 HarnessAgent 支持单例服务不同会话，但共享工具应并发安全。不要把当前用户保存在单例字段，也不要每个请求结束就关闭共享 Agent。

一个最小的 Spring 接线可以拆成两个职责：启动时构建 Agent；每个已认证请求构造自己的 `RuntimeContext`。下面只展示接线位置，控制器仍需校验会话归属并把结果映射成自己的 HTTP 响应：

```java
@Configuration
class AgentConfiguration {
    @Bean(destroyMethod = "close")
    HarnessAgent notesAgent() {
        return HarnessAgent.builder()
            .name("notes-assistant")
            .sysPrompt("你是团队笔记助手。")
            .model("dashscope:qwen-plus")
            .workspace(Path.of(".agentscope/workspace"))
            .build();
    }
}

@Service
class NotesChatService {
    private final HarnessAgent agent;
    NotesChatService(HarnessAgent agent) { this.agent = agent; }

    Mono<Msg> answer(String authenticatedUserId,
                     String authorizedSessionId, String question) {
        RuntimeContext ctx = RuntimeContext.builder()
            .userId(authenticatedUserId)
            .sessionId(authorizedSessionId)
            .build();
        return agent.call(new UserMessage(question), ctx);
    }
}
```

这是 Spring 集成片段，需导入 Spring 的 `@Configuration`、`@Bean`、`@Service`，以及 `Path`、`Mono` 和对应 AgentScope 类型。`authorizedSessionId` 表示应用**已经确认**此会话归属于该用户；方法名本身不会完成鉴权。应用启动阶段构建一次 Agent，请求阶段只传入各自的上下文；这样更容易解释多用户隔离与资源关闭。

```java
RuntimeContext ctx = RuntimeContext.builder()
    .userId(authenticatedUserId) // 来自服务端认证
    .sessionId(ownedSessionId)    // 先核对会话归属
    .build();
Flux<AgentEvent> events =
    agent.streamEvents(new UserMessage(message), ctx);
// WebFlux Controller 将 events 映射为 ServerSentEvent 后返回，由框架订阅。
```

此片段是应用层接线示意，变量由业务代码提供。断线时是否取消任务、事件如何补发、确认如何跨请求完成，应另行定义协议。`AG-UI Spring Boot Starter` 有端点和事件映射，但默认断线中断；关闭中断不等于自动保存断线期间的事件。`AgentRun` 是 v2.0.4 的显式运行控制入口，流具有单次订阅约束。若使用 Starter，先核对所用 Boot 版本：v2.0.4 的 Starters 父 POM 是 Spring Boot 4.0.3，Service POM 是 4.0.4，不能未经测试就声称与现有 Boot 3 自动配置兼容。已有 Boot 3 工程可先按普通 SDK 依赖显式装配并进行依赖冲突测试。

AgentScope Service 的 Session、Turn、Event 等是另一套托管 API。选择它时要部署和管理 Service；选择自建 Harness 服务时，后台任务、事件留存、会话分布式调度都由本应用实现。多副本还需要共同可见的 StateStore 与 Workspace，外部工具副作用需要全局幂等。共享存储不意味着运行中的计算自动迁移。

[HarnessAgent 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/HarnessAgent.java) · [AG-UI 集成](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/integration/protocol/agui.md) · [Starter POM](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-spring-boot-starters/pom.xml) · [Service 模块](https://github.com/agentscope-ai/agentscope-java/tree/v2.0.4/agentscope-service)

## 18. 可观测性、测试与效果评估 {#s18}

一次请求至少应能按 `userId`、`sessionId`、run ID、tool call ID 关联模型调用、权限判断、工具开始/结果、最终消息和错误。Middleware 适合放计时与链路记录；AgentEvent 适合呈现过程。日志不要原样保留密钥、私有文档、完整系统提示或无限长度的工具输出。生产指标可观察成功率、ASK 比例、拒绝率、模型耗时、工具耗时、Token 和成本、上下文压缩次数、失败重试与取消率。

测试分三层：

| 层 | 用确定性的什么来验证 | 不足之处 |
| --- | --- | --- |
| Java 单元测试 | 工具参数、权限、租户隔离、幂等、事件转换 | 不证明模型会正确选工具 |
| 集成测试 | 真实 StateStore、MCP/向量库适配、断线重连、并发 | 外部依赖和成本更高 |
| 效果评估 | 固定任务集，核对事实、引用、工具轨迹和失败恢复 | 模型输出有波动，需多次运行与人工抽样 |

一条可信的评估样本应给出输入、允许访问的资料、预期约束、必须/禁止的工具、可接受输出及评分理由。单次「模型答对」不能当回归结论。RAG 还要单独测召回命中、无证据时拒答、引用指向以及跨租户泄漏；HITL 要测批准、拒绝、超时、重放和重复提交。

[Middleware](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/middleware.md) · [消息与事件](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/message-and-event.md) · [官方测试目录](https://github.com/agentscope-ai/agentscope-java/tree/v2.0.4/agentscope-core/src/test)

## 19. 综合用法与故障速查 {#s19}

假设要做「团队笔记助手」：应用从已认证用户创建 `RuntimeContext`；`HarnessAgent` 管理会话和 Workspace；`find_note` / `search_notes` 工具只返回授权资料及来源；`publish_note` 走显式 ASK 和业务幂等；WebFlux 用事件流显示进度；多副本使用共享状态和工作区；离线评估同时检查引用、权限和外部写入次数。这样可以沿请求路径定位问题，而不必把前 18 节按课程重学。

| 表现 | 第一检查点 | 常见原因 |
| --- | --- | --- |
| Builder 找不到方法 | Maven 解析版本、固定 tag 源码 | 复制了 `main` / v1 / RC 示例 |
| `Mono` 返回但模型未调用 | 是否订阅 | 冷流未被订阅 |
| 模型找不到工具 | Toolkit 注册、工具组、schema | 未注册或本轮未暴露 |
| 工具结果一直不结束 | ToolResultState | `text(...)` 默认 RUNNING |
| 写工具没有弹确认 | 实际规则和权限快捷路径 | 只设 DEFAULT、没设显式 ASK |
| 回复“同意”却未恢复 | ConfirmResult metadata、身份 | 当成自然语言确认 |
| 新轮次像新用户 | userId/sessionId、StateStore | 身份不稳定或状态未保存 |
| 多副本状态冲突 | 共享存储、CAS、业务幂等 | 误把单实例 FIFO 当全局锁 |
| MCP 工具重名 | 注册名称/prefix | 默认不自动加 Server 前缀 |
| RAG 有答案却引用错 | 召回、排序、引用映射 | 模型或片段来源不匹配 |
| Spring SSE 重复调用 | Flux 订阅次数 | 同一冷流被多次订阅 |

### 社区笔记如何使用

这份笔记吸收了社区文章常见的问题组织方式，如「Msg 与事件」「ReAct 与 Harness」「工具/MCP/记忆如何分层」，技术断言和示例均回到 v2.0.4 源码及官方资料核对。以下文章可作为另一种讲解角度，**阅读时先看其所用版本**：

- [AgentScope Java v2 消息与事件模型](https://juejin.cn/post/7690596943454584883)：对流式事件的讲解有帮助；其中事件是否持久化的结论不宜脱离具体运行时推广。
- [重新认识 AgentScope Java 2.0：ReActAgent 与 HarnessAgent](https://juejin.cn/post/7669683409706975272)：适合建立分层直觉；代码按本笔记固定版本核对。
- [AgentScope Java 新手村：框架简介与环境搭建](https://blog.csdn.net/m0_62929305/article/details/161840002)：基于较早 RC，概念可参考，方法签名不直接复制。
- [用 AgentScope Java 开家 AI 奶茶店](https://www.cnblogs.com/alisystemsoftware/p/19564655)：展示业务工具、MCP 与持久化结合；会话代码需按当前目标版本重审。

### 主要官方依据与延伸核对

- [AgentScope Java Releases](https://github.com/agentscope-ai/agentscope-java/releases) 与 [v2.0.4 固定版本源码](https://github.com/agentscope-ai/agentscope-java/tree/v2.0.4)：版本与 API 的最终核对入口。
- [v2 中文文档](https://java.agentscope.io/v2/zh/)：概念导航，注意网页持续更新。
- [v1 → v2 迁移说明](https://java.agentscope.io/v2/en/docs/change-log)：排查弃用接口。
- 仓库内专题核对：[模型、工具、权限、MCP](./agentscope-research/tools-and-models.md)；[协作、RAG、服务化](./agentscope-research/orchestration-and-production.md)。它们记录了更多固定版本源码依据。
