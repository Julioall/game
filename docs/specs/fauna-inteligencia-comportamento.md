# SPEC-FAUNA-001 — Inteligência ecológica e comportamento autônomo dos animais

> **Status:** especificação proposta, pronta para execução por etapas; **não implementada**.
> **Versão:** 1.0 · **Data:** 15/11/2026 · **Área:** simulação/fauna.
> **Repositório:** `Julioall/game` · **Dependências:** [arquitetura-alvo](../arquitetura-alvo.md), [GDD](../gdd.md), [auditoria da fauna](../auditoria-fauna.md), [validação](../validacao.md) e [PR #1 — bioma, animações e variações](https://github.com/Julioall/game/pull/1).
> **Regra de leitura:** requisitos e valores propostos não devem ser descritos como funcionalidades existentes. A conclusão de cada fase depende dos critérios verificáveis desta spec.

## 1. Objetivo e experiência esperada

Converter a fauna ambiente em um ecossistema autônomo e observável. Cada animal deve perceber parte do mundo, ter necessidades e características individuais, escolher objetivos úteis, navegar até eles e executar ações que alterem de verdade seu estado e o ambiente. A representação visual deve refletir ações **confirmadas pela simulação**, e não sorteios de animação.

Uma vaca procura pasto e água, acompanha seu rebanho e descansa; uma galinha cisca, se aproxima do bando e foge de uma raposa; a raposa avalia riscos, procura comida e pode perseguir presas; um cervo alerta o grupo; um lobo patrulha e eventualmente caça. Indivíduos da mesma espécie reagem de maneira semelhante em linhas gerais, mas não são clones.

### Requisitos funcionais

- **RF-01 — Identidade:** cada indivíduo conserva `id`, `seed`, espécie, traços próprios, posição e histórico suficiente para uma sessão consistente; geração determinística independe de ordem de streaming/render.
- **RF-02 — Necessidades:** fome, sede, energia, medo/estresse e saúde evoluem com tempo, atividade e características; outras necessidades são opcionais por espécie.
- **RF-03 — Decisão:** Utility AI pontua ações disponíveis com base em necessidade, oportunidades, distância, custo, risco e personalidade. Interrupções de segurança têm precedência.
- **RF-04 — Execução:** uma máquina de estados hierárquica (HFSM) acompanha tarefa, subestado, destino, prazo, sucesso, falha, cancelamento e liberação de recursos.
- **RF-05 — Percepção/memória:** o indivíduo identifica fontes de comida, água, abrigo, companheiros, ameaças e passagens locais; mantém memória limitada, com confiança e validade temporal.
- **RF-06 — Navegação:** caminhar, correr, saltar/voar/nadar quando suportados, contornar obstáculos e respeitar relevo, costa, construções e tipo de água.
- **RF-07 — Socialização:** rebanhos, bandos, alcateias e cardumes mantêm vínculos persistentes, espaçamento natural e reação a alarmes.
- **RF-08 — Ecologia:** recursos alimentares e hídricos, caça/predação e, nas últimas fases, reprodução, crescimento, morte, regeneração e equilíbrio populacional.
- **RF-09 — Tempo:** decisões, movimentação, necessidades e simulação distante usam relógio simulado e agendamento determinístico, não duração de quadros de render.
- **RF-10 — Persistência:** saves novos conservam resultados relevantes, com migração de saves anteriores e reconstituição sem duplicar animais ou eventos.
- **RF-11 — Escala:** regiões não visíveis continuam coerentes de forma econômica; a proximidade da câmera afeta o render, não determina sozinha se a fauna do mundo existe.
- **RF-12 — Observabilidade:** ferramentas mostram causa da decisão, destino, estado, memória, grupo, custo computacional e eventos.

### Fora do escopo inicial

Sem LLM, inferência neural por animal, aprendizagem por reforço, simulação fisiológica científica de alta fidelidade, genética detalhada ou migração continental. Não instalar uma ECS completa ou Worker persistente antes de benchmark demonstrar necessidade. Combate ao jogador, domesticação avançada, montaria e produção agrícola serão integrações posteriores, apesar de a arquitetura prever seus eventos.

## 2. Ponto de partida real (15/11/2026)

No `main` do repositório consultado:

| Elemento existente | Estado atual e limite |
| --- | --- |
| `src/world/fauna-catalog.js` | Catálogo de espécies, pesos por bioma, variantes visuais e parâmetros genéricos de movimento; não contém dieta nem necessidades. |
| `src/world/fauna.js` | População inicial determinística de referência de 1.024 indivíduos, índice espacial por chunks de 32 m e regras básicas de habitat. |
| `src/world/fauna-system.js` | `FaunaSystem` pertence ao `WorldState`, mantém registros e índice móvel, consulta região ativa e atualiza movimento a 0,1 s. |
| `src/world/fauna-motion.js` | Movimento de passeio local, pausa periódica e desvio básico; não encontra destinos por planejamento. |
| `src/world/state.js` | Projeção de leitura para render. Snapshot versão 1 não inclui fauna; estados derivados são só de sessão. |
| `src/render/fauna.js` | Cria/desfaz modelos, lê `velocity/action` e os encaminha à biblioteca de animação; não deve tomar decisões ecológicas. |

A [PR #1](https://github.com/Julioall/game/pull/1) propõe retirar leão e guepardo e individualizar aparências, além de restaurar a cadência visual. **Não pressupor que a PR está mesclada**. Para desenvolvimento desta spec, reconciliar primeiro o catálogo ativo e seus testes.

O repositório consultado ainda usa um adaptador Three.js; a migração local para Babylon.js citada no projeto pode não estar publicada neste ramo. Todos os contratos desta spec são **agnósticos ao motor gráfico**. Adaptar a apresentação conforme o código realmente adotado antes de iniciar a integração.

## 3. Decisões de arquitetura

1. **Núcleo autoritativo sem render:** `WorldState`/`FaunaSystem` resolvem escolhas, movimentos, recursos, dano, nascimento e morte. Não importar DOM, Three.js ou Babylon.js no domínio.
2. **Utility AI escolhe o *quê*:** funções de pontuação puras/limitadas por espécie. **HFSM executa o *como*.** Steering/Boids orientam movimento local e grupos; pathfinding fornece caminho global quando necessário.
3. **Dados antes de herança:** perfis por espécie e conjuntos de capacidades reutilizáveis; classes apenas para processos com ciclo de vida. ECS seletivo após medição comparativa.
4. **Determinismo:** mesmos dados de mundo, relógio, seed, ações do jogador e versões de regra produzem mesmo resultado; nunca usar `Math.random()`, `Date.now()`, ordem de Promises ou horário da câmera para regras.
5. **Comandos validados:** animais não modificam diretamente inventários ou recursos. Emitem intenções; o estado valida alcance, existência, quantidade e concorrência; só então registra eventos.
6. **LOD de simulação ≠ LOD visual:** streaming de malhas pode desligar animação fora do enquadramento sem apagar vidas, reservas, posições e decisões.
7. **Evolução vertical:** concluir um ciclo inteiro para vaca, raposa e galinha antes de generalizar as 22 espécies previstas após a PR #1.
8. **Metas configuráveis:** frequências, raios, pesos e limites ficam em configuração e são calibrados após testes, não espalhados como números mágicos.

### Módulos propostos (caminhos indicativos)

Preservar as APIs públicas existentes enquanto os componentes forem extraídos, sem renomeação ampla na primeira fase.

| Módulo | Responsabilidade |
| --- | --- |
| `src/world/fauna-profiles.js` | Dieta, sentidos, sociabilidade, risco, deslocamento, horários, reprodução e limites por espécie. |
| `src/world/fauna-needs.js` | Integração determinística de necessidades e saúde no tempo simulado. |
| `src/world/fauna-traits.js` | Personalidade e variação por `id` + `seed`; streams independentes de aleatoriedade. |
| `src/world/fauna-perception.js` | Consultas espaciais de recursos, outros animais, ameaças e passagens, com orçamento. |
| `src/world/fauna-memory.js` | Registro limitado de pontos conhecidos, confiança e expiração. |
| `src/world/fauna-utility.js` | Pontuação de objetivos, regras de interrupção, histerese e cooldown. |
| `src/world/fauna-actions.js` | HFSM de tarefas, estados, reserva, execução, conclusão e cancelamento. |
| `src/world/fauna-navigation.js` | Destinos, busca de rotas, validade de terreno e replanejamento. |
| `src/world/fauna-steering.js` | Separação, alinhamento, coesão, perseguição, fuga e desvio local. |
| `src/world/fauna-groups.js` | Grupos persistentes, liderança contextual, distância, alarme e coesão. |
| `src/world/fauna-ecology.js` | Fontes e estoques de alimento, consumo/regeneração, predação e eventos do ciclo de vida. |
| `src/world/fauna-scheduler.js` | Cadência por sistema, prioridade de evento, LOD lógico e recuperação de ticks. |
| `src/world/fauna-system.js` | Orquestrador/autoridade; mantém índice, estados e projeção de leitura. |
| `src/render/fauna.js` ou adaptador Babylon | Converte `action`/`velocity` para movimento e clipes, sem decidir ou aplicar consequências. |
| `test/fauna-*.test.js` | Testes de regras, determinismo, propriedade, regressão, migração e performance sintética. |

## 4. Contratos de dados

Os exemplos abaixo são **contratos propostos**, não interfaces existentes. Manter versão de dados e campos compatíveis com os IDs/seed históricos.

```ts
type AnimalState = {
  id: string;
  species: string;
  seed: number;
  x: number; y: number; z: number;
  heading: number;
  velocity: { x: number; y: number; z: number };
  needs: {
    hunger: number; thirst: number; fatigue: number;
    fear: number; health: number;
  }; // 0..1: hunger/thirst/fatigue/fear aumentam com carência;
     // health: 1 saudável, 0 morto
  traits: {
    caution: number; curiosity: number; sociability: number;
    aggression: number; metabolism: number;
  }; // derivados de seed+id+domínio
  brain: {
    goal: string;
    state: string;
    targetId: string | null;
    targetPosition: { x: number; z: number } | null;
    startedTick: number;
    nextDecisionTick: number;
    cooldownUntilTick: number;
    actionRevision: number;
  };
  groupId: string | null;
  memory: Array<{
    kind: string; targetId: string | null;
    x: number; z: number; confidence: number; expiresTick: number;
  }>;
  life?: { ageTicks: number; sex: string; maturity: number; alive: boolean };
};
```

Invariantes:

- Identidade imutável; `traits` podem ser rederivados e não precisam ser gravados integralmente se a versão de algoritmo for preservada.
- Necessidades ficam em [0,1], sem `NaN`, valores infinitos nem saltos negativos indevidos; saúde usa sentido explícito.
- Posições ocupam terreno/habitat válido para a espécie; uma exceção (travessia permitida, voo ou queda) exige modo explícito.
- No máximo uma ação autoritativa e uma reserva exclusiva relevante por animal; uma fonte compartilhável pode aceitar capacidade finita.
- `targetId` sempre se resolve ou provoca cancelamento/replanejamento, sem referência morta.
- Alteração de resultado do mundo deve passar por comando confirmado e evento com IDs determinísticos.
- A projeção para UI/render é cópia destacada, não oferece referência mutável para `AnimalState`.

**RNG:** usar hash determinístico com namespaces separados: `appearance`, `traits`, `decision`, `wander`, `group`, `reproduction`. A escolha depende de `seedDoMundo + idDoIndividuo + contadorDeEvento/tick + namespace`, e não de quantas vezes o renderer chamou um método. O destino é reproduzível com a mesma sequência de inputs.

### Contrato de decisão e execução

```ts
type Goal = 'forage' | 'drink' | 'rest' | 'explore'
  | 'followGroup' | 'flee' | 'hunt' | 'socialize'
  | 'reproduce' | 'idle';

type Decision = {
  actorId: string;
  goal: Goal;
  score: number;
  reason: string; // diagnóstico, não efeito de gameplay
  targetId?: string;
  targetPosition?: { x: number; z: number };
};

type BehaviorEvent = {
  id: string; tick: number; actorId: string;
  kind: string; targetId?: string;
  payload?: Record<string, unknown>;
};
```

Contrato com a apresentação: `{id, species, x,y,z, heading, velocity, action, actionRevision, actionOptions}`. A ação reflete a HFSM: `idle`, `walk`, `run`, `eat`, `drink`, `rest/sleep`, `flee`, `attack` e ações especiais quando suportadas pela biblioteca. Um adaptador de mapeamento faz fallback seguro se o clip não existir.

## 5. Seleção de objetivos (Utility AI)

Para cada objetivo elegível, calcular utilidade normalizada. Fórmula inicial **ajustável por teste**, não regra ecológica fechada:

```text
score = clamp01(
  needCurve * opportunity * personalityWeight
  - travelCost - hazardPenalty
  + contextBonus
)
```

- `needCurve`: curva não linear para fome, sede, fadiga etc.; urgências críticas crescem mais rápido.
- `opportunity`: alvo alcançável e disponível; zero para comida inexistente ou local inadequado.
- `personalityWeight`: modificador pequeno derivado de traços (não sobrepõe necessidades vitais).
- `travelCost`: distância geodésica aproximada, energia e impedimentos; nunca apenas distância euclidiana quando há rio/barranco.
- `hazardPenalty`: predadores, água perigosa, terreno excessivamente íngreme, obstáculos.
- `contextBonus`: horários, companheiros, hábitos e memória.

**Políticas anti-oscilação:**

1. Continuar a tarefa atual enquanto válida, exceto quando nova alternativa a superar por margem configurável (ex.: 15%) ou surgir ameaça urgente.
2. Cada objetivo tem tempo mínimo de compromisso e cooldown após falhar; ameaça, morte, dano e alvo invalidado ignoram compromisso.
3. Empates são resolvidos por prioridade estável e hash individual, nunca por ordem da consulta.
4. Ausência de alvo leva a explorar área segura ou descansar, não a alternar infinitamente `forage` ↔ `drink`.
5. Avaliação de decisão é limitada por orçamento, mas interrupções críticas entram em fila prioritária no tick seguinte.

### Máquina de estados hierárquica

```text
Alive
  ├─ Safe
  │    ├─ Idle / Explore
  │    ├─ Forage: SelectSource → Navigate → Eat → Complete
  │    ├─ Drink: SelectWater → Navigate → Drink → Complete
  │    ├─ Rest: SelectShelter → Navigate → Rest → Complete
  │    ├─ Socialize / FollowGroup
  │    └─ Hunt: Search → Stalk → Chase → Attack → Feed
  ├─ Alert: Investigate → Hide / Flee / Defend
  └─ Incapacitated: Injury / Recovery
Dead: CancelTasks → ReleaseReservations → RegisterDeath
```

Cada transição tem pré-condição, efeito permitido, limite de duração, consequência de falha e condição de cancelamento. Um animal não pode consumir uma fonte durante `Navigate` ou atacar uma presa fora do alcance validado.

## 6. Percepção, memória, ambiente e navegação

### Percepção

- Consultar vizinhos pela estrutura espacial existente (chunks de 32 m ou grade local mais fina), nunca por varredura de todos os animais em cada decisão.
- Percepção visual aproximada por alcance, campo angular e bloqueio simplificado pelo relevo/obstáculos; olfato e audição modelados como sinais locais/acontecimentos, sem física de odor de alta fidelidade.
- Respeitar diferenças de espécie: raposa identifica pequenos animais, vaca identifica rebanho/ameaça, galinha identifica alimento próximo e abrigo.
- Alimentação e água consultam recursos **reais**; terreno verde por si só não é quantidade infinita de comida quando a fase de consumo estiver ativa.
- Memória limitada (ex.: até 8–16 pontos relevantes por indivíduo), com TTL, confiança, substituição por relevância e recuperação ao perceber novamente.

### Navegação

1. **Local:** steering com `seek`, `arrive`, `avoid`, `separation` e fuga, respeitando aceleração/velocidade da espécie.
2. **Regional:** A* em grade navegável ou grafo de regiões, usando custos de declive, água, árvores, rochas, estradas, pontes, cercas e construções; cache invalidado por alteração real do mundo.
3. **Hierárquica quando necessário:** resolver rota entre regiões/chunks e depois percurso local. Não gerar navmesh global 5 km sem medição de custo/memória.
4. **Habitat:** fauna terrestre não anda pelo fundo de lago; nadadores permanecem em corpos d'água conectados adequados; aves com voo têm altitude/percha e transições explicitamente suportadas.
5. **Falha:** após N obstáculos ou timeout, replanejar, trocar alvo ou cancelar; impedir teletransporte corretivo visível.
6. **Coordenadas:** pathfinding usa representação autoritativa dos obstáculos. A interpolação da animação nunca altera posição física confirmada.

## 7. Interações reais e ecologia

### Comida e água

- Definir dieta por espécie: herbívoro, carnívoro, onívoro, insetívoro, piscívoro, conforme capacidade do ecossistema efetivamente modelada.
- Criar fontes localizadas com `resourceId`, quantidade/qualidade, raio utilizável, regeneração e estação quando existir; pasto pode ser agregado por célula de recurso.
- `Eat/Drink` valida novamente alvo, alcance, capacidade e disponibilidade; debita estoque ou confirma água acessível em transação única; só então reduz necessidade e publica evento.
- Reserva só quando estritamente necessária (ex.: presa exclusiva, ponto estreito ou fonte limitada). Evitar reservar todo o pasto para um único animal.
- Se o ecossistema ainda não fornecer comida, não habilitar desgaste letal global; usar flags de fase e dados sintéticos de teste.
- Água salgada não satisfaz automaticamente sede de espécies terrestres; água barrenta, fluxo e margens perigosas podem modificar acesso.

### Predação e defesa

- Perfis de presa/predador e tamanhos compatíveis; evitar combinações absurdas.
- Perseguição requer presa percebida/lembrada, distância e energia viáveis; ataque exige alcance, orientação, oportunidade e cooldown.
- Dano, ferimento e morte são efeitos do estado autoritativo. A animação `attack`/`death` representa evento; ela **não** decide o resultado.
- Presa pode perceber ameaça e fugir; companheiros recebem alarmes locais deduplicados com TTL e distância de propagação.
- Caça malsucedida gera custo energético e pode levar predador a desistir; não perseguir indefinidamente.

### Grupos e comportamento coletivo

- `groupId` estável por rebanho/bando/alcateia/cardume; filiação por regras de espécie, proximidade inicial e mudanças explícitas.
- Boids: **separação** (evitar sobreposição), **alinhamento** (direção parecida) e **coesão** (manter grupo), com pesos por espécie e contexto. Usar busca de vizinhos local e limite máximo de vizinhos.
- Objetivo coletivo é sugestão, não sincronização rígida. Cada animal tem atraso/limiar próprio para começar a beber, fugir ou acompanhar.
- Um alerta pode propagar-se ao grupo, mas usa validade, confiança e supressão de repetição para evitar tempestade de eventos.
- A liderança é contextual; a ausência temporária de líder não congela o grupo.
- Ao carregar/descarregar representação visual, IDs/grupos não mudam.

### Ciclo de vida (fase avançada)

- Idade, sexo quando aplicável, maturidade, época reprodutiva, gestação/incubação simplificada, nascimento, envelhecimento e morte.
- Filhote recebe ID único determinístico (grupo/parentesco/tick/contador persistido), perfil etário e aparência compatível; não reutilizar IDs de mortos.
- Nascimentos exigem energia, parceiros e capacidade de suporte; regular densidade por alimento, habitat e eventos, não somente pelo valor inicial de 1.024.
- População agregada mantém contas coerentes de entradas, saídas, mortalidade e migração; resultados não devem duplicar quando uma região volta ao modo detalhado.

## 8. Inteligência por espécie e evolução do escopo

**Laboratório vertical obrigatório:**

| Espécie | Ciclo mínimo completo | Demonstração |
| --- | --- | --- |
| Vaca (`cow`) | Pastar → beber → descansar → acompanhar grupo → reagir ao perigo | Rebanho não sincronizado, desvia de árvores e encontra água doce válida. |
| Galinha (`chicken`) | Ciscar → alimentar-se → aproximar-se do bando → buscar abrigo/fugir | Indivíduos escolhem alvos diferentes e escapam da raposa sem atravessar objetos. |
| Raposa (`fox`) | Explorar → perceber presa → perseguir → atacar/comer ou desistir → descansar | Caça produz consequência consistente; raposa cansada interrompe perseguição. |

**Expansão posterior:** `sheep, goat, horse, deer, boar, pig, rabbit` (herbívoros/onívoros e rebanhos); `wolf, bear, dog, cat` (predação, cautela e sociabilidade); `rat, frog, snake, spider` (pequenas escalas/ação especializada); `crow, eagle` (aves); `fish, shark` (nado/habitat aquático). Confirmar catálogo aprovado depois de PR #1 e revisar perfis de clima/bioma antes de ativar qualquer espécie. Nenhuma espécie ausente do bioma deve ressurgir via fallback de geração.

**Tabela de capacidades:** `canGraze`, `canHunt`, `canSwim`, `canFly`, `flocks`, `nocturnal`, `territorial` etc. Evitar ramificações gigantes baseadas em strings de espécie. Só declarar capacidade quando a mecânica correspondente estiver implementada e testada.

## 9. Relógio, orçamento e LOD lógico

A simulação atual executa movimento local a 10 Hz. Evoluir em passos controlados e medidos:

| Nível lógico | Acionamento | Frequência de referência, a calibrar |
| --- | --- | --- |
| **Detalhado** | Jogador interage, caça ativa, ameaça, grupo próximo, situação crítica | Movimento/colisão 10–20 Hz; decisão normal 1–2 Hz; eventos críticos no próximo tick. |
| **Intermediário** | Zona ativa de gameplay, fora de interação imediata | Necessidades e decisão por lotes a cada 2–5 s; caminho agregado/validado. |
| **Agregado** | Regiões sem eventos individuais pendentes | Atualização de população, recursos e prazos em passos de 30–120 s de **tempo simulado**. |

A animação visual pode funcionar até 60 Hz perto da câmera; **não** recalcular Utility AI a cada frame. Raios e cadências são knobs de tuning, nunca promessas de custo constante.

**Promoção/rebaixamento sem perda de história:** concluir o intervalo até o tick de corte, registrar reservas/deltas/estoques e só então mudar de modo. Uma caça, combate, ação do jogador ou alvo reservado mantém detalhe suficiente para preservar a consequência. Não criar nem matar animais arbitrariamente ao entrar/sair da tela. Retomar uma aba suspensa em lotes limitados, sem processar milhares de ticks detalhados de uma vez.

**Orçamento:** agendamento distribuído por hash do ID; filas por prazo e prioridade, consultas espaciais; limites para expansão de A*, memória, propagação de eventos e reservas. Se exceder o orçamento, adiar decisões não críticas com diagnóstico, jamais descartar eventos de dano/consumo já confirmados.

## 10. Persistência, compatibilidade e replays

- O save atual usa versão 1 e não inclui fauna. Definir migração **versionada** antes de ativar persistência desta feature.
- Saves antigos devem continuar carregando com população inicial estável, sem sobrescrever construções/recursos; seeds e IDs anteriores são mantidos quando possível.
- Guardar **deltas**: necessidades/vida relevantes, posição se deslocada, tarefa e prazo, memória essencial, `groupId`, nascimentos/mortes, estoque ecológico alterado, contadores de IDs/eventos e relógio de simulação. Não duplicar geometria/índices deriváveis.
- Definir serialização de tarefas em curso e restauração de reservas com revalidação; alvo inexistente resulta em cancelamento seguro.
- Teste de replay: mesmo seed, versão de regra, comandos e número de ticks => mesmo hash de estados/recursos/eventos, com e sem câmera e em diferentes taxas de render.
- Mudança de `FAUNA_GENERATOR_VERSION`, espécies ou política de população exige nota de migração e comparação explícita de seeds. Não transformar diferenças de distribuição em regressão silenciosa.

## 11. Etapas de implementação e critérios de aceite

Cada fase gera um PR pequeno, testes e uma anotação em `docs/validacao.md`. **Não declarar concluída sem as evidências.**

### F00 — Baseline e contratos (P0)

**Depende de:** nenhuma. **Entrega:** contratos, flags e linha de base.

- [ ] Reconciliar a PR #1 (espécies, variações, animação) com o ramo e a engine efetivamente utilizados.
- [ ] Congelar exemplos de geração, IDs, seeds 1769/454, inventário de espécies e traces antes das alterações.
- [ ] Adicionar relógio de ticks e contadores de `decisionMs`, `navigationMs`, `perceptionMs`, `activeAnimals`, `events`.
- [ ] Registrar métricas CPU, GPU, memória e FPS nos cenários existentes; separar render de simulação.

**Aceite:** snapshot de referência reproduzível, módulos sem dependência de renderer e caminho de execução de testes documentado.

### F01 — Identidade, traços e necessidades (P0)

**Depende de:** F00. **Entrega:** indivíduo persistente em sessão com metabolismo simples.

- [ ] Perfis de `cow/fox/chicken` com metabolismo e preferências.
- [ ] Gerar traços estáveis por seed+ID; valores diferentes entre indivíduos, sem alterar aparência.
- [ ] Integrar necessidades no tempo simulado com clamps, limites por atividade e relógio.
- [ ] Expor projeção somente leitura e diagnóstico individual.

**Aceite:** 100 indivíduos da mesma espécie mostram diversidade mensurável; mesma seed/comandos/ticks geram estados idênticos; nenhuma necessidade sai de [0,1].

### F02 — Utility AI e HFSM mínima (P0)

**Depende de:** F01. **Entrega:** seleção e execução de `idle, explore, forage, drink, rest, flee` com alvos sintéticos.

- [ ] Funções de utilidade parametrizadas, regras de elegibilidade, desempate estável, histerese e cooldown.
- [ ] Estados hierárquicos com entrada/saída, timeout, cancelamento, resultado e diagnóstico.
- [ ] Interrupção por ameaça e fallback quando alvo desaparece.
- [ ] Mapeamento de intenção para `action/actionRevision` sem afetar a lógica pela animação.

**Aceite:** sob fome e comida disponível, `forage` vence; sede crítica com água acessível vence quando apropriado; ameaça válida interrompe em até 1 tick; sem alternância espúria em teste longo.

### F03 — Percepção, memória e relógio de decisões (P0)

**Depende de:** F02. **Entrega:** animal detecta elementos reais locais.

- [ ] Consultas por chunk/célula e perfis sensoriais de três espécies.
- [ ] Memórias limitadas com confiança e expiração; desaparecimento do alvo invalida tarefa.
- [ ] Agendamento de decisões escalonado por ID; gatilhos de urgência por evento.
- [ ] Alarmes locais sem multiplicação infinita.

**Aceite:** sem varrer todos os animais por decisão; ameaça fora de alcance não provoca fuga; recurso conhecido pode ser lembrado, mas não consumido se esgotado.

### F04 — Navegação e movimentação contextual (P0)

**Depende de:** F03. **Entrega:** alcançar destino contornando obstáculos.

- [ ] Controlador local de direção/velocidade/aceleração e desaceleração `arrive`.
- [ ] Pathfinding regional baseado em mapa autoritativo, com custos de habitat e declive.
- [ ] Desvio de árvores, rochas, rios, construções e outros animais; timeout/replanejamento.
- [ ] Adaptador de pose caminhada/corrida/idle sem congelamento e sem interferência na posição autoritativa.

**Aceite:** vaca alcança água doce por caminho viável, raposa contorna obstáculo, galinha não atravessa paredes; sem teleporte, oscilação permanente ou animação incompatível.

### F05 — Alimentação, água e descanso reais (P0) — **primeiro marco jogável**

**Depende de:** F04. **Entrega:** ciclo autônomo completo de vaca e galinha.

- [ ] Fontes de pasto, alimento de solo, água e abrigo ancoradas no mundo.
- [ ] Validação transacional de `eat/drink/rest` e atualização de estoque/necessidade.
- [ ] Regeneração de fontes, concorrência e fallback quando recurso termina.
- [ ] Teste de coexistência com coleta/construção do jogador.

**Aceite:** ações produzem consequências reais; estoque não fica negativo; duas galinhas não consomem a mesma unidade exclusiva; a vaca não bebe mar; o animal consegue completar dois ciclos consecutivos sem intervenção.

### F06 — Predação, reação e combate fauna-fauna (P1)

**Depende de:** F05. **Entrega:** raposa caça galinha/pequenas presas.

- [ ] Identificação de presa adequada, perseguição com custo de energia e desistência.
- [ ] Alarme, fuga e busca de proteção por presas e grupos.
- [ ] Ataque, ferimento/morte e alimentação com comando/evento validado.
- [ ] Evitar matar uma presa duas vezes ou deixar presa morta com tarefa ativa.

**Aceite:** cenário determinístico de caça bem-sucedida e malsucedida; nenhuma morte duplicada; aumento de fome orienta caça, energia baixa interrompe perseguição; efeitos visuais correspondem a eventos confirmados.

### F07 — Rebanhos, bandos e alcateias (P1)

**Depende de:** F04 e F06. **Entrega:** formação social persistente.

- [ ] Formação e filiação de grupos por espécie/território.
- [ ] Boids local com vizinhança limitada e pesos por espécie.
- [ ] Comportamentos coordenados com atrasos individuais e eventos de perigo.
- [ ] Testar divisão/reunião, ausência de líder e mudança de região.

**Aceite:** rebanho caminha junto sem sobreposição sistemática; animais preservam `groupId` quando saem da tela; alarmes não causam loop; ações não são perfeitamente sincronizadas.

### F08 — Perfis completos, rotina e habitat (P1)

**Depende de:** F05–F07. **Entrega:** capacidades de cada espécie ativa.

- [ ] Completar dietas, sentidos, velocidade, descanso, horários, sociabilidade e limites por espécie.
- [ ] Adaptar aves, animais aquáticos, pequenos saltadores, serpentes e aranhas sem tratá-los como quadrúpedes.
- [ ] Conectar calendário/clima/estação **quando** esses sinais forem autoritativos; defaults seguros caso contrário.
- [ ] Matriz de spawn, comida, água, predadores, ações e regiões por espécie.

**Aceite:** todas as espécies ativas têm fallback válido, transições coerentes e habitat adequado; nenhuma exigência de recurso inexistente bloqueia para sempre a simulação.

### F09 — Ciclo de vida, ecologia e persistência (P1)

**Depende de:** F08. **Entrega:** população evolui sem resets arbitrários.

- [ ] Maturação, reprodução simplificada, nascimento, mortalidade e capacidade de suporte.
- [ ] Estoques/regeneração e limites ecológicos por região.
- [ ] Saves versionados, migração de versão 1, serialização de deltas/memória/grupos.
- [ ] Eventos e IDs reprodutíveis, replay e limpeza de reservas órfãs.

**Aceite:** salvar/carregar no meio da caça e do consumo preserva invariantes; animais mortos não reaparecem; nascimentos não duplicam; testes de migração e replay passam.

### F10 — Simulação distante e otimização por orçamento (P1)

**Depende de:** F09. **Entrega:** LOD lógico sem alterar a história.

- [ ] Ativação por relevância de gameplay, eventos e prazo; nunca apenas por frustum.
- [ ] Regiões intermediárias e agregadas com contas de animais, recursos e prazos.
- [ ] Transições detalhado ↔ agregado com reconciliação de eventos e estoques.
- [ ] Medir caches, scheduler, pathfinding e custo por subsistema em mapas 1.024 m e 5.000 m.
- [ ] Considerar ECS especializado/Worker persistente apenas após benchmark comparativo.

**Aceite:** alternar modo de simulação não duplica/perde indivíduos nem consumos; cenário de estresse conserva consistência e respeita orçamento configurado, sem congelar render.

### F11 — Instrumentação, QA e conclusão (P1)

**Depende de:** F00–F10. **Entrega:** comportamento explicável e regressão protegida.

- [ ] Inspector de animal: ID, espécie, necessidades, traços, objetivo, `score`, alvo, memória, grupo, caminho e decisão anterior.
- [ ] Overlay com status das regiões/LOD, counters de decisões, nós A*, candidatos espaciais, eventos e tempos p50/p95.
- [ ] Replays e cenários automatizados de 30 min de tempo simulado, sem memória não limitada.
- [ ] Teste visual em primeira pessoa e mapa, com diversas seeds e atividades do jogador.
- [ ] Atualizar docs de arquitetura, GDD, auditoria e validação com evidências e limitações.

**Aceite:** todos os requisitos RF-01 a RF-12 têm teste ou inspeção rastreável; benchmarks comparativos registrados; sem regressão funcional de água, terreno, construção e saves.

## 12. Gates de entrega

| Marco | Fases | Demonstração |
| --- | --- | --- |
| **M0 — Fundamentos** | F00–F02 | Necessidades e decisões reprodutíveis, sem movimentos aleatórios arbitrários. |
| **M1 — Ecossistema mínimo** | F03–F05 | Vaca e galinha encontram comida/água, descansam e navegam. |
| **M2 — Interações vivas** | F06–F07 | Raposa caça; galinha foge; rebanhos se movem de modo natural. |
| **M3 — Ecologia completa** | F08–F09 | Perfis por espécie, população com ciclo de vida, recursos e save. |
| **M4 — Escalabilidade e entrega** | F10–F11 | Simulação distante consistente, métricas e testes de longa duração. |

Não avançar para reprodução/LOD agregado usando ações de consumo fictícias. Completar primeiro o circuito de recursos, comandos e eventos.

## 13. Estratégia de testes

### Regras e propriedades (Node, sem motor gráfico)

- **Determinismo:** seed 1769 repetida, mesma configuração e comandos => hash idêntico de estado; seed 454 gera variação; ordem de criação dos modelos não influencia simulação.
- **Fisiologia:** `needs` válidas após milhares de ticks, incluindo pausa/retomada, mudança de objetivo e ausência de recursos.
- **Utilidade:** prioridade coerente para fome/sede/fadiga/medo e sem thrashing em fronteira de pontuação.
- **Navegação:** regiões aquáticas/terrestres, encostas, pontes, obstáculos dinâmicos e destinos inalcançáveis.
- **Consistência:** consumo nunca negativo; reserva cancelada libera alvo; ataque não atinge presa morta; grupo sem membros limpa referência.
- **Persistência:** save antigo, save novo, reload no meio de uma ação, dois replays, migração por catálogo e ausência de duplicatas.
- **LOD lógico:** promoções/rebaixamentos preservam contagens, recursos, deadlines e eventos.

### Cenários visuais e funcionais

1. **Pasto próximo ao lago — seed 1769:** vacas com aparência individual diferente encontram água, pastam, descansam, contornam árvores e não param simultaneamente.
2. **Galinhas e raposa — seed 1769:** galinhas ciscam separadamente, uma percebe predador e reage; raposa caça ou desiste de acordo com energia.
3. **Floresta com cervos e lobos:** grupo percebe perigo, foge sem atravessar terreno inadequado e se reorganiza.
4. **Rio, lago e costa:** animal terrestre não atravessa água profunda sem capacidade; peixe permanece em habitat aquático permitido e não atravessa terra.
5. **Stress 1.024 e 5.000 m:** sessão prolongada, teletransporte visual, zoom amplo, primeira pessoa, troca de região, construção, save e recarga.

### Critérios de desempenho propostos (metas, não resultados medidos)

- Capturar linha de base no mesmo hardware/navegador/configuração antes de cada fase.
- Simular pelo menos 1.024 animais de mundo e cenários com 20/60/100 agentes com relevância local; testar escala superior quando houver perfil disponível.
- Registrar custo por subsistema (média, p95 e máximo), eventos processados, nós expandidos, memória e FPS, separando CPU de render, GPU e geração.
- **Meta inicial a calibrar:** decisões+percepção+navegação da fauna local com p95 de até 2 ms por frame equivalente de 60 FPS no dispositivo desktop de referência, sem varredura O(N²) global por tick. Revisar meta conforme baseline e hardware mínimo definidos.
- Sem quedas sustentadas de FPS, travamentos de vários segundos, vazamento de modelos/eventos nem acúmulo ilimitado de jobs; comparar desempenho antes/depois.
- O teste em navegador e WebGL/Babylon é obrigatório para aprovar o visual e as animações. Testes Node sozinhos não confirmam naturalidade.

### Comandos de validação existentes

```sh
npm test
npm run build
npm run playtest
npm run audit:fauna
npm run benchmark:placement
```

Acrescentar, quando os módulos entrarem, comandos como `test:fauna-ai`, `benchmark:fauna-ai` e `replay:fauna`, mantendo parâmetros e saídas estáveis para CI. Esses novos scripts **ainda não existem**.

## 14. Riscos e políticas de mitigação

| Risco | Estratégia |
| --- | --- |
| IA troca de objetivo repetidamente ou parece robótica | Histerese, compromisso mínimo, pausa individual, velocidades/acelerações e debug do motivo da decisão. |
| Predador vê presa através de morro/parede | Percepção por alcance, ângulo e oclusão simplificada; testes no terreno real. |
| Caminho sem saída prende animal para sempre | Timeout, retry limitado, memória de falha e fallback seguro. |
| Consumo duplicado ou estoque negativo | Fonte autoritativa, atualização atômica e evento deduplicado. |
| Rebanho pesado com centenas de vizinhos | Índice local, limite de vizinhos, atualização escalonada e pesos simples. |
| LOD lógico faz animal desaparecer ou duplicar | Identidade estável, ledger por região, reconciliação por tick e testes de transição. |
| Variantes visuais ou motor gráfico mudam regras | Contrato de projeção unidirecional e aleatoriedade isolada por domínio. |
| Save perde mundo anterior | Versão/migração explícita, golden fixtures e testes de retorno. |
| Expansão de escopo impede um ciclo jogável | Primeiro vaca/galinha/raposa; gates M0–M4; sem implementar todas as espécies de uma vez. |
| Meta de desempenho irreal | Medir baseline e p95 em hardware de referência antes de fixar orçamento definitivo. |

## 15. Definition of Done geral

A implementação integral só poderá ser marcada como **Concluída** quando:

- [ ] Os 12 requisitos funcionais tiverem evidências rastreáveis.
- [ ] M0–M4 estiverem aceitos, com testes automatizados e inspeções visuais.
- [ ] Decisões e consequências ecológicas forem produzidas pelo estado, não por clipes de animação.
- [ ] Os três animais piloto apresentarem ciclos completos e os demais perfis ativos não ficarem sem comportamento.
- [ ] Testes de save/migração/replay confirmarem que os indivíduos persistem e não duplicam.
- [ ] Logs e overlay permitirem explicar por que um animal escolheu uma ação e por que falhou.
- [ ] Desempenho tenha sido medido e aprovado no hardware escolhido; limitações restantes estejam documentadas.
- [ ] A documentação deixe claro o que está implementado, o que é proposta e quais integrações futuras permanecem fora de escopo.

---

**Ordem recomendada de execução:** F00 → F01 → F02 → F03 → F04 → F05 → F06 → F07 → F08 → F09 → F10 → F11. A primeira demonstração realmente útil é **M1 (vaca/galinha alimentando-se e bebendo de forma autônoma)**; a primeira demonstração de ecossistema emergente é **M2 (raposa, galinha e rebanho interagindo)**.