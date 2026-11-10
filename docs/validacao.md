# Validação e desempenho

## Linha de base conhecida

Após a migração, nove testes passaram. O teste no navegador mede geração e renderização, incluindo FPS, tempo de quadro e streaming. Ainda não há carga de personagens para medir desempenho de simulação.

Execute `npm run benchmark:placement` para repetir a consulta sintética. São sete rodadas de 1.024 consultas em um mapa de 768 m com semente 1769. No Node 24.19.0, em um Intel i3-10105, as medianas anteriores foram 18,72, 49,74 e 313,03 ms com zero, mil e dez mil construções distantes. Após a migração foram 16,95, 16,27 e 15,99 ms, respectivamente. A preparação do índice com dez mil construções levou 7,61 ms nessa execução. São medições de consulta de lote em uma máquina.

A migração também comparou 60.690 decisões de ocupação com o protótipo importado, incluindo bordas de defesas, sem divergências. Em duas sementes de referência, os dados gerados e as malhas amostradas de terreno, água e estruturas tiveram a mesma assinatura do protótipo importado. No Chrome, a versão de produção gerou um mapa de 5.000 × 5.000 m e carregou os chunks da borda sudeste sem erro.

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
