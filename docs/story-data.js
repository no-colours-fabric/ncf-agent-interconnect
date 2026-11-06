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
      en: `<p>You maintain a growing application on your own. Bug reports arrive while you build a roadmap feature, and new user requests need attention too. NCF Agent Interconnect lets the AI agents in your usual chats work on these tasks together. Questions, findings and files travel directly between them; you set the direction and receive the results in your working chat.</p>
        <p>This guide follows one developer through that situation. You are the only human in the story; all named participants are AI agents. Their names and roles are examples you can replace with your own.</p>
        <p>To explore other team arrangements, open the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">catalog of 13 scenarios</a>. Ask a model to compare all of them against your goal, then choose the scenario you want it to demonstrate.</p>
        <ul><li>Work in your usual chats: give a task, add help, change priorities and reuse earlier work.</li><li>Before your first exchange: prepare your applications and, if needed, another computer.</li><li>Administration when you need it: inspect connections, move a name or manage stored history.</li></ul>
        <p>LLM-optimized documentation: <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt">llms.txt</a>.</p>`,
      ru: `<p>Вы в одиночку развиваете приложение. Пока работаете над новой функцией из плана развития, приходят сообщения об ошибках и новые запросы пользователей. NCF Agent Interconnect помогает ИИ-агентам из ваших привычных чатов заниматься этими задачами вместе. Они напрямую обмениваются вопросами, выводами и файлами; вы задаёте направление и получаете результаты в своём рабочем чате.</p>
        <p>Перед вами история одного разработчика в такой ситуации. Вы — единственный человек в этой истории; остальные участники — ИИ-агенты. Имена и роли служат примером: вы можете выбрать другие.</p>
        <p>Другие варианты организации команды собраны в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md">каталоге из 13 сценариев</a>. Попросите модель сопоставить каждый сценарий с вашей задачей, а затем выберите тот, который хотите разобрать на примере.</p>
        <ul><li>Работа в привычных чатах: ставьте задачи, подключайте помощников, меняйте приоритеты и возвращайтесь к прежним наработкам.</li><li>Перед первым обменом: настройте приложения и, при необходимости, второй компьютер.</li><li>Администрирование по мере необходимости: проверяйте соединения, переносите имя агента и управляйте сохранённой историей.</li></ul>
        <p>Документация в формате, удобном для языковых моделей: <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt">llms.txt</a>.</p>`
    },
    {
      after: 2, image: 11,
      en: `<h3>Prepare your applications and chats</h3>
        <p>Set up each application or profile once. New chats then join by connecting under names you choose.</p>
        <ol><li>Install and start NCF Agent Interconnect on the computer you use. Closing its window keeps it running in the tray; Quit stops its connections.</li><li>Open <strong>Applications &amp; MCP</strong>, choose your application and open its Configure dialog. Check the intended configuration file, review the change and click <strong>Apply</strong>. Only your Apply action writes that file; unrelated settings are preserved.</li><li>Reconnect MCP in the AI application. Restart OpenCode after adding its bundled plugin. For the Cursor setup used in this story, complete owner authorization and bridge setup as described in the <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/aionui-setup.md">setup guide</a>.</li><li>In two configured chats, choose different names and ask one participant to send the other a short message. The reply confirms a working exchange.</li></ol>`,
      ru: `<h3>Подготовьте приложения и чаты</h3>
        <p>Каждое приложение или профиль достаточно настроить один раз. После этого новые чаты смогут подключаться под выбранными вами именами.</p>
        <ol><li>Установите и запустите NCF Agent Interconnect на своём компьютере. Если закрыть окно, приложение продолжит работать в системном трее; команда Quit остановит соединения.</li><li>Откройте раздел <strong>Applications &amp; MCP</strong>, выберите приложение и вызовите окно Configure. Убедитесь, что выбран нужный файл конфигурации, проверьте предлагаемые изменения и нажмите <strong>Apply</strong>. Запись в файл происходит только после вашего нажатия Apply; остальные настройки сохраняются.</li><li>Переподключите MCP в ИИ-приложении. После установки встроенного плагина OpenCode перезапустите OpenCode. Для варианта работы с Cursor в этой истории выполните авторизацию владельца и настройте мост по <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/aionui-setup.md">инструкции по настройке</a>.</li><li>Откройте два настроенных чата, дайте им разные имена и попросите одного агента отправить другому короткое сообщение. Ответ подтвердит, что связь работает.</li></ol>`
    },
    {
      after: 3, image: 9,
      en: `<h3>Work in your usual chats</h3>
        <p>In this story, you work on a Mac and keep a Windows computer for checking the application your users run. You already use several AI services, choosing models that suit your work and balancing costs.</p>
        <p>AI agent Morgan coordinates in OpenCode. Other participants have their own chats; the Windows checks happen in Codex. A new participant could later join in Cursor or another configured application.</p>
        <p>After first-time setup, give each participating chat a name. In your main chat, establish the coordination rules. Jade has now told Morgan her Windows verification role; you can direct later work through the coordination chat.</p>
        <p>To make this exchange possible, NCF Agent Interconnect was installed on Jade's Windows computer and the two computers were paired under <strong>Remote nodes</strong> using an explicit address and temporary access code. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">setup guide</a> covers installation, pairing and application-specific steps.</p>`,
      ru: `<h3>Работайте в привычных чатах</h3>
        <p>В этой истории вы работаете на Mac, а приложение для своих пользователей проверяете на отдельном компьютере с Windows. Вы уже пользуетесь несколькими ИИ-сервисами: подбираете модели под задачи и следите за расходами.</p>
        <p>В чате OpenCode работу координирует агент Morgan. У остальных участников свои чаты; проверки на Windows проходят в Codex. Позже к работе можно подключить нового агента в Cursor или другом настроенном приложении.</p>
        <p>После первоначальной настройки дайте имя каждому чату, который участвует в работе. В основном чате задайте правила координации. Jade уже сообщила Morgan, что отвечает за проверки на Windows; дальнейшие задачи вы можете ставить в чате координатора.</p>
        <p>Для этого обмена NCF Agent Interconnect заранее установили и на компьютер Jade с Windows, затем в разделе <strong>Remote nodes</strong> связали компьютеры, указав явный адрес и временный код доступа. Установка, сопряжение и шаги для разных приложений подробно описаны в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md">инструкции по настройке</a>.</p>`
    },
    {
      after: 4, image: 12,
      en: `<p>Give the AI coordinator a separate rule for accepting completed work. The AI coordinator sends working instructions to participants as they join and follows progress across all tasks. When you connect a participant, give that chat a name and role; Morgan assigns the work after the agent reports that role.</p>
        <p>Keep each task in its own chat. For a separate task, connect another chat under a name you choose. This keeps the working context focused and lets tasks progress alongside one another. Names let participants address each other without you copying technical identifiers. If a name exists on two computers, identify the intended computer too.</p>`,
      ru: `<p>Отдельно задайте координатору правило приёмки завершённых задач. По мере подключения новых участников Morgan передаст им рабочие инструкции и будет следить за всеми направлениями работы. При подключении дайте чату имя и обозначьте роль агента; задачи распределит Morgan после того, как агент сообщит ему о своей роли.</p>
        <p>Держите каждую задачу в отдельном чате. Для новой задачи подключите ещё один чат и дайте ему имя. Так контекст не смешивается, а работа по разным направлениям идёт параллельно. Агенты обращаются друг к другу по именам. Если одно и то же имя встречается на двух компьютерах, укажите и нужный компьютер.</p>`
    },
    {
      after: 7, image: 5,
      en: `<p>AI agent Leo owns the feature. The AI coordinator follows its progress.</p>
        <p>Keeping one main assignment per chat is a working habit, not an NCF Agent Interconnect restriction. A participant can answer a focused question from another chat or receive a separate follow-up instruction. Later, Morgan can give that chat a new main assignment. Here, new work gets its own participant so the feature can continue.</p>`,
      ru: `<p>За новую функцию отвечает Leo, а Morgan следит за ходом разработки.</p>
        <p>Одна основная задача на чат помогает держать контекст в порядке, но NCF Agent Interconnect этого не требует. Агент может ответить на точечный вопрос из другого чата или получить дополнительное поручение. Позже Morgan может дать этому же чату новую основную задачу. Здесь для следующей задачи подключают отдельного участника, чтобы работа над функцией не останавливалась.</p>`
    },
    {
      after: 10, image: 7,
      en: `<h3>Let findings reach the working chats</h3>
        <p>Later, two related user requests arrive. You open another analysis chat; Morgan assigns Alice the requests and puts her in touch with the feature's owner. AI agent Alice discovers that both requests describe the same need: users recreate identical search conditions every day. She sends the finding directly to the chat where the saved-filter feature is being built.</p>`,
      ru: `<h3>Передавайте выводы в рабочие чаты</h3>
        <p>Позже приходят два связанных запроса пользователей. Вы открываете отдельный чат для анализа, Morgan поручает запросы Alice и знакомит её с Leo, который отвечает за новую функцию. Alice выясняет, что за обоими запросами стоит одна потребность: пользователи каждый день заново настраивают одни и те же условия поиска. Свой вывод она сразу отправляет в чат, где Leo разрабатывает сохранённые фильтры.</p>`
    },
    {
      after: 11, image: 5,
      en: `<p>An exchange between the AI agents could read as shown above. This is where instant messaging helps: a question, correction or result goes straight into the relevant working chat. With a supported reactive integration, incoming messages can continue the conversation there. You stay in your usual application while the participants exchange the details. <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#2-choose-an-application">Application support</a> describes delivery for each integration.</p>
        <p>Each participant keeps its existing skills, project instructions and MCP tools. The AI tester can use a regression checklist. The AI developer can follow the project's contribution skill. NCF Agent Interconnect carries messages and permitted files; source access and other tools stay in the environments you set up.</p>`,
      ru: `<p>Выше — пример переписки агентов. Вопрос, уточнение или результат сразу попадает в тот рабочий чат, где он нужен. Если интеграция поддерживает реакцию на входящие сообщения, разговор в этом чате может продолжиться без вашего участия. Вы остаётесь в привычном приложении, пока агенты обмениваются деталями. Как устроена доставка в каждом клиенте, описано в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#2-choose-an-application">разделе о поддержке приложений</a>.</p>
        <p>У каждого агента остаются его навыки, инструкции проекта и MCP-инструменты. Тестировщик может работать по чек-листу регрессионных проверок, а разработчик — следовать правилам участия в проекте. NCF Agent Interconnect передаёт сообщения и разрешённые файлы; доступ к исходникам и другие инструменты остаются в настроенных вами рабочих средах.</p>`
    },

    {
      after: 11, image: 11,
      en: `<h3>Investigate the Windows bug</h3>
        <p>A user reports that import fails on Windows. The feature and request analysis already have their own participants. Jade's Windows chat is connected, so Morgan asks her to reproduce the failure there.</p>`,
      ru: `<h3>Разберите ошибку на Windows</h3>
        <p>Пользователь сообщает, что импорт на Windows не работает. Разработкой функции и анализом запросов уже заняты другие агенты. Чат Jade на Windows подключён заранее, поэтому Morgan поручает ей воспроизвести ошибку.</p>`
    },
    {
      after: 16, image: 7,
      en: `<p>AI agent Jade, the tester, reproduces the failure and sends the evidence directly to the coordination chat. The user confirms that the problem blocks daily work. You tell AI agent Morgan how this changes the release priority.</p>
        <p>Several chats on one computer can communicate immediately after setup. Jade's Windows computer was paired with the Mac before she joined this exchange.</p>`,
      ru: `<p>Jade воспроизводит ошибку и напрямую отправляет подтверждающие материалы в чат Morgan. Пользователь подтверждает, что из-за неё невозможно нормально работать каждый день. Вы сообщаете Morgan, как это меняет приоритет релиза.</p>
        <p>После настройки чаты на одном компьютере могут сразу обмениваться сообщениями. Компьютер Jade с Windows был сопряжён с Mac до этого обмена.</p>`
    },
    {
      after: 17, image: 11,
      en: `<p>You can expand the team while the feature continues. AI agent Morgan shares the reproduction, agrees on work boundaries and arranges verification on Windows. The AI coordinator keeps the changes separate so the fix can ship first. AI agent Sam owns the fix, while Jade checks its behavior on Windows. Saved filters and request analysis continue in their original chats. You have changed the release order and added capacity while work is underway.</p>
        <p>Use the same approach to add AI help with review or documentation. Give the new chat a name and role; its agent tells Morgan that role, then Morgan assigns work.</p>`,
      ru: `<p>К команде можно подключить нового агента, не останавливая работу над функцией. Morgan передаёт Sam шаги воспроизведения, согласует зоны ответственности и организует тестирование на Windows. Координатор держит изменения отдельно, чтобы исправление можно было выпустить первым. Sam отвечает за исправление, Jade проверяет его на Windows, а работа над фильтрами и анализ запросов продолжаются в своих чатах. Вы меняете порядок релизов и добавляете исполнителя уже по ходу работы.</p>
        <p>Так же можно подключить агента для ревью кода или работы над документацией: дайте новому чату имя и обозначьте роль агента. Агент сообщит о ней Morgan, а координатор распределит задачи.</p>`
    },
    {
      after: 21, image: 12,
      en: `<h3>Bring earlier knowledge back into the task</h3>
        <p>You remember that an older chat contains an investigation of import behavior. AI agent Oscar can review the history and materials still available to him, explain earlier decisions and share examples. The AI developer applies that knowledge to the fix. The AI tester uses the examples when checking it against today's implementation.</p>
        <p>Use the same exchange to gather a retrospective, recover a decision or pass useful work to a new participant. An old task can contribute without becoming active development again.</p>`,
      ru: `<h3>Поднимите прежние наработки</h3>
        <p>Вы вспоминаете, что в старом чате уже разбирали работу импорта. Oscar может поднять доступные ему историю и материалы, объяснить принятые тогда решения и передать примеры. Sam использует эти сведения при исправлении ошибки, а Jade — когда проверяет новую реализацию.</p>
        <p>Точно так же можно подготовить ретроспективу, восстановить забытое решение или передать полезные наработки новому участнику. Старая задача приносит пользу, даже если к её разработке не возвращаются.</p>`
    },
    {
      after: 21, image: 11,
      en: `<h3>Files, replies and history</h3>
        <p>For an import sample to travel between computers, its outgoing folder must be allowed under <strong>Settings</strong>. Received attachments are verified local copies. NCF Agent Interconnect retains its message history and attachments across restarts; the AI application's own chat transcript is stored separately. <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">Desktop controls</a> covers file limits and history views.</p>
        <p>To continue an existing named participant in another chat, connect there using the same name. If it is occupied, explicitly choose either transfer with its NCF Agent Interconnect history preserved or a fresh start that deletes its old local NCF Agent Interconnect history. Both choices revoke the previous chat binding. Preserving NCF Agent Interconnect history does not transfer the original AI application's full transcript, skills or account settings; ask for a handoff of the context needed in the new chat.</p>`,
      ru: `<h3>Файлы, ответы и история</h3>
        <p>Чтобы переслать образец файла импорта между компьютерами, разрешите папку, из которой он отправляется, в разделе <strong>Settings</strong>. Полученные вложения — локальные копии, прошедшие проверку. NCF Agent Interconnect сохраняет собственную историю сообщений и вложения после перезапуска; стенограмма чата в ИИ-приложении хранится отдельно. Об ограничениях на файлы и просмотре истории читайте в разделе <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md">Desktop controls</a>.</p>
        <p>Чтобы продолжить работу агента в другом чате, подключитесь там под тем же именем. Если имя уже занято, владелец должен явно выбрать один из вариантов: перенести его с сохранением локальной истории NCF Agent Interconnect или начать заново, удалив прежнюю локальную историю NCF Agent Interconnect. В обоих случаях прежняя привязка имени к чату отзывается. Сохранение истории NCF Agent Interconnect не переносит стенограмму исходного ИИ-чата, навыки и настройки учётной записи. Попросите передать новому чату необходимый контекст.</p>`
    },
    {
      after: 22, image: 14,
      en: `<h3>Let testing and fixes happen between agents</h3>
        <p>In this example, AI agent Sam works in Cursor on the Mac, while Jade tests in Codex on Windows. The AI coordinator receives the completion report in OpenCode and assigns the independent check. The next exchanges show how the agents work together.</p>`,
      ru: `<h3>Агенты сами согласуют проверки и исправления</h3>
        <p>В этом примере Sam работает на Mac в Cursor, а Jade тестирует приложение на Windows в Codex. Morgan получает в OpenCode отчёт о готовом исправлении и назначает независимое тестирование. Дальше — переписка агентов.</p>`
    },
    {
      after: 24, image: 15,
      en: `<h3>Administration when you need it</h3>
        <p>Your ordinary work stays in the AI chats. The desktop app provides the controls below when you need to inspect a connection or manage stored data.</p>
        <dl><dt><strong>Applications &amp; MCP</strong></dt><dd>Inspect saved configuration and known application activity; configure an application or profile.</dd><dt><strong>Agents</strong></dt><dd>Inspect names, known availability and message history; use the desktop message controls or review a deletion preview.</dd><dt><strong>Remote nodes</strong></dt><dd>Pair computers and inspect their connection state.</dd><dt><strong>Settings</strong></dt><dd>Choose outgoing file folders, the local network address and optional Start at login.</dd></dl>`,
      ru: `<h3>Когда понадобится настольное приложение</h3>
        <p>В обычной работе вы остаётесь в чатах с ИИ. Чтобы проверить подключение или управлять сохранёнными данными, откройте окно настольного приложения NCF Agent Interconnect.</p>
        <dl><dt><strong>Applications &amp; MCP</strong></dt><dd>Проверить сохранённую конфигурацию и доступные сведения об активности приложений; настроить приложение или профиль.</dd><dt><strong>Agents</strong></dt><dd>Посмотреть имена агентов, сведения об их доступности и историю сообщений; отправить сообщение из приложения или открыть предварительный просмотр удаления.</dd><dt><strong>Remote nodes</strong></dt><dd>Связать компьютеры и проверить состояние соединения между ними.</dd><dt><strong>Settings</strong></dt><dd>Указать папки для исходящих файлов, локальный сетевой адрес и, при желании, включить Start at login.</dd></dl>`
    },
    {
      after: 24, image: 7,
      en: `<p>The bundled OpenCode v1 plugin and supported AionUi bridge deliver to the connected chat; Codex Desktop delivery is experimental and version dependent. Standard MCP in Cursor provides exchange and history without automatically waking an idle chat. See <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">application-specific setup</a> for these delivery differences.</p>
        <p>You can follow the same approach with one subscription and several chats in one supported application on a single computer. That computer can also host the required test environments, for example in virtual machines.</p>`,
      ru: `<p>Встроенный плагин OpenCode v1 и поддерживаемый мост AionUi для Cursor Agent доставляют сообщения прямо в подключённый чат. Доставка в Codex Desktop пока экспериментальна и зависит от версии. Стандартный MCP в Cursor позволяет агентам обмениваться сообщениями и читать историю, но не активирует простаивающий чат автоматически. Подробности по каждому клиенту — в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md">инструкциях по настройке приложений</a>.</p>
        <p>Для такой работы может хватить одной подписки на ИИ-сервис и нескольких чатов в одном поддерживаемом приложении на одном компьютере. На нём же можно разместить необходимые тестовые среды, например виртуальные машины.</p>`
    },
    {
      after: 24, image: 16,
      en: `<p>The <strong>Agents</strong> page can remove one local agent or all local agents and their local history after a confirmation that lists the affected names and message counts. AI application transcripts, remote copies and messages already submitted elsewhere remain. See <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">desktop controls</a> and <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">privacy and storage</a> for the scope of removal.</p>`,
      ru: `<p>На странице <strong>Agents</strong> можно удалить одного локального агента или сразу всех вместе с локальной историей. Перед удалением приложение покажет имена затронутых агентов и число сообщений и запросит подтверждение. Стенограммы чатов в ИИ-приложениях, копии на удалённых компьютерах и сообщения, уже переданные другим адресатам, останутся. Что именно удаляется, описано в разделах <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/desktop-controls.md#remove-local-agents-and-history">управления агентами</a> и <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/privacy.md">хранения данных</a>.</p>`
    },
    {
      after: 27, image: 18,
      en: `<p><strong>Morgan → Sam, Jade:</strong> Bug #B-0317 is accepted on Jade's independent report. I will include it in the release proposal.</p>
        <p>AI agent Jade reports directly to Morgan. AI agents Sam and Jade resolve routine findings together, while other tasks keep moving. You can add context or adjust the goal in the coordination chat whenever something changes; you do not need to relay each correction or approve each retest.</p>`,
      ru: `<p><strong>Morgan → Sam, Jade:</strong> Принимаю исправление ошибки #B-0317 на основании независимого отчёта Jade. Добавлю его в предложение по составу релиза.</p>
        <p>Jade сообщает результат непосредственно Morgan. Sam и Jade разбирают текущие замечания друг с другом, пока работа над остальными задачами продолжается. Если обстоятельства изменятся, вы можете дополнить контекст или скорректировать цель в чате координатора. Пересылать каждое замечание и утверждать каждый повторный тест вам не требуется.</p>`
    },
    {
      after: 27, image: 17,
      en: `<h3>Check a connection when an exchange stops</h3>
        <p>Confirm that NCF Agent Interconnect is running, the intended chat is connected and any remote computer is paired and reachable. Saved configuration and an online connection do not report task progress. An accepted send or delivery receipt records a message stage; completion comes from the task result.</p>
        <p>If the application requires an active chat to read messages, open that exact chat. If delivery is uncertain, inspect the chat and NCF Agent Interconnect history before requesting another send. The <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">setup guide</a> gives the troubleshooting steps.</p>`,
      ru: `<h3>Если обмен сообщениями остановился</h3>
        <p>Убедитесь, что NCF Agent Interconnect запущен, нужный чат подключён, а удалённый компьютер, если он участвует в обмене, сопряжён и доступен. Сохранённая конфигурация и статус онлайн не показывают ход работы над задачей. Приём сообщения к отправке и подтверждение его получения показывают лишь этапы обмена; о завершении задачи судят по результату работы.</p>
        <p>Если клиент читает входящие сообщения только в активном чате, откройте именно тот чат, которому они адресованы. Когда неясно, дошло ли сообщение, сначала проверьте чат и историю NCF Agent Interconnect и лишь затем просите отправить его повторно. Порядок диагностики приведён в <a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md#check-a-problem-in-order">инструкции по настройке</a>.</p>`
    },
    {
      after: 28, image: 18,
      en: `<h3>Receive the outcome and decide what ships</h3>
        <p>Before publication, AI agent Morgan brings you one account of the result: what changed, what was checked on Windows, what remains open and what is proposed for release. You assess whether it addresses the user's problem and decide what ships. Saved filters continue toward their own result.</p>
        <p>You can ask for a concise update at any point, as in the message above. Routine questions and review feedback stay with the participants doing the work. You focus on product decisions and the results.</p>`,
      ru: `<h3>Получите результат и решите, что выпускать</h3>
        <p>Перед публикацией Morgan готовит для вас единый отчёт: что изменилось, какие проверки прошли на Windows, какие вопросы остались открытыми и что предлагается включить в релиз. Вы оцениваете, решает ли исправление проблему пользователя, и выбираете состав выпуска. Работа над сохранёнными фильтрами продолжается отдельно.</p>
        <p>Краткую сводку можно запросить в любой момент — как в сообщении выше. Текущие вопросы и замечания по проверкам остаются у агентов, которые выполняют работу. Вы принимаете продуктовые решения, опираясь на их результаты.</p>`
    }
  ]
};
