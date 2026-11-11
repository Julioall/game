# Revisão da água, travessia e crescimento

## Resultado

A implementação mantém as regras executáveis em Node, o estado autoritativo em `src/world/state.js`, a apresentação em Three.js e a persistência na plataforma. O recorte continua sendo um protótipo de travessia. Navegação por estruturas, colisões com construções, interiores e simulação populacional exigem os próximos recortes do GDD.

| Limite da arquitetura | Implementação e verificação |
| --- | --- |
| Mundo e regras independentes do navegador | Hidrologia, consultas de água e travessia em `src/world/`. Testes executados em Node. |
| Estado confirma resultados | `WorldState` valida posições, destinos e passos. A interface envia coordenadas ou direção e apresenta os resultados. |
| Apresentação recebe uma projeção | `readOnlyWorld` expõe campos por consulta. Os índices entregam registros congelados. Malhas e atributos são derivados. |
| Atividade local | Nascentes e desembocaduras são indexadas por chunk. A animação procedural roda nos shaders. |
| Persistência e identidade | Gerações 1 a 4 têm seleção explícita. A geração original conserva a chave antiga. Árvores adicionais usam IDs determinísticos e passam por coleta e save. |
| Transporte | O Worker gera e transfere os buffers, depois encerra. A propriedade do estado mutável continua na thread principal. |

## Ajustes feitos na revisão

Os parâmetros de profundidade, velocidade, deriva, inclinação e chegada da travessia estão em `TRAVERSAL_PROFILE`, no catálogo. As funções de travessia recebem um perfil de dados opcional. O perfil atual representa o personagem experimental e não define as futuras espécies aquáticas.

A validação e a conclusão do destino saíram da interface e passaram para `WorldState`. A interface mantém entrada, câmera e o orçamento do acumulador de passos. O estado encerra o destino alcançado e a interface solicita cancelamento quando o movimento encontra um bloqueio.

As versões disponíveis e a versão atual da hidrologia foram centralizadas no catálogo. O raio da mata das nascentes também passou para o catálogo. A alteração preservou os valores observáveis.

`mouthFlow` aceita contadores opcionais para medir candidatos, segmentos de trajetória, amostras de conexão e consultas afetadas. `tools/benchmark-water.mjs` verifica a equivalência dos resultados e do trabalho com mais desembocaduras distantes.

## Contratos que precisam continuar explícitos

Os coeficientes de geração fazem parte de cada versão do terreno. Isso inclui limites de mapas pequenos, tamanho de lagoas, largura dos canais e profundidade das desembocaduras. Alterações nesses valores ou em `deepenMouth` que modifiquem terreno exigem nova versão e verificação de saves.

`water-flow.js` fornece um campo geométrico compartilhado pela escavação versionada e pela apresentação. A espuma, os reflexos e os redemoinhos são ajustados nos módulos de renderização. Uma alteração no campo compartilhado precisa ser avaliada também como alteração da geração.

O nível do mar atual é zero e a grade tem espaçamento de um metro. Marés e mudanças de nível precisarão de um contrato comum de superfície, terreno e navegação. Esses requisitos ainda não fazem parte do recorte implementado.

A corrente usada pela travessia vem da hidrologia. A turbulência e o espalhamento visual da foz são efeitos de superfície. Quando a corrente do lago afetar animais ou embarcações, suas velocidades e consequências devem ser definidas no estado do jogo.

A travessia tem um personagem transitório e não persiste sua posição. O deslocamento consulta terreno e água. A implementação de pontes e interiores navegáveis precisa integrar os mesmos modelos geométricos já usados pelas construções. A coleta e a construção do modo mapa mantêm os contratos anteriores.

## Medições

Execução em Node 24.22.1, Intel i7-12700 e Chrome com Intel UHD 770. A geração usa a mesma política do Worker, com compactação acima de 768 m. Foram três gerações por tamanho, sete lotes de consultas locais e três rodadas completas do playtest.

| Mapa | Geração p50 | Maior amostra de três rodadas | Buffers retidos na grade |
| --- | --- | --- | --- |
| 256 m | 130 ms | 142 ms | 3,30 MB |
| 768 m | 564 ms | 643 ms | 29,57 MB |
| 1.024 m | 1.144 ms | 1.163 ms | 23,11 MB |
| 5.000 m | 22.879 ms | 23.989 ms | 550,22 MB |

O pico de memória residente do processo de medição foi aproximadamente 1,45 GB. O tamanho dos buffers retidos não representa o pico necessário para gerar o mundo.

Em 1.024 consultas locais, adicionar 0, 1.000 ou 10.000 desembocaduras distantes manteve 2.507 candidatos, 31.823 segmentos e 1.961 amostras de conexão. Os resultados tiveram a mesma assinatura. As medianas ficaram entre 1,22 e 3,00 ms por lote. A variação de tempo inclui aquecimento e execução do runtime e não indica ganho causado pelos objetos distantes.

O microbenchmark de travessia com todos os atores ativos mediu p95 de 0,19 ms para 100, 1,46 ms para 1.000 e 10,91 ms para 5.000 atores por passo. Esse ensaio cobre consultas e deslocamentos no terreno. Percepção, busca de caminhos, colisões, tarefas autônomas e apresentação de milhares de atores ainda precisam de carga representativa.

Nas três rodadas do navegador, o p95 das cenas de vila, vista ampla e deslocamento ficou entre 16,8 e 16,9 ms. As vistas fixas mantiveram 403 e 601 chamadas de desenho. As medições de quadros incluem a cadência do navegador e não medem isoladamente o tempo de GPU ou a margem disponível no orçamento.

O mapa máximo merece prioridade em futuras otimizações de geração e memória. Os resultados atuais não demonstram a viabilidade desse tamanho em celulares reais. ECS completo e Worker de simulação persistente continuam dependendo de medições da futura carga populacional.

## Verificações e reprodução

`npm test` passou com 21 testes. `npm run build` passou, com aviso do Vite sobre o tamanho do bundle principal. `npm run playtest` passou em três rodadas, incluindo câmera, coleta, construção, save, travessia e perfil móvel emulado.

A comparação adicional com a hidrologia do commit anterior preservou exatamente terreno, superfície, máscara de água, rios e lagos da geração 1 nas sementes 57/128 m, 1769/256 m e 454/1.024 m.

Execute `npm run benchmark:water -- --max` para repetir geração, consultas locais e travessia. O relatório detalhado fica em `playtest-output/water-benchmark.json`. `npm run benchmark:placement` verifica os lotes com mais construções distantes. Os relatórios de navegador desta revisão ficaram em `playtest-output/audit-browser-1.json` até `audit-browser-3.json`.

Os diretórios de dependências, builds, capturas e relatórios locais continuam ignorados pelo Git. O manifesto recebeu apenas o comando de benchmark. As dependências e os avisos de terceiros não exigiram atualização.
