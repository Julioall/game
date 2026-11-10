# Validação e desempenho

## Linha de base conhecida

Na auditoria local, oito testes passaram. O teste existente no navegador mede geração e renderização, incluindo FPS, tempo de quadro e streaming. Ainda não há carga de personagens para medir desempenho de simulação.

Na consulta sintética de ocupação, sete rodadas no Node 24.19.0, em um Intel i3-10105, validaram os mesmos 1.024 lotes por rodada em um mapa de 768 m com semente 1769. As medianas foram 18,72 ms com zero, 49,74 ms com mil e 313,03 ms com dez mil construções distantes. A medição abrange apenas a consulta de lote. A migração deve criar um cenário reproduzível e coletar uma nova linha de base antes de comparar.

## Matriz de verificação

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
