# Validação e desempenho

A [revisão da água e arquitetura](revisao-agua-arquitetura.md) reúne a auditoria e as medições consolidadas mais recentes, incluindo limites de memória e os comandos de reprodução. Os registros abaixo também conservam medições das etapas anteriores.

## Linha de base conhecida

Após a migração, nove testes passaram. O teste no navegador mede geração e renderização, incluindo FPS, tempo de quadro e streaming. A revisão posterior acrescentou um microbenchmark de travessia. A simulação populacional integrada ainda precisa de uma carga representativa.

Execute `npm run benchmark:placement` para repetir a consulta sintética. São sete rodadas de 1.024 consultas em um mapa de 768 m com semente 1769. No Node 24.19.0, em um Intel i3-10105, as medianas anteriores foram 18,72, 49,74 e 313,03 ms com zero, mil e dez mil construções distantes. Após a migração foram 16,95, 16,27 e 15,99 ms, respectivamente. A preparação do índice com dez mil construções levou 7,61 ms nessa execução. São medições de consulta de lote em uma máquina.

A migração também comparou 60.690 decisões de ocupação com o protótipo importado, incluindo bordas de defesas, sem divergências. Em duas sementes de referência, os dados gerados e as malhas amostradas de terreno, água e estruturas tiveram a mesma assinatura do protótipo importado. No Chrome, a versão de produção gerou um mapa de 5.000 × 5.000 m e carregou os chunks da borda sudeste sem erro.

## Verificação da água

`npm test` passou com 11 testes, incluindo profundidade na margem e corrente na geração compacta. `npm run build` e `npm run playtest` passaram. O playtest verifica a inspeção do lago na semente 1769 e inclui um perfil móvel emulado. No Chrome com Intel UHD 770, o p95 ficou em cerca de 16,8 ms antes e depois, com 309 chamadas de desenho na vila e 557 na vista ampla da semente 9057. Na semente 9057 a geração mediu 601 ms antes e 757 a 846 ms depois, em poucas execuções. Falta medir a variação em mais execuções e em dispositivos móveis reais.

Um teste adicional no Chrome abriu a semente 1769 com 5.000 × 5.000 m e confirmou a consulta do mar e o carregamento dos chunks na borda sudeste sem erros. O campo de tipo e corrente acrescenta cerca de 25 MB à grade nesse tamanho.

Para a travessia, `npm test` cobre entrada e saída pelo raso, deriva, limite do mapa e preservação do save. O cenário `npm run playtest` entra na água com WASD na semente 1769, volta à margem por clique, confirma o retorno ao modo mapa e registra `playtest-output/travessia.png`.

Na revisão visual, `npm test` passou com 13 testes. O build e o playtest no Chrome também passaram. A inspeção visual na semente 1769 cobriu rio com lago (82, 144), rio com mar (240, 67), praia (155, 230) e a borda leste. Com Intel UHD 770, o p95 ficou entre 16,8 e 16,9 ms nas cenas medidas. O maior lote de chunks no cenário de estresse subiu de 27 para 44 ms nessa comparação. Falta repetir essa medição em mais execuções e em dispositivos móveis reais.

Para a hidrologia 2, `npm test` passou com 15 testes, incluindo cotas das desembocaduras e comparação da assinatura dos dados de água e terreno com a hidrologia anterior. `npm run build` e `npm run playtest` passaram. Na semente 454 com 5.000 × 5.000 m, a geração revisada manteve 79 entradas de rio em lagos. Nenhuma ficou abaixo do lago ou veio de um ramo de até 12 células. No Chrome, o ponto (2513, 2784) ficou com aproximadamente 3,5 cm de profundidade e duas manchas na margem do lago desapareceram. A troca explícita para a geração nova deixou intacto um save com progresso na geração anterior. Falta medir o custo de geração em mais execuções do mapa máximo.

Na hidrologia 3, `npm test` passou com 17 testes e `npm run build` e `npm run playtest` passaram. Os testes cobrem lagoas conectadas às saídas, recursos das matas de nascente e as assinaturas de terreno das gerações 1 e 2. No Chrome, a semente 454 com 5.000 m apresentou 413 lagoas de cabeceira e zero rios quebrados. Em (2513, 2784), a lagoa teve aproximadamente 0,34 m de profundidade e a saída 0,10 m. Foram encontrados 41 árvores e 19 rochas nos 16 m ao redor desse ponto. No canal iniciado em (2474, 458), o alargamento foi verificado ao longo de 235 passos de drenagem, cerca de 278,5 m, até (2710, 451). As capturas ficam em `playtest-output/lagoa-nascente.png` e `playtest-output/corrego-nascente.png`. A comparação de desempenho da geração máxima ainda precisa de mais execuções.

## Matriz de verificação

O refinamento da mistura das águas foi conferido no Chrome na configuração da semente 454, mapa de 1.024 m, relevo 1, água 0,12, rios 0,19, lagos 0,2 e detalhe crisp. Em (686, 70), duas fases da animação e uma gravação de aproximadamente 4,8 s registraram espuma fragmentada e giros laterais com posição variável. O p95 amostrado foi 16,9 ms. Os arquivos ficam em `playtest-output/foz-refinada-454.png` e `playtest-output/foz-refinada-454.webm`.

