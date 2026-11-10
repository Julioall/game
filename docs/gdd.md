# GDD — Kingdom · Atlas Vivo

## Visão

Um mundo medieval procedural em que o jogador pode começar como um habitante, encontrar seu lugar em uma comunidade e assumir responsabilidades sobre terras, pessoas e fortalezas. O mesmo personagem que atravessa a ponte para vender madeira pode, mais tarde, decidir onde construir uma ponte e como defender a rota comercial.

## Pilares de design

| Referência | Princípio para o Kingdom | Aplicação |
| --- | --- | --- |
| The Elder Scrolls V: Skyrim | Liberdade para explorar e descobrir histórias no lugar onde acontecem | Caminhar pelo vale, entrar em uma cabana e conhecer moradores e facções. [Bethesda](https://bethesda.net/en-US/news/the-elder-scrolls-v-skyrim-welcome) |
| The Sims 3 | Habitantes com necessidades, traços e iniciativa | O lenhador decide entre terminar uma entrega, descansar ou procurar comida. Suas ações usam as mesmas capacidades e regras disponíveis ao jogador. [Richard Evans na GDC](https://www.gdcvault.com/play/1012805/Modeling-Individual-Personalities-in-The) |
| Age of Empires II: The Age of Kings | Ler o território, organizar trabalhadores, abastecer e defender assentamentos | Planejar estoques e rotas, erguer muralhas, coordenar guarnições e decidir onde investir. Os guias da edição definitiva documentam esses ciclos da série. [Economia e exército](https://www.ageofempires.com/learn-to-play/military-and-economy-aoe2/) · [Construção e defesa](https://www.ageofempires.com/learn-to-play/defending-your-empires-aoe2/) |

A identidade é medieval, com visual isométrico pixelado, profundidade e sombras. Casas camponesas usam palha. Vilas crescem em torno de caminhos, campos e travessias. Solares de pequenos nobres, castelos murados e grandes cidades formam uma hierarquia legível. As grandes cidades têm ruas alinhadas, fortificação perimetral, múltiplas entradas e uma fortaleza central. Estradas, portas, escadas e passagens são partes jogáveis quando suas regras de navegação estiverem implementadas.

## Experiência e progressão

1. **Viver e explorar.** Escolher um destino, conhecer pessoas, coletar, negociar, descansar e encontrar oportunidades. Acesso e disponibilidade dependem da situação do lugar e de quem está agindo.
2. **Construir e produzir.** Escolher um lote, reunir materiais e montar abrigo. Ferramentas, oficinas, estoques e trabalhadores formam cadeias em que a origem e o destino dos itens importam.
3. **Administrar.** Coordenar pessoas, prioridades e obras. Produção, comércio e proteção têm efeitos visíveis nos moradores e na região.
4. **Defender e expandir.** Ordenar patrulhas e deslocamentos, controlar passagens, abastecer forças e lidar com disputas territoriais. Batalhas e diplomacia pertencem a etapas futuras.

O jogador alterna entre agir no local e dar ordens em uma escala mais ampla. Uma ordem de coleta precisa identificar o alvo e respeitar acesso, capacidade e recursos. Um caminho bloqueado, uma oficina sem estoque ou uma entrega atrasada deve ter uma causa que o jogador consiga consultar.

## Primeiro recorte jogável após a migração

Uma vila, um personagem controlável, uma fonte de madeira, uma cabana e uma entrada utilizável. O jogador localiza um recurso, chega ao alcance, coleta, reúne os materiais, constrói em lote válido, abre a porta, entra e sai. A cabana e as alterações persistem ao recarregar. A câmera permite ler o interior quando o personagem entra.

O recorte seguinte inclui um habitante autônomo que disputa ou reserva um alvo e executa uma tarefa de coleta. Serve para validar a regra compartilhada, cancelamento e liberação de reservas antes de expandir para profissões, comércio e combate.

## Decisões em aberto

Ritmo dos dias, progressão social, sucessão, combate, ritmo da economia e grau de fidelidade da simulação distante dependem de protótipos jogáveis. O primeiro alvo é um jogo local de um jogador. A escala de milhares de personagens é uma meta de engenharia a medir, e os limites dependem de atividade, região e hardware.
