# AgentScope Java：协作、RAG 与生产集成核对

核对日期：2026-10-16。可发布 API 以 `v2.0.4` 标签源码为基线；官网 `/v2/` 是持续更新文档，不能据其 URL 推断某个方法已经进入 `2.0.4`。本文件供整理自查笔记使用，不是学习任务清单。代码片段经过接口和源码核对，未连接真实模型或执行编译。

证据强度按“固定标签源码 > 同标签文档 > 当前官网 > 本文工程建议”理解。官方文档也存在旧例子和新例子混用，因此看到弃用警告、找不到枚举值时，应先核对版本，而非添加更多依赖碰运气。

## 1. 三种任务组织方式

| 机制 | 职责与边界 | 适用情况 |
| --- | --- | --- |
| Plan Mode + Todo | 一个 Agent 先调查、记录计划，再持续维护任务状态 | 长任务需要明确阶段和人工关口 |
| Harness Subagent | 父 Agent 委派独立子任务，子 Agent 有自己的会话并返回结果 | 专项研究、审查、并行处理独立工作 |
| Service Team / Workflow | 平台管理持续协作，或用显式图定义依赖、分支和审批 | 多运行时协作、业务流程及组织治理 |

Service 的 Subagent 不自动变成 Team；Team 负责成员、任务和沟通，Workflow 负责何时推进到下一步。它们是不同层次的组合能力。[当前官方编排说明](https://java.agentscope.io/v2/en/service/orchestration)

固定步骤可以由 Java 应用明确组织，不需要为了“使用 Agent 框架”把每一步都交给模型决定。以下是工程建议：已知业务流程由代码或 Workflow 控制，开放式探索交给 Agent；有外部副作用的步骤应记录业务执行 ID、输入摘要和结果，避免在模型重试时重复扣款、发信或创建记录。

### 1.1 Subagent 的声明与能力边界

`v2.0.4` 的声明类型为 `io.agentscope.harness.agent.subagent.SubagentDeclaration`。`workspace(...)`、`inlineAgentsBody(...)`、`url(...)` 三类定义来源互斥；`tools(...)` 过滤继承的父工具，并不是整个应用的最终授权机制。默认 `ISOLATED` 工作区、`persistSession=false`，默认继承父级 DENY 规则；设置持久会话后，复用键与父会话、Agent 类型及 label 有关。[固定版本声明源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/subagent/SubagentDeclaration.java)

```java
SubagentDeclaration reviewer = SubagentDeclaration.builder()
    .name("reviewer")
    .description("审查代码变更，返回问题、文件位置与依据")
    .inlineAgentsBody("只读取代码和测试，返回可核查的审查结论。")
    .workspaceMode(WorkspaceMode.ISOLATED)
    .tools(List.of("read_file", "grep_files"))
    .steps(8)
    .build();
// 将 reviewer 传给 HarnessAgent.Builder.subagent(reviewer)
```

工作区声明放在 `workspace/subagents/<id>.md`，文件名就是 `agent_id`。说明中的触发条件和交付格式会影响父 Agent 是否合理委派；不要只写“代码专家”之类的角色名。[固定版本子 Agent 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/docs/harness/subagent.md)

### 1.2 实例 ID、会话 ID 与后台任务 ID

| 标识 / 工具 | 含义 |
| --- | --- |
| `agent_id` | 子 Agent 类型名，例如 `reviewer` |
| `agent_key` | 某个已创建实例的句柄，给 `agent_send` 使用 |
| `session_id` | 子 Agent 的内部会话身份 |
| `task_id` | 一次后台工作的身份，给结果查询和取消工具使用 |
| `agent_spawn` / `agent_send` / `agent_list` | 创建、通信、列出实例 |
| `task_output` / `task_cancel` / `task_list` | 查询、取消、列出后台任务 |

`agent_spawn(timeout_seconds=0)` 立即交回后台任务 ID；正数表示等待，默认 30 秒、最大 600 秒。默认同步等待超时后会转入后台继续运行。应用若必须等到结果或明确失败，可设置 `AgentSpawnTool.CTX_FORCE_SYNC=true`，并可用 `CTX_FORCE_SYNC_TIMEOUT_SECONDS` 覆盖等待预算；此时超时会中断而不自动转后台。该行为已在 `v2.0.4` 源码确认。[固定版本 AgentSpawnTool](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/tool/AgentSpawnTool.java)

后台完成通知是在父 Agent 的下一次推理前注入；这不等于进程重启后工作自动在别处续跑。共享存储可以让别的节点读取状态和结果，正在执行的计算仍归创建节点。需要等齐一组任务时，使用显式任务集合或 `wait_all=true`；不带这些参数的 `wait_async_results` 不代表等待所有任务。[官方子 Agent 行为说明](https://java.agentscope.io/v2/zh/docs/harness/subagent)

工程建议：能并行的前提是任务互不依赖、资源不冲突。多个 Agent 写同一个文件、更新同一条业务记录时，需要应用锁、串行阶段或明确的输出合并规则；多 Agent 本身不会提升共享资源的并发正确性。

### 1.3 Plan Mode、Todo 与真正的审批

`enablePlanMode()` 注册规划能力，不代表每次调用自动进入规划阶段。需要强制阶段时，由应用用带明确会话身份的 `enterPlanMode(ctx)` 进入。规划阶段专用工具为 `plan_enter`、`plan_write`、`plan_exit`；默认计划文件为 `plans/PLAN.md`，模型经 `plan_exit` 退出会走 HITL。`enableTaskList(true)` 则启用执行清单；Todo 与后台任务是两类状态。[固定版本 Plan Mode 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/docs/harness/plan-mode.md)

注意两个边界：应用直接调用 `exitPlanMode(ctx)` 不会额外触发人工确认，因此业务入口必须先校验批准者；`allowShellInPlanMode()` 放行 shell 后，不能再把“规划只读”当成强隔离保证，因为 shell 同时能读和写。自定义只读工具也必须真实满足其声明。[官方 Plan Mode 安全边界](https://java.agentscope.io/v2/zh/docs/harness/plan-mode)、[固定版本 Builder 及阶段切换实现](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/HarnessAgent.java)

## 2. RAG：兼容能力存在，旧接线 API 已弃用

可以采用的版本结论是：**AgentScope Java 有 RAG 扩展，`v2.0.4` 仍包含可调用的兼容实现；但旧 `Knowledge` 接口、`RAGMode`、检索工具及 `.knowledge(...)` 等 Builder 接线已标记待移除。新项目应隔离这一层，优先通过业务检索工具或应用层组装资料接入。**

“v2 没有 RAG”“Java 没有知识检索能力”均不成立。“没有完整新版栈”缺少范围限定，容易把旧 API 的迁移状态误读成所有检索能力不存在。迁移指南 B.5 说的是知识库相关 API 重构中，不是不能实现 RAG。[官方迁移指南 B.5](https://java.agentscope.io/v2/en/docs/change-log)、[`Knowledge` 的固定版本弃用标记](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/rag/Knowledge.java)

### 2.1 已确认的 RAG 扩展

| 路线 | 已有能力 | 应注意的边界 |
| --- | --- | --- |
| `agentscope-extensions-rag-simple` | 文档解析、嵌入、入库、检索；对接向量存储 | 自己负责数据生命周期、重建索引、权限和运行维护 |
| Bailian / Dify / HayStack / RAGFlow 适配 | 对接既有知识平台的检索能力 | 平台式适配通常不承担文档入库；从平台控制台或其原生 API 管理文档 |
| 自定义检索工具 | 包装自己的搜索服务、数据库或平台 API | 对外保持稳定业务接口，可独立替换底层方案 |

`SimpleKnowledge` 在 `v2.0.4` 扩展源码中实际实现了嵌入、保存、查询向量及阈值筛选，并非只有文档中的占位示例。[固定版本 SimpleKnowledge](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-rag/agentscope-extensions-rag-simple/src/main/java/io/agentscope/core/rag/knowledge/SimpleKnowledge.java)

官方列出的 Simple 存储为 InMemory、PgVector、Milvus、Qdrant、Elasticsearch；读取器包括文本、PDF、Word、图片和 Tika 等。[官方 Simple 集成页](https://java.agentscope.io/v2/en/integration/rag/simple)。固定标签也存在 Simple 扩展模块及相关第三方依赖。[固定版本模块配置](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-rag/agentscope-extensions-rag-simple/pom.xml)

RAGFlow 示例是检索适配：配置服务地址、凭据、知识库 ID、Top-K、相似度和 rerank 后检索；`addDocuments` 不支持，文档上传与索引通过 RAGFlow 完成。[固定版本 RAGFlow 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/integration/rag/ragflow.md)

### 2.2 RAG 的两个执行模式

应用预检索是在调用 Agent 前或模型调用中间件处取得片段，再把片段和来源送入本轮上下文；Agentic RAG 是把检索作为工具，由模型决定是否检索、查询什么以及是否继续检索。后者更灵活，也可能跳过检索；对“所有业务回答必须有知识依据”的需求，应由应用保证必检索和结果校验。

旧接口的实际枚举值为 `GENERIC`、`AGENTIC`、`NONE`。`GENERIC` 经兼容 Hook 注入检索结果；`AGENTIC` 注册兼容检索工具。不要照抄部分官方 overview 注释中的 `STATIC`，固定版本枚举没有这个值。[固定版本 RAGMode](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/rag/RAGMode.java)、[固定版本 ReActAgent 兼容接线](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)

### 2.3 新项目可采用的接入边界

下列是应用自行定义的接口示意，`NoteSearchService` 与 `SearchHit` 不是 AgentScope 类。检索服务在服务端绑定认证身份，返回片段、文档 ID、来源位置和资料版本；模型只提供查询内容。

```java
public final class NoteTools {
    private final NoteSearchService search;

    public NoteTools(NoteSearchService search) {
        this.search = search;
    }

    @Tool(name = "search_notes", description = "搜索当前用户获准访问的技术笔记")
    public List<SearchHit> searchNotes(
            RuntimeContext ctx,
            @ToolParam(name = "query", description = "检索关键词或问题") String query) {
        return search.searchAuthorized(ctx.getUserId(), query, 5);
    }
}
// toolkit.registerTool(new NoteTools(noteSearchService));
```

工程建议：离线流程为解析 → 规范化 → 分块 → 为片段保存来源/版本/访问范围 → 生成向量 → 建索引。在线流程为鉴权 → 查询改写（按需）→ 权限过滤后的召回 → 重排（按需）→ 上下文组装 → 生成 → 校验引用。不要先召回所有用户的资料再仅靠提示词要求模型隐藏未授权内容。

特别注意：官网 Simple 参数表提到 metadata filter，但此次读取的 `v2.0.4 SimpleKnowledge.retrieve` 只向存储查询传入向量名、向量和 limit，之后按分数筛选，未见其转发元数据过滤条件。不能把那张表当作租户级授权保证；应核查具体适配器并在业务检索层落实访问约束。[对应实现](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-rag/agentscope-extensions-rag-simple/src/main/java/io/agentscope/core/rag/knowledge/SimpleKnowledge.java)

RAG 排错时，先区分：解析是否丢内容、片段是否合适、正确文档是否进入候选集、排名是否足够靠前、模型是否使用了正确片段。Top-K 与相似度阈值不是通用最优参数；Embedding 更换后，维度相同也不代表可混用旧向量。

## 3. SDK 嵌入 Spring Boot 与协议适配

### 3.1 依赖与生命周期

嵌入 SDK 时，自己的 Spring Boot 应用负责 HTTP 鉴权、会话所属关系、资源生命周期和部署；AgentScope 负责推理循环及已配置的 Harness 能力。可手动声明模型和 Agent Bean，也可选择模型厂商 Starter，例如 `agentscope-dashscope-spring-boot-starter`。[固定版本 DashScope 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/integration/model/dashscope.md)

**兼容性不能只看 Java 最低版本。** `v2.0.4` 的 Starters 父 POM 使用 Spring Boot `4.0.3`，Service 使用 `4.0.4`。这不能推出 Boot 3 一定不兼容，但足以说明不应未经验证就宣称 Starter 对 Boot 3 可直接使用。已有 Boot 3 系统可以先用普通 SDK 依赖和显式 Bean，并验证依赖、自动配置和事件序列化。[固定版本 Starters POM](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-spring-boot-starters/pom.xml)、[Service POM](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-service/pom.xml)

`v2.0.4 HarnessAgent` 已声明可作为单例并发服务不同身份的会话；同一 `(userId, sessionId)` 在同实例上串行。共享的业务工具、中间件和外部客户端仍须并发安全。不要在 Controller 中把请求身份写入 Bean 成员，也不要让每个请求结束就关闭共享 Agent。[固定版本 HarnessAgent 并发约定](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/HarnessAgent.java)

### 3.2 SSE 的正确分层

SDK 调用入口为：

```java
RuntimeContext ctx = RuntimeContext.builder()
    .userId(authenticatedUserId) // 服务端认证结果
    .sessionId(ownedSessionId)   // 已核对会话归属
    .build();
Flux<AgentEvent> events = agent.streamEvents(new UserMessage(message), ctx);
```

WebFlux Controller 可将事件映射为 `ServerSentEvent` 并返回，让 WebFlux 负责订阅。中间件仅在收到订阅时才真正执行；同一个冷流额外订阅可能再次触发模型或工具。需要明确一条执行链由谁拥有、谁取消、谁保存事件。一次运行的显式控制可以使用稳定版已有 `AgentRun`；它是惰性且只允许一次订阅，取消订阅也会取消该 handle。[固定版本 AgentRun](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/agent/AgentRun.java)

提供给 UI 的协议可选自定义 SSE、AG-UI 或 OpenAI Chat Completions 适配。OpenAI 兼容接口解决客户端格式兼容，不自动提供完整的后台任务、人工确认、历史重放和业务交付协议。[官方 Chat Completions Web 适配](https://java.agentscope.io/v2/en/integration/ecosystem/chat-completions-web)

`agentscope-agui-spring-boot-starter` 提供 MVC/WebFlux 端点及事件转换，需特别核对：`interrupt-on-disconnect` 默认 `true`；设为 `false` 可以让执行继续，但断线期间事件不会由 Starter 自动回放。`server-side-memory` 的默认值与客户端历史策略也应一并确定，避免重复追加历史。[固定版本 AG-UI 配置](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/integration/protocol/agui.md)

工程建议：短对话可以让请求和执行绑定；后台长任务应拆为“提交任务返回 ID”和“订阅/查询进度”，把任务所有权、事件日志、取消和恢复保存在请求之外。SSE 只是传输方式；没有持久事件游标，重连并不自动变成恢复能力。

## 4. AgentScope Service 的边界与当前 Session API

`v2.0.4` 已包含 Service，Release Notes 明确发布过重设计实现。固定标签 README 将其分为 Gateway、Control Plane、Dataplane、Scheduler；Managed Agent 使用托管 Harness，External Agent 是已存在的业务运行时，Hosted Agent 可由 Runtime Host 承载。[v2.0.4 发布说明](https://github.com/agentscope-ai/agentscope-java/releases/tag/v2.0.4)、[固定版本 Service README](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-service/README.md)

选择 SDK 是在自己的服务中嵌入运行逻辑；选择 Service 是通过平台管理定义、任务、资源和执行记录。SDK 应用也可再注册到 Service，二者不互斥。Service 能力及 URL 应以实际部署版本的 API 定义为准，当前官网示例不保证与任意 `2.0.x` 镜像相同。尤其不要把官网 SDK `AgentSession`、Service Session 和稳定版 `AgentRun` 当成同一个类。

以下为**当前官网 API 语义**，作为平台接入参考，不冒充全部已逐端点核对 `v2.0.4` 的合同：

| 操作 | 当前文档入口 | 语义 |
| --- | --- | --- |
| 建会话 | `POST /api/v1/agent-sessions` | 选目标与配置，不启动任务 |
| 提交工作 | `POST /api/v1/agent-sessions/{sessionId}/turns` | 新建 Turn，受理后后台推进 |
| 恢复 UI | Session / Turn 的 `/snapshot` | 获取已发生工作的投影及 `as_of` |
| 订阅 | 对应资源的 `/events/stream?after=...` | 从匹配游标继续读事件 |
| 回应待处理动作 | Turn 的 `/actions` | 先读实际请求，再按动作类型答复 |

当前文档要求创建会话和提交 Turn 时携带稳定 `Idempotency-Key`；超时重试复用原 key 与请求体，而不是创建一个新业务动作。`202 Accepted` 是受理，不等于完成。平台状态完成后还应验证业务结果与产物内容。[当前官方应用集成文档](https://java.agentscope.io/v2/en/service/service-api)

断线后先恢复 snapshot，再从其游标续订；Session 与 Turn 游标不能混用。仅在事件成功应用后保存游标，页面刷新不应重新提交输入；当前 Service SSE 断开不取消后台执行。[当前官方 SSE 与重放文档](https://java.agentscope.io/v2/en/service/sse-events)

## 5. 多副本部署时真正要共享的内容

| 内容 | 解决的问题 |
| --- | --- |
| `AgentStateStore` | 对话状态、计划状态等在重启和跨节点后的读取 |
| Workspace 的 `BaseStore` / 共享文件系统 | 跨节点看到相同记忆、技能和交付物 |
| Sandbox snapshot | 沙箱销毁或迁移后的文件和环境恢复 |
| `SandboxExecutionGuard` | 多副本对同一沙箱执行的串行控制 |
| Session turn gate / 冲突策略 | 跨实例的同会话并发控制 |
| 任务与事件存储 | 后台任务状态、进度读取和重放 |

`DistributedStore` 可组合上述部分组件；但要显式选择 `.filesystem(...)`。接口默认快照为 no-op、默认执行 guard 也可为 no-op，因此不能看到 `.distributedStore(...)` 就断言每项生产能力都已启用。跨节点 turn gate 也有独立配置；状态冲突需要核对具体存储的 CAS 能力和 `ConflictPolicy`。[固定版本 DistributedStore](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-harness/src/main/java/io/agentscope/harness/agent/DistributedStore.java)

官方生产文档提供 Redis/JDBC/OSS 的组合模式，并指出对象存储不适合作分布式锁。工程上需要区分“状态已持久化”“文件已持久化”“执行可恢复”与“外部动作不会重复”；任何一项都不能由另一项自动推出。[官方生产部署说明](https://java.agentscope.io/v2/zh/docs/others/going-to-production)

## 6. 可观测性、测试与效果评估

### 6.1 运行观测

稳定版可使用 `io.agentscope.core.tracing.OtelTracingMiddleware`。它从 `GlobalOpenTelemetry` 获取 Tracer，产生 Agent、模型、工具三个层次的 span，并记录可获得的 token 明细；未配置 OTel SDK 时为 no-op。只添加中间件不会凭空获得可视化后台或 OTLP 导出。[固定版本 Tracing 实现](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tracing/OtelTracingMiddleware.java)

自建导出链需要配置 OTel SDK、OTLP exporter、批量处理器，并在运行前注册一次；若 Spring 已完成注册，应复用现有 SDK。停机时刷新并关闭应用拥有的 provider。不要同时按旧教程注册 `TracerRegistry` 又另建全局 SDK。[固定版本 Middleware 的 OTel 配置](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/en/docs/building-blocks/middleware.md)

Studio 是开发阶段的可视化集成，有独立扩展；其旧 `StudioMessageHook` 用法属于仍存在的兼容路径，不能据此把 Hook 当成 v2 通用扩展首选。完整消息镜像还需考虑业务内容和凭据脱敏。[官方 Studio 说明](https://java.agentscope.io/v2/en/integration/ecosystem/studio)

建议日志关联 user/session/run/toolCall/trace ID，并监控首个文本延迟、总耗时、推理轮数、模型失败与重试、工具失败、确认等待时长、token、单任务费用及取消/恢复比例。费用估算必须使用真实模型价格和提供商用量；token 统计不等于账单硬限制。

### 6.2 可靠性测试

以下为工程测试建议，不声称框架提供一个统一的 EvaluationRunner：

| 层次 | 稳定断言 | 避免的断言 |
| --- | --- | --- |
| Java 工具单测 | 参数、权限、错误映射、幂等、副作用 | 仅验证注解存在 |
| 模型协议契约 | 固定假模型输出 → 工具执行与事件状态正确 | 每次依赖真实模型随机回复 |
| 会话隔离 | 两用户同名 session 不串状态；两会话并发工具不串身份 | 只测顺序单用户流程 |
| 恢复与故障 | 重建 Agent/重启后的读取，拒绝审批、超时、取消、工具失败 | 只有正常问答路径 |
| 端到端效果 | 固定代表性问题、实际引用、有效产物、预算内完成 | 文本必须逐字相同 |

官方固定标签中存在 OTel 中间件测试，使用 Reactor 流和内存 span exporter 检查父子 span、状态及用量；可以借鉴这种可确定验证方式。[固定版本可观测性测试](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/test/java/io/agentscope/core/tracing/OtelTracingMiddlewareTest.java)

### 6.3 效果评估

效果数据应保存：输入、认证与资料范围、预期结果/评分准则、引用资料版本、模型与参数、提示词与工具版本、运行轨迹、费用和耗时。更换模型、提示词、检索配置或工具后对同一批案例作比较。

RAG 指标分成检索与生成：检索是否召回正确资料、是否存在越权片段；生成是否基于证据、引用是否真的支持结论、资料不足时能否明确说明。Agent 指标再加任务完成率、工具选择及参数正确率、重复副作用、人工介入率和预算。LLM 评分可辅助筛查，但关键业务结果需要确定性校验或人工抽查。

`agentscope-extensions-judge` 在固定标签下包含 Jev 结构化决策模块，这不是自动证明一个通用效果评测平台已经开箱可用；“判断当前动作是否合适”与“离线比较整个应用质量”也不是同一个问题。[固定版本 Judge 模块定义](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-judge/pom.xml)

## 7. 可直接放入主笔记的版本警示

> 本笔记以 AgentScope Java `2.0.4` 为核心基线。官网 `/v2/` 文档持续演进，扩展平台和新增会话 API 以各节标注为准。Java 已提供 RAG 实现和知识平台适配，但旧 `Knowledge` / `RAGMode` / `.knowledge(...)` 接线在 `2.0.4` 已弃用；新项目建议在业务检索接口后隔离实现。Spring Boot Starter、Service 与 SDK 的最低运行环境和版本兼容需要分别核对。SSE 传输、状态持久化和后台执行恢复是三项不同能力，不能彼此替代。

研究限制：没有运行外部知识平台、Service 实例或真实模型，因此不把文档中的集成方案标为已完成端到端验证；未通过路径访问取得源码的文件，不以“访问失败”推断其不存在。涉及精确平台 URL 的实现必须与实际部署 OpenAPI 对照。
