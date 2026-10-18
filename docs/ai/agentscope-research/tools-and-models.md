# AgentScope Java：模型、工具、Middleware、权限与 MCP 核对记录

核对日期：2026-10-16。代码基线固定为官方仓库 `v2.0.4` tag，在线 `/v2/zh/` 文档作为概念索引。本文是主笔记的研究材料，不是课程或练习清单。API 已按 tag 源码静态核对；未在本机编译，也未调用真实模型或 MCP 服务。

## 1. 结论与版本陷阱

| 易误用之处 | v2.0.4 核对结果 |
| --- | --- |
| 把在线 v2 文档当成固定稳定版文档 | 在线页面已经包含 tag 中不存在的能力，必须看 tag 源码 |
| Middleware 省略 `RuntimeContext` | 五种 hook 均以 `Agent agent, RuntimeContext ctx, ...` 开头 |
| `activePoints()`、`onAgentStateReady()` | 在线 Middleware 页面已有，v2.0.4 `MiddlewareBase` 没有这两项 |
| `ToolBase.checkPermissions(..., ToolExecutionContext)` | 第二参数实际是 `PermissionContextState`，tag 中的权限文档示例也有旧签名 |
| `ToolResultBlock.success(text)` | tag 中没有此工厂方法；用 `text(text).withState(ToolResultState.SUCCESS)` |
| `ToolResultBlock.text(text)` 就表示工具成功 | 默认状态是 `RUNNING`；完整结果应明确 `SUCCESS` / `ERROR` |
| `toolCall.getSuggestedRules()` | `ToolUseBlock` 无此方法，建议规则在 `PermissionDecision.getSuggestedRules()` |
| 用“同意”文本恢复权限挂起 | 恢复依赖 `Msg.METADATA_CONFIRM_RESULTS` 内的 `ConfirmResult`，不是自然语言解析 |
| 结构化输出 `call()` 直接返回业务对象 | 返回 `Mono<Msg>`，再用 `hasStructuredData()` / `getStructuredData(Class<T>)` 提取 |
| `McpClientBuilder.streamableHttp().name().url().build()` | tag 源码没有这组方法；使用 `create(name).streamableHttpTransport(url).buildAsync()` |
| MCP 自动使用 `mcp__server__tool` 名字 | tag 默认直接使用远端工具名；需要时显式设置 `mcpToolNamePrefix(...)` |
| `DEFAULT` 让全部工具默认确认 | 空权限上下文属于 `isTrivial()`，ReActAgent 走兼容轻量路径，不能作此保证 |
| `DONT_ASK` 一定把全部 ASK 变为 DENY | tag 只在默认兜底决策处转换；显式 ASK 规则、提前返回的 safety ASK 仍可能挂起 |

