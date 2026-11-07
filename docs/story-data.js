const NCF_SEND_STATUS = {
  kind: 'send',
  lines: [
    ['Using NCF Agent Interconnect', 'Использую NCF Agent Interconnect'],
    ['Message sent', 'Сообщение отправлено']
  ]
};
const NCF_WORK_STATUS = (...lines) => ({ kind: 'work', lines });

window.NCF_STORY = {
  scenes: [
    {
      id: 1, image: 1, pair: ['user', 'morgan'],
      title: ['Give the work a coordinator', 'Назначьте координатора'],
      lines: [[
        'user',
        'Connect as agent Morgan. Use the coordination skill to coordinate all agents and keep track of the work as a whole. Send each participant your working rules. Coordinate work boundaries, Git branches, the order of implementation and integration, and conflict resolution. Put agents in touch when their work overlaps, arrange knowledge sharing, and keep them informed of relevant decisions and changes. Keep independent tasks moving in parallel. Bring me consolidated results and decisions that need my input.',
        'Подключись как агент Morgan. Используй навык coordination: координируй всех агентов и следи за ходом работы в целом. Передай каждому участнику мои правила работы. Согласовывай зоны ответственности, ветки Git, порядок реализации и интеграции, разрешай конфликты. Когда задачи пересекаются, своди агентов друг с другом, организуй обмен знаниями и сообщай им о решениях и изменениях, которые их касаются. Следи, чтобы независимые задачи продвигались параллельно. Собирай результаты в общую сводку и отдельно отмечай вопросы, по которым нужно моё решение.'
      ], [
        'morgan',
        'Connected as agent Morgan. I will coordinate the agents, track their work and bring you results and decisions that need your input.',
        'Подключилась как агент Morgan. Буду координировать агентов, следить за ходом работы и выносить на ваше решение важные вопросы.'
      ]],
      statuses: NCF_WORK_STATUS(['Preparing coordination rules', 'Готовлю правила координации'])
    },
    {
      id: 2, image: 7, pair: ['user', 'jade'],
      title: ['Connect the Windows specialist', 'Подключите агента для Windows'],
      lines: [[
        'user',
        'Connect as agent Jade. You are responsible for verifying this project on Windows. Morgan coordinates the work; ask her for instructions.',
        'Подключись как агент Jade. Ты отвечаешь за проверку проекта на Windows. Координатор — Morgan; запрашивай у неё инструкции.'
      ], [
        'jade',
        'Connected as agent Jade. I am responsible for Windows verification. I will tell Morgan my role and ask for instructions.',
        'Подключилась как агент Jade. Отвечаю за проверки проекта на Windows. Сообщу о своей роли координатору Morgan и запрошу инструкции.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 3, pair: ['jade', 'morgan'],
      title: ['Morgan learns who handles Windows', 'Morgan узнаёт роль Jade'],
      lines: [[
        'jade',
        'Connected as agent Jade. I handle project verification on Windows and am ready for your instructions.',
        'Подключилась как агент Jade. Отвечаю за проверку проекта на Windows и готова получать поручения.'
      ], [
        'morgan',
        'Received. I will route Windows checks to you and coordinate the results.',
        'Приняла. Буду поручать тебе проверки на Windows и собирать результаты.'
      ]],
      statuses: NCF_WORK_STATUS(['Adding Jade to the Windows verification plan', 'Включаю Jade в план проверок на Windows'])
    },
    {
      id: 4, image: 2, pair: ['user', 'morgan'],
      title: ['Make independent checking a rule', 'Введите независимое тестирование'],
      lines: [[
        'user',
        'Send every task reported as complete to another agent for independent testing, using checks appropriate to the result. Name the agent who did the work and ask the tester to coordinate any fixes directly with them. The tester must report the checks, outcome and remaining issues to you. Accept the task only after the tester confirms it passes.',
        'Каждую задачу, которую исполнитель считает завершённой, передавай другому агенту на независимое тестирование. Проверки выбирай по характеру результата. Назови исполнителя и попроси тестировщика согласовывать исправления напрямую с ним. Тестировщик должен сообщить, что именно проверил, каков результат и какие проблемы остались. Принимай задачу только после того, как тестировщик подтвердит, что проверка пройдена.'
      ], [
        'morgan',
        'Understood. I will send each task reported as complete to another agent for independent testing.',
        'Приняла. Каждую задачу, о завершении которой сообщит исполнитель, передам другому агенту на независимую проверку.'
      ]],
      statuses: NCF_WORK_STATUS(['Setting the independent check rule', 'Закрепляю правило независимой проверки'])
    },
    {
      id: 5, image: 8, pair: ['user', 'leo'],
      title: ['Connect an implementation agent', 'Подключите агента для разработки'],
      lines: [[
        'user',
        'Connect as agent Leo. Your role is implementation. Morgan coordinates the work; ask her for instructions.',
        'Подключись как агент Leo. Твоя роль — разработка. Координатор — Morgan; запрашивай у неё инструкции.'
      ], [
        'leo',
        'Connected as agent Leo. I handle implementation. I will tell Morgan my role and ask for an assignment.',
        'Подключился как агент Leo. Отвечаю за разработку. Сообщу о своей роли координатору Morgan и запрошу задачу.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 6, image: 2, pair: ['user', 'morgan'],
      title: ['Describe the feature to Morgan', 'Расскажите Morgan о новой функции'],
      lines: [[
        'user',
        'Task #T-1042 is saved filters that let users reuse their search conditions. Organize the implementation while the other work continues.',
        'Задача #T-1042 — сохранённые фильтры, чтобы пользователи могли повторно применять условия поиска. Организуй разработку, не останавливая другие направления.'
      ], [
        'morgan',
        'Leo will implement #T-1042 in his own chat. I will track the work and arrange an independent check when he reports it complete.',
        'Разработку #T-1042 поручу Leo в его отдельном чате. Буду следить за ходом работы и назначу независимую проверку, когда он сообщит о завершении.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 7, pair: ['morgan', 'leo'],
      title: ['Leo receives the feature', 'Leo получает задачу о фильтрах'],
      lines: [[
        'morgan',
        'Use the implementation skill for task #T-1042: build saved filters so users can reuse their search conditions. Keep this work separate from other tasks and report your result to me.',
        'Используй навык implementation для задачи #T-1042: реализуй сохранённые фильтры, чтобы пользователи могли повторно применять условия поиска. Веди эту работу отдельно от других задач и сообщи мне результат.'
      ], [
        'leo',
        'I will take #T-1042 and first inspect how search conditions work now.',
        'Возьму #T-1042. Сначала разберусь, как сейчас устроены условия поиска.'
      ]],
      statuses: NCF_WORK_STATUS(['Reviewing the current search implementation', 'Изучаю текущую реализацию поиска'], ['Planning saved-filter behavior', 'Продумываю работу сохранённых фильтров'])
    },
    {
      id: 8, image: 4, pair: ['user', 'alice'],
      title: ['Connect an analysis agent', 'Подключите агента для анализа'],
      lines: [[
        'user',
        'Connect as agent Alice. Your role is analysis. Morgan coordinates the work; ask her for instructions.',
        'Подключись как агент Alice. Твоя роль — анализ запросов. Координатор — Morgan; запрашивай у неё инструкции.'
      ], [
        'alice',
        'Connected as agent Alice. I handle request analysis. I will tell Morgan my role and ask for instructions.',
        'Подключилась как агент Alice. Отвечаю за анализ запросов. Сообщу о своей роли координатору Morgan и запрошу инструкции.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 9, image: 11, pair: ['user', 'morgan'],
      title: ['Bring related requests to Morgan', 'Передайте Morgan связанные запросы'],
      lines: [[
        'user',
        'Requests #I-0201 and #I-0202 may describe the same need. Find the underlying user problem, check the existing search screen in Figma and relate the finding to #T-1042.',
        'Запросы #I-0201 и #I-0202, возможно, связаны одной потребностью. Выясни, что нужно пользователям, сверься с существующим экраном поиска в Figma и соотнеси вывод с задачей #T-1042.'
      ], [
        'morgan',
        'Alice will analyse both requests and the Figma screen. I will put her in touch with Leo so the finding reaches the saved-filter work.',
        'Анализ запросов и экрана в Figma поручу Alice. Свяжу её с Leo, чтобы вывод попал в работу над сохранёнными фильтрами.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 10, pair: ['morgan', 'alice'],
      title: ['Alice investigates the need', 'Alice исследует потребность пользователей'],
      lines: [[
        'morgan',
        'Use the analysis skill to review issues #I-0201 and #I-0202. Check the existing search screen in Figma, identify the underlying user need and share relevant findings with Leo.',
        'Используй навык analysis: разбери запросы #I-0201 и #I-0202, изучи существующий экран поиска в Figma, выясни потребность пользователей и передай важные выводы Leo.'
      ], [
        'alice',
        'I will compare both requests with the current screen, then send Leo the finding.',
        'Сопоставлю оба запроса с текущим экраном, затем передам вывод Leo.'
      ]],
      statuses: NCF_WORK_STATUS(['Reading both requests', 'Изучаю оба запроса'], ['Checking the search screen in Figma', 'Сверяю экран поиска в Figma'])
    },
    {
      id: 11, pair: ['alice', 'leo'],
      title: ['Let the finding reach the working chat', 'Вывод попадает прямо в рабочий чат'],
      lines: [
        ['alice', 'Issues #I-0201 and #I-0202 are about reusing the same search conditions. Can task #T-1042 preserve the full combination?', 'Запросы #I-0201 и #I-0202 — о том, как повторно использовать одни и те же условия поиска. Можно ли в рамках #T-1042 сохранять весь набор условий?'],
        ['leo', 'Yes. Check whether users also need to share them; I will keep that separate from task #T-1042.', 'Да. Выясни, нужно ли пользователям ещё и делиться этими условиями. Я выделю это в отдельный вопрос, за рамками задачи #T-1042.']
      ],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 12, image: 10, pair: ['user', 'morgan'],
      title: ['A Windows bug changes the plan', 'Ошибка на Windows меняет план'],
      lines: [[
        'user',
        'Import fails on Windows. I am attaching the import file that triggers bug #B-0317. Investigate the problem and report what you find.',
        'На Windows не работает импорт. Прикладываю файл импорта, на котором проявляется ошибка #B-0317. Разберись в проблеме и сообщи, что удалось выяснить.'
      ], [
        'morgan',
        'Jade will reproduce #B-0317 on Windows and send me the steps and evidence. If the bug is confirmed, I will organise the fix and an independent check.',
        'Jade воспроизведёт #B-0317 на Windows и пришлёт шаги и подтверждающие материалы. Если ошибка подтвердится, организую исправление и независимую проверку.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 13, pair: ['morgan', 'jade'],
      title: ['Jade checks the Windows bug', 'Jade проверяет ошибку на Windows'],
      lines: [[
        'morgan',
        'Use the verification skill to reproduce bug #B-0317 on Windows with the attached import file. Send me the reproduction steps and evidence.',
        'Используй навык verification: воспроизведи ошибку #B-0317 на Windows с приложенным файлом импорта. Пришли шаги воспроизведения и подтверждающие материалы.'
      ], [
        'jade',
        'I will check the import and send you the result.',
        'Проверю импорт и пришлю результат.'
      ]],
      statuses: NCF_WORK_STATUS(['Opening the import file', 'Открываю файл импорта'], ['Checking import on Windows', 'Проверяю импорт на Windows'])
    },
    {
      id: 14, pair: ['jade', 'morgan'],
      title: ['Evidence reaches the coordinator', 'Jade передаёт результаты координатору'],
      lines: [[
        'jade',
        'The Windows import fails. Here are the reproduction steps and evidence for #B-0317.',
        'Импорт на Windows завершается ошибкой. Передаю шаги воспроизведения и материалы по #B-0317.'
      ], [
        'morgan',
        'Received. I will report the result and keep the evidence for the fix owner.',
        'Приняла. Сообщу результат пользователю и сохраню материалы для исполнителя исправления.'
      ]],
      statuses: NCF_WORK_STATUS(['Preparing the bug report', 'Готовлю отчёт об ошибке'])
    },
    {
      id: 15, image: 9, pair: ['user', 'sam'],
      title: ['Connect another developer', 'Подключите ещё одного разработчика'],
      lines: [[
        'user',
        'Connect as agent Sam. Your role is implementation. Morgan coordinates the work; ask her for instructions.',
        'Подключись как агент Sam. Твоя роль — разработка. Координатор — Morgan; запрашивай у неё инструкции.'
      ], [
        'sam',
        'Connected as agent Sam. I handle implementation. I will tell Morgan my role and ask for an assignment.',
        'Подключился как агент Sam. Отвечаю за разработку. Сообщу о своей роли координатору Morgan и запрошу задачу.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 16, image: 8, pair: ['morgan', 'user'],
      title: ['The result changes the priority', 'Результат меняет приоритет'],
      lines: [
        ['morgan', 'Jade reproduced #B-0317 on Windows and sent the steps and evidence. The import failure is confirmed.', 'Jade воспроизвела #B-0317 на Windows и прислала шаги с подтверждающими материалами. Ошибка импорта подтверждена.'],
        ['user', 'This bug blocks daily work. Release the fix for #B-0317 first. If task #T-1042 is not ready, it can follow in the next release. Keep that work moving.', 'Ошибка мешает повседневной работе. Сначала выпустим исправление #B-0317. Если задача #T-1042 не успеет к релизу, её можно перенести на следующий. Работу над ней не останавливай.'],
        ['morgan', 'Understood. Sam will fix #B-0317, and Jade will check it independently on Windows. I will keep #T-1042 moving separately.', 'Приняла. Исправление #B-0317 поручу Sam, независимую проверку на Windows — Jade. Работа над #T-1042 продолжится отдельно.']
      ],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 17, pair: ['morgan', 'sam'],
      title: ['Sam receives the fix', 'Sam получает задачу на исправление'],
      lines: [[
        'morgan',
        'Use the implementation skill to fix bug #B-0317. Jade reproduced it on Windows; here are her steps and evidence. Keep the fix separate from #T-1042 and coordinate any verification details directly with Jade.',
        'Используй навык implementation для исправления ошибки #B-0317. Jade воспроизвела её на Windows; передаю её шаги и материалы. Держи исправление отдельно от #T-1042, детали проверки согласовывай с Jade напрямую.'
      ], [
        'sam',
        'I will investigate #B-0317, prepare the fix and send a candidate for independent testing.',
        'Разберусь с #B-0317, подготовлю исправление и передам вариант на независимую проверку.'
      ]],
      statuses: NCF_WORK_STATUS(['Reviewing the reproduction steps', 'Изучаю шаги воспроизведения'], ['Checking the import code', 'Проверяю код импорта'])
    },
    {
      id: 18, image: 10, pair: ['user', 'morgan'],
      title: ['Recall an earlier investigation', 'Вернитесь к прежнему исследованию'],
      lines: [[
        'user',
        'An earlier import investigation in task #T-0870 may help with #B-0317. Find the previous decisions and any relevant examples.',
        'В задаче #T-0870 уже исследовали работу импорта. Найди прежние решения и примеры, которые помогут разобраться с #B-0317.'
      ], [
        'morgan',
        'Oscar worked on #T-0870. I will ask him for the decisions and examples, then share them with Sam and Jade.',
        'Задачей #T-0870 занимался Oscar. Запрошу у него решения и примеры, а затем передам их Sam и Jade.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 19, pair: ['morgan', 'oscar'],
      title: ['Morgan asks for earlier knowledge', 'Morgan запрашивает прежние наработки'],
      lines: [[
        'morgan',
        'You investigated import in task #T-0870. Please recover the previous decisions and any examples relevant to bug #B-0317, then share them with Sam and Jade.',
        'Ты исследовал работу импорта в задаче #T-0870. Подними прежние решения и примеры, которые помогут с ошибкой #B-0317, затем передай их Sam и Jade.'
      ], [
        'oscar',
        'I will review the available history and materials, then send the relevant examples.',
        'Подниму доступную историю и материалы, затем передам подходящие примеры.'
      ]],
      statuses: NCF_WORK_STATUS(['Reviewing task #T-0870', 'Изучаю материалы задачи #T-0870'])
    },
    {
      id: 20, pair: ['oscar', 'sam'],
      title: ['Earlier decisions reach the developer', 'Sam получает прежние решения'],
      lines: [
        ['oscar', 'I found the earlier import decisions and examples. Sending them to you.', 'Нашёл прежние решения по импорту и примеры. Передаю их тебе.'],
        ['sam', 'Received. I will use them in the fix.', 'Принял. Учту их при исправлении.']
      ],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 21, pair: ['oscar', 'jade'],
      title: ['The same examples reach the tester', 'Jade получает примеры для проверки'],
      lines: [
        ['oscar', 'The same import examples may help your Windows check. Sending them over.', 'Передаю тебе те же примеры импорта для проверки на Windows.'],
        ['jade', 'Received. I will include them in the checks.', 'Приняла. Добавлю их в проверку.']
      ],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 22, image: 13, pair: [],
      title: ['Meanwhile, work continues', 'Пока агенты работают'],
      lines: []
    },
    {
      id: 23, pair: ['sam', 'morgan'],
      title: ['The first candidate is ready', 'Первый вариант исправления готов'],
      lines: [[
        'sam',
        'Bug #B-0317 is fixed. Here is the candidate for independent testing.',
        'Ошибка #B-0317 исправлена. Передаю вариант исправления на независимое тестирование.'
      ], [
        'morgan',
        'Received. I will ask Jade for an independent Windows check.',
        'Приняла. Поручу Jade независимую проверку на Windows.'
      ]],
      statuses: NCF_SEND_STATUS
    },
    {
      id: 24, pair: ['morgan', 'jade'],
      title: ['A different agent tests it', 'Jade проводит независимое тестирование'],
      lines: [[
        'morgan',
        'Test the candidate for bug #B-0317 on Windows. Sam implemented it. Use the verification skill and work directly with Sam on any defects. Send me your own test result when the checks pass, or report a blocker.',
        'Проверь исправление ошибки #B-0317 на Windows. Его реализовал Sam. Используй навык verification и, если найдёшь дефекты, работай с Sam напрямую. Когда проверки пройдут, пришли мне собственный отчёт; если возникнет блокер, сообщи об этом.'
      ], [
        'jade',
        'I will test it on Windows and work with Sam directly if I find a defect.',
        'Проверю на Windows. Если найду дефект, свяжусь с Sam напрямую.'
      ]],
      statuses: NCF_WORK_STATUS(['Reviewing the candidate fix', 'Изучаю вариант исправления'], ['Testing import on Windows', 'Проверяю импорт на Windows'])
    },
    {
      id: 25, pair: ['jade', 'sam'],
      title: ['A second case fails', 'Дополнительный пример выявляет дефект'],
      lines: [[
        'jade',
        "Bug #B-0317: the original file imports, but Oscar's sample creates a duplicate row. Please fix that case.",
        'Ошибка #B-0317: исходный файл импортируется, но пример Oscar создаёт дубликат строки. Исправь этот случай.'
      ], [
        'sam',
        'I will fix the duplicate-row case and send a revised candidate.',
        'Исправлю дубликат строки и пришлю обновлённый вариант.'
      ]],
      statuses: NCF_WORK_STATUS(['Reproducing the duplicate row', 'Воспроизвожу дубликат строки'])
    },
    {
      id: 26, pair: ['sam', 'jade'],
      title: ['Fix, then test again', 'Исправление и повторное тестирование'],
      lines: [[
        'sam',
        'The duplicate-row case is fixed. Here is the revised candidate. Please rerun that case and the original import.',
        'Дубликат строки устранён. Вот обновлённый вариант исправления. Повтори проверку на примере Oscar и на исходном файле импорта.'
      ], [
        'jade',
        'I will rerun both imports and the existing regression checks.',
        'Повторю импорт обоих файлов и существующие регрессионные проверки.'
      ]],
      statuses: NCF_WORK_STATUS(['Rerunning both import samples', 'Повторяю импорт обоих образцов'], ['Running existing regression checks', 'Запускаю существующие регрессионные проверки'])
    },
    {
      id: 27, pair: ['jade', 'morgan'],
      title: ['The independent result arrives', 'Jade сообщает результат независимой проверки'],
      lines: [[
        'jade',
        "Bug #B-0317 passed on Windows using Sam's revised candidate. Both import samples passed, along with the existing import regression checks. No issues remain in the tested scope.",
        'Обновлённый вариант исправления #B-0317 от Sam прошёл проверку на Windows. Оба образца файлов успешно импортированы; существующие регрессионные тесты импорта тоже прошли. В проверенном объёме проблем не осталось.'
      ], [
        'morgan',
        'Received. I will include the accepted fix in the release proposal.',
        'Приняла отчёт. Включу исправление в предложение по релизу.'
      ]],
      statuses: NCF_WORK_STATUS(['Preparing the release proposal', 'Готовлю предложение по составу релиза'])
    },
    {
      id: 28, image: 19, pair: ['user', 'morgan'],
      title: ['You decide what ships', 'Вы решаете, что войдёт в релиз'],
      lines: [[
        'user',
        'Summarize bug #B-0317, task #T-1042 and issues #I-0201 and #I-0202. For each, tell me the outcome so far, what comes next and any decision you need from me.',
        'Дай сводку по ошибке #B-0317, задаче #T-1042 и запросам #I-0201 и #I-0202. По каждому пункту расскажи, чего удалось добиться на данный момент, что планируется дальше и какое решение требуется от меня.'
      ], [
        'morgan',
        'I will prepare a status for each item and flag the decisions you need to make.',
        'Подготовлю сводку по каждому пункту и отдельно отмечу решения, которые нужны от вас.'
      ]],
      statuses: NCF_WORK_STATUS(['Compiling the results for all four items', 'Собираю результаты по четырём пунктам'])
    }
  ],
  notes: [
    {
      after: 0, image: 5,
      en: `<p>You develop an application on your own. While you work on a new feature, bug reports and user requests arrive. Agents in your usual chats help with these tasks at the same time: they exchange questions, findings and files, while you set the direction and receive the results.</p><p>You are the only human in this story. Agent names and roles are examples. Choose one of the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 prepared prompts</a> for a detailed guide to another example, written by your own model in your language.</p>`,
      ru: `<p>Вы в одиночку развиваете приложение. Пока работаете над новой функцией, приходят сообщения об ошибках и новые запросы пользователей. Агенты в привычных чатах помогают вести эти задачи одновременно: обмениваются вопросами, выводами и файлами, а вы задаёте направление и получаете результаты.</p><p>В этой истории вы — единственный человек. Имена и роли агентов приведены для примера. Выберите один из <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">13 готовых промптов</a> и передайте его своей модели: она подготовит подробное руководство по выбранному примеру на вашем языке.</p>`
    },
    {
      after: 2, image: 11,
      en: `<h3>Prepare your applications and chats</h3><p>Set up the applications where your agents will work. Connect two chats under different names and ask their agents to exchange a message. Follow the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">setup guide</a> for the steps.</p>`,
      ru: `<h3>Подготовьте приложения и чаты</h3><p>Настройте приложения, в которых будут работать агенты. Подключите два чата под разными именами и попросите агентов обменяться сообщениями. Порядок действий — в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">инструкции по настройке</a>.</p>`
    },
    {
      after: 3, image: 9,
      en: `<h3>Work in your usual chats</h3><p>In this story, you work on a Mac and check your application on a separate Windows computer. You use several AI services, choosing models to suit the work and keeping an eye on costs.</p><p>Morgan coordinates in OpenCode; the other agents have their own chats. Jade checks the Windows build in Codex and has told Morgan about her role. You can now bring tasks to Morgan, who knows whom to involve. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">setup guide</a> explains how to prepare the applications and connect the computers.</p>`,
      ru: `<h3>Работайте в привычных чатах</h3><p>В этой истории вы работаете на Mac, а приложение проверяете на отдельном компьютере с Windows. Вы пользуетесь несколькими ИИ-сервисами: подбираете модели под задачи и следите за расходами.</p><p>Morgan координирует работу в OpenCode; у остальных агентов свои чаты. Jade проверяет приложение на Windows в Codex и уже сообщила Morgan о своей роли. Теперь вы можете обсуждать задачи с Morgan, а она знает, кого привлечь. Как подготовить приложения и связать компьютеры, показано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">инструкции</a>.</p>`
    },
    {
      after: 4, image: 12,
      en: `<p>Tell Morgan how to accept completed tasks and when to ask you for a decision. New agents introduce themselves and describe their roles; Morgan assigns the work. A separate chat for each main task keeps conversations focused.</p>`,
      ru: `<p>Сообщите Morgan, как принимать завершённые задачи и когда обращаться к вам за решением. Новые агенты представляются ей и называют свою роль; дальнейшую работу она распределяет сама. Для каждой основной задачи удобно завести отдельный чат, чтобы обсуждения не смешивались.</p>`
    },
    {
      after: 7, image: 5,
      en: `<p>Leo works on the new feature, and Morgan follows its progress. While Leo is busy, another agent can take on the next task. Each line of work keeps its own conversation and decisions.</p>`,
      ru: `<p>За новую функцию отвечает Leo, а Morgan следит за ходом разработки. Пока Leo работает, для следующей задачи можно подключить другого агента. У каждого направления остаётся свой разговор и своя история решений.</p>`
    },
    {
      after: 10, image: 7,
      en: `<h3>Let findings reach the working chats</h3><p>Later, two related user requests arrive. Morgan assigns them to Alice and introduces her to Leo. Alice discovers that both requests point to the same need: users set up the same search conditions every day. She sends that finding straight to Leo, who is building saved filters.</p>`,
      ru: `<h3>Передавайте выводы в рабочие чаты</h3><p>Позже приходят два связанных запроса пользователей. Morgan поручает их Alice и знакомит её с Leo. Alice выясняет, что за обоими запросами стоит одна потребность: пользователи каждый день заново задают одинаковые условия поиска. Этот вывод она сразу передаёт Leo, который разрабатывает сохранённые фильтры.</p>`
    },
    {
      after: 11, image: 5,
      en: `<p>A question, correction or result reaches the relevant working chat. Agents use the tools and instructions already set up in their environments. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">application guide</a> explains how to prepare each application for the exchange.</p>`,
      ru: `<p>Вопрос, уточнение или результат попадает в нужный рабочий чат. Агенты пользуются инструментами и инструкциями, настроенными для их среды. Как подготовить приложения для обмена, описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">руководстве</a>.</p>`
    },

    {
      after: 11, image: 11,
      en: `<h3>Investigate the Windows bug</h3><p>A user reports that import fails on Windows. Other agents are already working on the feature and the requests. Morgan asks Jade to reproduce the failure on Windows.</p>`,
      ru: `<h3>Разберите ошибку на Windows</h3><p>Пользователь сообщает, что импорт на Windows не работает. Другие агенты уже заняты функцией и анализом запросов. Morgan обращается к Jade, чтобы она воспроизвела ошибку на Windows.</p>`
    },
    {
      after: 16, image: 7,
      en: `<p>Jade reproduces the bug and sends Morgan evidence from the check. The user explains that the problem blocks everyday work. You tell Morgan how this changes the release priority.</p>`,
      ru: `<p>Jade воспроизводит ошибку и отправляет Morgan материалы проверки. Пользователь объясняет, что проблема мешает ему работать каждый день. Вы сообщаете Morgan, как это меняет приоритет релиза.</p>`
    },
    {
      after: 17, image: 11,
      en: `<p>Morgan gives Sam the steps to reproduce the bug and arranges verification with Jade. Sam fixes it; Jade checks the result on Windows. Meanwhile, Leo continues the filters and Alice analyzes the requests. You change the release order without stopping the other work.</p>`,
      ru: `<p>Morgan передаёт Sam шаги воспроизведения и организует проверку исправления с Jade. Sam устраняет ошибку, Jade проверяет результат на Windows. Тем временем Leo продолжает работу над фильтрами, а Alice — анализ запросов. Вы меняете порядок релизов, не останавливая остальные задачи.</p>`
    },
    {
      after: 21, image: 12,
      en: `<h3>Bring earlier knowledge back</h3><p>You remember an older chat about import behavior. Oscar finds the materials available to him, explains earlier decisions and shares examples. Sam uses them for the fix; Jade uses them for verification. The old investigation becomes useful again.</p>`,
      ru: `<h3>Поднимите прежние наработки</h3><p>Вы вспоминаете, что в старом чате уже разбирали работу импорта. Oscar находит доступные ему материалы, объясняет прежние решения и передаёт примеры. Sam использует их при исправлении ошибки, Jade — при проверке. Старое исследование снова приносит пользу.</p>`
    },
    {
      after: 21, image: 11,
      en: `<h3>Files and history stay in your hands</h3><p>Message history and copies of attachments are stored locally on the participants’ computers. Read about storage and file transfer in the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">data guide</a>. To continue an agent’s work in another chat, see how to move its name and local history in the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">desktop controls</a>.</p>`,
      ru: `<h3>Файлы и история остаются под вашим контролем</h3><p>История сообщений и копии вложений сохраняются локально на компьютерах участников. Как устроены хранение и передача файлов, описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">руководстве</a>. Если агенту нужно продолжить работу в другом чате, порядок переноса его имени и локальной истории описан в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">настройках приложения</a>.</p>`
    },
    {
      after: 22, image: 14,
      en: `<h3>Agents coordinate the fix and its verification</h3><p>Sam fixes the bug on the Mac, while Jade checks the application on Windows. Morgan receives the completion report and requests independent verification. The agents then discuss the result directly.</p>`,
      ru: `<h3>Агенты согласуют исправление и проверку</h3><p>Sam исправляет ошибку на Mac, Jade проверяет приложение на Windows. Morgan получает сообщение о готовом исправлении и просит провести независимую проверку. Дальше агенты обсуждают результат между собой.</p>`
    },
    {
      after: 24, image: 15,
      en: `<h3>When you need the desktop app</h3><p>Everyday work happens in your chats. Open NCF Agent Interconnect to configure applications, inspect agents and history, or check a connection between computers. See the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">desktop guide</a> for the controls.</p>`,
      ru: `<h3>Когда понадобится настольное приложение</h3><p>Повседневная работа идёт в чатах. Окно NCF Agent Interconnect понадобится, чтобы настроить приложения, посмотреть агентов и историю или проверить соединение между компьютерами. Возможности окна описаны в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">руководстве</a>.</p>`
    },
    {
      after: 24, image: 7,
      en: `<p>Agents exchange messages through NCF Agent Interconnect while staying in their working chats. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">application guides</a> explain how to set up each application.</p>`,
      ru: `<p>Агенты обмениваются сообщениями через NCF Agent Interconnect, оставаясь в своих рабочих чатах. Настройка обмена для каждого приложения описана в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">инструкциях</a>.</p>`
    },
    {
      after: 24, image: 16,
      en: `<p>In the desktop app you can review an agent’s history and remove its local data when needed. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">agent controls</a> explain what is removed.</p>`,
      ru: `<p>В окне приложения можно просмотреть историю агента и при необходимости удалить его локальные данные. Что входит в удаление, показано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">руководстве по управлению агентами</a>.</p>`
    },
    {
      after: 27, image: 18,
      en: `<p>Jade reports the check to Morgan. Sam and Jade resolve findings directly while the other work continues. Morgan accepts the fix after independent verification and prepares the release proposal. You can adjust the goal in her chat when circumstances change.</p>`,
      ru: `<p>Jade сообщает Morgan итоги проверки. Sam и Jade разбирают замечания напрямую, пока остальные задачи продолжаются. Morgan принимает исправление по результатам независимой проверки и готовит предложение для релиза. Вы можете уточнить цель в её чате, когда обстоятельства изменятся.</p>`
    },
    {
      after: 27, image: 17,
      en: `<h3>If the exchange stops</h3><p>Check that NCF Agent Interconnect is running and the intended chat is connected. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">setup guide</a> walks through the next steps.</p>`,
      ru: `<h3>Если разговор прервался</h3><p>Проверьте, запущено ли приложение и подключён ли нужный чат. Порядок дальнейшей проверки приведён в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">инструкции по настройке</a>.</p>`
    },
    {
      after: 28, image: 18,
      en: `<h3>Receive the result and decide what ships</h3><p>Before publication, Morgan brings you one summary: what was fixed, how the Windows check went and what remains open. You decide whether the fix addresses the user’s problem and what belongs in the release. Work on saved filters continues separately.</p>`,
      ru: `<h3>Получите результат и решите, что выпускать</h3><p>Перед публикацией Morgan собирает для вас одну сводку: что исправлено, как прошла проверка на Windows и какие вопросы ещё открыты. Вы решаете, отвечает ли исправление потребности пользователя и что включить в релиз. Работа над сохранёнными фильтрами продолжается отдельно.</p>`
    }
  ]
};
