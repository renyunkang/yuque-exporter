# 语雀 Markdown 导出工具

一个基于 Puppeteer 的语雀导出脚本。

它的目标很直接：用浏览器模拟人工操作，把语雀知识库里的文档一篇一篇导出成 Markdown，并尽量保留原有目录结构。仓库里还附带了一个 Python 脚本，用来下载文档中的图片并改写 Markdown 里的图片链接。

适合这几类场景：

- 想把个人语雀知识库迁移到 Obsidian、Typora、Git 仓库或本地目录
- 没有超级会员 / Token，不方便使用官方批量导出 API
- 已经导出过一轮，想快速检查有没有漏掉 `.md` 文件

## 功能概览

- 按知识库目录结构导出 Markdown
- 支持导出失败自动重试
- 支持复用登录 Cookie，减少重复登录
- 支持快速校验本地是否漏掉文档
- 支持下载文档图片到本地
- 支持把 Markdown 中的图片链接改成相对路径或自定义图床地址

效果示意：

![导出效果 1](https://images.cherryfloris.eu.org/ryken/2023/05/91804cc3646d6356cd7458c9a12444fc.png)

![导出效果 2](https://images.cherryfloris.eu.org/ryken/2023/05/4b3a4e4207ead71f15600806c12a5c1d.png)

动图演示（旧图，当前版本界面细节可能略有差异）：

![导出演示](./images/exporter.gif)

## 工作原理

语雀普通用户可以单篇导出 Markdown，但不直接提供适合迁移场景的 Markdown 批量导出。这个项目的做法是：

1. 登录语雀
2. 拉取你的知识库和目录树
3. 按目录树遍历每篇文档
4. 触发语雀网页端的 Markdown 导出
5. 把文件保存到本地目录

校验模式会复用同一份目录树，推导“应该存在的 Markdown 文件列表”，再和本地 `EXPORT_PATH` 里的实际 `.md` 文件做对比，从而快速找出缺失项。

## 环境要求

- Node.js
- Python 3
- 本机可用的 Chromium 内核浏览器
  - Google Chrome
  - Microsoft Edge
  - Chromium
  - 其他 Chromium 系浏览器也可能可用

如果浏览器安装在非标准位置，可以通过环境变量手动指定。

## 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/renyunkang/yuque-exporter.git
cd yuque-exporter
npm install
```

如果你习惯使用 `yarn`，也可以：

```bash
yarn
```

### 2. 导出 Markdown

首次运行通常需要提供账号密码。成功登录后，会在本地保存 `cookies.json`，后续可以直接复用 Cookie。

Windows PowerShell：

```powershell
$env:USER="your_user"
$env:PASSWORD="your_password"
$env:EXPORT_PATH=".\output"
node .\main.js
```

macOS / Linux：

```bash
export USER="your_user"
export PASSWORD="your_password"
export EXPORT_PATH="./output"
node main.js
```

如果你需要人工处理验证码，可以关闭无头模式：

```powershell
$env:HEADLESS="false"
$env:USER="your_user"
$env:PASSWORD="your_password"
node .\main.js
```

### 3. 快速校验有没有漏文件

如果你已经导出过一轮，不想重新下载全部文档，可以启用校验模式。

这个模式会：

- 登录语雀并读取最新目录树
- 不重新导出 Markdown
- 对比本地导出目录里的 `.md` 文件
- 输出缺失文件数量和缺失路径

Windows PowerShell：

```powershell
$env:VERIFY_ONLY="true"
$env:EXPORT_PATH=".\output"
node .\main.js
```

如果输出类似下面的内容，说明本地有漏掉的文件：

```text
Expected markdown files: 128
Actual markdown files: 126
Verification failed: 2 markdown files are missing.
MISSING: 我的知识库/专题A/文档1.md
MISSING: 我的知识库/专题B/文档2.md
```

## 常用环境变量

### Node 导出脚本

| 环境变量 | 是否必须 | 说明 |
| --- | --- | --- |
| `USER` | 有 Cookie 时非必须 | 语雀登录用户名 |
| `PASSWORD` | 有 Cookie 时非必须 | 语雀登录密码 |
| `EXPORT_PATH` | 否 | 导出目录，默认是当前目录下的 `output/` |
| `HEADLESS` | 否 | 默认为 `new`；设为 `false` 可显示浏览器，方便人工处理验证码 |
| `VERIFY_ONLY` | 否 | 设为 `true` 时只做缺失文件校验，不重新导出 |
| `PUPPETEER_EXECUTABLE_PATH` | 否 | 手动指定浏览器路径，优先级最高 |
| `CHROME_PATH` | 否 | 兼容 Chrome 路径变量 |
| `EDGE_PATH` | 否 | 兼容 Edge 路径变量 |

### Python 图片脚本

| 环境变量 | 是否必须 | 说明 |
| --- | --- | --- |
| `MARKDOWN_DIR` | 否 | Markdown 根目录，默认当前目录下的 `output/` |
| `DOWNLOAD_IMAGE` | 否 | 是否下载图片，默认 `true` |
| `UPDATE_MDIMG_URL` | 否 | 是否更新 Markdown 里的图片链接，默认 `false` |
| `REPLACE_IMAGE_HOST` | 否 | 自定义图片访问前缀，格式通常为 `https://your-host/...` |

## 常见使用方式

### 仅导出文档

```powershell
$env:USER="your_user"
$env:PASSWORD="your_password"
node .\main.js
```

### 导出文档后，再把图片下载到本地

```powershell
$env:USER="your_user"
$env:PASSWORD="your_password"
node .\main.js

$env:MARKDOWN_DIR=".\output"
python .\export-image.py
```

### 不下载图片，只把图片链接改成相对路径

```powershell
$env:MARKDOWN_DIR=".\output"
$env:DOWNLOAD_IMAGE="false"
$env:UPDATE_MDIMG_URL="true"
python .\export-image.py
```

### 不下载图片，把图片链接替换成你自己的图床地址

```powershell
$env:MARKDOWN_DIR=".\output"
$env:DOWNLOAD_IMAGE="false"
$env:UPDATE_MDIMG_URL="true"
$env:REPLACE_IMAGE_HOST="https://images.example.com"
python .\export-image.py
```

## 输出目录说明

默认情况下，导出结果会写到当前项目目录下的 `output/`。

目录结构大致如下：

```text
output/
  知识库A/
    一级目录/
      文档1.md
      文档2.md
  知识库B/
    文档3.md
```

如果你之后再运行 `export-image.py`，图片通常会保存到对应 Markdown 根目录下的 `images/` 目录里。

## 常见问题

### 1. 本机明明装了 Chrome / Edge，却提示找不到 Chromium

脚本会依次尝试这些位置：

- `PUPPETEER_EXECUTABLE_PATH`
- `CHROME_PATH`
- `EDGE_PATH`
- Windows / macOS / Linux 常见安装路径

如果你的浏览器安装位置比较特殊，可以显式指定：

```powershell
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
node .\main.js
```

如果这些位置都找不到，Puppeteer 会尝试使用自身安装的浏览器版本；这时需要确保依赖安装完整。

### 2. 为什么有些文档导不出来？

目前已知有些语雀内容类型并不适合直接导成 Markdown，例如：

- 纯表格内容
- 思维导图类内容
- 语雀网页端本身不支持直接导成 Markdown 的特殊文档

这类情况有时会表现为超时，建议人工检查后改用其他格式导出。

### 3. 校验模式能保证 100% 准确吗？

不能保证 100% 覆盖所有异常情况，但它能很快发现最常见的问题：

- 某篇文档导出失败
- 某次下载中断
- 本地目录里缺少部分 `.md`

它的判断依据是“语雀目录树里应有的文档”与“本地已有的 `.md` 文件”。如果语雀接口结构变化，校验逻辑也可能需要跟着调整。

### 4. 团队知识库支持吗？

仓库里提到团队导出场景没有系统测试过。理论上部分场景可用，但如果你的知识库结构、权限模型或链接形式和个人库不同，建议先用一个小范围知识库试跑。

## 已知限制

- 自动登录目前主要面向账号密码登录
- 依赖语雀当前网页行为和接口结构，后续如果语雀改版，脚本可能需要同步调整
- 无自动化测试，当前以手工验证为主

## 安全建议

- 不要提交账号密码、Cookie、导出的私有文档
- 建议通过环境变量传递敏感信息
- 建议把 `output/`、临时文件和 `cookies.json` 保持在版本控制之外

## 手工验证建议

每次改完代码后，至少做一次下面的验证：

1. 执行 `node main.js`，确认能正常登录并导出
2. 检查 `output/` 目录结构是否符合语雀目录层级
3. 执行一次 `VERIFY_ONLY=true` 校验，确认缺失统计正常
4. 如果你使用图片脚本，再执行一次 `python .\export-image.py`

## 说明

这个项目本质上是在现有产品限制下，给普通用户补一个“能用的 Markdown 迁移通道”。它不追求官方 API 那种稳定性，也不追求复杂平台能力，核心目标只有一个：尽量把你的语雀内容比较完整地带出来。