A zona de mistura das desembocaduras passou nos 19 testes, no build e no playtest do Chrome. A verificação inclui intensidade de mistura mesmo quando a corrente local já é forte e bloqueio do efeito por terra. Foram conferidos os encontros com lago em (82, 144) e mar em (240, 67), semente 1769, com capturas em fases distintas e gravações de aproximadamente 4,8 s em `playtest-output/mistura-lago.webm` e `playtest-output/mistura-mar.webm`. Na Intel UHD 770, o p95 ficou entre 16,8 e 16,9 ms nas cenas de referência, com a mesma quantidade de chamadas de desenho nas vistas fixas. São amostras de uma execução por versão.

A revisão das ondas costeiras passou em `npm test` com 19 testes, no build e em `npm run playtest`. A comparação na Intel UHD 770 manteve p95 próximo de 16,8 ms nas cenas de referência. Na vila, as chamadas de desenho passaram de 402 para 403 e foram adicionados 94 triângulos para a película na areia. O maior lote de chunks no cenário de estresse mediu 24,5 ms antes e 32,4 ms depois nessa execução. Essa comparação cobre poucas execuções em um desktop. A avaliação em dispositivos móveis reais continua pendente. As capturas em fases distintas ficam em `playtest-output/praia-frentes-0.png`, `playtest-output/praia-frentes-1.png` e `playtest-output/praia-frentes-2.png`.

A conferência adicional incluiu uma tela de 390 × 844 e o litoral da semente 454 com 5.000 m, em (600, 227,55). No mapa máximo, o p95 amostrado nessa costa ficou em 16,8 ms, com 242 chamadas de desenho, sem erros no navegador. As capturas ficam em `playtest-output/praia-frentes-mobile.png` e `playtest-output/praia-frentes-5000.png`.

A hidrologia 4 passou em `npm test` com 19 testes, no build e no playtest do Chrome. Os testes cobrem aprofundamento restrito à água, preservação da linha d'água e coleta única das árvores adicionais após recarga de save. Na semente 1769, o ponto (80, 146) junto à foz passou de aproximadamente 0,73 m para 1,71 m de profundidade. Na semente 454 com 5.000 m, foram observadas 93 árvores nos 16 m ao redor de (2513, 2784), incluindo 52 árvores da distribuição adicional. O cenário não apresentou rios quebrados nem erros no navegador. As capturas ficam em `playtest-output/foz-lago-profunda.png`, `playtest-output/foz-mar-profunda.png` e `playtest-output/nascente-floresta-densa.png`. A medição de desempenho em hardware móvel real continua pendente.

A continuidade visual das desembocaduras passou em `npm test` com 18 testes, no build e em `npm run playtest`. Os testes verificam redução progressiva da corrente, espalhamento lateral e bloqueio por terra ou mudança de cota. No Chrome, foram conferidas duas fases da animação em rio com lago (82, 144) e rio com mar (240, 67), semente 1769. As capturas ficam em `playtest-output/foz-lago-integrada.png` e `playtest-output/foz-mar-integrada.png`. A gravação adicional pelo Playwright ficou indisponível por ausência do executável FFmpeg.

| Cenário | Medição | Critério |
| --- | --- | --- |
| Mesma atividade, mais objetos distantes | 0, 1.000 e 10.000 construções fora da área consultada. Candidatos examinados, latência p50/p95, memória e custo de montar o índice | Mesmo resultado de jogo e quantidade de candidatos locais independente dos objetos distantes |
| Fronteiras e áreas grandes | Lotes em divisas de chunks, terrenos inválidos, muralhas, campos e construções carregadas | Mesma resposta do protótipo, incluindo a prioridade da rejeição |
| Comandos e saves | Duas coletas no mesmo alvo, construção repetida, falha e recarga de save anterior | Aplicação única, sem débito duplicado, sem mudança em comando recusado e persistência após recarga |
| Tarefas com atores | 100, 1.000 e 5.000 atores em cenários futuros. Variar a população com a mesma atividade, depois variar a atividade e a densidade local | Medir p50/p95/p99 por tick, por sistema e por consulta, entidades efetivamente atualizadas, alocações, memória e filas. A meta numérica depende do hardware e da carga acordada |
| Apresentação | Tempo de quadro, FPS, picos e latência da intenção ao efeito visível em desktop e no perfil móvel escolhido | Controles e resposta preservados frente à linha de base. Registrar limites por dispositivo |
| Worker, se adotado | Mensagens e bytes por segundo, tempo de preparação, trânsito, aplicação e atraso de revisão | Demonstrar benefício líquido sob a mesma carga e recuperação consistente após lacunas |
| Níveis de simulação, quando adotados | Comparar referência detalhada e agregada no mesmo intervalo | Preservar as invariáveis declaradas, incluindo estoques e progresso, sem duplicação de atividade na transição |

## Procedimento

Use sementes, ações, câmera, resolução, navegador e hardware registrados. Aqueça o cenário, repita medições e separe geração, simulação, renderização, transporte e persistência. Relate percentis e contadores de trabalho. Use resultados equivalentes ao comparar estruturas de armazenamento ou agendamento. Registre também áreas densas, saturação de filas e picos de salvamento. Faça testes do núcleo em Node e testes de ponta a ponta no navegador depois da importação.
