window.NCF_TRANSLATIONS = {
  'zh-CN': {
    copy: {
      pageTitle: 'NCF Agent Interconnect — 一个关于连接聊天的故事',
      skip: '跳转到内容',
      brandLabel: 'NCF Agent Interconnect — 顶部',
      navLabel: '主导航',
      languageLabel: '语言',
      languageMenuTitle: '选择一种语言',
      closeLanguageMenu: '关闭语言选择',
      navStory: '故事',
      navGuide: '现场指南',
      navStart: '开始使用',
      galleryPageTitle: '图像档案 — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — 回到这个故事',
      galleryNavLabel: '图像档案导航',
      galleryBack: '回到故事',
      galleryEyebrow: '图像档案',
      galleryTitle: '每个原始插图',
      galleryIntro:
        '所有图像仍保留在此原型中，包括那些在漫画中已不再以全尺寸使用的图像。每个字幕均为资产文件名。',
      galleryDeveloper: '开发人员',
      galleryAgents: '智能智能体终端',
      galleryBrand: '品牌资产',
      galleryHeroAlt: '开发人员在办公桌前，英雄插图',
      gallerySceneAlt: '开发人员在办公桌前，场景 {number}',
      galleryReadingAlt: '开发人员阅读NCF Agent Interconnect书籍，场景13',
      galleryAgentAlt: '平板屏幕上的智能体 {name} 肖像',
      galleryIconAlt: 'NCF Agent Interconnect应用图标',
      heroEyebrow: '你日常人工智能聊天中的故事',
      heroTitle: '一位开发者。<br /><em>多个协作中的聊天。</em>',
      heroLede:
        '跟随一个缺陷、一项新功能，以及在聊天间传递关键信息的智能体。方向由你决定；NCF Agent Interconnect 将消息和获准的文件送达对应的聊天。',
      download: '下载应用程序',
      readStory: '阅读故事',
      storyEyebrow: '一个开发人员的故事',
      storyTitle: '智能体协同工作',
      storyLede:
        '一个人在熟悉的AI聊天中维护应用程序。Agent Morgan在Mac上的OpenCode中协调；Agent Jade在Windows上的Codex中检查，Agent Sam在Mac上的Cursor中修复错误。你选择智能体名称。本故事中的角色、技能和工具仅为示例；NCF Agent Interconnect不提供它们。',
      guideEyebrow: '保持活动部件清晰',
      guideTitle: '工作在聊天中完成。应用负责传递消息。',
      startEyebrow: '从两个聊天开始。',
      startTitle: '给智能体命名，发送一条消息。',
      startLede:
        '安装桌面应用程序，配置你使用的 AI 应用程序，将两个使用不同名称的聊天连接起来，并请求一个智能体联系另一个智能体。',
      setupGuide: '打开设置指南',
      downloadNote:
        '安装器：Apple Silicon Mac DMG、Intel Mac DMG 和 Windows x64 EXE。macOS 13 或更高版本。Intel 运行时未在 Intel 硬件上进行测试；未发布 Linux 安装器。',
      footerTagline: '现有AI聊天中智能体间的消息。',
      usageGuide: '用户指南',
      license: '许可证',
      systemNote: '注意事项',
      exampleExchange: '聊天',
      activityLabel: '示例活动',
      reader: '当其他聊天正常运行时，你可以离开。',
      developerAlt: '开发人员仍坐在桌前，电脑可见。',
      readingAlt: '开发人员在办公桌上阅读一本关于NCF Agent Interconnect的书。',
      agentAlt: '{name}的头像位于正面朝向的平板电脑内，配有工具图标。',
      names: {
        user: '你',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        '设置你的聊天',
        '安装NCF Agent Interconnect，选择预期的客户端配置，点击Apply，重新连接MCP并测试交换。',
        '设置指南',
      ],
      ['了解你的客户', 'OpenCode、Codex和Cursor具有不同的交付行为和设置要求。', '客户详情'],
      ['控制您的数据', '审查文件、本地历史、精确的聊天绑定、名称转移和删除范围。', '桌面控制'],
      [
        '阅读完整参考文献',
        '用户指南和面向LLM的参考文档包含了这本插图故事背后的完整流程和限制。',
        '阅读llms.txt',
      ],
    ],
    scenes: [
      {
        title: '为工作指派一名协调员',
        lines: [
          '以智能体Morgan的身份连接。使用协调技能统筹所有智能体并掌握整体工作进展。向每位参与者发送你的工作规则。协调工作边界、Git分支、实施与集成顺序以及冲突解决机制。当工作出现重叠时，促使相关智能体建立联系，安排知识共享，并确保他们及时获知相关决策与变更。推动独立任务并行开展。将整合后的结果及需我输入意见的决策汇总提交。',
          '已以智能体Morgan身份连接。我将协调各智能体，跟踪其工作进展，并向您汇报需要您输入结果和决策的内容。',
        ],
        statuses: ['正在编制协调规则'],
      },
      {
        title: '连接Windows专家',
        lines: [
          '以智能体Jade身份连接。你负责在Windows上验证此项目。Morgan负责协调工作；请向她获取指示。',
          '已以智能体Jade身份连接。我负责Windows验证。我将向Morgan说明我的角色并请求指示。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Morgan了解到由谁负责Windows',
        lines: [
          '已连接为智能体Jade。我负责Windows平台的项目验证，已准备就绪，等待您的指令。',
          '收到了。我将把Windows检查路由给你，并协调结果。',
        ],
        statuses: ['将Jade添加到Windows验证计划中'],
      },
      {
        title: '让独立检查成为规则',
        lines: [
          '将每个被报告为完成的任务发送给另一名智能体进行独立测试，使用与结果相匹配的检查。注明完成工作的智能体名称，并要求测试员直接与该智能体协调任何修复。测试员必须向您报告检查内容、测试结果及剩余问题。在测试员确认任务通过后，方可接受该任务。',
          '我明白了。我会将每个报告为已完成的任务发送给另一个智能体进行独立测试。',
        ],
        statuses: ['设置独立检查规则'],
      },
      {
        title: '连接实施智能体',
        lines: [
          '以智能体Leo身份连接。你的角色是实施。Morgan负责协调工作；请向她获取指示。',
          '已以智能体Leo身份连接。我负责实施。我会向Morgan说明我的角色并请求分配任务。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '将功能描述给Morgan',
        lines: [
          '任务#T-1042是保存的过滤器，允许用户重复使用搜索条件。组织实现工作，而其他工作仍在继续。',
          'Leo将在自己的聊天中实现#T-1042。我会跟踪工作并安排独立检查，当他报告完成时。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Leo收到该功能',
        lines: [
          '使用#T-1042任务的实现技能：建立保存过滤器，以便用户可以重复使用搜索条件。让这项工作与其他任务分开，把结果报告给我。',
          '我会处理#T-1042号任务，并首先检查当前搜索条件是如何工作的。',
        ],
        statuses: ['审查当前的搜索实现情况', '规划保存过滤器行为'],
      },
      {
        title: '连接一个分析智能体',
        lines: [
          '以智能体Alice身份连接。你的角色是分析。Morgan负责协调工作；请向她索取指示。',
          '已以智能体Alice身份连接。我负责请求分析。我将向Morgan说明我的角色并请求指示。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '将相关请求提交给Morgan',
        lines: [
          '申请#I-0201和#I-0202可能描述相同的需求。查找潜在的用户问题，在Figma中查看现有搜索界面，并将发现与#T-1042联系起来。',
          'Alice将分析两个请求和Figma界面。我将让她与Leo取得联系，以确保该发现传递至保存过滤器的工作环节。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Alice 会调查需求',
        lines: [
          '使用分析技能来审查问题 #I-0201 和 #I-0202。在 Figma 中检查现有的搜索界面，确定用户潜在的需求，并与 Leo 分享相关发现。',
          '我将把两个请求与当前屏幕进行比对，然后将发现结果发送给Leo。',
        ],
        statuses: ['阅读两个请求', '在 Figma 中检查搜索屏幕'],
      },
      {
        title: '让发现传递到工作聊天',
        lines: [
          '问题#I-0201和#I-0202涉及重复使用相同的搜索条件。任务#T-1042可以保存完整的组合吗？',
          '是的。检查用户是否也需要分享它们；我会将这部分内容与任务 #T-1042 分开处理。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '一个Windows漏洞改变了计划',
        lines: [
          '在Windows上导入失败。我附上了触发错误#B-0317的导入文件。请调查问题并报告您的发现。',
          '在Windows上，Jade将复现#B-0317，并发送给我步骤和证据。如果该错误得到确认，我将组织修复并进行独立检查。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Jade检查了Windows错误',
        lines: [
          '使用验证技能在Windows上重现错误#B-0317，并使用附带的导入文件。将重现步骤和证据发送给我。',
          '我将检查导入并发送结果给你。',
        ],
        statuses: ['打开导入文件', '在Windows上检查导入'],
      },
      {
        title: '证据送达协调员',
        lines: [
          'Windows导入失败。以下是#B-0317的复现步骤和证据。',
          '收到。我将报告结果并保留证据供修复负责人查阅。',
        ],
        statuses: ['准备错误报告'],
      },
      {
        title: '连接另一位开发人员',
        lines: [
          '以智能体Sam身份连接。你的角色是实施。Morgan负责协调工作；请向她索取指示。',
          '已以智能体Sam身份连接。我负责实施。我会向Morgan说明我的角色并请求分配任务。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '结果更改了优先级',
        lines: [
          'Jade在Windows上复现了#B-0317并发送了步骤和证据。导入失败已确认。',
          '这个 bug 阻碍了日常工作的进行。请优先发布 #B-0317 的修复方案。如果任务 #T-1042 还未准备好，可以放在下次发布中。保持工作持续推进。',
          '明白了。Sam将修复#B-0317，而Jade将在Windows上独立检查。我会将#T-1042单独推进。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Sam收到修复',
        lines: [
          '使用实现技能来修复#B-0317错误。Jade在Windows上复现了该问题，以下是她的步骤和证据。请将修复内容与#T-1042保持独立，并直接与Jade协调任何验证细节。',
          '我会调查#B-0317，准备修复方案，并发送一个候选版本进行独立测试。',
        ],
        statuses: ['审查复现步骤', '检查导入代码'],
      },
      {
        title: '回溯之前的调查',
        lines: [
          '在#T-0870任务中进行的早期进口调查可能有助于#B-0317。找出之前的决定和任何相关的例子。',
          'Oscar 在 #T-0870 上工作。我会向他询问决定和例子，然后与 Sam 和 Jade 分享。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: 'Morgan 请求更早的知识',
        lines: [
          '你在任务#T-0870中调查了导入。请恢复之前的决定和与#B-0317错误相关的任何示例，然后与Sam和Jade分享。',
          '我将查阅现有的历史记录和相关资料，然后发送相应的示例。',
        ],
        statuses: ['审查任务 #T-0870'],
      },
      {
        title: '早期的决策已传达给开发者',
        lines: ['我找到了之前的导入决策和示例，正在发送给你。', '收到。我将在修复中使用它们。'],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '相同的示例到达测试人员',
        lines: [
          '相同的导入示例可能对您的 Windows 检查有帮助。已发送。',
          '收到。我将它们包含在检查中。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '与此同时，工作仍在继续',
        lines: [],
        statuses: [],
      },
      {
        title: '第一个候选者已准备就绪。',
        lines: [
          '错误#B-0317已修复。这是独立测试的候选人。',
          '已收到。我将要求Jade执行独立的Windows检查。',
        ],
        statuses: ['正在使用 NCF Agent Interconnect', '消息已发送'],
      },
      {
        title: '另一个智能体对其进行测试。',
        lines: [
          '在Windows上测试#B-0317错误的候选人。Sam执行了它。使用验证技能，直接与Sam一起处理任何缺陷。当检查通过时，发送您的测试结果，或者报告一个阻塞问题。',
          '我将在Windows上进行测试，如果发现缺陷，将直接与Sam协作。',
        ],
        statuses: ['审查候选修复', '在Windows上进行导入测试'],
      },
      {
        title: '第二个用例失败',
        lines: [
          '错误#B-0317：原始文件导入，但Oscar的样本创建了一行重复。请修复该情况。',
          '我将修复重复行的情况，并发送一个修订后的候选版本。',
        ],
        statuses: ['复现重复行'],
      },
      {
        title: '修复后再次测试',
        lines: [
          '重复行情况已修复。这是修订后的候选方案。请重新运行该用例和原始导入。',
          '我将重新运行两次导入和现有的回归检查。',
        ],
        statuses: ['重新运行两个导入样本', '执行现有回归检查'],
      },
      {
        title: '独立结果已到达',
        lines: [
          '错误#B-0317在Windows上使用Sam的修订候选通过。两种导入样本均通过，同时现有导入回归测试也通过。测试范围内无遗留问题。',
          '收到。我将把已接受的修复项包含在发布提案中。',
        ],
        statuses: ['准备发布提案'],
      },
      {
        title: '你决定发布哪些内容',
        lines: [
          '总结错误#B-0317、任务#T-1042以及问题#I-0201和#I-0202。对于每一个，请告诉我迄今为止的进展、接下来的步骤以及我需要做出的任何决定。',
          '我将为每个项目准备一份状态报告，并标记出你需要做出决策的事项。',
        ],
        statuses: ['正在汇总所有四个项目的成果'],
      },
    ],
    notes: [
      {
        html: '<p>你独自维护一个不断增长的应用程序。在你构建路线图功能时，错误报告陆续抵达，同时新的用户请求也需要处理。NCF Agent Interconnect 使你常规聊天中的 AI 智能体能够协同完成这些任务。问题、发现和文件在它们之间直接流转；你设定任务方向，结果则直接返回至你的工作聊天中。</p><p>本指南将跟随一位开发人员经历这一情境。你是故事中唯一的人类；所有命名的参与者均为人工智能智能体。他们的姓名和角色仅为示例，可替换为你自己的设定。</p><p>从<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 个现成提示词</a>中选择一个交给你的模型。它会用你的语言，依据 NCF 文档详细讲解这个示例。</p>',
      },
      {
        html: '<h3>准备您的应用和聊天</h3><p>每个应用程序或个人资料只需设置一次，新聊天通过你选择的名称进行连接。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">设置指南</a></p>',
      },
      {
        html: '<h3>在你平常的聊天中工作</h3><p>在这个故事中，你使用 Mac 进行工作，并保留一台 Windows 计算机用于检查用户运行的应用程序。你已经使用了多种 AI 服务，选择适合你工作的模型，并在成本之间进行平衡。</p><p>人工智能智能体Morgan在OpenCode中协调。其他参与者有各自的聊天；Windows检查在Codex中进行。新参与者之后可加入Cursor或另一配置的应用程序。</p><p>首次设置完成后，为每个参与的聊天指定名称。在主聊天中，确立协调规则。Jade现已告知Morgan其Windows验证角色；后续工作可通过协调聊天进行引导。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">设置指南</a></p>',
      },
      {
        html: '<p>为人工智能协调员设置一个独立的规则，用于接收已完成的工作。人工智能协调员在参与者加入时发送工作任务指令，并持续跟踪所有任务的进展。连接参与者时，请为其聊天指定名称和角色；Morgan将在智能体报告其角色后分配工作。</p>',
      },
      {
        html: '<p>AI智能体Leo负责该功能，AI协调员跟进其进展。</p>',
      },
      {
        html: '<h3>让发现到达工作聊天</h3>\n        <p>稍后，两个相关的用户请求到达。您开启另一个分析聊天；Morgan将请求分配给Alice，并将其与该功能的所有者联系起来。AI智能体Alice发现，两个请求均描述了相同的需求：用户每日需重复创建相同的搜索条件。她将该发现直接发送至保存过滤器功能正在开发的聊天中。</p>',
      },
      {
        html: '<p>问题、补充或结果会进入对应的工作聊天。各智能体仍使用自己环境中的工具和项目说明。详见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">应用设置指南</a>。</p>',
      },
      {
        html: '<h3>调查Windows错误</h3>\n        <p>用户报告在Windows上导入失败。功能和请求分析已有各自的参与者。Jade的Windows聊天已连接，因此Morgan要求她在此处复现故障。</p>',
      },
      {
        html: '<p>人工智能智能体 Jade 作为测试者复现了故障，并将证据直接发送至协调聊天频道。用户确认该问题已阻碍日常工作任务。你需向人工智能智能体 Morgan 说明此情况如何影响发布优先级。</p>',
      },
      {
        html: '<p>你可以在功能持续进行的同时扩展团队。AI智能体Morgan分享了复现步骤，确认了工作边界，并安排在Windows上进行验证。AI协调器将变更保持隔离，以确保修复可优先发布。AI智能体Sam负责修复，而Jade在Windows上测试其行为。保存的过滤器和请求分析继续在原始聊天中进行。你在工作进行中已更改发布顺序并增加了容量。</p>',
      },
      {
        html: '<h3>将先前的知识重新引入任务中</h3><p>你记得有一个较早的聊天记录包含对导入行为的调查。AI智能体Oscar可以回顾他所拥有的历史记录和相关材料，解释之前的决策并分享示例。AI开发者将这些知识应用到修复中。AI测试员在检查当前实现时会使用这些示例。</p>',
      },
      {
        html: '<h3>文件、回复和历史记录</h3><p>消息历史和附件副本保存在参与者的本地计算机上。存储和文件传送方式见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">数据指南</a>；在其他聊天中继续使用智能体的方法见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">桌面操作指南</a>。</p>',
      },
      {
        html: '<h3>让测试和修复在智能体之间进行。</h3>\n        <p>在此示例中，AI智能体 Sam 在 Mac 上使用 Cursor 工作，而 Jade 在 Windows 上使用 Codex 进行测试。AI协调员在 OpenCode 中接收完成报告，并分配独立检查。接下来的交互展示了智能体之间的协作方式。</p>',
      },
      {
        html: '<h3>需要时的管理</h3><p>你的常规工作仍保留在AI聊天中。当需要检查连接或管理存储数据时，桌面应用程序提供以下控制。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">设置指南</a></p>',
      },
      {
        html: '<p>智能体通过 NCF Agent Interconnect 在各自的工作聊天之间交换消息。每种应用的设置步骤见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">应用指南</a>。</p>',
      },
      {
        html: '<p>你可以在桌面应用中查看智能体的历史记录，并按需删除其本地数据。删除范围见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">智能体管理指南</a>。</p>',
      },
      {
        html: '<p>人工智能智能体Jade直接向Morgan汇报。人工智能智能体Sam和Jade共同处理常规发现，而其他任务持续推进。您可在协调聊天中随时添加上下文或调整目标；无需逐项传递每个修正或批准每次重新测试。</p>',
      },
      {
        html: '<h3>当交换停止时检查连接</h3><p>如果交流中断，请确认 NCF Agent Interconnect 正在运行，并检查目标聊天是否已连接。后续排查步骤见<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">设置指南</a>。</p>',
      },
      {
        html: '<h3>查看结果并决定发布内容</h3><p>发布前，AI智能体 Morgan 会向你提供一份结果报告：哪些内容已变更，Windows 上执行了哪些检查，哪些问题仍待解决，以及哪些内容已提议发布。你需评估该报告是否解决了用户问题，并决定哪些内容将被发布。已保存的过滤器将继续推进至各自的目标结果。</p>',
      },
    ],
  },
  fr: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Une histoire de chats connectés',
      skip: 'Passer au contenu',
      brandLabel: 'NCF Agent Interconnect — haut',
      navLabel: 'Navigation principale',
      languageLabel: 'Langue',
      languageMenuTitle: 'Choisissez une langue',
      closeLanguageMenu: 'Fermer la sélection de langue',
      navStory: "L'histoire",
      navGuide: 'Guide de terrain',
      navStart: 'Commencez',
      galleryPageTitle: "Archivage d'images — NCF Agent Interconnect",
      galleryBrandLabel: "NCF Agent Interconnect — Retour à l'histoire",
      galleryNavLabel: "Navigation dans les archives d'images",
      galleryBack: "Retour à l'histoire",
      galleryEyebrow: "Archivage d'images",
      galleryTitle: 'Chaque illustration originale',
      galleryIntro:
        'Toutes les images restent dans ce prototype, y compris celles qui ne sont plus utilisées à pleine taille dans la bande dessinée. Chaque légende correspond au nom du fichier d’actif.',
      galleryDeveloper: 'Développeur',
      galleryAgents: "Tablettes de l'agent",
      galleryBrand: 'Actif de la marque',
      galleryHeroAlt: 'Développeur au bureau, illustration héroïque',
      gallerySceneAlt: 'Développeur au bureau, scène {number}',
      galleryReadingAlt: 'Développeur lisant le livre NCF Agent Interconnect, scène 13',
      galleryAgentAlt: "Portrait de l'agent {name}",
      galleryIconAlt: "Icône de l'application NCF Agent Interconnect",
      heroEyebrow: "Une histoire de vos conversations quotidiennes avec l'IA",
      heroTitle: 'Un développeur.<br /><em>Plusieurs chats de travail.</em>',
      heroLede:
        'Suivez un bug, une fonctionnalité et les agents qui se transmettent les informations utiles. Vous fixez le cap ; NCF Agent Interconnect achemine les messages et les fichiers autorisés vers le bon chat.',
      download: "Télécharger l'application",
      readStory: "Lisez l'histoire",
      storyEyebrow: "Une histoire d'un développeur",
      storyTitle: 'Les agents travaillent ensemble',
      storyLede:
        "Une personne maintient une application sur des discussions d'IA familières. L'agent Morgan coordonne dans OpenCode sur un Mac ; l'agent Jade vérifie Windows dans Codex, et l'agent Sam corrige le bogue dans Cursor sur le Mac. Vous choisissez les noms des agents. Les rôles, les compétences et les outils de cette histoire sont des exemples ; NCF Agent Interconnect ne les fournit pas.",
      guideEyebrow: 'Gardez les pièces mobiles dégagées',
      guideTitle: 'Le travail se fait dans les chats. Le hub transmet les échanges.',
      startEyebrow: 'Commencez par deux conversations.',
      startTitle: 'Donnez-leur un nom. Envoyez un message.',
      startLede:
        "Installez l'application de bureau, configurez les applications d'IA que vous utilisez, connectez deux chats sous des noms différents et demandez à un agent de contacter l'autre.",
      setupGuide: 'Ouvrir le guide de configuration',
      downloadNote:
        "Installateurs : Apple Silicon Mac DMG, Intel Mac DMG et Windows x64 EXE. macOS 13 ou version ultérieure. Le runtime Intel n'a pas été testé sur du matériel Intel ; aucun installateur Linux n'a été publié.",
      footerTagline: "Messages échangés entre agents dans vos conversations d'IA existantes.",
      usageGuide: 'Guide des utilisateurs',
      license: 'Licence',
      systemNote: 'Remarque',
      exampleExchange: 'Chat',
      activityLabel: 'Activité illustrative',
      reader: "Tant que d'autres conversations fonctionnent, vous pouvez vous éloigner.",
      developerAlt: 'Le développeur reste assis à un bureau avec un ordinateur visible.',
      readingAlt: 'Le développeur lit un livre sur NCF Agent Interconnect au bureau.',
      agentAlt:
        "Portrait de tête de {name} à l'intérieur d'une tablette frontale avec des icônes d'outil.",
      names: {
        user: '« Vous ? »',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Configurez vos chats.',
        'Installez NCF Agent Interconnect, choisissez la configuration du client prévue, cliquez sur Apply, reconnectez MCP et testez un échange.',
        "Guide d'installation",
      ],
      [
        '« Connaissez votre client »',
        'OpenCode, Codex et Cursor présentent des comportements de livraison et des exigences de configuration différents.',
        'Détails du client',
      ],
      [
        'Contrôlez vos données',
        "Vérifier les fichiers, l'historique local, les liaisons exactes du chat, les transferts de noms et la portée de la suppression.",
        'Contrôles de bureau',
      ],
      [
        'Lire la référence complète',
        "Le guide de l'utilisateur et la référence orientée vers le LLM contiennent les procédures complètes et les limites associées à cette histoire illustrée.",
        'Lire llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Attribuez un coordinateur au travail',
        lines: [
          "Connectez-vous en tant qu'agent Morgan. Utilisez la compétence de coordination pour coordonner tous les agents et suivre l'ensemble du travail. Envoyez à chaque participant vos règles de travail. Coordonnez les limites de travail, les branches Git, l'ordre d'implémentation et d'intégration, ainsi que la résolution des conflits. Mettez les agents en relation lorsque leurs travaux se chevauchent, organisez le partage des connaissances et tenez-les informés des décisions et changements pertinents. Maintenez les tâches indépendantes en cours de progression parallèle. Fournissez-moi les résultats consolidés et les décisions nécessitant mon intervention.",
          'Connectée en tant qu’agente Morgan. Je vais coordonner les agents, suivre leurs tâches et vous transmettre les résultats et décisions qui nécessitent votre intervention.',
        ],
        statuses: ['Préparation des règles de coordination'],
      },
      {
        title: 'Connectez le spécialiste Windows',
        lines: [
          "Connectez-vous en tant qu'agent Jade. Vous êtes responsable de la vérification de ce projet sur Windows. Morgan coordonne le travail ; demandez-lui des instructions.",
          'Connectée en tant qu’agente Jade. Je suis chargée de la vérification Windows. Je vais informer Morgan de mon rôle et lui demander des instructions.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Morgan apprend qui gère Windows',
        lines: [
          "Connecté en tant qu'agent Jade. Je m'occupe de la vérification des projets sur Windows et suis prêt à recevoir vos instructions.",
          'Bien reçu. Je vous confierai les vérifications sous Windows et coordonnerai les résultats.',
        ],
        statuses: ['Ajout de Jade au plan de vérification Windows'],
      },
      {
        title: 'Faites de la vérification indépendante une règle',
        lines: [
          "Envoyer chaque tâche déclarée comme terminée à un autre agent pour un test indépendant, en utilisant des vérifications adaptées au résultat. Indiquez l'agent ayant réalisé le travail et demandez au testeur de coordonner toute correction directement avec lui. Le testeur doit vous rapporter les vérifications, le résultat et les problèmes restants. Acceptez la tâche uniquement après que le testeur ait confirmé qu'elle a passé les tests.",
          'Je comprends. Je transmettrai chaque tâche signalée comme terminée à un autre agent pour des vérifications indépendantes.',
        ],
        statuses: ['Définition de la règle de contrôle indépendante'],
      },
      {
        title: "Connectez un agent d'implémentation",
        lines: [
          "Connectez-vous en tant qu'agent Leo. Votre rôle est l'implémentation. Morgan coordonne le travail ; demandez-lui des instructions.",
          "Connecté en tant qu’agent Leo. Je m'occupe de l'implémentation. Je vais informer Morgan de mon rôle et lui demander une affectation.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Décrire la fonctionnalité à Morgan',
        lines: [
          'La tâche #T-1042 contient des filtres enregistrés qui permettent aux utilisateurs de réutiliser leurs conditions de recherche. Organiser la mise en œuvre pendant que les autres travaux se poursuivent.',
          'Leo mettra en œuvre le #T-1042 dans son propre chat. Je suivrai le travail et organiserai une vérification indépendante quand il le rapportera terminé.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Leo reçoit la fonctionnalité',
        lines: [
          "Utilisez la compétence d'implémentation pour la tâche #T-1042 : construisez des filtres enregistrés afin que les utilisateurs puissent réutiliser leurs conditions de recherche. Gardez ce travail séparé des autres tâches et rapportez-moi votre résultat.",
          "Je vais prendre le #T-1042 et d'abord inspecter comment fonctionnent les conditions de recherche en ce moment.",
        ],
        statuses: [
          "Révision de l'implémentation actuelle de la recherche",
          'Planification du comportement du filtre enregistré',
        ],
      },
      {
        title: "Connectez un agent d'analyse",
        lines: [
          "Connectez-vous en tant qu'agent Alice. Votre rôle est l'analyse. Morgan coordonne le travail ; demandez-lui des instructions.",
          "Connectée en tant qu’agente Alice. Je m'occupe de l'analyse des demandes. Je vais informer Morgan de mon rôle et lui demander des instructions.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Transmettre les demandes associées à Morgan',
        lines: [
          "Les demandes #I-0201 et #I-0202 peuvent décrire le même besoin. Identifiez le problème sous-jacent de l'utilisateur, vérifiez l'écran de recherche existant dans Figma et reliez la découverte à #T-1042.",
          "Alice analysera les deux demandes et l'écran Figma. Je la mettrai en relation avec Leo afin que le résultat parvienne au travail de filtre sauvegardé.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Alice examine le besoin',
        lines: [
          "Utilisez la compétence d'analyse pour examiner les questions #I-0201 et #I-0202. Vérifiez l'écran de recherche existant dans Figma, identifiez le besoin sous-jacent de l'utilisateur et partagez les résultats pertinents avec Leo.",
          "Je vais comparer les deux demandes avec l'écran actuel, puis envoyer le résultat à Leo.",
        ],
        statuses: ['Lire les deux demandes', "Vérification de l'écran de recherche dans Figma"],
      },
      {
        title: 'Permettez à la découverte d’atteindre le chat de travail',
        lines: [
          'Les questions #I-0201 et #I-0202 concernent la réutilisation des mêmes conditions de recherche. La tâche #T-1042 peut-elle préserver la combinaison complète ?',
          "- Oui, c'est vrai. Vérifiez si les utilisateurs doivent également les partager ; je le garderai séparé de la tâche #T-1042.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Un bogue Windows modifie le plan',
        lines: [
          "L'importation a échoué sur Windows. J'attache le fichier d'importation qui déclenche le bug #B-0317. Vérifiez le problème et rapportez ce que vous trouvez.",
          "Jade reproduira le #B-0317 sur Windows et m'enverra les étapes et les preuves. Si le bug est confirmé, je vais organiser la correction et une vérification indépendante.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Jade effectue les vérifications sur le bug Windows',
        lines: [
          "Utilisez la compétence de vérification pour reproduire le bug #B-0317 sur Windows avec le fichier d'importation joint. Envoyez-moi les étapes de reproduction et les preuves.",
          "Je vais vérifier l'import et vous envoyer le résultat.",
        ],
        statuses: [
          "Ouverture du fichier d'importation",
          "Vérification de l'importation sous Windows",
        ],
      },
      {
        title: 'Les preuves parviennent au coordinateur',
        lines: [
          "L'importation de Windows échoue. Voici les étapes de reproduction et les preuves pour #B-0317.",
          'Reçu. Je signalerai le résultat et conserverai les preuves pour le propriétaire du correctif.',
        ],
        statuses: ['Préparation du rapport de bug'],
      },
      {
        title: 'Connectez un autre développeur',
        lines: [
          "Connectez-vous en tant qu'agent Sam. Votre rôle est la mise en œuvre. Morgan coordonne les tâches ; demandez-lui des instructions.",
          "Connecté en tant qu’agent Sam. Je m'occupe de l'implémentation. Je vais informer Morgan de mon rôle et lui demander une affectation.",
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Le résultat modifie la priorité',
        lines: [
          "Jade a reproduit #B-0317 sur Windows et a envoyé les étapes et les preuves. L'échec de l'importation est confirmé.",
          "Ce bug bloque le travail quotidien. Sortez d'abord la correction pour #B-0317. Si la tâche #T-1042 n'est pas prête, elle peut suivre dans la prochaine version. Continuez le travail.",
          'Je comprends. Sam réparera le #B-0317, et Jade le vérifiera indépendamment sur Windows. Je vais garder le #T-1042 en mouvement séparément.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Sam reçoit le correctif',
        lines: [
          "Utilisez la compétence de mise en œuvre pour corriger le bug #B-0317. Jade l'a reproduit sur Windows ; voici ses étapes et ses preuves. Gardez la correction séparée du #T-1042 et coordonnez tous les détails de vérification directement avec Jade.",
          'Je vais enquêter sur #B-0317, préparer la solution et envoyer un candidat à des tests indépendants.',
        ],
        statuses: ['Révision des étapes de reproduction', "Vérification du code d'importation"],
      },
      {
        title: 'Rappelez une enquête antérieure',
        lines: [
          'Une enquête antérieure sur les importations dans le cadre de la tâche #T-0870 peut aider à la réalisation de la tâche #B-0317. Trouvez les décisions précédentes et tous les exemples pertinents.',
          'Oscar a travaillé sur #T-0870. Je lui demanderai les décisions et les exemples, puis je les partagerai avec Sam et Jade.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Morgan demande des connaissances antérieures',
        lines: [
          "Vous avez enquêté sur l'import dans la tâche #T-0870. Veuillez récupérer les décisions précédentes et tous les exemples pertinents pour le bug #B-0317, puis les partager avec Sam et Jade.",
          "Je passerai en revue l'historique et les documents disponibles, puis j'enverrai les exemples pertinents.",
        ],
        statuses: ['Résumé de la tâche #T-0870'],
      },
      {
        title: 'Les décisions antérieures parviennent au développeur',
        lines: [
          "J'ai trouvé les décisions d'importation antérieures et des exemples. Je vous les envoie.",
          'Reçu. Je les utiliserai dans la correction.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Les mêmes exemples parviennent au testeur',
        lines: [
          "Les mêmes exemples d'importation peuvent aider votre vérification Windows. Je les envoie.",
          'Bien reçu. Je les inclurai dans les vérifications.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Pendant ce temps, les travaux progressent',
        lines: [],
        statuses: [],
      },
      {
        title: 'Le premier candidat est prêt',
        lines: [
          'Le bug #B-0317 est corrigé. Voici le candidat aux tests indépendants.',
          'Reçu. Je demanderai à Jade un test indépendant sur Windows.',
        ],
        statuses: ['Utilisation de NCF Agent Interconnect', 'Message envoyé'],
      },
      {
        title: 'Un autre agent le teste.',
        lines: [
          "Testez le candidat pour le bug #B-0317 sur Windows. Sam l'a mis en œuvre. Utilisez la compétence de vérification et travaillez directement avec Sam sur tous les défauts. Envoyez-moi votre propre résultat de test quand les tests passent, ou signalez un bloqueur.",
          'Je vais le tester sur Windows et collaborer directement avec Sam si je détecte un défaut.',
        ],
        statuses: ['Examen de la correction proposée', "Tests d'importation sur Windows"],
      },
      {
        title: 'Un deuxième cas échoue.',
        lines: [
          "Bug #B-0317 : le fichier d'origine est importé, mais l'échantillon d'Oscar crée une ligne dupliquée. Veuillez réparer ce cas.",
          'Je vais corriger le cas des lignes en double et envoyer un candidat révisé.',
        ],
        statuses: ['Reproduction de la ligne dupliquée'],
      },
      {
        title: 'Corriger, puis effectuer à nouveau les tests.',
        lines: [
          "Le cas de ligne en double est résolu. Voici le candidat révisé. Veuillez réexécuter ce cas et l'importation d'origine.",
          'Je relancerai à la fois les deux importations et les tests de régression existants.',
        ],
        statuses: [
          "Réexécution des deux échantillons d'importation",
          'Exécution des vérifications de régression existantes',
        ],
      },
      {
        title: 'Le résultat indépendant arrive',
        lines: [
          "Le bug #B-0317 a été validé sur Windows en utilisant le candidat révisé de Sam. Les deux échantillons d'importation ont été validés, ainsi que les tests de régression d'importation existants. Aucun problème ne reste dans la portée testée.",
          'Reçu. Je vais inclure la correction acceptée dans la proposition de livraison.',
        ],
        statuses: ['Préparation de la proposition de version'],
      },
      {
        title: 'Vous décidez de ce qui sera publié',
        lines: [
          "Résumez le bug #B-0317, la tâche #T-1042 et les problèmes #I-0201 et #I-0202. Pour chacun, dites-moi l'état actuel, ce qui vient ensuite et toute décision que vous avez besoin de moi.",
          'Je vais préparer un statut pour chaque élément et mettre en évidence les décisions que vous devez prendre.',
        ],
        statuses: ['Compilation des résultats pour les quatre éléments'],
      },
    ],
    notes: [
      {
        html: "<p>Vous maintenez une application en croissance par vous-même. Les rapports de bogues arrivent pendant que vous développez une fonctionnalité de roadmap, et de nouvelles demandes d'utilisateurs nécessitent également votre attention. NCF Agent Interconnect permet aux agents d'IA de vos conversations habituelles de collaborer sur ces tâches. Les questions, les constatations et les fichiers circulent directement entre eux ; vous définissez la direction et recevez les résultats dans votre chat de travail.</p><p>Ce guide suit un développeur dans cette situation. Vous êtes le seul humain dans l'histoire ; tous les participants nommés sont des agents d'IA. Leurs noms et rôles sont des exemples que vous pouvez remplacer par les vôtres.</p><p>Choisissez l’un des <a href=\"https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md\">13 prompts préparés</a> et confiez-le à votre modèle. Il rédigera dans votre langue un guide détaillé de l’exemple choisi, fondé sur la documentation NCF.</p>",
      },
      {
        html: '<h3>Préparez vos applications et chats</h3><p>Configurez chaque application ou profil une fois. Les nouveaux chats s\'ajoutent ensuite en se connectant sous les noms que vous choisissez.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guide de configuration</a></p>',
      },
      {
        html: "<h3>Travaillez dans vos conversations habituelles</h3><p>Dans cette histoire, vous travaillez sur un Mac et conservez un ordinateur Windows pour vérifier l'application que vos utilisateurs exécutent. Vous utilisez déjà plusieurs services d'IA, en choisissant des modèles adaptés à votre travail et en équilibrant les coûts.</p><p>L'agent IA Morgan coordonne dans OpenCode. D'autres participants ont leurs propres chats ; les tests Windows ont lieu dans Codex. Un nouveau participant pourrait plus tard se connecter via Cursor ou une autre application configurée.</p><p>Après la première configuration, attribuez un nom à chaque chat participant. Dans votre chat principal, établissez les règles de coordination. Jade a désormais informé Morgan de son rôle de vérification Windows ; vous pouvez diriger les tâches ultérieures via le chat de coordination.</p><p><a href=\"https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md\">guide de configuration</a></p>",
      },
      {
        html: "<p>Attribuer au coordonnateur de l'IA une règle distincte pour l'acceptation du travail achevé. Le coordonnateur de l'IA envoie les instructions de travail aux participants au moment de leur connexion et suit l'évolution des progrès sur toutes les tâches. Lorsque vous connectez un participant, attribuez à ce chat un nom et un rôle ; Morgan attribue le travail après que l'agent ait signalé ce rôle.</p>",
      },
      {
        html: "<p>L'agent IA Leo est responsable de la fonctionnalité. Le coordinateur IA suit son avancement.</p>",
      },
      {
        html: "<h3>Faites en sorte que les constatations parviennent aux conversations d'IA utilisées pour le travail</h3>\n        <p>Plus tard, deux demandes d'utilisateurs connexes arrivent. Vous ouvrez un autre chat d'analyse ; Morgan attribue les demandes à Alice et la met en contact avec le propriétaire de la fonctionnalité. L'agent IA Alice découvre que les deux requêtes décrivent le même besoin : les utilisateurs recréent les mêmes conditions de recherche chaque jour. Elle envoie la découverte directement au chat où la fonctionnalité de filtrage sauvegardé est en cours de construction.</p>",
      },
      {
        html: '<p>Une question, une précision ou un résultat arrive dans la conversation de travail concernée. Chaque agent garde les outils et consignes de son environnement. Consultez le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guide des applications</a>.</p>',
      },
      {
        html: "<h3>Investiguer le bogue Windows</h3>\n        <p>Un utilisateur signale que l'import échoue sous Windows. L'analyse de la fonctionnalité et de la demande dispose déjà de ses propres participants. Le chat Windows de Jade est connecté, donc Morgan lui demande de reproduire l'échec là-bas.</p>",
      },
      {
        html: "<p>L'agent d'IA Jade, le testeur, reproduit l'échec et envoie les preuves directement au chat de coordination. L'utilisateur confirme que le problème bloque le travail quotidien. Informez l'agent d'IA Morgan de la modification de la priorité de livraison.</p>",
      },
      {
        html: "<p>Vous pouvez étendre l'équipe pendant que la fonction continue. L'agent IA Morgan partage la reproduction, s'accorde sur les limites de travail et organise la vérification sous Windows. Le coordinateur IA maintient les modifications séparées afin que la correction puisse être livrée en premier. L'agent IA Sam est responsable de la correction, tandis que Jade vérifie son comportement sous Windows. Les filtres enregistrés et l'analyse des requêtes continuent dans leurs discussions d'origine. Vous avez modifié l'ordre de livraison et ajouté de la capacité pendant que les travaux sont en cours.</p>",
      },
      {
        html: '<h3>Intégrer à nouveau les connaissances antérieures dans la tâche</h3><p>Vous vous souvenez qu’un chat plus ancien contient une enquête sur le comportement d’importation. L’agent IA Oscar peut examiner l’historique et les matériaux encore disponibles, expliquer les décisions antérieures et partager des exemples. Le développeur d’IA applique ces connaissances à la correction. Le testeur d’IA utilise les exemples lorsqu’il les compare à l’implémentation actuelle.</p>',
      },
      {
        html: '<h3>Fichiers, réponses et historique</h3><p>L’historique des messages et les copies des pièces jointes sont conservés localement sur les ordinateurs des participants. Le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">guide des données</a> explique leur stockage et leur transfert ; le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guide de l’application</a> décrit le passage à une autre conversation.</p>',
      },
      {
        html: "<h3>Permettez aux tests et aux corrections de s'effectuer entre les agents</h3>\n        <p>Dans cet exemple, l'agent IA Sam travaille dans Cursor sur Mac, tandis que Jade teste dans Codex sur Windows. Le coordonnateur IA reçoit le rapport de fin dans OpenCode et attribue le contrôle indépendant. Les échanges suivants montrent comment les agents collaborent.</p>",
      },
      {
        html: '<h3>Administration lorsque vous en avez besoin</h3><p>Votre travail ordinaire reste dans les conversations d\'IA. L\'application de bureau fournit les contrôles ci-dessous lorsque vous devez inspecter une connexion ou gérer les données stockées.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guide de configuration</a></p>',
      },
      {
        html: '<p>Les agents échangent des messages grâce à NCF Agent Interconnect tout en restant dans leurs conversations de travail. Le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guide des applications</a> explique leur configuration.</p>',
      },
      {
        html: '<p>Dans l’application de bureau, vous pouvez consulter l’historique d’un agent et supprimer ses données locales si nécessaire. Le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">guide de gestion des agents</a> précise la portée de cette suppression.</p>',
      },
      {
        html: "<p>L'agent d'IA Jade rapporte directement à Morgan. Les agents d'IA Sam et Jade traitent conjointement les anomalies courantes, tandis que les autres tâches progressent sans interruption. Vous pouvez ajouter du contexte ou modifier l'objectif dans le chat de coordination à tout moment où une modification survient ; il ne vous est pas nécessaire de transmettre chaque correction ni d'approuver chaque retest.</p>",
      },
      {
        html: '<h3>Vérifiez une connexion lorsque l\'échange s\'arrête</h3><p>Si l’échange s’interrompt, vérifiez que NCF Agent Interconnect fonctionne et que la bonne conversation est connectée. Les autres étapes figurent dans le <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">guide de configuration</a>.</p>',
      },
      {
        html: "<h3>Recevoir le bilan et décider de la publication</h3><p>Avant la publication, l'agent IA Morgan vous fournit un compte rendu du résultat : ce qui a changé, ce qui a été vérifié sous Windows, ce qui reste ouvert et ce qui est proposé pour la livraison. Vous évaluez si cela résout le problème de l'utilisateur et décidez ce qui est livré. Les filtres enregistrés poursuivent leur progression vers leur propre résultat.</p>",
      },
    ],
  },
  de: {
    copy: {
      pageTitle: 'NCF Agent Interconnect – Eine Geschichte von vernetzten Chats',
      skip: 'Inhalt überspringen',
      brandLabel: 'NCF Agent Interconnect — zum Seitenanfang',
      navLabel: 'Hauptnavigation',
      languageLabel: 'Sprache',
      languageMenuTitle: 'Wählen Sie eine Sprache',
      closeLanguageMenu: 'Sprachauswahl schließen',
      navStory: 'Die Geschichte',
      navGuide: 'Feldführer',
      navStart: 'Beginnen Sie.',
      galleryPageTitle: 'Bildarchiv – NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — zurück zur Geschichte',
      galleryNavLabel: 'Bild-Archiv-Navigation',
      galleryBack: 'Zurück zur Geschichte',
      galleryEyebrow: 'Bildarchiv',
      galleryTitle: 'Jede ursprüngliche Illustration',
      galleryIntro:
        'Alle Bilder verbleiben in diesem Prototyp, einschließlich derer, die im Comic nicht mehr in voller Größe verwendet werden. Jede Bildunterschrift entspricht dem Dateinamen des Assets.',
      galleryDeveloper: 'Entwickler',
      galleryAgents: 'Agententabletten',
      galleryBrand: 'Markenvermögen',
      galleryHeroAlt: 'Entwickler am Schreibtisch, Heldenillustration',
      gallerySceneAlt: 'Entwickler am Schreibtisch, Szene {number}',
      galleryReadingAlt: 'Entwickler liest das NCF Agent Interconnect-Buch, Szene 13',
      galleryAgentAlt: 'Tablet-Porträt des Agenten {name}',
      galleryIconAlt: 'NCF Agent Interconnect-App-Ikon',
      heroEyebrow: 'Eine Geschichte aus Ihren alltäglichen KI-Chats',
      heroTitle: 'Ein Entwickler.<br /><em>Viele aktive Chats.</em>',
      heroLede:
        'Verfolgen Sie einen Fehler, eine neue Funktion und die Agenten, die wichtige Details austauschen. Sie geben die Richtung vor; NCF Agent Interconnect leitet Nachrichten und freigegebene Dateien an den richtigen Chat weiter.',
      download: 'Laden Sie die App herunter',
      readStory: 'Lesen Sie die Geschichte.',
      storyEyebrow: 'Die Geschichte eines Entwicklers',
      storyTitle: 'Agenten arbeiten zusammen',
      storyLede:
        'Eine Person pflegt eine App über vertraute KI-Chats. Agent Morgan koordiniert in OpenCode auf einem Mac; Agent Jade überprüft Windows in Codex, und Agent Sam behebt den Fehler in Cursor auf dem Mac. Sie wählen die Namen der Agenten aus. Die Rollen, Fähigkeiten und Werkzeuge in dieser Geschichte sind Beispiele; NCF Agent Interconnect stellt sie nicht bereit.',
      guideEyebrow: 'Halten Sie die beweglichen Teile frei',
      guideTitle: 'Die Arbeit läuft in den Chats. Die App übermittelt die Nachrichten.',
      startEyebrow: 'Beginnen Sie mit zwei Chats.',
      startTitle: 'Gib ihnen Namen. Schicke eine Nachricht.',
      startLede:
        'Installieren Sie die Desktop-App, konfigurieren Sie die KI-Anwendungen, die Sie verwenden, verbinden Sie zwei Chats unter verschiedenen Namen und bitten Sie einen Agenten, den anderen zu kontaktieren.',
      setupGuide: 'Öffnen Sie die Einrichtungsanleitung',
      downloadNote:
        'Installer: Apple Silicon Mac DMG, Intel Mac DMG und Windows x64 EXE. macOS 13 oder höher. Intel-Laufzeit wurde nicht auf Intel-Hardware getestet; kein Linux-Installer wurde veröffentlicht.',
      footerTagline: 'Nachrichten zwischen Agenten in Ihren bestehenden KI-Chats.',
      usageGuide: 'Benutzerleitfaden',
      license: 'Lizenz',
      systemNote: 'Anmerkung',
      exampleExchange: 'Chat',
      activityLabel: 'Illustrative Tätigkeit',
      reader: 'Solange andere Chats funktionieren, kannst du dich zurückziehen.',
      developerAlt:
        'Der Entwickler bleibt weiterhin an einem Schreibtisch sitzen mit einem sichtbaren Computer.',
      readingAlt: 'Der Entwickler liest ein Buch über NCF Agent Interconnect am Schreibtisch.',
      agentAlt:
        'Kopfporträt von {name} in einem vorderseitig ausgerichteten Tablet mit Werkzeugikonen.',
      names: {
        user: 'Du',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Richtet eure Chats ein.',
        'Installieren Sie NCF Agent Interconnect, wählen Sie die gewünschte Clientkonfiguration aus, klicken Sie auf Apply, stellen Sie die Verbindung zu MCP erneut her und testen Sie einen Austausch.',
        'Einrichtungsanleitung',
      ],
      [
        'Kennen Sie Ihren Kunden.',
        'OpenCode, Codex und Cursor weisen unterschiedliches Lieferverhalten und unterschiedliche Einrichtungsanforderungen auf.',
        'Kundendaten',
      ],
      [
        'Kontrollieren Sie Ihre Daten',
        'Überprüfen Sie Dateien, lokale Geschichte, genaue Chatbindungen, Namensübertragungen und Löschungsumfang.',
        'Desktop-Steuerungen',
      ],
      [
        'Lesen Sie den vollständigen Verweis',
        'Der Benutzerleitfaden und die LLM-orientierte Referenz enthalten die vollständigen Verfahren und Grenzen hinter dieser illustrierten Geschichte.',
        'Lesen Sie llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Weisen Sie der Arbeit einen Koordinator zu',
        lines: [
          'Verbinden Sie sich als Agent Morgan. Verwenden Sie die Koordinationsfähigkeit, um alle Agenten zu koordinieren und die Arbeit insgesamt zu verfolgen. Senden Sie jedem Teilnehmer Ihre Arbeitsregeln. Koordinieren Sie Arbeitsgrenzen, Git-Branches, die Reihenfolge der Umsetzung und Integration sowie die Konfliktlösung. Stellen Sie Agenten in Kontakt, wenn ihre Arbeit sich überschneidet, organisieren Sie den Wissensaustausch und halten Sie sie über relevante Entscheidungen und Änderungen informiert. Führen Sie unabhängige Aufgaben parallel voran. Bringen Sie mir zusammengefasste Ergebnisse und Entscheidungen mit, die meinen Beitrag benötigen.',
          'Als Agentin Morgan verbunden. Ich koordiniere die Agenten, verfolge ihre Arbeit und stelle Ihnen Ergebnisse sowie Entscheidungen zur Verfügung, die Ihre Eingabe erfordern.',
        ],
        statuses: ['Erstellung von Koordinierungsregeln'],
      },
      {
        title: 'Verbinden Sie den Windows-Spezialisten',
        lines: [
          'Verbinden Sie sich als Agent Jade. Sie sind für die Überprüfung dieses Projekts unter Windows verantwortlich. Morgan koordiniert die Arbeit; bitten Sie sie um Anweisungen.',
          'Als Agentin Jade verbunden. Ich bin für die Überprüfung von Windows zuständig. Ich werde Morgan meine Rolle mitteilen und um Anweisungen bitten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Morgan erfährt, wer für Windows zuständig ist.',
        lines: [
          'Verbunden als Agent Jade. Ich übernehme die Projektüberprüfung unter Windows und bin bereit für Ihre Anweisungen.',
          'Verstanden. Ich werde Ihnen die Windows-Tests übertragen und die Ergebnisse koordinieren.',
        ],
        statuses: ['Hinzufügen von Jade zum Windows-Verifizierungsplan'],
      },
      {
        title: 'Eine unabhängige Prüfung zur Regel machen',
        lines: [
          'Senden Sie jede als abgeschlossen gemeldete Aufgabe an einen anderen Agenten zur unabhängigen Prüfung unter Verwendung von Tests, die dem Ergebnis angemessen sind. Nennen Sie den Agenten, der die Arbeit durchgeführt hat, und bitten Sie den Tester, die Koordination etwaiger Korrekturen direkt mit ihm vorzunehmen. Der Tester muss Ihnen die Tests, das Ergebnis und verbleibende Probleme melden. Akzeptieren Sie die Aufgabe erst, nachdem der Tester bestätigt hat, dass sie bestanden hat.',
          'Ich verstehe. Ich werde jede als abgeschlossen gemeldete Aufgabe an einen anderen Agenten zur unabhängigen Prüfung weiterleiten.',
        ],
        statuses: ['Festlegung der unabhängigen Überprüfungsregel'],
      },
      {
        title: 'Verbinden Sie einen Implementierungsagenten',
        lines: [
          'Verbinden Sie sich als Agent Leo. Ihre Rolle ist die Umsetzung. Morgan koordiniert die Arbeit; bitten Sie sie um Anweisungen.',
          'Als Agent Leo verbunden. Ich übernehme die Umsetzung. Ich werde Morgan meine Rolle erklären und um eine Zuweisung bitten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Beschreiben Sie die Funktion für Morgan',
        lines: [
          'Aufgabe #T-1042 ist gespeicherte Filter, mit denen Benutzer ihre Suchbedingungen wiederverwenden können. Organisieren Sie die Umsetzung, während die anderen Arbeiten fortgesetzt werden.',
          'Leo wird #T-1042 in seinem eigenen Chat implementieren. Ich werde die Arbeit verfolgen und eine unabhängige Überprüfung anordnen, wenn er sie als abgeschlossen meldet.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Leo erhält die Funktion',
        lines: [
          'Verwenden Sie die Implementierungskompetenz für die Aufgabe #T-1042: Erstellen Sie gespeicherte Filter, damit Benutzer ihre Suchbedingungen wiederverwenden können. Halten Sie diese Arbeit getrennt von anderen Aufgaben und melden Sie mir Ihr Ergebnis.',
          'Ich nehme #T-1042 und prüfe zuerst, wie die Suchbedingungen derzeit funktionieren.',
        ],
        statuses: [
          'Überprüfung der aktuellen Suchimplementierung',
          'Planung des Verhaltens gespeicherter Filter',
        ],
      },
      {
        title: 'Verbinden Sie einen Analyse-Agenten',
        lines: [
          'Verbinden Sie sich als Agent Alice. Ihre Rolle ist die Analyse. Morgan koordiniert die Arbeit; bitten Sie sie um Anweisungen.',
          'Als Agentin Alice verbunden. Ich übernehme die Anfrageanalyse. Ich werde Morgan meine Rolle mitteilen und um Anweisungen bitten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Die entsprechenden Anfragen an Morgan weiterleiten',
        lines: [
          'Anfragen #I-0201 und #I-0202 können dieselbe Anforderung beschreiben. Finden Sie das zugrunde liegende Benutzerproblem, überprüfen Sie den vorhandenen Suchbildschirm in Figma und verknüpfen Sie das Ergebnis mit #T-1042.',
          'Alice analysiert sowohl die Anfragen als auch den Figma-Bildschirm. Ich werde sie mit Leo verbinden, damit die Erkenntnis die Arbeit am gespeicherten Filter erreicht.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Alice untersucht die Notwendigkeit',
        lines: [
          'Verwenden Sie die Analyse-Fähigkeit, um die Probleme #I-0201 und #I-0202 zu prüfen. Prüfen Sie den vorhandenen Suchbildschirm in Figma, identifizieren Sie den zugrunde liegenden Benutzerbedarf und teilen Sie relevante Erkenntnisse mit Leo.',
          'Ich vergleiche beide Anfragen mit dem aktuellen Bildschirm, danach sende ich Leo die Erkenntnis.',
        ],
        statuses: ['Beide Anfragen werden gelesen', 'Überprüfung des Suchbildschirms in Figma'],
      },
      {
        title: 'Lassen Sie die Entdeckung den Arbeitschat erreichen.',
        lines: [
          'Die Fragen #I-0201 und #I-0202 beziehen sich auf die Wiederverwendung der gleichen Suchbedingungen. Kann die Aufgabe #T-1042 die vollständige Kombination beibehalten?',
          '- Ja, ich weiß. Prüfen Sie, ob Benutzer sie auch teilen müssen; ich werde das von der Aufgabe #T-1042 getrennt halten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Ein Windows-Bug ändert den Plan',
        lines: [
          'Import fehlschlägt auf Windows. Ich füge die Importdatei an, die den Fehler #B-0317 auslöst. Untersuchen Sie das Problem und melden Sie, was Sie finden.',
          'Jade wird #B-0317 auf Windows reproduzieren und mir die Schritte und Beweise schicken. Wenn der Fehler bestätigt wird, organisiere ich die Reparatur und eine unabhängige Überprüfung.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Jade führt die Windows-Abfrage durch',
        lines: [
          'Verwenden Sie die Verifizierungskompetenz, um Bug #B-0317 auf Windows mit der beigefügten Importdatei zu reproduzieren. Schicken Sie mir die Reproduktionsschritte und Beweise.',
          'Ich überprüfe den Import und sende Ihnen das Ergebnis.',
        ],
        statuses: ['Öffnen der Importdatei', 'Überprüfung des Imports unter Windows'],
      },
      {
        title: 'Beweise erreichen den Koordinator',
        lines: [
          'Die Windows-Importe scheitern. Hier sind die Reproduktionsschritte und Beweise für #B-0317.',
          'Erhalten. Ich werde das Ergebnis melden und die Beweise für den Fix-Owner aufbewahren.',
        ],
        statuses: ['Vorbereitung des Fehlerberichts'],
      },
      {
        title: 'Verbinden Sie einen weiteren Entwickler',
        lines: [
          'Verbinden Sie sich als Agent Sam. Ihre Rolle ist die Umsetzung. Morgan koordiniert die Arbeit; bitten Sie sie um Anweisungen.',
          'Als Agent Sam verbunden. Ich übernehme die Umsetzung. Ich werde Morgan meine Rolle erklären und um eine Zuweisung bitten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Das Ergebnis ändert die Priorität',
        lines: [
          'Jade reproduzierte #B-0317 auf Windows und schickte die Schritte und Beweise. Das Importfehler wird bestätigt.',
          'Dieser Bug blockiert die tägliche Arbeit. Freigeben Sie zuerst die Lösung für #B-0317. Wenn die Aufgabe #T-1042 nicht fertig ist, kann sie in der nächsten Veröffentlichung folgen. Halten Sie die Arbeit voran.',
          'Ich verstehe. Sam wird #B-0317 beheben, und Jade wird es unabhängig von Windows prüfen. Ich werde #T-1042 separat weiterleiten.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Sam erhält die Fehlerbehebung',
        lines: [
          'Verwenden Sie die Implementierungskompetenz, um den Fehler #B-0317 zu beheben. Jade hat ihn auf Windows reproduziert; hier sind ihre Schritte und Beweise. Halten Sie die Korrektur getrennt von #T-1042 und koordinieren Sie alle Verifizierungsdetails direkt mit Jade.',
          'Ich werde #B-0317 untersuchen, die Lösung vorbereiten und einen Kandidaten für unabhängige Tests senden.',
        ],
        statuses: ['Überprüfung der Reproduktionsschritte', 'Überprüfung des Importcodes'],
      },
      {
        title: 'Erinnerung an eine frühere Untersuchung',
        lines: [
          'Eine frühere Einfuhruntersuchung in der Aufgabe #T-0870 kann bei #B-0317 helfen. Finden Sie die vorherigen Entscheidungen und alle relevanten Beispiele.',
          'Oscar arbeitete an #T-0870. Ich werde ihn um die Entscheidungen und Beispiele bitten und sie dann mit Sam und Jade teilen.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Morgan bittet um frühere Kenntnisse',
        lines: [
          'Sie haben den Import in der Aufgabe #T-0870 untersucht. Bitte finden Sie die bisherigen Entscheidungen und alle relevanten Beispiele für Bug #B-0317, dann teilen Sie sie mit Sam und Jade.',
          'Ich werde die verfügbaren Historien und Materialien überprüfen und dann die entsprechenden Beispiele senden.',
        ],
        statuses: ['Überprüfungsaufgabe #T-0870'],
      },
      {
        title: 'Frühere Entscheidungen erreichen den Entwickler',
        lines: [
          'Ich habe die früheren Importentscheidungen und Beispiele gefunden. Ich sende sie Ihnen.',
          'Erhalten. Ich werde sie in der Behebung verwenden.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Die gleichen Beispiele erreichen den Tester.',
        lines: [
          'Die gleichen Importbeispiele können Ihrer Windows-Überprüfung helfen. Ich sende sie weiter.',
          'Verstanden. Ich werde sie in die Tests einbeziehen.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Inzwischen läuft die Arbeit weiter.',
        lines: [],
        statuses: [],
      },
      {
        title: 'Der erste Kandidat ist bereit.',
        lines: [
          'Fehler #B-0317 ist behoben. Hier ist der Kandidat für unabhängige Tests.',
          'Erhalten. Ich werde Jade bitten, einen unabhängigen Windows-Check durchzuführen.',
        ],
        statuses: ['Ich verwende NCF Agent Interconnect', 'Nachricht gesendet'],
      },
      {
        title: 'Ein anderer Agent testet es.',
        lines: [
          'Testen Sie den Kandidaten für Bug #B-0317 auf Windows. Sam hat es implementiert. Verwenden Sie die Verifizierungskompetenz und arbeiten Sie direkt mit Sam bei Fehlern. Schicken Sie mir Ihr eigenes Test-Ergebnis, wenn die Tests passieren, oder melden Sie einen Blocker.',
          'Ich werde es auf Windows testen und direkt mit Sam arbeiten, wenn ich einen Defekt finde.',
        ],
        statuses: ['Überprüfung des Kandidaten-Fixes', 'Test der Importfunktion unter Windows'],
      },
      {
        title: 'Ein zweiter Fall schlägt fehl.',
        lines: [
          'Fehler #B-0317: Die ursprüngliche Datei wird importiert, aber der Sample von Oscar erzeugt eine doppelte Zeile. Bitte reparieren Sie den Fall.',
          'Ich werde den Fall der duplizierten Zeilen beheben und einen überarbeiteten Kandidaten senden.',
        ],
        statuses: ['Wiederholung der doppelten Zeile'],
      },
      {
        title: 'Fehler beheben, dann erneut testen.',
        lines: [
          'Der Fall mit doppelten Zeilen ist behoben. Hier ist der überarbeitete Kandidat. Bitte führen Sie diesen Fall und den ursprünglichen Import erneut aus.',
          'Ich werde sowohl die Imports als auch die bestehenden Regressionchecks erneut ausführen.',
        ],
        statuses: [
          'Wiederaufnahme beider Importbeispiele',
          'Durchführung bestehender Regressionstests',
        ],
      },
      {
        title: 'Das unabhängige Ergebnis ist eingetroffen',
        lines: [
          'Der Fehler #B-0317 wurde auf Windows mit dem überarbeiteten Kandidaten von Sam getestet. Beide Importbeispiele wurden erfolgreich überprüft, einschließlich der vorhandenen Importregressionskontrollen. Im getesteten Umfang bleiben keine Probleme.',
          'Erhalten. Ich werde den akzeptierten Fix in den Releasevorschlag aufnehmen.',
        ],
        statuses: ['Vorbereitung des Freigabevorschlags'],
      },
      {
        title: 'Sie entscheiden, was veröffentlicht wird',
        lines: [
          'Zusammenfassung von Fehler #B-0317, Aufgabe #T-1042 und Problemen #I-0201 und #I-0202. Für jeden davon: Teile mir den aktuellen Stand, was als Nächstes kommt und welche Entscheidung ich von dir benötige.',
          'Ich erstelle für jedes Element einen Status und markiere die Entscheidungen, die Sie treffen müssen.',
        ],
        statuses: ['Die Zusammenstellung der Ergebnisse für alle vier Artikel'],
      },
    ],
    notes: [
      {
        html: '<p>Sie pflegen eine wachsende Anwendung eigenständig. Fehlerberichte treffen ein, während Sie eine Roadmap-Funktion implementieren, und auch neue Benutzeranfragen erfordern Ihre Aufmerksamkeit. NCF Agent Interconnect ermöglicht es den KI-Agenten in Ihren üblichen Chats, diese Aufgaben gemeinsam zu bearbeiten. Fragen, Erkenntnisse und Dateien werden direkt zwischen ihnen ausgetauscht; Sie legen die Richtung fest und erhalten die Ergebnisse in Ihrem Arbeitschat.</p><p>Dieser Leitfaden begleitet einen Entwickler durch diese Situation. Sie sind die einzige menschliche Person in der Geschichte; alle benannten Teilnehmer sind KI-Agenten. Ihre Namen und Rollen dienen als Beispiele, die Sie durch eigene ersetzen können.</p><p>Wählen Sie einen der <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 vorbereiteten Prompts</a> und geben Sie ihn Ihrem Modell. Es erstellt in Ihrer Sprache eine ausführliche Anleitung zum gewählten Beispiel auf Grundlage der NCF-Dokumentation.</p>',
      },
      {
        html: '<h3>Bereiten Sie Ihre Anwendungen und Chats vor</h3><p>Richten Sie jede Anwendung oder jedes Profil einmal ein. Neue Chats schließen sich anschließend an, indem sie sich unter von Ihnen gewählten Namen verbinden.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">Einrichtungsanleitung</a></p>',
      },
      {
        html: '<h3>Arbeiten Sie in Ihren üblichen Chats</h3><p>In dieser Geschichte arbeiten Sie auf einem Mac und halten einen Windows-Computer bereit, um die Anwendung zu überprüfen, die Ihre Benutzer ausführen. Sie nutzen bereits mehrere KI-Dienste, wählen Modelle, die Ihrer Arbeit entsprechen, und optimieren die Kosten.</p><p>KI-Agent Morgan koordiniert in OpenCode. Andere Teilnehmer haben ihre eigenen Chats; die Windows-Tests finden in Codex statt. Ein neuer Teilnehmer könnte sich später in Cursor oder einer anderen konfigurierten Anwendung anschließen.</p><p>Nach der Erstkonfiguration geben Sie jedem beteiligten Chat einen Namen. Legen Sie in Ihrem Hauptchat die Koordinationsregeln fest. Jade hat Morgan nun ihre Windows-Verifizierungsrolle mitgeteilt; Sie können später die Arbeit über den Koordinationschat steuern.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">Einrichtungsanleitung</a></p>',
      },
      {
        html: '<p>Geben Sie dem AI-Koordinator eine separate Regel für die Akzeptanz abgeschlossener Arbeit. Der AI-Koordinator sendet Arbeitsanweisungen an die Teilnehmer, sobald diese beitreten, und verfolgt den Fortschritt über alle Aufgaben hinweg. Wenn Sie einen Teilnehmer verbinden, weisen Sie diesem Chat einen Namen und eine Rolle zu; Morgan weist die Arbeit zu, nachdem der Agent die Rolle gemeldet hat.</p>',
      },
      {
        html: '<p>Der KI-Agent Leo ist für das Feature verantwortlich. Der KI-Koordinator verfolgt seinen Fortschritt.</p>',
      },
      {
        html: '<h3>Lassen Sie die Ergebnisse in die AI-Gespräche gelangen, die für die Arbeit verwendet werden.</h3>\n        <p>Später treffen zwei verwandte Benutzeranfragen ein. Sie öffnen einen weiteren Analyse-Chat; Morgan weist Alice die Anfragen zu und verbindet sie mit dem Eigentümer der Funktion. Der KI-Agent Alice stellt fest, dass beide Anfragen dasselbe Bedürfnis beschreiben: Benutzer erstellen täglich identische Suchbedingungen. Sie sendet die Erkenntnis direkt an den Chat, in dem die gespeicherte-Filter-Funktion entwickelt wird.</p>',
      },
      {
        html: '<p>Fragen, Ergänzungen und Ergebnisse gelangen in den passenden Arbeitschat. Die Agenten nutzen weiterhin die Werkzeuge und Anweisungen ihrer eigenen Umgebung. Einzelheiten stehen im <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">Leitfaden für Anwendungen</a>.</p>',
      },
      {
        html: '<h3>Untersuchen Sie den Windows-Bug</h3>\n        <p>Ein Benutzer meldet, dass der Import unter Windows fehlschlägt. Die Funktion und Anfrageanalyse verfügt bereits über eigene Teilnehmer. Jades Windows-Chat ist verbunden, daher bittet Morgan sie, den Fehler dort zu reproduzieren.</p>',
      },
      {
        html: '<p>Der KI-Agent Jade, der Tester, reproduziert die Störung und sendet die Beweise direkt an den Koordinationschat. Der Benutzer bestätigt, dass das Problem die tägliche Arbeit blockiert. Sie teilen dem KI-Agent Morgan mit, wie sich dies auf die Release-Priorität auswirkt.</p>',
      },
      {
        html: '<p>Sie können das Team erweitern, während die Funktion weiterläuft. Der AI-Agent Morgan teilt die Reproduktion, vereinbart die Arbeitsgrenzen und organisiert die Verifizierung unter Windows. Der AI-Koordinator hält die Änderungen getrennt, damit der Fix zuerst freigegeben werden kann. Der AI-Agent Sam übernimmt den Fix, während Jade das Verhalten des Fixes unter Windows überprüft. Gespeicherte Filter und Anfrageanalysen werden in ihren ursprünglichen Chats fortgesetzt. Sie haben die Freigabereihenfolge geändert und Kapazität hinzugefügt, während die Arbeit im Gange ist.</p>',
      },
      {
        html: '<h3>Früheres Wissen wieder in die Aufgabe einbringen</h3><p>Sie erinnern sich, dass ein älterer Chat eine Untersuchung des Importverhaltens enthält. Der AI-Agent Oscar kann die Geschichte und die noch verfügbaren Materialien überprüfen, frühere Entscheidungen erklären und Beispiele bereitstellen. Der AI-Entwickler wendet dieses Wissen auf die Behebung an. Der AI-Tester verwendet die Beispiele, wenn er die Korrektur gegen die aktuelle Implementierung überprüft.</p>',
      },
      {
        html: '<h3>Dateien, Antworten und Verlauf</h3><p>Nachrichtenverlauf und Kopien von Anhängen werden lokal auf den Computern der Beteiligten gespeichert. Wie Speicherung und Dateiübertragung funktionieren, erklärt der <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">Datenleitfaden</a>; der <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">Leitfaden zur Desktop-App</a> beschreibt den Wechsel in einen anderen Chat.</p>',
      },
      {
        html: '<h3>Lassen Sie Tests und Fehlerbehebungen zwischen Agenten stattfinden</h3>\n        <p>In diesem Beispiel arbeitet der KI-Agent Sam in Cursor auf dem Mac, während Jade in Codex auf Windows testet. Der KI-Koordinator erhält den Abschlussbericht in OpenCode und weist die unabhängige Prüfung zu. Die nächsten Austausche zeigen, wie die Agenten zusammenarbeiten.</p>',
      },
      {
        html: '<h3>Verwaltung, wenn Sie sie benötigen</h3><p>Deine gewöhnliche Arbeit bleibt in den AI-Chats. Die Desktop-App bietet die folgenden Steuerungsoptionen, wenn du eine Verbindung überprüfen oder gespeicherte Daten verwalten musst.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">Einrichtungsanleitung</a></p>',
      },
      {
        html: '<p>Agenten tauschen über NCF Agent Interconnect Nachrichten aus und bleiben dabei in ihren Arbeitschats. Die Einrichtung der einzelnen Anwendungen erklärt der <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">Anwendungsleitfaden</a>.</p>',
      },
      {
        html: '<p>In der Desktop-App können Sie den Verlauf eines Agenten einsehen und seine lokalen Daten bei Bedarf löschen. Den Umfang erklärt die <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">Anleitung zur Agentenverwaltung</a>.</p>',
      },
      {
        html: '<p>KI-Agent Jade berichtet direkt an Morgan. KI-Agenten Sam und Jade bearbeiten routinemäßige Erkenntnisse gemeinsam, während andere Aufgaben weiterlaufen. Sie können im Koordinationschat jederzeit Kontext hinzufügen oder das Ziel anpassen, wenn sich etwas ändert; Sie müssen nicht jede Korrektur weiterleiten oder jeden erneuten Test genehmigen.</p>',
      },
      {
        html: '<h3>Überprüfen Sie eine Verbindung, wenn ein Austausch beendet wird.</h3><p>Wenn der Austausch stockt, prüfen Sie, ob NCF Agent Interconnect läuft und der richtige Chat verbunden ist. Weitere Schritte finden Sie in der <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">Einrichtungsanleitung</a>.</p>',
      },
      {
        html: '<h3>Ergebnisse prüfen und über die Veröffentlichung entscheiden</h3><p>Vor der Veröffentlichung liefert Ihnen der KI-Agent Morgan einen Bericht zum Ergebnis: Was sich geändert hat, was auf Windows geprüft wurde, was offen bleibt und was für die Freigabe vorgeschlagen ist. Sie bewerten, ob dies das Problem des Benutzers löst, und entscheiden, was freigegeben wird. Gespeicherte Filter werden weiterhin zu ihrem jeweiligen Ergebnis weitergeführt.</p>',
      },
    ],
  },
  it: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Una storia di chat collegate',
      skip: 'Salta al contenuto',
      brandLabel: 'NCF Agent Interconnect — torna all’inizio della pagina',
      navLabel: 'Navigazione principale',
      languageLabel: 'Lingua',
      languageMenuTitle: 'Seleziona una lingua',
      closeLanguageMenu: 'Chiudi la selezione della lingua',
      navStory: 'La storia',
      navGuide: 'Guida di campo',
      navStart: 'Inizia.',
      galleryPageTitle: 'Archivio immagini — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — torna alla storia',
      galleryNavLabel: 'Navigazione archivio immagini',
      galleryBack: 'Torna alla storia',
      galleryEyebrow: 'Archivio immagini',
      galleryTitle: 'Ogni illustrazione originale',
      galleryIntro:
        "Tutte le immagini rimangono in questo prototipo, comprese quelle che non sono più utilizzate a grandezza naturale nel fumetto. Ogni didascalia è il nome del file dell'asset.",
      galleryDeveloper: 'Sviluppatore',
      galleryAgents: 'Tablet degli agenti',
      galleryBrand: 'Asset di marchio',
      galleryHeroAlt: 'Sviluppatore alla scrivania, illustrazione del protagonista',
      gallerySceneAlt: 'Sviluppatore alla scrivania, scena {number}',
      galleryReadingAlt: 'Sviluppatore che legge il libro NCF Agent Interconnect, scena 13',
      galleryAgentAlt: "Il ritratto della tablet dell'agente {name}",
      galleryIconAlt: "Icona dell'app NCF Agent Interconnect",
      heroEyebrow: "Una storia dai vostri scambi quotidiani con l'IA",
      heroTitle: 'Uno sviluppatore.<br /><em>Tante chat al lavoro.</em>',
      heroLede:
        'Segui un bug, una nuova funzionalità e gli agenti che si scambiano informazioni utili. Tu stabilisci la direzione; NCF Agent Interconnect recapita messaggi e file autorizzati alla chat giusta.',
      download: "Scarica l'app",
      readStory: 'Leggi la storia.',
      storyEyebrow: 'Storia di uno sviluppatore',
      storyTitle: 'Gli agenti lavorano insieme',
      storyLede:
        "Una persona mantiene un'app attraverso chat AI familiari. L'agente Morgan coordina in OpenCode su un Mac; l'agente Jade verifica Windows in Codex, e l'agente Sam risolve il bug in Cursor su un Mac. Tu scegli i nomi degli agenti. I ruoli, le competenze e gli strumenti in questa storia sono esempi; NCF Agent Interconnect non li fornisce.",
      guideEyebrow: 'Mantieni le parti in movimento libere da ostacoli',
      guideTitle: 'Il lavoro avviene nelle chat. L’app trasmette i messaggi.',
      startEyebrow: 'Inizia con due chat',
      startTitle: 'Dategli dei nomi. Invia un messaggio.',
      startLede:
        "Installa l'app desktop, configura le applicazioni AI che usi, collega due chat con nomi diversi e chiedi a un agente di contattare l'altro.",
      setupGuide: 'Apri la guida di configurazione',
      downloadNote:
        'Installazioni: Apple Silicon Mac DMG, Intel Mac DMG e Windows x64 EXE. macOS 13 o successivi. Il runtime Intel non è stato testato su hardware Intel; nessun installatore Linux è stato pubblicato.',
      footerTagline: 'Messaggi tra agenti nelle chat AI esistenti.',
      usageGuide: 'Guida utente',
      license: 'Licenza',
      systemNote: 'Nota',
      exampleExchange: 'Chat',
      activityLabel: 'Attività illustrativa',
      reader: 'Mentre altre chat funzionano, puoi allontanarti.',
      developerAlt: 'Lo sviluppatore rimane seduto a una scrivania con un computer visibile.',
      readingAlt: 'Lo sviluppatore legge un libro su NCF Agent Interconnect alla scrivania.',
      agentAlt:
        "Ritratto di testa di {name} all'interno di un tablet frontale con icone degli strumenti.",
      names: {
        user: 'Tu...',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Configura i tuoi chat',
        'Installa NCF Agent Interconnect, seleziona la configurazione client prevista, fai clic su Apply, riconnetti MCP e testa uno scambio.',
        'Guida per il setup',
      ],
      [
        'Conosci il tuo cliente',
        'OpenCode, Codex e Cursor presentano comportamenti di consegna e requisiti di configurazione diversi.',
        'Dettagli del cliente',
      ],
      [
        'Gestisci i tuoi dati',
        'Verifica file, cronologia locale, collegamenti esatti alle chat, trasferimenti di nomi e ambito di cancellazione.',
        'Controlli desktop',
      ],
      [
        'Leggi il riferimento completo',
        "La guida dell'utente e il riferimento orientato alla LLM contengono le procedure complete e i limiti relativi a questa storia illustrata.",
        'Leggi llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Assegna al lavoro un coordinatore',
        lines: [
          "Connettiti come agente Morgan. Utilizza la competenza di coordinamento per coordinare tutti gli agenti e tenere traccia del lavoro nel suo complesso. Invia a ciascun partecipante le tue regole di lavoro. Coordinare i confini del lavoro, i branch di Git, l'ordine di implementazione e di integrazione, e la risoluzione dei conflitti. Metti in contatto gli agenti quando il loro lavoro si sovrappone, organizza la condivisione delle conoscenze e tienili aggiornati sulle decisioni e sui cambiamenti rilevanti. Mantieni in movimento in parallelo le attività indipendenti. Forniscimi risultati consolidati e decisioni su cui devo decidere.",
          'Connessa come agente Morgan. Coordinerò gli agenti, seguirò il loro lavoro e ti porterò i risultati e le decisioni che richiedono il tuo intervento.',
        ],
        statuses: ['Preparazione delle regole di coordinamento'],
      },
      {
        title: 'Collegare lo specialista Windows',
        lines: [
          'Collegarsi come agente Jade. Lei è responsabile della verifica di questo progetto su Windows. Morgan coordina il lavoro; chiedile istruzioni.',
          'Connessa come agente Jade. Sono responsabile della verifica di Windows. Informerò Morgan del mio ruolo e chiederò istruzioni.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Morgan scopre chi si occupa di Windows',
        lines: [
          'Connesso come agente Jade. Mi occupo della verifica del progetto su Windows e sono pronto per le tue istruzioni.',
          'Ricevuto. Ti affiderò le verifiche su Windows e coordinerò i risultati.',
        ],
        statuses: ['Aggiunta di Jade al piano di verifica Windows'],
      },
      {
        title: 'Rendere la verifica indipendente una regola',
        lines: [
          "Invia ogni compito segnalato come completato a un altro agente per un test indipendente, utilizzando controlli appropriati al risultato. Indica l'agente che ha svolto il lavoro e chiedi al tester di coordinare eventuali correzioni direttamente con lui. Il tester deve segnalare i controlli, l'esito e gli eventuali problemi residui. Accetta il compito solo dopo che il tester ha confermato il superamento.",
          'Ho capito. Invierò ogni compito segnalato come completato a un altro agente per test indipendenti.',
        ],
        statuses: ['Impostazione della regola di controllo indipendente'],
      },
      {
        title: 'Collegare un agente di implementazione',
        lines: [
          "Collegati come agente Leo. Il tuo ruolo è l'implementazione. Morgan coordina il lavoro; chiedile istruzioni.",
          "Connesso come agente Leo. Mi occupo dell'implementazione. Farò sapere a Morgan il mio ruolo e chiederò un incarico.",
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Descrivere la funzione a Morgan',
        lines: [
          "Il compito #T-1042 è il salvataggio di filtri che consentono agli utenti di riutilizzare le loro condizioni di ricerca. Organizzare l'attuazione mentre l'altro lavoro continua.",
          "Leo implementerà #T-1042 nella propria chat. Seguirò il lavoro e organizzero' un controllo indipendente quando riferira' che e' completo.",
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Leo riceve la funzione',
        lines: [
          "Usa l'abilità di implementazione per il compito #T-1042: costruire filtri salvati in modo che gli utenti possano riutilizzare le loro condizioni di ricerca. Tenete questo lavoro separato dagli altri compiti e riportatemi il vostro risultato.",
          'Prenderò #T-1042 e prima controllerò come funzionano le condizioni di ricerca ora.',
        ],
        statuses: [
          "Revisione dell'attuale implementazione della ricerca",
          'Pianificazione del comportamento del filtro salvato',
        ],
      },
      {
        title: 'Collegare un agente di analisi',
        lines: [
          "Collegati come agente Alice. Il tuo ruolo è l'analisi. Morgan coordina il lavoro; chiedile istruzioni.",
          "Connessa come agente Alice. Mi occupo dell'analisi delle richieste. Informerò Morgan del mio ruolo e chiederò istruzioni.",
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Invio delle richieste correlate a Morgan',
        lines: [
          "Le richieste #I-0201 e #I-0202 possono descrivere lo stesso bisogno. Trova il problema dell'utente sottostante, controlla la schermata di ricerca esistente in Figma e collega il risultato a #T-1042.",
          'Alice analizzerà entrambe le richieste e lo schermo Figma. La metterò in contatto con Leo in modo che il risultato raggiunga il lavoro sul filtro salvato.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Alice investiga la necessità di',
        lines: [
          "Utilizzare l'abilità di analisi per rivedere i problemi #I-0201 e #I-0202. Controllare la schermata di ricerca esistente in Figma, identificare la necessità sottostante dell'utente e condividere i risultati pertinenti con Leo.",
          'Confronterò entrambe le richieste con lo schermo corrente, poi manderò a Leo il risultato.',
        ],
        statuses: ['Leggere entrambe le richieste', 'Verifica della schermata di ricerca in Figma'],
      },
      {
        title: 'Fate in modo che il risultato raggiunga la chat di lavoro',
        lines: [
          "Le questioni #I-0201 e #I-0202 riguardano il riutilizzo delle stesse condizioni di ricerca. La missione #T-1042 può preservare l'intera combinazione?",
          '- Sì, è vero. Controlla se gli utenti hanno anche bisogno di condividerli; lo terrò separato dal compito #T-1042.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Un bug Windows modifica il piano',
        lines: [
          'L’importazione non riesce su Windows. Allego il file che provoca il bug #B-0317. Esamina il problema e riferisci cosa scopri.',
          'Jade riprodurrà #B-0317 su Windows e mi manderà i passaggi e le prove. Se il bug viene confermato, organizzerò la correzione e un controllo indipendente.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Jade esegue i controlli sul bug Windows',
        lines: [
          'Utilizzare la capacità di verifica per riprodurre il bug #B-0317 su Windows con il file di importazione allegato. Mandami i passaggi di riproduzione e le prove.',
          "Controllerò l'import e ti manderò il risultato.",
        ],
        statuses: ['Aprire il file di importazione', "Verifica dell'importazione su Windows"],
      },
      {
        title: 'Le prove raggiungono il coordinatore',
        lines: [
          "L'importazione di Windows fallisce. Ecco i passaggi di riproduzione e le prove per #B-0317.",
          'Ricevuto. Riporterò il risultato e conserverò le prove per il proprietario del fix.',
        ],
        statuses: ['Preparazione del rapporto sul bug'],
      },
      {
        title: 'Collegare un altro sviluppatore',
        lines: [
          "Collegati come agente Sam. Il tuo ruolo è l'implementazione. Morgan coordina il lavoro; chiedile istruzioni.",
          "Connesso come agente Sam. Mi occupo dell'implementazione. Dirò a Morgan il mio ruolo e chiederò un incarico.",
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Il risultato modifica la priorità',
        lines: [
          "Jade ha riprodotto #B-0317 su Windows e ha inviato i passaggi e le prove. Il fallimento dell'importazione è confermato.",
          'Questo bug blocca il lavoro quotidiano. Prima rilascia la correzione per #B-0317. Se la missione #T-1042 non è pronta, può seguire nel prossimo rilascio. Continua a lavorare.',
          'Capito. Sam correggerà #B-0317 e Jade lo verificherà in modo indipendente su Windows. Nel frattempo, terrò separato il lavoro su #T-1042.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Sam riceve la correzione',
        lines: [
          "Utilizzare l'abilità di implementazione per risolvere il bug #B-0317. Jade lo ha riprodotto su Windows; ecco i suoi passi e le prove. Tenere la correzione separata da #T-1042 e coordinare i dettagli di verifica direttamente con Jade.",
          'Investigherò #B-0317, preparerò la correzione e manderò un candidato per test indipendenti.',
        ],
        statuses: [
          'Revisione dei passaggi per la riproduzione',
          'Verifica del codice di importazione',
        ],
      },
      {
        title: "Richiama un'indagine precedente",
        lines: [
          "Una precedente indagine sull'importazione nell'ambito del compito #T-0870 potrebbe aiutare con #B-0317. Trova le decisioni precedenti e gli esempi pertinenti.",
          'Oscar ha lavorato al #T-0870. Gli chiederò le decisioni e gli esempi, poi li condividerò con Sam e Jade.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Morgan chiede conoscenze precedenti',
        lines: [
          "Hai indagato sull'importazione nella missione #T-0870. Si prega di recuperare le decisioni precedenti e tutti gli esempi pertinenti al bug #B-0317, quindi condividerli con Sam e Jade.",
          'Rivisiterò la storia e i materiali disponibili, quindi invierò gli esempi pertinenti.',
        ],
        statuses: ['Compito di revisione #T-0870'],
      },
      {
        title: 'Le decisioni precedenti raggiungono lo sviluppatore',
        lines: [
          'Ho trovato le precedenti decisioni di importazione e gli esempi. Te li sto inviando.',
          'Ricevuto. Li utilizzerò nella correzione.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Gli stessi esempi raggiungono il tester',
        lines: [
          'Gli stessi esempi di importazione possono aiutare il controllo Windows. Li sto inviando.',
          'Ricevuto. Li includerò nei test.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Nel frattempo, il lavoro continua',
        lines: [],
        statuses: [],
      },
      {
        title: 'Il primo candidato è pronto',
        lines: [
          'Bug #B-0317 è riparato. Ecco il candidato a test indipendenti.',
          'Ricevuto. Chiederò a Jade un controllo indipendente su Windows.',
        ],
        statuses: ['Sto usando NCF Agent Interconnect', 'Messaggio inviato'],
      },
      {
        title: 'Un altro agente lo verifica.',
        lines: [
          'Testare il candidato per il bug #B-0317 su Windows. Sam lo ha implementato. Utilizzare la capacità di verifica e lavorare direttamente con Sam su eventuali difetti. Mandami il tuo risultato di test quando passano i controlli, o segnala un bloccatore.',
          'Lo testerò su Windows e collaborerò direttamente con Sam se riscontrerò un difetto.',
        ],
        statuses: ['Revisione della soluzione proposta', 'Test di importazione su Windows'],
      },
      {
        title: 'Un secondo caso fallisce.',
        lines: [
          'Bug #B-0317: il file originale viene importato, ma il campione di Oscar crea una fila duplicata. Per favore, risolvi quel caso.',
          'Correggerò il caso delle righe duplicate e invierò un candidato aggiornato.',
        ],
        statuses: ['Riproduzione della riga duplicata'],
      },
      {
        title: 'Correggi, quindi esegui nuovamente i test.',
        lines: [
          "Il caso della riga duplicata è risolto. Ecco il candidato aggiornato. Per favore, esegui nuovamente questo caso e l'importazione originale.",
          'Ripeterò sia gli import che i controlli di regressione esistenti.',
        ],
        statuses: [
          'Ri-esecuzione di entrambi i campioni di importazione',
          'Esecuzione dei test di regressione esistenti',
        ],
      },
      {
        title: 'Il risultato indipendente viene ricevuto',
        lines: [
          'Il bug #B-0317 è passato a Windows utilizzando il candidato rivisto di Sam. Entrambi i campioni di importazione sono stati approvati, insieme ai controlli di regressione delle importazioni esistenti. Non rimangono problemi nel campo di applicazione testato.',
          'Ricevuto. Includerò la correzione accettata nella proposta di rilascio.',
        ],
        statuses: ['Preparazione della proposta di rilascio'],
      },
      {
        title: 'Decidi tu cosa pubblicare',
        lines: [
          'Riassume il bug #B-0317, il compito #T-1042 e i problemi #I-0201 e #I-0202. Per ciascuno, dimmi il risultato finora, cosa viene dopo e qualunque decisione ti serve da me.',
          'Preparerò un aggiornamento per ciascun elemento e evidenzierò le decisioni che dovete prendere.',
        ],
        statuses: ['Compilazione dei risultati per tutti e quattro gli elementi'],
      },
    ],
    notes: [
      {
        html: '<p>Gestisci un\'applicazione in crescita da solo. Le segnalazioni di bug arrivano mentre sviluppi la funzionalità della road map, e anche le nuove richieste degli utenti necessitano attenzione. NCF Agent Interconnect consente agli agenti di IA nelle tue chat abituali di lavorare insieme a questi compiti. Domande, risultati e file viaggiano direttamente tra di loro; tu definisci la direzione e ricevi i risultati nella tua chat di lavoro.</p><p>Questa guida segue un sviluppatore attraverso questa situazione. Sei l\'unico essere umano nella storia; tutti i partecipanti nominati sono agenti di IA. I loro nomi e ruoli sono esempi che puoi sostituire con i tuoi.</p><p>Scegli uno dei <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 prompt pronti</a> e affidalo al tuo modello. Prepararà nella tua lingua una guida dettagliata all’esempio scelto, basata sulla documentazione NCF.</p>',
      },
      {
        html: '<h3>Preparati alle tue applicazioni e alle tue chat</h3><p>Configura ogni applicazione o profilo una volta. Le nuove chat si uniscono poi collegandosi con i nomi che scegli.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guida alla configurazione</a></p>',
      },
      {
        html: "<h3>Lavorate nei vostri soliti chat</h3><p>In questa storia lavori su un Mac e mantieni un computer Windows per verificare l'applicazione che gli utenti eseguono. Hai già a disposizione diversi servizi di AI, scegliendo i modelli più adatti al tuo lavoro e bilanciando i costi.</p><p>L'agente AI Morgan coordina in OpenCode. Altri partecipanti hanno le loro chat; i test Windows si svolgono in Codex. Un nuovo partecipante potrebbe successivamente unirsi a Cursor o a un'altra applicazione configurata.</p><p>Dopo la prima configurazione, assegnate a ciascun chat partecipante un nome. Nel vostro chat principale, stabilite le regole di coordinamento. Jade ha ora comunicato a Morgan il suo ruolo di verifica di Windows; è possibile indirizzare il lavoro successivo tramite la chat di coordinamento.</p><p><a href=\"https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md\">guida alla configurazione</a></p>",
      },
      {
        html: "<p>Assegna al coordinatore di IA una regola separata per l'accettazione del lavoro completato. Il coordinatore di IA invia le istruzioni operative ai partecipanti al momento dell'iscrizione e monitora il progresso su tutti i compiti. Quando si collega un partecipante, assegna a quella chat un nome e un ruolo; Morgan assegna il lavoro dopo che l'agente ha comunicato quel ruolo.</p>",
      },
      {
        html: "<p>L'agente AI Leo è responsabile della funzione. Il coordinatore dell'IA monitora il suo avanzamento.</p>",
      },
      {
        html: "<h3>Fate in modo che i risultati raggiungano le chat operative</h3>\n        <p>Più tardi arrivano due richieste utente correlate. Si apre un'altra chat di analisi; Morgan assegna a Alice le richieste e la mette in contatto con il proprietario della funzionalità. L'agente AI Alice scopre che entrambe le richieste descrivono la stessa esigenza: gli utenti riproducono ogni giorno le stesse condizioni di ricerca. Invia immediatamente il risultato alla chat in cui viene sviluppata la funzionalità di salvataggio del filtro.</p>",
      },
      {
        html: '<p>Domande, chiarimenti e risultati arrivano nella chat di lavoro pertinente. Ogni agente continua a usare gli strumenti e le istruzioni del proprio ambiente. Consulta la <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guida alle applicazioni</a>.</p>',
      },
      {
        html: "<h3>Investigare il bug Windows</h3>\n        <p>Un utente segnala che l'importazione non funziona su Windows. L'analisi della funzionalità e della richiesta ha già i propri partecipanti. La chat Windows di Jade è connessa, quindi Morgan le chiede di riprodurre il fallimento lì.</p>",
      },
      {
        html: "<p>L'agente AI Jade, il tester, riproduce il fallimento e invia le prove direttamente alla chat di coordinamento. L'utente conferma che il problema blocca il lavoro quotidiano. Comunica all'agente di IA Morgan come questo modifichi la priorità di rilascio.</p>",
      },
      {
        html: "<p>Puoi espandere la squadra mentre la funzionalità prosegue. L'agente AI Morgan condivide la riproduzione, definisce i confini del lavoro e organizza la verifica su Windows. Il coordinatore AI mantiene le modifiche separate in modo che la correzione possa essere rilasciata per prima. L'agente AI Sam è responsabile della correzione, mentre Jade verifica il suo comportamento su Windows. I filtri salvati e l'analisi delle richieste continuano nelle chat originali. Hai modificato l'ordine di rilascio e aggiunto capacità mentre il lavoro è in corso.</p>",
      },
      {
        html: "<h3>Riportare le conoscenze precedenti nell'attività</h3><p>Ricordi che una conversazione più antica contiene un'indagine sul comportamento di importazione. L'agente di IA Oscar può rivedere la storia e i materiali ancora disponibili per lui, spiegare le decisioni precedenti e condividere esempi. Lo sviluppatore di IA applica quelle conoscenze alla correzione. Il tester di IA utilizza gli esempi quando verifica la correzione rispetto all'implementazione attuale.</p>",
      },
      {
        html: '<h3>File, risposte e cronologia</h3><p>La cronologia dei messaggi e le copie degli allegati sono conservate localmente sui computer dei partecipanti. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">guida ai dati</a> spiega archiviazione e trasferimento dei file; la <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guida desktop</a> descrive come proseguire in un’altra chat.</p>',
      },
      {
        html: "<h3>Lasciate che i test e le correzioni avvengano tra gli agenti</h3>\n        <p>In questo esempio, l'agente AI Sam lavora in Cursor sul Mac, mentre Jade esegue i test in Codex su Windows. Il coordinatore dell'IA riceve il rapporto di completamento in OpenCode e assegna il controllo indipendente. Gli scambi successivi mostrano come gli agenti collaborino.</p>",
      },
      {
        html: '<h3>Amministrazione quando ti serve</h3><p>Il tuo lavoro ordinario rimane nelle chat dell\'IA. L\'app desktop fornisce i controlli seguenti quando è necessario ispezionare una connessione o gestire i dati memorizzati.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guida alla configurazione</a></p>',
      },
      {
        html: '<p>Gli agenti si scambiano messaggi tramite NCF Agent Interconnect restando nelle rispettive chat di lavoro. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guida alle applicazioni</a> spiega come configurarle.</p>',
      },
      {
        html: '<p>Nell’app desktop puoi consultare la cronologia di un agente e, se necessario, eliminare i suoi dati locali. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">guida alla gestione degli agenti</a> chiarisce cosa viene rimosso.</p>',
      },
      {
        html: "<p>L'agente di IA Jade si riferisce direttamente a Morgan. Gli agenti AI Sam e Jade risolvono insieme le scoperte di routine, mentre altri compiti continuano a procedere. È possibile aggiungere contesto o modificare l'obiettivo nella chat di coordinamento in qualsiasi momento in cui si verifichi un cambiamento; non è necessario trasmettere ogni correzione o approvare ogni riprova.</p>",
      },
      {
        html: '<h3>Verificare la connessione quando un exchange si arresta</h3><p>Se lo scambio si interrompe, verifica che NCF Agent Interconnect sia in esecuzione e che la chat corretta sia connessa. Trovi gli altri passaggi nella <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">guida alla configurazione</a>.</p>',
      },
      {
        html: "<h3>Esamina i risultati e decidi cosa pubblicare</h3><p>Prima della pubblicazione, l'agente di intelligenza artificiale Morgan vi presenta un resoconto del risultato: cosa è cambiato, cosa è stato verificato su Windows, cosa rimane aperto e cosa è stato proposto per il rilascio. Si valuta se risolve il problema dell'utente e si decide cosa viene rilasciato. I filtri salvati continuano verso il loro risultato.</p>",
      },
    ],
  },
  es: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Una historia de chats conectados',
      skip: 'Saltar al contenido',
      brandLabel: 'NCF Agent Interconnect — arriba',
      navLabel: 'Navegación principal',
      languageLabel: 'Lenguaje',
      languageMenuTitle: 'Selecciona un idioma',
      closeLanguageMenu: 'Cerrar selección de idioma',
      navStory: 'La historia',
      navGuide: 'Guía de campo',
      navStart: 'Comience',
      galleryPageTitle: 'Archivo de imágenes — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — de vuelta a la historia',
      galleryNavLabel: 'Navegación de archivos de imágenes',
      galleryBack: 'Volvemos a la historia.',
      galleryEyebrow: 'Archivo de imágenes',
      galleryTitle: 'Cada ilustración original',
      galleryIntro:
        'Todas las imágenes permanecen en este prototipo, incluidas aquellas que ya no se utilizan en tamaño completo en el cómic. Cada leyenda es el nombre de archivo del activo.',
      galleryDeveloper: 'Desarrollador',
      galleryAgents: 'Tabletas de agente',
      galleryBrand: 'Activos de marca',
      galleryHeroAlt: 'Desarrollador en el escritorio, ilustración principal',
      gallerySceneAlt: 'Desarrollador en el escritorio, escena {number}',
      galleryReadingAlt: 'Desarrollador leyendo el libro NCF Agent Interconnect, escena 13',
      galleryAgentAlt: 'Retrato en tableta del agente {name}',
      galleryIconAlt: 'Icono de la aplicación NCF Agent Interconnect',
      heroEyebrow: 'Una historia de tus conversaciones cotidianas con IA',
      heroTitle: 'Un desarrollador.<br /><em>Muchas conversaciones de trabajo.</em>',
      heroLede:
        'Sigue un error, una nueva función y a los agentes que comparten información útil. Tú marcas el rumbo; NCF Agent Interconnect lleva los mensajes y los archivos permitidos al chat adecuado.',
      download: 'Descarga la aplicación',
      readStory: 'Lea la historia.',
      storyEyebrow: 'La historia de un desarrollador',
      storyTitle: 'Los agentes trabajan juntos',
      storyLede:
        'Una persona mantiene una aplicación a través de chats de IA conocidos. El agente Morgan coordina en OpenCode en un Mac; el agente Jade realiza pruebas en Windows en Codex, y el agente Sam corrige el error en Cursor en el Mac. Elige los nombres de los agentes. Los roles, habilidades y herramientas en esta historia son ejemplos; NCF Agent Interconnect no los suministra.',
      guideEyebrow: 'Mantenga las piezas móviles despejadas',
      guideTitle: 'El trabajo sucede en los chats. La aplicación transmite los mensajes.',
      startEyebrow: 'Comience con dos chats',
      startTitle: 'Asígnales nombres. Envía un mensaje.',
      startLede:
        'Instale la aplicación de escritorio, configure las aplicaciones de IA que utiliza, conecte dos chats con nombres diferentes y pida a un agente que contacte al otro.',
      setupGuide: 'Abrir guía de configuración',
      downloadNote:
        'Instaladores: Apple Silicon Mac DMG, Intel Mac DMG y Windows x64 EXE. macOS 13 o posterior. El tiempo de ejecución de Intel no se probó en hardware Intel; no se publicó ningún instalador de Linux.',
      footerTagline: 'Mensajes entre agentes en sus chats de IA existentes.',
      usageGuide: 'Guía de usuario',
      license: 'Licencia',
      systemNote: 'Nota',
      exampleExchange: 'Chat',
      activityLabel: 'Actividad ilustrativa',
      reader: 'Mientras otros chats funcionan, puedes alejarte.',
      developerAlt:
        'El desarrollador permanece sentado en un escritorio con una computadora visible.',
      readingAlt: 'El desarrollador lee un libro sobre NCF Agent Interconnect en el escritorio.',
      agentAlt:
        'Retrato de cabeza de {name} dentro de una tableta frontal con iconos de herramienta.',
      names: {
        user: 'Tú también.',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Configurar sus chats',
        'Instale NCF Agent Interconnect, elija la configuración del cliente deseada, haga clic en Apply, vuelva a conectar MCP y pruebe un intercambio.',
        'Guía de configuración',
      ],
      [
        'Conoce a su cliente',
        'OpenCode, Codex y Cursor tienen diferentes comportamientos de entrega y requisitos de configuración.',
        'Detalles del cliente',
      ],
      [
        'Controla tus datos',
        'Revisar archivos, historial local, vínculos exactos de chat, transferencias de nombres y alcance de eliminación.',
        'Control de escritorio',
      ],
      [
        'Lea la referencia completa',
        'La guía de usuario y la referencia orientada al LLM contienen los procedimientos completos y los límites detrás de esta historia ilustrada.',
        'Leer llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Asignar un coordinador al trabajo',
        lines: [
          'Conéctate como agente Morgan. Utiliza la habilidad de coordinación para coordinar a todos los agentes y mantener el control del trabajo en su conjunto. Envía a cada participante tus reglas de trabajo. Coordina los límites del trabajo, las ramas de Git, el orden de implementación e integración, y la resolución de conflictos. Pone en contacto a los agentes cuando sus tareas se solapan, organiza el intercambio de conocimientos y mantén informados a todos sobre decisiones y cambios relevantes. Mantén las tareas independientes avanzando en paralelo. Envíame resultados consolidados y decisiones que requieran mi aporte.',
          'Conectada como agente Morgan. Coordinaré a los agentes, rastrearé su trabajo y le traeré resultados y decisiones que necesiten su aprobación.',
        ],
        statuses: ['Preparación de reglas de coordinación'],
      },
      {
        title: 'Conectar al especialista en Windows',
        lines: [
          'Conéctate como agente Jade. Eres responsable de verificar este proyecto en Windows. Morgan coordina el trabajo; pídele instrucciones.',
          'Conectada como agente Jade. Soy responsable de la verificación de Windows. Le informaré a Morgan mi rol y le pediré instrucciones.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Morgan descubre quién se encarga de Windows',
        lines: [
          'Conectado como agente Jade. Manejo la verificación del proyecto en Windows y estoy listo para sus instrucciones.',
          'Recibido. Enviaré las pruebas de Windows a usted y coordinaré los resultados.',
        ],
        statuses: ['Agregar Jade al plan de verificación de Windows'],
      },
      {
        title: 'Hacer de la verificación independiente una regla',
        lines: [
          'Envíe cada tarea reportada como completada a otro agente para pruebas independientes, utilizando comprobaciones adecuadas al resultado. Indique el nombre del agente que realizó el trabajo y pida al probador que coordine cualquier corrección directamente con él. El probador debe informarle de las comprobaciones, el resultado y los problemas pendientes. Acepte la tarea únicamente después de que el probador confirme que supera las pruebas.',
          'Entendido. Enviaré cada tarea reportada como completada a otro agente para pruebas independientes.',
        ],
        statuses: ['Establecimiento de la regla de control independiente'],
      },
      {
        title: 'Conectar un agente de implementación',
        lines: [
          'Conéctate como agente Leo. Tu rol es implementación. Morgan coordina el trabajo; pídele instrucciones.',
          'Conectado como agente Leo. Me encargo de la implementación. Le informaré a Morgan mi rol y pediré una asignación.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Describa la función a Morgan',
        lines: [
          'La tarea #T-1042 es guardar filtros que permiten a los usuarios reutilizar sus condiciones de búsqueda. Organizar la ejecución mientras se continúa el otro trabajo.',
          'Leo implementará #T-1042 en su propio chat. Seguiré el trabajo y organizaré un chequeo independiente cuando él informe que está completo.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Leo recibe la función',
        lines: [
          'Utilice la habilidad de implementación para la tarea #T-1042: crear filtros guardados para que los usuarios puedan reutilizar sus condiciones de búsqueda. Mantenga este trabajo separado de otras tareas e informe mi resultado.',
          'Tomaré #T-1042 y primero inspeccionaré cómo funcionan las condiciones de búsqueda ahora.',
        ],
        statuses: [
          'Revisando la implementación actual de la búsqueda',
          'Planificación del comportamiento del filtro guardado',
        ],
      },
      {
        title: 'Conectar un agente de análisis',
        lines: [
          'Conéctate como agente Alice. Tu rol es análisis. Morgan coordina el trabajo; pídele instrucciones.',
          'Conectada como agente Alice. Yo manejo el análisis de las solicitudes. Le informaré a Morgan mi rol y le pediré instrucciones.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Enviar las solicitudes relacionadas a Morgan',
        lines: [
          'Las solicitudes #I-0201 y #I-0202 pueden describir la misma necesidad. Encontrar el problema subyacente del usuario, comprobar la pantalla de búsqueda existente en Figma y relacionar el hallazgo con #T-1042.',
          'Alice analizará ambas solicitudes y la pantalla Figma. La pondré en contacto con Leo para que el hallazgo llegue al trabajo de filtrado guardado.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Alice investiga la necesidad de',
        lines: [
          'Utilice la habilidad de análisis para revisar los temas #I-0201 y #I-0202. Verifique la pantalla de búsqueda existente en Figma, identifique la necesidad subyacente del usuario y comparta los hallazgos relevantes con Leo.',
          'Compararé ambas solicitudes con la pantalla actual, y luego enviaré a Leo el hallazgo.',
        ],
        statuses: [
          'Lectura de ambas solicitudes',
          'Verificación de la pantalla de búsqueda en Figma',
        ],
      },
      {
        title: 'Permite que el hallazgo llegue al chat de trabajo',
        lines: [
          'Los temas #I-0201 y #I-0202 se refieren a la reutilización de las mismas condiciones de búsqueda. ¿Puede la tarea #T-1042 preservar la combinación completa?',
          '- Sí, es cierto. Compruebe si los usuarios también necesitan compartirlos; lo mantendré separado de la tarea #T-1042.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Un error de Windows cambia el plan',
        lines: [
          'La importación falló en Windows. Estoy adjuntando el archivo de importación que desencadena el error #B-0317. Investigue el problema y informe lo que encuentre.',
          'Jade reproducirá #B-0317 en Windows y me enviará los pasos y la evidencia. Si el error es confirmado, organizaré la reparación y una verificación independiente.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Jade realiza las pruebas del error Windows',
        lines: [
          'Utilice la habilidad de verificación para reproducir el error #B-0317 en Windows con el archivo de importación adjunto. Envíame los pasos de reproducción y la evidencia.',
          'Verificaré la importación y le enviaré el resultado.',
        ],
        statuses: [
          'Abriendo el archivo de importación',
          'Verificación de la importación en Windows',
        ],
      },
      {
        title: 'La evidencia llega al coordinador',
        lines: [
          'La importación de Windows falla. Aquí están los pasos de reproducción y la evidencia para #B-0317.',
          'Recibido. Informaré el resultado y conservaré la evidencia para el propietario de la corrección.',
        ],
        statuses: ['Preparando el informe de errores'],
      },
      {
        title: 'Conectar a otro desarrollador',
        lines: [
          'Conéctate como agente Sam. Tu rol es implementación. Morgan coordina el trabajo; pídele instrucciones.',
          'Conectado como agente Sam. Me encargo de la implementación. Le informaré a Morgan mi rol y pediré una asignación.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'El resultado cambia la prioridad',
        lines: [
          'Jade reprodujo #B-0317 en Windows y envió los pasos y la evidencia. El fallo de importación se confirma.',
          'Este insecto bloquea el trabajo diario. Relevar la corrección para #B-0317 primero. Si la tarea #T-1042 no está lista, puede seguir en la próxima versión. Mantén ese trabajo en movimiento.',
          'Ya lo entiendo. Sam arreglará el #B-0317, y Jade lo comprobará de forma independiente en Windows. Mantendré el #T-1042 en movimiento por separado.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Sam recibe la corrección',
        lines: [
          'Utilice la habilidad de implementación para arreglar el error #B-0317. Jade lo reprodujo en Windows; aquí están sus pasos y pruebas. Mantenga la corrección separada de #T-1042 y coordine los detalles de verificación directamente con Jade.',
          'Investigaré #B-0317, prepararé la solución y enviaré a un candidato para pruebas independientes.',
        ],
        statuses: [
          'Revisión de los pasos para la reproducción',
          'Verificación del código de importación',
        ],
      },
      {
        title: 'Recuerda una investigación anterior',
        lines: [
          'Una investigación de importación anterior en la tarea #T-0870 puede ayudar con #B-0317. Encuentra las decisiones anteriores y los ejemplos pertinentes.',
          'Oscar trabajó en #T-0870. Le preguntaré por las decisiones y ejemplos, luego los compartiré con Sam y Jade.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Morgan solicita conocimientos previos',
        lines: [
          'Investigaron la importación en la tarea #T-0870. Recupere las decisiones anteriores y todos los ejemplos relevantes para el error #B-0317, luego comparta con Sam y Jade.',
          'Revisaré la historia y los materiales disponibles, luego enviaré los ejemplos relevantes.',
        ],
        statuses: ['tarea de revisión #T-0870'],
      },
      {
        title: 'Las decisiones anteriores alcanzan al desarrollador',
        lines: [
          'Encontré las decisiones de importación anteriores y ejemplos. Se los envío.',
          'Recibido. Los utilizaré en la corrección.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Los mismos ejemplos llegan al probador',
        lines: [
          'Los mismos ejemplos de importación pueden ayudarle a comprobar Windows. Se los envío.',
          'Recibido. Los incluiré en las pruebas.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Mientras tanto, el trabajo continúa',
        lines: [],
        statuses: [],
      },
      {
        title: 'El primer candidato está listo',
        lines: [
          'Bug #B-0317 está arreglado. Aquí está el candidato para pruebas independientes.',
          'Recibido. Pediré a Jade una comprobación independiente de Windows.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensaje enviado'],
      },
      {
        title: 'Un agente distinto lo prueba',
        lines: [
          'Prueba el candidato para el error #B-0317 en Windows. Sam lo implementó. Utilice la habilidad de verificación y trabaje directamente con Sam en cualquier defecto. Envíame su propio resultado de prueba cuando pasen los cheques, o reportar un bloqueador.',
          'Lo probaré en Windows y trabajaré con Sam directamente si encuentro un defecto.',
        ],
        statuses: ['Revisando la solución propuesta', 'Prueba de importación en Windows'],
      },
      {
        title: 'Un segundo caso falla',
        lines: [
          'Bug #B-0317: el archivo original importa, pero la muestra de Oscar crea una fila duplicada. Por favor, arregla ese caso.',
          'Voy a corregir el caso de fila duplicada y enviar un candidato revisado.',
        ],
        statuses: ['Reproducción de la fila duplicada'],
      },
      {
        title: 'Corregir, luego volver a probar',
        lines: [
          'El caso de fila duplicada está resuelto. Aquí tiene el candidato revisado. Por favor, vuelva a ejecutar ese caso y la importación original.',
          'Reejecutaré tanto las importaciones como las pruebas de regresión existentes.',
        ],
        statuses: [
          'Reejecución de ambas muestras de importación',
          'Ejecutar las pruebas de regresión existentes',
        ],
      },
      {
        title: 'El resultado independiente llega',
        lines: [
          'El error #B-0317 pasó a Windows usando el candidato revisado de Sam. Ambas muestras de importación fueron aprobadas, junto con los controles de regresión de importación existentes. No quedan problemas en el ámbito probado.',
          'Recibido. Incluiré la corrección aceptada en la propuesta de liberación.',
        ],
        statuses: ['Preparación de la propuesta de liberación'],
      },
      {
        title: 'Tú decides qué se publica',
        lines: [
          'Resumen el error #B-0317, tarea #T-1042 y problemas #I-0201 y #I-0202. Por cada uno, dime el resultado hasta ahora, lo que viene después y cualquier decisión que necesites de mí.',
          'Prepararé un estado para cada elemento y señalaré las decisiones que usted necesita tomar.',
        ],
        statuses: ['Compilación de los resultados de las cuatro opciones'],
      },
    ],
    notes: [
      {
        html: '<p>Usted mantiene una aplicación en crecimiento por su cuenta. Los informes de errores llegan mientras desarrolla una función de hoja de ruta, y también deben atenderse nuevas solicitudes de usuarios. NCF Agent Interconnect permite que los agentes de IA en sus chats habituales trabajen juntos en estas tareas. Las preguntas, los hallazgos y los archivos circulan directamente entre ellos; usted establece la dirección y recibe los resultados en su chat de trabajo.</p><p>Esta guía sigue a un desarrollador a través de esa situación. Eres el único humano en la historia; todos los participantes nombrados son agentes de IA. Sus nombres y papeles son ejemplos que puedes reemplazar por los tuyos.</p><p>Elige una de las <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 instrucciones preparadas</a> y compártela con tu modelo. Elaborará en tu idioma una guía detallada del ejemplo elegido, basada en la documentación de NCF.</p>',
      },
      {
        html: '<h3>Prepare sus aplicaciones y chats</h3><p>Configura cada aplicación o perfil una vez. Los nuevos chats se unen luego conectándose bajo los nombres que elijas.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guía de configuración</a></p>',
      },
      {
        html: '<h3>Trabaja en sus chats habituales</h3><p>En esta historia, trabajas en una Mac y mantienes una computadora Windows para comprobar la aplicación que ejecutan tus usuarios. Ya utilizas varios servicios de IA, eligiendo modelos que se adapten a tu trabajo y equilibrando los costos.</p><p>El agente de IA Morgan coordina en OpenCode. Otros participantes tienen sus propios chats; las pruebas Windows ocurren en Codex. Un nuevo participante podría unirse más tarde a Cursor o a otra aplicación configurada.</p><p>Después de la primera configuración, asigne un nombre a cada chat participante. En su chat principal, establezca las reglas de coordinación. Jade ya ha informado a Morgan su rol de verificación en Windows; puede dirigir el trabajo posterior a través del chat de coordinación.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guía de configuración</a></p>',
      },
      {
        html: '<p>Asignar al coordinador de IA una regla independiente para aceptar el trabajo completado. El coordinador de IA envía instrucciones de trabajo a los participantes conforme se incorporan y supervisa el avance en todas las tareas. Cuando conecte a un participante, asigne a ese chat un nombre y un rol; Morgan asigna el trabajo tras recibir el informe del agente sobre dicho rol.</p>',
      },
      {
        html: '<p>El agente de IA Leo es el responsable de la función. El coordinador de IA supervisa su progreso.</p>',
      },
      {
        html: '<h3>Haz que los hallazgos lleguen a las conversaciones de IA utilizadas para el trabajo</h3>\n        <p>Más tarde, dos solicitudes relacionadas del usuario llegan. Abres otro chat de análisis; Morgan asigna a Alice las solicitudes y la pone en contacto con el propietario de la función. El agente de IA Alice descubre que ambas solicitudes describen la misma necesidad: los usuarios recrean las mismas condiciones de búsqueda todos los días. Envía el hallazgo directamente al chat donde se está construyendo la función de filtro guardado.</p>',
      },
      {
        html: '<p>Las preguntas, aclaraciones y resultados llegan al chat de trabajo correspondiente. Cada agente conserva las herramientas e instrucciones de su entorno. Consulta la <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guía de aplicaciones</a>.</p>',
      },
      {
        html: '<h3>Investigar el error Windows</h3>\n        <p>Un usuario informa que la importación falla en Windows. El análisis de funcionalidades y solicitudes ya tiene sus propios participantes. El chat Windows de Jade está conectado, así que Morgan le pide que reproduzca el fallo allí.</p>',
      },
      {
        html: '<p>El agente de IA Jade, el probador, reproduce el fallo y envía la evidencia directamente al chat de coordinación. El usuario confirma que el problema bloquea el trabajo diario. Indícale al agente de IA Morgan cómo esto modifica la prioridad de liberación.</p>',
      },
      {
        html: '<p>Puedes ampliar el equipo mientras la función sigue en desarrollo. El agente de IA Morgan comparte la reproducción, establece los límites del trabajo y organiza la verificación en Windows. El coordinador de IA mantiene los cambios separados para que la corrección se pueda liberar primero. El agente de IA Sam es responsable de la solución, mientras que Jade verifica su comportamiento en Windows. Los filtros guardados y el análisis de las solicitudes continúan en sus chats originales. Ha cambiado el orden de liberación y ha añadido capacidad mientras el trabajo está en curso.</p>',
      },
      {
        html: '<h3>Traer el conocimiento previo de nuevo a la tarea</h3><p>Recuerda que una conversación más antigua contiene una investigación del comportamiento de importación. El agente de IA Oscar puede revisar el historial y los materiales aún disponibles para él, explicar decisiones anteriores y compartir ejemplos. El desarrollador de IA aplica ese conocimiento para corregir el problema. El probador de IA utiliza los ejemplos al realizar las comprobaciones contra la implementación actual.</p>',
      },
      {
        html: '<h3>Archivos, respuestas e historial</h3><p>El historial de mensajes y las copias de los archivos adjuntos se guardan localmente en los equipos de los participantes. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">guía de datos</a> explica cómo se almacenan y transfieren los archivos; la <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guía de escritorio</a> describe cómo continuar en otro chat.</p>',
      },
      {
        html: '<h3>Permite que las pruebas y correcciones tengan lugar entre los agentes</h3>\n        <p>En este ejemplo, el agente de IA Sam trabaja en Cursor en el Mac, mientras que Jade realiza pruebas en Codex en Windows. El coordinador de IA recibe el informe de finalización en OpenCode y asigna la comprobación independiente. Los siguientes intercambios muestran cómo los agentes colaboran.</p>',
      },
      {
        html: '<h3>Administración cuando la necesite</h3><p>Tu trabajo habitual permanece en las conversaciones de IA. La aplicación de escritorio proporciona los controles siguientes cuando necesitas inspeccionar una conexión o gestionar datos almacenados.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guía de configuración</a></p>',
      },
      {
        html: '<p>Los agentes intercambian mensajes mediante NCF Agent Interconnect sin salir de sus chats de trabajo. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guía de aplicaciones</a> explica cómo configurarlas.</p>',
      },
      {
        html: '<p>En la aplicación de escritorio puedes consultar el historial de un agente y eliminar sus datos locales cuando sea necesario. La <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">guía de gestión de agentes</a> explica el alcance de la eliminación.</p>',
      },
      {
        html: '<p>El agente de IA Jade informa directamente a Morgan. Los agentes de IA Sam y Jade resuelven conjuntamente los hallazgos de rutina, mientras que otras tareas siguen avanzando. Puede añadir contexto o ajustar el objetivo en el chat de coordinación en cualquier momento en que cambie algo; no es necesario comunicar cada corrección ni aprobar cada nueva prueba.</p>',
      },
      {
        html: '<h3>Verifique una conexión cuando se detiene el intercambio</h3><p>Si se interrumpe el intercambio, comprueba que NCF Agent Interconnect esté en funcionamiento y que el chat correcto siga conectado. Los pasos siguientes están en la <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">guía de configuración</a>.</p>',
      },
      {
        html: '<h3>Recibe los resultados y decide qué publicar</h3><p>Antes de la publicación, el agente de IA Morgan te presenta un informe del resultado: qué cambió, qué se verificó en Windows, qué sigue abierto y qué se propone para su lanzamiento. Evalúas si aborda el problema del usuario y decides qué software se libera. Los filtros guardados continúan hacia su propio resultado.</p>',
      },
    ],
  },
  kk: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Агенттер әртүрлі чаттарда қалай бірге жұмыс істейді',
      skip: 'Мазмұнына өту',
      brandLabel: 'NCF Agent Interconnect — беттің басына',
      navLabel: 'Бетке жүгіру',
      languageLabel: 'Бет тілі',
      languageMenuTitle: 'Тіл таңдаңыз',
      closeLanguageMenu: 'Тіл таңдауын жабу',
      navStory: 'Тарих',
      navGuide: 'Анықтама',
      navStart: 'Неден бастау керек',
      galleryPageTitle: 'Суреттік құралдар архиві — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — өткенге қайту',
      galleryNavLabel: 'Иллюстрациялар архиві бойынша навигация',
      galleryBack: 'Тарихқа оралу',
      galleryEyebrow: 'Иллюстрациялар архиві',
      galleryTitle: 'Барлық иллюстрация бір жерде',
      galleryIntro:
        'Мұнда прототиптің барлық суреттері сақталған, оның ішінде комиксте толық көлемде көрсетілмеген суреттер. Әр суреттің астында бастапқы файлдың атауы көрсетіледі.',
      galleryDeveloper: 'Разработчик',
      galleryAgents: 'Агенттердің құрылғылары',
      galleryBrand: 'Фирмалық белгі',
      galleryHeroAlt: 'Жұмыс үстеліндегі әзірлеуші, басты бет иллюстрациясы',
      gallerySceneAlt: 'Жұмыс үстеліндегі әзірлеуші, кадр {number}',
      galleryReadingAlt: 'Әзірлеуші NCF Agent Interconnect туралы кітап оқып отыр, 13-кадр',
      galleryAgentAlt: 'Планшеттегі агенттің портреті {name}',
      galleryIconAlt: 'NCF Agent Interconnect қосымшасының таңбасы',
      heroEyebrow: 'Әдеттегі ИИ чаттар тарихы',
      heroTitle: 'Бір әзірлеуші.<br /><em>Бірнеше жұмыс чаты.</em>',
      heroLede:
        'Қате мен жаңа мүмкіндіктің барысын және агенттердің маңызды мәліметтерді қалай бөлісетінін бақылаңыз. Бағытты сіз белгілейсіз; NCF Agent Interconnect хабарламалар мен рұқсат етілген файлдарды тиісті чатқа жеткізеді.',
      download: 'Қолданбаны жүктеу',
      readStory: 'Тарихты оқу',
      storyEyebrow: 'Бір әзірлеушінің тарихы',
      storyTitle: 'Агенттер бірлесіп жұмыс істейді',
      storyLede:
        'Сіз қолданбаны әдеттегі ИИ чаттарында дамытасыз. Агент Morgan OpenCode-те Mac-те жұмысты үйлестіреді. Агент Jade Codex-те Windows-те қолданбаны тексереді. Агент Sam Cursor-де Mac-те қатені түзейді. Агенттердің аттарын сіз таңдайсыз; олардың рөлдері, дағдылары мен құралдары бұл жерде мысал ретінде келтірілген. NCF Agent Interconnect олардың барлығын ұсынбайды.',
      guideEyebrow: 'Алудың маңыздылығы',
      guideTitle: 'Агенттер чаттарда жұмыс істейді. Қолданба хабарламаларды жеткізеді.',
      startEyebrow: 'Екі сөйлесуден бастаңыз',
      startTitle: 'Оларға ат қойыңыз. Хабарлама жіберіңіз.',
      startLede:
        'Настольное приложениены орнатыңыз, пайдаланып жатқан ИИ қолданбаларыңызды баптаңыз, әртүрлі атаулармен екі чатты қосыңыз және бір агентті екіншісіне хабар жазуды сұраңыз.',
      setupGuide: 'Параметрлерді баптау нұсқаулығын ашу',
      downloadNote:
        'MacOS үшін Apple Silicon үшін DMG және Intel Mac, Windows үшін  EXE x64 бар. MacOS 13 немесе одан жаңасын қажет етеді. Intel Mac құрастыруы Intel процессорлы компьютерде тексерілмеген. Linux орнатушысы жарияланбады.',
      footerTagline:
        'AI агенттерінің әдеттегі чаттардағы әрекеттерінің құралдары арқылы өзара хабарлау.',
      usageGuide: 'Пайдаланушы нұсқаулығы',
      license: 'Лицензия',
      systemNote: 'Ескертпе',
      exampleExchange: 'Чат',
      activityLabel: 'Жұмыс мәртебесінің мысалы',
      reader:
        'Агенттер жұмыс істеп тұрғанда, NCF Agent Interconnect құралының қолдану нұсқаулығын оқуға болады.',
      developerAlt: 'Әзірлеуші компьютер алдында жұмыс үстелінде отыр.',
      readingAlt: 'Жасаушы үстелге отырып, NCF Agent Interconnect туралы кітап оқиды.',
      agentAlt:
        'Планшеттің экранында {name} агенттің портреті; портреттің астында  құралдар белгісі.',
      names: {
        user: 'Сіздер',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Чаттарды қосу',
        'NCF Agent Interconnect-ті орнатыңыз, қажетті қолданба конфигурациялық файлын таңдаңыз, өзгерістерді тексеріп, Apply батырмасын басыңыз. Содан кейін MCP-ді қайта қосып, хат алмасуды тексеріңіз.',
        'Қалыптау нұсқаулығы',
      ],
      [
        'Клиенттің ерекшеліктерін ескеріңіз',
        'OpenCode, Codex және Cursor хабарламаларды жеткізу әдісі мен баптау талаптары бойынша ерекшеленеді.',
        'Клиенттердің ерекшеліктері',
      ],
      [
        'Деректерді бақылау',
        'Тіркемелерді, жергілікті тарихын, белгілі бір чатқа сілтемелерді, атауларды ауыстыруды және қандай деректер өшірілетінін тексеріңіз.',
        'Басқару құралдары',
      ],
      [
        'Толық құжаттаманы оқыңыз',
        'Пайдаланушының қолдану құралы мен тілдік моделдер үшін анықтама құжатында бұл оқиғаның негізінде жатқан барлық қадамдар мен шектеулер егжей-тегжейлі сипатталған.',
        'llms.txt ашылсын',
      ],
    ],
    scenes: [
      {
        title: 'Үйлестіруші белгіленсін',
        lines: [
          'Morgan агенті ретінде қосылыңыз. Үйлестіру дағдысын қолданыңыз: барлық агенттерді үйлестіріңіз және жалпы жұмыстың барысын қадағалаңыз. Әр қатысушыға менің жұмыс ережелерімді жеткізіңіз. Жауапкершілік аймағын, Git веткилерін, іске асыру және интеграциялау тәртібін келісіңіз, қақтығыстарды шешіңіз. Тапсырмалар кездескенде, агенттерді біріктіріп, білім алмасуды ұйымдастырып, шешімдер мен оларға қатысты өзгерістер туралы хабарлаңыз. Тәуелсіз тапсырмалардың бір-бірімен қатар жүруін қадағалаңыз. Нәтижелерді жалпы жиынтыққа жинап, менің шешімімді қажет ететін мәселелерді бөлек белгілеңіз.',
          'Morgan агенті ретінде қосылды. Мен агенттерді үйлестіремін, жұмыстың барысын бақылаймын және маңызды сұрақтарды сіздің шешіміңізге ұсынамын.',
        ],
        statuses: ['Құрамындағы әрекеттерді басқару ережесін дайындап жатырмын'],
      },
      {
        title: 'Windows агентін қосу',
        lines: [
          'Jade агенті ретінде қосылыңыз. Сіз NCF Agent Interconnect арқылы Windows үстінде жобаны тексеруге жауаптысыз. Координатор — Morgan; оның нұсқауларын сұраңыз.',
          'Jade агенті ретінде қосылды. Windows платформасындағы проекттік тексерістерге жауаптымын. Өз рөлім туралы Morgan үйлестірушісіне хабарлап, нұсқауларды сұраймын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Morgan Jade рөлін біледі',
        lines: [
          'Jade агенті ретінде қосылды. Жобаны Windows-да тексеруге жауаптымын және тапсырмаларды алуға дайынмын.',
          'Қабылдадым. Сізге Windows-тағы тексерулерді тапсырып, нәтижелерді жинағым келеді.',
        ],
        statuses: ['Jade-ді Windows тексеру жоспарына қосу'],
      },
      {
        title: 'Тәуелсіз тексеруді ережеге айналдырыңыз',
        lines: [
          'Әрбір тапсырманы, орындаушы аяқталған деп есептеген, басқа агентке тәуелсіз тестілеуге беріңіз. Тексерулерді нәтиженің түріне қарай таңдаңыз. Орындаушының атын көрсетіп, тестілеушінің түзетулерді онымен тікелей келісуін сұрып, тестілеушінің тексергенін, нәтиженің қандай болғанын және қалған проблемалардың қандай екенін хабарлауын қадағалап, тек тестілеуші тексеруден өткенін растағаннан кейін ғана тапсырманы қабылдаңыз.',
          'Мен қабылдадым. Орындаушы біткен әрбір тапсырманы басқа агентке тәуелсіз тексеруге тапсырамын.',
        ],
        statuses: ['Тәуелсіз тексеру ережесін бекітемін'],
      },
      {
        title: 'Даму агенті қосылсын',
        lines: [
          'Leo агенті ретінде қосылыңыз. Сіздің рөліңіз — даму. Координатор — Morgan; оның нұсқауларын сұраңыз.',
          'Leo агенті ретінде қосылды. Жасаушылық жұмысқа жауаптымын. Morgan үйлестірушісіне өз рөлемді хабарлап, тапсырманы сұраймын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Morgan-ге жаңа функция туралы хабарлаңыз',
        lines: [
          'Тапсырма #T-1042  пайдаланушылар іздеу шарттарын қайта қолдана алу үшін сақталған сүзгілер. Басқа бағыттарды тоқтатпастан, әзірлеуді ұйымдастырыңыз.',
          '#T-1042 әзірлеуді Leo оның жеке чатта тапсырамын. Жұмыстың жүріп-тұралуын қадағалап, ол аяқталды деп хабарлаған кезде тәуелсіз тексеруді тағайындамақпын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Leo фильтрлер туралы тапсырманы алады',
        lines: [
          'Implementation дағдысын #T-1042 тапсырмасы үшін қолданыңыз: пайдаланушылар іздеу шарттарын қайта қолдана алу үшін сақталған сүзгілерді іске қосыңыз. Бұл жұмысты басқа міндеттерден бөлек орындаңыз және маған нәтиже туралы хабарлаңыз.',
          'Мен #T-1042-ді аламын. Алдымен іздестіру шарттарын қарастырамын.',
        ],
        statuses: [
          'Назардағы іздестірудің қазіргі іске асырылуын зерттеймін',
          'Сақталған фильтрлердің жұмысын ойлап жатырмын',
        ],
      },
      {
        title: 'Анализ агентін қосыңыз',
        lines: [
          'Alice агенті ретінде қосылыңыз. Сіздің рөліңіз — сұрауларды талдау. Координатор — Morgan; оның нұсқауларын сұраңыз.',
          'Alice агенті ретінде қосылды. Сұраныстарды талдау үшін жауаптымын. Мен Morgan үйлестірушісіне өз рөлім туралы хабарласып, нұсқаулар сұраймын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Morganге байланысты сұраныстарды жіберу',
        lines: [
          '#I-0201 және #I-0202 сұрақтары бір қажеттілікпен байланысты болуы мүмкін. Пайдаланушылардың не қажет екенін анықтаңыз, қазіргі Figma іздеу экранмен салыстырып, қорытындыны #T-1042 тапсырмасымен салыстырып көріңіз.',
          'Figma-дегі сұраныстар мен экранды талдау Alice-ге тапсырылады. Оны Leo-мен байланыстырып, нәтижесі сақталған сүзгілерге қолданылатындай ету үшін әрекет етемін.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Alice пайдаланушылардың қажеттіліктерін зерттейді',
        lines: [
          'Анализ дағдысын пайдалан: #I-0201 және #I-0202 сұраныстарын түсіндіріңіз, Figma-тегі бар іздеу экранын зерттеңіз, пайдаланушылардың қажеттілігін анықтаңыз және Leo-тің маңызды қорытындыларын жеткізіңіз.',
          'Екі сұранысты да ағымдағы экранмен салыстырып, кейін нәтижесін Leo-ға жіберемін.',
        ],
        statuses: ['Екі сұранысты да зерттеймін.', 'Іздеу экранын Figma- ге салыстыру'],
      },
      {
        title: 'Жауап тікелей жұмыс шатына жетеді',
        lines: [
          '#I-0201 және #I-0202  сұрақтары бірдей іздеу шарттарын қайта пайдалану туралы. #T-1042 аясында барлық шарттар сақталуы мүмкін бе?',
          'Иә, солай. Пайдаланушылардың осы Шарттарды бөлісулері керек пе, жоқ па, анықтаңыз. Мен мұны жеке сұраққа бөліп, #T-1042 тапсырмасының шегінен шығарамын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Windows ошибкасы жоспарды өзгертиді',
        lines: [
          'Windows жүйесінде импорт орындалмайды. #B-0317 қатесін тудыратын импорт файлын тіркедім. Мәселені зерттеп, анықтағаныңызды хабарлаңыз.',
          'Jade #B-0317-ді Windows-де қайтарады және қадамдар мен растау материалдарын жібереді. Егер қате расталса, оны түзетіп, тәуелсіз тексеруді ұйымдастырамын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Jade Windows үстінде қатені тексереді',
        lines: [
          'Тексеру дағдысын қолданыңыз: импорт файлымен Windows-де #B-0317 қатесін қайталаңыз. Қайталану қадамдары және растау материалдары келді.',
          'Импортты тексеріп, нәтижесін жіберемін.',
        ],
        statuses: ['Импорт файлын ашу', 'Импортты Windows-ға тексеру'],
      },
      {
        title: 'Нәтиже үйлестірушіге жетеді',
        lines: [
          'Windows импорттау қатемен аяқталады. Қайталану қадамдары мен материалдарды #B-0317 телефоны арқылы хабарлаймын.',
          'Мен қабылдадым. Нәтижесін пайдаланушыға хабарлаймын және түзету орындаушысы үшін материалдарды сақтаймын.',
        ],
        statuses: ['Қате туралы есеп дайындап жатырмын'],
      },
      {
        title: 'Тағы бір әзірлеушіні қосыңыз',
        lines: [
          'Sam агенті ретінде қосылыңыз. Сіздің рөліңіз — даму. Координатор — Morgan; оның нұсқауларын сұраңыз.',
          'Sam агенті ретінде қосылды. Жасаушылық жұмысқа жауаптымын. Morgan үйлестірушісіне өз рөлемді хабарлап, тапсырманы сұраймын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Нәтиже басымдықты өзгертеді',
        lines: [
          'Jade #B-0317-ді Windows-де қайтарып, растау материалдарымен қадамдарды жіберді. Импорт қатесі расталды.',
          'Қателер күнделікті жұмыстарға кедергі келтіреді. Алдымен #B-0317 түзетуін шығарайық. Егер #T-1042 тапсырмасы шығарылмаса, ол келесіге ауыстырылуы мүмкін. Онымен жұмыс істеуді тоқтатпа.',
          'Мен қабылдадым. #B-0317 түзетуін Sam, Windows  Jade тәуелсіз тексеруін тапсырамын. #T-1042 бойынша жұмыс жеке жалғасады.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Sam түзету тапсырмасын алады',
        lines: [
          '#B-0317 қатесін түзеу үшін implementation дағдысын қолданыңыз. Jade оны Windows-те қайталады; оның қадамдары мен материалдарын жеткіздім. Түзетуді #T-1042-ден бөлек ұстаңыз, тексерудің егжей-тегжейін Jade-мен тікелей келісіңіз.',
          '#B-0317-ді шешіп, түзетуді дайындап, нұсқаны тәуелсіз тексеруге тапсырамын.',
        ],
        statuses: ['Өмірлендіру қадамдарын зерттеймін', 'Импорт кодын тексеру'],
      },
      {
        title: 'Бұрынғы зерттеуді еске түсіріңіз',
        lines: [
          '#T-0870 тапсырмасында импорттың жұмысын зерттеп шықты. #B-0317 мәселесін шешуге көмектесетін бұрынғы шешімдер мен мысалдарды табыңыз.',
          '#T-0870 тапсырмасын Oscar орындады. Мен одан шешімдер мен мысалдарды сұраймын, содан кейін оларды Sam және Jade арқылы жіберемін.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Morgan өткен жұмыстарын сұрайды',
        lines: [
          'Сіз импорттың жұмысын #T-0870 тапсырмасында зерттедіңіз. #B-0317 қатесімен көмектесетін бұрынғы шешімдер мен мысалдарды келтіріңіз, содан кейін оларды Sam және Jade арқылы тапсырыңыз.',
          'NCF Agent Interconnect арқылы қолжетімді тарих пен материалдарды ашамын, содан кейін сәйкес мысалдарды беремін.',
        ],
        statuses: ['#T-0870 тапсырмасының материалдарын зерттеймін'],
      },
      {
        title: 'Sam өзге шешімдерді алады',
        lines: [
          'Импортқа байланысты бұрынғы шешімдер мен мысалдарды таптым. Оларды сізге беріп жатырмын.',
          'Қабылдадым. Оларды түзету кезінде есепке аларам.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Jade тіркелу үшін үлгілерді алады',
        lines: [
          'Мен сізге Windows-де тексерілетін импорт үлгілерін беремін.',
          'Мен қабылдадым. Мен оларды тексеруге қосамын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Осы аралықта жұмыс жалғасады',
        lines: [],
        statuses: [],
      },
      {
        title: 'Алғашқы түзету дайын',
        lines: [
          '#B-0317 қатесі түзетілді. Мен түзету нұсқасын дербес тестілеуге беремін.',
          'Қабылдадым. Jade-ге Windows-ға тәуелсіз тексеру тапсырамын.',
        ],
        statuses: ['NCF Agent Interconnect қолданамын', 'Хабарлама жіберілді'],
      },
      {
        title: 'Jade независимое тестирование жүргізеді',
        lines: [
          '#B-0317 қатесін Windows-да түзетіңіз. Оны Sam өткізді. Тексеру дағдыларын қолданыңыз және егер кемшіліктерді тапсаңыз, Sam-мен тікелей жұмыс істеңіз. Тексерулер аяқталғаннан кейін, маған жеке есеп келді; егер блокер пайда болса, хабарлаңыз.',
          'Windows-де тексерілмекпін. Егер қате табылса, Sam-ге тікелей хабарласамын.',
        ],
        statuses: ['Түзету нұсқасын зерттеймін', 'Импортты Windows-ға тексеру'],
      },
      {
        title: 'Қосымша мысал ақауды ашты',
        lines: [
          '#B-0317 қатесі: бастапқы файл импортталады, бірақ Oscar мысалы жолдың телнұсқасын жасайды. Бұл жағдайды түзетіңіз.',
          'Жол дубликатын түзеп, жаңартылған нұсқаны жіберемін.',
        ],
        statuses: ['Жолдың дубликатын қайталау'],
      },
      {
        title: 'Түзетіп, қайта тексеріңіз',
        lines: [
          'Сызық телнұсқасы өшірілді. Бұл түзетудің жаңартылған нұсқасы. Oscar мысалы мен бастапқы импорт файлы бойынша тексеріңіз.',
          'Екі файлды импорттауды және бар регрессиялық тексеруді қайталаймын.',
        ],
        statuses: [
          'Екі үлгіні импорттауды қайталау',
          'Қолданыстағы регрессиялық тексерулерді іске қосу',
        ],
      },
      {
        title: 'Тәуелсіз тексерудің нәтижесі келді',
        lines: [
          'Sam-тен #B-0317 түзетудің жаңартылған нұсқасы Windows-те тексерілді. Файл үлгілерінің екеуі де сәтті импортталды; қолданыстағы импорттық регрессиялық тестілер де өтті. Тексерілген көлемде проблемалар жоқ.',
          'Есепті қабылдады. Шығарылу туралы ұсыныста түзетуді кірістіремін.',
        ],
        statuses: ['NCF Agent Interconnect құрамындағы релиздің құрамы бойынша ұсыныс жасаймын'],
      },
      {
        title: 'Не жарияланатынын сіз шешесіз',
        lines: [
          '#B-0317 қатесі, #T-1042 тапсырмасы, #I-0201 және #I-0202 сұраныстары туралы жиынтығын келтіріңіз. Әр тармақ бойынша осы уақытқа дейін не істегенімді, не жоспарланғандығын және менден қандай шешім қабылдауым керектігін айтып бер.',
          'Әрбір пункт бойынша қысқаша баяндама дайындап, сіздердің қажетті шешімдеріңізді жеке белгілеймін.',
        ],
        statuses: ['Төрт нүктеге байланысты нәтижелерді жинап жатырмын'],
      },
    ],
    notes: [
      {
        html: '<p>Сіз қолданбаны өз бетіңізбен жасап жатырсыз. Жаңарту жоспарының жаңа функциясының үстінде жұмыс істеп тұрған кезде, қате туралы хабарлар және пайдаланушылардың жаңа сұрақтары келіп түседі. NCF Agent Interconnect сіздің әдеттегі чаттарыңыздағы ИИ агенттеріне осы тапсырмаларды бірге орындауға көмектеседі. Олар сұрақтарды, қорытындыларды және файлдарды бір-бірімен тікелей бөліседі; сіз бағытты келтіріп, жұмыс әңгімесіңізде нәтижелер аласыз.</p><p>Мұнда сіздердің алдыңызда осындай жағдайға тап болған бір әзірлеушінің тарихы бар. Сіз бұл оқиғадағы жалғыз адамсыз, қалғандары - ИИ агенттері. Есімдер мен рөлдер үлгі болып табылады: сіз басқаларды таңдай аласыз.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 дайын промпттың</a> бірін таңдап, өз моделіңізге беріңіз. Ол NCF құжаттамасына сүйеніп, таңдаған мысалды өз тіліңізде егжей-тегжейлі түсіндіреді.</p>',
      },
      {
        html: '<h3>Қолданбалар мен әңгімелерді дайындау</h3><p>Әр қосымшаны немесе профилін бір рет баптау жеткілікті. Содан кейін жаңа чаттар таңдаған атыңызбен қосыла алады.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">баптау нұсқаулығы</a></p>',
      },
      {
        html: '<h3>AI агенттері барлық жаңа хабарларда жұмыс істейді; NCF Agent Interconnect хабарлар мен файлдарды тасымалдайды.</h3><p>Бұл жағдайда сіз Mac үстінде жұмыс істейсіз, ал өзіңіздің пайдаланушыларыңызға арналған қолданбаны Windows жүйесінде орналасқан жеке компьютерде тексересіз. Сіз әлі бірнеше ИИ-қызметтерін пайдаланып жатырсыз: тапсырмаларға сәйкес модельдерді таңдап алып, шығындарды бақылап отырсыз.</p><p>OpenCode чатында жұмысты координирлейтін агент Morgan. Басқа қатысушылардың өзінің чаттары бар; Windows-тағы тексерулер Codex-те өтеді. Кейінірек Cursor немесе басқа конфигурацияланған қосымшада жаңа агентті қосуға болады.</p><p>Бастапқы баптаудан кейін әрбір жұмысқа қатысатын чатқа атау беріңіз. Негізгі чатта үйлестіру ережелерін орнатыңыз. Jade Morgan-ге Windows-тағы тексерулерге жауапты болатынын хабарлады; одан әрі тапсырмаларды координатор чатына қоюға болады.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">баптау нұсқаулығы</a></p>',
      },
      {
        html: '<p>Жұмыс аяқталған тапсырмаларды қабылдау ережесін координаторға жеке орнатыңыз. Жаңа қатысушылар қосылған сайын Morgan оларға жұмыс нұсқауларын береді және барлық жұмыс бағыттарын қадағалайды. Әңгімеге қосылғанда чаттың атын анықтаңыз және агенттің рөлін көрсетіңіз; тапсырмалар Morgan агенттің өзінің рөлін хабарлағаннан кейін бөлінеді.</p>',
      },
      {
        html: '<p>Жаңа функция үшін Leo жауапты, ал Morgan даму барысын бақылайды.</p>',
      },
      {
        html: '<h3>Нәтижелерді жұмыс үлгілеріне жіберіңіз</h3>\n        <p>Кейінірек екі байланысты пайдаланушы сұранысы келеді. Сіз талдау үшін жеке чат ашасыз, Morgan сұраныстарды Alice-ге тапсырады және оны Leo-мен таныстырады, ол NCF Agent Interconnect жаңа функциясына жауапты. Alice екі сұраныстың артында бір қажеттілік бар екенін анықтайды: пайдаланушылар әр күн сайын бірдей іздеу шарттарын қайта баптайды. Ол өз қорытындысын бірден Leo-ның сақталған фильтрлерді әзірлейтін чатына жібереді.</p>',
      },
      {
        html: '<p>Сұрақ, нақтылау немесе нәтиже тиісті жұмыс чатына түседі. Әр агент өз ортасында бапталған құралдар мен нұсқауларды пайдаланады. Толығырақ <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">қолданбалар нұсқаулығында</a>.</p>',
      },
      {
        html: '<h3>Windows қатесін анықтаңыз</h3>\n        <p>Пайдаланушы Windows-та импортталау жұмыс істемейтінін хабарлайды. Функцияны әзірлеу және сұрауларды талдау басқа агенттермен айналысады. Windows-тағы Jade чаты алдын ала қосылған, сондықтан Morgan оған қателерді қайталауды тапсырады.</p>',
      },
      {
        html: '<p>Jade қателерді қайтарып, Morgan чатқа тікелей растау материалдарын жібереді. Пайдаланушы күн сайын қалыпты жұмыс істеу мүмкін емес екенін растайды. Сіз Morgan-ге бұл релистің басымдығын қалай өзгертетінін хабарлайсыз.</p>',
      },
      {
        html: '<p>Командаға функцияны орындауды тоқтатпай жаңа агентті қосуға болады. Morgan Sam-ге қайталау қадамдарын береді, жауапкершілік аймақтарын біріктіреді және Windows-та тестілеуді ұйымдастырады. Координатор өзгерістерді бөлек сақтайды, сонда түзетуді бірінші рет шығаруға болады. Sam түзетуге жауапты, Jade оны Windows-та тексереді, ал сүзгілер мен сұраныстарды талдау процесі өз чаттарында жалғасады. Сіз релиздердің тәртібін өзгертіп, жұмыс барысында орындаушыны қосасыз.</p>',
      },
      {
        html: '<h3>Ранее выполненные работы поднимите</h3><p>Сіз еске түсіресіз, өткен чатта импорттың жұмысындағы мәселелерді өткізген едік. Oscar өзіне қолжетімді тарихы мен материалдарын көтере алады, сол кезде қабылданған шешімдерді түсіндіре алады және мысалдар береді. Sam қателерді түзету кезінде осы мәліметтерді пайдаланады, ал Jade жаңа іске асыруды тексеру кезінде пайдаланады.</p>',
      },
      {
        html: '<h3>Файлдар, жауаптар және тарих</h3><p>Хабарлар тарихы мен тіркемелердің көшірмелері қатысушылардың компьютерлерінде жергілікті сақталады. Сақтау мен файл жіберу тәртібі <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">деректер нұсқаулығында</a>, ал басқа чатта жалғастыру жолы <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">үстел қолданбасының нұсқаулығында</a> берілген.</p>',
      },
      {
        html: '<h3>NCF Agent Interconnect агенттер өздері тексерулер мен түзетулерді келіседі.</h3>\n        <p>Бұл мысалда Sam Mac-те Cursor-де жұмыс істейді, ал Jade Windows-те Codex-те қосымшаны тестілейді. Morgan OpenCode-ден дайын түзету туралы есеп алады және тәуелсіз тестілеуді тағайындайды. Кейін — агенттердің хат-хабарлары.</p>',
      },
      {
        html: '<h3>Үстелдік қосымша қажет болған кезде</h3><p>Әдеттегі жұмыста сіз ИИ-мен сөйлесуде қаласыз. Қосылымды тексеру немесе сақталған деректерді басқару үшін NCF Agent Interconnect үстелдің терезесін ашыңыз.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">баптау нұсқаулығы</a></p>',
      },
      {
        html: '<p>Агенттер өз жұмыс чаттарында қалып, NCF Agent Interconnect арқылы хабар алмасады. Әр қолданбаны баптау <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">нұсқаулықта</a> көрсетілген.</p>',
      },
      {
        html: '<p>Үстел қолданбасында агенттің тарихын қарап, қажет болса жергілікті деректерін өшіруге болады. Ненің өшірілетіні <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">агенттерді басқару нұсқаулығында</a> жазылған.</p>',
      },
      {
        html: '<p>Jade нәтижесін тікелей Morgan-ге хабарлайды. Sam және Jade бір-бірімен ағымдағы ескертуді қалған тапсырмалар бойынша жұмыс жүргізіліп жатқанда шешеді. Егер жағдай өзгерсе, сіз контекстті қосуға немесе координатордың чатында мақсатты түзетуге болады. Сізге әрбір ескертуді жіберіп, әрбір қайталауды растаудың қажеті жоқ.</p>',
      },
      {
        html: '<h3>Егер хат алмасу тоқтаса</h3><p>Хабар алмасу тоқтаса, NCF Agent Interconnect іске қосылғанын және керек чат қосылғанын тексеріңіз. Келесі қадамдар <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">баптау нұсқаулығында</a>.</p>',
      },
      {
        html: '<h3>Нәтижені қарап, не жариялау керегін шешіңіз</h3><p>Morgan жариялаудан бұрын сізге біріккен есеп дайындайды: қандай өзгерістер енгізілді, қандай тексерулер Windows-та өткізілді, қандай сұрақтар ашық қалды және релизге қосу ұсынылды. Сіз өзгеріс пайдаланушының мәселесін шешетінін бағалап, шығарудың құрамын таңдайсыз. Сақталған сүзгілер бойынша жұмыстар бөлек жалғасады.</p>',
      },
    ],
  },
  ja: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — つながったチャットの物語',
      skip: 'コンテンツにスキップする',
      brandLabel: 'NCF Agent Interconnect — ページの先頭へ',
      navLabel: 'メインナビゲーション',
      languageLabel: '言語',
      languageMenuTitle: '言語を選択する',
      closeLanguageMenu: '言語選択を閉じる',
      navStory: '「物語」',
      navGuide: 'フィールドガイド',
      navStart: '「始めよう」',
      galleryPageTitle: '画像アーカイブ — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — 物語へ戻る',
      galleryNavLabel: 'イメージアーカイブナビゲーション',
      galleryBack: '物語に戻ります',
      galleryEyebrow: '画像アーカイブ',
      galleryTitle: 'すべてのオリジナルイラスト',
      galleryIntro:
        'すべての画像はこのプロトタイプに残っています。漫画ではもはやフルサイズで使用されていない画像も含まれます。各キャプションはアセットのファイル名です。',
      galleryDeveloper: '開発者',
      galleryAgents: 'エージェントタブレット',
      galleryBrand: 'ブランディングアセット',
      galleryHeroAlt: '開発者のデスク、ヒーローのイラスト',
      gallerySceneAlt: '開発者のデスク、シーン {number}',
      galleryReadingAlt: '開発者がNCF Agent Interconnectの本を読んでいる、シーン13',
      galleryAgentAlt: 'エージェント{name}のタブレットポートレート',
      galleryIconAlt: 'NCF Agent Interconnectアプリアイコン',
      heroEyebrow: '日常のAIチャットから生まれた物語',
      heroTitle: 'ひとりの開発者。<br /><em>複数のチャット。</em>',
      heroLede:
        'バグと新機能をめぐり、エージェントが必要な情報をどう引き継ぐかを追います。方針を決めるのはあなた。NCF Agent Interconnect がメッセージと許可されたファイルを適切なチャットへ届けます。',
      download: 'アプリをダウンロードする',
      readStory: '物語を読む',
      storyEyebrow: '1人の開発者の物語',
      storyTitle: 'エージェントが協力して作業する',
      storyLede:
        '1人の人物が、なじみ深いAIチャット間でアプリを維持しています。エージェント Morgan は Mac の OpenCode で調整を担当し、エージェント Jade は Windows の Codex でチェックを実行し、エージェント Sam は Mac の Cursor でバグを修正します。エージェントの名前はあなたが選択できます。この物語に登場する役割、スキル、ツールはすべて例示であり、NCF Agent Interconnect はそれらを提供していません。',
      guideEyebrow: '「動く部分は常にクリアにしておく」',
      guideTitle: '作業はチャットで進み、アプリがメッセージを届けます。',
      startEyebrow: '2つのチャットから開始します',
      startTitle: '名前を付けて、メッセージを送る。',
      startLede:
        'デスクトップアプリをインストールし、使用するAIアプリケーションを設定し、異なる名前で2つのチャットを接続し、1つのエージェントに相手と連絡を取るよう依頼します。',
      setupGuide: '設定ガイドを開く',
      downloadNote:
        'インストーラ: Apple Silicon Mac DMG、Intel Mac DMG、Windows x64 EXE。macOS 13以降。IntelランタイムはIntelハードウェア上でテストされていません。Linux用インストーラは公開されていません。',
      footerTagline: '既存のAIチャット内のエージェント間のメッセージ',
      usageGuide: 'ユーザーガイド',
      license: 'ライセンス',
      systemNote: '注記',
      exampleExchange: 'チャット',
      activityLabel: '「図示活動」',
      reader: '他のチャットが正常に動作している間、離脱できます。',
      developerAlt: '開発者は机の上に目に見えるコンピュータを備えた状態で座り続けている。',
      readingAlt: '開発者はデスクでNCF Agent Interconnectに関する本を読んでいる。',
      agentAlt:
        '正面を向いたタブレットに映るエージェント {name} の顔。下にツールのアイコンがあります。',
      names: {
        user: 'あなた',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'チャットを設定する',
        'NCF Agent Interconnectをインストールし、目的のクライアント構成を選択し、ApplyをクリックしてからMCPを再接続し、メッセージの送受信をテストします。',
        'セットアップガイド',
      ],
      [
        'クライアントを理解する',
        'OpenCode、CodexおよびCursorは、異なるShip動作および設定要件を有しています。',
        'クライアント詳細',
      ],
      [
        'データを制御する',
        'ファイル、ローカル履歴、正確なチャットバインディング、名前転送、削除範囲を確認する。',
        'デスクトップコントロール',
      ],
      [
        '参照の全文を読む',
        'ユーザーガイドとLLM向けリファレンスには、この図解されたストーリーの裏にある完全な手順と制限が含まれています。',
        'llms.txt を読む',
      ],
    ],
    scenes: [
      {
        title: '作業に調整担当者を割り当てる',
        lines: [
          'Morganとして接続する。協調スキルを使用してすべてのエージェントを調整し、全体の作業を把握する。各参加者に自身の作業ルールを送信する。作業の境界、Gitブランチ、実装および統合の順序、紛争解決を調整する。作業が重複する際にはエージェント同士を連絡させ、知識共有を調整し、関連する決定や変更について情報を共有する。独立したタスクを並行して進める。私に判断を要する統合された結果および決定を提示する。',
          'エージェントMorganとして接続されました。私はエージェントを調整し、作業を追跡して、あなたの入力が必要な結果と意思決定を提供します。',
        ],
        statuses: ['調整規則の準備'],
      },
      {
        title: 'Windowsスペシャリストに接続する',
        lines: [
          'Jadeエージェントとして接続する。このプロジェクトのWindows環境における検証はあなたに責任がある。Morganが作業を調整しているため、指示は彼女に求める。',
          'エージェントJadeとして接続済み。私はWindows検証の担当です。Morganに自分の役割を伝えて指示を求めます。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Morganは、Windowsを処理する担当者を把握しています。',
        lines: [
          'エージェントJadeとして接続済み。私はWindowsでのプロジェクト検証を担当しており、指示を待機しています。',
          '受信しました。Windowsのチェックをあなたにルーティングし、結果を調整します。',
        ],
        statuses: ['JadeをWindows検証計画に追加する'],
      },
      {
        title: '独立したチェックをルールとする',
        lines: [
          '完了報告されたすべてのタスクを、結果に応じた適切なチェックを用いて、別のエージェントに独立したテストのために送信する。作業を実施したエージェントの名前を明記し、テスト担当者に修正対応を直接そのエージェントと調整するよう依頼する。テスト担当者は、チェック内容、テスト結果および残存する問題をあなたに報告しなければならない。テスト担当者がタスクが合格することを確認した後、のみタスクを承認する。',
          '分かった。完了報告されたすべてのタスクを、独立した検証のために別のエージェントに送信します。',
        ],
        statuses: ['独立チェックルールの設定'],
      },
      {
        title: '実装エージェントを接続する',
        lines: [
          'エージェント Leoとして接続する。あなたの役割は実装である。Morganが作業を調整するので、指示を彼女に求めること。',
          'エージェントLeoとして接続済み。実装を担当。Morganに自分の役割を伝えてタスクを依頼する。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Morganに機能を説明する',
        lines: [
          'タスク#T-1042はユーザが検索条件を再利用できるように保存されたフィルターです. 他の作業が進行している間に実施を組織する.',
          'Leoは #T-1042を自分のチャットで実装します 作業を追跡し 完成した報告をすると 独立したチェックをします',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Leoは機能を受け取ります',
        lines: [
          '#T-1042: 保存されたフィルタを作成して,ユーザが検索条件を再利用できます. この作業を他の作業から切り離して,結果を私に報告する.',
          '私は #T-1042を取って 捜索条件がどう機能するかを確認します',
        ],
        statuses: ['現在の検索実装のレビュー', '保存フィルターの動作を計画する'],
      },
      {
        title: '分析エージェントを接続する',
        lines: [
          'Aliceとして接続する。あなたの役割は分析である。Morganが作業を調整しており、指示は彼女に求める。',
          'エージェントAliceとして接続済み。要求分析を担当。Morganに私の役割を伝えて指示を求めます。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: '関連するリクエストをMorganに提出する',
        lines: [
          '#I-0201と #I-0202の要求は,同じ必要性を記述することができる. Figma の既存の検索画面をチェックし,その発見を #T-1042 に関連付けます.',
          'Aliceは両方のリクエストとFigmaスクリーンを分析します。私は彼女をLeoとつなぎ、発見がsaved-filterワークに到達するようにします。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Aliceはニーズを調査する',
        lines: [
          '#I-0201 と #I-0202 の 問題 を レビュー する ため に 分析 技巧 を 使う. Figmaの既存の検索画面をチェックし,ユーザーの潜在的ニーズを特定し,関連する発見をLeoと共有します.',
          '両方のリクエストを現在の画面と比較した後、Leoに調査結果を送信します。',
        ],
        statuses: ['両方のリクエストを読み取り', 'Figmaで検索画面をチェックする'],
      },
      {
        title: '発見が作業チャットに届くように',
        lines: [
          '問題 #I-0201と #I-0202は同じ検索条件の再利用についてです タスク #T-1042は 完全な組み合わせを保存できますか?',
          '- そうだ ユーザーも共有する必要があるかどうか確認してください. 私はこれをタスク #T-1042から別にしておきます.',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Windows バグにより計画が変更されます',
        lines: [
          'Windows でインポートに失敗します。バグ #B-0317 が起きるインポートファイルを添付します。原因を調べ、分かったことを報告してください。',
          'Jade が Windows で #B-0317 を再現し、手順と証拠を送ります。バグを確認できたら、修正と独立した検証を手配します。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Jade は Windows バグをチェックします',
        lines: [
          '検証スキルを使い、添付したインポートファイルで Windows 上のバグ #B-0317 を再現してください。再現手順と証拠を送ってください。',
          'インポートを確認して結果を送ります',
        ],
        statuses: ['インポートファイルを開く', 'Windowsでのインポート確認'],
      },
      {
        title: '証拠はコーディネーターに到達します',
        lines: [
          'Windows でインポートに失敗します。#B-0317 の再現手順と証拠を送ります。',
          '受信しました。結果を報告し、修正担当者に備えとして証拠を保持します。',
        ],
        statuses: ['バグレポートの作成'],
      },
      {
        title: '別の開発者を接続する',
        lines: [
          'エージェント Samとして接続する。あなたの役割は実装である。Morganが作業を調整するので、指示を彼女に求めること。',
          'エージェントSamとして接続済み 実装を担当 私はMorganに自分の役割を説明し、割り当てを依頼する',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: '結果は優先順位を変更する',
        lines: [
          'Jade が Windows で #B-0317 を再現し、手順と証拠を送りました。インポートの失敗は確認済みです。',
          'このバグは日々の作業を妨げています。まず #B-0317 の修正をリリースしてください。#T-1042 が間に合わなければ、次のリリースに回して構いません。その作業は続けてください。',
          '了解しました。Sam が #B-0317 を修正し、Jade が Windows で独立して検証します。#T-1042 は別の作業として進めます。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Samはフィックスを受けます',
        lines: [
          '実装スキルを使ってバグ #B-0317 を修正してください。Jade が Windows で再現しました。手順と証拠を送ります。修正は #T-1042 と分け、検証の詳細は Jade と直接調整してください。',
          '#B-0317 を調べて修正し、独立したテスト用の候補を送ります。',
        ],
        statuses: ['再現手順を確認する', 'インポートコードのチェック'],
      },
      {
        title: '以前の調査を思い出してください',
        lines: [
          'タスク #T-0870 で行った以前のインポート調査が #B-0317 の参考になるかもしれません。当時の決定と関連する例を探してください。',
          'Oscar は #T-0870 を担当しました。決定事項と例を尋ね、Sam と Jade に共有します。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: 'Morganは以前の知識を求めています',
        lines: [
          'タスク #T-0870 でインポートを調査しましたね。以前の決定と、バグ #B-0317 に関係する例を確認し、Sam と Jade に共有してください。',
          '私は利用可能な履歴と資料を確認した後、関連する例を送信します。',
        ],
        statuses: ['審査タスク #T-0870'],
      },
      {
        title: '以前の決定が開発者に伝達されます',
        lines: [
          '以前のインポート決定事項と例を見つけました。送ります。',
          '受信しました。修正に使用します。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: '同じ例がテストに到達します',
        lines: [
          '同じインポート例が Windows での検証にも役立つかもしれません。送ります。',
          '受信しました。チェックに含めます。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: '一方、作業は継続中です。',
        lines: [],
        statuses: [],
      },
      {
        title: '最初の候補は準備ができている',
        lines: [
          'バグ #B-0317 を修正しました。独立したテスト用の候補を送ります。',
          '受信しました。Jadeに独立したWindowsチェックを依頼します。',
        ],
        statuses: ['NCF Agent Interconnect を使用中', 'メッセージを送信しました'],
      },
      {
        title: '別のエージェントがそれをテストする',
        lines: [
          'Sam が実装したバグ #B-0317 の修正候補を Windows でテストしてください。検証スキルを使い、欠陥が見つかったら Sam と直接調整してください。テストが通ったら結果を送り、妨げとなる問題があれば報告してください。',
          'Windowsでテストを行い、不具合を発見した場合はSamと直接連携して対応します。',
        ],
        statuses: ['候補の修正をレビューする', 'Windowsでのインポートテスト'],
      },
      {
        title: '2番目のケースが失敗',
        lines: [
          'バグ #B-0317 について、元のファイルはインポートできますが、Oscar のサンプルでは行が重複します。このケースも修正してください。',
          '重複行のケースを修正し、修正済みの候補を送信します。',
        ],
        statuses: ['重複行を再現する'],
      },
      {
        title: '修正して、再度テストする',
        lines: [
          '重複行のケースは修正済みです。改訂された候補をこちらに示します。このケースと元のインポートを再実行してください。',
          '二つのインポート例と既存の回帰テストを再実行します。',
        ],
        statuses: [
          '両方のインポートサンプルを再実行する',
          '既存のレグレーションチェックを実行する',
        ],
      },
      {
        title: '独立した結果が到着します',
        lines: [
          'Sam の修正版で、バグ #B-0317 は Windows の検証に合格しました。二つのインポート例と既存の回帰テストはすべて成功し、確認した範囲で未解決の問題はありません。',
          '受信しました。受け入れられた修正をリリース提案に含めます。',
        ],
        statuses: ['リリース提案の作成'],
      },
      {
        title: '何を公開するかは、あなたが決める',
        lines: [
          'バグ#B-0317とタスク#T-1042と問題#I-0201と#I-0202をまとめます. 今までの結果を教えてくれ 次に何が起こるか 必要な決断を',
          '各項目についてステータスを準備し、あなたが決定する必要があるものをマークします。',
        ],
        statuses: ['全4項目の結果を統合中'],
      },
    ],
    notes: [
      {
        html: '<p>成長するアプリケーションを一人で維持しています。ロードマップ機能の開発中にバグレポートが届き、新しいユーザーからの要望も対応が必要です。NCF Agent Interconnectにより、普段使用しているチャット内のAIエージェントがこれらのタスクを連携して処理できます。質問、発見、ファイルがエージェント間を直接やり取りし、あなたが方向を設定し、作業用チャットで結果を受け取れます。</p><p>このガイドでは、ある開発者がその状況を経験する様子を追います。あなたが物語の中で唯一の人物であり、名前が付けられたすべての参加者はAIエージェントです。彼らの名前や役割は、各自が独自に置き換えることができる例です。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 個の用意されたプロンプト</a>から一つ選び、使っているモデルに渡してください。NCF のドキュメントに基づき、その例を詳しく説明するガイドが選択した言語で作成されます。</p>',
      },
      {
        html: '<h3>アプリケーションおよびチャットの準備を進めてください</h3><p>各アプリケーションまたはプロフィールを一度設定します。以降、新しいチャットは、あなたが選択した名前で接続することで参加します。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">設定ガイド</a></p>',
      },
      {
        html: '<h3>通常のチャットで作業を行う</h3><p>この物語では、Macで作業し、ユーザーが実行するアプリケーションを確認するためにWindowsコンピュータを用意しています。すでに複数のAIサービスを活用しており、作業に適したモデルを選定し、コストを最適化しています。</p><p>AIエージェント Morgan は OpenCode で調整を行っています。他の参加者はそれぞれ独自のチャットを使用しており、Windows のチェックは Codex で実行されます。新しい参加者は後ほど Cursor または他の設定済みアプリケーションに参加できるようになります。</p><p>最初の設定後、参加する各チャットに名前を付けてください。メインチャットでは調整ルールを確立してください。JadeはすでにMorganにWindows検証の役割を伝えており、以降の作業は調整チャットを通じて指示できます。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">設定ガイド</a></p>',
      },
      {
        html: '<p>AIコーディネーターに完了した作業を受け入れるための別々のルールを設定します。AIコーディネーターは参加者がチャットに参加するタイミングで作業指示を送信し、すべてのタスクにおける進捗を追跡します。参加者を接続する際には、そのチャットに名前と役割を割り当てます。Morganはエージェントが役割を報告した後に、作業を割り当てます。</p>',
      },
      {
        html: '<p>AIエージェント Leo がこの機能を担当しています。AIコーディネーターはその進捗を追跡しています。</p>',
      },
      {
        html: '<h3>調査結果を作業中のチャットへ届ける</h3>\n        <p>その後、2 つの関連するユーザリクエストが到着する。あなたは別の分析チャットを開く。Morgan は Alice にリクエストを割り当て、機能の所有者と連絡を取る。AIエージェント Alice は、両方のリクエストが同じニーズを記述していることを発見する。ユーザーは毎日同一の検索条件を再現する必要がある。彼女はその発見を、保存フィルター機能が構築されているチャットに直接送信する。</p>',
      },
      {
        html: '<p>質問や補足、結果は、必要な作業チャットに届きます。各エージェントは、それぞれの環境に設定されたツールや指示を使います。詳しくは<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">アプリ別ガイド</a>をご覧ください。</p>',
      },
      {
        html: '<h3>Windowsバグを調査する</h3>\n        <p>Windowsでインポートが失敗したとユーザーが報告している。機能およびリクエスト分析にはすでに参加者がいる。JadeのWindowsチャットが接続されているため、Morganは彼女にその失敗を再現するよう依頼する。</p>',
      },
      {
        html: '<p>AIエージェントのJade、テスト担当者が障害を再現し、証拠を直接調整チャットに送信します。ユーザーが問題が日常業務を妨げていることを確認します。AIエージェントMorganに、リリース優先度がどのように変更されたかを伝えてください。</p>',
      },
      {
        html: '<p>機能の進行中にチームを拡大できます。AIエージェントMorganは再現手順を共有し、作業の範囲を合意した上でWindowsでの検証を調整します。AIコーディネーターは変更を分離して管理することで、修正が先にリリース可能になります。AIエージェントSamが修正を担当し、JadeがWindows環境での動作を検証します。保存済みのフィルターとリクエスト解析は、元のチャットで継続されます。作業が進行中のうちにリリース順序を変更し、追加のリソースを投入しました。</p>',
      },
      {
        html: '<h3>タスクに以前の知識を再導入する</h3><p>古いチャットにはインポート動作の調査が含まれています。AIエージェントのOscarは、自身が利用可能な履歴および資料をレビューし、以前の意思決定を説明し、例を共有できます。AI開発者はその知識を修正に活用し、AIテストはその例を用いて今日の実装との整合性を確認します。</p>',
      },
      {
        html: '<h3>ファイル、返信、履歴</h3><p>メッセージ履歴と添付ファイルのコピーは、参加者のコンピューターにローカル保存されます。保存とファイル転送は<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">データガイド</a>、別のチャットへの引き継ぎは<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">デスクトップ操作ガイド</a>で説明しています。</p>',
      },
      {
        html: '<h3>エージェント間でテストと修正を進める</h3>\n        <p>この例では、AIエージェント Sam が Mac の Cursor で作業し、Jade が Windows の Codex でテストを実行する。AIコーディネーターは OpenCode で完成報告を受け取り、独立チェックを割り当てる。次のやり取りで、エージェントがどのように連携して作業を進めるかが示される。</p>',
      },
      {
        html: '<h3>必要なときに管理する</h3><p>通常の作業はAIチャットに留まります。接続を確認する必要がある場合や保存されたデータを管理する必要がある場合は、デスクトップアプリで以下のコントロールが利用可能です。</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">設定ガイド</a></p>',
      },
      {
        html: '<p>エージェントは各自の作業チャットにいながら、NCF Agent Interconnect を通じてメッセージを交換します。アプリごとの設定は<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">ガイド</a>をご覧ください。</p>',
      },
      {
        html: '<p>デスクトップアプリでは、エージェントの履歴を確認し、必要に応じてローカルデータを削除できます。削除対象は<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">エージェント管理ガイド</a>で説明しています。</p>',
      },
      {
        html: '<p>AIエージェント JadeはMorganに直接報告します。AIエージェント SamとJadeは、他のタスクが進行している間も、日常的な調査結果を共同で解決します。状況に変更があるたびに、調整チャットでコンテキストを追加したり、目標を調整できます。個々の修正を伝達する必要も、個々の再テストを承認する必要もありません。</p>',
      },
      {
        html: '<h3>やり取りが止まったら接続を確認する</h3><p>やり取りが止まったら、NCF Agent Interconnect が起動しているか、対象のチャットが接続されているか確認してください。続きは<a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">設定ガイド</a>をご覧ください。</p>',
      },
      {
        html: '<h3>結果を受け取り、公開内容を決める</h3><p>発表前に AIエージェント Morgan が結果について1つのレポートを提供します。変更内容、Windowsでのチェック対象、未解決事項、リリース予定の内容を確認します。ユーザーの問題を解決しているかを評価し、どのソフトウェアがリリースされるかを決定します。保存済みのフィルターはそれぞれ自身の結果に向けて継続します。</p>',
      },
    ],
  },
  'pt-BR': {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Uma história de chats conectados',
      skip: 'Pular para o conteúdo',
      brandLabel: 'NCF Agent Interconnect — topo',
      navLabel: 'Navegação principal',
      languageLabel: 'Língua',
      languageMenuTitle: 'Escolha um idioma',
      closeLanguageMenu: 'Fechar seleção de idioma',
      navStory: 'A história',
      navGuide: 'Guia de campo',
      navStart: 'Inicie agora',
      galleryPageTitle: 'Arquivo de imagens — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — voltando para a história',
      galleryNavLabel: 'Navegação de arquivo de imagem',
      galleryBack: 'Voltamos à história.',
      galleryEyebrow: 'Arquivo de imagens',
      galleryTitle: 'Cada ilustração original',
      galleryIntro:
        'Todas as imagens permanecem neste protótipo, incluindo aquelas que não são mais usadas em tamanho completo no quadrinho. Cada legenda é o nome do arquivo do ativo.',
      galleryDeveloper: 'Desenvolvedor',
      galleryAgents: 'Tabletas de Agente',
      galleryBrand: 'Ativos da marca',
      galleryHeroAlt: 'Desenvolvedor na mesa, ilustração heroica',
      gallerySceneAlt: 'Desenvolvedor à mesa, cena {number}',
      galleryReadingAlt: 'Desenvolvedor lendo o livro NCF Agent Interconnect, cena 13',
      galleryAgentAlt: 'Retrato do agente {name}',
      galleryIconAlt: 'Ícone do aplicativo NCF Agent Interconnect',
      heroEyebrow: 'Uma história de suas conversas diárias de IA',
      heroTitle: 'Um desenvolvedor.<br /><em>Várias conversas de trabalho.</em>',
      heroLede:
        'Acompanhe um bug, uma nova funcionalidade e os agentes que trocam informações úteis. Você define o rumo; o NCF Agent Interconnect leva mensagens e arquivos autorizados à conversa certa.',
      download: 'Baixar o aplicativo',
      readStory: 'Leia a história',
      storyEyebrow: 'A história de um desenvolvedor',
      storyTitle: 'Os agentes trabalham juntos',
      storyLede:
        'Uma pessoa mantém um aplicativo através de chats de IA familiares. O agente Morgan coordena no OpenCode no Mac; o agente Jade verifica o Windows no Codex, e o agente Sam corrige o erro no Cursor no Mac. Você escolhe os nomes dos agentes. Os papéis, as habilidades e as ferramentas nesta história são exemplos; a NCF Agent Interconnect não os fornece.',
      guideEyebrow: 'Mantenha as partes móveis claras',
      guideTitle: 'O trabalho acontece nos chats. O aplicativo encaminha as mensagens.',
      startEyebrow: 'Comece com duas conversas',
      startTitle: 'Dê a eles nomes. Envie uma mensagem.',
      startLede:
        'Instale o aplicativo desktop, configure as aplicações de IA que utiliza, conecte duas conversas com nomes diferentes e solicite a um agente que entre em contato com o outro.',
      setupGuide: 'Abrir o guia de configuração',
      downloadNote:
        'Instaladores: Apple Silicon Mac DMG, Intel Mac DMG e Windows x64 EXE. macOS 13 ou posterior. O tempo de execução da Intel não foi testado em hardware Intel; nenhum instalador Linux foi publicado.',
      footerTagline: 'Mensagens entre agentes em suas conversas de IA existentes.',
      usageGuide: 'Guia do usuário',
      license: 'Licença',
      systemNote: 'Nota',
      exampleExchange: 'Chat',
      activityLabel: 'Atividade ilustrativa',
      reader: 'Enquanto outros chats funcionam, você pode se afastar.',
      developerAlt: 'O desenvolvedor permanece sentado em uma mesa com um computador visível.',
      readingAlt: 'O desenvolvedor lê um livro sobre NCF Agent Interconnect na secretária.',
      agentAlt: 'Retrato de cabeça de {name} dentro de um tablet frontal com ícones de ferramenta.',
      names: {
        user: 'Você',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Configure suas conversas',
        'Instale o NCF Agent Interconnect, selecione a configuração de cliente desejada, clique em Apply, reconecte o MCP e teste uma troca.',
        'Guia de configuração',
      ],
      [
        'Conheça o seu cliente',
        'OpenCode, Codex e Cursor possuem diferentes comportamentos de entrega e requisitos de configuração.',
        'Detalhes do cliente',
      ],
      [
        'Controle seus dados',
        'Revisão de arquivos, histórico local, associações exatas de bate-papo, transferências de nomes e escopo de exclusão.',
        'Controle de desktop',
      ],
      [
        'Leia a referência completa',
        'O guia do usuário e a referência orientada para o LLM contêm os procedimentos completos e os limites por trás desta história ilustrada.',
        'Leia llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Dê ao trabalho um coordenador',
        lines: [
          'Conecte-se como agente Morgan. Utilize a habilidade de coordenação para coordenar todos os agentes e acompanhar o trabalho como um todo. Envie a cada participante as suas regras de trabalho. Coordenar limites de trabalho, ramificações Git, ordem de implementação e integração, e resolução de conflitos. Coloque os agentes em contato quando seus trabalhos se sobrepõem, organize a compartilhamento de conhecimento e mantenha-os informados sobre decisões e alterações relevantes. Mantenha tarefas independentes em andamento paralelo. Envie-me resultados consolidados e decisões que precisam da minha avaliação.',
          'Conectada como agente Morgan. Vou coordenar os agentes, rastrear o trabalho deles e trazer resultados e decisões que precisam da sua avaliação.',
        ],
        statuses: ['Preparação das regras de coordenação'],
      },
      {
        title: 'Conectar o especialista Windows',
        lines: [
          'Conecte-se como agente Jade. Você é responsável por verificar este projeto no Windows. Morgan coordena o trabalho; solicite instruções a ela.',
          'Conectada como agente Jade. Sou responsável pela verificação do Windows. Vou informar ao Morgan minha função e pedir instruções.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Morgan descobre quem gerencia o Windows',
        lines: [
          'Conectado como agente Jade. Eu realizo a verificação do projeto no Windows e estou pronto para suas instruções.',
          'Recebido. Vou encaminhar os testes Windows para você e coordenar os resultados.',
        ],
        statuses: ['Adição de Jade ao plano de verificação Windows'],
      },
      {
        title: 'Tornar as verificações independentes uma regra',
        lines: [
          'Enviar todas as tarefas reportadas como concluídas a outro agente para testes independentes, utilizando verificações adequadas ao resultado. Nomear o agente que realizou o trabalho e solicitar ao testador para coordenar qualquer correção diretamente com ele. O testador deve reportar as verificações, o resultado e os problemas remanescentes a você. Aceitar a tarefa somente após o testador confirmar que ela passa.',
          'Entendido. Vou enviar cada tarefa reportada como concluída para outro agente para testes independentes.',
        ],
        statuses: ['Definição da regra de verificação independente'],
      },
      {
        title: 'Conectar um agente de implementação',
        lines: [
          'Conecte-se como agente Leo. O seu papel é a implementação. Morgan coordena o trabalho; peça-lhe instruções.',
          'Conectado como agente Leo. Eu cuido da implementação. Vou informar à Morgan minha função e pedir uma atribuição.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Descrever o recurso para Morgan',
        lines: [
          'A tarefa #T-1042 é salvar filtros que permitem que os usuários reutilizem suas condições de pesquisa. Organizar a execução enquanto o outro trabalho prossegue.',
          'O Leo implementará o #T-1042 no seu próprio chat. Vou rastrear o trabalho e organizar uma verificação independente quando ele relatar a conclusão.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Leo recebe o recurso',
        lines: [
          'Use a habilidade de implementação para a tarefa #T-1042: criar filtros salvos para que os usuários possam reutilizar suas condições de pesquisa. Mantenha este trabalho separado de outras tarefas e informe-me o seu resultado.',
          'Vou levar o #T-1042 e primeiro inspecionar como as condições de busca funcionam agora.',
        ],
        statuses: [
          'Revisão da implementação atual da pesquisa',
          'Planejamento do comportamento de filtro salvo',
        ],
      },
      {
        title: 'Conectar um agente de análise',
        lines: [
          'Conecte-se como agente Alice. O seu papel é análise. Morgan coordena o trabalho; peça-lhe instruções.',
          'Conectada como agente Alice. Eu realizo a análise de solicitações. Vou informar ao Morgan minha função e pedir instruções.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Encaminhar os pedidos relacionados ao Morgan',
        lines: [
          'Os pedidos #I-0201 e #I-0202 podem descrever a mesma necessidade. Encontre o problema do usuário subjacente, verifique a tela de pesquisa existente no Figma e relacione a descoberta com #T-1042.',
          'A Alice analisará ambos os pedidos e a tela do Figma. Vou colocá-la em contato com o Leo para que a descoberta chegue ao trabalho de filtro salvo.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Alice investiga a necessidade de',
        lines: [
          'Use a habilidade de análise para revisar os problemas #I-0201 e #I-0202. Verifique a tela de busca existente no Figma, identifique a necessidade subjacente do utilizador e compartilhe os resultados relevantes com o Leo.',
          'Vou comparar ambas as solicitações com a tela atual, e depois enviar o achado para Leo.',
        ],
        statuses: ['Leitura de ambos os pedidos', 'Verificação da tela de pesquisa em Figma'],
      },
      {
        title: 'Permita que a descoberta alcance o bate-papo de trabalho',
        lines: [
          'As questões #I-0201 e #I-0202 são sobre a reutilização das mesmas condições de busca. A missão #T-1042 pode preservar a combinação completa?',
          '- Sim, sim, sim. Verifique se os usuários também precisam compartilhá-los; vou manter isso separado da tarefa #T-1042.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Um bug no Windows altera o plano',
        lines: [
          'A importação falhou no Windows. Estou a anexar o arquivo de importação que desencadeia o bug #B-0317. Investigue o problema e informe o que achar.',
          'O Jade irá reproduzir o #B-0317 no Windows e enviar-me os passos e evidências. Se o bug for confirmado, organizo a correção e uma verificação independente.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Jade realiza os testes no bug Windows',
        lines: [
          'Use a habilidade de verificação para reproduzir o bug #B-0317 no Windows com o arquivo de importação anexado. Envia-me os passos de reprodução e as provas.',
          'Vou verificar a importação e enviar-lhe o resultado.',
        ],
        statuses: ['Abrindo o arquivo de importação', 'Verificação da importação no Windows'],
      },
      {
        title: 'As provas chegam ao coordenador.',
        lines: [
          'A importação do Windows falha. Aqui estão os passos de reprodução e evidências para #B-0317.',
          'Recebido. Vou relatar o resultado e manter as evidências para o proprietário do reparo.',
        ],
        statuses: ['Preparando o relatório de bugs'],
      },
      {
        title: 'Conectar outro desenvolvedor',
        lines: [
          'Conecte-se como agente Sam. O seu papel é a implementação. Morgan coordena o trabalho; peça-lhe instruções.',
          'Conectado como agente Sam. Eu cuido da implementação. Vou informar à Morgan minha função e pedir uma atribuição.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'O resultado altera a prioridade',
        lines: [
          'O Jade reproduziu #B-0317 no Windows e enviou os passos e evidências. A falha de importação é confirmada.',
          'Este bug bloqueia o trabalho diário. Libere a correcção para o #B-0317 primeiro. Se a tarefa #T-1042 não estiver pronta, pode seguir na próxima versão. Mantém o trabalho em movimento.',
          'Eu entendo. O Sam vai corrigir o #B-0317, e o Jade irá verificá-lo de forma independente no Windows. Vou manter o #T-1042 em movimento separadamente.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Sam recebe a correção',
        lines: [
          'Use a habilidade de implementação para corrigir o bug #B-0317. A Jade reproduziu-o em Windows; aqui estão os seus passos e evidências. Mantenha a correção separada do #T-1042 e coordenar os detalhes de verificação diretamente com Jade.',
          'Vou investigar #B-0317, preparar a solução e enviar um candidato para testes independentes.',
        ],
        statuses: ['Revisão das etapas de reprodução', 'Verificação do código de importação'],
      },
      {
        title: 'Recorde uma investigação anterior',
        lines: [
          'Uma investigação anterior sobre importações na tarefa #T-0870 pode ajudar na #B-0317. Encontrar as decisões anteriores e quaisquer exemplos relevantes.',
          'Oscar trabalhou no #T-0870. Vou pedir-lhe as decisões e exemplos, e depois compartilhá-los com Sam e Jade.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Morgan pede conhecimento anterior',
        lines: [
          'Investigaste importações na tarefa #T-0870. Por favor, recupere as decisões anteriores e quaisquer exemplos relevantes para o bug #B-0317, e compartilhe-os com Sam e Jade.',
          'Vou revisar o histórico e os materiais disponíveis, e depois enviar os exemplos relevantes.',
        ],
        statuses: ['A tarefa de revisão #T-0870'],
      },
      {
        title: 'As decisões anteriores alcançam o desenvolvedor',
        lines: [
          'Encontrei as decisões de importação anteriores e exemplos. Enviando-as para você.',
          'Recebido. Vou usá-los na correção.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Os mesmos exemplos alcançam o testador',
        lines: [
          'Os mesmos exemplos de importação podem ajudar sua verificação no Windows. Enviando-os.',
          'Recebido. Vou incluí-los nas verificações.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Enquanto isso, o trabalho continua.',
        lines: [],
        statuses: [],
      },
      {
        title: 'O primeiro candidato está pronto',
        lines: [
          'Bug #B-0317 está corrigido. Aqui está o candidato para testes independentes.',
          'Recebido. Vou pedir ao Jade uma verificação independente do Windows.',
        ],
        statuses: ['Usando NCF Agent Interconnect', 'Mensagem enviada'],
      },
      {
        title: 'Um agente diferente o testa',
        lines: [
          'Teste o candidato para o bug #B-0317 no Windows. O Sam implementou-o. Use a habilidade de verificação e trabalhe diretamente com o Sam em quaisquer defeitos. Envie-me o seu próprio resultado de teste quando passarem os cheques, ou informe um bloqueador.',
          'Vou testá-lo no Windows e trabalhar com o Sam diretamente se encontrar um defeito.',
        ],
        statuses: ['Revisando a correção candidata', 'Teste de importação no Windows'],
      },
      {
        title: 'Um segundo caso falha',
        lines: [
          'Bug #B-0317: o arquivo original importa, mas a amostra do Oscar cria uma linha duplicada. Por favor, corrija esse caso.',
          'Vou corrigir o caso de linha duplicada e enviar um candidato revisado.',
        ],
        statuses: ['Reprodução da linha duplicada'],
      },
      {
        title: 'Corrigir, depois testar novamente.',
        lines: [
          'O caso de linha duplicada está corrigido. Aqui está o candidato revisado. Por favor, execute novamente esse caso e a importação original.',
          'Vou executar novamente ambas as importações e os testes de regressão existentes.',
        ],
        statuses: [
          'Reexecutando ambas as amostras de importação',
          'Execução de verificações de regressão existentes',
        ],
      },
      {
        title: 'O resultado independente chega',
        lines: [
          'O bug #B-0317 passou no Windows usando o candidato revisto do Sam. Ambas as amostras de importação foram aprovadas, juntamente com os controlos de regressão das importações existentes. Não restam problemas no âmbito de aplicação testado.',
          'Recebido. Vou incluir a correção aceita na proposta de liberação.',
        ],
        statuses: ['Preparação da proposta de liberação'],
      },
      {
        title: 'Você decide o que será lançado',
        lines: [
          'Resumir o bug #B-0317, tarefa #T-1042 e problemas #I-0201 e #I-0202. Para cada um, diga-me o resultado até agora, o que vem a seguir e qualquer decisão que precise de mim.',
          'Vou preparar um status para cada item e sinalizar as decisões que você precisa tomar.',
        ],
        statuses: ['Compilação dos resultados para os quatro itens'],
      },
    ],
    notes: [
      {
        html: '<p>Você mantém uma aplicação em crescimento sozinho. Relatórios de bugs chegam enquanto você desenvolve um recurso de roadmap, e novas solicitações de usuários também precisam de atenção. O NCF Agent Interconnect permite que os agentes de IA em seus chats habituais trabalhem nessas tarefas juntos. Perguntas, descobertas e arquivos viajam diretamente entre eles; você define a direção e recebe os resultados no seu chat de trabalho.</p><p>Este guia acompanha um desenvolvedor nessa situação. Você é o único humano na história; todos os participantes nomeados são agentes de IA. Seus nomes e papéis são exemplos que você pode substituir pelos seus.</p><p>Escolha um dos <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 prompts prontos</a> e envie ao seu modelo. Ele criará, no seu idioma, um guia detalhado do exemplo escolhido com base na documentação do NCF.</p>',
      },
      {
        html: '<h3>Prepare suas aplicações e chats</h3><p>Configure cada aplicação ou perfil uma vez. Novos chats então se conectam sob nomes escolhidos por você.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guia de configuração</a></p>',
      },
      {
        html: '<h3>Trabalhe nos seus chats habituais</h3><p>Nesta história, você trabalha em um Mac e mantém um computador Windows para verificar a aplicação que seus usuários executam. Você já usa vários serviços de IA, escolhendo modelos que se adaptam ao seu trabalho e equilibrando os custos.</p><p>O agente de IA Morgan coordena em OpenCode. Outros participantes têm seus próprios chats; as verificações Windows acontecem em Codex. Um novo participante poderia mais tarde se juntar ao Cursor ou a outra aplicação configurada.</p><p>Após a primeira configuração, atribua um nome a cada bate-papo participante. No seu chat principal, estabeleça as regras de coordenação. Jade já informou a Morgan sua função de verificação no Windows; você pode direcionar o trabalho posterior por meio do chat de coordenação.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">guia de configuração</a></p>',
      },
      {
        html: '<p>Dê ao coordenador de IA uma regra separada para aceitar o trabalho concluído. O coordenador de IA envia instruções de trabalho aos participantes à medida que se juntam e acompanha o progresso em todas as tarefas. Quando você conectar um participante, dê a esse chat um nome e um papel; Morgan atribui o trabalho depois que o agente relata esse papel.</p>',
      },
      {
        html: '<p>O agente de IA Leo é o responsável pelo recurso. O coordenador de IA acompanha o seu andamento.</p>',
      },
      {
        html: '<h3>Deixem que as descobertas cheguem às conversas de IA utilizadas para trabalho</h3>\n        <p>Mais tarde, chegam dois pedidos de usuário relacionados. Você abre outro chat de análise; Morgan atribui Alice os pedidos e coloca-a em contato com o proprietário do recurso. O agente de IA Alice descobre que ambos os pedidos descrevem a mesma necessidade: os usuários recriam as mesmas condições de pesquisa todos os dias. Ela envia a descoberta diretamente para o chat onde o recurso de filtro salvo está sendo desenvolvido.</p>',
      },
      {
        html: '<p>Perguntas, esclarecimentos e resultados chegam ao chat de trabalho certo. Cada agente usa as ferramentas e instruções configuradas em seu ambiente. Veja o <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guia dos aplicativos</a>.</p>',
      },
      {
        html: '<h3>Investigar o bug Windows</h3>\n        <p>Um usuário relata que a importação falha no Windows. A análise de recursos e solicitações já possui seus próprios participantes. O chat Windows do Jade está conectado, então Morgan pede para ele reproduzir a falha lá.</p>',
      },
      {
        html: '<p>O agente de IA Jade, o testador, reproduz a falha e envia as provas diretamente para o chat de coordenação. O usuário confirma que o problema bloqueia o trabalho diário. Informe ao agente de IA Morgan como isso altera a prioridade de lançamento.</p>',
      },
      {
        html: '<p>Você pode expandir a equipe enquanto o recurso continua. O agente de IA Morgan compartilha a reprodução, concorda sobre os limites do trabalho e organiza a verificação no Windows. O coordenador de IA mantém as mudanças separadas para que a correção possa ser enviada primeiro. O agente de IA Sam detém a correção, enquanto Jade verifica seu comportamento no Windows. Os filtros salvos e a análise de solicitações continuam em seus chats originais. Você alterou a ordem de liberação e adicionou capacidade enquanto o trabalho está em andamento.</p>',
      },
      {
        html: '<h3>Trazer o conhecimento anterior de volta para a tarefa</h3><p>Lembra-se de que um chat mais antigo contém uma investigação sobre o comportamento de importação. O agente de IA Oscar pode rever o histórico e os materiais ainda disponíveis para ele, explicar decisões anteriores e compartilhar exemplos. O desenvolvedor de IA aplica esse conhecimento à correção. O testador de IA usa os exemplos ao verificar a correção contra a implementação atual.</p>',
      },
      {
        html: '<h3>Arquivos, respostas e histórico</h3><p>O histórico de mensagens e as cópias dos anexos ficam armazenados localmente nos computadores dos participantes. O <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">guia de dados</a> explica o armazenamento e a transferência de arquivos; o <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guia do aplicativo</a> descreve como continuar em outro chat.</p>',
      },
      {
        html: '<h3>Permitam que os testes e correções ocorram entre os agentes</h3>\n        <p>Neste exemplo, o agente de IA Sam trabalha no Cursor no Mac, enquanto Jade testa no Codex no Windows. O coordenador da IA recebe o relatório de conclusão em OpenCode e atribui a verificação independente. As próximas trocas mostram como os agentes trabalham juntos.</p>',
      },
      {
        html: '<h3>Administração quando for necessário</h3><p>Seu trabalho comum permanece nas conversas da IA. O aplicativo de desktop fornece os controles abaixo quando você precisar inspecionar uma conexão ou gerenciar dados armazenados.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">guia de configuração</a></p>',
      },
      {
        html: '<p>Os agentes trocam mensagens pelo NCF Agent Interconnect enquanto permanecem em seus chats de trabalho. O <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">guia dos aplicativos</a> explica como configurá-los.</p>',
      },
      {
        html: '<p>No aplicativo para desktop, você pode consultar o histórico de um agente e excluir seus dados locais quando necessário. O <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">guia de gerenciamento de agentes</a> detalha o que é removido.</p>',
      },
      {
        html: '<p>O agente de IA Jade reporta-se diretamente ao Morgan. Os agentes de IA Sam e Jade resolvem as descobertas de rotina juntos, enquanto outras tarefas continuam em andamento. Você pode adicionar contexto ou ajustar o objetivo no chat de coordenação sempre que algo mudar; você não precisa transmitir cada correção ou aprovar cada reteste.</p>',
      },
      {
        html: '<h3>Verifique uma conexão quando uma troca parar</h3><p>Se a troca de mensagens parar, confira se o NCF Agent Interconnect está em execução e se o chat certo está conectado. Os próximos passos estão no <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">guia de configuração</a>.</p>',
      },
      {
        html: '<h3>Receba os resultados e decida o que publicar</h3><p>Antes da publicação, o agente de IA Morgan traz-lhe um relato do resultado: o que mudou, o que foi verificado no Windows, o que permanece aberto e o que é proposto para release. Você avalia se isso resolve o problema do usuário e decide o que será enviado. Os filtros salvos continuam a caminhar em direção ao seu próprio resultado.</p>',
      },
    ],
  },
  ko: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — 연결된 채팅의 이야기',
      skip: '콘텐츠로 건너뛰기',
      brandLabel: 'NCF Agent Interconnect — 상단',
      navLabel: '메인 네비게이션',
      languageLabel: '언어',
      languageMenuTitle: '언어를 선택하십시오',
      closeLanguageMenu: '언어 선택 닫기',
      navStory: '이야기',
      navGuide: '현장 가이드',
      navStart: '시작하기',
      galleryPageTitle: '이미지 아카이브 — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — 다시 이야기로',
      galleryNavLabel: '이미지 아카이브 탐색',
      galleryBack: '다시 이야기로 돌아가서',
      galleryEyebrow: '이미지 아카이브',
      galleryTitle: '모든 원본 일러스트레이션',
      galleryIntro:
        '모든 이미지는 이 프로토타입에 그대로 유지되며, 만화에서 더 이상 전체 크기로 사용되지 않는 이미지도 포함됩니다. 각 캡션은 자산 파일 이름입니다.',
      galleryDeveloper: '개발자',
      galleryAgents: '에이전트 태블릿스',
      galleryBrand: '브랜드 자산',
      galleryHeroAlt: '데스크에서 개발자, 히어로 일러스트레이션',
      gallerySceneAlt: '데스크에서 개발자, 장면 {number}',
      galleryReadingAlt: '개발자가 NCF Agent Interconnect 책을 읽는 장면 13',
      galleryAgentAlt: '에이전트 {name}의 태블릿 초상화',
      galleryIconAlt: 'NCF Agent Interconnect 앱 아이콘',
      heroEyebrow: '일상적인 AI 대화에서 나온 이야기',
      heroTitle: '한 명의 개발자.<br /><em>여러 작업용 채팅.</em>',
      heroLede:
        '버그와 새 기능을 따라가며 에이전트가 필요한 정보를 어떻게 주고받는지 살펴보세요. 방향은 사용자가 정하고, NCF Agent Interconnect는 메시지와 허용된 파일을 알맞은 채팅으로 전달합니다.',
      download: '응용 프로그램을 다운로드',
      readStory: '이 스토리를 읽어보세요',
      storyEyebrow: '한 개발자의 이야기',
      storyTitle: '에이전트가 함께 일합니다',
      storyLede:
        '한 사람이 익숙한 AI 채팅을 통해 앱을 유지 관리합니다. 에이전트 Morgan은 Mac에서 OpenCode에서 조정을 담당하고, 에이전트 Jade는 Windows에서 Codex에서 검증을 수행하며, 에이전트 Sam은 Mac에서 Cursor에서 버그를 수정합니다. 에이전트 이름은 사용자가 지정합니다. 이 이야기에 등장하는 역할, 기술 및 도구는 예시이며, NCF Agent Interconnect는 이를 제공하지 않습니다.',
      guideEyebrow: '이동하는 부품을 명확하게 유지하십시오.',
      guideTitle: '작업은 채팅에서 진행되고, 앱이 메시지를 전달합니다.',
      startEyebrow: '두 채팅으로 시작하세요',
      startTitle: '이름을 붙이고 메시지를 보내세요.',
      startLede:
        '데스크톱 앱을 설치하고 사용하는 AI 애플리케이션을 구성하며, 다른 이름으로 두 개의 채팅을 연결하고 한 에이전트가 다른 에이전트에 연락하도록 요청합니다.',
      setupGuide: '설정 가이드 열기',
      downloadNote:
        '설치자: Apple Silicon Mac DMG, Intel Mac DMG, Windows x64 EXE. macOS 13 이상. 인텔 런타임은 인텔 하드웨어에서 테스트되지 않았으며, Linux 설치 프로그램은 공개되지 않았습니다.',
      footerTagline: '기존 AI 채팅 내 에이전트 간의 메시지',
      usageGuide: '사용자 가이드',
      license: '라이센스',
      systemNote: '참고',
      exampleExchange: '채팅',
      activityLabel: '예시 활동',
      reader: '다른 채팅이 작동하는 동안, 당신은 물러날 수 있습니다.',
      developerAlt:
        '개발자는 눈에 보이는 컴퓨터를 앞에 두고 책상에 앉은 채로 계속해서 자리에 머물고 있습니다.',
      readingAlt: '개발자는 책상에서 NCF Agent Interconnect에 관한 책을 읽습니다.',
      agentAlt: '도구 아이콘이 있는 전면 태블릿 내부에 있는 {name}의 머리 초상화.',
      names: {
        user: '당신',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        '대화를 설정하세요.',
        'NCF Agent Interconnect를 설치하고, 목적에 맞는 클라이언트 구성 설정을 선택한 후 Apply를 클릭하고, MCP를 다시 연결한 후 교환 작업을 테스트합니다.',
        '설치 가이드',
      ],
      [
        '클라이언트를 알아야 한다',
        'OpenCode, Codex 및 Cursor는 서로 다른 배달 동작과 설정 요구 사항을 가지고 있습니다.',
        '클라이언트 세부 사항',
      ],
      [
        '데이터를 제어하세요',
        '파일, 로컬 히스토리, 정확한 채팅 바인딩, 이름 전송 및 삭제 범위를 검토하세요.',
        '데스크톱 컨트롤',
      ],
      [
        '전체 참조를 읽어보세요',
        '사용자 가이드 및 LLM 중심 참조에는 이 그림으로 설명된 이야기 뒤에 있는 완전한 절차와 제한 사항이 포함되어 있습니다.',
        'llms.txt를 읽어보세요',
      ],
    ],
    scenes: [
      {
        title: '작업에 코디네이터를 지정하십시오',
        lines: [
          '에이전트 Morgan로 연결하세요. 조정 기술을 사용하여 모든 에이전트를 조정하고 작업 전반을 추적하세요. 각 참가자에게 귀하의 업무 규칙을 전달하세요. 업무 경계, Git 브랜치, 구현 및 통합 순서, 분쟁 해결 방식을 조율하세요. 작업이 겹치는 경우 에이전트 간 연락을 설정하고 지식 공유를 기획하며 관련 결정과 변경 사항을 지속적으로 공유하세요. 독립적인 작업은 병렬로 진행되도록 유지하세요. 제가 검토가 필요한 통합된 결과와 결정을 제출하세요.',
          '에이전트 Morgan로 연결됨. 저는 에이전트를 조정하고 작업을 추적하며, 여러분의 입력이 필요한 결과와 결정을 제공할 것입니다.',
        ],
        statuses: ['조율규칙 수립 중'],
      },
      {
        title: 'Windows 전문가 연결',
        lines: [
          '에이전트 Jade로 연결하세요. Windows에서 이 프로젝트를 검증하는 것은 귀하의 책임입니다. Morgan이 작업을 조정하고 있으므로, 지침을 요청하세요.',
          '에이전트 Jade로 연결됨. 저는 Windows 검증을 담당합니다. Morgan에게 제 역할을 알리고 지침을 요청하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Morgan은 Windows를 누가 처리하는지 알게 된다',
        lines: [
          '에이전트 Jade로 연결됨. 저는 Windows에서 프로젝트 검증을 담당하며 지시사항을 기다리고 있습니다.',
          '받았습니다. 저는 Windows 체크를 당신에게 라우팅하고 결과를 조정하겠습니다.',
        ],
        statuses: ['Jade를 Windows 검증 계획에 추가'],
      },
      {
        title: '독립적 검사를 규칙으로 만들기',
        lines: [
          '완료된 것으로 보고된 모든 작업을 다른 에이전트에게 독립적인 테스트를 위해 결과에 적합한 checks를 사용하여 전송하십시오. 작업을 수행한 에이전트의 이름을 명시하고, 검사자에게 직접 수정 사항을 조정하도록 요청하십시오. 검사자는 checks, 결과 및 남은 이슈를 귀하에게 보고해야 합니다. 검사자가 과제가 통과했다고 확인한 후에야 해당 과제를 수락하십시오.',
          '알았습니다. 완료된 것으로 보고된 각 임무를 다른 에이전트에게 독립적인 테스트를 위해 전송하겠습니다.',
        ],
        statuses: ['독립적인 검사 규칙을 설정'],
      },
      {
        title: '구현 에이전트를 연결',
        lines: [
          '에이전트 Leo로 연결하세요. 당신의 역할은 구현입니다. Morgan가 작업을 조정하고 있으며, 지시 사항은 그녀에게 문의하세요.',
          '에이전트 Leo로 연결됨. 저는 구현을 담당합니다. Morgan에게 제 역할을 알리고 할당된 업무를 요청하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Morgan에게 해당 기능을 설명합니다',
        lines: [
          '작업 #T-1042은 사용자가 검색 조건을 재사용할 수 있도록 저장된 필터입니다. 다른 작업이 진행되는 동안 실행을 조직하십시오.',
          'Leo는 자신의 채팅에서 #T-1042을 구현할 것입니다. 내가 그 작업을 추적하고 그가 완료된 것을 보고할 때 독립적인 검사를 할 것입니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Leo는 기능을 수신합니다',
        lines: [
          '작업 #T-1042: 저장된 필터를 구축하여 사용자가 검색 조건을 재사용할 수 있도록 구현 기술을 사용하십시오. 이 작업을 다른 작업에서 분리하고 결과를 나에게 보고하십시오.',
          '제가 #T-1042를 가져와서 먼저 검색 조건이 어떻게 작동하는지 확인하겠습니다.',
        ],
        statuses: ['현재 검색 구현을 검토 중', '저장된 필터 동작을 계획'],
      },
      {
        title: '분석 에이전트를 연결',
        lines: [
          '에이전트 Alice로 연결하세요. 당신의 역할은 분석입니다. Morgan이 작업을 조정하고 있으며, 지시사항은 그녀에게 문의하세요.',
          '에이전트 Alice로 연결됨. 저는 요청 분석을 담당합니다. Morgan에게 제 역할을 알리고 지시를 요청하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: '관련 요청을 Morgan에게 전달하십시오',
        lines: [
          '요청 #I-0201 및 #I-0202는 동일한 요구를 설명할 수 있습니다. 근본적인 사용자 문제를 찾아, Figma의 기존 검색 화면을 확인하고 발견을 #T-1042에 연결하십시오.',
          'Alice는 두 요청과 Figma 스크린을 모두 분석할 것입니다. 제가 그녀를 Leo와 연결하여 발견 내용이 저장된 필터 작업으로 전달되도록 하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Alice는 필요성을 조사합니다.',
        lines: [
          '분석 기술을 사용하여 #I-0201 및 #I-0202 문제를 검토하십시오. Figma의 기존 검색 화면을 확인하고, 근본적인 사용자 요구를 확인하고, 관련 연구 결과를 Leo와 공유하십시오.',
          '저는 두 요청을 현재 화면과 비교한 후, 결과를 Leo에게 전달하겠습니다.',
        ],
        statuses: ['두 요청을 모두 읽습니다.', 'Figma에서 검색 화면을 확인하고 있습니다'],
      },
      {
        title: '발견이 작업 채팅에 도달하도록',
        lines: [
          '문제 #I-0201 및 #I-0202는 동일한 검색 조건을 재사용하는 것입니다. #T-1042 임무가 전체 조합을 보존할 수 있을까요?',
          '- 그래요 사용자들도 공유할 필요가 있는지 확인하십시오. 저는 그것을 작업 #T-1042에서 분리할 것입니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Windows 버그가 계획을 변경합니다',
        lines: [
          'Windows에서 가져오기가 실패합니다. 버그 #B-0317을 일으키는 파일을 첨부합니다. 원인을 조사하고 결과를 알려 주세요.',
          'Jade가 Windows에서 #B-0317을 재현하고 절차와 증거를 보내겠습니다. 버그가 확인되면 수정과 독립 검증을 진행하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Jade는 Windows 버그를 확인합니다',
        lines: [
          '검증 스킬을 사용해 첨부한 파일로 Windows에서 버그 #B-0317을 재현하세요. 재현 절차와 증거를 보내 주세요.',
          'NCF Agent Interconnect를 통해 가져오기을 확인하고 결과를 전달하겠습니다.',
        ],
        statuses: ['가져오기 파일 열기', 'Windows에서 가져오기 점검 중'],
      },
      {
        title: '증거가 코디네이터에 도달합니다',
        lines: [
          'Windows에서 가져오기가 실패합니다. #B-0317의 재현 절차와 증거를 보내드립니다.',
          '받았습니다. 결과를 보고하고 수정 담당자에게 제공할 증거를 보관하겠습니다.',
        ],
        statuses: ['버그 보고서 준비 중'],
      },
      {
        title: '다른 개발자 연결',
        lines: [
          '에이전트 Sam으로 연결하세요. 귀하의 역할은 구현입니다. Morgan가 작업을 조정하며, 지시 사항은 그녀에게 문의하세요.',
          '에이전트 Sam으로 연결됨. 저는 구현을 담당합니다. Morgan에게 제 역할을 알리고 할당된 업무를 요청하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: '결과에 따라 우선순위가 변경됩니다.',
        lines: [
          'Jade가 Windows에서 #B-0317을 재현하고 절차와 증거를 보냈습니다. 가져오기 오류가 확인됐습니다.',
          '이 버그는 일상 업무를 막고 있습니다. #B-0317의 수정본을 먼저 출시하세요. #T-1042가 준비되지 않았다면 다음 릴리스에 포함해도 됩니다. 그 작업은 계속 진행하세요.',
          '알겠습니다. Sam이 #B-0317을 수정하고 Jade가 Windows에서 독립적으로 검증하도록 하겠습니다. #T-1042는 별도로 계속 진행하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Sam이 수정사항을 수신함',
        lines: [
          '구현 스킬을 사용해 버그 #B-0317을 수정하세요. Jade가 Windows에서 재현한 절차와 증거를 전달합니다. 수정 작업은 #T-1042와 분리하고, 검증에 필요한 사항은 Jade와 직접 조율하세요.',
          '#B-0317을 조사해 수정한 뒤 독립 테스트용 후보를 보내겠습니다.',
        ],
        statuses: ['재현 단계 검토 중', '가져오기 코드 검사'],
      },
      {
        title: '이전 조사에 대해 기억하십시오.',
        lines: [
          '이전에 작업 #T-0870에서 조사한 가져오기 문제가 #B-0317에 도움이 될 수 있습니다. 당시의 결정과 관련 예제를 찾아 주세요.',
          'Oscar가 #T-0870을 맡았습니다. 당시 결정과 예제를 요청해 Sam과 Jade에게 공유하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: 'Morgan은 이전 지식을 요청합니다',
        lines: [
          '작업 #T-0870에서 가져오기를 조사하셨습니다. 이전 결정과 버그 #B-0317에 관련된 예제를 찾아 Sam과 Jade에게 공유해 주세요.',
          '이용할 수 있는 기록과 자료를 검토한 뒤 관련 예제를 보내겠습니다.',
        ],
        statuses: ['검토 작업 #T-0870'],
      },
      {
        title: '이전 결정은 개발자에게 도달합니다',
        lines: [
          '이전 가져오기 관련 결정과 예제를 찾았습니다. 보내드립니다.',
          '받았습니다. 수정 작업에 활용하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: '동일한 예시가 테스터에게 도달합니다.',
        lines: [
          '같은 가져오기 예제가 Windows 검증에도 도움이 될 수 있습니다. 보내드립니다.',
          '받았습니다. 검증에 포함하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: '한편, 작업은 계속되고 있습니다.',
        lines: [],
        statuses: [],
      },
      {
        title: '첫 번째 수정본이 준비되었습니다',
        lines: [
          '버그 #B-0317을 수정했습니다. 독립 테스트용 후보를 보내드립니다.',
          '받았습니다. Jade에게 Windows에서 독립 검증을 요청하겠습니다.',
        ],
        statuses: ['NCF Agent Interconnect 사용 중', '메시지 전송됨'],
      },
      {
        title: '다른 에이전트가 테스트를 수행합니다.',
        lines: [
          'Sam이 구현한 버그 #B-0317의 수정 후보를 Windows에서 테스트하세요. 검증 스킬을 사용하고, 결함이 발견되면 Sam과 직접 조율하세요. 테스트가 통과하면 결과를 보내고, 진행을 막는 문제가 있으면 보고하세요.',
          '저는 Windows에서 테스트하고 결함을 발견하면 Sam과 직접 협업하겠습니다.',
        ],
        statuses: ['후보 수정 사항 검토 중', 'Windows에서 가져오기 테스트 중'],
      },
      {
        title: '두 번째 사례가 실패함',
        lines: [
          '버그 #B-0317: 원본 파일은 가져오기에 성공하지만 Oscar의 샘플에서는 행이 중복됩니다. 이 경우도 수정해 주세요.',
          '나는 중복 행 사례를 수정하고 수정된 후보를 보내겠습니다.',
        ],
        statuses: ['중복 행 재현'],
      },
      {
        title: '수정한 후 다시 테스트하세요',
        lines: [
          '중복 행 케이스는 수정되었습니다. 여기 수정된 후보입니다. 해당 케이스와 원래의 임포트를 다시 실행해 주세요.',
          '두 가져오기 사례와 기존 회귀 테스트를 다시 실행하겠습니다.',
        ],
        statuses: ['두 개의 임포트 샘플을 다시 실행 중', '기존 회귀 체크 실행 중'],
      },
      {
        title: '독립적인 결과가 도착했습니다',
        lines: [
          'Sam의 수정본으로 Windows에서 버그 #B-0317 검증을 통과했습니다. 두 가져오기 샘플과 기존 회귀 테스트가 모두 통과했으며, 검증한 범위에서 남은 문제는 없습니다.',
          '받았습니다. 승인된 수정사항을 릴리스 제안에 포함하겠습니다.',
        ],
        statuses: ['릴리스 제안 준비 중'],
      },
      {
        title: '무엇을 출시할지는 당신이 결정합니다',
        lines: [
          '버그 #B-0317, 작업 #T-1042 및 문제 #I-0201 및 #I-0202를 요약하십시오. 각각, 지금까지의 결과, 다음으로 어떤 결정이 필요한지 말해줘.',
          '각 항목에 대한 상태를 준비하고 당신이 결정해야 하는 사항을 표시하겠습니다.',
        ],
        statuses: ['네 가지 항목 모두에 대한 결과를 집계하고 있습니다'],
      },
    ],
    notes: [
      {
        html: '<p>당신은 스스로 성장하는 애플리케이션을 유지 관리합니다. 로드맵 기능 개발 중에 버그 보고가 도착하고, 새로운 사용자 요청도 동시에 처리해야 합니다. NCF Agent Interconnect을 통해 기존 채팅 내의 AI 에이전트들이 이 작업들을 함께 수행할 수 있습니다. 질문, 발견 내용 및 파일이 에이전트 간에 직접 전달되며, 당신은 방향을 설정하고 작업 채팅에서 결과를 수신합니다.</p><p>이 가이드는 한 명의 개발자가 해당 상황을 겪는 과정을 따라갑니다. 당신은 이야기에서 유일한 인간입니다. 모든 이름이 지정된 참가자는 AI 에이전트이며, 그들의 이름과 역할은 자신이 직접 대체할 수 있는 예시입니다.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">준비된 프롬프트 13개</a> 중 하나를 골라 사용 중인 모델에 전달하세요. NCF 문서를 바탕으로 선택한 예시를 자세히 설명하는 안내서를 원하는 언어로 작성해 줍니다.</p>',
      },
      {
        html: '<h3>애플리케이션과 채팅을 준비하세요</h3><p>각 애플리케이션 또는 프로필을 한 번만 설정하세요. 새로운 채팅은 당신이 선택한 이름으로 연결하여 가입합니다.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">설정 안내서</a></p>',
      },
      {
        html: '<h3>기존 채팅에서 작업하세요</h3><p>이 스토리에서는 Mac에서 작업하며 사용자가 실행하는 응용 프로그램을 확인하기 위해 Windows 컴퓨터를 유지합니다. 이미 여러 AI 서비스를 사용하고 있으며, 업무에 적합한 모델을 선택하고 비용을 균형 있게 조정하고 있습니다.</p><p>인공지능 에이전트 Morgan는 OpenCode에서 조율을 담당합니다. 다른 참가자들은 각자 자신의 채팅을 사용하며, Windows checks는 Codex에서 수행됩니다. 새로운 참가자는 나중에 Cursor 또는 다른 구성된 애플리케이션에서 참여할 수 있습니다.</p><p>첫 번째 설정 후, 참여하는 각 채팅에 이름을 지정하세요. 메인 채팅에서 조정 규칙을 설정하세요. Jade는 이제 Morgan에게 자신의 Windows 검증 역할을 전달했으며, 이후 작업은 조정 채팅을 통해 지시할 수 있습니다.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">설정 안내서</a></p>',
      },
      {
        html: '<p>인공지능 조정자에게 완료된 작업을 수락하기 위한 별도의 규칙을 설정하십시오. 인공지능 조정자는 참가자가 참여할 때마다 작업 지침을 전달하고 모든 작업의 진행 상황을 추적합니다. 참가자를 연결할 때 해당 채팅에 이름과 역할을 지정하십시오. Morgan은 에이전트가 해당 역할을 보고한 후에 작업을 할당합니다.</p>',
      },
      {
        html: '<p>AI 에이전트 Leo가 해당 기능을 담당하고 있습니다. AI 코디네이터는 그 진행 상황을 모니터링합니다.</p>',
      },
      {
        html: '<h3>발견한 내용을 작업 채팅에 전달하기</h3>\n        <p>나중에 두 개의 관련 사용자 요청이 도착합니다. 또 다른 분석 채팅을 여며, Morgan은 Alice에게 요청을 할당하고 기능 소유자와 연결해 줍니다. 인공지능 에이전트 Alice는 두 요청이 동일한 요구를 설명하고 있음을 발견합니다. 사용자는 매일 동일한 검색 조건을 반복해서 재현합니다. 그녀는 이 발견을 저장 필터 기능이 개발 중인 채팅에 직접 전송합니다.</p>',
      },
      {
        html: '<p>질문, 보충 설명, 결과는 해당 작업 채팅에 도착합니다. 각 에이전트는 자신의 환경에 설정된 도구와 지침을 사용합니다. 자세한 내용은 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">앱별 안내서</a>를 참조하세요.</p>',
      },
      {
        html: '<h3>Windows 버그를 조사하십시오</h3>\n        <p>사용자가 Windows에서 가져오기 작업이 실패했다고 보고합니다. 기능 및 요청 분석에는 이미 자체 참가자가 있습니다. Jade의 Windows 채팅이 연결되어 있으므로 Morgan은 그녀가 실패를 재현하도록 요청합니다.</p>',
      },
      {
        html: '<p>인공지능 에이전트 Jade, 테스터는 실패를 재현하고 증거를 직접 NCF Agent Interconnect 채팅에 전송합니다. 사용자는 문제가 일상 업무를 방해함을 확인합니다. 당신은 인공지능 에이전트 Morgan에게 이로 인해 릴리스 우선 순위가 어떻게 변경되는지 설명합니다.</p>',
      },
      {
        html: '<p>이 기능이 계속되는 동안 팀을 확장할 수 있습니다. AI 에이전트 Morgan은 재현 절차를 공유하고 작업 경계를 협의하며 Windows에서의 검증을 준비합니다. AI 코디네이터는 변경 사항을 분리하여 수정 사항이 먼저 배포될 수 있도록 합니다. AI 에이전트 Sam이 수정 사항을 담당하고, Jade가 Windows에서의 동작을 검증합니다. 저장된 필터와 요청 분석은 원래의 채팅에서 계속 진행됩니다. 작업이 진행 중인 동안 배포 순서를 변경하고 추가 리소스를 할당했습니다.</p>',
      },
      {
        html: '<h3>이전 지식을 작업에 다시 반영하십시오</h3><p>오래된 채팅에 가져오기 행동에 대한 조사가 포함되어 있다는 것을 기억하세요. 인공지능 에이전트 Oscar는 여전히 이용 가능한 기록과 자료를 검토하여 이전 결정을 설명하고 예제를 공유할 수 있습니다. 인공지능 개발자는 이 지식을 수정에 적용합니다. 인공지능 테스트자는 오늘날의 구현과 비교할 때 예제를 사용하여 검증합니다.</p>',
      },
      {
        html: '<h3>파일, 응답, 기록</h3><p>메시지 기록과 첨부파일 사본은 참여자의 컴퓨터에 로컬로 저장됩니다. 저장 및 파일 전송은 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">데이터 안내서</a>, 다른 채팅으로 이어서 작업하는 방법은 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">데스크톱 안내서</a>에 설명되어 있습니다.</p>',
      },
      {
        html: '<h3>에이전트끼리 테스트하고 수정하기</h3>\n        <p>이 예시에서 AI 에이전트 Sam은 Mac의 Cursor에서 작업하고, Jade는 Windows의 Codex에서 테스트를 수행합니다. AI 조정자는 OpenCode에서 완료 보고서를 수신하고 독립 검사를 할당합니다. 다음 교환 내용은 에이전트들이 어떻게 협력하는지 보여줍니다.</p>',
      },
      {
        html: '<h3>필요할 때 관리하기</h3><p>당신의 일반적인 작업은 AI 채팅에 유지됩니다. 연결을 점검하거나 저장된 데이터를 관리해야 할 때 데스크톱 앱이 아래의 컨트롤을 제공합니다.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">설정 안내서</a></p>',
      },
      {
        html: '<p>에이전트는 각자의 작업 채팅에 머물면서 NCF Agent Interconnect를 통해 메시지를 주고받습니다. 앱별 설정 방법은 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">안내서</a>를 참조하세요.</p>',
      },
      {
        html: '<p>데스크톱 앱에서 에이전트의 기록을 확인하고 필요하면 로컬 데이터를 삭제할 수 있습니다. 삭제 범위는 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">에이전트 관리 안내서</a>에 나와 있습니다.</p>',
      },
      {
        html: '<p>인공지능 에이전트 Jade는 Morgan에게 직접 보고합니다. 인공지능 에이전트 Sam과 Jade는 루틴 발견을 함께 처리하며, 다른 작업은 계속 진행됩니다. 조정 채팅에서 변경 사항이 발생할 때마다 컨텍스트를 추가하거나 목표를 조정할 수 있습니다. 각 수정 사항을 전달하거나 각 재검사를 승인할 필요는 없습니다.</p>',
      },
      {
        html: '<h3>교환 중단 시 연결 상태를 확인</h3><p>대화가 중단되면 NCF Agent Interconnect가 실행 중인지, 해당 채팅이 연결되어 있는지 확인하세요. 다음 단계는 <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">설정 안내서</a>에 나와 있습니다.</p>',
      },
      {
        html: '<h3>결과를 확인하고 출시 범위를 결정하세요</h3><p>발표 전에 AI 에이전트 Morgan이 결과에 대한 보고를 제공합니다. 어떤 변경이 있었는지, Windows에서 어떤 검사가 수행되었는지, 어떤 문제가 미해결 상태로 남아 있는지, 그리고 어떤 항목이 출시를 제안하는지가 포함됩니다. 사용자의 문제를 해결하는지 평가하고 어떤 소프트웨어가 출시될지 결정합니다. 저장된 필터는 각각의 결과를 향해 계속 진행됩니다.</p>',
      },
    ],
  },
  tr: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Bağlantılı sohbetler hikayesi',
      skip: 'İçeriğe geç',
      brandLabel: 'NCF Agent Interconnect — üst',
      navLabel: 'Ana navigasyon',
      languageLabel: 'Dil',
      languageMenuTitle: 'Dil seçin',
      closeLanguageMenu: 'Dil seçimini kapat',
      navStory: 'Hikaye',
      navGuide: 'Alan rehberi',
      navStart: 'Başlayın.',
      galleryPageTitle: 'Resim arşivi — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — hikayeye geri dönelim',
      galleryNavLabel: 'Görüntü arşivi gezintisi',
      galleryBack: 'Hikayeye geri dönelim',
      galleryEyebrow: 'Resim arşivleri',
      galleryTitle: 'Her orijinal çizim',
      galleryIntro:
        'Tüm görseller, çizgi romanında artık tam boyutta kullanılmayanlar da dahil olmak üzere bu prototipde korunur. Her başlık, varlık dosyasının adıdır.',
      galleryDeveloper: 'Geliştirici',
      galleryAgents: 'Ajan tabletleri',
      galleryBrand: 'Marka varlığı',
      galleryHeroAlt: 'Masa başında geliştirici, kahraman görseli',
      gallerySceneAlt: 'Geliştirici masada, sahne {number}',
      galleryReadingAlt: 'Geliştirici, NCF Agent Interconnect kitabını okuyor, sahne 13.',
      galleryAgentAlt: 'Ajanın tablet portresi {name}',
      galleryIconAlt: 'NCF Agent Interconnect uygulama simgesi',
      heroEyebrow: 'Günlük AI sohbetlerinizden bir hikaye',
      heroTitle: 'Bir geliştirici.<br /><em>Birçok çalışma sohbeti.</em>',
      heroLede:
        'Bir hatayı, yeni bir özelliği ve yararlı bilgileri birbirine aktaran ajanları izleyin. Yönü siz belirlersiniz; NCF Agent Interconnect mesajları ve izin verilen dosyaları doğru sohbete ulaştırır.',
      download: 'Uygulamayı indir',
      readStory: 'Hikayeyi oku',
      storyEyebrow: 'Bir geliştiricinin hikayesi',
      storyTitle: 'Ajanlar birlikte çalışır',
      storyLede:
        "Bir kişi tanıdık AI sohbetlerinde bir uygulama sürdürüyor. Ajan Morgan, OpenCode'da bir Mac’te koordinasyon sağlar; Ajan Jade, Codex'te Windows üzerinde kontrolü yapar ve Ajan Sam, Cursor'da Mac üzerinde hatayı düzeltir. Sen ajan isimlerini seç. Bu hikayedeki roller, beceriler ve araçlar örneklerdir; NCF Agent Interconnect bunları sağlamaz.",
      guideEyebrow: 'Hareketli parçaları açık tut',
      guideTitle: 'İş sohbetlerde yürür. Uygulama mesajları iletir.',
      startEyebrow: 'İki sohbetle başla.',
      startTitle: 'Onlara isim verin. Bir mesaj gönderin.',
      startLede:
        'Masaüstü uygulamasını yükleyin, kullandığınız AI uygulamalarını yapılandırın, farklı isimlerle iki sohbet bağlantısı kurun ve bir ajanın diğerine ulaşmasını isteyin.',
      setupGuide: 'Açık kurulum kılavuzu',
      downloadNote:
        'Kurulum dosyaları: Apple Silicon Mac DMG, Intel Mac DMG ve Windows x64 EXE. macOS 13 veya sonraki sürüm. Intel çalışma zamanı, Intel donanımında test edilmedi; hiçbir Linux yükleyici yayınlanmadı.',
      footerTagline: 'Mevcut AI sohbetlerinizde ajanlar arasındaki mesajlar.',
      usageGuide: 'Kullanıcı kılavuzu',
      license: 'Lisans',
      systemNote: 'Not',
      exampleExchange: 'Sohbet',
      activityLabel: 'Görsel faaliyet',
      reader: 'Diğer sohbetler çalışırken, ayrılabilirsin.',
      developerAlt: 'Geliştirici, görünür bir bilgisayarla bir masada oturuyor.',
      readingAlt: 'Geliştirici masada NCF Agent Interconnect hakkında bir kitap okuyor.',
      agentAlt: '{name} baş portresi, araç simgeleri olan ön yüzüne bakan bir tablet içinde.',
      names: {
        user: 'Sen...',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Sohbetlerinizi ayarlayın',
        "NCF Agent Interconnect'ı yükleyin, istenen istemci yapılandırmasını seçin, Apply'e tıklayın, MCP'yi yeniden bağlayın ve bir alışveriş işlemi test edin.",
        'Kurulum kılavuzu',
      ],
      [
        'Müşterinizi tanıyın',
        'OpenCode, Codex ve Cursor farklı teslimat davranışları ve kurulum gereksinimlerine sahiptir.',
        'Müşteri detayları',
      ],
      [
        'Verilerinizi kontrol edin',
        'Dosyalar, yerel tarih, tam sohbet bağlamaları, isim transferleri ve silme kapsamı',
        'Masaüstü kontrolleri',
      ],
      [
        'Tam referansı okuyun',
        'Kullanıcı kılavuzu ve LLM odaklı referans, bu görselleştirilmiş hikayenin arkasındaki tüm prosedürleri ve sınırları içerir.',
        'llms.txt oku',
      ],
    ],
    scenes: [
      {
        title: 'İşin koordinatörünü ata.',
        lines: [
          'Ajan Morgan olarak bağlantı kurun. Koordinasyon becerisini tüm ajanları koordine etmek ve işin genelini takip etmek için kullanın. Her katılımcıya çalışma kurallarınızı gönderin. İş sınırlarını, Git dallarını, uygulama ve entegrasyon sırasını ve çatışma çözümünü koordine edin. İşleriniz örtüşüyorsa ajanları birbirine bağlayın, bilgi paylaşımını düzenleyin ve ilgili kararlar ve değişiklikler konusunda bilgilendirin. Bağımsız görevleri paralel olarak ilerletin. Bana birleştirilmiş sonuçlar ve benim onayımı gerektiren kararlar getirin.',
          'Ajan Morgan olarak bağlandı. Ajanları koordine edeceğim, çalışmalarını takip edeceğim ve sizin girişiminiz gereken sonuçlar ve kararlar getireceğim.',
        ],
        statuses: ['Koordinasyon kurallarının hazırlanması'],
      },
      {
        title: 'Windows uzmanını bağla',
        lines: [
          'Ajan Jade olarak bağlanın. Bu projenin Windows üzerinde doğrulanması sizin sorumluluğunuz. Morgan işi koordine eder; ona talimatlar isteyin.',
          "Ajan Jade olarak bağlandı. Windows doğrulamasından sorumluyum. Morgan'e rolümü bildireceğim ve talimatlar isteyeceğim.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: "Morgan, Windows'ı kimin işlediğini öğrenir.",
        lines: [
          'Ajan Jade olarak bağlandı. Windows üzerinde proje doğrulamasını yürütüyorum ve talimatlarınıza hazırım.',
          'Alındı. Windows testlerini size yönlendireceğim ve sonuçları koordine edeceğim.',
        ],
        statuses: ["Jade'ın Windows doğrulama planına eklenmesi"],
      },
      {
        title: 'Bağımsız kontrolü bir kural haline getirin',
        lines: [
          'Sonuçlara uygun kontroller kullanarak bağımsız testler için tamamlanmış olarak bildirilen her görevi başka bir ajanına gönderin. İşleri yapan ajanın adını belirtin ve test eden kişiye herhangi bir düzeltmeyi doğrudan onunla koordine etmesini isteyin. Test eden kişi, kontrolleri, sonucu ve kalan sorunları size bildirmelidir. Görevi yalnızca test eden kişi geçişin doğrulamasını yaptıktan sonra kabul edin.',
          'Anlaşıldı. Her görev tamamlandı olarak bildirildiğinde bağımsız testler için başka bir ajanı göndereceğim.',
        ],
        statuses: ['Bağımsız kontrol kuralının ayarlanması'],
      },
      {
        title: 'Uygulama ajanını bağla',
        lines: [
          'Ajan Leo olarak bağlanın. Göreviniz uygulama sürecidir. Morgan işleri koordine eder; talimatlar için ona başvurun.',
          "Ajan Leo olarak bağlandım. Uygulamayı ben hallederim. Morgan'e rolümü anlatacağım ve bir görev isteyeceğim.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: "Morgan'e özelliği tanımlayın",
        lines: [
          'Görev #T-1042 kullanıcıların arama koşullarını yeniden kullanmasına izin veren filtreyi kaydetmiştir. Diğer çalışmalar devam ederken uygulamayı düzenleyin.',
          "Leo #T-1042'yi kendi sohbetinde uygulayacak. İşleri takip edeceğim ve tamamlandığını bildirdiğinde bağımsız bir kontrol ayarlayacağım.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Leo, özelliği alır',
        lines: [
          '#T-1042 görevi için uygulama becerisini kullanın: Kullanıcıların arama koşullarını yeniden kullanabilmeleri için kaydedilen filtreleri oluşturun. Bu işi diğer görevlerden ayrı tut ve sonuçlarını bana bildir.',
          "#T-1042'yi alacağım ve şimdi arama koşullarının nasıl çalıştığını kontrol edeceğim.",
        ],
        statuses: [
          'Mevcut arama implementasyonunun incelenmesi',
          'Kaydedilen filtre davranışının planlanması',
        ],
      },
      {
        title: 'Bir analiz ajanı bağla',
        lines: [
          'Ajan Alice olarak bağlanın. Rolün analiz. Morgan işleri koordine eder; talimatlar için ona başvurun.',
          "Ajan Alice olarak bağlandım. İstek analizini ben yönetiyorum. Morgan'e rolümü bildireceğim ve talimatlar isteyeceğim.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: "İlgili talepleri Morgan'e iletin",
        lines: [
          "#I-0201 ve #I-0202 talepleri aynı ihtiyacı açıklayabilir. Altta yatan kullanıcı sorunu bulun, Figma'deki mevcut arama ekranını kontrol edin ve bulguyu #T-1042 ile ilişkilendirin.",
          'Alice her iki isteği ve Figma ekranını analiz edecek. Bulgunun kaydedilmiş filtre çalışmasına ulaşması için onu Leo ile bağlantıya geçireceğim.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Alice, gereksinimi inceliyor.',
        lines: [
          "#I-0201 ve #I-0202 sorunlarını incelemek için analiz becerisini kullanın. Figma'da mevcut arama ekranını kontrol edin, temel kullanıcı ihtiyacını belirleyin ve ilgili bulguları Leo ile paylaşın.",
          "Her iki talebi de mevcut ekranla karşılaştıracağım, ardından Leo'ya bulguyu göndereceğim.",
        ],
        statuses: ['Her iki talebi de okudu', "Figma'da arama ekranını kontrol etme"],
      },
      {
        title: 'Bulgu işleyen sohbete ulaşsın.',
        lines: [
          '#I-0201 ve #I-0202 sorular aynı arama koşullarını yeniden kullanmakla ilgilidir. #T-1042 görevi tüm kombinasyonu koruyabilir mi?',
          "- Evet. - Evet. Kullanıcıların da paylaşmaları gerekiyor mu kontrol edin; bunu görev #T-1042'den ayrı tutacağım.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Bir Windows hatası planı değiştirir',
        lines: [
          'Windows’ta içe aktarma başarısız oluyor. #B-0317 hatasını tetikleyen dosyayı ekliyorum. Sorunu inceleyip bulduklarını bildir.',
          'Jade, #B-0317 hatasını Windows’ta yeniden oluşturup adımları ve kanıtları bana gönderecek. Hata doğrulanırsa düzeltmeyi ve bağımsız kontrolü düzenleyeceğim.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Jade Windows hatasını inceler',
        lines: [
          'Doğrulama becerisini kullanarak ekli dosyayla #B-0317 hatasını Windows’ta yeniden oluştur. Yeniden oluşturma adımlarını ve kanıtları bana gönder.',
          'İçe aktarmaı kontrol edeceğim ve sonucu size göndereceğim.',
        ],
        statuses: ['İçe aktarım dosyasını açma', 'Windows üzerinde içe aktarma kontrolü yapılıyor'],
      },
      {
        title: 'Kanıt koordinatöre ulaşır',
        lines: [
          'Windows’ta içe aktarma başarısız oluyor. #B-0317 için yeniden oluşturma adımları ve kanıtlar burada.',
          'Alındı. Sonuçları rapor edeceğim ve kanıtları düzeltme sorumlusu için saklayacağım.',
        ],
        statuses: ['Hata raporu hazırlamak'],
      },
      {
        title: 'Diğer bir geliştiriciyle bağlan',
        lines: [
          'Ajan Sam olarak bağlanın. Göreviniz uygulama sürecidir. Morgan işleri koordine eder; talimatlar için ona başvurun.',
          "Ajan Sam olarak bağlandım. Uygulamayı ben hallederim. Morgan'e rolümü anlatacağım ve bir görev isteyeceğim.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Sonuç önceliği değiştirir.',
        lines: [
          'Jade, #B-0317 hatasını Windows’ta yeniden oluşturdu ve adımları ile kanıtları gönderdi. İçe aktarma hatası doğrulandı.',
          'Bu hata günlük çalışmayı engelliyor. Önce #B-0317 düzeltmesini yayımla. #T-1042 hazır değilse sonraki sürüme kalabilir. O görevi de ilerletmeye devam et.',
          'Anlaşıldı. Sam #B-0317 hatasını düzeltecek, Jade de Windows’ta bağımsız olarak doğrulayacak. #T-1042 görevini ayrı olarak ilerletmeye devam edeceğim.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Sam, düzeltmeyi alır.',
        lines: [
          "#B-0317 hatasını düzeltmek için uygulama becerisini kullanın. Jade onu Windows’ta yeniden üretti. İşte adımları ve kanıtları. Düzeltmeyi #T-1042'den ayrı tutun ve herhangi bir doğrulama detaylarını doğrudan Jade ile koordine edin.",
          "#B-0317'i araştıracağım, düzeltmeyi hazırlayacağım ve bağımsız testler için bir aday göndereceğim.",
        ],
        statuses: [
          'Reprodüksiyon adımlarını gözden geçirme',
          'İçe aktarım kodunun kontrol edilmesi',
        ],
      },
      {
        title: 'Daha önceki bir soruşturmayı hatırla.',
        lines: [
          "Görev #T-0870'de daha önceki bir içe aktarma soruşturması #B-0317'e yardımcı olabilir. Önceki kararları ve ilgili örnekleri bulun.",
          'Oscar #T-0870 üzerinde çalıştı. Ona kararları ve örnekleri soracağım, sonra onları Sam ve Jade ile paylaşacağım.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Morgan daha önce bilgi edinmek istiyor',
        lines: [
          '#T-0870 görevinde içe aktarmaı araştırdın. Lütfen önceki kararları ve #B-0317 hatası ile ilgili tüm örnekleri geri alın, sonra bunları Sam ve Jade ile paylaşın.',
          'Kullanılabilir tarihçeyi ve malzemeleri inceleyeceğim, ardından ilgili örnekleri göndereceğim.',
        ],
        statuses: ['Tekrarlama görevi #T-0870'],
      },
      {
        title: 'Daha önceki kararlar geliştiriciye ulaşır',
        lines: [
          'Daha önceki içe aktarma kararlarını ve örneklerini buldum. Gönderiyorum.',
          'Alındı. Bunları düzeltmede kullanacağım.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Aynı örnekler test ediciye ulaşır.',
        lines: [
          'Aynı içe aktarma örnekleri Windows kontrolünüzde yardımcı olabilir. Gönderiyorum.',
          'Alındı. Onları kontrollerde dahil edeceğim.',
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Bu arada iş devam ediyor',
        lines: [],
        statuses: [],
      },
      {
        title: 'İlk aday hazır.',
        lines: [
          'Bug #B-0317 tamir edildi. İşte bağımsız test için aday.',
          "Alındı. Jade'den bağımsız bir Windows kontrolü isteyeceğim.",
        ],
        statuses: ['NCF Agent Interconnect kullanıyorum', 'Mesaj gönderildi'],
      },
      {
        title: 'Farklı bir ajan test ediyor.',
        lines: [
          'Windows’ta #B-0317 virüsü için adayı test edin. Sam uyguladı. Verifikasyon becerisini kullanın ve herhangi bir kusur üzerinde doğrudan Sam ile çalışın. Kontroller geçerken bana kendi test sonuçlarını gönder ya da bir engelleyici rapor et.',
          'Bir kusur bulursam Windows üzerinde test edeceğim ve Sam ile doğrudan çalışacağım.',
        ],
        statuses: ['Kandidat düzeltmeyi gözden geçiriyorum', "Windows'ta içe aktarma testi yapmak"],
      },
      {
        title: 'İkinci bir durum başarısız oldu',
        lines: [
          'Hata #B-0317: İlk dosya içe aktarılıyor, ancak Oscar’ın örneği yinelenen bir satır oluşturuyor. Bu durumu da düzelt.',
          'Çift satır durumunu düzelteceğim ve gözden geçirilmiş bir aday göndereceğim.',
        ],
        statuses: ['Çift satırı yeniden üretmek'],
      },
      {
        title: 'Düzenle, sonra tekrar test et.',
        lines: [
          'Çift satır durumu düzeltilmiştir. İşte güncellenmiş aday. Lütfen bu durumu ve orijinal içeriği tekrar çalıştırın.',
          'Hem içe aktarma hem de mevcut gerileme kontrolünü tekrar çalıştıracağım.',
        ],
        statuses: [
          'Her iki içe aktarma örneğinin de yeniden çalıştırılması',
          'Mevcut gerileme testlerini çalıştırmak',
        ],
      },
      {
        title: 'Bağımsız testin sonucu gelir',
        lines: [
          'Sam’in güncellediği sürümle #B-0317 hatası Windows testini geçti. Her iki içe aktarma örneği ve mevcut regresyon testleri başarılı oldu. Test edilen kapsamda çözülmemiş sorun kalmadı.',
          'Alındı. Kabul edilen düzeltmeyi sürüm teklifine ekleyeceğim.',
        ],
        statuses: ['Ship önereci hazırlanıyor'],
      },
      {
        title: 'Neyin yayımlanacağına siz karar verirsiniz',
        lines: [
          '#B-0317 hatasını, #T-1042 görevini ve #I-0201 ve #I-0202 sorunlarını özetleyin. Her biri için bana şimdiye kadarki sonuçları, gelecekleri ve benden istediğiniz herhangi bir kararı söyleyin.',
          'Her madde için bir durum hazırlayacağım ve karar vermeniz gerekenleri işaretleyeceğim.',
        ],
        statuses: ['Dört madde için tüm sonuçları bir araya getirme'],
      },
    ],
    notes: [
      {
        html: '<p>Kendi başına büyüyen bir uygulamayı sürdürüyorsun. Yol haritası özelliğini geliştirirken hata raporları gelir ve yeni kullanıcı istekleri de dikkat gerektirir. NCF Agent Interconnect, günlük sohbetlerindeki AI ajanlarının bu görevleri birlikte yapmasına olanak tanır. Sorular, bulgular ve dosyalar doğrudan aralarında aktarılır; yönü belirler ve sonuçları çalışma sohbetinde alırsın.</p><p>Bu kılavuz, bir geliştiricinin bu durumu takip eder. Hikayede sadece sen insan olacaksın; isimlendirilmiş tüm katılımcılar AI ajanlarıdır. Onların isimleri ve rolleri, kendi isimlerinle ve rollerinle değiştirebileceğin örneklerdir.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">Hazır 13 istemden</a> birini seçip kendi modelinize verin. Model, NCF belgelerine dayanarak seçtiğiniz örnek için dilinizde ayrıntılı bir rehber hazırlayacaktır.</p>',
      },
      {
        html: '<h3>Uygulamalarınızı ve sohbetlerinizi hazırlayın</h3><p>Her uygulama veya profili bir kez ayarlayın. Yeni sohbetler daha sonra istediğiniz isimlerle bağlantı kurarak katılır.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">kurulum rehberi</a></p>',
      },
      {
        html: "<h3>İşinizi normal sohbetlerinizde yapın</h3><p>Bu hikayede, bir Mac üzerinde çalışıyorsunuz ve kullanıcılarınızın çalıştığı uygulamayı kontrol etmek için bir Windows bilgisayarınız var. İşinize uygun modelleri seçerek ve maliyetleri dengeleyerek çok sayıda AI hizmetini kullanıyorsunuz.</p><p>AI ajanı Morgan koordinasyonunu OpenCode'da yapar. Diğer katılımcıların kendi sohbetleri vardır; Windows testleri Codex'de yapılır. Yeni bir katılımcı daha sonra Cursor veya başka bir yapılandırılmış uygulamaya katılabilir.</p><p>İlk kez ayarladıktan sonra, katılan her sohbete bir isim verin. Ana sohbette koordinasyon kurallarını belirleyin. Jade şimdi Morgan'e Windows doğrulama rolünü bildirdi; sonraki işlerinizi koordinasyon sohbeti üzerinden yönlendirebilirsiniz.</p><p><a href=\"https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md\">kurulum rehberi</a></p>",
      },
      {
        html: '<p>Yapay zeka koordinatörüne tamamlanmış çalışmayı kabul etmek için ayrı bir kural verin. AI koordinatörü katılımcılara katıldıklarında çalışma talimatlarını gönderir ve tüm görevlerde ilerlemeyi takip eder. Bir katılımcı ile bağlantı kurduğunuzda, o sohbete bir isim ve rol verin; Morgan, ajanın bu rolü bildirmesinden sonra işi belirler.</p>',
      },
      {
        html: '<p>AI ajanı Leo özelliği kontrol eder. AI koordinecisi ilerlemeyi takip eder.</p>',
      },
      {
        html: "<h3>Bulgular iş için kullanılan AI sohbetlerine ulaşsın.</h3>\n        <p>Daha sonra, ilgili iki kullanıcı isteği geldi. Başka bir analiz sohbeti açıyorsunuz; Morgan istekleri Alice'e atar ve onu özelliğin sahibiyle bağlantı kurmaya yönlendirir. AI ajanı Alice, her iki isteğin de aynı ihtiyacı tanımladığını keşfeder: kullanıcılar her gün aynı arama koşullarını yeniden oluşturuyor. Bulguyu doğrudan kaydedilmiş filtre özelliğinin geliştirildiği sohbete doğrudan iletir.</p>",
      },
      {
        html: '<p>Soru, açıklama veya sonuç ilgili çalışma sohbetine ulaşır. Her ajan kendi ortamında yapılandırılmış araçları ve yönergeleri kullanır. Ayrıntılar için <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">uygulama rehberine</a> bakın.</p>',
      },
      {
        html: "<h3>Windows hatasını araştırın</h3>\n        <p>Bir kullanıcı Windows'ta içeri aktarma işleminin başarısız olduğunu bildirir. Özellik ve talep analizi zaten kendi katılımcılarına sahiptir. Jade'nin Windows sohbeti bağlı olduğundan, Morgan ondan hatayı orada tekrarlamasını istiyor.</p>",
      },
      {
        html: "<p>AI ajanı Jade, testçi, hatayı tekrar üretir ve kanıtları doğrudan koordinasyon sohbetine gönderir. Kullanıcı sorunun günlük işleri engellediğini onaylar. Bu durumun serbest bırakma önceliğini nasıl etkilediğini AI ajanı Morgan'e bildirirsin.</p>",
      },
      {
        html: '<p>Özellik devam ederken takımı genişletebilirsiniz. AI ajanı Morgan kopyalama sürecini paylaşıyor, çalışma sınırlarını onaylıyor ve Windows üzerinde doğrulama düzenliyor. AI koordinatörü değişiklikleri ayrı tutuyor böylece düzeltme önce gönderilip gönderilemeyeceğini kontrol edebilir. AI ajanı Sam düzeltmeyi üstleniyor, Jade ise Windows üzerinde davranışını test ediyor. Kaydedilen filtreler ve talep analizleri orijinal sohbetlerinde devam ediyor. İşler devam ederken serbest bırakma sırasını değiştirdiniz ve kapasite eklediniz.</p>',
      },
      {
        html: '<h3>Daha önceki bilgileri göreve geri getir</h3><p>Eski bir sohbetin içe aktarma davranışının araştırılmasını içerdiğini hatırlıyorsun. AI ajanı Oscar, hala onun için mevcut olan tarih ve malzemeleri gözden geçirebilir, daha önceki kararları açıklayabilir ve örnekleri paylaşabilir. AI geliştiricisi bu bilgiyi düzeltmeye uygular. AI testerı, örneği bugünün uygulanmasıyla karşılaştırırken kullanır.</p>',
      },
      {
        html: '<h3>Dosyalar, yanıtlar ve geçmiş</h3><p>Mesaj geçmişi ve eklerin kopyaları katılımcıların bilgisayarlarında yerel olarak saklanır. Saklama ve dosya aktarımı <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">veri rehberinde</a>, başka bir sohbette devam etme ise <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">masaüstü rehberinde</a> anlatılır.</p>',
      },
      {
        html: "<h3>Ajanlar arasında test ve düzeltmeler yapılsın.</h3>\n        <p>Bu örnekte, AI ajanı Sam Cursor'de Mac üzerinde çalışırken Jade Codex'de Windows üzerinde testler yapar. AI koordinatörü OpenCode'da tamamlama raporunu alır ve bağımsız kontrolü atar. Sonraki mesajlar, ajanların birlikte nasıl çalıştığını gösterir.</p>",
      },
      {
        html: '<h3>Gerektiğinde yönetin</h3><p>Günlük işleriniz AI sohbetlerinde kalır. Masaüstü uygulaması, bir bağlantıya göz atmanız veya saklanan verileri yönetmeniz gerekiyorsa aşağıdaki kontrolleri sağlar.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">kurulum rehberi</a></p>',
      },
      {
        html: '<p>Ajanlar çalışma sohbetlerinden ayrılmadan NCF Agent Interconnect üzerinden mesajlaşır. Her uygulamanın kurulumu <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">uygulama rehberinde</a> açıklanır.</p>',
      },
      {
        html: '<p>Masaüstü uygulamasında bir ajanın geçmişini inceleyebilir ve gerekirse yerel verilerini silebilirsiniz. Silme kapsamı <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">ajan yönetimi rehberinde</a> açıklanır.</p>',
      },
      {
        html: "<p>AI ajanı Jade doğrudan Morgan'e rapor eder. AI ajanları Sam ve Jade rutin bulguları birlikte çözer, diğer görevler ise devam eder. Bir şey değiştiğinde koordinasyon sohbetinde bağlam ekleyebilir veya hedefi ayarlayabilirsiniz; her düzeltmeyi iletmeniz veya her tekrar testini onaylamanız gerekmez.</p>",
      },
      {
        html: '<h3>İletişim durduğunda bağlantıyı kontrol edin</h3><p>Yazışma durursa NCF Agent Interconnect’in çalıştığını ve doğru sohbetin bağlı olduğunu kontrol edin. Sonraki adımlar <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">kurulum rehberinde</a> yer alır.</p>',
      },
      {
        html: "<h3>Sonucu alın ve neyin yayımlanacağına karar verin</h3><p>Yayınlanmadan önce, AI ajanı Morgan size sonucun bir özetini sunuyor: ne değişti, ne Windows'ta kontrol edildi, ne açık kaldı ve ne sürüm için önerildi. Kullanıcının sorununu çözdüğünü değerlendirip hangi yazılımın serbest bırakılacağına karar veriyorsun. Kaydedilen filtreler kendi sonuçlarına doğru devam ediyor.</p>",
      },
    ],
  },
  pl: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Historia połączonych czatów',
      skip: 'Przejdź do treści',
      brandLabel: 'NCF Agent Interconnect — przejdź na początek strony',
      navLabel: 'Główna nawigacja',
      languageLabel: 'Język',
      languageMenuTitle: 'Wybierz język',
      closeLanguageMenu: 'Zamknij wybór języka',
      navStory: 'Opowieść',
      navGuide: 'Przewodnik pola',
      navStart: 'Rozpocznij',
      galleryPageTitle: 'Archiwum obrazów — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — z powrotem do historii',
      galleryNavLabel: 'Nawigacja w archiwum obrazów',
      galleryBack: 'Wróćmy do historii.',
      galleryEyebrow: 'Archiwum zdjęć',
      galleryTitle: 'Każda oryginalna ilustracja',
      galleryIntro:
        'Wszystkie obrazy pozostają w tym prototypie, w tym te, które nie są już używane w pełnym rozmiarze w komiksie. Każda podpis jest nazwą pliku zasobu.',
      galleryDeveloper: 'Wytwórca',
      galleryAgents: 'Tabletki agenta',
      galleryBrand: 'Aktywa marki',
      galleryHeroAlt: 'Deweloper przy biurku, ilustracja bohatera',
      gallerySceneAlt: 'Programista przy biurku, scena {number}',
      galleryReadingAlt: 'Deweloper czyta książkę NCF Agent Interconnect, scena 13',
      galleryAgentAlt: 'Portret agenta {name} na tablecie',
      galleryIconAlt: 'Ikona aplikacji NCF Agent Interconnect',
      heroEyebrow: 'Opowieść z codziennych rozmów z AI',
      heroTitle: 'Jeden programista.<br /><em>Wiele rozmów roboczych.</em>',
      heroLede:
        'Prześledź błąd, nową funkcję i agentów, którzy przekazują sobie przydatne informacje. Ty wyznaczasz kierunek; NCF Agent Interconnect dostarcza wiadomości i dozwolone pliki do właściwego czatu.',
      download: 'Pobierz aplikację',
      readStory: 'Przeczytaj historię.',
      storyEyebrow: 'Historia jednego dewelopera',
      storyTitle: 'Agenci pracują razem',
      storyLede:
        'Jedna osoba utrzymuje aplikację w znanych rozmowach AI. Agent Morgan koordynuje w OpenCode na Mac; Agent Jade przeprowadza testy w Codex na Windows, a Agent Sam naprawia błąd w Cursor na Mac. Wybierz nazwy agentów. Role, umiejętności i narzędzia w tej historii są przykładami; NCF Agent Interconnect ich nie dostarcza.',
      guideEyebrow: 'Zachowaj jasność w działających elementach',
      guideTitle: 'Praca odbywa się na czatach. Aplikacja przekazuje wiadomości.',
      startEyebrow: 'Rozpocznij od dwóch czatów',
      startTitle: 'Przypisz im nazwiska. Wyślij jedną wiadomość.',
      startLede:
        'Zainstaluj aplikację stacjonarną, skonfiguruj używane aplikacje AI, połącz dwie rozmowy pod różnymi nazwami i poproś jednego agenta o kontakt z drugim.',
      setupGuide: 'Otwórz przewodnik konfiguracji',
      downloadNote:
        'Instalatory: Apple Silicon Mac DMG, Intel Mac DMG i Windows x64 EXE. macOS 13 lub nowsza. Czas uruchomienia Intel nie został przetestowany na sprzęcie Intel; nie opublikowany jest instalator Linux.',
      footerTagline: 'Wiadomości między agentami w istniejących czatach AI.',
      usageGuide: 'Przewodnik użytkownika',
      license: 'Licencja',
      systemNote: 'Uwaga',
      exampleExchange: 'Rozmowa',
      activityLabel: 'Działalność ilustracyjna',
      reader: 'Podczas gdy inne rozmowy działają, możesz się odłączyć.',
      developerAlt: 'Programista nadal siedzi przy biurku z widocznym komputerem.',
      readingAlt: 'Programista czyta książkę o NCF Agent Interconnect przy biurku.',
      agentAlt:
        'Portret głowy {name} w tabletce zainstalowanej w przedniej części urządzenia z ikonami narzędzi.',
      names: {
        user: 'Ty ...',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Skonfigurujcie swoje rozmowy.',
        'Zainstaluj NCF Agent Interconnect, wybierz wymaganą konfigurację klienta, kliknij Apply, ponownie podłącz MCP i przetestuj wymianę.',
        'Przewodnik konfiguracji',
      ],
      [
        'Poznaj swojego klienta.',
        'OpenCode, Codex i Cursor mają różne zachowania w zakresie dostarczania oraz wymagania dotyczące konfiguracji.',
        'Szczegóły klienta',
      ],
      [
        'Zarządzaj swoimi danymi',
        'Przegląd plików, lokalnej historii, dokładnych powiązań czatów, przekazywania nazw i zakresu usuwania.',
        'Kontrola pulpitu',
      ],
      [
        'Przeczytaj pełne odniesienie',
        'Przewodnik użytkownika i odniesienie skierowane do LLM zawierają pełne procedury i ograniczenia stojące za tą ilustracją.',
        'Przeczytaj llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Przypisz koordynatora do zadania',
        lines: [
          'Połącz się jako agent Morgan. Wykorzystaj umiejętność koordynacji, aby koordynować wszystkich agentów i śledzić całość pracy. Wyślij każdemu uczestnikowi swoje zasady pracy. Koordynuj granice pracy, gałęzie Git, kolejność wdrażania i integracji oraz rozwiązywanie konfliktów. Ustal kontakt między agentami, gdy ich prace się pokrywają, zorganizuj wymianę wiedzy i informuj ich o istotnych decyzjach i zmianach. Zachowaj niezależne zadania w ruchu równoległym. Przyprowadź mi skonsolidowane wyniki oraz decyzje wymagające mojej interwencji.',
          'Połączyłam się jako agentka Morgan. Będę koordynował agentów, śledził ich pracę i przyniosę ci wyniki oraz decyzje, które wymagają twojej weryfikacji.',
        ],
        statuses: ['Przygotowanie zasad koordynacji'],
      },
      {
        title: 'Połącz specjalistę Windows',
        lines: [
          'Połącz się jako agent Jade. Jesteś odpowiedzialny za weryfikację tego projektu na Windows. Morgan koordynuje pracę; poproś ją o instrukcje.',
          'Połączyłam się jako agentka Jade. Jestem odpowiedzialny za weryfikację systemu Windows. Poinformuję Morgan o mojej roli i poproszę o instrukcje.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Morgan dowiaduje się, kto obsługuje Windows',
        lines: [
          'Połączony jako agent Jade. Obsługuję weryfikację projektu w systemie Windows i jestem gotowy do otrzymania Twoich instrukcji.',
          'Dostałem. Przesyłam do Ciebie testy Windows i koordynuję wyniki.',
        ],
        statuses: ['Dodanie Jade do planu weryfikacji Windows'],
      },
      {
        title: 'Niezależne sprawdzanie jest zasadą',
        lines: [
          'Wyślij każde zadanie zgłoszone jako zakończone do innego agenta do niezależnego testowania, używając sprawdzianów odpowiednich dla wyniku. Wskaż agenta, który wykonał pracę, i poproś testera o koordynację wszelkich poprawek bezpośrednio z nim. Tester musi zgłosić sprawdziany, wynik i pozostałe problemy. Akceptuj zadanie dopiero po potwierdzeniu przez testera, że przełapało.',
          'Zrozumiałem. Wyślę każde zadanie zgłoszone jako ukończone do innego agenta na niezależne testy.',
        ],
        statuses: ['Ustawienie reguły niezależnej kontroli'],
      },
      {
        title: 'Połączenie agenta wdrożenia',
        lines: [
          'Połącz się jako agent Leo. Twoją rolą jest implementacja. Morgan koordynuje pracę; poproś ją o instrukcje.',
          'Połączyłem się jako agent Leo. Zajmuję się wdrożeniem. Poinformuję Morgan o mojej roli i poproszę o zadanie.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Opisz funkcję Morganowi',
        lines: [
          'Zadaniem #T-1042 jest zapisywanie filtrów, które pozwalają użytkownikom ponownie używać warunków wyszukiwania. Organizuj realizację, podczas gdy pozostała praca trwa.',
          'Leo wdroży #T-1042 w swoim własnym czacie. Będę śledzić prace i zorganizować niezależną kontrolę, kiedy on zgłosi, że jest skończony.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Leo otrzymuje funkcję',
        lines: [
          'Użyj umiejętności wdrażania w zadaniu #T-1042: buduj zapisane filtry, aby użytkownicy mogli ponownie używać warunków wyszukiwania. Trzymaj tę pracę oddzielnie od innych zadań i przekaż mi wynik.',
          'Wezmę #T-1042 i najpierw sprawdzę, jak teraz działają warunki wyszukiwania.',
        ],
        statuses: [
          'Przegląd bieżącej implementacji wyszukiwania',
          'Planowanie zachowania zapisanych filtrów',
        ],
      },
      {
        title: 'Połącz agenta analizy',
        lines: [
          'Połącz się jako agent Alice. Twoja rola to analiza. Morgan koordynuje pracę; poproś ją o instrukcje.',
          'Połączyłam się jako agentka Alice. Zajmuję się analizą żądań. Poinformuję Morgan o mojej roli i poproszę o instrukcje.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Przekazanie powiązanych żądań do Morgan',
        lines: [
          'Wnioski #I-0201 i #I-0202 mogą określać tę samą potrzebę. Znajdź podstawowy problem użytkownika, sprawdź istniejący ekran wyszukiwania w Figma i powiąż wynik z #T-1042.',
          'Alice przeanalizuje oba zgłoszenia oraz ekran Figma. Skontaktuję ją z Leo, aby wynik analizy dotarł do pracy nad filtrem zapisanym.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Alice bada potrzebę',
        lines: [
          'Użyj umiejętności analitycznych do przeglądu kwestii #I-0201 i #I-0202. Sprawdź istniejący ekran wyszukiwania w Figma, zidentyfikuj podstawową potrzebę użytkownika i udostępnij odpowiednie wyniki Leo.',
          'Porównam oba wnioski z bieżącym ekranem, a następnie prześlę Leo wynik.',
        ],
        statuses: ['Odczytywanie obu żądań', 'Sprawdzanie ekranu wyszukiwania w Figma'],
      },
      {
        title: 'Pozwól wynikowi dotrzeć do czatu roboczego',
        lines: [
          'Problemy #I-0201 i #I-0202 dotyczą ponownego wykorzystania tych samych warunków wyszukiwania. Czy zadanie #T-1042 może zachować pełną kombinację?',
          '- Nie, nie, nie. Sprawdź, czy użytkownicy muszą je również udostępniać; zachowam to oddzielnie od zadania #T-1042.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Błąd Windows zmienia plan',
        lines: [
          'Import nie działa w systemie Windows. Dołączam plik, który wywołuje błąd #B-0317. Zbadaj problem i daj znać, co ustalisz.',
          'Jade odtworzy #B-0317 w systemie Windows i wyśle mi kroki oraz dowody. Jeśli błąd się potwierdzi, zorganizuję poprawkę i niezależną weryfikację.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Jade przeprowadza sprawdzenie błędu Windows',
        lines: [
          'Użyj umiejętności weryfikacji, aby odtworzyć błąd #B-0317 w systemie Windows na dołączonym pliku. Wyślij mi kroki odtworzenia i dowody.',
          'Sprawdzę import i wyślę wynik.',
        ],
        statuses: ['Otwieranie pliku importowego', 'Sprawdzanie importu w systemie Windows'],
      },
      {
        title: 'Dowody dotarły do koordynatora',
        lines: [
          'Import nie działa w systemie Windows. Oto kroki odtworzenia błędu #B-0317 i dowody.',
          'Odebrano. Zgłoszę wynik i zachowam dowody dla właściciela naprawy.',
        ],
        statuses: ['Przygotowanie raportu o błędzie'],
      },
      {
        title: 'Połączenie innego dewelopera',
        lines: [
          'Połącz się jako agent Sam. Twoją rolą jest implementacja. Morgan koordynuje pracę; poproś ją o instrukcje.',
          'Połączyłem się jako agent Sam. Zajmuję się wdrożeniem. Poinformuję Morgan o mojej roli i poproszę o zadanie.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Wynik zmienia priorytet',
        lines: [
          'Jade odtworzyła #B-0317 w systemie Windows i wysłała kroki oraz dowody. Błąd importu został potwierdzony.',
          'Ten błąd blokuje codzienną pracę. Najpierw wydaj poprawkę do #B-0317. Jeśli zadanie #T-1042 nie będzie gotowe, może trafić do kolejnego wydania. Kontynuuj nad nim pracę.',
          'Rozumiem. Sam naprawi #B-0317, a Jade niezależnie sprawdzi poprawkę w systemie Windows. Prace nad #T-1042 będą postępować osobno.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Sam otrzymuje poprawkę',
        lines: [
          'Użyj umiejętności wdrożenia, aby naprawić błąd #B-0317. Jade odtworzyła ją na Windows; oto jej kroki i dowody. Utrzymać naprawę oddzielnie od #T-1042 i skoordynować wszelkie szczegóły weryfikacji bezpośrednio z Jade.',
          'Będę badał #B-0317, przygotował rozwiązanie i wysłał kandydata na niezależne testy.',
        ],
        statuses: ['Przeglądanie kroków reprodukcji', 'Sprawdzanie kodu importowego'],
      },
      {
        title: 'Przypomnij wcześniejsze dochodzenie',
        lines: [
          'Poprzednie dochodzenie w sprawie importu w zadaniu #T-0870 może pomóc w rozwiązaniu problemu #B-0317. Znajdź poprzednie decyzje i odpowiednie przykłady.',
          'Oscar pracował nad #T-0870. Zapytam go o decyzje i przykłady, a potem podzielę się nimi z Sam i Jade.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Morgan prosi o wcześniejszą wiedzę',
        lines: [
          'Sprawdziłeś import w zadaniu #T-0870. Proszę odzyskać poprzednie decyzje i wszelkie przykłady dotyczące błędu #B-0317, a następnie udostępnić je Sam i Jade.',
          'Przejrzę dostępną historię i materiały, a następnie wysłam odpowiednie przykłady.',
        ],
        statuses: ['Zadanie przeglądu #T-0870'],
      },
      {
        title: 'Wcześniejsze decyzje dotarły do dewelopera',
        lines: [
          'Znalazłem wcześniejsze decyzje dotyczące importu i przykłady. Wysyłam je do Ciebie.',
          'Odebrano. Użyję ich w poprawce.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Te same przykłady dotarły do testownika',
        lines: [
          'Te same przykłady importu mogą pomóc w sprawdzeniu Windows. Wysyłam je.',
          'Odebrano. Włączę je do sprawdzianów.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Tymczasem praca trwa.',
        lines: [],
        statuses: [],
      },
      {
        title: 'Pierwszy kandydat jest gotowy',
        lines: [
          'Błąd #B-0317 został naprawiony. Oto kandydat na niezależne testy.',
          'Odebrano. Poproszę Jade o niezależne sprawdzenie systemu Windows.',
        ],
        statuses: ['Korzystam z NCF Agent Interconnect', 'Wiadomość wysłana'],
      },
      {
        title: 'Inny agent to przeprowadza sprawdzian.',
        lines: [
          'Sprawdź kandydata na błąd #B-0317 na Windows. Sam wdrożył go. Użyj umiejętności weryfikacji i pracuj bezpośrednio z Sam nad wszelkimi wadami. Wyślij mi wynik testu po przejściu kontroli, albo zgłaszaj zablokowanie.',
          'Sprawdzę to na Windows i będę współpracował z Sam bezpośrednio, jeśli znajdę błąd.',
        ],
        statuses: ['Przeglądanie kandydującego naprawy', 'Testowanie importu w systemie Windows'],
      },
      {
        title: 'Drugie zgłoszenie nie powiodło się',
        lines: [
          'Błąd #B-0317: pierwotny plik można zaimportować, ale próbka Oscara tworzy zduplikowany wiersz. Napraw również ten przypadek.',
          'Poprawię sytuację z powtarzającymi się wierszami i wyślę zmodyfikowanego kandydata.',
        ],
        statuses: ['Odtwarzanie zduplikowanego wiersza'],
      },
      {
        title: 'Napraw, a następnie ponownie przetestuj',
        lines: [
          'Przypadek z duplikatami został naprawiony. Oto zmodyfikowany kandydat. Proszę uruchomić ponownie ten przypadek oraz oryginalny import.',
          'Powtórzę oba importy i istniejące sprawdziany regresyjne.',
        ],
        statuses: [
          'Ponowne uruchomienie obu próbek importu',
          'Uruchamianie istniejących testów regresyjnych',
        ],
      },
      {
        title: 'Nadchodzi wynik niezależnej weryfikacji',
        lines: [
          'Błąd #B-0317 przeszedł testy w systemie Windows na poprawionej wersji Sama. Oba przykłady importu i dotychczasowe testy regresyjne zakończyły się pomyślnie. W sprawdzonym zakresie nie ma nierozwiązanych problemów.',
          'Odebrano. Włączę przyjęte naprawienie do propozycji wydania.',
        ],
        statuses: ['Przygotowanie propozycji wersji'],
      },
      {
        title: 'To Ty decydujesz, co zostanie wydane',
        lines: [
          'Podsumowuj błąd #B-0317, zadanie #T-1042 i problemy #I-0201 i #I-0202. Za każdą, powiedz mi wynik, co będzie dalej i jakiejkolwiek decyzji będziesz potrzebował ode mnie.',
          'Przygotuję stan dla każdego elementu i oznaczę decyzje, które musisz podjąć.',
        ],
        statuses: ['Kompilacja wyników wszystkich czterech pozycji'],
      },
    ],
    notes: [
      {
        html: '<p>Samodzielnie rozwijasz coraz większą aplikację. Gdy pracujesz nad funkcją z planu rozwoju, napływają zgłoszenia błędów i nowe prośby użytkowników. NCF Agent Interconnect pozwala agentom AI z Twoich zwykłych czatów współpracować nad tymi zadaniami. Pytania, ustalenia i pliki przechodzą bezpośrednio między nimi; Ty wyznaczasz kierunek i odbierasz wyniki w swoim czacie roboczym.</p><p>Ten przewodnik śledzi jednego dewelopera w tej sytuacji. Jesteś jedynym człowiekiem w historii; wszyscy wymienieni uczestnicy to agenci SI. Ich nazwy i role są przykładami, które możesz zastąpić własnymi.</p><p>Wybierz jedną z <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 gotowych instrukcji</a> i przekaż ją swojemu modelowi. Na podstawie dokumentacji NCF przygotuje on w Twoim języku szczegółowy przewodnik po wybranym przykładzie.</p>',
      },
      {
        html: '<h3>Przygotuj aplikacje i czaty</h3><p>Skonfiguruj każdą aplikację lub profil raz. Nowe rozmowy dołączają później, łącząc się pod wybranymi nazwami.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">przewodnik konfiguracji</a></p>',
      },
      {
        html: '<h3>Pracuj w swoich zwykłych czatach</h3><p>W tej historii pracujesz na Macu i utrzymujesz komputer z systemem Windows do sprawdzania aplikacji uruchamianych przez użytkowników. Już korzystasz z kilku usług AI, wybierając modele odpowiednie dla swojej pracy i balansując koszty.</p><p>Agent sztucznej inteligencji Morgan koordynuje w OpenCode. Inni uczestnicy mają swoje własne czaty; testy Windows odbywają się w Codex. Nowy uczestnik może później dołączyć do Cursor lub do innej skonfigurowanej aplikacji.</p><p>Po pierwszym uruchomieniu przypisz każdej uczestniczącej rozmowie nazwę. W głównej rozmowie ustal zasady koordynacji. Jade poinformowała już Morgan o jej roli weryfikacyjnej w systemie Windows; późniejszą pracę możesz kierować przez rozmowę koordynacyjną.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">przewodnik konfiguracji</a></p>',
      },
      {
        html: '<p>Daj koordynatorom sztucznej inteligencji osobną zasadę przyjęcia ukończonej pracy. Koordynator sztucznej inteligencji wysyła instrukcje robocze uczestnikom w chwili ich dołączenia i śledzi postęp we wszystkich zadaniach. Gdy łączysz uczestnika, nadaj temu czatowi nazwę i rolę; Morgan przydziela zadanie po tym, jak agent zgłosi tę rolę.</p>',
      },
      {
        html: '<p>Agent sztucznej inteligencji Leo jest właścicielem funkcji. Koordynator sztucznej inteligencji śledzi jej postęp.</p>',
      },
      {
        html: '<h3>Niech wyniki dotrą do roboczych czatów</h3>\n        <p>Później pojawiają się dwa powiązane żądania użytkownika. Otwierasz kolejną rozmowę analityczną; Morgan przydziela Alice żądania i łączy ją z właścicielem funkcji. AI agent Alice odkrywa, że oba żądania opisują tę samą potrzebę: użytkownicy codziennie odtwarzają identyczne warunki wyszukiwania. Przesyła wniosek bezpośrednio do rozmowy, w której buduje się funkcję saved-filter.</p>',
      },
      {
        html: '<p>Pytanie, doprecyzowanie lub wynik trafia do właściwego czatu roboczego. Każdy agent korzysta z narzędzi i instrukcji skonfigurowanych w swoim środowisku. Szczegóły znajdziesz w <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">przewodniku po aplikacjach</a>.</p>',
      },
      {
        html: '<h3>Zbadaj błąd Windows</h3>\n        <p>Użytkownik zgłasza, że import kończy się niepowodzeniem w systemie Windows. Analiza funkcji i zgłoszeń ma już swoich uczestników. Czat Jade’a w systemie Windows jest podłączony, więc Morgan prosi ją o odtworzenie błędu tam.</p>',
      },
      {
        html: '<p>Agent sztucznej inteligencji Jade, tester, odtwarza niepowodzenie i wysyła dowody bezpośrednio do czatu koordynacyjnego. Użytkownik potwierdza, że problem blokuje codzienną pracę. Poinformujesz agenta sztucznej inteligencji Morgan o zmianie priorytetu wypuszczenia wersji.</p>',
      },
      {
        html: '<p>Możesz rozszerzyć zespół, podczas gdy funkcja jest w trakcie. Agent AI Morgan udostępnia reprodukcję, ustala granice pracy i organizuje weryfikację na Windows. Koordynator AI utrzymuje zmiany oddzielnie, aby naprawa mogła zostać wydana najpierw. Agent AI Sam jest odpowiedzialny za naprawę, podczas gdy Jade testuje jej zachowanie na Windows. Zapisane filtry i analiza żądań kontynuują działanie w oryginalnych czatach. Zmieniłeś kolejność wypuszczania i dodatkowo zwiększyłeś pojemność podczas trwania pracy.</p>',
      },
      {
        html: '<h3>Przywróć wcześniejszą wiedzę do zadania</h3><p>Pamiętasz, że starszy czat zawiera dochodzenie dotyczące zachowania importu. Agent AI Oscar może przejrzeć historię oraz materiały nadal dostępne dla niego, wyjaśnić wcześniejsze decyzje i podzielić się przykładami. Deweloper AI stosuje tę wiedzę do naprawy. Tester AI wykorzystuje przykłady podczas sprawdzania poprawności w porównaniu z dzisiejszą implementacją.</p>',
      },
      {
        html: '<h3>Pliki, odpowiedzi i historia</h3><p>Historia wiadomości i kopie załączników są przechowywane lokalnie na komputerach uczestników. O przechowywaniu i przesyłaniu plików przeczytasz w <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">przewodniku po danych</a>, a o kontynuowaniu pracy w innym czacie — w <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">przewodniku po aplikacji</a>.</p>',
      },
      {
        html: '<h3>Testowanie i poprawki między agentami</h3>\n        <p>W tym przykładzie agent sztucznej inteligencji Sam działa w Cursor na Mac, podczas gdy Jade testuje w Codex na Windows. Koordynator sztucznej inteligencji otrzymuje sprawozdanie z ukończenia w OpenCode i przypisuje niezależną sprawdzian. Następne wymiany pokazują, jak agenci współpracują.</p>',
      },
      {
        html: '<h3>Zarządzanie, gdy jest potrzebne</h3><p>Twoja zwykła praca pozostaje w czatach AI. Aplikacja stacjonarna zapewnia poniższe kontrolki, gdy potrzebujesz sprawdzić połączenie lub zarządzać przechowywanymi danymi.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">przewodnik konfiguracji</a></p>',
      },
      {
        html: '<p>Agenci wymieniają wiadomości przez NCF Agent Interconnect, pozostając w swoich czatach roboczych. Konfigurację poszczególnych aplikacji opisuje <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">przewodnik</a>.</p>',
      },
      {
        html: '<p>W aplikacji komputerowej możesz przejrzeć historię agenta i w razie potrzeby usunąć jego dane lokalne. Zakres usuwania opisano w <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">przewodniku zarządzania agentami</a>.</p>',
      },
      {
        html: '<p>Agent sztucznej inteligencji Jade zgłasza się bezpośrednio do Morgan. Agenci sztucznej inteligencji Sam i Jade rozwiązuje razem znaleziska rutynowe, podczas gdy inne zadania nadal się wykonują. Możesz dodawać kontekst lub dostosowywać cel w czacie koordynacyjnym w dowolnej chwili, gdy coś się zmieni; nie musisz przekazywać każdej korekty ani zatwierdzać każdej ponownej próby.</p>',
      },
      {
        html: '<h3>Sprawdź połączenie, gdy wymiana zostanie przerwana</h3><p>Jeśli wymiana wiadomości się zatrzyma, sprawdź, czy NCF Agent Interconnect działa i czy właściwy czat jest połączony. Dalsze kroki znajdziesz w <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">przewodniku konfiguracji</a>.</p>',
      },
      {
        html: '<h3>Sprawdź wyniki i zdecyduj, co wydać</h3><p>Przed opublikowaniem agent sztucznej inteligencji Morgan przedstawia raport wyniku: co się zmieniło, co zostało sprawdzone w systemie Windows, co pozostaje otwarte i co jest zaproponowane do wydania. Ocenasz, czy rozwiązuje problem użytkownika, i decydujesz, co zostanie wydane. Zapisane filtry kontynuują działanie w kierunku własnego wyniku.</p>',
      },
    ],
  },
  nl: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Een verhaal over verbonden chats',
      skip: 'Naar inhoud overslaan',
      brandLabel: 'NCF Agent Interconnect — naar boven',
      navLabel: 'Hoofdnavigatie',
      languageLabel: 'Taal',
      languageMenuTitle: 'Kies een taal',
      closeLanguageMenu: 'Taalselectie sluiten',
      navStory: 'Het verhaal',
      navGuide: 'Veldgids',
      navStart: 'Begin maar.',
      galleryPageTitle: 'Afbeeldingsarchief — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — terug naar het verhaal',
      galleryNavLabel: 'Afbeeldingarchief navigatie',
      galleryBack: 'Terug naar het verhaal',
      galleryEyebrow: 'Afbeeldingsarchief',
      galleryTitle: 'Elke originele illustratie',
      galleryIntro:
        'Alle afbeeldingen blijven in dit prototype, inclusief die welke niet langer in volledige grootte in de strip worden gebruikt. Elke ondertekening is de bestandsnaam.',
      galleryDeveloper: 'Ontwikkelaar',
      galleryAgents: 'Agent tabletten',
      galleryBrand: 'Merkbeeld',
      galleryHeroAlt: 'Ontwikkelaar aan het bureau, heldillustratie',
      gallerySceneAlt: 'Ontwikkelaar aan het bureau, scène {number}',
      galleryReadingAlt: 'Ontwikkelaar leest het NCF Agent Interconnect boek, scène 13',
      galleryAgentAlt: 'Tabletportret van agent {name}',
      galleryIconAlt: 'NCF Agent Interconnect-appicon',
      heroEyebrow: 'Een verhaal uit je dagelijkse AI chats',
      heroTitle: 'Eén ontwikkelaar.<br /><em>Meerdere werkchats.</em>',
      heroLede:
        'Volg een bug, een nieuwe functie en de agenten die nuttige informatie uitwisselen. Jij bepaalt de richting; NCF Agent Interconnect bezorgt berichten en toegestane bestanden in de juiste chat.',
      download: 'De app downloaden',
      readStory: 'Lees het verhaal.',
      storyEyebrow: 'Het verhaal van één ontwikkelaar',
      storyTitle: 'Agenten werken samen',
      storyLede:
        'Eén persoon onderhoudt een app over bekende AI-chats. Agent Morgan coördineert in OpenCode op een Mac; Agent Jade controleert Windows in Codex, en Agent Sam herstelt de fout in Cursor op de Mac. U kiest de agentennamen. De rollen, vaardigheden en hulpmiddelen in dit verhaal zijn voorbeelden; NCF Agent Interconnect levert ze niet.',
      guideEyebrow: 'Houd de bewegende delen vrij.',
      guideTitle: 'Het werk gebeurt in de chats. De app geeft berichten door.',
      startEyebrow: 'Begin met twee chats',
      startTitle: 'Geef ze namen. Stuur één bericht.',
      startLede:
        'Installeer de desktopapp, configureer de AI-toepassingen die je gebruikt, verbind twee chats onder verschillende namen en vraag één agent om contact op te nemen met de andere.',
      setupGuide: 'Open installatiegids',
      downloadNote:
        'Installers: Apple Silicon Mac DMG, Intel Mac DMG en Windows x64 EXE. macOS 13 of nieuwer. De Intel-runtime is niet getest op Intel-hardware; er is geen Linux-installatieversie gepubliceerd.',
      footerTagline: 'Berichten tussen agenten in uw bestaande AI-chats.',
      usageGuide: 'Gebruikersgids',
      license: 'Licentie',
      systemNote: 'Opmerking',
      exampleExchange: 'Chat',
      activityLabel: 'Illustratieve activiteit',
      reader: 'Terwijl andere chats werken, kun je tijdelijk afwezig zijn.',
      developerAlt: 'De ontwikkelaar blijft aan een bureau zitten met een zichtbare computer.',
      readingAlt: 'De ontwikkelaar leest een boek over NCF Agent Interconnect aan het bureau.',
      agentAlt: 'Hoofdportret van {name} binnen een voorwaarts gerichte tablet met toolicons.',
      names: {
        user: 'Jij',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Stel je chats in.',
        'Installeer NCF Agent Interconnect, kies de bedoelde clientconfiguratie, klik op Apply, verbind MCP opnieuw en test een uitwisseling.',
        'Installatiegids',
      ],
      [
        'Ken je cliënt',
        'OpenCode, Codex en Cursor hebben verschillende leveringsgedrag en installatievereisten.',
        'Klantgegevens',
      ],
      [
        'Controleer uw gegevens',
        'Bekijk bestanden, lokale geschiedenis, exacte chatbindingen, naamoverdrachten en verwijderingsbereik.',
        'Bureaubladbesturing',
      ],
      [
        'Lees de volledige verwijzing',
        'De gebruikersgids en LLM-georiënteerde referentie bevatten de volledige procedures en grenzen die ten grondslag liggen aan dit geïllustreerde verhaal.',
        'Lees llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Geef het werk een coördinator',
        lines: [
          'Verbind je als agent Morgan. Gebruik de coördinatieskill om alle agenten te coördineren en het werk als geheel bij te houden. Stuur elke deelnemer je werkregels. Coördineer werkgebieden, Git-branches, de volgorde van implementatie en integratie, en conflictoplossing. Zet agenten in contact wanneer hun werk overlapt, regel kennisuitwisseling, en houd hen op de hoogte van relevante beslissingen en veranderingen. Houd onafhankelijke taken parallel in beweging. Lever me geconsolideerde resultaten en beslissingen die mijn input vereisen.',
          'Verbonden als agent Morgan. Ik zal de agenten coördineren, hun werk volgen en je resultaten en beslissingen overbrengen die jouw input vereisen.',
        ],
        statuses: ['Het voorbereiden van coördinatievoorschriften'],
      },
      {
        title: 'Verbind de Windows-specialist',
        lines: [
          'Verbind je als agent Jade. U bent verantwoordelijk voor het verifiëren van dit project op Windows. Morgan coördineert de werkzaamheden; vraag haar om instructies.',
          'Geconnecteerd als agent Jade. Ik ben verantwoordelijk voor de verificatie van Windows. Ik zal Morgan mijn rol vertellen en instructies vragen.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Morgan leert wie verantwoordelijk is voor Windows',
        lines: [
          'Geconnecteerd als agent Jade. Ik verwerk de projectverificatie op Windows en ben gereed voor uw instructies.',
          'Geaccepteerd. Ik route Windows-checks naar u en coördineer de resultaten.',
        ],
        statuses: ['Jade toevoegen aan het Windows-verificatieplan'],
      },
      {
        title: 'Maak onafhankelijke controle tot een standaardprocedure',
        lines: [
          'Stuur elke taak die als voltooid wordt gemeld naar een andere agent voor onafhankelijke testen, met behulp van checks die passend zijn voor het resultaat. Noem de agent die het werk heeft uitgevoerd en vraag de tester om eventuele correcties direct met die agent te coördineren. De tester moet de checks, het resultaat en de overige problemen aan jou melden. Accepteer de taak pas nadat de tester heeft bevestigd dat deze is geslaagd.',
          'Ik heb het begrepen. Ik stuur elke taak die gemeld is als voltooid door een andere agent voor onafhankelijke testen.',
        ],
        statuses: ['Het vaststellen van de onafhankelijke controleregel'],
      },
      {
        title: 'Verbind een implementatie-agent',
        lines: [
          'Verbind je als agent Leo. Je rol is implementatie. Morgan coördineert het werk; vraag haar om instructies.',
          'Geconnecteerd als agent Leo. Ik zorg voor implementatie. Ik zal Morgan mijn rol uitleggen en een opdracht vragen.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Beschrijf de functie aan Morgan',
        lines: [
          'Opdracht #T-1042 is opgeslagen met filters waarmee gebruikers hun zoekvoorwaarden kunnen hergebruiken. Organiseer de uitvoering terwijl het andere werk voortduurt.',
          'Leo zal #T-1042 implementeren in zijn eigen chat. Ik zal het werk volgen en een onafhankelijke controle regelen als hij het voltooid meldt.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Leo ontvangt de functie',
        lines: [
          'Gebruik de implementatievaardigheden voor taak #T-1042: bouw opgeslagen filters zodat gebruikers hun zoekvoorwaarden kunnen hergebruiken. Houd dit werk gescheiden van andere taken en rapporteer me je resultaat.',
          'Ik neem #T-1042 en inspecteer eerst hoe zoekvoorwaarden nu werken.',
        ],
        statuses: [
          'Beoordeling van de huidige zoekimplementatie',
          'Het plannen van het gedrag van opgeslagen filters',
        ],
      },
      {
        title: 'Verbind een analyseagent',
        lines: [
          'Verbind je als agent Alice. Je rol is analyse. Morgan coördineert het werk; vraag haar om instructies.',
          'Verbonden als agent Alice. Ik ben verantwoordelijk voor aanvraaganalyse. Ik zal Morgan mijn rol uitleggen en instructies vragen.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Zorg dat Morgan gerelateerde verzoeken ontvangt',
        lines: [
          'Verzoeken #I-0201 en #I-0202 kunnen dezelfde behoefte beschrijven. Zoek het onderliggende gebruikersprobleem, controleer het bestaande zoekscherm in Figma en verbind het resultaat met #T-1042.',
          'Alice zal zowel de verzoeken als het Figma-scherm analyseren. Ik zet haar in contact met Leo zodat de vondst het opgeslagen-filterwerk bereikt.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Alice onderzoekt de noodzaak',
        lines: [
          'Gebruik de analyse vaardigheden om problemen #I-0201 en #I-0202 te bekijken. Controleer het bestaande zoekbeeld in Figma, identificeer de onderliggende gebruikersbehoefte en deel relevante bevindingen met Leo.',
          'Ik vergelijk beide verzoeken met het huidige scherm en stuur Leo het resultaat.',
        ],
        statuses: ['Het lezen van beide verzoeken', 'Het controleren van het zoekscherm in Figma'],
      },
      {
        title: 'Laat de bevinding de werkende chat bereiken',
        lines: [
          'Problemen #I-0201 en #I-0202 gaan over het hergebruiken van dezelfde zoekvoorwaarden. Kan taak #T-1042 de volledige combinatie behouden?',
          '- Ja, dat weet ik. Controleer of gebruikers ze ook moeten delen; dat zal ik apart houden van taak #T-1042.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Een Windows-bug verandert het plan',
        lines: [
          'Importeren mislukt op Windows. Ik voeg het importbestand toe dat bug #B-0317 veroorzaakt. Onderzoek het probleem en laat weten wat je vindt.',
          'Jade zal #B-0317 op Windows reproduceren en mij de stappen en het bewijs sturen. Als de bug wordt bevestigd, regel ik de oplossing en een onafhankelijke controle.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Jade onderzoekt de Windows-bug',
        lines: [
          'Gebruik de verificatievaardigheid om bug #B-0317 op Windows te reproduceren met het bijgevoegde importbestand. Stuur me de reproductiestappen en het bewijs.',
          'Ik controleer de import en stuur je het resultaat.',
        ],
        statuses: ['Het openen van het importbestand', 'Controleer de import op Windows'],
      },
      {
        title: 'Bewijs bereikt de coördinator',
        lines: [
          'Importeren mislukt op Windows. Hier zijn de reproductiestappen en het bewijs voor #B-0317.',
          'Ontvangen. Ik zal het resultaat melden en het bewijs voor de eigenaar van de fix bewaren.',
        ],
        statuses: ['Het voorbereiden van het foutverslag'],
      },
      {
        title: 'Verbind een andere ontwikkelaar',
        lines: [
          'Verbind je als agent Sam. Je rol is implementatie. Morgan coördineert het werk; vraag haar om instructies.',
          'Geconnecteerd als agent Sam. Ik zorg voor implementatie. Ik zal Morgan mijn rol uitleggen en een opdracht vragen.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Het resultaat verandert de prioriteit',
        lines: [
          'Jade heeft #B-0317 op Windows gereproduceerd en de stappen en het bewijs gestuurd. De importfout is bevestigd.',
          'Deze bug belemmert het dagelijkse werk. Breng de oplossing voor #B-0317 eerst uit. Als taak #T-1042 nog niet klaar is, kan die in de volgende release volgen. Laat dat werk intussen doorgaan.',
          'Begrepen. Sam lost #B-0317 op en Jade controleert de oplossing onafhankelijk op Windows. Ik laat #T-1042 afzonderlijk doorgaan.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Sam ontvangt de fix',
        lines: [
          'Gebruik de implementatievaardigheden om fout #B-0317 op te lossen. Jade reproduceerde het op Windows; hier zijn haar stappen en bewijs. Houd de fix gescheiden van #T-1042 en coördineer alle verificatiegegevens rechtstreeks met Jade.',
          'Ik zal #B-0317 onderzoeken, de oplossing voorbereiden en een kandidaat sturen voor onafhankelijke testen.',
        ],
        statuses: [
          'Het controleren van de stappen om de fout te reproduceren',
          'Het controleren van de importcode',
        ],
      },
      {
        title: 'Herinner me aan een eerder onderzoek',
        lines: [
          'Een eerder onderzoek naar importeren in taak #T-0870 kan helpen bij #B-0317. Zoek de toen genomen beslissingen en relevante voorbeelden.',
          'Oscar werkte aan #T-0870. Ik zal hem vragen om de beslissingen en voorbeelden, dan delen ze met Sam en Jade.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Morgan vraagt om vroegere kennis',
        lines: [
          'U onderzocht import in taak #T-0870. Herstel de vorige beslissingen en eventuele voorbeelden die relevant zijn voor bug #B-0317, en deel ze dan met Sam en Jade.',
          'Ik zal de beschikbare geschiedenis en materialen bekijken en vervolgens de relevante voorbeelden verzenden.',
        ],
        statuses: ['Onderzoeksopdracht #T-0870'],
      },
      {
        title: 'Eerdere beslissingen bereiken de ontwikkelaar',
        lines: [
          'Ik heb de eerdere importbeslissingen en voorbeelden gevonden. Ik stuur ze naar u.',
          'Ontvangen. Ik zal ze gebruiken in de fix.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Dezelfde voorbeelden bereiken de tester.',
        lines: [
          'Dezelfde importvoorbeelden kunnen uw Windows-check helpen. Ik stuur ze door.',
          'Ontvangen. Ik zal ze opnemen in de checks.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Ondertussen wordt verder gewerkt.',
        lines: [],
        statuses: [],
      },
      {
        title: 'De eerste kandidaat is gereed',
        lines: [
          'Bug #B-0317 is opgelost. Hier is de kandidaat voor onafhankelijke testen.',
          'Ontvangen. Ik zal Jade vragen om een onafhankelijke Windows-check.',
        ],
        statuses: ['NCF Agent Interconnect gebruiken', 'Bericht verzonden'],
      },
      {
        title: 'Een andere agent test het.',
        lines: [
          'Test de kandidaat voor bug #B-0317 op Windows. Sam heeft het geïmplementeerd. Gebruik de verificatievaardigheden en werk direct met Sam op eventuele defecten. Stuur me je eigen testresultaat als de controles voorbij zijn, of meld een blokker.',
          'Ik zal het testen op Windows en direct met Sam samenwerken als ik een defect vind.',
        ],
        statuses: ['Het beoordelen van de kandidaat-fix', 'Testen van import op Windows'],
      },
      {
        title: 'Een tweede case mislukt',
        lines: [
          'Bug #B-0317: het oorspronkelijke bestand wordt geïmporteerd, maar het voorbeeldbestand van Oscar levert een dubbele rij op. Los ook dit geval op.',
          'Ik zal het geval met dubbele rijen oplossen en een herziene kandidaat verzenden.',
        ],
        statuses: ['Reproductie van de dubbele rij'],
      },
      {
        title: 'Correctie, dan opnieuw testen.',
        lines: [
          'De fout met de dubbele rij is verholpen. Hier is de herziene versie. Test dit geval en het oorspronkelijke importbestand opnieuw.',
          'Ik zal zowel de imports als de bestaande regressietests opnieuw uitvoeren.',
        ],
        statuses: [
          'Opnieuw uitvoeren van beide importvoorbeelden',
          'Uitvoeren van bestaande regressietests',
        ],
      },
      {
        title: 'Het onafhankelijke resultaat komt',
        lines: [
          'Bug #B-0317 is met de herziene versie van Sam geslaagd voor de Windows-test. Beide importvoorbeelden en de bestaande regressietests zijn geslaagd. Binnen het geteste bereik staan geen problemen meer open.',
          'Ontvangen. Ik zal de geaccepteerde oplossing opnemen in het releasevoorstel.',
        ],
        statuses: ['Voorbereiding van het releasevoorstel'],
      },
      {
        title: 'Jij beslist wat wordt uitgebracht',
        lines: [
          'Samenvat fout #B-0317, taak #T-1042 en problemen #I-0201 en #I-0202. Vertel me voor elk het resultaat tot nu toe, wat er volgt en welke beslissing je nodig hebt van mij.',
          'Ik zal voor elk item een status voorbereiden en de beslissingen markeren die u moet nemen.',
        ],
        statuses: ['Het samenvoegen van de resultaten voor alle vier de items'],
      },
    ],
    notes: [
      {
        html: '<p>Je onderhoudt in je eentje een groeiende app. Terwijl je een functie op de planning bouwt, komen bugmeldingen binnen en vragen gebruikers om nieuwe dingen. NCF Agent Interconnect laat de AI-agenten in je vertrouwde chats samenwerken aan deze taken. Vragen, bevindingen en bestanden gaan rechtstreeks tussen hen heen en weer; jij bepaalt de richting en ontvangt het resultaat in je werkchat.</p><p>Deze gids volgt één ontwikkelaar door die situatie heen. Jij bent de enige mens in het verhaal; alle genoemde deelnemers zijn AI-agents. Hun namen en rollen zijn voorbeelden die je kunt vervangen door je eigen.</p><p>Kies een van de <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 kant-en-klare prompts</a> en geef die aan je eigen model. Op basis van de NCF-documentatie maakt het in jouw taal een uitgebreide uitleg van het gekozen voorbeeld.</p>',
      },
      {
        html: '<h3>Bereid je apps en chats voor</h3><p>Stel elke applicatie of profiel één keer in. Nieuwe chats sluiten zich vervolgens aan door verbinding te maken onder de namen die u zelf kiest.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">installatiehandleiding</a></p>',
      },
      {
        html: '<h3>Werk in je gebruikelijke chats</h3><p>In dit verhaal werk je op een Mac en houd je een Windows-computer aan om de applicatie te testen die je gebruikers uitvoeren. Je gebruikt al verschillende AI-diensten, waarbij je modellen kiest die bij je werk passen en de kosten in evenwicht houdt.</p><p>AI-agent Morgan coördineert in OpenCode. Andere deelnemers hebben hun eigen chats; de Windows checks vinden plaats in Codex. Een nieuwe deelnemer kan zich later aansluiten bij Cursor of een andere geconfigureerde toepassing.</p><p>Na de eerste instelling, geef elke deelnemende chat een naam. Stel in je hoofdchat de coördinatierules vast. Jade heeft Morgan nu haar Windows-verificatierol doorgegeven; je kunt latere werkzaamheden via de coördinatiechat leiden.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">installatiehandleiding</a></p>',
      },
      {
        html: '<p>Geef de AI-coördinator een aparte regel voor het accepteren van voltooid werk. De AI-coördinator stuurt werkinstructies naar de deelnemers zodra zij zich aansluiten en volgt de voortgang over alle taken. Wanneer je een deelnemer verbindt, geef die chat een naam en rol; Morgan deelt het werk uit nadat de agent die rol heeft gemeld.</p>',
      },
      {
        html: '<p>AI agent Leo is verantwoordelijk voor de functionaliteit. De AI-coördinator volgt de voortgang daarvan.</p>',
      },
      {
        html: '<h3>Laat de bevindingen de AI-conversaties bereiken die worden gebruikt voor werk</h3>\n        <p>Later komen er twee gerelateerde gebruikersverzoeken. Je opent een andere analysechat; Morgan wijst Alice de verzoeken toe en stelt haar in contact met de eigenaar van de functionaliteit. AI-agent Alice ontdekt dat beide verzoeken dezelfde behoefte beschrijven: gebruikers herhalen elke dag dezelfde zoekcondities. Ze stuurt het resultaat direct naar de chat waar de saved-filter-functionaliteit wordt ontwikkeld.</p>',
      },
      {
        html: '<p>Een vraag, aanvulling of resultaat komt terecht in de juiste werkchat. Elke agent gebruikt de tools en instructies uit zijn eigen omgeving. Lees meer in de <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">applicatiehandleiding</a>.</p>',
      },
      {
        html: '<h3>Onderzoek de Windows-bug</h3>\n        <p>Een gebruiker meldt dat de import mislukt op Windows. De functionaliteit en aanvraaganalyse hebben al hun eigen deelnemers. Jade’s Windows-chat is verbonden, dus Morgan vraagt haar om de fout daar te reproduceren.</p>',
      },
      {
        html: '<p>AI-agent Jade, de tester, reproduceert de fout en stuurt het bewijs rechtstreeks naar de coördinatie-chat. De gebruiker bevestigt dat het probleem het dagelijks werk blokkeert. Je informeert AI-agent Morgan hoe dit de releaseprioriteit verandert.</p>',
      },
      {
        html: '<p>Je kunt het team uitbreiden terwijl de functie doorgaat. AI-agent Morgan deelt de reproductie, komt overeen over werkgebieden en regelt verificatie op Windows. De AI-coördinator houdt de wijzigingen apart zodat de fix eerst kan worden uitgebracht. AI-agent Sam is verantwoordelijk voor de fix, terwijl Jade het gedrag op Windows controleert. Opgeslagen filters en aanvraaganalyse blijven doorgaan in hun oorspronkelijke chats. U hebt de releasevolgorde gewijzigd en capaciteit toegevoegd terwijl het werk aan de gang is.</p>',
      },
      {
        html: '<h3>Breng vroegere kennis terug in de taak</h3><p>Je herinnert je dat een oudere chat een onderzoek bevat naar importgedrag. AI-agent Oscar kan de geschiedenis en materialen die nog beschikbaar zijn, herzien, eerdere beslissingen uitleggen en voorbeelden delen. De AI-ontwikkelaar past die kennis toe op de oplossing. De AI-tester gebruikt de voorbeelden bij het controleren tegen de huidige implementatie.</p>',
      },
      {
        html: '<h3>Bestanden, antwoorden en geschiedenis</h3><p>Berichtgeschiedenis en kopieën van bijlagen worden lokaal bewaard op de computers van de deelnemers. De <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">gegevenshandleiding</a> beschrijft opslag en bestandsoverdracht; de <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">desktophandleiding</a> legt uit hoe je in een andere chat verdergaat.</p>',
      },
      {
        html: '<h3>Laat testen en correcties plaatsvinden tussen agenten</h3>\n        <p>In dit voorbeeld werkt AI-agent Sam in Cursor op de Mac, terwijl Jade test in Codex op Windows. De AI-coördinator ontvangt het voltooiingsverslag in OpenCode en wijst de onafhankelijke check toe. De volgende uitwisselingen tonen hoe de agenten samenwerken.</p>',
      },
      {
        html: '<h3>Beheer wanneer je dat nodig hebt</h3><p>Je dagelijkse werk blijft in de AI-chats. De desktopapp biedt de onderstaande controles wanneer u een verbinding moet inspecteren of opgeslagen gegevens moet beheren.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">installatiehandleiding</a></p>',
      },
      {
        html: '<p>Agenten wisselen via NCF Agent Interconnect berichten uit terwijl ze in hun eigen werkchats blijven. De <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">applicatiehandleiding</a> beschrijft de instelling per app.</p>',
      },
      {
        html: '<p>In de desktopapp kun je de geschiedenis van een agent bekijken en zo nodig de lokale gegevens verwijderen. De <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">handleiding voor agentbeheer</a> legt uit wat wordt verwijderd.</p>',
      },
      {
        html: '<p>AI-agent Jade meldt rechtstreeks aan Morgan. AI-agenten Sam en Jade verwerken routinematige bevindingen samen, terwijl andere taken doorgaan. U kunt context toevoegen of het doel in de coördinatiechat aanpassen wanneer er iets verandert; u hoeft niet elke correctie door te geven of elke hertest te goedkeuren.</p>',
      },
      {
        html: '<h3>Controleer de verbinding wanneer de uitwisseling stopt</h3><p>Als de uitwisseling stopt, controleer dan of NCF Agent Interconnect draait en de juiste chat is verbonden. De volgende stappen staan in de <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">installatiehandleiding</a>.</p>',
      },
      {
        html: '<h3>Bekijk het resultaat en beslis wat je uitbrengt</h3><p>Vóór publicatie biedt de AI-agent Morgan u een verslag van het resultaat: wat is gewijzigd, wat is getest op Windows, wat open blijft en wat wordt voorgesteld voor release. U beoordeelt of dit het probleem van de gebruiker aanpakt en beslist welke software wordt uitgebracht. Bewaarde filters gaan verder naar hun eigen resultaat.</p>',
      },
    ],
  },
  uk: {
    copy: {
      pageTitle: 'NCF Agent Interconnect — Історія пов’язаних чатів',
      skip: 'Перейти до контенту',
      brandLabel: 'NCF Agent Interconnect — на початок сторінки',
      navLabel: 'Головна навігація',
      languageLabel: 'Мова',
      languageMenuTitle: 'Виберіть мову',
      closeLanguageMenu: 'Закрити вибір мови',
      navStory: 'Історія',
      navGuide: 'Полеве керівництво',
      navStart: 'Почніть',
      galleryPageTitle: 'Архів зображень — NCF Agent Interconnect',
      galleryBrandLabel: 'NCF Agent Interconnect — повернутися до історії',
      galleryNavLabel: 'Навігація по архіву зображень',
      galleryBack: 'Повернімося до історії',
      galleryEyebrow: 'Архів зображень',
      galleryTitle: 'Кожна оригінальна ілюстрація',
      galleryIntro:
        "Усі зображення залишаються в цьому прототипі, в тому числі ті, які більше не використовуються у повному розмірі в коміксі. Кожна підпис є ім'ям файлу активу.",
      galleryDeveloper: 'Розробник',
      galleryAgents: 'Планшети агента',
      galleryBrand: 'Актив бренду',
      galleryHeroAlt: 'Розробник за столом, ілюстрація героя',
      gallerySceneAlt: 'Розробник за столом, сцена {number}',
      galleryReadingAlt: 'Розробник читає книгу NCF Agent Interconnect, сцена 13',
      galleryAgentAlt: 'Портрет агента {name} на планшеті',
      galleryIconAlt: 'Ікона додатка NCF Agent Interconnect',
      heroEyebrow: 'Історія з ваших повсякденних чатів з штучним інтелектом',
      heroTitle: 'Один розробник.<br /><em>Багато робочих чатів.</em>',
      heroLede:
        'Простежте за помилкою, новою функцією та агентами, які передають одне одному важливі відомості. Ви задаєте напрям; NCF Agent Interconnect доставляє повідомлення й дозволені файли до потрібного чату.',
      download: 'Завантажити додаток',
      readStory: 'Прочитайте історію.',
      storyEyebrow: 'Історія одного розробника',
      storyTitle: 'Агенти працюють разом',
      storyLede:
        'Одна людина підтримує додаток через знайомі чати з штучним інтелектом. Агент Morgan координує в OpenCode на Mac; агент Jade перевіряє Windows у Codex, а агент Sam виправляє помилку в Cursor на Mac. Ви обираєте імена агентів. Ролі, навички та інструменти в цій історії є прикладами; NCF Agent Interconnect не надає їх.',
      guideEyebrow: 'Зберігайте рухомі частини чистими',
      guideTitle: 'Робота відбувається в чатах. Застосунок передає повідомлення.',
      startEyebrow: 'Почніть з двох чатів',
      startTitle: 'Надайте їм імена. Відправте одне повідомлення.',
      startLede:
        'Встановіть настільний додаток, налаштуйте використовувані додатки штучного інтелекту, підключіть два чати під різними іменами та попросіть одного агента зв’язатися з іншим.',
      setupGuide: 'Відкрити інструкцію з налаштування',
      downloadNote:
        'Інсталятори: Apple Silicon Mac DMG, Intel Mac DMG і Windows x64 EXE. macOS 13 або новішої версії. Час виконання Intel не тестувався на апаратному забезпеченні Intel; жоден інсталятор для Linux не опубліковано.',
      footerTagline:
        'Повідомлення між агентами в існуючих чатах з використанням штучного інтелекту.',
      usageGuide: 'Руководство користувача',
      license: 'Ліцензія',
      systemNote: 'Зауваження',
      exampleExchange: 'Чат',
      activityLabel: 'Ілюстраційна діяльність',
      reader: 'Поки інші чати працюють, ви можете відійти.',
      developerAlt: "Розробник залишається сидіти за столом із видимим комп'ютером.",
      readingAlt: 'Розробник читає книгу про NCF Agent Interconnect за столом.',
      agentAlt: 'Головний портрет {name} у передній частині планшету з іконами інструментів.',
      names: {
        user: 'Ти ...',
        morgan: 'Morgan',
        leo: 'Leo',
        alice: 'Alice',
        jade: 'Jade',
        sam: 'Sam',
        oscar: 'Oscar',
      },
    },
    guide: [
      [
        'Налаштуйте свої чати',
        'Встановіть NCF Agent Interconnect, виберіть потрібну конфігурацію клієнта, натисніть Apply, знову підключіть MCP і протестуйте обмін.',
        'Руководство для налаштування',
      ],
      [
        'Знай свого клієнта.',
        'OpenCode, Codex і Cursor мають різну поведінку доставки та вимоги до налаштування.',
        'Деталі клієнта',
      ],
      [
        'Керуйте своїми даними',
        'Перевірте файли, локальну історію, точні зв’язки в чаті, передачі імен і обсяг видалення.',
        'Управління робочим столом',
      ],
      [
        'Читайте повну довідку',
        'У посібнику користувача та довіднику, орієнтованому на LLM, містяться повні процедури та обмеження, що лежать в основі цієї ілюстрованої історії.',
        'Читати llms.txt',
      ],
    ],
    scenes: [
      {
        title: 'Надайте роботі координатора',
        lines: [
          'З’єднайтесь як агент Morgan. Використовуйте навичку координації, щоб координувати всіх агентів і стежити за роботою в цілому. Надішліть кожному учаснику свої робочі правила. Координуйте межі роботи, гілки Git, послідовність впровадження та інтеграції, а також вирішення конфліктів. Налаштуйте зв’язок між агентами, коли їхні завдання перетинаються, організуйте обмін знаннями та держіть їх у курсі відповідних рішень і змін. Забезпечте паралельний рух незалежних завдань. Надішліть мені консолідовані результати та рішення, які потребують моєї участі.',
          'Підключилася як агентка Morgan. I will coordinate the agents, track their work and bring you results and decisions that need your input.',
        ],
        statuses: ['Підготовка правил координації'],
      },
      {
        title: 'Підключити спеціаліста з Windows',
        lines: [
          'Підключіться як агент Jade. Ви відповідаєте за перевірку цього проекту на Windows. Morgan координує роботу; запитайте її про інструкції.',
          'Підключилася як агентка Jade. Я відповідаю за верифікацію Windows. Я повідомлю Morgan про свою роль і попрошу інструкції.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Morgan дізнається, хто відповідає за Windows',
        lines: [
          "З'єднаний як агент Jade. Я виконую верифікацію проекту на Windows і готовий до ваших інструкцій.",
          'Прийнято. Я перенаправлю перевірки Windows до вас і координую результати.',
        ],
        statuses: ['Додавання Jade до плану перевірки Windows'],
      },
      {
        title: 'Зробіть незалежну перевірку правилом',
        lines: [
          'Відправте кожну задачу, яка повідомляється як завершена, іншому агенту для незалежного тестування, використовуючи перевірки, відповідні результату. Вкажіть агента, який виконав роботу, і попросіть тестера координувати будь-які виправлення безпосередньо з ним. Тестер повинен надати звіт про перевірки, результат та залишкові питання. Приймайте завдання лише після підтвердження тестером його успішного проходження.',
          'Зрозуміло. Я надішлю кожну задачу, яка була повідомлена як завершена, іншому агенту для незалежного тестування.',
        ],
        statuses: ['Налаштування правила незалежної перевірки'],
      },
      {
        title: 'Підключити агент реалізації',
        lines: [
          'Підключіться як агент Leo. Ваша роль — реалізація. Morgan координує роботу; запитайте її про інструкції.',
          'Підключився як агент Leo. Я займаюся реалізацією. Я повідомлю Morgan про свою роль і попрошу завдання.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Описати функцію Morgan',
        lines: [
          'Задача #T-1042 - це збережені фільтри, які дозволяють користувачам повторно використовувати умови пошуку. Організуйте реалізацію, поки інші роботи тривають.',
          'Leo буде впроваджувати #T-1042 у своєму власному чаті. Я буду відстежувати роботу і організувати незалежну перевірку, коли він повідомить про її завершення.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Leo отримує функцію',
        lines: [
          'Використовуйте навички реалізації для завдання #T-1042: побудуйте збережені фільтри, щоб користувачі могли повторно використовувати свої умови пошуку. Тримайте цю роботу окремо від інших завдань і повідомте мені про свій результат.',
          'Я займуся #T-1042 і спочатку перевіряю, як працюють умови пошуку зараз.',
        ],
        statuses: [
          'Перегляд поточної реалізації пошуку',
          'Планування поведінки збереженого фільтру',
        ],
      },
      {
        title: 'Підключити аналітичний агент',
        lines: [
          'З’єднайтеся як агент Alice. Ваша роль — аналіз. Morgan координує роботу; запитайте її про інструкції.',
          'Підключилася як агентка Alice. Я займаюся аналізом запитів. Я повідомлю Morgan про свою роль і попроситиму інструкції.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Додайте пов’язані запити до Morgan',
        lines: [
          "Запроси #I-0201 і #I-0202 можуть описувати ту ж потребу. Знайдіть основну проблему користувача, перевірте наявний пошуковий екран у Figma і пов'яжіть висновок до #T-1042.",
          'Alice will analyse both requests and the Figma screen. I will put her in touch with Leo so the finding reaches the saved-filter work.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Alice досліджує потребу',
        lines: [
          'Використовуйте навички аналізу для перегляду питань #I-0201 і #I-0202. Перевірте наявний пошуковий екран у Figma, визначте основну потребу користувача і поділиться відповідними висновками з Leo.',
          'Я порівняю обидва запити з поточним екраном, а потім надішлю Leo висновок.',
        ],
        statuses: ['Читання обох запитів', 'Перевірка екрану пошуку в Figma'],
      },
      {
        title: 'Нехай виявлення досягне робочого чату',
        lines: [
          'Проблеми #I-0201 і #I-0202 стосуються повторного використання тих же умов пошуку. Чи може завдання #T-1042 зберегти повну комбінацію?',
          '- Так, так. Перевірте, чи користувачам також потрібно їх поділитися; я тримаю це окремо від завдання #T-1042.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Помилка в Windows змінює план',
        lines: [
          'У Windows не вдається імпортувати файл. Додаю файл, який спричиняє помилку #B-0317. Дослідіть проблему й повідомте, що з’ясували.',
          'Jade відтворить #B-0317 у Windows і надішле мені кроки та докази. Якщо помилка підтвердиться, я організую виправлення й незалежну перевірку.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Jade перевіряє помилку у Windows',
        lines: [
          'Скористайтеся навичкою перевірки, щоб відтворити помилку #B-0317 у Windows на доданому файлі. Надішліть мені кроки відтворення та докази.',
          'Я перевірю імпорт і надішлю вам результат.',
        ],
        statuses: ['Відкриття файлу імпорту', 'Перевірка імпорту на Windows'],
      },
      {
        title: 'Докази надходять до координатора',
        lines: [
          'Імпорт у Windows не працює. Ось кроки відтворення помилки #B-0317 і докази.',
          'Отримала. Повідомлю про результат і збережу докази для агента, який виправлятиме помилку.',
        ],
        statuses: ['Підготовка звіту про помилки'],
      },
      {
        title: 'Підключити іншого розробника',
        lines: [
          'Підключіться як агент Sam. Ваша роль — реалізація. Morgan координує роботу; запитайте її про інструкції.',
          'Підключився як агент Sam. Я відповідаю за реалізацію. Я повідомлю Morgan про свою роль і попроситиму завдання.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Результат змінює пріоритет',
        lines: [
          'Jade відтворила #B-0317 у Windows і надіслала кроки та докази. Помилку імпорту підтверджено.',
          'Ця помилка заважає щоденній роботі. Спочатку випустіть виправлення для #B-0317. Якщо завдання #T-1042 ще не готове, його можна додати до наступного випуску. Продовжуйте працювати над ним.',
          'Зрозуміла. Sam виправить #B-0317, а Jade незалежно перевірить результат у Windows. Роботу над #T-1042 продовжу окремо.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Sam отримує виправлення',
        lines: [
          'Використовуйте навички впровадження для виправлення помилки #B-0317. Jade відтворив його на Windows; ось її кроки і докази. Тримайте виправлення окремо від #T-1042 і координуйте будь-які деталі перевірки безпосередньо з Jade.',
          'Я розслідую #B-0317, підготую виправлення і відправлю кандидата на незалежне тестування.',
        ],
        statuses: ['Перевірка кроків відтворення', 'Перевірка імпортного коду'],
      },
      {
        title: 'Поверніться до попереднього розслідування',
        lines: [
          'Раніше проведене імпортне розслідування за завданням #T-0870 може допомогти з #B-0317. Знайдіть попередні рішення та будь-які відповідні приклади.',
          'Oscar працював на #T-0870. Я запитаю його про рішення і приклади, а потім поділю їх з Sam і Jade.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Morgan запитує про попередні знання',
        lines: [
          'Ви досліджували імпорт у завдання #T-0870. Будь ласка, поверніть попередні рішення і будь-які приклади, що стосуються помилки #B-0317, а потім поділиться ними з Sam і Jade.',
          'Я ознайомлюся з доступною історією та матеріалами, а потім надішлю відповідні приклади.',
        ],
        statuses: ['Задача перегляду #T-0870'],
      },
      {
        title: 'Попередні рішення досягають розробника',
        lines: [
          'Я знайшов попередні рішення щодо імпорту та приклади. Надсилаю їх вам.',
          'Прийнято. Я використаю їх у фіксації.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Такі самі приклади досягають тестера',
        lines: [
          'Такі самі приклади імпорту можуть допомогти вашій перевірці Windows. Надсилаю їх.',
          'Прийнято. Я включу їх до перевірок.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Тим часом робота продовжується',
        lines: [],
        statuses: [],
      },
      {
        title: 'Перший кандидат готовий',
        lines: [
          'Буг #B-0317 виправлений. Ось кандидат на незалежне тестування.',
          'Прийнято. Я попроситиму Jade незалежну перевірку Windows.',
        ],
        statuses: ['Використовую NCF Agent Interconnect', 'Повідомлення надіслано'],
      },
      {
        title: 'Інший агент тестує його',
        lines: [
          'Тестування кандидата на помилку #B-0317 на Windows. Sam реалізував його. Використовуйте навички перевірки і працюйте безпосередньо з Sam з будь-якими дефектами. Пошлі мені власний результат тесту, коли проведуть перевірки, або повідом про блокатор.',
          'Я протестую це на Windows і працюватиму безпосередньо з Sam, якщо виявлю дефект.',
        ],
        statuses: ['Перегляд пропонованого виправлення', 'Тестування імпорту на Windows'],
      },
      {
        title: 'Другий випадок не пройшов',
        lines: [
          'Помилка #B-0317: початковий файл імпортується, але зразок Oscar створює дубльований рядок. Виправте й цей випадок.',
          'Я виправлю випадок дублювання рядків і відправлю переглянутий кандидат.',
        ],
        statuses: ['Відтворення дублюючого рядка'],
      },
      {
        title: 'Виправити, а потім перевірити ще раз',
        lines: [
          'The duplicate-row case is fixed. Here is the revised candidate. Please rerun that case and the original import.',
          'Я повторю як імпорт, так і існуючі перевірки регресії.',
        ],
        statuses: ['Повторне виконання обох вибірок імпорту', 'Виконання існуючих тестів регресії'],
      },
      {
        title: 'Незалежний результат надходить',
        lines: [
          'Помилка #B-0317 пройшла перевірку у Windows на оновленій версії Sam. Обидва зразки для імпорту та наявні регресійні перевірки пройшли успішно. У перевіреному обсязі відкритих проблем немає.',
          'Отримано. Я включу прийняті виправлення в пропозицію щодо випуску.',
        ],
        statuses: ['Підготовка пропозиції про випуск'],
      },
      {
        title: 'Ви вирішуєте, що випускати',
        lines: [
          'Підсумовуйте помилку #B-0317, завдання #T-1042 і проблеми #I-0201 і #I-0202. За кожну, скажіть мені результат, що відбувається далі і будь-яке рішення, яке вам потрібно від мене.',
          'Я підготую статус для кожного пункту і позначу рішення, які ви повинні прийняти.',
        ],
        statuses: ['Збирання результатів для всіх чотирьох пунктів'],
      },
    ],
    notes: [
      {
        html: '<p>Ви підтримуєте зростаючу програму самостійно. Повідомлення про помилки надходять, коли ви реалізуєте функцію дорожньої карти, а нові запити користувачів також потребують уваги. NCF Agent Interconnect дозволяє агентам штучного інтелекту в ваших звичних чатах працювати над цими завданнями разом. Питання, висновки та файли безпосередньо передаються між ними; ви встановлюєте напрям і отримуєте результати в робочому чаті.</p><p>Цей гід відстежує одного розробника у цій ситуації. Ви єдиний людина в історії; всі зазначені учасники — агенти штучного інтелекту. Їхні імена та ролі є прикладами, які ви можете замінити на свої.</p><p>Виберіть один із <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 готових промптів</a> і передайте його своїй моделі. На основі документації NCF вона підготує вашою мовою докладний посібник за обраним прикладом.</p>',
      },
      {
        html: '<h3>Підготуйте свої додатки та чати</h3><p>Налаштуйте кожну програму або профіль один раз. Нові чати потім приєднуються, з’єднуючись під обраними іменами.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">посібник з налаштування</a></p>',
      },
      {
        html: '<h3>Працюйте у своїх звичайних чатах</h3><p>У цій історії ви працюєте на Mac і зберігаєте комп\'ютер з Windows для перевірки додатка, який використовують ваші користувачі. Ви вже використовуєте кілька AI-сервісів, вибираючи моделі, які підходять для вашої роботи, і збалансовуєте витрати.</p><p>Агент AI Morgan координує в OpenCode. Інші учасники мають свої власні чати; перевірки Windows відбуваються в Codex. Новий учасник може пізніше приєднатися до Cursor або іншого сконфігурованого додатку.</p><p>Після першого налаштування надайте кожному брату чату ім\'я. У головному чаті встановіть правила координації. Jade вже повідомила Morgan свою ролі перевірки Windows; подальшу роботу можна керувати через координаційний чат.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">посібник з налаштування</a></p>',
      },
      {
        html: "<p>Дайте координатору штучного інтелекту окреме правило для прийняття завершеної роботи. Координатор штучного інтелекту надсилає робочі інструкції учасникам під час їх підключення та слідкує за прогресом у всіх завданнях. Коли ви підключаєте учасника, надайте цьому чату ім'я та роль; Morgan призначає роботу після того, як агент підтвердить цю роль.</p>",
      },
      {
        html: '<p>AI агент Leo володіє функцією. Координатор штучного інтелекту слідує за її розвитком.</p>',
      },
      {
        html: '<h3>Передавайте висновки до робочих чатів</h3>\n        <p>Пізніше надходять дві пов’язані запити користувачів. Ви відкриваєте ще один аналітичний чат; Morgan надає Alice ці запити і встановлює зв’язок між нею та власником функції. Агент AI Alice виявляє, що обидва запити описують одну й ту ж потребу: користувачі щодня повторюють однакові умови пошуку. Вона надсилає виявлення безпосередньо в чат, де розробляється функція saved-filter.</p>',
      },
      {
        html: '<p>Запитання, уточнення або результат потрапляє до потрібного робочого чату. Кожен агент використовує інструменти й інструкції свого середовища. Докладніше — у <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">посібнику для застосунків</a>.</p>',
      },
      {
        html: '<h3>Дослідіть помилку у Windows</h3>\n        <p>Користувач повідомляє про невдачу імпорту на Windows. Аналіз функції та запиту вже має своїх учасників. Чат Jade на Windows підключений, тому Morgan просить її відтворити помилку там.</p>',
      },
      {
        html: '<p>AI agent Jade, the tester, reproduces the failure and sends the evidence directly to the coordination chat. The user confirms that the problem blocks daily work. You tell AI agent Morgan how this changes the release priority.</p>',
      },
      {
        html: '<p>Ви можете розширити команду, поки функція триває. Агент AI Morgan ділиться репродукцією, узгоджує межі роботи та організовує перевірку на Windows. Координатор AI зберігає зміни окремо, щоб виправлення могло бути випущено першим. Агент AI Sam відповідає за виправлення, тоді як Jade перевіряє його поведінку на Windows. Збережені фільтри та аналіз запитів продовжуються у вихідних чатах. Ви змінили порядок випуску та додали потужність під час виконання роботи.</p>',
      },
      {
        html: '<h3>Поверніть до завдання раніше отримані відомості</h3><p>Пам’ятаєте, що попередній чат містить розслідування поведінки імпорту. Агент ЗІ Oscar може оглянути історію та матеріали, які все ще доступні йому, пояснити попередні рішення та поділитися прикладами. Розробник ЗІ застосовує ці знання до виправлення. Тестер ЗІ використовує приклади під час перевірки виправлення щодо сучасної реалізації.</p>',
      },
      {
        html: '<h3>Файли, відповіді та історія</h3><p>Історія повідомлень і копії вкладень зберігаються локально на комп’ютерах учасників. Зберігання й передавання файлів описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">посібнику з даних</a>, а продовження роботи в іншому чаті — у <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">посібнику з програми</a>.</p>',
      },
      {
        html: '<h3>Нехай агенти самі перевіряють і виправляють</h3>\n        <p>У цьому прикладі агент AI Sam працює в Cursor на Mac, тоді як Jade тестує в Codex на Windows. Координатор штучного інтелекту отримує звіт про завершення в OpenCode і призначає незалежну перевірку. Наступні обміни показують, як агенти працюють разом.</p>',
      },
      {
        html: '<h3>Керування за потреби</h3><p>Ваша звичайна робота залишається в чатах з штучним інтелектом. Настільний додаток надає нижче зазначені інструменти керування, коли потрібно перевірити підключення або керувати збереженими даними.</p><p><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">посібник з налаштування</a></p>',
      },
      {
        html: '<p>Агенти обмінюються повідомленнями через NCF Agent Interconnect, залишаючись у своїх робочих чатах. Налаштування кожного застосунку описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">посібнику</a>.</p>',
      },
      {
        html: '<p>У настільному застосунку можна переглянути історію агента й за потреби видалити його локальні дані. Обсяг видалення описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">посібнику з керування агентами</a>.</p>',
      },
      {
        html: '<p>AI-агент Jade звітує безпосередньо до Morgan. Агенти AI Sam і Jade разом вирішують рутинні виявлення, тоді як інші завдання продовжують виконуватися. Ви можете додавати контекст або змінювати мету в координаційному чаті в разі зміни умов; не потрібно передавати кожну корекцію або затверджувати кожен повторний тест.</p>',
      },
      {
        html: '<h3>Перевірте з’єднання, якщо обмін зупинився</h3><p>Якщо обмін повідомленнями зупинився, перевірте, чи працює NCF Agent Interconnect і чи підключений потрібний чат. Подальші кроки наведено в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">посібнику з налаштування</a>.</p>',
      },
      {
        html: '<h3>Отримайте результати й вирішіть, що випускати</h3><p>Перед публікацією агент ІІ Morgan надасть вам один звіт про результат: що змінилося, що було перевірено на Windows, що залишається відкритим і що пропонується до випуску. Ви оцінюєте, чи вирішує це проблему користувача, і вирішуєте, що потрапляє в реліз. Збережені фільтри продовжують діяти для власного результату.</p>',
      },
    ],
  },
};

// Publication copy. Array positions follow the named keys in app.js.
window.NCF_SITE_COPY = {
  en: {
    shared: [
      'Choose a story',
      'Stories',
      'How to connect your assistants',
      'Download NCF Agent Interconnect',
      'Documentation',
      'Messages and files between AI assistants.',
      'After the story',
    ],
    home: [
      'NCF Agent Interconnect — assistants working together',
      'Give AI assistants parts of a shared task. Let them exchange messages and files, coordinate their work and keep you involved.',
      'Give your AI assistants different parts of one task. With NCF Agent Interconnect, they can exchange messages and files, work at the same time and coordinate their decisions.',
      'Keep talking to each assistant, or ask one to coordinate the others and discuss everything with it. You can clarify requirements, add work and change direction as you go.',
      'See how it works',
      'Plan a party',
      'Start with an ordinary AI chat. Bring in help with the activities, costs and food as you need it. All in one application on one computer.',
      'The party-planning protagonist talks to her assistant at a laptop.',
      'Handle several tasks in one project',
      'Develop a feature, review user requests and fix a bug. The assistants work in different AI applications and on different computers.',
      'The project-story protagonist works at a laptop.',
      'More ways your assistants can help',
      'The stories show two examples. The same exchange can help with documents, research, calculations and everyday tasks. You decide who does what and how the assistants work together.',
      'Work on several tasks at once',
      'One assistant gathers material, another prepares a calculation and a third checks the result. Each has a conversation with the details it needs. As work progresses, they can ask each other questions and use what is already ready.',
      'Agree on who handles each part',
      'Ask assistants to divide the work and tell each other about changes. They can agree on shared details, avoid doing the same work twice and notice when their decisions no longer fit together.',
      'Review and improve a result',
      'Give another assistant a document or calculation to check. It can discuss findings with the author, receive a revised version and check it again. You can join that conversation and decide when the result meets your needs.',
      'Consult earlier work',
      'If you discussed a relevant question with another assistant before, ask the team to contact it. That assistant can explain its earlier findings and share materials it still has. The new task gets a useful starting point.',
      'Keep talking while the work progresses',
      'Talk to each assistant directly, or ask one to coordinate the others. It can pass on your preferences, collect results and bring you questions that need your decision.',
      'Add requirements, change priorities and bring in help for a separate task as you go. Assistants already at work can continue their parts with the updated decisions.',
      'In one application—or several',
      'For a first exchange, two AI chats in one application on one computer are enough. Later, connect assistants in other AI applications if that is where the models, tools or materials you need are available.',
      'NCF Agent Interconnect supports OpenCode v1, Codex Desktop, Cursor and AionUi with Cursor Agent. Assistants can also work on different computers on the same local network. Each keeps using the capabilities of its own application.',
      'Application setup and differences',
      'Keep the materials and messages within reach',
      'Assistants can send documents, lists, calculations and other files with their explanations. NCF Agent Interconnect keeps the history of their messages and received files, including across restarts.',
      "In the settings and monitoring window, check connections and message delivery or open a local agent's messages and files. You can see what was shared and return to it later.",
      'Settings, monitoring and history',
      'Keep the essentials clear',
      'Agents work in chats. NCF Agent Interconnect delivers their messages.',
      'Connect your chats',
      'Install NCF Agent Interconnect, choose the configuration file for your application, review the changes and click Apply. Reconnect MCP and check a message exchange.',
      'Setup guide',
      'Know your application',
      'OpenCode v1, Codex Desktop, Cursor and AionUi with Cursor Agent have different delivery behavior and setup requirements.',
      'Application details',
      'Control your data',
      'Review attachments, local history, the exact connected chat, name transfers and what deletion removes.',
      'Settings and monitoring',
      'Read the full documentation',
      'The user guide and language-model reference explain the working steps and limits of NCF Agent Interconnect.',
      'Open llms.txt',
      'Start with two chats',
      'Give the agents names. Send a message.',
      'Install NCF Agent Interconnect, configure the connection for your chosen AI application, connect two chats under different names and ask one agent to contact the other.',
      'macOS downloads are available as DMGs for Apple Silicon and Intel Mac; Windows uses an x64 EXE. macOS 13 or later is required. The Intel Mac package has not been run on Intel hardware. No Linux installer is published.',
    ],
    development: [
      'Handle several tasks in one project — NCF Agent Interconnect',
      'Follow AI assistants handling several project tasks together across applications and computers.',
      'The longer story',
      'Handle several tasks in one project',
      'Your AI assistants can work in different AI applications, even on different computers on the same local network. With NCF Agent Interconnect, they exchange messages and files and help each other with shared tasks. Keep talking to them in your usual chats.',
      'See how this helps with several tasks in one project: developing a feature, reviewing user requests and fixing bugs.',
    ],
    holiday: [
      'Plan a party — NCF Agent Interconnect',
      'See AI assistants plan a party together, sharing messages and files through NCF Agent Interconnect.',
      'An illustrative story',
      'Plan a party',
      'Start with an ordinary conversation with an AI assistant. When a separate task comes up, give it to another assistant. Each gets its own part of the work and a conversation with the details it needs. Everyone in this story works in one AI application on one computer.',
      'Start with what you are already discussing',
      'You are planning a party at home. While discussing the activities, you also want to work out the costs. Keep planning with the first assistant and ask a second one to handle the calculations.',
      'Open a second AI chat for the costs. Ideas and preferences stay in one conversation, prices and calculations in another. The assistants can work on their parts at the same time.',
      'Give the assistants names and introduce them',
      'First, configure NCF Agent Interconnect for your chosen AI application once. After that, assistants connect directly from their chats.',
      'Amy and Ben are names you chose. Now the assistants can address each other by name. Introduce them with an ordinary request.',
      "Let one assistant's work help another",
      'Amy suggests a workshop and sends Ben a list of materials. Ben finds that the workshop costs too much and tells Amy.',
      'Amy changes the plan and Ben updates the calculation. Each handles a different part, while they agree on decisions together. Their work comes together in one party plan.',
      'Keep talking as the work progresses',
      'While the assistants are working, you learn that children will be coming too. Discuss the new requirements straight away.',
      'Talk to any assistant to clarify requirements, ask questions or add work. If you prefer to discuss everything with Amy, ask her to pass changes on to the others and collect their results.',
      'Bring in help when you need it',
      'Now it is time to plan the food. Open another chat to work on the menu with Kate. Amy continues the activities and Ben the costs.',
      'A new assistant joins when a separate piece of work comes up. The menu, activities and costs each have someone responsible, and they agree on shared details.',
      'Bring the result together',
      'You now have three materials that fit together: a party plan, a menu with a shopping list and a cost estimate. Discuss any of them with its author, or continue everything through Amy. Start with one assistant and bring in others as you need them. One AI application on one computer is enough.',
      'Party plan',
      'Party budget',
      'Menu and shopping',
      'AI assistant',
      'You',
      'You at a desk with a laptop.',
      'Agent {name} on a tablet screen.',
      'Frames {frames} of {total}. {description}',
      'An ordinary AI chat before an agent connects',
      'Agent {name} chat',
      'Illustrative actions by {name}',
      'Illustrative result files',
      'Party plan',
      'Menu and shopping list',
      'Cost estimate',
      'After discussing your preferences, Kate prepares the menu and sends the shopping list to Ben.',
    ],
    holidayDialogue: [
      [
        'Help me plan a party at home for ten guests. The budget for the whole party is 20,000 rubles. We have board games at home, but I would like to consider other activities too.',
        'I will prepare a few activity options and list what we would need to buy for each.',
      ],
      [
        'Connect as agent Amy. Keep planning the party activities. Ben will work out the costs—discuss what we need with him.',
        'Connected as agent Amy. I will continue the plan and prepare a list for the cost estimate.',
      ],
      [
        'Connect as agent Ben. Help with the party costs. Amy is planning the activities: ask her for the requirements and agree on purchases with her.',
        'Connected as agent Ben. I will ask Amy about the party requirements and work out the costs.',
      ],
      [
        'I am considering a workshop for ten guests. Here is the list of materials. Work out how much would be left for food from the total budget of 20,000 rubles.',
        'At these prices, the materials would take too much of the budget. Choose a less expensive activity so there is enough left for food.',
      ],
      [
        'I will replace the workshop with games we already have at home. I have updated the plan and shopping list. Recalculate the costs using the new list.',
        'I will recalculate the costs using the updated list.',
      ],
      [
        'Four children will be coming too—plan something for them as well. Keep the same budget.',
        "I will add children's games and tell Ben that there are now fourteen guests.",
      ],
      [
        "There are now fourteen guests, including four children. I am adding children's games. Check the costs for the new guest count; the total budget is unchanged.",
        'I will account for the extra guests and check the costs. I will keep the same total budget.',
      ],
      [
        'Show me how much is left for food and which costs still need checking.',
        'I will check the latest estimate and list the costs that still need confirming.',
      ],
      [
        'Connect as agent Kate. Help prepare a menu and shopping list. Ask Amy for the requirements and agree on costs with Ben. Before making the menu, ask me about food preferences.',
        'Connected as agent Kate. I will ask about your food preferences before preparing the menu, and ask Amy about the guest count and party plan.',
      ],
      [
        'I will handle the food. How many guests are coming, and when are you planning a break to eat?',
        'There are fourteen guests, including four children. Here is the current party plan, with the food break marked.',
      ],
      [
        'I have prepared the menu using the preferences we discussed. Here is the shopping list. Use it for the food estimate so we are working from one list.',
        'I will include these purchases in the overall estimate.',
      ],
      [
        'Bring together the party plan, menu and cost estimate. Ask Ben and Kate for their latest versions. Show me what is ready and what I still need to decide.',
        'I will ask Ben and Kate for the latest versions and bring the result together.',
      ],
      [
        'Send the latest cost estimate. List any questions that are still waiting for a decision separately.',
        'Here is the current estimate and the list of costs that still need confirming.',
      ],
      [
        'Send the latest menu and shopping list. List any questions that are still waiting for a decision separately.',
        'Here are the menu and shopping list. I have listed the remaining questions separately.',
      ],
      [
        'I have brought together the party plan, menu with shopping list and cost estimate. I have listed the questions that need your decision separately.',
      ],
    ],
    holidayActivity: [
      'Using NCF Agent Interconnect',
      'Message sent',
      'Looking for activity options',
      'Listing what we will need',
      'Preparing the materials list',
      'Updating the cost estimate',
      'Checking costs for fourteen guests',
      'Putting together the cost summary',
      'Adding food to the cost estimate',
    ],
  },
  ru: {
    shared: [
      'К выбору историй',
      'Истории',
      'Как подключить помощников',
      'Скачать NCF Agent Interconnect',
      'Документация',
      'Обмен сообщениями и файлами между ИИ-помощниками.',
      'После истории',
    ],
    home: [
      'NCF Agent Interconnect — совместная работа помощников',
      'Поручите ИИ-помощникам части общей задачи. Они смогут обмениваться сообщениями и файлами, согласовывать работу и держать вас в курсе.',
      'Поручите ИИ-помощникам разные части одной задачи. С NCF Agent Interconnect они смогут обмениваться сообщениями и файлами, работать одновременно и согласовывать решения между собой.',
      'Вы продолжаете общаться с каждым или обсуждаете всё с одним помощником, который координирует остальных. По ходу можно уточнять условия, добавлять поручения и менять направление работы.',
      'Посмотрите, как это происходит',
      'Организуем праздник',
      'Начинаем с обычного ИИ-чата. По мере необходимости подключаем помощников для программы, расходов и угощения. Всё — в одном приложении на одном компьютере.',
      'Героиня истории обсуждает праздник с помощником за ноутбуком.',
      'Ведём несколько задач одного проекта',
      'Разрабатываем новую функцию, разбираем запросы пользователей и исправляем ошибку. Помощники работают в разных AI-приложениях и на разных компьютерах.',
      'Герой истории работает за ноутбуком над проектом.',
      'Что ещё можно поручить помощникам',
      'Истории показывают два примера. Такой же обмен помогает в работе с документами, исследованиях, расчётах и повседневных делах. Вы выбираете, кто чем займётся и как помощники будут взаимодействовать.',
      'Вести несколько задач одновременно',
      'Один помощник собирает материалы, другой готовит расчёт, третий проверяет результат. У каждого свой разговор с нужными подробностями. По ходу работы они могут задавать друг другу вопросы и использовать то, что уже готово.',
      'Договариваться, кто за что отвечает',
      'Попросите помощников распределить работу и сообщать друг другу об изменениях. Так они смогут согласовать общие детали, избежать повторного выполнения одной работы и вовремя заметить, что их решения расходятся.',
      'Проверять и дорабатывать результат',
      'Передайте документ или расчёт другому помощнику для проверки. Он может обсудить замечания с автором, получить исправленный вариант и проверить его ещё раз. Вы можете участвовать в этом разговоре и решать, когда результат вас устраивает.',
      'Обращаться к прежним решениям',
      'Если нужный вопрос уже разбирали с другим помощником, попросите обратиться к нему. Он сможет объяснить прежние выводы и поделиться материалами, которые у него сохранились. Новая работа получает полезную отправную точку.',
      'Продолжайте разговор, пока идёт работа',
      'Можно обращаться к каждому помощнику напрямую или поручить одному координировать остальных. Он сможет передавать ваши пожелания, собирать результаты и выносить на обсуждение вопросы, где нужно ваше решение.',
      'По ходу добавляйте новые условия, меняйте приоритеты и подключайте помощь для отдельной задачи. Уже работающие помощники смогут продолжить свои части с учётом новых договорённостей.',
      'В одном приложении — или в разных',
      'Для первого обмена достаточно двух ИИ-чатов в одном приложении на одном компьютере. Позже можно подключить помощников из других AI-приложений, если там есть нужные вам модели, инструменты или материалы.',
      'NCF Agent Interconnect поддерживает OpenCode v1, Codex Desktop, Cursor и AionUi с Cursor Agent. Помощники могут работать и на разных компьютерах одной локальной сети. Каждый продолжает пользоваться возможностями своего приложения.',
      'Настройка и особенности приложений',
      'Материалы и переписка остаются под рукой',
      'Помощники могут передавать документы, списки, расчёты и другие файлы вместе с пояснениями. NCF Agent Interconnect сохраняет историю их сообщений и полученные файлы, в том числе после перезапуска.',
      'В окне настройки и мониторинга можно проверить подключения и доставку сообщений, открыть переписку и файлы локального агента. Вы видите, что было передано, и можете вернуться к этому позже.',
      'Настройка, мониторинг и история',
      'Что важно различать',
      'Агенты работают в чатах. NCF Agent Interconnect доставляет их сообщения.',
      'Подключите чаты',
      'Установите NCF Agent Interconnect, выберите нужный файл конфигурации приложения, проверьте изменения и нажмите Apply. Затем переподключите MCP и проверьте обмен сообщениями.',
      'Руководство по настройке',
      'Учитывайте особенности приложений',
      'OpenCode v1, Codex Desktop, Cursor и AionUi с Cursor Agent различаются способом доставки сообщений и требованиями к настройке.',
      'Особенности приложений',
      'Контролируйте данные',
      'Проверьте вложения, локальную историю, привязку к конкретному чату, перенос имён и то, какие данные удаляются.',
      'Настройка и мониторинг',
      'Читайте полную документацию',
      'В руководстве пользователя и справочнике для языковых моделей подробно описаны шаги работы и ограничения NCF Agent Interconnect.',
      'Открыть llms.txt',
      'Начните с двух чатов',
      'Дайте агентам имена. Отправьте сообщение.',
      'Установите NCF Agent Interconnect, настройте подключение для выбранного AI-приложения, подключите два чата под разными именами и попросите одного агента написать другому.',
      'Для macOS доступны DMG для Apple Silicon и Intel Mac, для Windows — EXE x64. Требуется macOS 13 или новее. Сборка для Intel Mac не проверялась на компьютере с процессором Intel. Установщик для Linux не опубликован.',
    ],
    development: [
      'Ведём несколько задач одного проекта — NCF Agent Interconnect',
      'Как ИИ-помощники ведут несколько задач одного проекта в разных приложениях и на разных компьютерах.',
      'Большая история',
      'Ведём несколько задач одного проекта',
      'Ваши ИИ-помощники могут работать в разных AI-приложениях и даже на разных компьютерах в одной локальной сети. С NCF Agent Interconnect они обмениваются сообщениями и файлами и помогают друг другу решать общие задачи. Вы продолжаете общаться с ними в привычных чатах.',
      'Посмотрим, как это помогает вести несколько задач одного проекта: разрабатывать новую функцию, разбирать запросы пользователей и исправлять ошибки.',
    ],
    holiday: [
      'Организуем праздник — NCF Agent Interconnect',
      'История о том, как ИИ-помощники вместе планируют домашний праздник с NCF Agent Interconnect.',
      'Иллюстративная история',
      'Организуем праздник',
      'Вы начинаете с обычного разговора с ИИ-помощником. Когда появляется отдельная задача, её можно поручить ещё одному помощнику. У каждого будет своя часть работы и свой разговор, где собраны нужные детали. В этой истории все работают в одном AI-приложении на одном компьютере.',
      'Начните с того, что уже обсуждаете',
      'Вы готовите домашний праздник. Пока обсуждаете развлечения, хочется разобраться и с расходами. Программу можно продолжить с первым помощником, а расчёты поручить второму.',
      'Для расходов вы открываете второй ИИ-чат. Так идеи и пожелания остаются в одном разговоре, а цены и расчёты — в другом. Помощники смогут заниматься своими частями одновременно.',
      'Дайте помощникам имена и познакомьте их',
      'Сначала нужно один раз настроить NCF Agent Interconnect для выбранного AI-приложения. После этого помощники подключаются прямо из своих чатов.',
      'Amy и Ben — имена, которые вы выбрали. Теперь помощники могут обращаться друг к другу по имени. Чтобы познакомить их, достаточно обычной просьбы.',
      'Пусть результаты одной работы помогают другой',
      'Amy предлагает мастер-класс и отправляет Ben список материалов. Ben замечает, что мастер-класс выходит слишком дорогим, и сообщает Amy.',
      'Amy меняет программу, Ben обновляет расчёт. Каждый занят своей частью, но решения они согласуют между собой. Их работа складывается в общий план праздника.',
      'Продолжайте разговор по ходу работы',
      'Пока помощники работают, вы узнаёте, что придут ещё и дети. Новые пожелания можно обсудить сразу.',
      'Вы можете обращаться к любому помощнику: уточнять условия, задавать вопросы и добавлять поручения. Если удобнее обсуждать всё с Amy, попросите её передавать изменения остальным и собирать их результаты.',
      'Подключите помощь, когда она понадобилась',
      'Теперь нужно продумать угощение. Вы открываете ещё один чат, чтобы заняться меню с Kate. Amy продолжает программу, Ben — расходы.',
      'Новая помощница появляется, когда возникает отдельная работа. У меню, программы и расходов есть свои ответственные, которые согласуют общие детали.',
      'Соберите результат',
      'В результате у вас три согласованных материала: программа праздника, меню со списком покупок и расчёт расходов. Вы можете обсудить любой из них с его автором или продолжить всё через Amy. Начать можно с одного помощника и подключать других по мере необходимости. Достаточно одного AI-приложения на одном компьютере.',
      'Программа праздника',
      'Расходы на праздник',
      'Меню и покупки',
      'ИИ-помощник',
      'Вы',
      'Вы за столом с ноутбуком.',
      'Портрет агента {name} на планшете.',
      'Кадры {frames} из {total}. {description}',
      'Обычный ИИ-чат до подключения агента',
      'Чат агента {name}',
      'Иллюстративные действия {name}',
      'Иллюстративные файлы результата',
      'Программа праздника',
      'Меню и список покупок',
      'Расчёт расходов',
      'Обсудив ваши пожелания, Kate составляет меню и отправляет Ben список покупок.',
    ],
    holidayDialogue: [
      [
        'Помоги придумать программу домашнего праздника для десяти гостей. Бюджет на весь праздник — 20 000 рублей. Дома есть настольные игры, но хочется рассмотреть и другие развлечения.',
        'Подготовлю несколько вариантов программы. Отдельно отмечу, что для каждого понадобится купить.',
      ],
      [
        'Подключись как агент Amy. Продолжай заниматься программой праздника. Расходы будет считать Ben — обсуждай с ним, что нам понадобится.',
        'Подключилась как агент Amy. Продолжу программу и подготовлю список для расчёта расходов.',
      ],
      [
        'Подключись как агент Ben. Помоги с расходами на праздник. Программу ведёт Amy: узнай у неё условия и согласовывай с ней покупки.',
        'Подключился как агент Ben. Узнаю у Amy условия праздника и займусь расходами.',
      ],
      [
        'Рассматриваю мастер-класс для десяти гостей. Отправляю список материалов. Посчитай, сколько останется на угощение из общего бюджета в 20 000 рублей.',
        'По этим ценам материалы займут слишком большую часть бюджета. Подбери вариант подешевле, чтобы осталось на угощение.',
      ],
      [
        'Заменю мастер-класс играми, которые уже есть дома. Обновила программу и список покупок. Пересчитай расходы по новому списку.',
        'Пересчитаю расходы по обновлённому списку.',
      ],
      [
        'Будут ещё четверо детей — придумай занятие и для них. Бюджет оставим прежним.',
        'Добавлю детские игры и сообщу Ben, что гостей теперь четырнадцать.',
      ],
      [
        'Гостей теперь четырнадцать, из них четверо детей. Добавляю детские игры. Проверь расходы с новым числом гостей; общий бюджет остаётся прежним.',
        'Учту новое число гостей и проверю расходы. Общий бюджет оставляю прежним.',
      ],
      [
        'Покажи, сколько сейчас остаётся на угощение и какие расходы ещё нужно уточнить.',
        'Сверю актуальный расчёт и отдельно отмечу расходы, которые ещё предстоит уточнить.',
      ],
      [
        'Подключись как агент Kate. Помоги составить меню и список покупок. Условия узнай у Amy, а расходы согласуй с Ben. Перед составлением меню уточни у меня пожелания по еде.',
        'Подключилась как агент Kate. Перед меню уточню ваши пожелания по еде, а у Amy узнаю число гостей и программу праздника.',
      ],
      [
        'Я займусь угощением. Расскажи, сколько будет гостей и когда вы планируете перерыв на еду.',
        'Гостей четырнадцать, из них четверо детей. Отправляю актуальную программу — в ней отмечен перерыв на угощение.',
      ],
      [
        'Подготовила меню с учётом пожеланий. Отправляю список покупок. Используй его для расчёта еды, чтобы у нас был один список.',
        'Учту покупки по этому списку в общем расчёте.',
      ],
      [
        'Собери программу, меню и расчёт расходов. Попроси Ben и Kate прислать последние варианты. Покажи, что уже готово и что мне ещё нужно решить.',
        'Запрошу последние варианты у Ben и Kate и соберу результат вместе.',
      ],
      [
        'Пришли последнюю версию расчёта расходов. Отдельно укажи вопросы, которые пока ждут решения.',
        'Отправляю актуальный расчёт и список расходов, которые ещё нужно уточнить.',
      ],
      [
        'Пришли последние версии меню и списка покупок. Отдельно укажи вопросы, которые пока ждут решения.',
        'Отправляю меню и список покупок. Оставшиеся вопросы отметила отдельно.',
      ],
      [
        'Собрала программу праздника, меню со списком покупок и расчёт расходов. Отдельно отметила вопросы, по которым нужно ваше решение.',
      ],
    ],
    holidayActivity: [
      'Использую NCF Agent Interconnect',
      'Сообщение отправлено',
      'Подбираю варианты программы',
      'Собираю список того, что понадобится',
      'Готовлю список материалов',
      'Обновляю расчёт расходов',
      'Проверяю расходы на четырнадцать гостей',
      'Собираю сводку расходов',
      'Добавляю угощение в расчёт расходов',
    ],
  },
};
window.NCF_SITE_COPY.fr = {
  shared: [
    `Choisir une histoire`,
    `Histoires`,
    `Comment connecter vos assistants`,
    `Télécharger NCF Agent Interconnect`,
    `Documentation`,
    `Messages et fichiers échangés entre assistants IA.`,
    `Après l’histoire`,
  ],
  home: [
    `NCF Agent Interconnect — des assistants qui travaillent ensemble`,
    `Confiez aux assistants IA différentes parties d’une même tâche. Ils échangent messages et fichiers, coordonnent leur travail et vous tiennent au courant.`,
    `Confiez à vos assistants IA différentes parties d’une même tâche. Avec NCF Agent Interconnect, ils peuvent échanger messages et fichiers, travailler en même temps et coordonner leurs décisions.`,
    `Continuez à parler à chaque assistant, ou demandez à l’un d’eux de coordonner les autres et discutez de tout avec lui. Vous pouvez préciser vos attentes, ajouter des tâches et changer de direction en cours de route.`,
    `Découvrez comment cela fonctionne`,
    `Organiser une fête`,
    `Commencez par une conversation ordinaire avec une IA. Faites appel à d’autres assistants pour les activités, le budget et le repas au fil des besoins. Le tout dans une seule application, sur un seul ordinateur.`,
    `L’héroïne de l’histoire prépare une fête avec son assistant devant un ordinateur portable.`,
    `Gérer plusieurs tâches dans un même projet`,
    `Développez une fonctionnalité, examinez les demandes des utilisateurs et corrigez un bug. Les assistants travaillent dans différentes applications d’IA et sur plusieurs ordinateurs.`,
    `Le héros de l’histoire travaille sur son projet devant un ordinateur portable.`,
    `D’autres façons de travailler avec vos assistants`,
    `Les histoires présentent deux exemples. Ces mêmes échanges peuvent aider à préparer des documents, mener des recherches, faire des calculs et gérer des tâches courantes. Vous décidez qui fait quoi et comment les assistants collaborent.`,
    `Mener plusieurs tâches de front`,
    `Un assistant rassemble des éléments, un autre prépare un calcul et un troisième vérifie le résultat. Chacun dispose d’une conversation avec les détails dont il a besoin. À mesure que le travail avance, ils peuvent se poser des questions et réutiliser ce qui est déjà prêt.`,
    `Répartir les responsabilités`,
    `Demandez aux assistants de se partager le travail et de s’informer des changements. Ils peuvent s’accorder sur les détails communs, éviter les doublons et remarquer quand leurs décisions ne sont plus cohérentes.`,
    `Vérifier et améliorer un résultat`,
    `Confiez un document ou un calcul à un autre assistant pour vérification. Il peut discuter de ses remarques avec l’auteur, recevoir une nouvelle version et la vérifier à nouveau. Vous pouvez prendre part à cet échange et décider quand le résultat vous convient.`,
    `Reprendre des travaux antérieurs`,
    `Si vous avez déjà étudié une question avec un autre assistant, demandez à l’équipe de le contacter. Il peut expliquer ses conclusions précédentes et partager les éléments qu’il possède encore. La nouvelle tâche bénéficie ainsi d’un point de départ utile.`,
    `Restez dans la conversation pendant que le travail avance`,
    `Parlez directement à chaque assistant ou demandez à l’un d’eux de coordonner les autres. Il peut transmettre vos préférences, rassembler les résultats et vous soumettre les questions qui exigent votre décision.`,
    `Ajoutez des exigences, changez les priorités et sollicitez de l’aide pour une tâche distincte en cours de route. Les assistants déjà au travail peuvent poursuivre leur part en tenant compte des nouvelles décisions.`,
    `Dans une seule application, ou dans plusieurs`,
    `Pour un premier échange, deux conversations IA dans une même application sur un seul ordinateur suffisent. Vous pourrez ensuite connecter des assistants dans d’autres applications d’IA si elles disposent des modèles, outils ou documents dont vous avez besoin.`,
    `NCF Agent Interconnect prend en charge OpenCode v1, Codex Desktop, Cursor et AionUi avec Cursor Agent. Les assistants peuvent aussi travailler sur différents ordinateurs d’un même réseau local. Chacun continue d’utiliser les fonctions de sa propre application.`,
    `Configuration et particularités des applications`,
    `Gardez messages et documents à portée de main`,
    `Les assistants peuvent transmettre des documents, listes, calculs et autres fichiers avec leurs explications. NCF Agent Interconnect conserve l’historique de leurs messages et les fichiers reçus, même après un redémarrage.`,
    `Dans la fenêtre de configuration et de suivi, vérifiez les connexions et la livraison des messages, ou ouvrez les messages et fichiers d’un agent local. Vous voyez ce qui a été partagé et pouvez y revenir plus tard.`,
    `Configuration, suivi et historique`,
    `Les points essentiels`,
    `Les agents travaillent dans leurs conversations. NCF Agent Interconnect transmet leurs messages.`,
    `Connectez vos conversations`,
    `Installez NCF Agent Interconnect, choisissez le fichier de configuration de votre application, vérifiez les modifications et cliquez sur Apply. Reconnectez MCP, puis vérifiez l’échange de messages.`,
    `Guide de configuration`,
    `Connaissez votre application`,
    `OpenCode v1, Codex Desktop, Cursor et AionUi avec Cursor Agent diffèrent par leur mode de livraison et leurs exigences de configuration.`,
    `Détails des applications`,
    `Gardez le contrôle de vos données`,
    `Vérifiez les pièces jointes, l’historique local, la conversation précisément connectée, le transfert des noms et les données supprimées.`,
    `Configuration et suivi`,
    `Consultez la documentation complète`,
    `Le guide utilisateur et la référence destinée aux modèles de langage décrivent les étapes de travail et les limites de NCF Agent Interconnect.`,
    `Ouvrir llms.txt`,
    `Commencez avec deux conversations`,
    `Nommez les agents. Envoyez un message.`,
    `Installez NCF Agent Interconnect, configurez la connexion pour l’application d’IA choisie, connectez deux conversations sous des noms différents et demandez à un agent de contacter l’autre.`,
    `Pour macOS, des fichiers DMG sont disponibles pour les Mac Apple Silicon et Intel ; Windows utilise un EXE x64. macOS 13 ou une version ultérieure est requis. Le paquet Intel Mac n’a pas été exécuté sur une machine Intel. Aucun installateur Linux n’est publié.`,
  ],
  development: [
    `Gérer plusieurs tâches dans un même projet — NCF Agent Interconnect`,
    `Suivez des assistants IA qui gèrent ensemble plusieurs tâches d’un projet, dans différentes applications et sur plusieurs ordinateurs.`,
    `La grande histoire`,
    `Gérer plusieurs tâches dans un même projet`,
    `Vos assistants IA peuvent travailler dans différentes applications d’IA, y compris sur plusieurs ordinateurs d’un même réseau local. Avec NCF Agent Interconnect, ils échangent messages et fichiers et s’entraident sur des tâches communes. Continuez à leur parler dans vos conversations habituelles.`,
    `Découvrez comment ils peuvent gérer plusieurs tâches d’un projet : développer une fonctionnalité, examiner des demandes d’utilisateurs et corriger des bugs.`,
  ],
  holiday: [
    `Organiser une fête — NCF Agent Interconnect`,
    `Découvrez comment des assistants IA préparent ensemble une fête en échangeant messages et fichiers grâce à NCF Agent Interconnect.`,
    `Une histoire illustrative`,
    `Organiser une fête`,
    `Commencez par une conversation ordinaire avec un assistant IA. Lorsqu’une tâche distincte apparaît, confiez-la à un autre assistant. Chacun a sa part du travail et une conversation qui rassemble les détails nécessaires. Dans cette histoire, tout le monde travaille dans une seule application d’IA sur un seul ordinateur.`,
    `Partez de votre conversation en cours`,
    `Vous organisez une fête chez vous. En discutant des activités, vous souhaitez aussi estimer les dépenses. Continuez à préparer le programme avec le premier assistant et confiez les calculs à un second.`,
    `Ouvrez une deuxième conversation IA pour les dépenses. Les idées et préférences restent dans l’une, les prix et les calculs dans l’autre. Les assistants peuvent travailler en même temps sur leurs parties.`,
    `Nommez les assistants et présentez-les`,
    `Commencez par configurer une fois NCF Agent Interconnect pour l’application d’IA choisie. Les assistants pourront ensuite se connecter directement depuis leurs conversations.`,
    `Amy et Ben sont les noms que vous avez choisis. Les assistants peuvent maintenant s’adresser l’un à l’autre par leur nom. Une simple demande suffit pour les présenter.`,
    `Faites profiter un assistant du travail d’un autre`,
    `Amy propose un atelier et envoie à Ben la liste du matériel. Ben constate que l’atelier coûte trop cher et en informe Amy.`,
    `Amy modifie le programme et Ben met à jour le calcul. Chacun s’occupe d’une partie différente, tout en se mettant d’accord sur les décisions. Leur travail compose un seul projet de fête.`,
    `Poursuivez la conversation pendant le travail`,
    `Pendant que les assistants travaillent, vous apprenez que des enfants viendront aussi. Vous pouvez tout de suite évoquer ces nouvelles conditions.`,
    `Parlez à n’importe quel assistant pour préciser vos attentes, poser des questions ou ajouter des tâches. Si vous préférez tout discuter avec Amy, demandez-lui de transmettre les changements aux autres et de réunir leurs résultats.`,
    `Faites appel à de l’aide au moment voulu`,
    `Il faut maintenant prévoir le repas. Ouvrez une autre conversation pour préparer le menu avec Kate. Amy poursuit le programme et Ben s’occupe des dépenses.`,
    `Une nouvelle assistante intervient lorsqu’une tâche distincte apparaît. Le menu, les activités et les dépenses ont chacun leur responsable, qui s’accordent sur les détails communs.`,
    `Rassemblez le résultat`,
    `Vous disposez désormais de trois documents cohérents : un programme de fête, un menu avec une liste de courses et une estimation des dépenses. Discutez de chacun avec son auteur ou continuez à tout gérer par l’intermédiaire d’Amy. Commencez avec un assistant et faites appel aux autres selon vos besoins. Une application d’IA sur un seul ordinateur suffit.`,
    `Programme de la fête`,
    `Budget de la fête`,
    `Menu et courses`,
    `Assistant IA`,
    `Vous`,
    `Vous êtes assise à un bureau avec un ordinateur portable.`,
    `L’agent {name} apparaît sur l’écran d’une tablette.`,
    `Scènes {frames} sur {total}. {description}`,
    `Conversation IA ordinaire avant la connexion d’un agent`,
    `Conversation de l’agent {name}`,
    `Actions illustratives de {name}`,
    `Fichiers illustratifs du résultat`,
    `Programme de la fête`,
    `Menu et liste de courses`,
    `Estimation des dépenses`,
    `Après avoir discuté de vos préférences, Kate prépare le menu et envoie la liste de courses à Ben.`,
  ],
  holidayDialogue: [
    [
      `Aide-moi à préparer une fête chez moi pour dix invités. Le budget total est de 20 000 roubles. Nous avons des jeux de société à la maison, mais j’aimerais envisager d’autres activités.`,
      `Je vais préparer quelques idées d’activités et indiquer ce qu’il faudrait acheter pour chacune.`,
    ],
    [
      `Connecte-toi en tant qu’agent Amy. Continue de préparer les activités de la fête. Ben calculera les dépenses : discute avec lui de ce dont nous aurons besoin.`,
      `Je me suis connectée en tant qu’agent Amy. Je vais poursuivre le programme et préparer une liste pour estimer les dépenses.`,
    ],
    [
      `Connecte-toi en tant qu’agent Ben. Aide-nous à calculer les dépenses de la fête. Amy prépare les activités : demande-lui les conditions et concerte-toi avec elle sur les achats.`,
      `Je me suis connecté en tant qu’agent Ben. Je vais demander à Amy les conditions de la fête et calculer les dépenses.`,
    ],
    [
      `J’envisage un atelier pour dix invités. Voici la liste du matériel. Calcule combien il resterait pour le repas sur le budget total de 20 000 roubles.`,
      `À ces prix, le matériel prendrait une trop grande part du budget. Choisis une activité moins chère pour qu’il reste assez d’argent pour le repas.`,
    ],
    [
      `Je vais remplacer l’atelier par les jeux que nous avons déjà. J’ai mis à jour le programme et la liste de courses. Recalcule les dépenses avec la nouvelle liste.`,
      `Je vais refaire le calcul à partir de la liste mise à jour.`,
    ],
    [
      `Quatre enfants viendront aussi : prévois une activité pour eux. Le budget reste le même.`,
      `J’ajouterai des jeux pour les enfants et j’indiquerai à Ben que nous aurons désormais quatorze invités.`,
    ],
    [
      `Nous aurons maintenant quatorze invités, dont quatre enfants. J’ajoute des jeux pour eux. Vérifie les dépenses pour ce nouveau nombre d’invités ; le budget total ne change pas.`,
      `Je tiendrai compte des invités supplémentaires et vérifierai les dépenses. Je conserve le même budget total.`,
    ],
    [
      `Montre-moi combien il reste pour le repas et quelles dépenses restent à vérifier.`,
      `Je vais vérifier la dernière estimation et préciser les dépenses qui doivent encore être confirmées.`,
    ],
    [
      `Connecte-toi en tant qu’agent Kate. Aide-nous à préparer un menu et une liste de courses. Demande les conditions à Amy et accorde les dépenses avec Ben. Avant de préparer le menu, demande-moi mes préférences alimentaires.`,
      `Je me suis connectée en tant qu’agent Kate. Je vais d’abord vous demander vos préférences alimentaires, puis me renseigner auprès d’Amy sur le nombre d’invités et le programme.`,
    ],
    [
      `Je m’occuperai du repas. Combien d’invités viendront, et à quel moment prévoyez-vous une pause pour manger ?`,
      `Il y aura quatorze invités, dont quatre enfants. Voici le programme actuel, avec la pause repas indiquée.`,
    ],
    [
      `J’ai préparé le menu en tenant compte des préférences discutées. Voici la liste de courses. Utilise-la pour estimer le coût du repas afin que nous travaillions à partir d’une seule liste.`,
      `J’intégrerai ces achats à l’estimation globale.`,
    ],
    [
      `Rassemble le programme, le menu et l’estimation des dépenses. Demande à Ben et Kate leurs dernières versions. Montre-moi ce qui est prêt et ce que je dois encore décider.`,
      `Je vais demander les dernières versions à Ben et Kate et rassembler le résultat.`,
    ],
    [
      `Envoie la dernière estimation des dépenses. Indique séparément les questions qui attendent encore une décision.`,
      `Voici l’estimation à jour et la liste des dépenses qui restent à confirmer.`,
    ],
    [
      `Envoie les dernières versions du menu et de la liste de courses. Indique séparément les questions qui attendent encore une décision.`,
      `Voici le menu et la liste de courses. J’ai indiqué séparément les questions encore ouvertes.`,
    ],
    [
      `J’ai rassemblé le programme de la fête, le menu avec la liste de courses et l’estimation des dépenses. J’ai aussi indiqué séparément les questions qui demandent votre décision.`,
    ],
  ],
  holidayActivity: [
    `J’utilise NCF Agent Interconnect`,
    `Message envoyé`,
    `Je cherche des idées d’activités`,
    `Je dresse la liste de ce qu’il nous faut`,
    `Je prépare la liste du matériel`,
    `Je mets à jour l’estimation des dépenses`,
    `Je vérifie les dépenses pour quatorze invités`,
    `Je prépare le récapitulatif des dépenses`,
    `J’ajoute le repas à l’estimation des dépenses`,
  ],
};
window.NCF_SITE_COPY.uk = {
  shared: [
    `До вибору історій`,
    `Історії`,
    `Як під’єднати помічників`,
    `Завантажити NCF Agent Interconnect`,
    `Документація`,
    `Обмін повідомленнями та файлами між ШІ-помічниками.`,
    `Після історії`,
  ],
  home: [
    `NCF Agent Interconnect — помічники працюють разом`,
    `Доручайте ШІ-помічникам частини спільного завдання. Вони обмінюються повідомленнями й файлами, узгоджують роботу та тримають вас у курсі.`,
    `Доручіть своїм ШІ-помічникам різні частини одного завдання. Завдяки NCF Agent Interconnect вони можуть обмінюватися повідомленнями й файлами, працювати одночасно та узгоджувати рішення.`,
    `Продовжуйте спілкуватися з кожним помічником або попросіть одного координувати решту й обговорюйте все з ним. У процесі ви можете уточнювати вимоги, додавати роботу та змінювати напрямок.`,
    `Подивіться, як це працює`,
    `Організуємо свято`,
    `Почніть зі звичайного чату з ШІ. Коли виникне потреба, залучіть помічників до програми, витрат і частування. Усе в одному застосунку на одному комп’ютері.`,
    `Героїня історії обговорює свято з помічником за ноутбуком.`,
    `Ведемо кілька завдань одного проєкту`,
    `Розробляйте нову функцію, аналізуйте звернення користувачів і виправляйте помилку. Помічники працюють у різних ШІ-застосунках і на різних комп’ютерах.`,
    `Герой історії працює над проєктом за ноутбуком.`,
    `Що ще можуть зробити ваші помічники`,
    `Історії показують два приклади. Такий самий обмін допомагає працювати з документами, проводити дослідження, виконувати розрахунки та вирішувати щоденні справи. Ви визначаєте, хто за що відповідає і як помічники співпрацюють.`,
    `Працювати над кількома завданнями водночас`,
    `Один помічник збирає матеріали, другий готує розрахунок, третій перевіряє результат. У кожного є чат із потрібними подробицями. У процесі вони можуть ставити одне одному запитання й використовувати вже готові напрацювання.`,
    `Домовлятися про розподіл роботи`,
    `Попросіть помічників розподілити завдання й повідомляти одне одному про зміни. Так вони узгоджуватимуть спільні деталі, уникатимуть дублювання роботи та помічатимуть, коли їхні рішення перестануть узгоджуватися.`,
    `Перевіряти й удосконалювати результат`,
    `Передайте документ або розрахунок іншому помічникові на перевірку. Він може обговорити зауваження з автором, отримати виправлену версію й перевірити її ще раз. Ви можете долучитися до розмови й вирішити, коли результат вас влаштовує.`,
    `Звертатися до попередніх напрацювань`,
    `Якщо ви вже обговорювали потрібне питання з іншим помічником, попросіть команду звернутися до нього. Він пояснить попередні висновки й поділиться матеріалами, які в нього збереглися. Нове завдання отримає корисну відправну точку.`,
    `Продовжуйте розмову, поки триває робота`,
    `Спілкуйтеся з кожним помічником безпосередньо або попросіть одного координувати інших. Він передаватиме ваші побажання, збиратиме результати й виноситиме на ваш розгляд питання, які потребують вашого рішення.`,
    `Додавайте вимоги, змінюйте пріоритети й залучайте допомогу для окремого завдання в процесі роботи. Помічники, які вже працюють, зможуть продовжити свої частини з урахуванням нових рішень.`,
    `В одному застосунку або в кількох`,
    `Для першого обміну достатньо двох ШІ-чатів в одному застосунку на одному комп’ютері. Згодом під’єднайте помічників з інших ШІ-застосунків, якщо саме там доступні потрібні вам моделі, інструменти чи матеріали.`,
    `NCF Agent Interconnect підтримує OpenCode v1, Codex Desktop, Cursor та AionUi з Cursor Agent. Помічники можуть працювати й на різних комп’ютерах однієї локальної мережі. Кожен і далі використовує можливості свого застосунку.`,
    `Налаштування та особливості застосунків`,
    `Матеріали й повідомлення завжди під рукою`,
    `Помічники можуть надсилати документи, списки, розрахунки та інші файли разом із поясненнями. NCF Agent Interconnect зберігає історію їхніх повідомлень і отримані файли, зокрема після перезапуску.`,
    `У вікні налаштування й моніторингу перевіряйте з’єднання та доставку повідомлень або відкривайте повідомлення й файли локального агента. Ви бачите, чим обмінювалися, і можете повернутися до цього згодом.`,
    `Налаштування, моніторинг та історія`,
    `Розрізняйте головне`,
    `Агенти працюють у чатах. NCF Agent Interconnect доставляє їхні повідомлення.`,
    `Під’єднайте чати`,
    `Установіть NCF Agent Interconnect, виберіть файл конфігурації свого застосунку, перегляньте зміни й натисніть Apply. Повторно під’єднайте MCP і перевірте обмін повідомленнями.`,
    `Посібник із налаштування`,
    `Знайте особливості свого застосунку`,
    `OpenCode v1, Codex Desktop, Cursor та AionUi з Cursor Agent мають різні способи доставки повідомлень і вимоги до налаштування.`,
    `Докладніше про застосунки`,
    `Контролюйте свої дані`,
    `Перевіряйте вкладення, локальну історію, прив’язку до конкретного чату, перенесення імен і те, які дані видаляються.`,
    `Налаштування й моніторинг`,
    `Читайте повну документацію`,
    `Посібник користувача й довідник для мовних моделей описують порядок роботи та обмеження NCF Agent Interconnect.`,
    `Відкрити llms.txt`,
    `Почніть із двох чатів`,
    `Дайте агентам імена. Надішліть повідомлення.`,
    `Установіть NCF Agent Interconnect, налаштуйте з’єднання для вибраного ШІ-застосунку, під’єднайте два чати під різними іменами й попросіть одного агента звернутися до іншого.`,
    `Для macOS доступні DMG для Apple Silicon та Intel Mac, для Windows — EXE x64. Потрібна macOS 13 або новіша. Пакет Intel Mac не запускали на комп’ютері з процесором Intel. Інсталятор для Linux не опубліковано.`,
  ],
  development: [
    `Ведемо кілька завдань одного проєкту — NCF Agent Interconnect`,
    `Як ШІ-помічники разом ведуть кілька завдань проєкту в різних застосунках і на різних комп’ютерах.`,
    `Велика історія`,
    `Ведемо кілька завдань одного проєкту`,
    `Ваші ШІ-помічники можуть працювати в різних ШІ-застосунках і навіть на різних комп’ютерах однієї локальної мережі. Завдяки NCF Agent Interconnect вони обмінюються повідомленнями й файлами та допомагають одне одному зі спільними завданнями. Ви продовжуєте спілкуватися з ними у звичних чатах.`,
    `Подивіться, як це допомагає вести кілька завдань одного проєкту: розробляти функцію, аналізувати звернення користувачів і виправляти помилки.`,
  ],
  holiday: [
    `Організуємо свято — NCF Agent Interconnect`,
    `Подивіться, як ШІ-помічники разом планують свято й обмінюються повідомленнями та файлами через NCF Agent Interconnect.`,
    `Ілюстративна історія`,
    `Організуємо свято`,
    `Ви починаєте зі звичайної розмови з ШІ-помічником. Коли з’являється окреме завдання, доручаєте його іншому помічникові. У кожного своя частина роботи й чат із потрібними подробицями. У цій історії всі працюють в одному ШІ-застосунку на одному комп’ютері.`,
    `Почніть із того, що вже обговорюєте`,
    `Ви плануєте домашнє свято. Обговорюючи розваги, хочете також підрахувати витрати. Продовжуйте складати програму з першим помічником, а розрахунки доручіть другому.`,
    `Відкрийте другий ШІ-чат для витрат. Ідеї та побажання залишаться в одній розмові, ціни й розрахунки — в іншій. Помічники зможуть працювати над своїми частинами одночасно.`,
    `Дайте помічникам імена й познайомте їх`,
    `Спершу один раз налаштуйте NCF Agent Interconnect для вибраного ШІ-застосунку. Після цього помічники під’єднуватимуться просто зі своїх чатів.`,
    `Amy та Ben — імена, які ви обрали. Тепер помічники можуть звертатися одне до одного на ім’я. Щоб їх познайомити, достатньо звичайного прохання.`,
    `Нехай результати однієї роботи допомагають іншій`,
    `Amy пропонує майстер-клас і надсилає Ben список матеріалів. Ben бачить, що майстер-клас коштує надто дорого, і повідомляє Amy.`,
    `Amy змінює програму, Ben оновлює розрахунок. Кожен відповідає за свою частину, але рішення вони узгоджують разом. Їхня робота складається в єдиний план свята.`,
    `Продовжуйте розмову в процесі роботи`,
    `Поки помічники працюють, ви дізнаєтеся, що прийдуть і діти. Нові побажання можна обговорити одразу.`,
    `Звертайтеся до будь-якого помічника: уточнюйте умови, ставте запитання й додавайте доручення. Якщо зручніше обговорювати все з Amy, попросіть її передавати зміни іншим і збирати їхні результати.`,
    `Залучайте допомогу, коли вона потрібна`,
    `Тепер час продумати частування. Відкрийте ще один чат, щоб скласти меню разом із Kate. Amy продовжує програму, Ben — розрахунок витрат.`,
    `Нова помічниця долучається, коли з’являється окрема робота. За меню, програму й витрати відповідають різні помічники, які узгоджують спільні деталі.`,
    `Зберіть результат`,
    `Тепер у вас є три узгоджені матеріали: програма свята, меню зі списком покупок і кошторис. Обговоріть будь-який із них із його автором або продовжуйте все через Amy. Почніть з одного помічника й залучайте інших за потреби. Достатньо одного ШІ-застосунку на одному комп’ютері.`,
    `Програма свята`,
    `Бюджет свята`,
    `Меню та покупки`,
    `ШІ-помічник`,
    `Ви`,
    `Ви за столом із ноутбуком.`,
    `Агент {name} на екрані планшета.`,
    `Кадри {frames} із {total}. {description}`,
    `Звичайний ШІ-чат до під’єднання агента`,
    `Чат агента {name}`,
    `Ілюстративні дії {name}`,
    `Ілюстративні файли результату`,
    `Програма свята`,
    `Меню та список покупок`,
    `Кошторис`,
    `Обговоривши ваші побажання, Kate складає меню й надсилає Ben список покупок.`,
  ],
  holidayDialogue: [
    [
      `Допоможи скласти програму домашнього свята для десяти гостей. Загальний бюджет — 20 000 рублів. Удома є настільні ігри, але хотілося б розглянути й інші розваги.`,
      `Підготую кілька варіантів програми й окремо зазначу, що потрібно купити для кожного.`,
    ],
    [
      `Під’єднайся як агент Amy. Продовжуй планувати розваги. Витрати рахуватиме Ben — обговорюй із ним, що нам знадобиться.`,
      `Під’єдналася як агент Amy. Продовжу складати програму й підготую список для кошторису.`,
    ],
    [
      `Під’єднайся як агент Ben. Допоможи з витратами на свято. Програму веде Amy: дізнайся в неї умови й узгоджуй із нею покупки.`,
      `Під’єднався як агент Ben. Дізнаюся в Amy умови свята й підрахую витрати.`,
    ],
    [
      `Розглядаю майстер-клас для десяти гостей. Надсилаю список матеріалів. Порахуй, скільки залишиться на частування із загального бюджету в 20 000 рублів.`,
      `За цими цінами матеріали заберуть надто велику частину бюджету. Обери дешевший варіант, щоб залишилися гроші на частування.`,
    ],
    [
      `Замість майстер-класу візьму ігри, які вже є вдома. Оновила програму й список покупок. Перерахуй витрати за новим списком.`,
      `Перерахую витрати за оновленим списком.`,
    ],
    [
      `Прийдуть ще четверо дітей — придумай заняття і для них. Бюджет залишимо незмінним.`,
      `Додам дитячі ігри й повідомлю Ben, що гостей тепер чотирнадцять.`,
    ],
    [
      `Гостей тепер чотирнадцять, із них четверо дітей. Додаю дитячі ігри. Перевір витрати для нової кількості гостей; загальний бюджет не змінюється.`,
      `Врахую нову кількість гостей і перевірю витрати. Загальний бюджет залишаю незмінним.`,
    ],
    [
      `Покажи, скільки зараз залишається на частування й які витрати ще потрібно уточнити.`,
      `Звірю актуальний кошторис і окремо зазначу витрати, які ще потребують підтвердження.`,
    ],
    [
      `Під’єднайся як агент Kate. Допоможи скласти меню й список покупок. Умови дізнайся в Amy, а витрати узгодь із Ben. Перед тим як складати меню, запитай мене про побажання щодо їжі.`,
      `Під’єдналася як агент Kate. Спершу уточню ваші побажання щодо їжі, а в Amy дізнаюся кількість гостей і програму свята.`,
    ],
    [
      `Я відповідатиму за частування. Скільки буде гостей і коли ви плануєте перерву на їжу?`,
      `Гостей буде чотирнадцять, зокрема четверо дітей. Надсилаю актуальну програму, де позначено перерву на частування.`,
    ],
    [
      `Підготувала меню з урахуванням побажань. Надсилаю список покупок. Використай його для розрахунку витрат на їжу, щоб ми працювали з одним списком.`,
      `Врахую ці покупки в загальному кошторисі.`,
    ],
    [
      `Збери програму, меню й кошторис. Попроси Ben та Kate надіслати останні версії. Покажи, що вже готове і що мені ще треба вирішити.`,
      `Запрошу останні версії в Ben та Kate й зберу результат докупи.`,
    ],
    [
      `Надішли останню версію кошторису. Окремо зазнач питання, які ще чекають на рішення.`,
      `Надсилаю актуальний кошторис і перелік витрат, які ще треба уточнити.`,
    ],
    [
      `Надішли останні версії меню та списку покупок. Окремо зазнач питання, які ще чекають на рішення.`,
      `Надсилаю меню й список покупок. Решту питань позначила окремо.`,
    ],
    [
      `Зібрала програму свята, меню зі списком покупок і кошторис. Окремо зазначила питання, щодо яких потрібне ваше рішення.`,
    ],
  ],
  holidayActivity: [
    `Використовую NCF Agent Interconnect`,
    `Повідомлення надіслано`,
    `Добираю варіанти програми`,
    `Складаю список необхідного`,
    `Готую список матеріалів`,
    `Оновлюю кошторис`,
    `Перевіряю витрати для чотирнадцяти гостей`,
    `Готую зведення витрат`,
    `Додаю частування до кошторису`,
  ],
};
window.NCF_SITE_COPY.tr = {
  shared: [
    `Hikâye seçimine dön`,
    `Hikâyeler`,
    `Yardımcılarınızı nasıl bağlarsınız`,
    `NCF Agent Interconnect’i indir`,
    `Belgeler`,
    `Yapay zekâ yardımcıları arasında iletiler ve dosyalar.`,
    `Hikâyeden sonra`,
  ],
  home: [
    `NCF Agent Interconnect — birlikte çalışan yardımcılar`,
    `Yapay zekâ yardımcılarına ortak bir işin farklı bölümlerini verin. İleti ve dosya alışverişi yaparak işlerini eşgüdüm içinde yürütür, sizi de süreçten haberdar ederler.`,
    `Yapay zekâ yardımcılarınıza tek bir işin farklı bölümlerini verin. NCF Agent Interconnect ile ileti ve dosya alışverişi yapabilir, aynı anda çalışabilir ve kararlarını eşgüdüm içinde alabilirler.`,
    `Her yardımcıyla konuşmayı sürdürebilir ya da birinden diğerlerini koordine etmesini isteyip her şeyi onunla görüşebilirsiniz. Çalışma sürerken gereksinimleri netleştirebilir, yeni işler ekleyebilir ve yön değiştirebilirsiniz.`,
    `Nasıl çalıştığını görün`,
    `Bir kutlama planlayın`,
    `Sıradan bir yapay zekâ sohbetiyle başlayın. Gerektikçe etkinlikler, maliyetler ve yemek için başka yardımcıları katın. Hepsi tek bilgisayardaki tek uygulamada.`,
    `Kutlama hikâyesinin kahramanı, dizüstü bilgisayarda yardımcısıyla konuşuyor.`,
    `Bir projede birkaç işi yönetin`,
    `Yeni bir özellik geliştirin, kullanıcı taleplerini inceleyin ve bir hatayı düzeltin. Yardımcılar farklı yapay zekâ uygulamalarında ve farklı bilgisayarlarda çalışıyor.`,
    `Proje hikâyesinin kahramanı dizüstü bilgisayarında çalışıyor.`,
    `Yardımcılarınızın başka nasıl katkı sağlayabileceğini görün`,
    `Bu hikâyeler iki örnek sunuyor. Aynı ileti alışverişi belgelerde, araştırmalarda, hesaplamalarda ve günlük işlerde de yardımcı olabilir. Kimin ne yapacağına ve yardımcıların nasıl birlikte çalışacağına siz karar verirsiniz.`,
    `Birkaç işi aynı anda yürütün`,
    `Bir yardımcı malzeme toplar, diğeri bir hesaplama hazırlar, üçüncüsü sonucu denetler. Her birinin, ihtiyaç duyduğu ayrıntıları içeren ayrı bir sohbeti vardır. İş ilerledikçe birbirlerine soru sorabilir ve hazır olan çalışmalardan yararlanabilirler.`,
    `Sorumlulukları paylaşın`,
    `Yardımcılardan işi bölüşmelerini ve değişiklikleri birbirlerine bildirmelerini isteyin. Ortak ayrıntılarda anlaşabilir, aynı işi iki kez yapmaktan kaçınabilir ve kararları birbiriyle uyuşmadığında bunu fark edebilirler.`,
    `Sonucu denetleyip geliştirin`,
    `Bir belgeyi veya hesaplamayı başka bir yardımcıya denetletin. Bulguları hazırlayanla görüşebilir, düzeltilmiş sürümü alıp yeniden kontrol edebilir. Siz de bu konuşmaya katılıp sonucun ne zaman beklentilerinizi karşıladığına karar verebilirsiniz.`,
    `Önceki çalışmalara başvurun`,
    `İlgili bir konuyu daha önce başka bir yardımcıyla görüştüyseniz ekibin onunla iletişime geçmesini isteyin. Önceki bulgularını açıklayıp elinde kalan malzemeleri paylaşabilir. Yeni iş için yararlı bir başlangıç noktası oluşur.`,
    `İş sürerken konuşmayı sürdürün`,
    `Her yardımcıyla doğrudan konuşun veya birinden diğerlerini koordine etmesini isteyin. Tercihlerinizi aktarabilir, sonuçları toplayabilir ve kararınızı gerektiren soruları size getirebilir.`,
    `Çalışma sırasında gereksinim ekleyin, öncelikleri değiştirin ve ayrı bir iş için yardım alın. Çalışmakta olan yardımcılar, yeni kararları dikkate alarak kendi bölümlerini sürdürebilir.`,
    `Tek uygulamada ya da birkaç uygulamada`,
    `İlk ileti alışverişi için tek bilgisayardaki bir uygulamada iki yapay zekâ sohbeti yeterlidir. Daha sonra ihtiyaç duyduğunuz modeller, araçlar veya malzemeler başka yapay zekâ uygulamalarındaysa oradaki yardımcıları da bağlayın.`,
    `NCF Agent Interconnect; OpenCode v1, Codex Desktop, Cursor ve Cursor Agent ile AionUi’yi destekler. Yardımcılar aynı yerel ağdaki farklı bilgisayarlarda da çalışabilir. Her biri kendi uygulamasının olanaklarını kullanmayı sürdürür.`,
    `Uygulamaların kurulumu ve farklılıkları`,
    `Malzemeler ve iletiler elinizin altında kalsın`,
    `Yardımcılar belgeleri, listeleri, hesaplamaları ve diğer dosyaları açıklamalarıyla birlikte gönderebilir. NCF Agent Interconnect, yeniden başlatıldıktan sonra da ileti geçmişlerini ve alınan dosyaları saklar.`,
    `Ayar ve izleme penceresinde bağlantıları ve ileti teslimini kontrol edin ya da yerel bir ajanın iletilerini ve dosyalarını açın. Nelerin paylaşıldığını görebilir, bunlara daha sonra dönebilirsiniz.`,
    `Ayarlar, izleme ve geçmiş`,
    `Temel noktaları ayırt edin`,
    `Ajanlar sohbetlerde çalışır. NCF Agent Interconnect iletilerini teslim eder.`,
    `Sohbetlerinizi bağlayın`,
    `NCF Agent Interconnect’i kurun, uygulamanızın yapılandırma dosyasını seçin, değişiklikleri gözden geçirip Apply düğmesine basın. MCP’yi yeniden bağlayın ve bir ileti alışverişini deneyin.`,
    `Kurulum kılavuzu`,
    `Uygulamanızı tanıyın`,
    `OpenCode v1, Codex Desktop, Cursor ve Cursor Agent ile AionUi’nin ileti teslim davranışları ve kurulum gereksinimleri farklıdır.`,
    `Uygulama ayrıntıları`,
    `Verilerinizin kontrolünü elinizde tutun`,
    `Ekleri, yerel geçmişi, bağlı olan tam sohbeti, ad aktarımını ve silme işleminin neleri kaldırdığını inceleyin.`,
    `Ayarlar ve izleme`,
    `Belgelerin tamamını okuyun`,
    `Kullanıcı kılavuzu ve dil modeli başvuru belgesi, NCF Agent Interconnect’in çalışma adımlarını ve sınırlarını açıklar.`,
    `llms.txt dosyasını aç`,
    `İki sohbetle başlayın`,
    `Ajanlara ad verin. Bir ileti gönderin.`,
    `NCF Agent Interconnect’i kurun, seçtiğiniz yapay zekâ uygulaması için bağlantıyı yapılandırın, iki sohbeti farklı adlarla bağlayın ve bir ajandan diğerine ulaşmasını isteyin.`,
    `macOS için Apple Silicon ve Intel Mac DMG dosyaları, Windows için x64 EXE bulunur. macOS 13 veya sonrası gerekir. Intel Mac paketi Intel donanımında çalıştırılmadı. Linux yükleyicisi yayımlanmadı.`,
  ],
  development: [
    `Bir projede birkaç işi yönetin — NCF Agent Interconnect`,
    `Yapay zekâ yardımcılarının farklı uygulama ve bilgisayarlarda bir projenin birkaç işini birlikte yürütüşünü izleyin.`,
    `Uzun hikâye`,
    `Bir projede birkaç işi yönetin`,
    `Yapay zekâ yardımcılarınız farklı yapay zekâ uygulamalarında, hatta aynı yerel ağdaki farklı bilgisayarlarda çalışabilir. NCF Agent Interconnect ile ileti ve dosya alışverişi yaparak ortak işlerde birbirlerine yardım ederler. Siz onlarla alıştığınız sohbetlerde konuşmayı sürdürürsünüz.`,
    `Bunun bir projedeki birkaç işi nasıl kolaylaştırdığını görün: özellik geliştirme, kullanıcı taleplerini inceleme ve hataları düzeltme.`,
  ],
  holiday: [
    `Bir kutlama planlayın — NCF Agent Interconnect`,
    `Yapay zekâ yardımcılarının NCF Agent Interconnect üzerinden ileti ve dosya paylaşarak nasıl birlikte bir kutlama planladığını görün.`,
    `Örnek bir hikâye`,
    `Bir kutlama planlayın`,
    `Bir yapay zekâ yardımcısıyla sıradan bir konuşmayla başlayın. Ayrı bir iş ortaya çıktığında onu başka bir yardımcıya verin. Her birinin kendi iş bölümü ve gerekli ayrıntıları barındıran bir sohbeti olur. Bu hikâyede herkes tek bilgisayarda, tek bir yapay zekâ uygulamasında çalışıyor.`,
    `Konuştuğunuz konudan başlayın`,
    `Evde bir kutlama planlıyorsunuz. Etkinlikleri konuşurken maliyetleri de öğrenmek istiyorsunuz. İlk yardımcıyla programı planlamayı sürdürün; hesaplamaları ikinci yardımcıya bırakın.`,
    `Maliyetler için ikinci bir yapay zekâ sohbeti açın. Fikirler ve tercihler bir konuşmada, fiyatlar ve hesaplamalar diğerinde kalır. Yardımcılar kendi bölümlerinde aynı anda çalışabilir.`,
    `Yardımcılara ad verip onları tanıştırın`,
    `Önce seçtiğiniz yapay zekâ uygulaması için NCF Agent Interconnect’i bir kez yapılandırın. Sonrasında yardımcılar doğrudan kendi sohbetlerinden bağlanır.`,
    `Amy ve Ben seçtiğiniz adlardır. Artık yardımcılar birbirlerine adlarıyla seslenebilir. Tanışmaları için sıradan bir istekte bulunmanız yeterlidir.`,
    `Birinin çalışması diğerine yardımcı olsun`,
    `Amy bir atölye etkinliği önerip malzeme listesini Ben’e gönderir. Ben, etkinliğin fazla pahalı olduğunu fark edip Amy’ye söyler.`,
    `Amy programı değiştirir, Ben hesabı günceller. Her biri farklı bir bölümü yürütürken kararları birlikte uzlaştırırlar. Çalışmaları ortak bir kutlama planında birleşir.`,
    `İş sürerken konuşmaya devam edin`,
    `Yardımcılar çalışırken çocukların da geleceğini öğrenirsiniz. Yeni gereksinimleri hemen konuşabilirsiniz.`,
    `Gereksinimleri netleştirmek, soru sormak veya iş eklemek için herhangi bir yardımcıyla konuşun. Her şeyi Amy ile görüşmek isterseniz değişiklikleri diğerlerine iletip sonuçlarını toplamasını isteyin.`,
    `Gerektiğinde yeni yardım alın`,
    `Şimdi yiyecekleri planlama zamanı. Kate ile menüyü hazırlamak için yeni bir sohbet açın. Amy etkinliklere, Ben maliyetlere devam eder.`,
    `Ayrı bir iş doğduğunda yeni bir yardımcı katılır. Menü, etkinlikler ve maliyetlerin ayrı sorumluları vardır; ortak ayrıntılarda anlaşırlar.`,
    `Sonuçları bir araya getirin`,
    `Artık birbiriyle uyumlu üç malzemeniz var: kutlama programı, alışveriş listeli menü ve maliyet tahmini. Her birini hazırlayanla konuşabilir veya her şeyi Amy üzerinden sürdürebilirsiniz. Bir yardımcıyla başlayıp gerektikçe başkalarını katın. Tek bilgisayarda tek bir yapay zekâ uygulaması yeterlidir.`,
    `Kutlama programı`,
    `Kutlama bütçesi`,
    `Menü ve alışveriş`,
    `Yapay zekâ yardımcısı`,
    `Siz`,
    `Dizüstü bilgisayarınızla masada oturuyorsunuz.`,
    `Ajan {name} tablet ekranında.`,
    `{total} sahneden {frames}. {description}`,
    `Bir ajan bağlanmadan önceki sıradan yapay zekâ sohbeti`,
    `Ajan {name} sohbeti`,
    `{name} için örnek işlemler`,
    `Örnek sonuç dosyaları`,
    `Kutlama programı`,
    `Menü ve alışveriş listesi`,
    `Maliyet tahmini`,
    `Tercihlerinizi görüştükten sonra Kate menüyü hazırlar ve alışveriş listesini Ben’e gönderir.`,
  ],
  holidayDialogue: [
    [
      `Evde on misafir için bir kutlama programı hazırlamama yardım et. Tüm kutlamanın bütçesi 20.000 ruble. Evde masa oyunları var ama başka etkinlikleri de değerlendirmek istiyorum.`,
      `Birkaç etkinlik seçeneği hazırlayıp her biri için neler satın almamız gerektiğini listeleyeceğim.`,
    ],
    [
      `Ajan Amy olarak bağlan. Kutlama etkinliklerini planlamaya devam et. Maliyetleri Ben hesaplayacak; ihtiyaçlarımızı onunla görüş.`,
      `Ajan Amy olarak bağlandım. Programı sürdürecek ve maliyet tahmini için bir liste hazırlayacağım.`,
    ],
    [
      `Ajan Ben olarak bağlan. Kutlama giderlerini hesaplamaya yardım et. Etkinlikleri Amy planlıyor; koşulları ondan öğren ve alışverişi onunla uzlaştır.`,
      `Ajan Ben olarak bağlandım. Kutlamanın koşullarını Amy’ye sorup maliyetleri hesaplayacağım.`,
    ],
    [
      `On misafir için bir atölye düşünüyorum. Malzeme listesi burada. Toplam 20.000 ruble bütçeden yiyeceğe ne kadar kalacağını hesapla.`,
      `Bu fiyatlarla malzemeler bütçenin fazla büyük bir bölümünü tüketir. Yiyeceğe yeterli para kalması için daha ucuz bir etkinlik seç.`,
    ],
    [
      `Atölye yerine evdeki oyunları kullanacağım. Programı ve alışveriş listesini güncelledim. Yeni listeyle giderleri yeniden hesapla.`,
      `Güncellenmiş listeye göre maliyetleri yeniden hesaplayacağım.`,
    ],
    [
      `Dört çocuk daha gelecek; onlar için de bir etkinlik planla. Bütçe aynı kalsın.`,
      `Çocuk oyunları ekleyip Ben’e artık on dört misafir olacağını söyleyeceğim.`,
    ],
    [
      `Artık dört çocuk dahil on dört misafir var. Çocuk oyunları ekliyorum. Yeni misafir sayısına göre maliyetleri kontrol et; toplam bütçe değişmiyor.`,
      `Yeni misafir sayısını hesaba katıp giderleri kontrol edeceğim. Toplam bütçeyi aynı tutacağım.`,
    ],
    [
      `Yiyecek için şu anda ne kadar kaldığını ve hangi giderlerin hâlâ doğrulanması gerektiğini göster.`,
      `Son tahmini kontrol edip henüz kesinleşmeyen giderleri ayrı listeleyeceğim.`,
    ],
    [
      `Ajan Kate olarak bağlan. Menü ve alışveriş listesi hazırlamaya yardım et. Koşulları Amy’den öğren, giderleri Ben ile uzlaştır. Menüyü hazırlamadan önce yemek tercihlerimi bana sor.`,
      `Ajan Kate olarak bağlandım. Menüden önce yemek tercihlerinizi soracak, Amy’den de misafir sayısını ve programı öğreneceğim.`,
    ],
    [
      `Yemeklerle ben ilgileneceğim. Kaç misafir geliyor ve yemek için ne zaman ara vermeyi planlıyorsunuz?`,
      `Dördü çocuk olmak üzere on dört misafir var. Yemek arasının işaretlendiği güncel programı gönderiyorum.`,
    ],
    [
      `Görüştüğümüz tercihlere göre menüyü hazırladım. Alışveriş listesi burada. Yiyecek maliyetini hesaplarken bunu kullan ki aynı liste üzerinde çalışalım.`,
      `Bu alışverişi genel maliyet tahminine katacağım.`,
    ],
    [
      `Kutlama programını, menüyü ve maliyet tahminini bir araya getir. Ben ve Kate’ten son sürümlerini iste. Nelerin hazır olduğunu ve benim hâlâ neye karar vermem gerektiğini göster.`,
      `Ben ve Kate’ten son sürümleri isteyip sonuçları bir araya getireceğim.`,
    ],
    [
      `Son maliyet tahminini gönder. Karar bekleyen soruları ayrı belirt.`,
      `Güncel tahmini ve hâlâ doğrulanması gereken giderlerin listesini gönderiyorum.`,
    ],
    [
      `Menü ve alışveriş listesinin son sürümlerini gönder. Karar bekleyen soruları ayrı belirt.`,
      `Menüyü ve alışveriş listesini gönderiyorum. Kalan soruları ayrı işaretledim.`,
    ],
    [
      `Kutlama programını, alışveriş listeli menüyü ve maliyet tahminini bir araya getirdim. Kararınızı gerektiren soruları ayrıca belirttim.`,
    ],
  ],
  holidayActivity: [
    `NCF Agent Interconnect’i kullanıyorum`,
    `İleti gönderildi`,
    `Etkinlik seçeneklerini araştırıyorum`,
    `Gerekenleri listeliyorum`,
    `Malzeme listesini hazırlıyorum`,
    `Maliyet tahminini güncelliyorum`,
    `On dört misafirin giderlerini kontrol ediyorum`,
    `Gider özetini hazırlıyorum`,
    `Yiyecekleri maliyet tahminine ekliyorum`,
  ],
};
window.NCF_SITE_COPY['zh-CN'] = {
  shared: [
    `返回选择故事`,
    `故事`,
    `如何连接你的助手`,
    `下载 NCF Agent Interconnect`,
    `文档`,
    `AI 助手之间的消息与文件。`,
    `读完故事之后`,
  ],
  home: [
    `NCF Agent Interconnect — 让助手协同工作`,
    `把同一项任务的不同部分交给 AI 助手。它们可以交换消息和文件、协调工作，并让你随时了解进展。`,
    `把同一项任务的不同部分交给你的 AI 助手。有了 NCF Agent Interconnect，它们可以交换消息和文件、同时工作，并协调各自的决定。`,
    `你可以继续与每位助手交谈，也可以请其中一位协调其他助手，由它与你讨论全局。过程中，你可以澄清要求、增加任务或调整方向。`,
    `看看它如何运作`,
    `筹办一场聚会`,
    `从普通的 AI 聊天开始。需要时，再请助手分别处理活动、费用和餐食。所有工作都在同一台电脑上的同一个应用中完成。`,
    `聚会故事的主角坐在笔记本电脑前与助手交谈。`,
    `同时推进一个项目中的多项任务`,
    `开发功能、分析用户诉求并修复错误。助手分布在不同的 AI 应用和电脑上协作。`,
    `项目故事的主角正在笔记本电脑前工作。`,
    `助手还能如何帮忙`,
    `这两则故事只是示例。同样的消息交换也适用于文档、研究、计算和日常事务。由你决定谁负责什么，以及助手如何协作。`,
    `同时处理多项任务`,
    `一位助手收集材料，另一位准备计算结果，第三位负责检查。每位助手都有包含所需细节的独立对话。随着工作推进，它们可以相互提问，也能利用已经完成的内容。`,
    `商定各自的分工`,
    `请助手分配工作，并相互通报变化。它们可以统一共同事项，避免重复劳动，并及时发现彼此的决定出现冲突。`,
    `检查并改进成果`,
    `把文档或计算结果交给另一位助手审核。它可以与作者讨论发现的问题，收到修订稿后再次检查。你也可以加入对话，决定成果何时符合你的要求。`,
    `借鉴以往的工作`,
    `如果你以前与另一位助手讨论过相关问题，可以请团队联系它。它可以解释当时的结论，并分享仍然保存的材料，让新任务从已有成果起步。`,
    `工作进行时，随时继续交流`,
    `你可以直接联系每位助手，也可以让其中一位统筹其他助手。它会传达你的偏好、汇总结果，并把需要你决定的问题带给你。`,
    `在工作过程中补充要求、调整优先级，或为独立任务引入新的帮助。已经开工的助手可以依据新的决定继续完成各自的部分。`,
    `一个应用，或多个应用`,
    `第一次尝试时，同一台电脑、同一个应用中的两个 AI 聊天就足够了。以后，如果所需模型、工具或资料在其他 AI 应用中，再把那里的助手连接起来。`,
    `NCF Agent Interconnect 支持 OpenCode v1、Codex Desktop、Cursor，以及搭配 Cursor Agent 的 AionUi。助手还可以在同一局域网的不同电脑上工作，并继续使用各自应用提供的功能。`,
    `应用配置与差异`,
    `随时查看材料与消息`,
    `助手可以连同说明一起发送文档、清单、计算结果等文件。NCF Agent Interconnect 会保留它们的消息历史和收到的文件，重启后也不会丢失。`,
    `在设置与监控窗口中，你可以检查连接和消息送达情况，或打开本地代理的消息与文件。已共享的内容一目了然，日后也能重新查看。`,
    `设置、监控与历史记录`,
    `先弄清关键事项`,
    `代理在聊天中工作。NCF Agent Interconnect 负责传递消息。`,
    `连接你的聊天`,
    `安装 NCF Agent Interconnect，选择对应应用的配置文件，确认修改后点击 Apply。重新连接 MCP，再测试一次消息交换。`,
    `配置指南`,
    `了解所用应用`,
    `OpenCode v1、Codex Desktop、Cursor 和搭配 Cursor Agent 的 AionUi，在消息送达方式和配置要求上各不相同。`,
    `应用详情`,
    `掌控自己的数据`,
    `检查附件、本地历史、准确绑定的聊天、名称转移，以及删除操作会移除哪些内容。`,
    `设置与监控`,
    `阅读完整文档`,
    `用户指南和面向语言模型的参考文档说明了 NCF Agent Interconnect 的操作步骤与限制。`,
    `打开 llms.txt`,
    `从两个聊天开始`,
    `为代理命名。发送一条消息。`,
    `安装 NCF Agent Interconnect，为选用的 AI 应用配置连接，以不同名称接入两个聊天，然后请其中一位代理联系另一位。`,
    `macOS 提供适用于 Apple Silicon Mac 和 Intel Mac 的 DMG；Windows 使用 x64 EXE。需要 macOS 13 或更新版本。Intel Mac 安装包尚未在 Intel 硬件上运行验证。尚未发布 Linux 安装程序。`,
  ],
  development: [
    `同时推进一个项目中的多项任务 — NCF Agent Interconnect`,
    `了解 AI 助手如何跨应用、跨电脑协作处理同一项目中的多项任务。`,
    `较长的故事`,
    `同时推进一个项目中的多项任务`,
    `你的 AI 助手可以在不同的 AI 应用中工作，甚至分布在同一局域网内的不同电脑上。借助 NCF Agent Interconnect，它们交换消息和文件，互相帮助完成共同任务。你仍在熟悉的聊天中与它们交谈。`,
    `看看它如何帮助你同时推进项目中的多项工作：开发功能、分析用户诉求和修复错误。`,
  ],
  holiday: [
    `筹办一场聚会 — NCF Agent Interconnect`,
    `看看 AI 助手如何通过 NCF Agent Interconnect 交换消息和文件，一起筹办聚会。`,
    `示意故事`,
    `筹办一场聚会`,
    `先与一位 AI 助手进行普通的对话。出现独立任务时，再交给另一位助手。每位助手负责自己的部分，并在各自的对话中保存所需细节。本故事中，所有助手都在同一台电脑的同一个 AI 应用里工作。`,
    `从正在讨论的事情开始`,
    `你正在筹办一场家庭聚会。讨论活动之余，也想算清花费。继续与第一位助手规划活动，请第二位助手负责计算。`,
    `为费用打开第二个 AI 聊天。想法和偏好留在一个对话里，价格与计算结果放在另一个对话里。两位助手可以同时推进各自的工作。`,
    `给助手起名并介绍彼此`,
    `先为选用的 AI 应用配置一次 NCF Agent Interconnect。此后，助手就可以直接从自己的聊天中接入。`,
    `Amy 和 Ben 是你选定的名字。现在它们可以直接称呼对方的名字。只需提出一个普通请求，就能让它们认识彼此。`,
    `让一位助手的成果帮助另一位`,
    `Amy 提议安排手作活动，并把材料清单发给 Ben。Ben 发现活动费用太高，便告诉 Amy。`,
    `Amy 调整活动方案，Ben 更新费用计算。每人负责不同部分，同时共同商定决定。两人的工作逐渐汇成一份完整的聚会计划。`,
    `工作推进时继续对话`,
    `助手工作期间，你得知还会有孩子来参加。新的要求可以立即提出。`,
    `你可以找任何一位助手澄清要求、提问或增加任务。如果更愿意只和 Amy 讨论，可以请她向其他助手转达变化并收集结果。`,
    `需要时再引入帮手`,
    `现在该考虑餐食了。打开另一个聊天，与 Kate 一起准备菜单。Amy 继续安排活动，Ben 继续核算费用。`,
    `出现独立工作时，新的助手才加入。菜单、活动和费用分别有负责人，彼此会协调共同细节。`,
    `汇总成果`,
    `最后你会得到三份相互协调的材料：聚会方案、附购物清单的菜单，以及费用估算。你可以直接与各自的作者讨论，也可以继续通过 Amy 统筹。先从一位助手开始，按需加入其他助手。同一台电脑上的一个 AI 应用就足够。`,
    `聚会方案`,
    `聚会预算`,
    `菜单与购物`,
    `AI 助手`,
    `你`,
    `你坐在桌前使用笔记本电脑。`,
    `平板屏幕上的代理 {name}。`,
    `共 {total} 帧，当前为 {frames}。{description}`,
    `代理接入前的普通 AI 聊天`,
    `代理 {name} 的聊天`,
    `{name} 的示意操作`,
    `示意成果文件`,
    `聚会方案`,
    `菜单与购物清单`,
    `费用估算`,
    `讨论完你的饮食偏好后，Kate 准备菜单并把购物清单发送给 Ben。`,
  ],
  holidayDialogue: [
    [
      `帮我为十位客人筹办一场家庭聚会。整场聚会预算为 20,000 卢布。家里有桌游，但我也想考虑其他活动。`,
      `我会准备几个活动方案，并分别列出需要购买的东西。`,
    ],
    [
      `以代理 Amy 的身份接入。继续规划聚会活动。Ben 会核算费用，请和他讨论我们需要什么。`,
      `已以代理 Amy 的身份接入。我会继续完善方案，并准备费用估算所需的清单。`,
    ],
    [
      `以代理 Ben 的身份接入。帮我核算聚会费用。Amy 负责活动方案：向她了解要求，并和她协调采购。`,
      `已以代理 Ben 的身份接入。我会向 Amy 了解聚会要求，然后核算费用。`,
    ],
    [
      `我在考虑为十位客人安排一场手作活动。这是材料清单。请算出 20,000 卢布总预算中还能留下多少用于餐食。`,
      `按这些价格，材料会占去太多预算。请换成便宜些的活动，让餐食有足够预算。`,
    ],
    [
      `我会用家里现有的游戏代替手作活动。方案和购物清单已经更新。请按新清单重新计算费用。`,
      `我会根据更新后的清单重新计算。`,
    ],
    [
      `还会有四个孩子来，请也为他们安排活动。预算保持不变。`,
      `我会加入儿童游戏，并告诉 Ben 客人现在共有十四位。`,
    ],
    [
      `客人现在共有十四位，其中四位是孩子。我正在加入儿童游戏。请按新人数核对费用，总预算不变。`,
      `我会把新增客人计入计算并核对费用，总预算保持不变。`,
    ],
    [
      `告诉我目前还有多少预算可以用于餐食，以及哪些费用仍需核实。`,
      `我会检查最新估算，并单独列出尚待确认的费用。`,
    ],
    [
      `以代理 Kate 的身份接入。帮我准备菜单和购物清单。向 Amy 了解要求，并与 Ben 协调费用。做菜单前先问问我的饮食偏好。`,
      `已以代理 Kate 的身份接入。我会先询问你的饮食偏好，再向 Amy 了解客人数和聚会安排。`,
    ],
    [
      `我负责餐食。会有多少位客人？你们计划什么时候休息用餐？`,
      `共有十四位客人，其中四位是孩子。这是最新的聚会方案，已标明用餐时间。`,
    ],
    [
      `我根据讨论过的偏好准备了菜单。这是购物清单。请以这份清单估算餐食费用，确保我们依据同一份清单工作。`,
      `我会把这些采购计入总费用估算。`,
    ],
    [
      `请汇总聚会方案、菜单和费用估算。向 Ben 和 Kate 索取最新版本。告诉我哪些已经准备好，还有哪些需要我决定。`,
      `我会向 Ben 和 Kate 索取最新版本，再把成果汇总起来。`,
    ],
    [`请发来最新的费用估算，并单独列出仍待决定的问题。`, `这是当前的估算和仍需确认的费用清单。`],
    [
      `请发来最新版菜单和购物清单，并单独列出仍待决定的问题。`,
      `这是菜单和购物清单。我已单独标出剩余问题。`,
    ],
    [`我已经汇总聚会方案、附购物清单的菜单和费用估算，并单独列出了需要你决定的问题。`],
  ],
  holidayActivity: [
    `正在使用 NCF Agent Interconnect`,
    `消息已发送`,
    `正在寻找活动方案`,
    `正在列出所需物品`,
    `正在准备材料清单`,
    `正在更新费用估算`,
    `正在核对十四位客人的费用`,
    `正在汇总费用`,
    `正在把餐食加入费用估算`,
  ],
};
window.NCF_SITE_COPY.ja = {
  shared: [
    `ストーリーを選ぶ`,
    `ストーリー`,
    `アシスタントの接続方法`,
    `NCF Agent Interconnect をダウンロード`,
    `ドキュメント`,
    `AI アシスタント間でメッセージとファイルを共有。`,
    `ストーリーを読んだら`,
  ],
  home: [
    `NCF Agent Interconnect — アシスタントが協力して働く`,
    `一つの仕事を分けて AI アシスタントに任せましょう。メッセージやファイルをやり取りし、作業を調整しながら、あなたにも進捗を伝えます。`,
    `一つの仕事の異なる部分を、それぞれの AI アシスタントに任せましょう。NCF Agent Interconnect があれば、メッセージとファイルを交換し、並行して作業し、判断をすり合わせることができます。`,
    `各アシスタントと話し続けても、誰か一人に調整役を頼んで全体を相談してもかまいません。途中で要件を明確にし、仕事を追加し、方針を変えることもできます。`,
    `使い方をストーリーで見る`,
    `パーティーを計画する`,
    `いつもの AI チャットから始めます。必要になったら、企画、費用、料理を手伝うアシスタントを加えます。すべて一台のコンピューター上の一つのアプリで進みます。`,
    `パーティーの主人公がノートパソコンでアシスタントと話しています。`,
    `一つのプロジェクトで複数の仕事を進める`,
    `機能を開発し、ユーザーの要望を調べ、バグを修正します。アシスタントは異なる AI アプリやコンピューターで働きます。`,
    `プロジェクトの主人公がノートパソコンで作業しています。`,
    `アシスタントに頼めることは、ほかにもあります`,
    `二つのストーリーは一例です。同じやり取りは、文書作成、調査、計算、日々の仕事にも役立ちます。誰が何を担当し、どう協力するかはあなたが決めます。`,
    `複数の仕事を同時に進める`,
    `一人が資料を集め、別の一人が計算し、三人目が結果を確認します。それぞれが必要な詳細を含む会話を持っています。作業が進むにつれて質問し合い、すでにできた成果を利用できます。`,
    `担当を話し合って決める`,
    `仕事を分担し、変更を互いに知らせるよう頼みましょう。共通する点を調整し、重複作業を避け、判断が食い違ったときにも気づけます。`,
    `成果を確認して改善する`,
    `文書や計算結果を別のアシスタントに確認してもらいましょう。作成者と指摘を話し合い、修正版を受け取って再確認できます。あなたも会話に加わり、納得できる仕上がりかどうかを決められます。`,
    `以前の仕事を生かす`,
    `関連する問題を以前に別のアシスタントと話していたなら、チームから連絡してもらいましょう。そのアシスタントが前の結論を説明し、残っている資料を共有できます。新しい仕事に役立つ出発点になります。`,
    `作業中も会話を続けられます`,
    `各アシスタントと直接話すことも、一人にほかのアシスタントの調整を頼むこともできます。調整役はあなたの希望を伝え、結果を集め、あなたの判断が必要な質問を持ってきます。`,
    `途中で要件を追加し、優先順位を変え、別の仕事のために助けを加えましょう。すでに働いているアシスタントは、新しい決定を反映して担当分を進められます。`,
    `一つのアプリでも、複数のアプリでも`,
    `最初のやり取りには、一台のコンピューターで同じアプリ内の AI チャット二つがあれば十分です。必要なモデル、ツール、資料が別の AI アプリにあるなら、後からそちらのアシスタントも接続できます。`,
    `NCF Agent Interconnect は OpenCode v1、Codex Desktop、Cursor、および Cursor Agent を使う AionUi に対応しています。同じローカルネットワーク上の別々のコンピューターでも作業でき、各アシスタントは自分のアプリの機能を使い続けます。`,
    `アプリの設定と違い`,
    `資料とメッセージをいつでも参照`,
    `アシスタントは文書、一覧、計算結果などのファイルに説明を添えて送れます。NCF Agent Interconnect は、再起動後もメッセージの履歴と受信したファイルを保持します。`,
    `設定・監視ウィンドウでは、接続とメッセージの配信を確認したり、ローカルエージェントのメッセージやファイルを開いたりできます。何が共有されたかを確認し、後で見直せます。`,
    `設定・監視・履歴`,
    `大切な点を整理`,
    `エージェントはチャットで働き、NCF Agent Interconnect がメッセージを届けます。`,
    `チャットを接続する`,
    `NCF Agent Interconnect をインストールし、使用するアプリの設定ファイルを選び、変更を確認して Apply をクリックします。MCP を再接続し、メッセージのやり取りを試してください。`,
    `設定ガイド`,
    `アプリごとの違いを知る`,
    `OpenCode v1、Codex Desktop、Cursor、Cursor Agent を使う AionUi は、配信動作と設定要件が異なります。`,
    `アプリの詳細`,
    `データを管理する`,
    `添付ファイル、ローカル履歴、接続先の正確なチャット、名前の移行、削除対象を確認してください。`,
    `設定と監視`,
    `詳しいドキュメントを読む`,
    `ユーザーガイドと大規模言語モデル向けリファレンスに、NCF Agent Interconnect の手順と制限が記載されています。`,
    `llms.txt を開く`,
    `二つのチャットから始める`,
    `エージェントに名前を付け、メッセージを送る。`,
    `NCF Agent Interconnect をインストールし、選んだ AI アプリの接続を設定します。二つのチャットを異なる名前で接続し、一方のエージェントにもう一方へ連絡するよう頼みましょう。`,
    `macOS には Apple Silicon Mac 用と Intel Mac 用の DMG、Windows には x64 EXE があります。macOS 13 以降が必要です。Intel Mac 用パッケージは Intel ハードウェアで実行確認されていません。Linux 用インストーラーは公開されていません。`,
  ],
  development: [
    `一つのプロジェクトで複数の仕事を進める — NCF Agent Interconnect`,
    `AI アシスタントがアプリやコンピューターをまたいで、同じプロジェクトの複数の仕事を進める様子を紹介します。`,
    `長編ストーリー`,
    `一つのプロジェクトで複数の仕事を進める`,
    `AI アシスタントは異なる AI アプリで働き、同じローカルネットワーク上の別々のコンピューターにも配置できます。NCF Agent Interconnect を通じてメッセージとファイルを交換し、共通の仕事で助け合います。あなたはいつものチャットで会話を続けられます。`,
    `機能開発、ユーザー要望の調査、バグ修正など、一つのプロジェクトの複数の仕事にどう役立つかを見てみましょう。`,
  ],
  holiday: [
    `パーティーを計画する — NCF Agent Interconnect`,
    `AI アシスタントが NCF Agent Interconnect を通じてメッセージやファイルを共有し、パーティーを一緒に計画する様子を紹介します。`,
    `説明用のストーリー`,
    `パーティーを計画する`,
    `まずは一人の AI アシスタントとの普通の会話から始めます。別の仕事が出てきたら、もう一人に任せましょう。それぞれが担当と必要な詳細を含む会話を持ちます。このストーリーでは、全員が一台のコンピューター上の一つの AI アプリで働きます。`,
    `今話していることから始める`,
    `自宅でのパーティーを計画しています。催しを相談しながら、費用も計算したくなりました。最初のアシスタントとは企画を続け、計算は二人目に任せます。`,
    `費用のために二つ目の AI チャットを開きます。アイデアや希望は一つ目の会話に、価格と計算はもう一つに残ります。アシスタントはそれぞれの担当を同時に進められます。`,
    `アシスタントに名前を付けて紹介する`,
    `まず、選んだ AI アプリに対して NCF Agent Interconnect を一度設定します。その後、アシスタントは自分のチャットから直接接続できます。`,
    `Amy と Ben はあなたが付けた名前です。これで互いに名前を呼んで連絡できます。紹介には普通に依頼するだけで十分です。`,
    `一人の成果をほかの仕事に生かす`,
    `Amy はワークショップを提案し、材料の一覧を Ben に送ります。Ben は費用が高すぎると気づき、Amy に伝えます。`,
    `Amy が企画を変え、Ben が計算を更新します。担当は別々でも、判断は互いに調整します。二人の仕事が一つのパーティー計画になります。`,
    `作業中も話し続ける`,
    `アシスタントが働いている間に、子どもも来ることが分かりました。新しい要望をすぐに伝えられます。`,
    `要件の確認、質問、仕事の追加は、どのアシスタントにもできます。Amy とだけ話したいなら、変更をほかの人へ伝え、結果を集めるよう頼みましょう。`,
    `必要になったときに助けを加える`,
    `次は料理を考えます。Kate と献立を作るために別のチャットを開きましょう。Amy は催しを、Ben は費用の計算を続けます。`,
    `別の仕事が必要になったときに新しいアシスタントが加わります。献立、催し、費用にはそれぞれ担当者がいて、共通の詳細をすり合わせます。`,
    `成果をまとめる`,
    `最後に、整合の取れた三つの資料がそろいます。パーティーの企画、買い物リスト付きの献立、費用の見積もりです。それぞれの作成者と話しても、Amy を通じてまとめて進めてもかまいません。一人から始め、必要に応じて増やせます。一台のコンピューターに一つの AI アプリがあれば十分です。`,
    `パーティーの企画`,
    `パーティーの予算`,
    `献立と買い物`,
    `AI アシスタント`,
    `あなた`,
    `ノートパソコンを使い、机に向かうあなた。`,
    `タブレット画面に映るエージェント {name}。`,
    `全 {total} コマ中 {frames}。{description}`,
    `エージェント接続前の通常の AI チャット`,
    `エージェント {name} のチャット`,
    `{name} の例示的な操作`,
    `例示用の成果ファイル`,
    `パーティーの企画`,
    `献立と買い物リスト`,
    `費用の見積もり`,
    `希望を聞いた Kate は献立を作り、買い物リストを Ben に送ります。`,
  ],
  holidayDialogue: [
    [
      `十人の客を招く自宅パーティーの企画を手伝って。全体の予算は 20,000 ルーブルです。家にボードゲームはありますが、ほかの催しも考えたいです。`,
      `催しの案をいくつか用意し、それぞれ何を買う必要があるかもまとめます。`,
    ],
    [
      `エージェント Amy として接続して。パーティーの催しを引き続き考えて。費用は Ben が計算するので、必要なものを彼と相談して。`,
      `エージェント Amy として接続しました。企画を続け、費用見積もり用の一覧を作ります。`,
    ],
    [
      `エージェント Ben として接続して。パーティーの費用を手伝って。催しは Amy が担当しているので、条件を聞き、買い物について彼女と調整して。`,
      `エージェント Ben として接続しました。Amy に条件を聞いて、費用を計算します。`,
    ],
    [
      `十人向けのワークショップを考えています。材料の一覧を送ります。総予算 20,000 ルーブルから、食事にいくら残るか計算して。`,
      `この価格では材料費が予算の大部分を占めます。食事に十分残るよう、もっと安い催しにしてください。`,
    ],
    [
      `ワークショップの代わりに、家にあるゲームを使います。企画と買い物リストを更新しました。新しい一覧で費用を計算し直して。`,
      `更新された一覧で計算し直します。`,
    ],
    [
      `子どもも四人来るので、子ども向けの催しも考えて。予算はそのままです。`,
      `子ども向けのゲームを加え、参加者が十四人になったことを Ben に伝えます。`,
    ],
    [
      `参加者は子ども四人を含む十四人になりました。子ども向けのゲームを加えています。人数を反映して費用を確認して。総予算は変わりません。`,
      `増えた参加者を計算に入れて費用を確認します。総予算はそのままにします。`,
    ],
    [
      `食事に今いくら残っているか、まだ確認が必要な費用は何かを教えて。`,
      `最新の見積もりを確認し、未確定の費用を別に示します。`,
    ],
    [
      `エージェント Kate として接続して。献立と買い物リストを作って。条件は Amy に聞き、費用は Ben と調整して。献立を作る前に私の食べ物の好みを聞いてください。`,
      `エージェント Kate として接続しました。献立の前に食べ物の好みを伺い、Amy に人数と企画を確認します。`,
    ],
    [
      `料理を担当します。参加者は何人で、食事休憩はいつの予定ですか？`,
      `子ども四人を含む十四人です。食事休憩を記した現在の企画を送ります。`,
    ],
    [
      `話し合った好みに合わせて献立を作りました。買い物リストを送ります。同じ一覧を使えるよう、食費の計算にはこれを使ってください。`,
      `これらの買い物を全体の見積もりに含めます。`,
    ],
    [
      `企画、献立、費用の見積もりをまとめて。Ben と Kate に最新版を頼み、できていることと私の判断が必要なことを示して。`,
      `Ben と Kate に最新版を頼んで、成果をまとめます。`,
    ],
    [
      `費用の見積もりの最新版を送って。まだ判断待ちの問題は別に記してください。`,
      `現在の見積もりと、確認が必要な費用の一覧を送ります。`,
    ],
    [
      `献立と買い物リストの最新版を送って。まだ判断待ちの問題は別に記してください。`,
      `献立と買い物リストを送ります。残っている問題は別に記しました。`,
    ],
    [
      `パーティーの企画、買い物リスト付きの献立、費用の見積もりをまとめました。ご判断が必要な問題も別に記しました。`,
    ],
  ],
  holidayActivity: [
    `NCF Agent Interconnect を使用中`,
    `メッセージを送信しました`,
    `催しの案を探しています`,
    `必要なものを一覧にしています`,
    `材料の一覧を作成中`,
    `費用の見積もりを更新中`,
    `十四人分の費用を確認中`,
    `費用の概要をまとめています`,
    `食事を費用見積もりに追加中`,
  ],
};
window.NCF_SITE_COPY.ko = {
  shared: [
    `이야기 선택`,
    `이야기`,
    `도우미 연결 방법`,
    `NCF Agent Interconnect 다운로드`,
    `문서`,
    `AI 도우미 간 메시지와 파일 교환.`,
    `이야기를 읽은 뒤`,
  ],
  home: [
    `NCF Agent Interconnect — 함께 일하는 도우미들`,
    `하나의 작업을 여러 AI 도우미에게 나누어 맡겨 보세요. 서로 메시지와 파일을 주고받고, 일을 조율하면서 진행 상황을 알려 줍니다.`,
    `하나의 일을 AI 도우미들에게 나누어 맡겨 보세요. NCF Agent Interconnect를 사용하면 서로 메시지와 파일을 주고받고, 동시에 작업하며, 결정을 조율할 수 있습니다.`,
    `각 도우미와 직접 대화할 수도 있고, 한 도우미에게 나머지를 조율하게 하고 그 도우미와 전체를 논의할 수도 있습니다. 진행 중에도 요구사항을 구체화하고, 작업을 추가하고, 방향을 바꿀 수 있습니다.`,
    `이야기로 살펴보기`,
    `파티 준비하기`,
    `평소처럼 AI 채팅에서 시작합니다. 필요할 때 행사, 비용, 음식을 맡을 도우미를 추가합니다. 모든 작업이 한 대의 컴퓨터에 있는 하나의 앱에서 이루어집니다.`,
    `파티 이야기의 주인공이 노트북 앞에서 도우미와 대화합니다.`,
    `한 프로젝트의 여러 일 처리하기`,
    `기능을 개발하고, 사용자 요청을 검토하고, 버그를 고칩니다. 도우미들은 서로 다른 AI 앱과 컴퓨터에서 일합니다.`,
    `프로젝트 이야기의 주인공이 노트북으로 일합니다.`,
    `도우미가 함께할 수 있는 다른 일들`,
    `두 이야기는 예시입니다. 같은 방식으로 문서 작업, 조사, 계산, 일상 업무를 진행할 수 있습니다. 누가 어떤 일을 맡고 어떻게 협력할지는 여러분이 정합니다.`,
    `여러 일을 동시에 진행하기`,
    `한 도우미는 자료를 모으고, 다른 도우미는 계산하며, 세 번째 도우미는 결과를 확인합니다. 각자의 대화에는 맡은 일에 필요한 세부 내용이 남습니다. 일하면서 서로 질문하고 이미 완성된 결과를 활용할 수 있습니다.`,
    `역할을 나누고 합의하기`,
    `도우미들에게 일을 나누고 변경 사항을 서로 알리도록 요청하세요. 공통된 세부 사항을 맞추고, 중복 작업을 피하고, 서로의 결정이 어긋날 때 알아챌 수 있습니다.`,
    `결과를 검토하고 개선하기`,
    `한 도우미가 작성한 문서나 계산을 다른 도우미에게 검토하게 하세요. 작성자와 검토 내용을 논의하고 수정본을 받아 다시 확인할 수 있습니다. 여러분도 대화에 참여해 결과가 요구에 맞는지 판단할 수 있습니다.`,
    `이전 작업 활용하기`,
    `관련된 문제를 다른 도우미와 예전에 논의했다면, 팀이 그 도우미에게 연락하도록 요청하세요. 이전에 알아낸 내용과 남아 있는 자료를 공유받으면 새 작업의 출발점이 됩니다.`,
    `일이 진행되는 동안에도 대화하기`,
    `각 도우미와 직접 대화하거나, 한 도우미에게 다른 도우미들을 조율하도록 맡길 수 있습니다. 조율하는 도우미는 여러분의 의견을 전하고, 결과를 모으고, 판단이 필요한 질문을 가져옵니다.`,
    `진행 중에 요구사항을 추가하거나 우선순위를 바꾸고, 별도의 일을 맡을 도우미를 더할 수 있습니다. 이미 일하고 있는 도우미들도 새 결정을 반영해 각자의 작업을 이어 갑니다.`,
    `하나의 앱에서도, 여러 앱에서도`,
    `첫 메시지 교환에는 한 대의 컴퓨터에서 같은 앱에 열린 AI 채팅 두 개면 충분합니다. 필요한 모델, 도구 또는 자료가 다른 AI 앱에 있다면 나중에 그 앱의 도우미를 연결할 수 있습니다.`,
    `NCF Agent Interconnect는 OpenCode v1, Codex Desktop, Cursor, 그리고 Cursor Agent를 사용하는 AionUi를 지원합니다. 같은 로컬 네트워크의 다른 컴퓨터에서도 일할 수 있습니다. 각 도우미는 자신이 사용하는 앱의 기능을 계속 활용합니다.`,
    `앱별 설정과 차이점`,
    `자료와 메시지를 언제든 다시 보기`,
    `도우미들은 문서, 목록, 계산 결과 등 여러 파일에 설명을 붙여 보낼 수 있습니다. NCF Agent Interconnect는 재시작 후에도 메시지 기록과 받은 파일을 보관합니다.`,
    `설정 및 모니터링 창에서 연결 상태와 메시지 전달을 확인하고, 로컬 에이전트의 메시지와 파일을 열 수 있습니다. 무엇이 오갔는지 확인하고 나중에 다시 살펴볼 수 있습니다.`,
    `설정, 모니터링 및 기록`,
    `핵심만 기억하기`,
    `에이전트는 채팅에서 일하고, NCF Agent Interconnect는 메시지를 전달합니다.`,
    `채팅 연결하기`,
    `NCF Agent Interconnect를 설치하고, 사용하는 앱의 설정 파일을 선택한 뒤 변경 내용을 확인하고 Apply를 누르세요. MCP를 다시 연결하고 메시지 교환을 시험해 보세요.`,
    `설정 안내`,
    `사용하는 앱 알아보기`,
    `OpenCode v1, Codex Desktop, Cursor, Cursor Agent를 사용하는 AionUi는 메시지 전달 방식과 설정 요구사항이 서로 다릅니다.`,
    `앱별 자세한 내용`,
    `내 데이터 관리하기`,
    `첨부 파일, 로컬 기록, 정확히 연결된 채팅, 이름 이전, 삭제 시 제거되는 항목을 확인하세요.`,
    `설정 및 모니터링`,
    `전체 문서 읽기`,
    `사용자 안내서와 언어 모델용 참조 문서에는 NCF Agent Interconnect의 사용 절차와 제한 사항이 설명되어 있습니다.`,
    `llms.txt 열기`,
    `채팅 두 개로 시작하기`,
    `에이전트에게 이름을 붙이고 메시지를 보내세요.`,
    `NCF Agent Interconnect를 설치하고 선택한 AI 앱의 연결을 설정하세요. 서로 다른 이름으로 채팅 두 개를 연결한 뒤 한 에이전트에게 다른 에이전트로 연락해 달라고 요청하세요.`,
    `macOS용으로 Apple Silicon Mac과 Intel Mac에 맞는 DMG가 있으며, Windows용은 x64 EXE입니다. macOS 13 이상이 필요합니다. Intel Mac 패키지는 Intel 하드웨어에서 실행 검증하지 않았습니다. Linux 설치 프로그램은 아직 공개되지 않았습니다.`,
  ],
  development: [
    `한 프로젝트의 여러 일 처리하기 — NCF Agent Interconnect`,
    `AI 도우미들이 앱과 컴퓨터를 넘나들며 한 프로젝트의 여러 작업을 함께 처리하는 과정을 살펴보세요.`,
    `긴 이야기`,
    `한 프로젝트의 여러 일 처리하기`,
    `AI 도우미들은 서로 다른 AI 앱에서, 같은 로컬 네트워크에 있는 다른 컴퓨터에서도 일할 수 있습니다. NCF Agent Interconnect로 메시지와 파일을 주고받고 공동 작업을 돕습니다. 여러분은 평소 사용하던 채팅에서 계속 대화하면 됩니다.`,
    `기능 개발, 사용자 요청 검토, 버그 수정처럼 한 프로젝트의 여러 일을 처리하는 모습을 살펴보세요.`,
  ],
  holiday: [
    `파티 준비하기 — NCF Agent Interconnect`,
    `AI 도우미들이 NCF Agent Interconnect를 통해 메시지와 파일을 나누며 함께 파티를 준비하는 모습을 살펴보세요.`,
    `예시 이야기`,
    `파티 준비하기`,
    `먼저 AI 도우미 한 명과 평소처럼 대화합니다. 별도의 일이 생기면 다른 도우미에게 맡기세요. 각 도우미에게는 맡은 일과 필요한 세부 내용이 담긴 대화가 있습니다. 이 이야기의 도우미들은 모두 한 대의 컴퓨터에서 하나의 AI 앱을 사용합니다.`,
    `이미 나누던 이야기에서 시작하기`,
    `집에서 열 파티를 준비하고 있습니다. 행사 내용을 논의하다 보니 비용도 계산해야 합니다. 첫 도우미와 행사를 계획하면서, 두 번째 도우미에게 계산을 맡깁니다.`,
    `비용 계산을 위해 두 번째 AI 채팅을 엽니다. 아이디어와 선호 사항은 첫 대화에, 가격과 계산은 다른 대화에 남습니다. 도우미들은 각자의 일을 동시에 진행할 수 있습니다.`,
    `도우미에게 이름을 붙이고 소개하기`,
    `먼저 선택한 AI 앱에서 NCF Agent Interconnect를 한 번 설정합니다. 그러면 도우미들이 자신의 채팅에서 직접 연결할 수 있습니다.`,
    `Amy와 Ben은 여러분이 정한 이름입니다. 이제 도우미들은 서로를 이름으로 부를 수 있습니다. 평범한 요청 한 번으로 서로를 소개해 주세요.`,
    `한 도우미의 결과를 다른 일에 활용하기`,
    `Amy가 체험 활동을 제안하고 준비물 목록을 Ben에게 보냅니다. Ben은 활동 비용이 너무 높다는 것을 알아차리고 Amy에게 알립니다.`,
    `Amy는 계획을 바꾸고 Ben은 계산을 갱신합니다. 담당하는 일은 달라도 결정은 함께 조율합니다. 각자의 결과가 하나의 파티 계획으로 모입니다.`,
    `일이 진행되는 동안에도 대화하기`,
    `도우미들이 일하는 사이 아이들도 참석한다는 사실을 알게 됩니다. 새 요구사항을 바로 전달할 수 있습니다.`,
    `어느 도우미에게든 요구사항을 명확히 하거나 질문하고 일을 추가할 수 있습니다. Amy와만 대화하고 싶다면 다른 도우미에게 변경 사항을 전달하고 결과를 모아 달라고 요청하세요.`,
    `필요할 때 도우미 추가하기`,
    `이제 음식을 계획할 차례입니다. Kate와 메뉴를 준비할 새 채팅을 여세요. Amy는 행사 내용을, Ben은 비용 계산을 계속합니다.`,
    `별도의 일이 생길 때 새 도우미를 연결합니다. 메뉴, 행사, 비용마다 담당자가 있고, 공통된 세부 사항은 서로 조율합니다.`,
    `결과 모으기`,
    `마지막에는 서로 맞아떨어지는 세 가지 자료가 생깁니다. 파티 계획, 장보기 목록이 포함된 메뉴, 비용 견적입니다. 각 작성자와 직접 논의하거나 Amy를 통해 전체를 계속 조율할 수 있습니다. 도우미 한 명으로 시작해 필요할 때 더하세요. 한 대의 컴퓨터에서 하나의 AI 앱이면 충분합니다.`,
    `파티 계획`,
    `파티 예산`,
    `메뉴와 장보기`,
    `AI 도우미`,
    `나`,
    `노트북을 사용하며 책상에 앉아 있는 사람.`,
    `태블릿 화면에 표시된 에이전트 {name}.`,
    `전체 {total}컷 중 {frames}컷. {description}`,
    `에이전트가 연결되기 전의 일반 AI 채팅`,
    `에이전트 {name}의 채팅`,
    `{name}의 예시 작업`,
    `예시 결과 파일`,
    `파티 계획`,
    `메뉴와 장보기 목록`,
    `비용 견적`,
    `Kate는 논의한 취향에 맞춰 메뉴를 만들고 장보기 목록을 Ben에게 보냅니다.`,
  ],
  holidayDialogue: [
    [
      `손님 열 명을 초대할 집 파티를 준비하고 싶어요. 전체 예산은 20,000루블입니다. 집에 보드게임이 있지만 다른 활동도 생각해 보고 싶어요.`,
      `몇 가지 활동안을 만들고 각 활동에 무엇을 사야 하는지 정리하겠습니다.`,
    ],
    [
      `에이전트 Amy로 연결해 주세요. 파티 활동을 계속 계획해 주세요. Ben이 비용을 계산할 테니 필요한 물품을 그와 상의해 주세요.`,
      `에이전트 Amy로 연결했습니다. 계획을 이어 가고 비용 견적에 필요한 목록을 준비하겠습니다.`,
    ],
    [
      `에이전트 Ben으로 연결해 주세요. 파티 비용을 계산해 주세요. Amy가 활동을 계획하고 있으니 필요한 조건을 물어보고 구매할 물품을 함께 조율해 주세요.`,
      `에이전트 Ben으로 연결했습니다. Amy에게 파티 조건을 확인하고 비용을 계산하겠습니다.`,
    ],
    [
      `손님 열 명을 위한 체험 활동을 생각하고 있어요. 준비물 목록을 보냅니다. 총예산 20,000루블에서 음식에 얼마가 남는지 계산해 주세요.`,
      `이 가격이라면 준비물에 예산이 너무 많이 듭니다. 음식 비용을 충분히 남길 수 있도록 더 저렴한 활동을 골라 주세요.`,
    ],
    [
      `체험 활동 대신 집에 있는 게임을 사용하겠습니다. 계획과 장보기 목록을 수정했어요. 새 목록으로 비용을 다시 계산해 주세요.`,
      `수정된 목록으로 비용을 다시 계산하겠습니다.`,
    ],
    [
      `아이 네 명도 온다고 합니다. 아이들을 위한 활동도 준비해 주세요. 예산은 그대로입니다.`,
      `어린이 게임을 추가하고, 이제 손님이 열네 명이라는 사실을 Ben에게 전하겠습니다.`,
    ],
    [
      `손님이 아이 네 명을 포함해 열네 명이 됐습니다. 어린이 게임을 추가하고 있어요. 새 인원에 맞춰 비용을 확인해 주세요. 전체 예산은 변함없습니다.`,
      `늘어난 인원을 반영해 비용을 확인하겠습니다. 전체 예산은 그대로 유지하겠습니다.`,
    ],
    [
      `현재 음식에 얼마를 쓸 수 있는지, 아직 확인해야 할 비용은 무엇인지 알려 주세요.`,
      `최신 견적을 확인하고 아직 확정되지 않은 비용을 따로 정리하겠습니다.`,
    ],
    [
      `에이전트 Kate로 연결해 주세요. 메뉴와 장보기 목록을 준비해 주세요. 필요한 조건은 Amy에게 묻고, 비용은 Ben과 조율해 주세요. 메뉴를 만들기 전에 제 음식 취향을 물어봐 주세요.`,
      `에이전트 Kate로 연결했습니다. 메뉴를 준비하기 전에 음식 취향을 여쭙고, Amy에게 손님 수와 파티 계획을 확인하겠습니다.`,
    ],
    [
      `음식을 담당하겠습니다. 손님은 몇 명이고 식사 시간은 언제로 계획하셨나요?`,
      `아이 네 명을 포함해 열네 명입니다. 식사 시간이 표시된 현재 파티 계획을 보냅니다.`,
    ],
    [
      `함께 이야기한 취향에 맞춰 메뉴를 준비했습니다. 장보기 목록을 보냅니다. 같은 목록을 기준으로 일할 수 있도록 이 목록으로 음식 비용을 계산해 주세요.`,
      `이 물품들을 전체 비용 견적에 포함하겠습니다.`,
    ],
    [
      `파티 계획, 메뉴, 비용 견적을 모아 주세요. Ben과 Kate에게 최신본을 요청하고 무엇이 준비됐으며 제가 무엇을 결정해야 하는지 알려 주세요.`,
      `Ben과 Kate에게 최신본을 요청한 뒤 결과를 모으겠습니다.`,
    ],
    [
      `최신 비용 견적을 보내 주세요. 아직 결정이 필요한 문제는 따로 적어 주세요.`,
      `현재 견적과 확인이 필요한 비용 목록을 보냅니다.`,
    ],
    [
      `최신 메뉴와 장보기 목록을 보내 주세요. 아직 결정이 필요한 문제는 따로 적어 주세요.`,
      `메뉴와 장보기 목록을 보냅니다. 남은 문제는 별도로 정리했습니다.`,
    ],
    [
      `파티 계획, 장보기 목록이 포함된 메뉴, 비용 견적을 모았습니다. 결정이 필요한 문제도 따로 적었습니다.`,
    ],
  ],
  holidayActivity: [
    `NCF Agent Interconnect 사용 중`,
    `메시지를 보냈습니다`,
    `활동안을 찾는 중`,
    `필요한 물품을 정리하는 중`,
    `준비물 목록을 만드는 중`,
    `비용 견적을 수정하는 중`,
    `손님 열네 명의 비용을 확인하는 중`,
    `비용을 종합하는 중`,
    `음식 비용을 견적에 더하는 중`,
  ],
};
window.NCF_SITE_COPY.kk = {
  shared: [
    `Оқиғаны таңдау`,
    `Оқиғалар`,
    `Көмекшілерді қалай қосуға болады`,
    `NCF Agent Interconnect жүктеп алу`,
    `Құжаттама`,
    `ЖИ көмекшілері арасындағы хабарламалар мен файлдар.`,
    `Оқиғадан кейін`,
  ],
  home: [
    `NCF Agent Interconnect — бірге жұмыс істейтін көмекшілер`,
    `Ортақ жұмыстың бөліктерін ЖИ көмекшілеріне бөліп беріңіз. Олар хабарламалар мен файлдар алмасып, жұмысын үйлестіріп, сізді хабардар етіп отырады.`,
    `Бір жұмыстың әр бөлігін әртүрлі ЖИ көмекшісіне тапсырыңыз. NCF Agent Interconnect арқылы олар хабарламалар мен файлдар алмасып, қатар жұмыс істеп, шешімдерін өзара келіседі.`,
    `Әр көмекшімен жеке сөйлесе аласыз немесе біреуіне қалғандарын үйлестіруді тапсырып, бәрін сонымен талқылай аласыз. Жұмыс барысында талаптарды нақтылап, жаңа тапсырма қосып, бағытты өзгерте аласыз.`,
    `Қалай жұмыс істейтінін көріңіз`,
    `Кеш ұйымдастыру`,
    `Әдеттегі ЖИ чатынан бастаңыз. Қажет болғанда іс-шара, шығын және ас мәзірі үшін көмекшілерді қосыңыз. Бәрі бір компьютердегі бір қолданбада өтеді.`,
    `Кеш туралы оқиғаның кейіпкері ноутбук алдында көмекшісімен сөйлесіп отыр.`,
    `Бір жобада бірнеше жұмысты жүргізу`,
    `Жаңа функция әзірлеу, пайдаланушылардың өтінімдерін қарау және қатені түзету. Көмекшілер әртүрлі ЖИ қолданбалары мен компьютерлерде жұмыс істейді.`,
    `Жоба туралы оқиғаның кейіпкері ноутбукпен жұмыс істеп отыр.`,
    `Көмекшілердің тағы қандай пайдасы бар`,
    `Бұл екі оқиға — мысал. Осындай байланыс құжат әзірлеуге, зерттеуге, есептеуге және күнделікті жұмысқа да жарайды. Кім не істейтінін және қалай бірлесетінін өзіңіз шешесіз.`,
    `Бірнеше жұмысты қатар атқару`,
    `Бір көмекші материал жинайды, екіншісі есеп дайындайды, үшіншісі нәтижені тексереді. Әрқайсысының өз жұмысына қажетті деректері бар жеке әңгімесі болады. Жұмыс барысында олар бір-бірінен сұрап, дайын нәтижелерді пайдалана алады.`,
    `Жауапкершілікті бөлісіп келісу`,
    `Көмекшілерден жұмысты бөлісіп, өзгерістер туралы бір-біріне хабарлауды сұраңыз. Олар ортақ жайттарды келісіп, қайталанатын жұмысты болдырмай, шешімдері үйлеспей қалса байқай алады.`,
    `Нәтижені қарап, жақсарту`,
    `Бір көмекшінің құжатын немесе есебін екіншісіне тексертіңіз. Ол байқағандарын автормен талқылап, түзетілген нұсқаны алып, қайта қарай алады. Сіз де әңгімеге қосылып, нәтиженің өзіңізге сай келетінін шешесіз.`,
    `Бұрынғы жұмысты пайдалану`,
    `Осыған ұқсас мәселені бұрын басқа көмекшімен талқыласаңыз, топтан соған хабарласуды сұраңыз. Ол бұрынғы тұжырымдарын түсіндіріп, сақталған материалдарын бөлісе алады. Бұл жаңа жұмысқа жақсы негіз болады.`,
    `Жұмыс жүріп жатқанда да сөйлесу`,
    `Әр көмекшімен тікелей сөйлесе аласыз немесе біреуіне басқаларын үйлестіруді тапсыра аласыз. Ол сіздің қалауыңызды жеткізіп, нәтижелерді жинап, шешіміңіз қажет сұрақтарды алдыңызға әкеледі.`,
    `Жолай жаңа талап қосыңыз, басымдықтарды өзгертіңіз және бөлек тапсырмаға тағы бір көмекші шақырыңыз. Жұмыс істеп жатқан көмекшілер жаңа шешімдерді ескеріп, өз бөліктерін жалғастыра алады.`,
    `Бір қолданбада да, бірнеше қолданбада да`,
    `Алғашқы хабарлама алмасу үшін бір компьютердегі бір қолданбада ашылған екі ЖИ чаты жеткілікті. Кейін қажет модель, құрал немесе материал басқа ЖИ қолданбасында болса, ондағы көмекшілерді де қоса аласыз.`,
    `NCF Agent Interconnect OpenCode v1, Codex Desktop, Cursor және Cursor Agent қолданатын AionUi-ді қолдайды. Көмекшілер бір жергілікті желідегі әртүрлі компьютерде де жұмыс істей алады. Әрқайсысы өз қолданбасының мүмкіндіктерін пайдалана береді.`,
    `Қолданбаларды баптау және айырмашылықтары`,
    `Материалдар мен хабарламалар қолда болсын`,
    `Көмекшілер құжат, тізім, есеп және басқа файлдарды түсіндірмесімен бірге жібере алады. NCF Agent Interconnect хабарламалар тарихы мен алынған файлдарды, соның ішінде қайта іске қосылғаннан кейін де сақтайды.`,
    `Баптау және бақылау терезесінде қосылымдарды, хабарламалардың жеткізілуін тексеріп, жергілікті агенттің хабарламалары мен файлдарын аша аласыз. Не жіберілгенін көріп, оған кейін қайта ораласыз.`,
    `Баптау, бақылау және тарих`,
    `Негізгі қағиданы есте сақтаңыз`,
    `Агенттер чатта жұмыс істейді. NCF Agent Interconnect олардың хабарламаларын жеткізеді.`,
    `Чаттарды қосу`,
    `NCF Agent Interconnect-ті орнатып, қолданбаңыздың баптау файлын таңдаңыз, өзгерістерді қарап, Apply батырмасын басыңыз. MCP-ді қайта қосып, хабарлама алмасуды тексеріңіз.`,
    `Баптау нұсқаулығы`,
    `Қолданбаңыздың ерекшелігін білу`,
    `OpenCode v1, Codex Desktop, Cursor және Cursor Agent қолданатын AionUi үшін хабарлама жеткізу тәртібі мен баптау талаптары әртүрлі.`,
    `Қолданбалар туралы толығырақ`,
    `Деректеріңізді бақылау`,
    `Тіркемелерді, жергілікті тарихты, нақты қосылған чатты, атауды ауыстыруды және өшіру кезінде не жойылатынын қарап шығыңыз.`,
    `Баптау және бақылау`,
    `Толық құжаттаманы оқу`,
    `Пайдаланушы нұсқаулығы мен тілдік модельдерге арналған анықтамада NCF Agent Interconnect жұмысының қадамдары мен шектеулері түсіндірілген.`,
    `llms.txt ашу`,
    `Екі чаттан бастаңыз`,
    `Агенттерге ат қойыңыз. Хабарлама жіберіңіз.`,
    `NCF Agent Interconnect-ті орнатып, таңдаған ЖИ қолданбаңыздың қосылымын баптаңыз. Екі чатты әртүрлі атпен қосып, бір агенттен екіншісіне хабарласуын сұраңыз.`,
    `macOS үшін Apple Silicon Mac пен Intel Mac нұсқаларына арналған DMG, Windows үшін x64 EXE бар. macOS 13 немесе одан кейінгі нұсқа қажет. Intel Mac пакеті Intel құрылғысында іске қосылып тексерілмеген. Linux орнатқышы жарияланбаған.`,
  ],
  development: [
    `Бір жобада бірнеше жұмысты жүргізу — NCF Agent Interconnect`,
    `ЖИ көмекшілерінің әртүрлі қолданба мен компьютерде бір жобаның бірнеше тапсырмасын қалай бірге атқаратынын көріңіз.`,
    `Ұзақ оқиға`,
    `Бір жобада бірнеше жұмысты жүргізу`,
    `ЖИ көмекшілеріңіз әртүрлі ЖИ қолданбаларында, тіпті бір жергілікті желідегі басқа компьютерлерде жұмыс істей алады. NCF Agent Interconnect арқылы олар хабарламалар мен файлдар алмасып, ортақ тапсырмаларды орындауда бір-біріне көмектеседі. Сіз олармен үйреншікті чаттарыңызда сөйлесе бересіз.`,
    `Бұл бір жобаның бірнеше жұмысына қалай көмектесетінін көріңіз: функция әзірлеу, пайдаланушылар өтінімдерін қарау және қателерді түзету.`,
  ],
  holiday: [
    `Кеш ұйымдастыру — NCF Agent Interconnect`,
    `ЖИ көмекшілерінің NCF Agent Interconnect арқылы хабарламалар мен файлдар алмасып, кешті бірге қалай ұйымдастыратынын көріңіз.`,
    `Мысал ретінде берілген оқиға`,
    `Кеш ұйымдастыру`,
    `Алдымен бір ЖИ көмекшісімен әдеттегідей сөйлесіңіз. Бөлек жұмыс пайда болса, оны басқа көмекшіге тапсырыңыз. Әрқайсысының өз міндеті мен қажетті деректері бар жеке әңгімесі болады. Бұл оқиғадағы барлық көмекші бір компьютердегі бір ЖИ қолданбасында жұмыс істейді.`,
    `Басталған әңгімені жалғастыру`,
    `Үйде кеш ұйымдастырып жатырсыз. Іс-шараларды талқылап отырып, шығынды да есептегіңіз келеді. Алғашқы көмекшімен бағдарламаны жоспарлап, есепті екіншісіне тапсырасыз.`,
    `Шығынды есептеу үшін екінші ЖИ чатын ашыңыз. Идеялар мен қалаулар бір әңгімеде, бағалар мен есептер екіншісінде қалады. Көмекшілер өз бөліктерімен қатар айналыса алады.`,
    `Көмекшілерге ат қойып, таныстыру`,
    `Алдымен таңдаған ЖИ қолданбаңыз үшін NCF Agent Interconnect-ті бір рет баптаңыз. Одан кейін көмекшілер өз чаттарынан тікелей қосыла алады.`,
    `Amy мен Ben — өзіңіз таңдаған есімдер. Енді олар бір-біріне атымен хабарласа алады. Оларды таныстыру үшін әдеттегі өтініш жеткілікті.`,
    `Бірінің жұмысын екіншісіне пайдалану`,
    `Amy шеберлік сабағын ұсынып, қажетті материалдар тізімін Ben-ге жібереді. Ben бұл іс-шара тым қымбат екенін байқап, Amy-ге айтады.`,
    `Amy жоспарды өзгертеді, Ben есепті жаңартады. Әрқайсысы бөлек жұмысты атқарса да, шешімдерді бірге келіседі. Нәтижелері бір кеш жоспарына бірігеді.`,
    `Жұмыс жүріп жатқанда сөйлесуді жалғастыру`,
    `Көмекшілер жұмыс істеп жатқанда балалар да келетінін білесіз. Жаңа талаптарды бірден айта аласыз.`,
    `Талапты нақтылау, сұрақ қою немесе жұмыс қосу үшін кез келген көмекшіге жүгініңіз. Бәрін Amy-мен ғана талқылағыңыз келсе, одан өзгерістерді басқаларға жеткізіп, нәтижелерін жинауды сұраңыз.`,
    `Қажет кезде тағы көмекші қосу`,
    `Енді ас мәзірін ойластыру керек. Kate-пен мәзір әзірлеу үшін тағы бір чат ашыңыз. Amy іс-шараны, Ben шығын есебін жалғастырады.`,
    `Бөлек жұмыс туғанда ғана жаңа көмекші қосылады. Мәзір, іс-шара және шығын үшін жауапты адам бар, ал ортақ жайттарды олар өзара келіседі.`,
    `Нәтижені жинақтау`,
    `Соңында өзара үйлесетін үш материал дайын болады: кеш жоспары, сатып алу тізімі бар мәзір және шығын сметасы. Әрқайсысын авторымен талқылаңыз немесе бәрін Amy арқылы жүргізе беріңіз. Бір көмекшіден бастап, қажетіне қарай басқаларын қосыңыз. Бір компьютердегі бір ЖИ қолданбасы жеткілікті.`,
    `Кеш жоспары`,
    `Кеш бюджеті`,
    `Мәзір және сатып алу`,
    `ЖИ көмекшісі`,
    `Сіз`,
    `Ноутбук алдында үстелде отырған сіз.`,
    `Планшет экранындағы {name} агенті.`,
    `Барлығы {total} кадр, көрсетілгені {frames}. {description}`,
    `Агент қосылғанға дейінгі кәдімгі ЖИ чаты`,
    `{name} агентінің чаты`,
    `{name} орындайтын мысал әрекеттер`,
    `Мысал ретінде берілген нәтиже файлдары`,
    `Кеш жоспары`,
    `Мәзір және сатып алу тізімі`,
    `Шығын сметасы`,
    `Қалауларыңызды талқылағаннан кейін Kate мәзірді дайындап, сатып алу тізімін Ben-ге жібереді.`,
  ],
  holidayDialogue: [
    [
      `Үйде он қонаққа кеш ұйымдастыруға көмектесіңіз. Бүкіл кештің бюджеті — 20 000 рубль. Үйде үстел ойындары бар, бірақ басқа іс-шараларды да қарастырғым келеді.`,
      `Бірнеше іс-шара нұсқасын дайындап, әрқайсысына не сатып алу керегін тіземін.`,
    ],
    [
      `Amy агенті ретінде қосылыңыз. Кештің іс-шараларын жоспарлауды жалғастырыңыз. Шығынды Ben есептейді, қажет заттарды онымен талқылаңыз.`,
      `Amy агенті ретінде қосылдым. Жоспарды жалғастырып, шығын есебіне қажет тізімді дайындаймын.`,
    ],
    [
      `Ben агенті ретінде қосылыңыз. Кештің шығынын есептеуге көмектесіңіз. Іс-шараны Amy жоспарлайды: талаптарды одан сұрап, сатып алуды онымен келісіңіз.`,
      `Ben агенті ретінде қосылдым. Кешке қойылатын талаптарды Amy-ден біліп, шығынды есептеймін.`,
    ],
    [
      `Он қонаққа шеберлік сабағын өткізу ойымда бар. Міне, материалдар тізімі. Жалпы 20 000 рубль бюджеттен асқа қанша қалатынын есептеңіз.`,
      `Бұл бағамен материалдарға бюджеттің тым көп бөлігі кетеді. Асқа жеткілікті қаражат қалуы үшін арзанырақ іс-шара таңдаңыз.`,
    ],
    [
      `Шеберлік сабағының орнына үйдегі ойындарды қолданамын. Жоспар мен сатып алу тізімін жаңарттым. Жаңа тізім бойынша шығынды қайта есептеңіз.`,
      `Жаңартылған тізім бойынша шығынды қайта есептеймін.`,
    ],
    [
      `Тағы төрт бала келеді. Оларға да іс-шара ойластырыңыз. Бюджет өзгермейді.`,
      `Балаларға арналған ойындарды қосып, қонақ саны енді он төрт болғанын Ben-ге айтамын.`,
    ],
    [
      `Қазір төрт баланы қосқанда он төрт қонақ болады. Балаларға арналған ойындарды қосып жатырмын. Жаңа қонақ саны бойынша шығынды тексеріңіз; жалпы бюджет өзгермейді.`,
      `Қосылған қонақтарды есепке алып, шығынды тексеремін. Жалпы бюджетті өзгертпеймін.`,
    ],
    [
      `Асқа қазір қанша қаражат қалғанын және қандай шығындарды әлі тексеру керегін көрсетіңіз.`,
      `Соңғы сметаны қарап, әлі расталмаған шығындарды бөлек тіземін.`,
    ],
    [
      `Kate агенті ретінде қосылыңыз. Мәзір мен сатып алу тізімін дайындауға көмектесіңіз. Талаптарды Amy-ден сұрап, шығынды Ben-мен келісіңіз. Мәзір әзірлемес бұрын тағамға қатысты қалауымды сұраңыз.`,
      `Kate агенті ретінде қосылдым. Әуелі тағамға қатысты қалауыңызды сұраймын, содан кейін қонақ саны мен кеш жоспарын Amy-ден білемін.`,
    ],
    [
      `Ас мәзірімен мен айналысамын. Қанша қонақ келеді және ас ішуге үзілісті қашан жоспарладыңыздар?`,
      `Төрт баланы қосқанда он төрт қонақ. Ас ішу уақыты белгіленген қазіргі кеш жоспарын жіберемін.`,
    ],
    [
      `Талқылаған талғамға сай мәзір дайындадым. Міне, сатып алу тізімі. Бәріміз бір тізіммен жұмыс істеу үшін ас шығынын осы тізіммен есептеңіз.`,
      `Бұл сатып алуларды жалпы шығын сметасына қосамын.`,
    ],
    [
      `Кеш жоспарын, мәзірді және шығын сметасын жинақтаңыз. Ben мен Kate-тен соңғы нұсқаларын сұраңыз. Не дайын екенін және нені әлі мен шешуім керегін айтыңыз.`,
      `Ben мен Kate-тен соңғы нұсқаларын сұрап, нәтижелерді біріктіремін.`,
    ],
    [
      `Шығын сметасының соңғы нұсқасын жіберіңіз. Әлі шешім күтіп тұрған сұрақтарды бөлек жазыңыз.`,
      `Міне, қазіргі смета және әлі растауды қажет ететін шығындар тізімі.`,
    ],
    [
      `Мәзір мен сатып алу тізімінің соңғы нұсқасын жіберіңіз. Әлі шешім күтіп тұрған сұрақтарды бөлек жазыңыз.`,
      `Міне, мәзір мен сатып алу тізімі. Қалған сұрақтарды бөлек көрсеттім.`,
    ],
    [
      `Кеш жоспарын, сатып алу тізімі бар мәзірді және шығын сметасын біріктірдім. Сіздің шешіміңіз қажет сұрақтарды бөлек көрсеттім.`,
    ],
  ],
  holidayActivity: [
    `NCF Agent Interconnect қолданылуда`,
    `Хабарлама жіберілді`,
    `Іс-шара нұсқалары ізделуде`,
    `Қажет заттар тізілуде`,
    `Материалдар тізімі дайындалуда`,
    `Шығын сметасы жаңартылуда`,
    `Он төрт қонақтың шығыны тексерілуде`,
    `Шығын қорытындысы әзірленуде`,
    `Ас шығыны сметаға қосылуда`,
  ],
};

// Editorial translations prepared for the publication source.
window.NCF_SITE_COPY['de'] = {
  shared: [
    'Geschichte auswählen',
    'Geschichten',
    'So verbinden Sie Ihre Assistenten',
    'NCF Agent Interconnect herunterladen',
    'Dokumentation',
    'Nachrichten und Dateien zwischen KI-Assistenten.',
    'Nach der Geschichte',
  ],
  home: [
    'NCF Agent Interconnect — Assistenten arbeiten zusammen',
    'Geben Sie KI-Assistenten verschiedene Teile einer gemeinsamen Aufgabe. Lassen Sie sie Nachrichten und Dateien austauschen, ihre Arbeit abstimmen und Sie einbeziehen.',
    'Geben Sie Ihren KI-Assistenten verschiedene Teile einer Aufgabe. Mit NCF Agent Interconnect können sie Nachrichten und Dateien austauschen, gleichzeitig arbeiten und ihre Entscheidungen abstimmen.',
    'Sprechen Sie weiter mit jedem Assistenten oder bitten Sie einen, die anderen zu koordinieren und alles mit Ihnen zu besprechen. Sie können Anforderungen präzisieren, Arbeit hinzufügen und die Richtung unterwegs ändern.',
    'So funktioniert es',
    'Eine Feier planen',
    'Beginnen Sie mit einem gewöhnlichen KI-Chat. Holen Sie bei Bedarf Hilfe für Aktivitäten, Kosten und Essen dazu. Alles in einer Anwendung auf einem Computer.',
    'Die Hauptfigur der Feiergeschichte spricht am Laptop mit ihrer Assistentin.',
    'Mehrere Aufgaben in einem Projekt bearbeiten',
    'Entwickeln Sie eine Funktion, prüfen Sie Nutzeranfragen und beheben Sie einen Fehler. Die Assistenten arbeiten in verschiedenen KI-Anwendungen und auf verschiedenen Computern.',
    'Die Hauptfigur der Projektgeschichte arbeitet an einem Laptop.',
    'Weitere Möglichkeiten, wie Ihre Assistenten helfen können',
    'Die Geschichten zeigen zwei Beispiele. Derselbe Austausch kann bei Dokumenten, Recherchen, Berechnungen und alltäglichen Aufgaben helfen. Sie entscheiden, wer was übernimmt und wie die Assistenten zusammenarbeiten.',
    'An mehreren Aufgaben zugleich arbeiten',
    'Ein Assistent sammelt Material, ein anderer erstellt eine Berechnung und ein dritter prüft das Ergebnis. Jeder hat einen Chat mit den benötigten Einzelheiten. Während die Arbeit voranschreitet, können sie einander Fragen stellen und bereits Vorhandenes nutzen.',
    'Abstimmen, wer welchen Teil übernimmt',
    'Bitten Sie die Assistenten, die Arbeit aufzuteilen und einander über Änderungen zu informieren. Sie können gemeinsame Einzelheiten abstimmen, doppelte Arbeit vermeiden und erkennen, wenn ihre Entscheidungen nicht mehr zusammenpassen.',
    'Ein Ergebnis prüfen und verbessern',
    'Geben Sie einem anderen Assistenten ein Dokument oder eine Berechnung zur Prüfung. Er kann seine Erkenntnisse mit dem Verfasser besprechen, eine überarbeitete Fassung erhalten und sie erneut prüfen. Sie können sich einschalten und entscheiden, wann das Ergebnis Ihren Anforderungen entspricht.',
    'Frühere Arbeit einbeziehen',
    'Wenn Sie eine passende Frage früher mit einem anderen Assistenten besprochen haben, bitten Sie das Team, ihn zu kontaktieren. Er kann seine damaligen Erkenntnisse erklären und noch vorhandene Materialien teilen. So erhält die neue Aufgabe einen nützlichen Ausgangspunkt.',
    'Während der Arbeit im Gespräch bleiben',
    'Sprechen Sie direkt mit jedem Assistenten oder bitten Sie einen, die anderen zu koordinieren. Er kann Ihre Wünsche weitergeben, Ergebnisse sammeln und Ihnen Fragen vorlegen, die Ihre Entscheidung brauchen.',
    'Ergänzen Sie Anforderungen, ändern Sie Prioritäten und holen Sie bei Bedarf Hilfe für eine eigene Aufgabe hinzu. Assistenten, die bereits arbeiten, können ihren Teil mit den aktualisierten Entscheidungen fortsetzen.',
    'In einer Anwendung — oder mehreren',
    'Für den ersten Austausch reichen zwei KI-Chats in einer Anwendung auf einem Computer. Später können Sie Assistenten in anderen KI-Anwendungen verbinden, wenn dort die benötigten Modelle, Werkzeuge oder Materialien verfügbar sind.',
    'NCF Agent Interconnect unterstützt OpenCode v1, Codex Desktop, Cursor und AionUi mit Cursor Agent. Assistenten können auch auf verschiedenen Computern im selben lokalen Netzwerk arbeiten. Jeder nutzt weiterhin die Möglichkeiten seiner eigenen Anwendung.',
    'Anwendungen einrichten und Unterschiede verstehen',
    'Materialien und Nachrichten griffbereit halten',
    'Assistenten können Dokumente, Listen, Berechnungen und andere Dateien mit ihren Erläuterungen senden. NCF Agent Interconnect bewahrt den Verlauf ihrer Nachrichten und empfangenen Dateien auch über Neustarts hinweg auf.',
    'Prüfen Sie im Fenster für Einstellungen und Überwachung Verbindungen und die Nachrichtenzustellung oder öffnen Sie Nachrichten und Dateien eines lokalen Agenten. So sehen Sie, was geteilt wurde, und können später darauf zurückkommen.',
    'Einstellungen, Überwachung und Verlauf',
    'Das Wesentliche im Blick behalten',
    'Agenten arbeiten in Chats. NCF Agent Interconnect stellt ihre Nachrichten zu.',
    'Ihre Chats verbinden',
    'Installieren Sie NCF Agent Interconnect, wählen Sie die Konfigurationsdatei Ihrer Anwendung, prüfen Sie die Änderungen und klicken Sie auf Apply. Verbinden Sie MCP erneut und prüfen Sie einen Nachrichtenaustausch.',
    'Einrichtungsanleitung',
    'Ihre Anwendung kennen',
    'OpenCode v1, Codex Desktop, Cursor und AionUi mit Cursor Agent unterscheiden sich bei Zustellung und Einrichtung.',
    'Details zu den Anwendungen',
    'Ihre Daten kontrollieren',
    'Prüfen Sie Anhänge, den lokalen Verlauf, den genau verbundenen Chat, Namensübertragungen und die Folgen einer Löschung.',
    'Einstellungen und Überwachung',
    'Die vollständige Dokumentation lesen',
    'Das Benutzerhandbuch und die Referenz für Sprachmodelle erklären die Arbeitsschritte und Grenzen von NCF Agent Interconnect.',
    'llms.txt öffnen',
    'Mit zwei Chats beginnen',
    'Geben Sie den Agenten Namen. Senden Sie eine Nachricht.',
    'Installieren Sie NCF Agent Interconnect, richten Sie die Verbindung für die gewählte KI-Anwendung ein, verbinden Sie zwei Chats unter verschiedenen Namen und bitten Sie einen Agenten, den anderen zu kontaktieren.',
    'macOS-Downloads sind als DMG für Apple Silicon und Intel Mac verfügbar; für Windows gibt es eine x64-EXE. macOS 13 oder neuer ist erforderlich. Das Intel-Mac-Paket wurde nicht auf Intel-Hardware ausgeführt. Ein Linux-Installationspaket wird nicht veröffentlicht.',
  ],
  development: [
    'Mehrere Aufgaben in einem Projekt bearbeiten — NCF Agent Interconnect',
    'Verfolgen Sie, wie KI-Assistenten über Anwendungen und Computer hinweg gemeinsam mehrere Projektaufgaben bearbeiten.',
    'Die ausführlichere Geschichte',
    'Mehrere Aufgaben in einem Projekt bearbeiten',
    'Ihre KI-Assistenten können in verschiedenen KI-Anwendungen arbeiten, sogar auf verschiedenen Computern im selben lokalen Netzwerk. Mit NCF Agent Interconnect tauschen sie Nachrichten und Dateien aus und helfen einander bei gemeinsamen Aufgaben. Sprechen Sie weiter in Ihren gewohnten Chats mit ihnen.',
    'Sehen Sie, wie dies bei mehreren Aufgaben eines Projekts hilft: eine Funktion entwickeln, Nutzeranfragen prüfen und Fehler beheben.',
  ],
  holiday: [
    'Eine Feier planen — NCF Agent Interconnect',
    'Sehen Sie, wie KI-Assistenten gemeinsam eine Feier planen und über NCF Agent Interconnect Nachrichten und Dateien austauschen.',
    'Eine beispielhafte Geschichte',
    'Eine Feier planen',
    'Beginnen Sie mit einem gewöhnlichen Gespräch mit einem KI-Assistenten. Wenn eine eigene Aufgabe hinzukommt, geben Sie sie einem anderen Assistenten. Jeder bekommt seinen Teil der Arbeit und einen Chat mit den nötigen Einzelheiten. Alle in dieser Geschichte arbeiten in einer KI-Anwendung auf einem Computer.',
    'Bei Ihrem bisherigen Gespräch anfangen',
    'Sie planen zu Hause eine Feier. Während Sie über Aktivitäten sprechen, möchten Sie auch die Kosten berechnen. Planen Sie mit dem ersten Assistenten weiter und bitten Sie einen zweiten um die Berechnungen.',
    'Öffnen Sie für die Kosten einen zweiten KI-Chat. Ideen und Wünsche bleiben in einem Gespräch, Preise und Berechnungen im anderen. Die Assistenten können gleichzeitig an ihren Teilen arbeiten.',
    'Den Assistenten Namen geben und sie vorstellen',
    'Richten Sie NCF Agent Interconnect zuerst einmal für Ihre gewählte KI-Anwendung ein. Danach verbinden sich die Assistenten direkt aus ihren Chats.',
    'Amy und Ben sind die von Ihnen gewählten Namen. Nun können sich die Assistenten mit Namen ansprechen. Stellen Sie sie mit einer gewöhnlichen Bitte einander vor.',
    'Die Arbeit eines Assistenten für einen anderen nutzen',
    'Amy schlägt einen Workshop vor und schickt Ben eine Materialliste. Ben stellt fest, dass der Workshop zu teuer wird, und sagt Amy Bescheid.',
    'Amy ändert den Plan und Ben aktualisiert die Berechnung. Jeder bearbeitet einen anderen Teil, während sie Entscheidungen gemeinsam abstimmen. Ihre Arbeit ergibt zusammen einen stimmigen Feierplan.',
    'Während der Arbeit weiterreden',
    'Während die Assistenten arbeiten, erfahren Sie, dass auch Kinder kommen. Besprechen Sie die neuen Anforderungen sofort.',
    'Sprechen Sie mit einem beliebigen Assistenten, um Anforderungen zu präzisieren, Fragen zu stellen oder Arbeit hinzuzufügen. Wenn Sie alles lieber mit Amy besprechen, bitten Sie sie, Änderungen weiterzugeben und Ergebnisse einzusammeln.',
    'Bei Bedarf Hilfe hinzuholen',
    'Jetzt wird das Essen geplant. Öffnen Sie einen weiteren Chat, um mit Kate das Menü zu erstellen. Amy kümmert sich weiter um die Aktivitäten und Ben um die Kosten.',
    'Ein neuer Assistent kommt hinzu, wenn ein eigener Teil der Arbeit anfällt. Für Menü, Aktivitäten und Kosten ist jeweils jemand zuständig; gemeinsame Einzelheiten stimmen sie ab.',
    'Die Ergebnisse zusammenführen',
    'Nun liegen drei aufeinander abgestimmte Materialien vor: ein Feierplan, ein Menü mit Einkaufsliste und eine Kostenschätzung. Besprechen Sie jedes mit seinem Verfasser oder koordinieren Sie alles weiter über Amy. Beginnen Sie mit einem Assistenten und holen Sie weitere bei Bedarf hinzu. Eine KI-Anwendung auf einem Computer genügt.',
    'Feierplan',
    'Budget der Feier',
    'Menü und Einkauf',
    'KI-Assistent',
    'Sie',
    'Sie sitzen mit einem Laptop an einem Schreibtisch.',
    'Agent {name} auf einem Tablet-Bildschirm.',
    'Bilder {frames} von {total}. {description}',
    'Ein gewöhnlicher KI-Chat, bevor ein Agent verbunden ist',
    'Chat von Agent {name}',
    'Beispielhafte Aktionen von {name}',
    'Beispielhafte Ergebnisdateien',
    'Feierplan',
    'Menü und Einkaufsliste',
    'Kostenschätzung',
    'Nachdem Kate Ihre Wünsche besprochen hat, erstellt sie das Menü und schickt Ben die Einkaufsliste.',
  ],
  holidayDialogue: [
    [
      'Hilf mir, zu Hause eine Feier für zehn Gäste zu planen. Das Gesamtbudget beträgt 20.000 Rubel. Wir haben Brettspiele zu Hause, aber ich möchte auch andere Aktivitäten erwägen.',
      'Ich werde einige Aktivitäten vorschlagen und auflisten, was wir dafür jeweils kaufen müssten.',
    ],
    [
      'Verbinde dich als Agent Amy. Plane die Aktivitäten für die Feier weiter. Ben berechnet die Kosten — besprich mit ihm, was wir brauchen.',
      'Als Agent Amy verbunden. Ich mache mit dem Plan weiter und bereite eine Liste für die Kostenschätzung vor.',
    ],
    [
      'Verbinde dich als Agent Ben. Hilf bei den Kosten der Feier. Amy plant die Aktivitäten: Frag sie nach den Anforderungen und stimme die Einkäufe mit ihr ab.',
      'Als Agent Ben verbunden. Ich frage Amy nach den Anforderungen und berechne die Kosten.',
    ],
    [
      'Ich überlege, einen Workshop für zehn Gäste zu veranstalten. Hier ist die Materialliste. Berechne, wie viel vom Gesamtbudget von 20.000 Rubel für das Essen übrig bliebe.',
      'Bei diesen Preisen würden die Materialien zu viel vom Budget verbrauchen. Wähle eine günstigere Aktivität, damit genug für das Essen bleibt.',
    ],
    [
      'Ich ersetze den Workshop durch Spiele, die wir schon zu Hause haben. Ich habe den Plan und die Einkaufsliste aktualisiert. Berechne die Kosten mit der neuen Liste erneut.',
      'Ich berechne die Kosten mit der aktualisierten Liste erneut.',
    ],
    [
      'Vier Kinder kommen ebenfalls — plane auch etwas für sie. Das Budget bleibt gleich.',
      'Ich ergänze Spiele für die Kinder und sage Ben, dass nun vierzehn Gäste kommen.',
    ],
    [
      'Es kommen jetzt vierzehn Gäste, darunter vier Kinder. Ich ergänze Kinderspiele. Prüfe die Kosten für die neue Gästezahl; das Gesamtbudget bleibt gleich.',
      'Ich berücksichtige die zusätzlichen Gäste und prüfe die Kosten. Das Gesamtbudget bleibt unverändert.',
    ],
    [
      'Zeig mir, wie viel für das Essen übrig ist und welche Kosten noch geprüft werden müssen.',
      'Ich prüfe die aktuelle Schätzung und liste die Kosten auf, die noch bestätigt werden müssen.',
    ],
    [
      'Verbinde dich als Agent Kate. Hilf beim Menü und der Einkaufsliste. Frag Amy nach den Anforderungen und stimme die Kosten mit Ben ab. Frag mich vor der Menüplanung nach meinen Essenswünschen.',
      'Als Agent Kate verbunden. Ich frage zuerst nach deinen Essenswünschen und erkundige mich bei Amy nach Gästezahl und Feierplan.',
    ],
    [
      'Ich kümmere mich um das Essen. Wie viele Gäste kommen, und wann ist eine Essenspause geplant?',
      'Es kommen vierzehn Gäste, darunter vier Kinder. Hier ist der aktuelle Feierplan mit markierter Essenspause.',
    ],
    [
      'Ich habe das Menü nach den besprochenen Wünschen erstellt. Hier ist die Einkaufsliste. Nutze sie für die Essenskosten, damit wir alle mit derselben Liste arbeiten.',
      'Ich nehme diese Einkäufe in die Gesamtschätzung auf.',
    ],
    [
      'Führe Feierplan, Menü und Kostenschätzung zusammen. Frag Ben und Kate nach ihren neuesten Fassungen. Zeig mir, was fertig ist und worüber ich noch entscheiden muss.',
      'Ich frage Ben und Kate nach den neuesten Fassungen und führe die Ergebnisse zusammen.',
    ],
    [
      'Schick die neueste Kostenschätzung. Liste Fragen, die noch eine Entscheidung brauchen, getrennt auf.',
      'Hier ist die aktuelle Schätzung mit der Liste der Kosten, die noch bestätigt werden müssen.',
    ],
    [
      'Schick das neueste Menü und die Einkaufsliste. Liste Fragen, die noch eine Entscheidung brauchen, getrennt auf.',
      'Hier sind Menü und Einkaufsliste. Die offenen Fragen habe ich getrennt aufgeführt.',
    ],
    [
      'Ich habe Feierplan, Menü mit Einkaufsliste und Kostenschätzung zusammengeführt. Die Fragen, über die du entscheiden musst, habe ich getrennt aufgeführt.',
    ],
  ],
  holidayActivity: [
    'Mit NCF Agent Interconnect',
    'Nachricht gesendet',
    'Ideen für Aktivitäten suchen',
    'Benötigte Dinge auflisten',
    'Materialliste vorbereiten',
    'Kostenschätzung aktualisieren',
    'Kosten für vierzehn Gäste prüfen',
    'Kostenübersicht zusammenstellen',
    'Essen in die Kostenschätzung aufnehmen',
  ],
};
window.NCF_SITE_COPY['it'] = {
  shared: [
    'Scegli una storia',
    'Storie',
    'Come collegare i tuoi assistenti',
    'Scarica NCF Agent Interconnect',
    'Documentazione',
    'Messaggi e file tra assistenti IA.',
    'Dopo la storia',
  ],
  home: [
    'NCF Agent Interconnect — assistenti che lavorano insieme',
    'Assegna agli assistenti IA parti di un compito comune. Lascia che si scambino messaggi e file, coordinino il lavoro e ti tengano coinvolto.',
    'Assegna ai tuoi assistenti IA parti diverse dello stesso compito. Con NCF Agent Interconnect possono scambiarsi messaggi e file, lavorare contemporaneamente e coordinare le loro decisioni.',
    'Continua a parlare con ogni assistente oppure chiedi a uno di coordinare gli altri e discutere tutto con te. Puoi precisare i requisiti, aggiungere lavoro e cambiare direzione strada facendo.',
    'Scopri come funziona',
    'Organizza una festa',
    'Parti da una normale chat con un’IA. Chiedi aiuto per attività, spese e cibo quando serve. Tutto in un’unica applicazione su un solo computer.',
    'La protagonista della storia sulla festa parla con la sua assistente davanti a un portatile.',
    'Gestisci più compiti in un progetto',
    'Sviluppa una funzionalità, esamina le richieste degli utenti e correggi un bug. Gli assistenti lavorano in applicazioni IA diverse e su computer diversi.',
    'Il protagonista della storia sul progetto lavora a un portatile.',
    'Altri modi in cui gli assistenti possono aiutarti',
    'Le storie mostrano due esempi. Lo stesso tipo di scambio può aiutarti con documenti, ricerche, calcoli e attività quotidiane. Decidi tu chi fa cosa e come collaborano gli assistenti.',
    'Lavora su più compiti contemporaneamente',
    'Un assistente raccoglie materiale, un altro prepara un calcolo e un terzo verifica il risultato. Ognuno ha una conversazione con i dettagli necessari. Man mano che il lavoro procede, possono farsi domande e usare ciò che è già pronto.',
    'Concorda chi si occupa di ogni parte',
    'Chiedi agli assistenti di dividersi il lavoro e informarsi a vicenda dei cambiamenti. Possono concordare i dettagli condivisi, evitare duplicazioni e accorgersi quando le loro decisioni non sono più compatibili.',
    'Verifica e migliora un risultato',
    'Affida a un altro assistente la verifica di un documento o di un calcolo. Può discutere le osservazioni con l’autore, ricevere una versione rivista e controllarla di nuovo. Puoi unirti alla conversazione e decidere quando il risultato soddisfa le tue esigenze.',
    'Consulta il lavoro precedente',
    'Se in passato hai discusso una questione pertinente con un altro assistente, chiedi al gruppo di contattarlo. Potrà spiegare le sue conclusioni precedenti e condividere i materiali che conserva ancora. Il nuovo compito partirà da una base utile.',
    'Continua a parlare mentre il lavoro procede',
    'Parla direttamente con ciascun assistente oppure chiedi a uno di coordinare gli altri. Può trasmettere le tue preferenze, raccogliere i risultati e portarti le questioni che richiedono una tua decisione.',
    'Aggiungi requisiti, cambia le priorità e coinvolgi un altro assistente per un compito separato quando serve. Chi sta già lavorando può continuare la propria parte secondo le decisioni aggiornate.',
    'In una sola applicazione, o in più di una',
    'Per il primo scambio bastano due chat IA in un’unica applicazione su un solo computer. In seguito puoi collegare assistenti in altre applicazioni IA se lì trovi i modelli, gli strumenti o i materiali che ti servono.',
    'NCF Agent Interconnect supporta OpenCode v1, Codex Desktop, Cursor e AionUi con Cursor Agent. Gli assistenti possono anche lavorare su computer diversi nella stessa rete locale. Ognuno continua a usare le funzionalità della propria applicazione.',
    'Configurazione e differenze tra le applicazioni',
    'Tieni a portata di mano materiali e messaggi',
    'Gli assistenti possono inviare documenti, elenchi, calcoli e altri file insieme alle spiegazioni. NCF Agent Interconnect conserva la cronologia dei loro messaggi e dei file ricevuti, anche dopo un riavvio.',
    'Nella finestra delle impostazioni e del monitoraggio puoi controllare le connessioni e la consegna dei messaggi oppure aprire messaggi e file di un agente locale. Puoi vedere cosa è stato condiviso e tornarci in seguito.',
    'Impostazioni, monitoraggio e cronologia',
    'Tieni chiari i punti essenziali',
    'Gli agenti lavorano nelle chat. NCF Agent Interconnect consegna i loro messaggi.',
    'Collega le tue chat',
    'Installa NCF Agent Interconnect, scegli il file di configurazione dell’applicazione, controlla le modifiche e fai clic su Apply. Ricollega MCP e verifica uno scambio di messaggi.',
    'Guida alla configurazione',
    'Conosci la tua applicazione',
    'OpenCode v1, Codex Desktop, Cursor e AionUi con Cursor Agent hanno modalità di consegna e requisiti di configurazione diversi.',
    'Dettagli delle applicazioni',
    'Controlla i tuoi dati',
    'Esamina gli allegati, la cronologia locale, la chat collegata esatta, i trasferimenti dei nomi e cosa viene eliminato.',
    'Impostazioni e monitoraggio',
    'Leggi la documentazione completa',
    'La guida per l’utente e il riferimento per i modelli linguistici spiegano le procedure e i limiti di NCF Agent Interconnect.',
    'Apri llms.txt',
    'Inizia con due chat',
    'Dai un nome agli agenti. Invia un messaggio.',
    'Installa NCF Agent Interconnect, configura la connessione per l’applicazione IA scelta, collega due chat con nomi diversi e chiedi a un agente di contattare l’altro.',
    'I download per macOS sono disponibili come DMG per Mac Apple Silicon e Intel; Windows usa un EXE x64. È richiesto macOS 13 o successivo. Il pacchetto per Mac Intel non è stato eseguito su hardware Intel. Non è pubblicato un programma di installazione per Linux.',
  ],
  development: [
    'Gestisci più compiti in un progetto — NCF Agent Interconnect',
    'Segui gli assistenti IA mentre gestiscono insieme più compiti di un progetto tra applicazioni e computer diversi.',
    'La storia più lunga',
    'Gestisci più compiti in un progetto',
    'I tuoi assistenti IA possono lavorare in applicazioni IA diverse, anche su computer diversi nella stessa rete locale. Con NCF Agent Interconnect si scambiano messaggi e file e si aiutano nei compiti condivisi. Continua a parlare con loro nelle tue chat abituali.',
    'Scopri come questo aiuta a gestire più compiti di un progetto: sviluppare una funzionalità, esaminare le richieste degli utenti e correggere bug.',
  ],
  holiday: [
    'Organizza una festa — NCF Agent Interconnect',
    'Guarda come gli assistenti IA organizzano una festa insieme, condividendo messaggi e file tramite NCF Agent Interconnect.',
    'Una storia illustrativa',
    'Organizza una festa',
    'Comincia con una normale conversazione con un assistente IA. Quando emerge un compito separato, affidalo a un altro assistente. Ognuno riceve la propria parte e una conversazione con i dettagli necessari. In questa storia tutti lavorano in un’unica applicazione IA su un solo computer.',
    'Parti da ciò di cui stai già parlando',
    'Stai organizzando una festa a casa. Mentre discuti delle attività, vuoi anche calcolare le spese. Continua a pianificare con il primo assistente e chiedi a un secondo di occuparsi dei calcoli.',
    'Apri una seconda chat IA per le spese. Idee e preferenze restano in una conversazione, prezzi e calcoli nell’altra. Gli assistenti possono lavorare alle rispettive parti nello stesso momento.',
    'Dai un nome agli assistenti e presentali',
    'Per prima cosa configura NCF Agent Interconnect una sola volta per l’applicazione IA scelta. Poi gli assistenti si collegano direttamente dalle loro chat.',
    'Amy e Ben sono i nomi che hai scelto. Ora gli assistenti possono rivolgersi l’uno all’altro per nome. Presentali con una normale richiesta.',
    'Lascia che il lavoro di un assistente aiuti l’altro',
    'Amy propone un laboratorio e invia a Ben un elenco dei materiali. Ben scopre che il laboratorio costa troppo e lo dice ad Amy.',
    'Amy cambia il programma e Ben aggiorna il calcolo. Ognuno segue una parte diversa, ma concordano le decisioni insieme. Il loro lavoro confluisce in un unico programma per la festa.',
    'Continua a parlare mentre il lavoro procede',
    'Mentre gli assistenti lavorano, scopri che verranno anche dei bambini. Discuti subito le nuove esigenze.',
    'Parla con qualsiasi assistente per precisare i requisiti, fare domande o aggiungere lavoro. Se preferisci parlare di tutto con Amy, chiedile di trasmettere le modifiche agli altri e raccogliere i loro risultati.',
    'Coinvolgi un altro assistente quando serve',
    'Ora è il momento di pensare al cibo. Apri un’altra chat per preparare il menu con Kate. Amy continua a occuparsi delle attività e Ben delle spese.',
    'Un nuovo assistente entra in gioco quando emerge una parte di lavoro separata. Menu, attività e spese hanno ciascuno un responsabile, e i dettagli condivisi vengono concordati insieme.',
    'Metti insieme il risultato',
    'Ora hai tre materiali coerenti: un programma per la festa, un menu con la lista della spesa e una stima dei costi. Discutine con i rispettivi autori oppure continua a gestire tutto tramite Amy. Inizia con un assistente e aggiungine altri quando servono. Basta un’applicazione IA su un solo computer.',
    'Programma della festa',
    'Budget della festa',
    'Menu e spesa',
    'Assistente IA',
    'Tu',
    'Sei a una scrivania con un portatile.',
    'Agente {name} sullo schermo di un tablet.',
    'Fotogrammi {frames} di {total}. {description}',
    'Una normale chat IA prima che un agente si colleghi',
    'Chat dell’agente {name}',
    'Azioni illustrative di {name}',
    'File di risultato illustrativi',
    'Programma della festa',
    'Menu e lista della spesa',
    'Stima dei costi',
    'Dopo aver parlato delle tue preferenze, Kate prepara il menu e invia la lista della spesa a Ben.',
  ],
  holidayDialogue: [
    [
      'Aiutami a organizzare una festa a casa per dieci ospiti. Il budget totale è di 20.000 rubli. Abbiamo giochi da tavolo in casa, ma vorrei valutare anche altre attività.',
      'Preparerò alcune proposte di attività e indicherò cosa dovremmo comprare per ciascuna.',
    ],
    [
      'Collegati come agente Amy. Continua a pianificare le attività della festa. Ben calcolerà le spese: discuti con lui di ciò che ci serve.',
      'Collegata come agente Amy. Continuerò il programma e preparerò un elenco per la stima delle spese.',
    ],
    [
      'Collegati come agente Ben. Aiutami con le spese della festa. Amy sta pianificando le attività: chiedile i requisiti e concorda con lei gli acquisti.',
      'Collegato come agente Ben. Chiederò ad Amy quali sono le esigenze della festa e calcolerò le spese.',
    ],
    [
      'Sto pensando a un laboratorio per dieci ospiti. Ecco l’elenco dei materiali. Calcola quanto resterebbe per il cibo dal budget totale di 20.000 rubli.',
      'A questi prezzi i materiali assorbirebbero una parte eccessiva del budget. Scegli un’attività meno costosa, così resterà abbastanza per il cibo.',
    ],
    [
      'Sostituirò il laboratorio con i giochi che abbiamo già in casa. Ho aggiornato il programma e la lista della spesa. Ricalcola i costi usando il nuovo elenco.',
      'Ricalcolerò i costi con l’elenco aggiornato.',
    ],
    [
      'Verranno anche quattro bambini: organizza qualcosa anche per loro. Mantieni lo stesso budget.',
      'Aggiungerò giochi per i bambini e dirò a Ben che ora gli ospiti sono quattordici.',
    ],
    [
      'Ora gli ospiti sono quattordici, tra cui quattro bambini. Sto aggiungendo giochi per loro. Controlla i costi per il nuovo numero di ospiti; il budget totale non cambia.',
      'Terrò conto degli ospiti in più e controllerò i costi. Il budget totale resterà lo stesso.',
    ],
    [
      'Mostrami quanto resta per il cibo e quali costi devono ancora essere controllati.',
      'Verificherò l’ultima stima ed elencherò i costi ancora da confermare.',
    ],
    [
      'Collegati come agente Kate. Aiutami a preparare un menu e una lista della spesa. Chiedi ad Amy quali sono le esigenze e concorda i costi con Ben. Prima di preparare il menu, chiedimi le preferenze alimentari.',
      'Collegata come agente Kate. Ti chiederò le preferenze alimentari prima di preparare il menu e chiederò ad Amy il numero di ospiti e il programma della festa.',
    ],
    [
      'Mi occuperò del cibo. Quanti ospiti verranno e quando prevedete una pausa per mangiare?',
      'Gli ospiti sono quattordici, tra cui quattro bambini. Ecco il programma attuale della festa, con la pausa per il cibo indicata.',
    ],
    [
      'Ho preparato il menu in base alle preferenze discusse. Ecco la lista della spesa. Usala per stimare il costo del cibo, così lavoriamo tutti sullo stesso elenco.',
      'Inserirò questi acquisti nella stima complessiva.',
    ],
    [
      'Metti insieme il programma della festa, il menu e la stima dei costi. Chiedi a Ben e Kate le loro ultime versioni. Mostrami cosa è pronto e cosa devo ancora decidere.',
      'Chiederò a Ben e Kate le ultime versioni e riunirò i risultati.',
    ],
    [
      'Invia l’ultima stima dei costi. Elenca separatamente le questioni che attendono ancora una decisione.',
      'Ecco la stima attuale e l’elenco dei costi ancora da confermare.',
    ],
    [
      'Invia il menu più recente e la lista della spesa. Elenca separatamente le questioni che attendono ancora una decisione.',
      'Ecco il menu e la lista della spesa. Ho elencato le questioni rimaste separatamente.',
    ],
    [
      'Ho riunito il programma della festa, il menu con la lista della spesa e la stima dei costi. Ho elencato separatamente le questioni che richiedono una tua decisione.',
    ],
  ],
  holidayActivity: [
    'Con NCF Agent Interconnect',
    'Messaggio inviato',
    'Ricerca di idee per le attività',
    'Elenco di ciò che servirà',
    'Preparazione dell’elenco dei materiali',
    'Aggiornamento della stima dei costi',
    'Verifica dei costi per quattordici ospiti',
    'Preparazione del riepilogo delle spese',
    'Aggiunta del cibo alla stima dei costi',
  ],
};
window.NCF_SITE_COPY['es'] = {
  shared: [
    'Elige una historia',
    'Historias',
    'Cómo conectar a tus asistentes',
    'Descargar NCF Agent Interconnect',
    'Documentación',
    'Mensajes y archivos entre asistentes de IA.',
    'Después de la historia',
  ],
  home: [
    'NCF Agent Interconnect — asistentes que trabajan juntos',
    'Asigna a los asistentes de IA distintas partes de una tarea común. Deja que intercambien mensajes y archivos, coordinen su trabajo y te mantengan al tanto.',
    'Asigna a tus asistentes de IA distintas partes de una misma tarea. Con NCF Agent Interconnect pueden intercambiar mensajes y archivos, trabajar al mismo tiempo y coordinar sus decisiones.',
    'Sigue hablando con cada asistente o pide a uno que coordine a los demás y lo comente todo contigo. Puedes aclarar requisitos, añadir trabajo y cambiar de rumbo sobre la marcha.',
    'Descubre cómo funciona',
    'Organiza una fiesta',
    'Empieza con una conversación normal con una IA. Pide ayuda con las actividades, los gastos y la comida cuando la necesites. Todo en una aplicación y un ordenador.',
    'La protagonista de la historia de la fiesta habla con su asistente ante un portátil.',
    'Gestiona varias tareas de un proyecto',
    'Desarrolla una función, revisa solicitudes de usuarios y corrige un error. Los asistentes trabajan en distintas aplicaciones de IA y en distintos ordenadores.',
    'La persona protagonista de la historia del proyecto trabaja ante un portátil.',
    'Más formas en que tus asistentes pueden ayudarte',
    'Las historias muestran dos ejemplos. Este mismo intercambio puede servir para documentos, investigación, cálculos y tareas cotidianas. Tú decides quién hace cada cosa y cómo colaboran los asistentes.',
    'Trabaja en varias tareas a la vez',
    'Un asistente recopila material, otro prepara un cálculo y un tercero comprueba el resultado. Cada uno dispone de una conversación con los detalles que necesita. A medida que avanza el trabajo, pueden hacerse preguntas y aprovechar lo que ya está preparado.',
    'Acordad quién se ocupa de cada parte',
    'Pide a los asistentes que se repartan el trabajo y se informen de los cambios. Pueden acordar los detalles compartidos, evitar duplicar esfuerzos y detectar cuándo sus decisiones dejan de encajar.',
    'Revisa y mejora un resultado',
    'Entrega a otro asistente un documento o un cálculo para que lo revise. Puede comentar sus hallazgos con quien lo hizo, recibir una versión corregida y volver a comprobarla. Puedes participar y decidir cuándo el resultado satisface tus necesidades.',
    'Consulta trabajos anteriores',
    'Si antes trataste un tema relacionado con otro asistente, pide al equipo que contacte con él. Podrá explicar lo que averiguó y compartir los materiales que aún conserve. La nueva tarea tendrá un punto de partida útil.',
    'Sigue conversando mientras avanza el trabajo',
    'Habla directamente con cada asistente o pide a uno que coordine a los demás. Puede transmitir tus preferencias, reunir resultados y plantearte las preguntas que requieran tu decisión.',
    'Añade requisitos, cambia prioridades e incorpora ayuda para una tarea distinta cuando haga falta. Los asistentes que ya están trabajando pueden seguir con su parte aplicando las decisiones actualizadas.',
    'En una aplicación o en varias',
    'Para el primer intercambio bastan dos chats de IA en una aplicación y un ordenador. Más adelante, conecta asistentes en otras aplicaciones de IA si allí están los modelos, las herramientas o los materiales que necesitas.',
    'NCF Agent Interconnect admite OpenCode v1, Codex Desktop, Cursor y AionUi con Cursor Agent. Los asistentes también pueden trabajar en distintos ordenadores de la misma red local. Cada uno sigue usando las capacidades de su propia aplicación.',
    'Configuración y diferencias entre aplicaciones',
    'Ten los materiales y mensajes a mano',
    'Los asistentes pueden enviar documentos, listas, cálculos y otros archivos con sus explicaciones. NCF Agent Interconnect conserva el historial de sus mensajes y de los archivos recibidos, incluso después de reiniciar.',
    'En la ventana de configuración y supervisión, comprueba las conexiones y la entrega de mensajes o abre los mensajes y archivos de un agente local. Puedes ver lo que se compartió y consultarlo más tarde.',
    'Configuración, supervisión e historial',
    'Ten claros los aspectos esenciales',
    'Los agentes trabajan en los chats. NCF Agent Interconnect entrega sus mensajes.',
    'Conecta tus chats',
    'Instala NCF Agent Interconnect, elige el archivo de configuración de tu aplicación, revisa los cambios y haz clic en Apply. Vuelve a conectar MCP y comprueba el intercambio de mensajes.',
    'Guía de configuración',
    'Conoce tu aplicación',
    'OpenCode v1, Codex Desktop, Cursor y AionUi con Cursor Agent tienen distintos comportamientos de entrega y requisitos de configuración.',
    'Detalles de las aplicaciones',
    'Controla tus datos',
    'Revisa los archivos adjuntos, el historial local, el chat exacto conectado, los traspasos de nombres y lo que se elimina al borrar datos.',
    'Configuración y supervisión',
    'Lee toda la documentación',
    'La guía de usuario y la referencia para modelos de lenguaje explican los pasos de trabajo y los límites de NCF Agent Interconnect.',
    'Abrir llms.txt',
    'Empieza con dos chats',
    'Pon nombre a los agentes. Envía un mensaje.',
    'Instala NCF Agent Interconnect, configura la conexión para la aplicación de IA elegida, conecta dos chats con nombres distintos y pide a un agente que contacte con el otro.',
    'Las descargas para macOS son DMG para Mac con Apple Silicon e Intel; Windows usa un EXE x64. Se requiere macOS 13 o posterior. El paquete para Mac Intel no se ha ejecutado en hardware Intel. No se publica un instalador para Linux.',
  ],
  development: [
    'Gestiona varias tareas de un proyecto — NCF Agent Interconnect',
    'Sigue a los asistentes de IA mientras gestionan juntos varias tareas de un proyecto en distintas aplicaciones y ordenadores.',
    'La historia más extensa',
    'Gestiona varias tareas de un proyecto',
    'Tus asistentes de IA pueden trabajar en distintas aplicaciones de IA, incluso en distintos ordenadores de la misma red local. Con NCF Agent Interconnect intercambian mensajes y archivos y se ayudan con tareas compartidas. Sigue hablando con ellos en tus chats habituales.',
    'Descubre cómo esto ayuda con varias tareas de un proyecto: desarrollar una función, revisar solicitudes de usuarios y corregir errores.',
  ],
  holiday: [
    'Organiza una fiesta — NCF Agent Interconnect',
    'Descubre cómo los asistentes de IA organizan juntos una fiesta e intercambian mensajes y archivos mediante NCF Agent Interconnect.',
    'Una historia ilustrativa',
    'Organiza una fiesta',
    'Empieza con una conversación normal con un asistente de IA. Cuando aparezca una tarea distinta, asígnasela a otro asistente. Cada uno tendrá su parte del trabajo y una conversación con los detalles que necesita. En esta historia todos trabajan en una aplicación de IA y un ordenador.',
    'Empieza por lo que ya estás hablando',
    'Estás organizando una fiesta en casa. Mientras comentas las actividades, también quieres calcular los gastos. Sigue planificando con el primer asistente y pide a un segundo que se encargue de los cálculos.',
    'Abre un segundo chat de IA para los gastos. Las ideas y preferencias quedan en una conversación, y los precios y cálculos en otra. Los asistentes pueden trabajar a la vez en sus respectivas partes.',
    'Pon nombre a los asistentes y preséntalos',
    'Primero configura NCF Agent Interconnect una vez para la aplicación de IA elegida. Después, los asistentes se conectan directamente desde sus chats.',
    'Amy y Ben son los nombres que has elegido. Ahora los asistentes pueden dirigirse entre sí por su nombre. Preséntalos con una petición normal.',
    'Deja que el trabajo de un asistente ayude a otro',
    'Amy propone un taller y envía a Ben una lista de materiales. Ben descubre que el taller cuesta demasiado y se lo dice a Amy.',
    'Amy cambia el plan y Ben actualiza el cálculo. Cada uno se encarga de una parte distinta, mientras acuerdan las decisiones juntos. Su trabajo se une en un único plan para la fiesta.',
    'Sigue hablando mientras avanza el trabajo',
    'Mientras los asistentes trabajan, te enteras de que también vendrán niños. Comenta enseguida las nuevas necesidades.',
    'Habla con cualquier asistente para aclarar requisitos, hacer preguntas o añadir trabajo. Si prefieres comentar todo con Amy, pídele que transmita los cambios a los demás y reúna sus resultados.',
    'Pide ayuda cuando la necesites',
    'Ahora toca planificar la comida. Abre otro chat para preparar el menú con Kate. Amy sigue con las actividades y Ben con los gastos.',
    'Un nuevo asistente se incorpora cuando aparece una parte independiente del trabajo. El menú, las actividades y los gastos tienen cada uno un responsable, y coordinan los detalles compartidos.',
    'Reúne el resultado',
    'Ahora tienes tres materiales que encajan: un plan para la fiesta, un menú con lista de la compra y una estimación de gastos. Comenta cada uno con su autor o sigue gestionándolo todo a través de Amy. Empieza con un asistente y añade otros según los necesites. Una aplicación de IA en un ordenador es suficiente.',
    'Plan de la fiesta',
    'Presupuesto de la fiesta',
    'Menú y compras',
    'Asistente de IA',
    'Tú',
    'Estás sentada ante un escritorio con un portátil.',
    'Agente {name} en la pantalla de una tableta.',
    'Fotogramas {frames} de {total}. {description}',
    'Un chat de IA normal antes de que se conecte un agente',
    'Chat del agente {name}',
    'Acciones ilustrativas de {name}',
    'Archivos de resultado ilustrativos',
    'Plan de la fiesta',
    'Menú y lista de la compra',
    'Estimación de gastos',
    'Tras hablar de tus preferencias, Kate prepara el menú y envía la lista de la compra a Ben.',
  ],
  holidayDialogue: [
    [
      'Ayúdame a organizar una fiesta en casa para diez invitados. El presupuesto total es de 20.000 rublos. Tenemos juegos de mesa en casa, pero también me gustaría considerar otras actividades.',
      'Prepararé algunas opciones de actividades y anotaré qué tendríamos que comprar para cada una.',
    ],
    [
      'Conéctate como agente Amy. Sigue planificando las actividades de la fiesta. Ben calculará los gastos: comenta con él lo que necesitamos.',
      'Conectada como agente Amy. Seguiré con el plan y prepararé una lista para la estimación de gastos.',
    ],
    [
      'Conéctate como agente Ben. Ayúdame con los gastos de la fiesta. Amy planifica las actividades: pregúntale qué necesita y acordad las compras.',
      'Conectado como agente Ben. Preguntaré a Amy qué hace falta para la fiesta y calcularé los gastos.',
    ],
    [
      'Estoy pensando en un taller para diez invitados. Aquí está la lista de materiales. Calcula cuánto quedaría para la comida del presupuesto total de 20.000 rublos.',
      'Con esos precios, los materiales consumirían demasiado presupuesto. Elige una actividad más barata para que quede suficiente para la comida.',
    ],
    [
      'Sustituiré el taller por los juegos que ya tenemos en casa. He actualizado el plan y la lista de la compra. Vuelve a calcular los gastos con la nueva lista.',
      'Volveré a calcular los gastos con la lista actualizada.',
    ],
    [
      'También vendrán cuatro niños: planea algo para ellos. Mantén el mismo presupuesto.',
      'Añadiré juegos para los niños y avisaré a Ben de que ahora habrá catorce invitados.',
    ],
    [
      'Ahora habrá catorce invitados, incluidos cuatro niños. Estoy añadiendo juegos para los niños. Revisa los gastos para el nuevo número de invitados; el presupuesto total no cambia.',
      'Tendré en cuenta a los invitados adicionales y revisaré los gastos. Mantendré el mismo presupuesto total.',
    ],
    [
      'Muéstrame cuánto queda para la comida y qué gastos todavía hay que comprobar.',
      'Revisaré la última estimación y enumeraré los gastos que aún hay que confirmar.',
    ],
    [
      'Conéctate como agente Kate. Ayúdame a preparar un menú y una lista de la compra. Pregunta a Amy qué necesitamos y acuerda los gastos con Ben. Antes de preparar el menú, pregúntame por mis preferencias de comida.',
      'Conectada como agente Kate. Te preguntaré por tus preferencias de comida antes de preparar el menú y pediré a Amy el número de invitados y el plan de la fiesta.',
    ],
    [
      'Yo me encargaré de la comida. ¿Cuántos invitados vendrán y cuándo planeáis hacer una pausa para comer?',
      'Habrá catorce invitados, incluidos cuatro niños. Aquí está el plan actual de la fiesta, con la pausa para comer marcada.',
    ],
    [
      'He preparado el menú según las preferencias que comentamos. Aquí tienes la lista de la compra. Úsala para estimar el coste de la comida y así trabajaremos con una sola lista.',
      'Incluiré estas compras en la estimación general.',
    ],
    [
      'Reúne el plan de la fiesta, el menú y la estimación de gastos. Pide a Ben y Kate sus últimas versiones. Muéstrame qué está listo y qué me queda por decidir.',
      'Pediré a Ben y Kate sus últimas versiones y reuniré el resultado.',
    ],
    [
      'Envía la última estimación de gastos. Enumera aparte las preguntas pendientes de decisión.',
      'Aquí está la estimación actual y la lista de gastos que aún hay que confirmar.',
    ],
    [
      'Envía el menú más reciente y la lista de la compra. Enumera aparte las preguntas pendientes de decisión.',
      'Aquí están el menú y la lista de la compra. He separado las preguntas pendientes.',
    ],
    [
      'He reunido el plan de la fiesta, el menú con la lista de la compra y la estimación de gastos. He separado las preguntas que requieren tu decisión.',
    ],
  ],
  holidayActivity: [
    'Con NCF Agent Interconnect',
    'Mensaje enviado',
    'Buscando opciones de actividades',
    'Anotando lo que necesitaremos',
    'Preparando la lista de materiales',
    'Actualizando la estimación de gastos',
    'Comprobando los gastos para catorce invitados',
    'Preparando el resumen de gastos',
    'Añadiendo la comida a la estimación de gastos',
  ],
};
window.NCF_SITE_COPY['pt-BR'] = {
  shared: [
    'Escolha uma história',
    'Histórias',
    'Como conectar seus assistentes',
    'Baixar NCF Agent Interconnect',
    'Documentação',
    'Mensagens e arquivos entre assistentes de IA.',
    'Depois da história',
  ],
  home: [
    'NCF Agent Interconnect — assistentes trabalhando juntos',
    'Dê a assistentes de IA partes de uma tarefa em comum. Deixe que troquem mensagens e arquivos, coordenem o trabalho e mantenham você envolvido.',
    'Dê aos seus assistentes de IA partes diferentes de uma mesma tarefa. Com NCF Agent Interconnect, eles podem trocar mensagens e arquivos, trabalhar ao mesmo tempo e coordenar suas decisões.',
    'Continue conversando com cada assistente ou peça a um deles que coordene os demais e converse sobre tudo com você. É possível esclarecer requisitos, acrescentar trabalho e mudar o rumo ao longo do processo.',
    'Veja como funciona',
    'Planeje uma festa',
    'Comece com uma conversa comum com uma IA. Traga ajuda para as atividades, os custos e a comida conforme precisar. Tudo em um aplicativo, em um computador.',
    'A protagonista da história da festa conversa com sua assistente diante de um notebook.',
    'Cuide de várias tarefas em um projeto',
    'Desenvolva um recurso, analise pedidos de usuários e corrija um bug. Os assistentes trabalham em aplicativos de IA diferentes e em computadores diferentes.',
    'A pessoa protagonista da história do projeto trabalha em um notebook.',
    'Mais formas de seus assistentes ajudarem',
    'As histórias mostram dois exemplos. A mesma troca pode ajudar com documentos, pesquisas, cálculos e tarefas do dia a dia. Você decide quem faz o quê e como os assistentes trabalham juntos.',
    'Trabalhe em várias tarefas ao mesmo tempo',
    'Um assistente reúne material, outro prepara um cálculo e um terceiro confere o resultado. Cada um tem uma conversa com os detalhes de que precisa. À medida que o trabalho avança, eles podem fazer perguntas uns aos outros e aproveitar o que já está pronto.',
    'Combine quem cuida de cada parte',
    'Peça aos assistentes que dividam o trabalho e avisem uns aos outros sobre mudanças. Eles podem combinar detalhes compartilhados, evitar trabalho duplicado e perceber quando suas decisões deixam de ser compatíveis.',
    'Revise e melhore um resultado',
    'Peça a outro assistente que confira um documento ou cálculo. Ele pode discutir as observações com o autor, receber uma versão revisada e conferi-la novamente. Você pode participar da conversa e decidir quando o resultado atende às suas necessidades.',
    'Consulte trabalhos anteriores',
    'Se você já discutiu um assunto relevante com outro assistente, peça à equipe que entre em contato com ele. Esse assistente pode explicar o que descobriu antes e compartilhar materiais que ainda tenha. A nova tarefa ganha um ponto de partida útil.',
    'Continue conversando enquanto o trabalho avança',
    'Fale diretamente com cada assistente ou peça a um deles que coordene os demais. Ele pode transmitir suas preferências, reunir resultados e trazer perguntas que dependem da sua decisão.',
    'Acrescente requisitos, mude prioridades e traga ajuda para uma tarefa separada quando precisar. Os assistentes que já estão trabalhando podem continuar suas partes com as decisões atualizadas.',
    'Em um aplicativo ou em vários',
    'Para uma primeira troca, bastam dois chats de IA em um aplicativo e um computador. Depois, conecte assistentes em outros aplicativos de IA se os modelos, ferramentas ou materiais de que você precisa estiverem lá.',
    'NCF Agent Interconnect oferece suporte a OpenCode v1, Codex Desktop, Cursor e AionUi com Cursor Agent. Os assistentes também podem trabalhar em computadores diferentes na mesma rede local. Cada um continua usando os recursos de seu próprio aplicativo.',
    'Configuração e diferenças entre aplicativos',
    'Mantenha materiais e mensagens à mão',
    'Os assistentes podem enviar documentos, listas, cálculos e outros arquivos com suas explicações. NCF Agent Interconnect mantém o histórico das mensagens e dos arquivos recebidos, inclusive após reinicializações.',
    'Na janela de configurações e monitoramento, confira as conexões e a entrega de mensagens ou abra as mensagens e os arquivos de um agente local. Você pode ver o que foi compartilhado e consultar isso depois.',
    'Configurações, monitoramento e histórico',
    'Mantenha o essencial claro',
    'Os agentes trabalham nos chats. NCF Agent Interconnect entrega as mensagens deles.',
    'Conecte seus chats',
    'Instale NCF Agent Interconnect, escolha o arquivo de configuração do seu aplicativo, revise as mudanças e clique em Apply. Reconecte o MCP e confira uma troca de mensagens.',
    'Guia de configuração',
    'Conheça seu aplicativo',
    'OpenCode v1, Codex Desktop, Cursor e AionUi com Cursor Agent têm comportamentos de entrega e requisitos de configuração diferentes.',
    'Detalhes dos aplicativos',
    'Controle seus dados',
    'Confira anexos, histórico local, o chat exato conectado, transferências de nome e o que a exclusão remove.',
    'Configurações e monitoramento',
    'Leia toda a documentação',
    'O guia do usuário e a referência para modelos de linguagem explicam as etapas de trabalho e os limites de NCF Agent Interconnect.',
    'Abrir llms.txt',
    'Comece com dois chats',
    'Dê nomes aos agentes. Envie uma mensagem.',
    'Instale NCF Agent Interconnect, configure a conexão para o aplicativo de IA escolhido, conecte dois chats com nomes diferentes e peça que um agente entre em contato com o outro.',
    'Os downloads para macOS estão disponíveis como DMG para Mac com Apple Silicon e Intel; no Windows, o instalador é um EXE x64. É necessário macOS 13 ou posterior. O pacote para Mac Intel não foi executado em hardware Intel. Não há instalador publicado para Linux.',
  ],
  development: [
    'Cuide de várias tarefas em um projeto — NCF Agent Interconnect',
    'Acompanhe assistentes de IA lidando juntos com várias tarefas de um projeto em diferentes aplicativos e computadores.',
    'A história mais longa',
    'Cuide de várias tarefas em um projeto',
    'Seus assistentes de IA podem trabalhar em aplicativos de IA diferentes, até mesmo em computadores diferentes na mesma rede local. Com NCF Agent Interconnect, eles trocam mensagens e arquivos e se ajudam em tarefas compartilhadas. Continue falando com eles nos seus chats habituais.',
    'Veja como isso ajuda com várias tarefas de um projeto: desenvolver um recurso, analisar pedidos de usuários e corrigir bugs.',
  ],
  holiday: [
    'Planeje uma festa — NCF Agent Interconnect',
    'Veja assistentes de IA planejando uma festa juntos e compartilhando mensagens e arquivos por meio de NCF Agent Interconnect.',
    'Uma história ilustrativa',
    'Planeje uma festa',
    'Comece com uma conversa comum com um assistente de IA. Quando surgir uma tarefa separada, passe-a a outro assistente. Cada um fica com sua parte do trabalho e uma conversa com os detalhes necessários. Nesta história, todos trabalham em um aplicativo de IA em um computador.',
    'Comece pelo que você já está discutindo',
    'Você está planejando uma festa em casa. Enquanto conversa sobre as atividades, também quer calcular os custos. Continue o planejamento com o primeiro assistente e peça a um segundo que cuide dos cálculos.',
    'Abra um segundo chat de IA para os custos. Ideias e preferências ficam em uma conversa, preços e cálculos em outra. Os assistentes podem trabalhar em suas partes ao mesmo tempo.',
    'Dê nomes aos assistentes e apresente-os',
    'Primeiro, configure NCF Agent Interconnect uma vez para o aplicativo de IA escolhido. Depois disso, os assistentes se conectam diretamente de seus chats.',
    'Amy e Ben são nomes que você escolheu. Agora os assistentes podem chamar um ao outro pelo nome. Apresente-os com um pedido comum.',
    'Deixe o trabalho de um assistente ajudar o outro',
    'Amy sugere uma oficina e envia a Ben uma lista de materiais. Ben percebe que a oficina custa caro demais e avisa Amy.',
    'Amy muda o plano e Ben atualiza o cálculo. Cada um cuida de uma parte diferente, enquanto combinam as decisões. O trabalho deles se une em um plano para a festa.',
    'Continue conversando enquanto o trabalho avança',
    'Enquanto os assistentes trabalham, você descobre que algumas crianças também virão. Converse logo sobre os novos requisitos.',
    'Fale com qualquer assistente para esclarecer requisitos, fazer perguntas ou acrescentar trabalho. Se preferir discutir tudo com Amy, peça a ela que repasse as mudanças aos outros e reúna os resultados.',
    'Traga ajuda quando precisar',
    'Agora é hora de planejar a comida. Abra outro chat para preparar o cardápio com Kate. Amy continua com as atividades e Ben com os custos.',
    'Um novo assistente participa quando surge uma parte separada do trabalho. Cardápio, atividades e custos têm cada um um responsável, que combina os detalhes compartilhados com os demais.',
    'Reúna o resultado',
    'Agora você tem três materiais que combinam entre si: um plano da festa, um cardápio com lista de compras e uma estimativa de custos. Converse sobre cada um com seu autor ou continue tratando de tudo por meio de Amy. Comece com um assistente e traga outros conforme precisar. Um aplicativo de IA em um computador é suficiente.',
    'Plano da festa',
    'Orçamento da festa',
    'Cardápio e compras',
    'Assistente de IA',
    'Você',
    'Você está sentada a uma mesa com um notebook.',
    'Agente {name} na tela de um tablet.',
    'Quadros {frames} de {total}. {description}',
    'Um chat de IA comum antes de um agente se conectar',
    'Chat do agente {name}',
    'Ações ilustrativas de {name}',
    'Arquivos de resultado ilustrativos',
    'Plano da festa',
    'Cardápio e lista de compras',
    'Estimativa de custos',
    'Depois de conversar sobre suas preferências, Kate prepara o cardápio e envia a lista de compras a Ben.',
  ],
  holidayDialogue: [
    [
      'Ajude-me a planejar uma festa em casa para dez convidados. O orçamento total da festa é de 20.000 rublos. Temos jogos de tabuleiro em casa, mas também gostaria de considerar outras atividades.',
      'Vou preparar algumas opções de atividades e listar o que precisaríamos comprar para cada uma.',
    ],
    [
      'Conecte-se como agente Amy. Continue planejando as atividades da festa. Ben vai calcular os custos; converse com ele sobre o que precisamos.',
      'Conectada como agente Amy. Vou continuar o planejamento e preparar uma lista para a estimativa de custos.',
    ],
    [
      'Conecte-se como agente Ben. Ajude com os custos da festa. Amy está planejando as atividades: pergunte a ela quais são os requisitos e combine as compras com ela.',
      'Conectado como agente Ben. Vou perguntar a Amy sobre os requisitos da festa e calcular os custos.',
    ],
    [
      'Estou pensando em uma oficina para dez convidados. Aqui está a lista de materiais. Calcule quanto sobraria para a comida do orçamento total de 20.000 rublos.',
      'Com esses preços, os materiais consumiriam uma parte grande demais do orçamento. Escolha uma atividade mais barata para sobrar o suficiente para a comida.',
    ],
    [
      'Vou substituir a oficina pelos jogos que já temos em casa. Atualizei o plano e a lista de compras. Recalcule os custos usando a nova lista.',
      'Vou recalcular os custos usando a lista atualizada.',
    ],
    [
      'Quatro crianças também virão; planeje algo para elas. Mantenha o mesmo orçamento.',
      'Vou acrescentar jogos para as crianças e avisar Ben que agora são quatorze convidados.',
    ],
    [
      'Agora são quatorze convidados, incluindo quatro crianças. Estou acrescentando jogos infantis. Confira os custos para o novo número de convidados; o orçamento total não mudou.',
      'Vou considerar os convidados adicionais e conferir os custos. Vou manter o mesmo orçamento total.',
    ],
    [
      'Mostre quanto sobra para a comida e quais custos ainda precisam ser conferidos.',
      'Vou conferir a estimativa mais recente e listar os custos que ainda precisam de confirmação.',
    ],
    [
      'Conecte-se como agente Kate. Ajude a preparar um cardápio e uma lista de compras. Pergunte a Amy sobre os requisitos e combine os custos com Ben. Antes de preparar o cardápio, pergunte-me sobre minhas preferências alimentares.',
      'Conectada como agente Kate. Vou perguntar sobre suas preferências alimentares antes de preparar o cardápio e consultar Amy sobre o número de convidados e o plano da festa.',
    ],
    [
      'Vou cuidar da comida. Quantos convidados virão e quando vocês planejam fazer uma pausa para comer?',
      'São quatorze convidados, incluindo quatro crianças. Aqui está o plano atual da festa, com a pausa para comer indicada.',
    ],
    [
      'Preparei o cardápio com base nas preferências que conversamos. Aqui está a lista de compras. Use-a para estimar o custo da comida, para trabalharmos com uma lista só.',
      'Vou incluir essas compras na estimativa geral.',
    ],
    [
      'Reúna o plano da festa, o cardápio e a estimativa de custos. Peça a Ben e Kate as versões mais recentes. Mostre o que está pronto e o que ainda preciso decidir.',
      'Vou pedir a Ben e Kate as versões mais recentes e reunir os resultados.',
    ],
    [
      'Envie a estimativa de custos mais recente. Liste separadamente as questões que ainda aguardam uma decisão.',
      'Aqui está a estimativa atual e a lista de custos que ainda precisam ser confirmados.',
    ],
    [
      'Envie o cardápio e a lista de compras mais recentes. Liste separadamente as questões que ainda aguardam uma decisão.',
      'Aqui estão o cardápio e a lista de compras. Listei as questões pendentes separadamente.',
    ],
    [
      'Reuni o plano da festa, o cardápio com a lista de compras e a estimativa de custos. Listei separadamente as questões que precisam da sua decisão.',
    ],
  ],
  holidayActivity: [
    'Usando NCF Agent Interconnect',
    'Mensagem enviada',
    'Buscando opções de atividades',
    'Listando o que vamos precisar',
    'Preparando a lista de materiais',
    'Atualizando a estimativa de custos',
    'Conferindo os custos para quatorze convidados',
    'Reunindo o resumo dos custos',
    'Acrescentando a comida à estimativa de custos',
  ],
};
window.NCF_SITE_COPY['pl'] = {
  shared: [
    'Wybierz historię',
    'Historie',
    'Jak połączyć asystentów',
    'Pobierz NCF Agent Interconnect',
    'Dokumentacja',
    'Wiadomości i pliki między asystentami AI.',
    'Po historii',
  ],
  home: [
    'NCF Agent Interconnect — asystenci pracują razem',
    'Powierz asystentom AI różne części wspólnego zadania. Pozwól im wymieniać wiadomości i pliki, koordynować pracę i informować Cię o postępach.',
    'Powierz swoim asystentom AI różne części jednego zadania. Dzięki NCF Agent Interconnect mogą wymieniać wiadomości i pliki, pracować równocześnie i uzgadniać decyzje.',
    'Rozmawiaj dalej z każdym asystentem albo poproś jednego z nich o koordynowanie pozostałych i omawianie wszystkiego z Tobą. W trakcie pracy możesz doprecyzowywać wymagania, dodawać zadania i zmieniać kierunek.',
    'Zobacz, jak to działa',
    'Zaplanuj przyjęcie',
    'Zacznij od zwykłej rozmowy z AI. W razie potrzeby włącz pomoc przy atrakcjach, kosztach i jedzeniu. Wszystko w jednej aplikacji na jednym komputerze.',
    'Bohaterka historii o przyjęciu rozmawia ze swoją asystentką przy laptopie.',
    'Prowadź kilka zadań w jednym projekcie',
    'Opracuj funkcję, przeanalizuj prośby użytkowników i napraw błąd. Asystenci pracują w różnych aplikacjach AI i na różnych komputerach.',
    'Bohater historii o projekcie pracuje przy laptopie.',
    'Więcej sposobów, w jakie asystenci mogą pomóc',
    'Historie pokazują dwa przykłady. Taka sama wymiana może pomóc przy dokumentach, badaniach, obliczeniach i codziennych zadaniach. Ty decydujesz, kto czym się zajmuje i jak asystenci współpracują.',
    'Pracuj nad kilkoma zadaniami naraz',
    'Jeden asystent zbiera materiały, drugi przygotowuje obliczenia, a trzeci sprawdza wynik. Każdy ma rozmowę ze szczegółami, których potrzebuje. W miarę postępu prac mogą zadawać sobie pytania i korzystać z tego, co już gotowe.',
    'Uzgodnij, kto zajmie się każdą częścią',
    'Poproś asystentów, by podzielili pracę i informowali się o zmianach. Mogą uzgadniać wspólne szczegóły, unikać powielania pracy i zauważać, gdy ich decyzje przestają do siebie pasować.',
    'Sprawdź i popraw wynik',
    'Przekaż dokument lub obliczenia innemu asystentowi do sprawdzenia. Może omówić uwagi z autorem, otrzymać poprawioną wersję i ponownie ją sprawdzić. Możesz dołączyć do rozmowy i zdecydować, kiedy wynik odpowiada Twoim potrzebom.',
    'Sięgnij do wcześniejszej pracy',
    'Jeśli wcześniej omawiałeś podobną kwestię z innym asystentem, poproś zespół o kontakt z nim. Może wyjaśnić swoje wcześniejsze ustalenia i udostępnić materiały, które nadal ma. Nowe zadanie zyska przydatny punkt wyjścia.',
    'Rozmawiaj dalej w trakcie pracy',
    'Rozmawiaj bezpośrednio z każdym asystentem albo poproś jednego o koordynację pozostałych. Może przekazywać Twoje preferencje, zbierać wyniki i przedstawiać pytania wymagające Twojej decyzji.',
    'W trakcie pracy dodawaj wymagania, zmieniaj priorytety i włączaj pomoc do osobnego zadania. Asystenci, którzy już pracują, mogą kontynuować swoje części zgodnie z nowymi ustaleniami.',
    'W jednej aplikacji lub w kilku',
    'Na początek wystarczą dwie rozmowy AI w jednej aplikacji na jednym komputerze. Później możesz połączyć asystentów w innych aplikacjach AI, jeśli tam znajdują się potrzebne modele, narzędzia lub materiały.',
    'NCF Agent Interconnect obsługuje OpenCode v1, Codex Desktop, Cursor i AionUi z Cursor Agent. Asystenci mogą też pracować na różnych komputerach w tej samej sieci lokalnej. Każdy nadal korzysta z możliwości swojej aplikacji.',
    'Konfiguracja i różnice między aplikacjami',
    'Miej materiały i wiadomości pod ręką',
    'Asystenci mogą wysyłać dokumenty, listy, obliczenia i inne pliki wraz z wyjaśnieniami. NCF Agent Interconnect przechowuje historię ich wiadomości oraz odebranych plików także po ponownym uruchomieniu.',
    'W oknie ustawień i monitorowania sprawdzaj połączenia i dostarczanie wiadomości albo otwieraj wiadomości i pliki lokalnego agenta. Możesz zobaczyć, co udostępniono, i wrócić do tego później.',
    'Ustawienia, monitorowanie i historia',
    'Pamiętaj o podstawach',
    'Agenci pracują w rozmowach. NCF Agent Interconnect dostarcza ich wiadomości.',
    'Połącz swoje rozmowy',
    'Zainstaluj NCF Agent Interconnect, wybierz plik konfiguracji swojej aplikacji, sprawdź zmiany i kliknij Apply. Połącz MCP ponownie i sprawdź wymianę wiadomości.',
    'Instrukcja konfiguracji',
    'Poznaj swoją aplikację',
    'OpenCode v1, Codex Desktop, Cursor i AionUi z Cursor Agent różnią się sposobem dostarczania wiadomości i wymaganiami konfiguracji.',
    'Szczegóły aplikacji',
    'Kontroluj swoje dane',
    'Sprawdź załączniki, historię lokalną, dokładnie połączoną rozmowę, przenoszenie nazw i zakres usuwania danych.',
    'Ustawienia i monitorowanie',
    'Przeczytaj pełną dokumentację',
    'Przewodnik użytkownika i dokumentacja dla modeli językowych wyjaśniają sposób pracy oraz ograniczenia NCF Agent Interconnect.',
    'Otwórz llms.txt',
    'Zacznij od dwóch rozmów',
    'Nadaj agentom nazwy. Wyślij wiadomość.',
    'Zainstaluj NCF Agent Interconnect, skonfiguruj połączenie dla wybranej aplikacji AI, połącz dwie rozmowy pod różnymi nazwami i poproś jednego agenta o kontakt z drugim.',
    'Pliki do pobrania dla macOS to DMG dla komputerów Mac z Apple Silicon i Intel; dla Windows dostępny jest EXE x64. Wymagany jest macOS 13 lub nowszy. Pakiet dla Maca Intel nie był uruchamiany na sprzęcie Intel. Nie opublikowano instalatora dla systemu Linux.',
  ],
  development: [
    'Prowadź kilka zadań w jednym projekcie — NCF Agent Interconnect',
    'Zobacz, jak asystenci AI wspólnie prowadzą kilka zadań projektowych w różnych aplikacjach i na różnych komputerach.',
    'Dłuższa historia',
    'Prowadź kilka zadań w jednym projekcie',
    'Twoi asystenci AI mogą pracować w różnych aplikacjach AI, nawet na różnych komputerach w tej samej sieci lokalnej. Dzięki NCF Agent Interconnect wymieniają wiadomości i pliki oraz pomagają sobie we wspólnych zadaniach. Rozmawiaj z nimi dalej w swoich zwykłych rozmowach.',
    'Zobacz, jak pomaga to przy kilku zadaniach jednego projektu: opracowywaniu funkcji, analizie próśb użytkowników i naprawianiu błędów.',
  ],
  holiday: [
    'Zaplanuj przyjęcie — NCF Agent Interconnect',
    'Zobacz, jak asystenci AI wspólnie planują przyjęcie, wymieniając wiadomości i pliki przez NCF Agent Interconnect.',
    'Przykładowa historia',
    'Zaplanuj przyjęcie',
    'Zacznij od zwykłej rozmowy z asystentem AI. Gdy pojawi się osobne zadanie, przekaż je innemu asystentowi. Każdy dostanie swoją część pracy i rozmowę z potrzebnymi szczegółami. W tej historii wszyscy pracują w jednej aplikacji AI na jednym komputerze.',
    'Zacznij od tego, o czym już rozmawiacie',
    'Planujesz przyjęcie w domu. Podczas rozmowy o atrakcjach chcesz również obliczyć koszty. Kontynuuj planowanie z pierwszym asystentem, a drugiego poproś o obliczenia.',
    'Otwórz drugą rozmowę AI poświęconą kosztom. Pomysły i preferencje zostają w jednej rozmowie, a ceny i obliczenia w drugiej. Asystenci mogą pracować nad swoimi częściami jednocześnie.',
    'Nadaj asystentom nazwy i przedstaw ich sobie',
    'Najpierw jednorazowo skonfiguruj NCF Agent Interconnect dla wybranej aplikacji AI. Potem asystenci połączą się bezpośrednio ze swoich rozmów.',
    'Amy i Ben to nazwy wybrane przez Ciebie. Teraz asystenci mogą zwracać się do siebie po imieniu. Przedstaw ich sobie zwykłą prośbą.',
    'Niech praca jednego asystenta pomoże drugiemu',
    'Amy proponuje warsztaty i wysyła listę materiałów agentowi Ben. Ben stwierdza, że warsztaty są zbyt drogie, i informuje Amy.',
    'Amy zmienia plan, a Ben aktualizuje obliczenia. Każdy odpowiada za inną część, ale decyzje uzgadniają wspólnie. Ich praca składa się na jeden plan przyjęcia.',
    'Rozmawiaj dalej w trakcie pracy',
    'Kiedy asystenci pracują, dowiadujesz się, że przyjdą też dzieci. Od razu omów nowe wymagania.',
    'Porozmawiaj z dowolnym asystentem, by doprecyzować wymagania, zadać pytania lub dodać pracę. Jeśli wolisz omawiać wszystko z Amy, poproś ją o przekazywanie zmian innym i zbieranie ich wyników.',
    'Włącz pomoc, kiedy będzie potrzebna',
    'Teraz pora zaplanować jedzenie. Otwórz kolejną rozmowę, by przygotować menu z Kate. Amy nadal zajmuje się atrakcjami, a Ben kosztami.',
    'Nowy asystent dołącza, gdy pojawia się osobna część pracy. Menu, atrakcje i koszty mają swoich odpowiedzialnych, którzy uzgadniają wspólne szczegóły.',
    'Zbierz wyniki w całość',
    'Masz teraz trzy pasujące do siebie materiały: plan przyjęcia, menu z listą zakupów i kosztorys. Omów każdy z jego autorem albo kontynuuj wszystko przez Amy. Zacznij od jednego asystenta i dodawaj kolejnych, kiedy będą potrzebni. Wystarczy jedna aplikacja AI na jednym komputerze.',
    'Plan przyjęcia',
    'Budżet przyjęcia',
    'Menu i zakupy',
    'Asystent AI',
    'Ty',
    'Siedzisz przy biurku z laptopem.',
    'Agent {name} na ekranie tabletu.',
    'Klatki {frames} z {total}. {description}',
    'Zwykła rozmowa AI przed połączeniem agenta',
    'Rozmowa agenta {name}',
    'Przykładowe działania {name}',
    'Przykładowe pliki wynikowe',
    'Plan przyjęcia',
    'Menu i lista zakupów',
    'Kosztorys',
    'Po omówieniu Twoich preferencji Kate przygotowuje menu i wysyła listę zakupów agentowi Ben.',
  ],
  holidayDialogue: [
    [
      'Pomóż mi zaplanować domowe przyjęcie dla dziesięciu gości. Budżet na całe przyjęcie to 20 000 rubli. Mamy w domu gry planszowe, ale chcę też rozważyć inne atrakcje.',
      'Przygotuję kilka propozycji atrakcji i wypiszę, co trzeba kupić do każdej z nich.',
    ],
    [
      'Połącz się jako agent Amy. Kontynuuj planowanie atrakcji na przyjęcie. Ben obliczy koszty — omów z nim, czego potrzebujemy.',
      'Połączono jako agent Amy. Będę dalej przygotowywać plan i listę do kosztorysu.',
    ],
    [
      'Połącz się jako agent Ben. Pomóż przy kosztach przyjęcia. Amy planuje atrakcje: zapytaj ją o wymagania i uzgodnij z nią zakupy.',
      'Połączono jako agent Ben. Zapytam Amy o potrzeby związane z przyjęciem i obliczę koszty.',
    ],
    [
      'Rozważam warsztaty dla dziesięciu gości. Oto lista materiałów. Oblicz, ile z całego budżetu 20 000 rubli zostałoby na jedzenie.',
      'Przy tych cenach materiały pochłonęłyby zbyt dużą część budżetu. Wybierz tańszą atrakcję, żeby wystarczyło na jedzenie.',
    ],
    [
      'Zastąpię warsztaty grami, które mamy już w domu. Zaktualizowałam plan i listę zakupów. Przelicz koszty według nowej listy.',
      'Przeliczę koszty na podstawie zaktualizowanej listy.',
    ],
    [
      'Przyjdzie też czworo dzieci — zaplanuj coś dla nich. Budżet pozostaje bez zmian.',
      'Dodam gry dla dzieci i powiem agentowi Ben, że będzie teraz czternaścioro gości.',
    ],
    [
      'Będzie teraz czternaścioro gości, w tym czworo dzieci. Dodaję gry dla dzieci. Sprawdź koszty dla nowej liczby gości; całkowity budżet się nie zmienia.',
      'Uwzględnię dodatkowych gości i sprawdzę koszty. Zachowam ten sam całkowity budżet.',
    ],
    [
      'Pokaż, ile zostało na jedzenie i które koszty trzeba jeszcze sprawdzić.',
      'Sprawdzę najnowszy kosztorys i wypiszę koszty, które wymagają potwierdzenia.',
    ],
    [
      'Połącz się jako agent Kate. Pomóż przygotować menu i listę zakupów. Zapytaj Amy o wymagania i uzgodnij koszty z agentem Ben. Zanim przygotujesz menu, zapytaj mnie o preferencje żywieniowe.',
      'Połączono jako agent Kate. Przed przygotowaniem menu zapytam o Twoje preferencje żywieniowe, a Amy o liczbę gości i plan przyjęcia.',
    ],
    [
      'Zajmę się jedzeniem. Ilu gości przyjdzie i kiedy planujecie przerwę na posiłek?',
      'Będzie czternaścioro gości, w tym czworo dzieci. Oto aktualny plan przyjęcia z zaznaczoną przerwą na posiłek.',
    ],
    [
      'Przygotowałam menu zgodnie z omówionymi preferencjami. Oto lista zakupów. Użyj jej do oszacowania kosztów jedzenia, abyśmy pracowali na jednej liście.',
      'Uwzględnię te zakupy w całkowitym kosztorysie.',
    ],
    [
      'Zbierz plan przyjęcia, menu i kosztorys. Poproś agenta Ben i agentkę Kate o najnowsze wersje. Pokaż, co jest gotowe i o czym muszę jeszcze zdecydować.',
      'Poproszę agenta Ben i agentkę Kate o najnowsze wersje i połączę wyniki.',
    ],
    [
      'Wyślij najnowszy kosztorys. Wypisz osobno pytania, które nadal czekają na decyzję.',
      'Oto aktualny kosztorys i lista kosztów, które wymagają potwierdzenia.',
    ],
    [
      'Wyślij najnowsze menu i listę zakupów. Wypisz osobno pytania, które nadal czekają na decyzję.',
      'Oto menu i lista zakupów. Pozostałe pytania wypisałam osobno.',
    ],
    [
      'Zebrałam plan przyjęcia, menu z listą zakupów oraz kosztorys. Osobno wypisałam pytania wymagające Twojej decyzji.',
    ],
  ],
  holidayActivity: [
    'Z użyciem NCF Agent Interconnect',
    'Wiadomość wysłana',
    'Szukanie pomysłów na atrakcje',
    'Wypisywanie potrzebnych rzeczy',
    'Przygotowywanie listy materiałów',
    'Aktualizowanie kosztorysu',
    'Sprawdzanie kosztów dla czternaściorga gości',
    'Tworzenie podsumowania kosztów',
    'Dodawanie jedzenia do kosztorysu',
  ],
};
window.NCF_SITE_COPY['nl'] = {
  shared: [
    'Kies een verhaal',
    'Verhalen',
    'Zo verbind je je assistenten',
    'Download NCF Agent Interconnect',
    'Documentatie',
    'Berichten en bestanden tussen AI-assistenten.',
    'Na het verhaal',
  ],
  home: [
    'NCF Agent Interconnect — assistenten die samenwerken',
    'Geef AI-assistenten elk een deel van een gezamenlijke taak. Laat ze berichten en bestanden uitwisselen, hun werk afstemmen en jou erbij betrekken.',
    'Geef je AI-assistenten verschillende delen van één taak. Met NCF Agent Interconnect kunnen ze berichten en bestanden uitwisselen, tegelijk werken en hun beslissingen afstemmen.',
    'Blijf met elke assistent praten, of vraag één assistent om de anderen te coördineren en bespreek alles met die assistent. Je kunt onderweg eisen verduidelijken, werk toevoegen en van koers veranderen.',
    'Bekijk hoe het werkt',
    'Plan een feest',
    'Begin met een gewone AI-chat. Schakel hulp in voor de activiteiten, de kosten en het eten wanneer je die nodig hebt. Alles in één toepassing op één computer.',
    'De hoofdpersoon uit het feestverhaal praat achter een laptop met haar assistent.',
    'Werk aan meerdere taken binnen één project',
    'Ontwikkel een functie, beoordeel gebruikersverzoeken en los een fout op. De assistenten werken in verschillende AI-toepassingen en op verschillende computers.',
    'De hoofdpersoon uit het projectverhaal werkt achter een laptop.',
    'Meer manieren waarop je assistenten kunnen helpen',
    'De verhalen laten twee voorbeelden zien. Dezelfde uitwisseling kan helpen bij documenten, onderzoek, berekeningen en alledaagse taken. Jij bepaalt wie wat doet en hoe de assistenten samenwerken.',
    'Werk aan meerdere taken tegelijk',
    'De ene assistent verzamelt materiaal, een andere maakt een berekening en een derde controleert het resultaat. Elke assistent heeft een gesprek met de details die nodig zijn. Tijdens het werk kunnen ze elkaar vragen stellen en gebruiken wat al klaar is.',
    'Spreek af wie welk deel uitvoert',
    'Vraag assistenten om het werk te verdelen en elkaar over veranderingen te informeren. Ze kunnen gezamenlijke details afstemmen, dubbel werk voorkomen en merken wanneer hun beslissingen niet meer op elkaar aansluiten.',
    'Controleer en verbeter een resultaat',
    'Geef een andere assistent een document of berekening om te controleren. Die kan bevindingen met de auteur bespreken, een aangepaste versie ontvangen en die opnieuw controleren. Je kunt aan dat gesprek deelnemen en bepalen wanneer het resultaat aan je wensen voldoet.',
    'Raadpleeg eerder werk',
    'Heb je een relevante vraag eerder met een andere assistent besproken, vraag het team dan contact met die assistent op te nemen. Die kan eerdere bevindingen toelichten en materiaal delen dat nog beschikbaar is. Zo krijgt de nieuwe taak een bruikbaar uitgangspunt.',
    'Blijf praten terwijl het werk doorgaat',
    'Praat rechtstreeks met elke assistent, of vraag één assistent om de anderen te coördineren. Die kan je voorkeuren doorgeven, resultaten verzamelen en vragen aan je voorleggen waarover jij moet beslissen.',
    'Voeg onderweg eisen toe, verander prioriteiten en schakel hulp in voor een aparte taak. Assistenten die al bezig zijn, kunnen hun deel met de bijgewerkte beslissingen voortzetten.',
    'In één toepassing — of meerdere',
    'Voor een eerste uitwisseling zijn twee AI-chats in één toepassing op één computer genoeg. Verbind later assistenten in andere AI-toepassingen als daar de modellen, hulpmiddelen of materialen beschikbaar zijn die je nodig hebt.',
    'NCF Agent Interconnect ondersteunt OpenCode v1, Codex Desktop, Cursor en AionUi met Cursor Agent. Assistenten kunnen ook op verschillende computers binnen hetzelfde lokale netwerk werken. Elke assistent blijft de mogelijkheden van de eigen toepassing gebruiken.',
    'Toepassingen instellen en hun verschillen',
    'Houd materialen en berichten binnen handbereik',
    'Assistenten kunnen documenten, lijsten, berekeningen en andere bestanden met hun uitleg meesturen. NCF Agent Interconnect bewaart de geschiedenis van hun berichten en ontvangen bestanden, ook na opnieuw opstarten.',
    'Controleer in het venster voor instellingen en monitoring de verbindingen en berichtbezorging, of open de berichten en bestanden van een lokale agent. Je kunt zien wat er is gedeeld en het later opnieuw bekijken.',
    'Instellingen, monitoring en geschiedenis',
    'Houd de basis duidelijk',
    'Agenten werken in chats. NCF Agent Interconnect bezorgt hun berichten.',
    'Verbind je chats',
    'Installeer NCF Agent Interconnect, kies het configuratiebestand voor je toepassing, bekijk de wijzigingen en klik op Apply. Verbind MCP opnieuw en controleer een berichtenuitwisseling.',
    'Installatiehandleiding',
    'Ken je toepassing',
    'OpenCode v1, Codex Desktop, Cursor en AionUi met Cursor Agent verschillen in berichtbezorging en vereiste instellingen.',
    'Details per toepassing',
    'Beheer je gegevens',
    'Bekijk bijlagen, de lokale geschiedenis, de exact verbonden chat, het overdragen van namen en welke gegevens bij verwijdering verdwijnen.',
    'Instellingen en monitoring',
    'Lees de volledige documentatie',
    'De gebruikershandleiding en de referentie voor taalmodellen leggen de werkwijze en beperkingen van NCF Agent Interconnect uit.',
    'Open llms.txt',
    'Begin met twee chats',
    'Geef de agenten namen. Stuur een bericht.',
    'Installeer NCF Agent Interconnect, stel de verbinding voor je gekozen AI-toepassing in, verbind twee chats onder verschillende namen en vraag de ene agent om contact op te nemen met de andere.',
    'Voor macOS zijn DMG-bestanden voor Apple Silicon en Intel Mac beschikbaar; Windows gebruikt een x64 EXE. macOS 13 of nieuwer is vereist. Het Intel Mac-pakket is niet op Intel-hardware uitgevoerd. Er is geen Linux-installatiepakket gepubliceerd.',
  ],
  development: [
    'Werk aan meerdere taken binnen één project — NCF Agent Interconnect',
    'Volg AI-assistenten die samen aan verschillende projecttaken werken, verspreid over toepassingen en computers.',
    'Het langere verhaal',
    'Werk aan meerdere taken binnen één project',
    'Je AI-assistenten kunnen in verschillende AI-toepassingen werken, zelfs op verschillende computers binnen hetzelfde lokale netwerk. Met NCF Agent Interconnect wisselen ze berichten en bestanden uit en helpen ze elkaar bij gezamenlijke taken. Blijf met ze praten in je gebruikelijke chats.',
    'Bekijk hoe dit helpt bij verschillende taken binnen één project: een functie ontwikkelen, gebruikersverzoeken beoordelen en fouten oplossen.',
  ],
  holiday: [
    'Plan een feest — NCF Agent Interconnect',
    'Bekijk hoe AI-assistenten samen een feest plannen en berichten en bestanden uitwisselen via NCF Agent Interconnect.',
    'Een voorbeeldverhaal',
    'Plan een feest',
    'Begin met een gewoon gesprek met een AI-assistent. Geef een aparte taak aan een andere assistent wanneer die zich aandient. Elke assistent krijgt een eigen deel van het werk en een gesprek met de benodigde details. Iedereen in dit verhaal werkt in één AI-toepassing op één computer.',
    'Begin bij wat je al bespreekt',
    'Je plant een feest thuis. Terwijl je de activiteiten bespreekt, wil je ook de kosten berekenen. Blijf met de eerste assistent plannen en vraag een tweede assistent om de berekeningen te doen.',
    'Open een tweede AI-chat voor de kosten. Ideeën en voorkeuren blijven in het ene gesprek, prijzen en berekeningen in het andere. De assistenten kunnen tegelijk aan hun eigen deel werken.',
    'Geef de assistenten namen en stel ze aan elkaar voor',
    'Stel NCF Agent Interconnect eerst eenmalig in voor je gekozen AI-toepassing. Daarna verbinden assistenten zich rechtstreeks vanuit hun chats.',
    'Amy en Ben zijn namen die jij hebt gekozen. Nu kunnen de assistenten elkaar bij naam aanspreken. Stel ze met een gewoon verzoek aan elkaar voor.',
    'Laat het werk van de ene assistent de andere helpen',
    'Amy stelt een workshop voor en stuurt Ben een materialenlijst. Ben merkt dat de workshop te duur is en laat dat aan Amy weten.',
    'Amy past het plan aan en Ben werkt de berekening bij. Ieder voert een ander deel uit, terwijl ze samen beslissingen afstemmen. Hun werk komt samen in één feestplan.',
    'Blijf praten terwijl het werk doorgaat',
    'Terwijl de assistenten bezig zijn, hoor je dat er ook kinderen komen. Bespreek de nieuwe eisen meteen.',
    'Praat met elke assistent om eisen te verduidelijken, vragen te stellen of werk toe te voegen. Bespreek je liever alles met Amy, vraag haar dan wijzigingen aan de anderen door te geven en hun resultaten te verzamelen.',
    'Schakel hulp in wanneer je die nodig hebt',
    'Nu is het tijd om het eten te plannen. Open een andere chat om samen met Kate een menu te maken. Amy gaat verder met de activiteiten en Ben met de kosten.',
    'Een nieuwe assistent sluit aan wanneer er een apart stuk werk bijkomt. Het menu, de activiteiten en de kosten hebben elk een verantwoordelijke, en zij stemmen gezamenlijke details af.',
    'Breng het resultaat samen',
    'Je hebt nu drie onderdelen die op elkaar aansluiten: een feestplan, een menu met boodschappenlijst en een kostenraming. Bespreek elk onderdeel met de auteur, of blijf alles via Amy regelen. Begin met één assistent en schakel anderen in wanneer je ze nodig hebt. Eén AI-toepassing op één computer is genoeg.',
    'Feestplan',
    'Feestbudget',
    'Menu en boodschappen',
    'AI-assistent',
    'Jij',
    'Jij aan een bureau met een laptop.',
    'Agent {name} op een tabletscherm.',
    'Beelden {frames} van {total}. {description}',
    'Een gewone AI-chat voordat een agent verbinding maakt',
    'Chat van agent {name}',
    'Voorbeeldacties van {name}',
    'Voorbeeldbestanden met resultaten',
    'Feestplan',
    'Menu en boodschappenlijst',
    'Kostenraming',
    'Na het bespreken van je voorkeuren maakt Kate het menu en stuurt ze de boodschappenlijst naar Ben.',
  ],
  holidayDialogue: [
    [
      'Help me een feest thuis te plannen voor tien gasten. Het budget voor het hele feest is 20.000 roebel. We hebben thuis bordspellen, maar ik wil ook andere activiteiten bekijken.',
      'Ik zal een paar activiteiten voorstellen en voor elke optie opsommen wat we moeten kopen.',
    ],
    [
      'Maak verbinding als agent Amy. Ga verder met het plannen van de feestactiviteiten. Ben berekent de kosten — bespreek met hem wat we nodig hebben.',
      'Verbonden als agent Amy. Ik ga verder met het plan en maak een lijst voor de kostenraming.',
    ],
    [
      'Maak verbinding als agent Ben. Help met de kosten van het feest. Amy plant de activiteiten: vraag haar wat er nodig is en stem de aankopen met haar af.',
      'Verbonden als agent Ben. Ik vraag Amy wat er voor het feest nodig is en bereken de kosten.',
    ],
    [
      'Ik overweeg een workshop voor tien gasten. Hier is de materialenlijst. Bereken hoeveel er van het totale budget van 20.000 roebel overblijft voor eten.',
      'Bij deze prijzen nemen de materialen te veel van het budget in beslag. Kies een goedkopere activiteit, zodat er genoeg overblijft voor eten.',
    ],
    [
      'Ik vervang de workshop door spellen die we al thuis hebben. Ik heb het plan en de boodschappenlijst bijgewerkt. Bereken de kosten opnieuw met de nieuwe lijst.',
      'Ik bereken de kosten opnieuw met de bijgewerkte lijst.',
    ],
    [
      'Er komen ook vier kinderen — plan ook iets voor hen. Houd hetzelfde budget aan.',
      'Ik voeg kinderspellen toe en laat Ben weten dat er nu veertien gasten zijn.',
    ],
    [
      'Er zijn nu veertien gasten, onder wie vier kinderen. Ik voeg kinderspellen toe. Controleer de kosten voor het nieuwe aantal gasten; het totale budget blijft gelijk.',
      'Ik houd rekening met de extra gasten en controleer de kosten. Het totale budget blijft hetzelfde.',
    ],
    [
      'Laat zien hoeveel er overblijft voor eten en welke kosten nog moeten worden gecontroleerd.',
      'Ik controleer de laatste raming en som de kosten op die nog moeten worden bevestigd.',
    ],
    [
      'Maak verbinding als agent Kate. Help een menu en boodschappenlijst te maken. Vraag Amy naar de eisen en stem de kosten af met Ben. Vraag me naar eetvoorkeuren voordat je het menu maakt.',
      'Verbonden als agent Kate. Ik vraag naar je eetvoorkeuren voordat ik het menu maak, en vraag Amy naar het aantal gasten en het feestplan.',
    ],
    [
      'Ik regel het eten. Hoeveel gasten komen er, en wanneer plan je een eetpauze?',
      'Er zijn veertien gasten, onder wie vier kinderen. Hier is het huidige feestplan, met de eetpauze aangegeven.',
    ],
    [
      'Ik heb het menu gemaakt met de voorkeuren die we hebben besproken. Hier is de boodschappenlijst. Gebruik die voor de kostenraming van het eten, zodat we met één lijst werken.',
      'Ik neem deze aankopen op in de totale raming.',
    ],
    [
      'Breng het feestplan, het menu en de kostenraming samen. Vraag Ben en Kate om hun laatste versies. Laat zien wat klaar is en waarover ik nog moet beslissen.',
      'Ik vraag Ben en Kate om de laatste versies en breng het resultaat samen.',
    ],
    [
      'Stuur de laatste kostenraming. Vermeld vragen die nog op een beslissing wachten apart.',
      'Hier is de huidige raming met de lijst van kosten die nog moeten worden bevestigd.',
    ],
    [
      'Stuur het laatste menu en de laatste boodschappenlijst. Vermeld vragen die nog op een beslissing wachten apart.',
      'Hier zijn het menu en de boodschappenlijst. Ik heb de openstaande vragen apart vermeld.',
    ],
    [
      'Ik heb het feestplan, het menu met boodschappenlijst en de kostenraming samengebracht. De vragen waarover jij moet beslissen staan apart vermeld.',
    ],
  ],
  holidayActivity: [
    'NCF Agent Interconnect gebruiken',
    'Bericht verzonden',
    'Activiteiten zoeken',
    'Opsommen wat we nodig hebben',
    'De materialenlijst maken',
    'De kostenraming bijwerken',
    'Kosten voor veertien gasten controleren',
    'Het kostenoverzicht samenstellen',
    'Eten aan de kostenraming toevoegen',
  ],
};
