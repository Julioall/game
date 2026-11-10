# Arquitetura-alvo

## Limites

| Área | Responsabilidade |
| --- | --- |
| Mundo | Terreno, geração por semente, catálogos, consulta espacial e identidade de objetos |
| Simulação | Estado mutável, regras, comandos, agenda de tarefas e alterações persistíveis |
| Domínios | Construção, população, economia e esfera militar conforme surgirem regras próprias |
| Apresentação | Three.js, câmera, seleção visual, malhas, animação e interface |
| Plataforma | Workers, armazenamento e medição |
| Entrada | Composição dos módulos e ligação de entrada do jogador a comandos |

O núcleo usa dados serializáveis e funciona em testes sem navegador. A apresentação lê uma projeção do estado, e os adaptadores de plataforma cuidam de transporte e persistência. Criar diretórios de domínio conforme as regras forem introduzidas. O [inventário do protótipo](prototipo-e-migracao.md) distingue caminhos atuais da organização pretendida.

## Dados e identidade

Exemplos de nomes de módulos usam o prefixo `Game.`. `Game.Models` pode agrupar definições e dados de entidades, e `Game.Components` pode agrupar capacidades reutilizáveis. Esses nomes descrevem responsabilidades e servem como convenção para novos módulos.

- Uma definição de catálogo descreve o tipo. Uma instância tem ID, posição e alterações próprias. Geometria, colisão e navegação de uma construção usam a mesma planta de referência, incluindo vãos, pisos e pontos de acesso.
- Dados estáticos podem ser derivados da semente. Persistir alterações, inventários, IDs criados e os estados necessários para retomar tarefas. Preservar a relação entre configuração, versão de geração e versão do save. Índices, malhas e filas deriváveis são reconstruídos.
- Entidades usam capacidades concretas como coletável, inventário, produção e porta. Um tipo pode compartilhar capacidades com outros tipos. Funções de criação cuidam dos invariantes de inicialização.
- O índice espacial usa inicialmente os chunks de 32 m. Registra o alcance real de objetos grandes nas células que ocupam, deduplica candidatos e confirma sobreposição geometricamente. O índice móvel acompanha mudanças de célula.

## Comandos e eventos

Uma intenção identifica ator, ação e alvo por ID ou coordenadas. A consulta de disponibilidade pode orientar a interface e a IA. Na execução, a simulação resolve os alvos e valida as condições novamente. Ao cortar uma árvore, verifica estado, alcance e permissões, quando existirem. Remoção do recurso e crédito em inventário pertencem à mesma transação lógica.

O resultado confirma ou rejeita a intenção. Uma rejeição deixa inventário, revisão e eventos intactos. Após confirmação, registrar os fatos que consumidores realmente precisam e devolver as mudanças da projeção, como chunks sujos. Uma reação que altera o mundo volta como comando em etapa definida. Ordenar lotes de maneira estável e limitar o processamento por etapa. Coalescer sinalizações visuais redundantes preservando fatos individuais necessários. Tratar repetição de mensagens por ID de comando quando houver transporte com reenvio.

**Observer** serve a notificações com consumidores definidos. Uma fila por domínio entra quando é preciso separar emissão e consumo no tempo. A consistência de estoques, reservas e permissões fica no fluxo de execução. O save é um snapshot versionado, com o progresso e os prazos que precisam sobreviver. [Event Queue](https://gameprogrammingpatterns.com/event-queue.html)

## Ativação e frequência

| Modo | Critério | Exemplo |
| --- | --- | --- |
| Estático ou adormecido | Sem atividade ou prazo vencido | Floresta intacta, casa vazia |
| Agendado | Trabalho disparado por prazo ou mudança de condição | Lote produzido, colheita pronta |
| Ativo | Interação em curso exige atualização frequente | Deslocamento, combate, tarefa local |
| Agregado | É possível manter os resultados relevantes com atualização regional | Produção regional com entradas, saídas e estoques contabilizados |

A simulação detalhada usa ticks de passo fixo, com frequência a medir. Sistemas mais lentos seguem a mesma linha de tempo com cadência própria. Um orçamento de recuperação evita travar ao retomar uma aba suspensa. Trabalho excedente de baixa prioridade pode ser adiado com diagnóstico. Resultados de jogo dependem de ordem estável e do tempo simulado. A distância da câmera influencia apresentação. A relevância para jogo e as atividades em curso determinam simulação. [Passo fixo](https://gafferongames.com/post/fix_your_timestep/)

Cada atividade tem um modo autoritativo por intervalo. Em uma transição de detalhe, liquidar o intervalo pendente até um tick conhecido e transferir estoques, reservas e prazos. A validação define quais resultados devem ser equivalentes. Situações cuja consequência depende de ações individuais ficam no nível necessário.

## Escolhas de implementação

- **ECS seletivo.** Iniciar com registros e conjuntos de trabalho por atividade. Testar armazenamento por componente ou uma biblioteca ECS quando movimentação, percepção ou combate tiverem carga representativa. Comparar com os mesmos resultados, incluindo custo de consultas, mudança de componentes, memória e manutenção. Terreno e arte procedural seguem seus próprios formatos. [Consultas do Flecs](https://www.flecs.dev/flecs/Queries.html)
- **Máquinas de estados.** Usar em tarefas e ciclos de vida. Uma tarefa pode ser reservada, iniciar deslocamento, executar e concluir, ou ser cancelada. Guardas validam transições e cancelamento libera a reserva. A IA escolhe a tarefa. O estado descreve como ela prossegue. Usar hierarquia quando houver transições de fato compartilhadas.
- **Workers.** O gerador já roda em Worker. Manter um único dono do estado mutável. Avaliar mover a simulação para um Worker persistente quando a medição indicar benefício. Enviar comandos e deltas por revisão, com política de ressincronização. Avaliar clonagem e transferências de buffers sem transferir os dados autoritativos que o Worker ainda precisa acessar. [Objetos transferíveis](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
