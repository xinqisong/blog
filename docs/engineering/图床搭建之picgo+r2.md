# Cloudflare R2 + PicGo：搭建个人博客笔记图床

## 一、为什么要搭建图床

### 1. 我的使用场景
- 使用 Markdown / VitePress 写个人博客和技术笔记。
- 希望截图上传后，直接获得可写入笔记的图片链接。
- 【补充：原来的图片管理方式，以及遇到的问题】

### 2. 最终希望实现的效果
- 本地选择图片或复制截图。
- 使用 PicGo 上传到 Cloudflare R2。
- 将返回的图片链接插入 Markdown。
- 博客发布后，读者可以正常访问图片。

【截图：最终上传效果、Markdown 图片链接及页面展示】


## 二、整体方案与访问流程

### 1. 各个组件负责什么
- PicGo：本地图片上传工具。
- Cloudflare R2：保存图片文件。
- img.xinqisong.com：计划使用的图片访问域名。
- Markdown / VitePress：引用并展示图片。

### 2. 上传和访问是两条路径
- 上传：本地图片 → PicGo → R2 S3 API → blog 桶。
- 访问：博客图片链接 → img.xinqisong.com → R2 中的图片。

### 3. 两类地址的区别
- S3 API 地址：https://<ACCOUNT_ID>.r2.cloudflarestorage.com
- 公开图片地址：https://img.xinqisong.com/对象路径

【配图：整体流程图】
【补充：为什么 PicGo 不需要部署服务器或 PostgreSQL】


## 三、开始前需要准备什么

- Cloudflare 账号。
- 已接入 Cloudflare 的域名。
- R2 对象存储服务。
- 本地安装 PicGo。
- 一张用于验证上传的测试图片。

【补充：实际使用的系统、PicGo 版本和插件版本】
【补充：配置当天核对的费用与额度说明】


## 四、配置 Cloudflare R2

### 1. 开通 R2 服务
【步骤说明】
【截图：开通入口，敏感信息打码】
![](https://img.istsong.com/2026/10/074273ffee434a55219531739fd02b56.png)
开通需要使用到个人信用卡，本人是使用 Cloudflare 购买的域名，所以前面都已经绑定好了。 （招商银行卡的全币种亲测 ）
### 2. 创建图片存储桶
- 本文实际桶名：blog。
- 【补充：创建时的选项与选择理由】

【截图：创建页面、桶概览】
![](https://img.istsong.com/2026/10/c8990e208af17a7a67ec30385114f169.png)
### 3. 确认账号 ID 与 S3 API 地址
【截图：对应信息的位置】
![](https://img.istsong.com/2026/10/4425499a989b379090c558ffe2066c89.png)
【说明：账号 ID、桶名分别用于哪里】

### 4. 创建用于上传的访问凭证
- 将访问范围限定到目标桶。
- 【补充：实际选择的权限及其理由】
- 不在文章、截图或代码仓库中展示密钥。

【截图：权限配置页，隐藏凭证内容】

Account Details --> Manage API Tokens
![](https://img.istsong.com/2026/10/2479d533020cfa7fa2b653946d98cc22.png)

## 五、绑定图片访问域名

### 1. 在桶设置中绑定自定义域名
【步骤说明】
【截图：Custom Domains 配置过程】

Custom Domains -->  Add 

![](https://img.istsong.com/2026/10/ebfe58003fb2fb454332044d8ac8ee0d.png)

### 4. 验证绑定结果
【截图：域名状态】
【补充：实际生效时间和验证结果】

需要等待一会儿，等状态变为 active。 

![](https://img.istsong.com/2026/10/f8df48b7f17d15c13a20c1dce1deb669.png)


## 六、配置本地 PicGo

### 1. 安装 PicGo
【补充：下载来源、安装版本】
【截图：安装后的主界面】

![](https://img.istsong.com/2026/10/c1ab6acb0c6a0f4cec8f52e3296ded5f.png)

### 2. 安装 R2 上传插件
- 拟使用插件：cloudflare-r2-xqv。
- 【补充：实际安装结果、插件版本】

【截图：插件搜索与安装结果】

![](https://img.istsong.com/2026/10/2774d472b8cab17b1c986815effdb17a.png)

### 3. 填写上传配置
【配置表：插件字段 / 填写内容 / 用途】
【补充：账号 ID、blog 桶名、访问凭证、公开域名等字段】
【截图：配置页面，密钥打码】

![](https://img.istsong.com/2026/10/911a1621ea2ab364f200e477fd57902e.png)

![](https://img.istsong.com/2026/10/ec7035977fdea920e5ef85cacc7a4e5b.png)

### 4. 设置上传目录与文件命名
【补充：实际采用的目录规则、命名方式及示例】

`{year}/{month}/{md5}.{extName}`


## 七、完成一次上传与笔记引用

### 1. 上传测试图片


### 2. 确认图片进入 R2



![](https://img.istsong.com/2026/10/98ff9d2fb5dae5a076c62bc5a53391d0.png)

### 3. 直接访问公开图片链接





## 八、 写作流程简化

主要简化两个流程：

- 使用 Typora
- 使用 VS Code

### Typora流程优化

配置好后，截图的图片直接粘贴后会自动上传。

![image-20261021220344533](https://img.istsong.com/2026/10/56696ed53bba59e4a0076c1d3652f322.png)



### VS Code流程优化

插件商店搜索 PicGo。