来源：[v2.0.4 MiddlewareBase](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/middleware/MiddlewareBase.java)、[在线 Middleware](https://java.agentscope.io/v2/zh/docs/building-blocks/middleware)、[ToolBase](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolBase.java)、[ToolResultBlock](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/ToolResultBlock.java)、[ToolUseBlock](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/ToolUseBlock.java)、[PermissionEngine](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/permission/PermissionEngine.java)、[ReActAgent](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)、[McpClientBuilder](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpClientBuilder.java)、[McpClientManager](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/McpClientManager.java)。

## 2. 模型接入与扩展模块

`agentscope-core` 包含模型抽象和注册机制；具体供应商由 `agentscope-extensions-model-*` 提供。Harness 间接依赖 core，但不意味着包含所有供应商。字符串 `.model("provider:model")` 通过 `ModelRegistry` 查找已注册模型、用户工厂和 `ServiceLoader` 加载的 `ModelProvider`。模型名能够解析，只证明提供商实现可用；具体模型是否存在、账号是否有权限、是否支持 tools / 图片 / JSON Schema，需要按实际服务核对。

| 字符串前缀 | 模型扩展 artifactId | 常用凭据 / endpoint |
| --- | --- | --- |
| `dashscope:` | `agentscope-extensions-model-dashscope` | `DASHSCOPE_API_KEY` |
| `openai:` | `agentscope-extensions-model-openai` | `OPENAI_API_KEY` |
| `deepseek:` | `agentscope-extensions-model-openai` | `DEEPSEEK_API_KEY`，由同模块内的兼容 provider 处理 |
| `anthropic:` | `agentscope-extensions-model-anthropic` | `ANTHROPIC_API_KEY`；provider 也支持显式 auth token 配置 |
| `gemini:` | `agentscope-extensions-model-gemini` | 常规 API 使用 `GEMINI_API_KEY`；Vertex AI 另有 project / location 配置 |
| `ollama:` | `agentscope-extensions-model-ollama` | `OLLAMA_BASE_URL`，没有设置时使用本地默认地址 |

来源：[Quickstart tag 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/quickstart.md)、[ModelRegistry](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/model/ModelRegistry.java)、[DashScopeModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-dashscope/src/main/java/io/agentscope/extensions/model/dashscope/DashScopeModelProvider.java)、[OpenAIModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-openai/src/main/java/io/agentscope/extensions/model/openai/OpenAIModelProvider.java)、[DeepSeekModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-openai/src/main/java/io/agentscope/extensions/model/openai/compat/deepseek/DeepSeekModelProvider.java)、[AnthropicModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-anthropic/src/main/java/io/agentscope/extensions/model/anthropic/AnthropicModelProvider.java)、[GeminiModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-gemini/src/main/java/io/agentscope/extensions/model/gemini/GeminiModelProvider.java)、[OllamaModelProvider](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-extensions/agentscope-extensions-model/agentscope-extensions-model-ollama/src/main/java/io/agentscope/extensions/model/ollama/OllamaModelProvider.java)。

最小显式依赖示例：

```xml
<properties>
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
```

自定义 endpoint、HTTP 客户端、超时或提供商特殊参数时，使用对应 `*ChatModel.builder()` 创建 `Model` 后传入 `.model(model)`。重试和备用模型是另一层：v2.0.4 Builder 确实有 `.maxRetries(int)`、`.fallbackModel(Model/String)`、`.failoverListener(...)`。`ModelConfig` 的默认 `maxRetries` 为 3，要求值大于 0。它们只覆盖模型调用失败，不等于自动重试 Java 工具，更不能自动消除工具的重复副作用。[ReActAgent Builder](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)、[ModelConfig](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/agent/config/ModelConfig.java)

## 3. 结构化输出

### 3.1 真实签名与读取方式

通用 `CallableAgent` 支持以下重载；`ReActAgent` 额外提供带上下文的重载。不要把 `Class<?>` 参数理解为改变 Java 返回类型。

```java
// io.agentscope.core.agent.CallableAgent
Mono<Msg> call(List<Msg> msgs, Class<?> structuredModel);
Mono<Msg> call(List<Msg> msgs, JsonNode schema);

// io.agentscope.core.ReActAgent
public Mono<Msg> call(List<Msg> msgs, Class<?> structuredOutputClass,
                     RuntimeContext context);
public Mono<Msg> call(List<Msg> msgs, JsonNode outputSchema,
                     RuntimeContext context);
```

示例（在方法体内，`agent` 为已构建的 `ReActAgent`）：

```java
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.UserMessage;
import java.util.List;

// 可作为类内的静态嵌套 record。
public record NoteSummary(String title, List<String> keyPoints) {}

RuntimeContext ctx = RuntimeContext.builder()
        .userId("alice")
        .sessionId("notes-001")
        .build();
Msg result = agent.call(
        List.of(new UserMessage("把下面文本整理成标题和要点：……")),
        NoteSummary.class,
        ctx).block();

if (result == null || !result.hasStructuredData()) {
    throw new IllegalStateException("本次调用未返回结构化终态结果");
}
NoteSummary summary = result.getStructuredData(NoteSummary.class);
```

这段示例同时展示两种声明位置，实际文件中 imports 在顶部、record 在类内、调用语句在方法体内。需要动态 schema 时，使用 `com.fasterxml.jackson.databind.JsonNode`；需要 Map 时，`Msg.getStructuredData(false)` 也可用，不必自己硬编码 metadata key。调用可能因权限确认、中断、迭代上限等提前结束，因此必须检查结果；对象能反序列化也不代表业务规则已通过。[CallableAgent](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/agent/CallableAgent.java)、[Msg](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/Msg.java)

### 3.2 两种内部实现

`ReActAgent.doStructuredCall()` 先根据是否启用工具，分别询问 `supportsNativeStructuredOutput()` 或 `supportsNativeStructuredOutputWithTools()`。能力足够时，通过模型原生 response format 下发 schema；否则临时增加 `generate_response` 合成工具，让模型用工具参数提交最终结果。原生路径出错也会尝试降级。结构化结果最后放入 `Msg` metadata，再由 `getStructuredData` 转换。能力声明是 provider 的实现决策，不能概括成“某供应商所有模型都原生支持”。

因此，`generate_response` 出现在调试日志中不一定是业务工具；也不要把结构化输出当作工具执行权限、真实数据准确性或领域校验的替代品。[ReActAgent 结构化输出实现](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)

## 4. Tool、Toolkit 与 schema

### 4.1 注解工具

```java
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolResultState;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import io.agentscope.core.tool.Toolkit;

public class NoteTools {
    @Tool(name = "find_note", description = "根据笔记编号读取一篇笔记",
          readOnly = true, concurrencySafe = true)
    public ToolResultBlock findNote(
            @ToolParam(name = "note_id", description = "已存在的笔记编号") String noteId,
            RuntimeContext ctx) {
        if (noteId == null || noteId.isBlank()) {
            return ToolResultBlock.error("note_id 不能为空");
        }
        // 真实业务在此使用经认证的 ctx 身份查询，并执行租户和资源权限校验。
        return ToolResultBlock.text("笔记内容：" + noteId)
                .withState(ToolResultState.SUCCESS);
    }
}

// 应用装配处：
Toolkit toolkit = new Toolkit();
toolkit.registerTool(new NoteTools());
// 在 Agent 构建时传入 .toolkit(toolkit)。
```

`@ToolParam` 声明模型提供的参数，名字应显式填写，避免依赖编译器保留参数名；`required` 默认 `true`。schema 根据 Java 参数的完整类型生成，根节点包括 object / properties / required，嵌套与泛型类型由 schema 工具处理。`RuntimeContext`、`ToolEmitter` 等框架注入参数不应标成模型参数。自定义业务 POJO 不加注解时也可能按类型从 `RuntimeContext` 注入，业务 DTO 若想让模型填写应显式加 `@ToolParam`。`AgentState` 特殊注入还要求 `@Tool(stateInjected = true)`，签名只允许一个未标 `@ToolParam` 的状态参数。[Tool](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Tool.java)、[ToolParam](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolParam.java)、[ToolSchemaGenerator](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolSchemaGenerator.java)、[ToolMethodInvoker](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolMethodInvoker.java)、[ReflectiveFunctionTool](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ReflectiveFunctionTool.java)

`readOnly` 默认 `false`，`concurrencySafe` 默认 `true`。前者是向框架声明操作性质，后者表示同类工具调用是否可并发；两者都不会自动证明代码安全。写操作需要幂等键、事务与业务鉴权时，应在工具后端实施。`strict = true` 只是向兼容 provider 传递严格 schema 偏好，不替代业务输入校验。[Tool 注解源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Tool.java)

工具返回普通字符串/对象时，默认 converter 将其转换为工具结果；需要明确失败语义、多内容块、状态或 metadata 时直接返回 `ToolResultBlock`。不要用成功字符串中包含 `error` 作为错误契约。`ToolEmitter` 的进度输出与最终工具返回值是两条用途不同的通道，不应把进度拼进模型可见的最终结果。[ToolMethodInvoker](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolMethodInvoker.java)、[在线 Tool 概念页](https://java.agentscope.io/v2/zh/docs/building-blocks/tool)

### 4.2 继承 ToolBase

自定义 JSON Schema、检查真实工具输入、标记外部执行时，适合继承 `ToolBase`。v2.0.4 两个关键签名：

```java
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.permission.PermissionContextState;
import io.agentscope.core.permission.PermissionDecision;
import io.agentscope.core.tool.ToolCallParam;
import java.util.Map;
import reactor.core.publisher.Mono;

public Mono<PermissionDecision> checkPermissions(
        Map<String, Object> toolInput, PermissionContextState context);

public Mono<ToolResultBlock> callAsync(ToolCallParam param);
```

这些是方法签名速查，不是可独立编译的类。`callAsync` 通过 `param.getInput()` 读取工具输入，通过 `param.getRuntimeContext()` 读取当前调用身份；返回结果应带正确的终态和内容。`ToolBase` 默认 `checkPermissions` 为 PASSTHROUGH。相比只实现历史 `AgentTool` 接口，`ToolBase` 才参与当前权限引擎的完整工具门控。[ToolBase](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/ToolBase.java)、[AgentTool](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/AgentTool.java)、[ReActAgent evaluateOne](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)

### 4.3 工具组

`Toolkit` 保存注册项、生成 schema、分派调用；Tool Group 控制哪些能力暴露给本轮模型。显式创建 `createToolGroup(name, description, active)`，然后 `toolkit.registration().tool(tools).group(name).apply()`；开启 `enableMetaTool(true)` 可让模型通过 `reset_tools` 管理组。工具未暴露是上下文管理措施，不能替代运行时授权。tag 的部分文档仍写 `list_tools` / `activate_group`，应以当前 Toolkit/MetaToolFactory 的 `reset_tools` 为准。[Toolkit](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java)、[在线 Tool 概念页](https://java.agentscope.io/v2/zh/docs/building-blocks/tool)

## 5. Middleware 的准确边界

v2.0.4 `MiddlewareBase` 是接口，支持五个钩子：

| 方法 | 返回值 | 作用范围 |
| --- | --- | --- |
| `onAgent(Agent, RuntimeContext, AgentInput, Function<AgentInput, Flux<AgentEvent>>)` | `Flux<AgentEvent>` | 包裹本次完整调用 |
| `onReasoning(Agent, RuntimeContext, ReasoningInput, Function<ReasoningInput, Flux<AgentEvent>>)` | `Flux<AgentEvent>` | 包裹一轮推理 |
| `onActing(Agent, RuntimeContext, ActingInput, Function<ActingInput, Flux<AgentEvent>>)` | `Flux<AgentEvent>` | 包裹工具执行阶段 |
| `onModelCall(Agent, RuntimeContext, ModelCallInput, Function<ModelCallInput, Flux<AgentEvent>>)` | `Flux<AgentEvent>` | 包裹底层模型请求 |
| `onSystemPrompt(Agent, RuntimeContext, String)` | `Mono<String>` | 顺序变换系统提示词 |

`ActingInput` 是包含 `List<ToolUseBlock> toolCalls` 的 record，因此不要把它误记为只含一个 tool call。外部执行工具的实际副作用发生在框架外，无法用框架内 onActing 包裹外部系统的整个操作。

可直接参考的计时实现：

```java
import io.agentscope.core.agent.Agent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.middleware.MiddlewareBase;
import io.agentscope.core.middleware.ModelCallInput;
import java.util.function.Function;
import reactor.core.publisher.Flux;

public class ModelTimingMiddleware implements MiddlewareBase {
    @Override
    public Flux<AgentEvent> onModelCall(
            Agent agent,
            RuntimeContext ctx,
            ModelCallInput input,
            Function<ModelCallInput, Flux<AgentEvent>> next) {
        return Flux.defer(() -> {
            long started = System.nanoTime();
            return next.apply(input).doFinally(signal -> {
                long elapsedMs = (System.nanoTime() - started) / 1_000_000;
                System.out.printf("agent=%s session=%s modelMs=%d terminal=%s%n",
                        agent.getName(), ctx.getSessionId(), elapsedMs, signal);
            });
        });
    }
}

// .middleware(new ModelTimingMiddleware()) 注册到 Agent Builder。
```

洋葱钩子应调用 `next.apply(input)` 继续执行；可以在返回流上观察、转换或处理事件。`order()` 默认 1，数值越大位于外层，进入时先执行、退出时后执行；同值保留注册顺序。`onSystemPrompt` 是串行变换，不能套用洋葱前后顺序。不要在共享 middleware 字段保存当前 session / user；放入本次 `RuntimeContext`。日志应筛去模型输入中的凭据、隐私和超大内容。

来源：[MiddlewareBase tag 源码](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/middleware/MiddlewareBase.java)、[ActingInput](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/middleware/ActingInput.java)、[在线 Middleware 概念页](https://java.agentscope.io/v2/zh/docs/building-blocks/middleware)。在线页面的 `activePoints()` 和 `onAgentStateReady()` 是版本差异，不能加入固定 2.0.4 的实现示例。

## 6. 权限、人工确认与恢复

### 6.1 三种决策与模式

工具调用从模型提出到真正执行之间，权限系统可产生 ALLOW / DENY / ASK。规则由工具名、匹配内容、行为和来源构成；匹配内容的含义由该工具的 `matchRule` 实现解释。字符串 description、提示词中的“请先确认”都不是可执行权限边界。

| 模式 | 应理解的用途 | v2.0.4 注意点 |
| --- | --- | --- |
| DEFAULT | 普通交互场景的规则与确认 | 空配置会走轻量兼容路径，不是全局默认拒绝 |
| EXPLORE | 只读探索 | 在完整引擎路径中按 readOnly 拒绝写工具 |
| ACCEPT_EDITS | 工作目录内的编辑策略 | 仍须核对工具自身检查及规则，不等于任意业务写入自动允许 |
| BYPASS | 受控环境中减少默认确认 | deny / ask 规则仍可提前生效，不应写成取消全部检查 |
| DONT_ASK | 默认兜底不能询问时拒绝 | 不保证抹除所有提前返回的 ASK；无人值守应用仍须显式覆盖规则 |

源码顺序是 deny 规则 → ask 规则 → 工具/模式检查 → allow 规则 → BYPASS → 默认 ASK（DONT_ASK 在此转 DENY）。工具检查返回 ALLOW / DENY 时可以提前终结；标记为 safety 的 ASK 也可提前返回。不要根据简化流程图推导“任何工具自己的 ASK 都一定不可被规则覆盖”。业务权限应该在真正执行的服务中再次检查。[PermissionEngine](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/permission/PermissionEngine.java)、[PermissionContextState.isTrivial](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/permission/PermissionContextState.java)、[ReActAgent.evaluatePermissions](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java)

显式规则示例（在 Agent Builder 上调用 `.permissionContext(policy)`）：

```java
import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionContextState;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.permission.PermissionRule;

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

### 6.2 ConfirmResult 回传

`call()` 遇到 ASK 时返回 `GenerateReason.PERMISSION_ASKING` 的 `Msg`，内容中有 `ToolCallState.ASKING` 的 `ToolUseBlock`。`streamEvents()` 则直接发 `RequireUserConfirmEvent`。展示真实工具名、输入与操作影响，收集决策后为每个待确认调用生成结果；调用 ID 必须对应原请求。

```java
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.ConfirmResult;
import io.agentscope.core.message.GenerateReason;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.ToolCallState;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.message.UserMessage;
import java.util.List;
import java.util.Map;

RuntimeContext ctx = RuntimeContext.builder()
        .userId("alice").sessionId("publish-001").build();
Msg paused = agent.call(new UserMessage("发布这篇笔记"), ctx).block();

if (paused != null
        && paused.getGenerateReason() == GenerateReason.PERMISSION_ASKING) {
    List<ToolUseBlock> pending = paused.getContentBlocks(ToolUseBlock.class).stream()
            .filter(tc -> tc.getState() == ToolCallState.ASKING)
            .toList();

    // 下面的决策必须来自已经鉴权的业务界面；这里只示意拒绝并给出原因。
    List<ConfirmResult> decisions = pending.stream()
            .map(tc -> new ConfirmResult(false, tc, null, "内容尚未复核"))
            .toList();
    UserMessage reply = UserMessage.builder()
            .metadata(Map.of(Msg.METADATA_CONFIRM_RESULTS, decisions))
            .build();

    Msg resumed = agent.call(List.of(reply), ctx).block();
}
```

两个状态之间可跨 HTTP 请求，但必须恢复同一身份/会话，且对应 AgentState 仍存在。进程重启或换实例需要配置可靠状态存储，单凭保存 pending 列表不能恢复完整推理。确认通过后才执行工具；拒绝会形成模型可见的 DENIED 结果，模型可能继续给出替代方案。需要停止整轮时另行采用 reject 策略。`ConfirmResult` 的真实构造器为二、三、四参数，第三参数是 `List<PermissionRule>`，第四参数是拒绝原因；没有 `acceptedRules` getter。[ConfirmResult](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/event/ConfirmResult.java)、[Msg metadata 常量](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/message/Msg.java)、[Agent tag 文档的人机交互](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/agent.md)

### 6.3 确认与外部执行不同

ASK 表示“框架是否可以执行此调用”；`externalTool = true` 表示“执行和结果由框架外负责”。后者触发 `RequireExternalExecutionEvent`，下一次把原调用 ID / name 对应的 `ToolResultBlock` 放进消息，再调用 Agent。回传时明确 `ToolResultState.SUCCESS` / `ERROR`；不应误用 ConfirmResult 当作外部执行结果。权限确认也不等于外部业务事务已经成功。[Tool 注解](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Tool.java)、[Agent tag 文档](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/docs/v2/zh/docs/building-blocks/agent.md)

## 7. MCP：连接、注册、命名与资源生命周期

MCP 是工具等能力的互操作协议；它不替代 Agent 的推理循环。AgentScope 的客户端适配层负责初始化、发现工具、把远端 schema 变为工具 schema、发送调用并转换结果。v2.0.4 `agentscope-core` POM 已依赖官方 `io.modelcontextprotocol.sdk:mcp`，不需要臆造一个 AgentScope MCP 扩展 artifact。[core POM](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/pom.xml)、[McpClientBuilder](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpClientBuilder.java)

### 7.1 STDIO 与 Streamable HTTP 的真实 builder

以下为接入片段，地址/命令和凭据需替换为实际已部署服务；不声称示意地址可访问。

```java
import io.agentscope.core.tool.Toolkit;
import io.agentscope.core.tool.mcp.McpClientBuilder;
import io.agentscope.core.tool.mcp.McpClientWrapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;

// STDIO：直接启动实际 server 可执行文件，不需要拼成 shell 命令。
McpClientWrapper local = McpClientBuilder.create("local-notes")
        .stdioTransport(
                "notes-mcp-server",
                List.of("--root", "C:/notes"),
                Map.of("NOTES_MODE", "readonly"))
        .timeout(Duration.ofSeconds(60))
        .initializationTimeout(Duration.ofSeconds(30))
        .buildAsync()
        .block();

// Streamable HTTP：用于已部署的 HTTP MCP endpoint。
McpClientWrapper remote = McpClientBuilder.create("remote-notes")
        .streamableHttpTransport("https://mcp.example.com/mcp")
        .header("Authorization", "Bearer " + System.getenv("NOTES_MCP_TOKEN"))
        .timeout(Duration.ofSeconds(60))
        .buildAsync()
        .block();

Toolkit toolkit = new Toolkit();
toolkit.registerMcpClient(local).block();
toolkit.registration()
        .mcpClient(remote)
        .mcpToolNamePrefix("mcp__remote_notes__")
        .enableTools(List.of("search_notes", "read_note"))
        .propagateMeta(false)
        .apply();
```

还支持 `.sseTransport(url)`，以及同步 `.buildSync()`；它与 `.buildAsync().block()` 是不同的客户端构建方式。`buildAsync()` 构建 wrapper 不等于完成注册发现；`registerMcpClient(...).block()` 才会初始化、列出并注册工具。不要在 Reactor 事件循环中阻塞等待，应用启动初始化可统一处理连接，运行中用响应式链组合。[McpClientBuilder](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpClientBuilder.java)、[McpClientManager](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/McpClientManager.java)

### 7.2 工具名与权限

tag 中默认 `toolNamePrefix` 是空字符串，因此不同 server 远端工具同名时应显式指定前缀，确认模型实际看到的工具 schema。`enableTools` / `disableTools` 使用远端原工具名，前缀只改变暴露给模型的名字，wire name 不变。不要把在线页面所称的自动 `mcp__server__tool` 当作 2.0.4 的默认行为。[Toolkit](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java)、[McpClientManager](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/McpClientManager.java)

MCP `readOnlyHint = true` 被映射为只读标记。`McpTool.checkPermissions` 对只读工具返回 ALLOW，对其他工具返回 ASK；完整权限引擎的显式规则仍会影响决策。远端对自己“只读”的声明不构成可信安全证明，应结合 allowlist、身份鉴权和服务端权限。MCP 是网络或子进程边界，连接失败、工具改名、schema 漂移、凭据过期、超时、server 自身错误都需要单独处理。[McpTool](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpTool.java)

`McpClientWrapper` 实现 `AutoCloseable`；`Toolkit.closeMcpClients()` 也可关闭客户端。必须明确定义连接归谁持有、在何时释放，尤其是 STDIO 子进程。MCP metadata 默认可能把 `McpMeta` 中的业务键和值与框架 tool call ID 发给远端；第三方服务应按最小需要使用 `.propagateMeta(false)` 或针对工具设置覆盖，不应顺手把任意上下文全部远传。[McpClientWrapper](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/mcp/McpClientWrapper.java)、[Toolkit 注册配置](https://github.com/agentscope-ai/agentscope-java/blob/v2.0.4/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java)

## 8. 面向应用的自查索引

| 现象 | 优先查看 |
| --- | --- |
| 找不到 provider 或模型字符串解析失败 | 对应扩展是否在 classpath；前缀是否正确；SPI 配置是否随打包保留 |
| schema 有了，但调用方法拿不到参数 | `@ToolParam.name`、required、参数类型、框架注入与模型输入的区分 |
| 工具返回了文本，状态仍不对 | `ToolResultState` 是否明确，是否把 `text()` 误当成功 |
| 中间件 `@Override` 编译失败 | 是否复制 main 示例；方法第二参数是否有 `RuntimeContext` |
| 人工已确认，但模型又发起同一操作 | 是否只传文字；ConfirmResult 是否含原工具 ID；是否恢复同一会话状态 |
| 想持久接受权限规则却找不到方法 | 规则由 PermissionDecision 携带并显式传给 ConfirmResult，ToolUseBlock 无 suggestedRules API |
| 无人值守任务仍挂起 | 是否存在显式 ASK 规则 / MCP 写工具 ASK；不要只依赖 DONT_ASK 名称 |
| 结构化结果读取抛异常 | 是否为暂停、中断等非最终回复；先 `hasStructuredData()`，再做类型和业务验证 |
| 两个 MCP server 工具冲突 | tag 默认无自动命名空间；检查实际 schema 并设置 `mcpToolNamePrefix` |
| STDIO server 启动但模型看不到工具 | registerMcpClient 的 Mono 是否订阅；初始化/工具发现是否完成 |
| 页面断开后 MCP 工具或 Agent 资源异常 | 生命周期是否由响应式 using / 统一应用关闭管理，是否过早 close |

以上问题应先定位实际版本、运行输入和事件/错误，再阅读相应源码；不要用 v1、main、其他语言 SDK 的方法名补齐想象中的 API。
